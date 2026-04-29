import { db } from '../../db/index.js';
import { websites, domains, ftpAccounts, cronJobs, backupSchedules } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { run } from '../../services/executor.js';
import { nginxService } from '../../services/nginx.service.js';
import { apacheService } from '../../services/apache.service.js';
import { PhpFpmService } from '../../services/php-fpm.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { nanoid } from 'nanoid';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';
import { FtpService } from '../ftp/ftp.service.js';
import { CronService } from '../cron/cron.service.js';
import { WebServerService } from '../webserver/webserver.service.js';
import type { Website } from '../../db/schema/websites.js';
import type { Domain } from '../../db/schema/domains.js';

// Create service instances for cascade operations
const ftpService = new FtpService();
const cronService = new CronService();
const webServerService = new WebServerService();

/** Base directory for website home directories */
const SITES_ROOT = '/var/www/sites';

/** Default index.html placed in new website httpdocs */
function defaultIndexHtml(siteName: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Welcome to ${siteName}</title></head>
<body><h1>${siteName} — Website successfully created</h1></body>
</html>`;
}

export class WebsitesService {
  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  /**
   * List all websites
   */
  async list(): Promise<Website[]> {
    return db.select().from(websites);
  }

  // ---------------------------------------------------------------------------
  // Get
  // ---------------------------------------------------------------------------

  /**
   * Get website by ID with attached domains
   */
  async get(id: string): Promise<Website & { domains: Domain[] }> {
    const [website] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, id));

    return { ...website, domains: attachedDomains };
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  /**
   * Create a new website:
   * 1. Generate websiteId (nanoid)
   * 2. Create system user: sf_{websiteId}
   * 3. Create directory structure: /var/www/sites/{websiteId}/{httpdocs,private,logs,tmp,ssl,backup}
   * 4. chown -R sf_{websiteId}:www-data
   * 5. Insert into DB
   * 6. Apply website config (nginx + PHP-FPM pool)
   */
  async create(
    data: {
      name: string;
      phpVersion?: string;
      phpHandler?: string;
      webServer?: string;
    },
    userId?: string,
    ipAddress?: string,
  ): Promise<Website> {
    const {
      name,
      phpVersion = '8.2',
      phpHandler = 'php-fpm',
      webServer = 'nginx+apache',
    } = data;

    // 1. Generate IDs and paths
    const websiteId = nanoid();
    const systemUser = `sf_${websiteId}`;
    const siteDir = `${SITES_ROOT}/${websiteId}`;
    const documentRoot = `${siteDir}/httpdocs`;

    // 2. Validate PHP version if handler is not disabled
    if (phpHandler !== 'disabled') {
      const socketPath = `/run/php/php${phpVersion}-fpm.sock`;
      const socketCheck = await run('test', ['-S', socketPath], { sudo: true });
      if (!socketCheck.success) {
        const fpmCheck = await run('test', ['-x', `/usr/sbin/php-fpm${phpVersion}`], { sudo: false });
        if (!fpmCheck.success) {
          throw new AppError(422, 'PHP_VERSION_NOT_AVAILABLE', `PHP ${phpVersion} is not installed.`);
        }
      }
    }

    try {
      // 3. Create directory structure
      await sudoFs.mkdir(`${siteDir}/httpdocs`);
      await sudoFs.mkdir(`${siteDir}/private`);
      await sudoFs.mkdir(`${siteDir}/logs`);
      await sudoFs.mkdir(`${siteDir}/tmp`);
      await sudoFs.mkdir(`${siteDir}/ssl`);
      await sudoFs.mkdir(`${siteDir}/backup`);

      // Write default index.html
      await sudoFs.writeFile(`${documentRoot}/index.html`, defaultIndexHtml(name));

      // 4. Create system user
      const useraddResult = await run('useradd', [
        '--system',
        '--no-create-home',
        '--shell',
        '/usr/sbin/nologin',
        systemUser,
      ], { sudo: true });
      if (!useraddResult.success) {
        logger.warn({ systemUser, stderr: useraddResult.stderr }, 'useradd failed — user may already exist');
      }

      // Set ownership
      const chownResult = await run('chown', ['-R', `${systemUser}:www-data`, siteDir], { sudo: true });
      if (!chownResult.success) {
        logger.warn({ systemUser, stderr: chownResult.stderr }, 'chown failed during website creation');
      }

      const chmodResult = await run('chmod', ['755', documentRoot], { sudo: true });
      if (!chmodResult.success) {
        throw new Error(`chmod failed: ${chmodResult.stderr}`);
      }

      // 5. Insert into DB first so applyWebsiteConfig can look up the website
      await db.insert(websites).values({
        id: websiteId,
        name,
        systemUser,
        documentRoot,
        phpVersion,
        phpHandler: phpHandler as any,
        webServer: webServer as any,
        status: 'active',
      });

      // 6. Apply website config (nginx vhost + PHP-FPM pool)
      try {
        await webServerService.applyWebsiteConfig(websiteId);
      } catch (e) {
        logger.warn({ err: e, websiteId }, 'Website config apply failed — continuing');
      }

      logger.info({ websiteId, name, documentRoot, systemUser }, 'Website created successfully');

      auditService.log({
        userId,
        action: 'website.create',
        resource: `website:${websiteId}`,
        details: JSON.stringify({ name, phpVersion, phpHandler, webServer }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      const [created] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
      return created;
    } catch (error) {
      // Rollback on failure
      try {
        await webServerService.removeWebsiteConfig(websiteId).catch(() => {});
      } catch { /* ignore */ }
      await run('rm', ['-rf', siteDir], { sudo: true }).catch(() => {});
      await run('userdel', [systemUser], { sudo: true }).catch(() => {});
      throw new AppError(422, 'WEBSITE_CREATE_FAILED', `Failed to create website: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  /**
   * Update website settings (PHP version, web server, etc.)
   * If phpVersion or phpHandler changes, regenerates both nginx config and PHP-FPM pool.
   */
  async update(
    id: string,
    data: {
      name?: string;
      phpVersion?: string;
      phpHandler?: string;
      webServer?: string;
    },
    userId?: string,
    ipAddress?: string,
  ): Promise<Website> {
    const [website] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phpVersion !== undefined) updateData.phpVersion = data.phpVersion;
    if (data.phpHandler !== undefined) updateData.phpHandler = data.phpHandler;
    if (data.webServer !== undefined) updateData.webServer = data.webServer;

    // Update DB first so applyWebsiteConfig sees the new values
    await db.update(websites).set(updateData).where(eq(websites.id, id));

    // If PHP version/handler or webServer changed, regenerate configs
    const needsConfigUpdate = data.phpVersion || data.phpHandler || data.webServer;
    if (needsConfigUpdate) {
      try {
        // Remove old PHP-FPM pool (if version changed, the old pool is at the old version path)
        if (data.phpVersion && data.phpVersion !== website.phpVersion) {
          await PhpFpmService.removeWebsitePool(id).catch(() => {});
        }

        // Re-read updated website to get new values
        const [updated] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
        if (updated) {
          // Regenerate nginx config + PHP-FPM pool
          await webServerService.applyWebsiteConfig(id);
        }
      } catch (e) {
        logger.warn({ err: e, websiteId: id }, 'Config regeneration failed during website update');
      }
    }

    logger.info({ websiteId: id }, 'Website updated');

    auditService.log({
      userId,
      action: 'website.update',
      resource: `website:${id}`,
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  /**
   * Delete website with full cascade:
   * 1. Delete all FTP accounts
   * 2. Delete all cron jobs
   * 3. Delete all backup schedules
   * 4. Remove website config (nginx + PHP-FPM pool)
   * 5. Remove legacy per-domain nginx/apache vhost configs
   * 6. Delete directory tree
   * 7. Delete system user
   * 8. Detach all domains (set websiteId = null)
   * 9. Delete website record from DB
   */
  async delete(id: string, userId?: string, ipAddress?: string): Promise<{ success: boolean }> {
    const [website] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    const errors: string[] = [];

    // Get all attached domains before cleanup
    const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, id));

    // 1. Delete all FTP accounts linked to attached domains
    try {
      for (const domain of attachedDomains) {
        const ftpList = await db.select().from(ftpAccounts).where(eq(ftpAccounts.domainId, domain.id));
        for (const ftp of ftpList) {
          await ftpService.deleteAccount(ftp.id);
        }
      }
    } catch (e: any) { errors.push(`FTP: ${e}`); }

    // 2. Delete all cron jobs for this website's system user
    try {
      const allCronJobs = await db.select().from(cronJobs)
        .where(eq(cronJobs.systemUser, website.systemUser));
      for (const job of allCronJobs) {
        await cronService.deleteJob(job.id);
      }
    } catch (e: any) { errors.push(`Cron: ${e}`); }

    // 3. Delete all backup schedules linked to attached domains
    try {
      for (const domain of attachedDomains) {
        await db.delete(backupSchedules).where(eq(backupSchedules.domainId, domain.id));
      }
    } catch (e: any) { errors.push(`Backups: ${e}`); }

    // 4. Remove website config (nginx website-level config + PHP-FPM pool)
    try {
      await webServerService.removeWebsiteConfig(id);
    } catch (e: any) { errors.push(`Website config: ${e}`); }

    // 5. Remove legacy per-domain nginx/apache vhost configs (backward compat)
    for (const domain of attachedDomains) {
      try {
        await nginxService.removeVhost(domain.name);
      } catch (e: any) { errors.push(`Nginx(${domain.name}): ${e}`); }

      try {
        await apacheService.removeVhost(domain.name);
      } catch (e: any) { errors.push(`Apache(${domain.name}): ${e}`); }
    }

    // 6. Delete directory tree
    const siteDir = `${SITES_ROOT}/${id}`;
    try {
      await run('rm', ['-rf', siteDir], { sudo: true });
    } catch (e: any) { errors.push(`Files: ${e}`); }

    // 7. Delete system user
    try {
      await run('userdel', [website.systemUser], { sudo: true });
    } catch (e: any) { errors.push(`User: ${e}`); }

    // 8. Detach all domains (set websiteId = null)
    try {
      await db.update(domains).set({ websiteId: null }).where(eq(domains.websiteId, id));
    } catch (e: any) { errors.push(`Detach domains: ${e}`); }

    // 9. Delete website record from DB
    await db.delete(websites).where(eq(websites.id, id));

    logger.info({ websiteId: id, name: website.name, errors: errors.length }, 'Website deleted');

    auditService.log({
      userId,
      action: 'website.delete',
      resource: `website:${id}`,
      details: JSON.stringify({ websiteId: id, name: website.name, errors: errors.length > 0 ? errors : undefined }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    if (errors.length > 0) {
      logger.warn({ websiteId: id, errors }, 'Website deleted with partial errors');
    }

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Suspend
  // ---------------------------------------------------------------------------

  /**
   * Suspend website — replaces the website nginx config with a 503 page
   * for all attached domains. The original config is backed up with a `.active` suffix.
   */
  async suspend(id: string, userId?: string, ipAddress?: string): Promise<Website> {
    const [website] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    // Use the website-scoped suspended config generation
    try {
      await nginxService.generateSuspendedConfig(id);
    } catch (e) {
      logger.warn({ err: e, websiteId: id }, 'Failed to generate suspended config');
    }

    await db.update(websites).set({ status: 'suspended' }).where(eq(websites.id, id));
    logger.info({ websiteId: id }, 'Website suspended');

    auditService.log({
      userId,
      action: 'website.suspend',
      resource: `website:${id}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Activate
  // ---------------------------------------------------------------------------

  /**
   * Activate a suspended website.
   * Restores the full nginx config by regenerating from DB fields.
   */
  async activate(id: string, userId?: string, ipAddress?: string): Promise<Website> {
    const [website] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    // Restore the full website config (nginx + PHP-FPM)
    try {
      await webServerService.applyWebsiteConfig(id);
    } catch (e) {
      logger.warn({ err: e, websiteId: id }, 'Failed to restore website config during activate');
    }

    // Clean up the suspended backup file
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${id}.conf.active`;
    await sudoFs.unlink(backupPath).catch(() => {});

    await db.update(websites).set({ status: 'active' }).where(eq(websites.id, id));
    logger.info({ websiteId: id }, 'Website activated');

    auditService.log({
      userId,
      action: 'website.activate',
      resource: `website:${id}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Attach Domain
  // ---------------------------------------------------------------------------

  /**
   * Attach a domain to this website:
   * 1. Validate domain exists and isn't attached to another website
   * 2. Update domain.websiteId in DB
   * 3. Regenerate the website's nginx config (to add the new server block)
   */
  async attachDomain(
    websiteId: string,
    domainId: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean }> {
    // Validate website exists
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    // Validate domain exists
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Check domain isn't already attached to another website
    if (domain.websiteId && domain.websiteId !== websiteId) {
      throw new AppError(409, 'DOMAIN_ALREADY_ATTACHED', `Domain is already attached to website ${domain.websiteId}`);
    }

    if (domain.websiteId === websiteId) {
      // Already attached to this website — idempotent
      return { success: true };
    }

    // Update domain.websiteId in DB first
    await db.update(domains).set({ websiteId }).where(eq(domains.id, domainId));

    // Regenerate the website's nginx config (now includes the new domain)
    try {
      await nginxService.generateWebsiteConfig(websiteId);
    } catch (e) {
      throw new AppError(422, 'VHOST_CREATE_FAILED', `Failed to regenerate website config: ${(e as Error).message}`);
    }

    logger.info({ websiteId, domainId, domain: domain.name }, 'Domain attached to website');

    auditService.log({
      userId,
      action: 'website.attachDomain',
      resource: `website:${websiteId}:domain:${domain.name}`,
      details: JSON.stringify({ websiteId, domainId }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Detach Domain
  // ---------------------------------------------------------------------------

  /**
   * Detach a domain from this website:
   * 1. Validate domain is attached to this website
   * 2. Set domain.websiteId = null in DB
   * 3. Regenerate the website's nginx config (to remove the server block)
   * 4. Optionally set domain type to 'redirect' or 'parked'
   */
  async detachDomain(
    websiteId: string,
    domainId: string,
    action: 'redirect' | 'parked' | 'delete' = 'parked',
    redirectTarget?: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean }> {
    // Validate website exists
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');

    // Validate domain exists and is attached to this website
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    if (domain.websiteId !== websiteId) {
      throw new AppError(409, 'DOMAIN_NOT_ATTACHED', 'Domain is not attached to this website');
    }

    // 1. Update DB — detach domain
    const domainUpdate: Record<string, any> = { websiteId: null };

    if (action === 'redirect') {
      domainUpdate.type = 'redirect';
      if (redirectTarget) {
        domainUpdate.redirectTarget = redirectTarget;
      }
    } else if (action === 'parked') {
      domainUpdate.type = 'parked';
    }
    // 'delete' action: just detach, don't change type (domain stays as-is)

    await db.update(domains).set(domainUpdate).where(eq(domains.id, domainId));

    // 2. Regenerate the website's nginx config (now excludes the detached domain)
    try {
      await nginxService.generateWebsiteConfig(websiteId);
    } catch (e) {
      logger.warn({ err: e, websiteId, domain: domain.name }, 'Failed to regenerate website config during domain detach');
    }

    // 3. Also remove any legacy per-domain apache vhost if present
    try {
      await apacheService.removeVhost(domain.name);
    } catch (e) {
      // Apache may not be configured — ignore
    }

    logger.info({ websiteId, domainId, domain: domain.name, action }, 'Domain detached from website');

    auditService.log({
      userId,
      action: 'website.detachDomain',
      resource: `website:${websiteId}:domain:${domain.name}`,
      details: JSON.stringify({ websiteId, domainId, action }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }
}
