import { db } from '../../db/index.js';
import { sites, siteRuntimes, siteProcesses, siteStates, domains, type Site, type NewSite } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { run } from '../../services/executor.js';
import { runtimeManager } from '../../services/runtime-manager/index.js';
import { jobQueue, JOB_TYPES } from '../../services/job-queue/index.js';
import { logger } from '../../config/logger.js';
import { nanoid } from 'nanoid';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';
import type { RuntimeConfig } from '../../db/schema/site_runtimes.js';

const SITES_ROOT = '/var/www/sites';

function defaultIndexHtml(siteName: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>${siteName}</title></head>
<body><h1>${siteName} — Site created</h1></body>
</html>`;
}

export class SitesService {
  /**
   * List all sites
   */
  async list(): Promise<Site[]> {
    return db.select().from(sites);
  }

  /**
   * Get site by ID with full details
   */
  async get(id: string): Promise<(Site & { runtime?: any; process?: any; domains: any[] }) | null> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) return null;

    const [runtime] = await db.select().from(siteRuntimes).where(eq(siteRuntimes.siteId, id)).limit(1);
    const [process] = await db.select().from(siteProcesses).where(eq(siteProcesses.siteId, id)).limit(1);
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, id));

    return { ...site, runtime, process, domains: siteDomains };
  }

  /**
   * Create a new site with runtime configuration
   */
  async create(data: {
    name: string;
    runtime: RuntimeConfig;
    primaryDomain?: string;
    userId?: string;
    ipAddress?: string;
  }): Promise<Site> {
    const { name, runtime, primaryDomain, userId, ipAddress } = data;

    // Validate runtime config
    const validation = runtimeManager.validateConfig(runtime);
    if (!validation.valid) {
      throw new AppError(422, 'INVALID_RUNTIME_CONFIG', validation.errors.join(', '));
    }

    const siteId = nanoid();
    const systemUser = `sf_${siteId}`;
    const siteDir = `${SITES_ROOT}/${siteId}`;

    try {
      // Create directory structure
      await sudoFs.mkdir(`${siteDir}/httpdocs`);
      await sudoFs.mkdir(`${siteDir}/private`);
      await sudoFs.mkdir(`${siteDir}/logs`);
      await sudoFs.mkdir(`${siteDir}/tmp`);
      await sudoFs.mkdir(`${siteDir}/ssl`);
      await sudoFs.mkdir(`${siteDir}/backup`);
      await sudoFs.mkdir(`${siteDir}/deployments`);
      await sudoFs.mkdir(`${siteDir}/shared`);

      // Write default index.html
      await sudoFs.writeFile(`${siteDir}/httpdocs/index.html`, defaultIndexHtml(name));

      // Create system user
      const useraddResult = await run('useradd', [
        '--system', '--no-create-home', '--shell', '/usr/sbin/nologin', systemUser,
      ], { sudo: true });
      if (!useraddResult.success) {
        logger.warn({ systemUser }, 'useradd failed — user may already exist');
      }

      // Set ownership
      await run('chown', ['-R', `${systemUser}:www-data`, siteDir], { sudo: true });

      // Create site record
      const [site] = await db.insert(sites).values({
        id: siteId,
        name,
        systemUser,
        homeDir: siteDir,
        status: 'active',
      }).returning();

      // Create runtime configuration
      await runtimeManager.createRuntime(siteId, runtime);

      // Allocate port and create process record
      const port = await runtimeManager.allocatePort(siteId);

      // Create primary domain if provided
      if (primaryDomain) {
        const domainId = nanoid();
        await db.insert(domains).values({
          id: domainId,
          name: primaryDomain,
          siteId,
          type: 'primary',
          isPrimary: true,
          documentRoot: `${siteDir}/httpdocs`,
          sslEnabled: true,
          status: 'active',
        });
      }

      // Enqueue nginx config generation
      await jobQueue.enqueue(JOB_TYPES.NGINX_CONFIG_REGENERATE, { siteId });

      // Enqueue SSL provisioning for primary domain
      if (primaryDomain) {
        await jobQueue.enqueue(JOB_TYPES.SSL_PROVISION, { siteId, domain: primaryDomain });
      }

      logger.info({ siteId, name, runtime: runtime.runtime }, 'Site created successfully');

      auditService.log({
        userId,
        action: 'site.create',
        resource: `site:${siteId}`,
        details: JSON.stringify({ name, runtime: runtime.runtime }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return site;
    } catch (error) {
      // Rollback
      await run('rm', ['-rf', siteDir], { sudo: true }).catch(() => {});
      await run('userdel', [systemUser], { sudo: true }).catch(() => {});
      throw new AppError(422, 'SITE_CREATE_FAILED', `Failed to create site: ${(error as Error).message}`);
    }
  }

  /**
   * Update site
   */
  async update(id: string, data: { name?: string }, userId?: string, ipAddress?: string): Promise<Site> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;

    await db.update(sites).set(updateData).where(eq(sites.id, id));

    logger.info({ siteId: id }, 'Site updated');

    auditService.log({
      userId,
      action: 'site.update',
      resource: `site:${id}`,
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return updated;
  }

  /**
   * Delete site with full cascade
   */
  async delete(id: string, userId?: string, ipAddress?: string): Promise<{ success: boolean }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const errors: string[] = [];

    // Get all attached domains
    const attachedDomains = await db.select().from(domains).where(eq(domains.siteId, id));

    // Delete domain records
    for (const domain of attachedDomains) {
      await db.delete(domains).where(eq(domains.id, domain.id));
    }

    // Delete site runtime and process
    await db.delete(siteProcesses).where(eq(siteProcesses.siteId, id));
    await db.delete(siteRuntimes).where(eq(siteRuntimes.siteId, id));
    await db.delete(siteStates).where(eq(siteStates.siteId, id));

    // Remove nginx config
    const nginxConfigPath = `/etc/nginx/sites-available/site-${id}.conf`;
    await sudoFs.unlink(nginxConfigPath).catch(() => {});

    // Delete directory tree
    try {
      await run('rm', ['-rf', site.homeDir], { sudo: true });
    } catch (e: any) { errors.push(`Files: ${e}`); }

    // Delete system user
    try {
      await run('userdel', [site.systemUser], { sudo: true });
    } catch (e: any) { errors.push(`User: ${e}`); }

    // Delete site record
    await db.delete(sites).where(eq(sites.id, id));

    logger.info({ siteId: id, errors: errors.length }, 'Site deleted');

    auditService.log({
      userId,
      action: 'site.delete',
      resource: `site:${id}`,
      details: JSON.stringify({ siteId: id, errors: errors.length > 0 ? errors : undefined }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  /**
   * Suspend site
   */
  async suspend(id: string, userId?: string, ipAddress?: string): Promise<Site> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    await db.update(sites).set({ status: 'suspended' }).where(eq(sites.id, id));
    await jobQueue.enqueue(JOB_TYPES.NGINX_CONFIG_REGENERATE, { siteId: id });

    logger.info({ siteId: id }, 'Site suspended');

    auditService.log({
      userId,
      action: 'site.suspend',
      resource: `site:${id}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return updated;
  }

  /**
   * Activate site
   */
  async activate(id: string, userId?: string, ipAddress?: string): Promise<Site> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    await db.update(sites).set({ status: 'active' }).where(eq(sites.id, id));
    await jobQueue.enqueue(JOB_TYPES.NGINX_CONFIG_REGENERATE, { siteId: id });
    await jobQueue.enqueue(JOB_TYPES.PM2_RESTART, { siteId: id, processName: `site-${id}` });

    logger.info({ siteId: id }, 'Site activated');

    auditService.log({
      userId,
      action: 'site.activate',
      resource: `site:${id}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return updated;
  }

  /**
   * Attach domain to site
   */
  async attachDomain(siteId: string, domainId: string, userId?: string, ipAddress?: string): Promise<void> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({ siteId }).where(eq(domains.id, domainId));
    await jobQueue.enqueue(JOB_TYPES.NGINX_CONFIG_REGENERATE, { siteId });

    auditService.log({
      userId,
      action: 'site.attachDomain',
      resource: `site:${siteId}:domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Detach domain from site
   */
  async detachDomain(siteId: string, domainId: string, userId?: string, ipAddress?: string): Promise<void> {
    await db.update(domains).set({ siteId: null }).where(eq(domains.id, domainId));
    await jobQueue.enqueue(JOB_TYPES.NGINX_CONFIG_REGENERATE, { siteId });

    auditService.log({
      userId,
      action: 'site.detachDomain',
      resource: `site:${siteId}:domain:${domainId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }
}

export const sitesService = new SitesService();
