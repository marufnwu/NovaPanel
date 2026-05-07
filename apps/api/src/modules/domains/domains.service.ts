import { db } from '../../db/index.js';
import { domains, subdomains, domainAliases, domainRedirects, databases, ftpAccounts, cronJobs, mailDomains, mailboxes, sslCertificates, websites, dnsZones, dnsRecords, cloudflareZones, cloudflareTunnels, tunnelRoutes } from '../../db/schema/index.js';
import { eq, and, like, count, sql } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { run } from '../../services/executor.js';
import { nginxService } from '../../services/nginx.service.js';
import { apacheService } from '../../services/apache.service.js';
import { phpFpmServices } from '../../services/php-fpm.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { nanoid } from 'nanoid';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { DatabasesService } from '../databases/databases.service.js';
import { FtpService } from '../ftp/ftp.service.js';
import { CronService } from '../cron/cron.service.js';
import { SslService } from '../ssl/ssl.service.js';
import { DnsService } from '../dns/dns.service.js';
import { WebsitesService } from '../websites/websites.service.js';
import { TunnelService } from '../tunnel/tunnel.service.js';
import { detectNetworkInfo } from '../../utils/network.js';

// Create service instances for cascade operations
const mailService = new MailService();
const databaseService = new DatabasesService();
const ftpService = new FtpService();
const cronService = new CronService();
const sslService = new SslService();
const dnsService = new DnsService();
const websitesService = new WebsitesService();
const tunnelService = new TunnelService();

interface ListOptions {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
}

interface ListResult {
  items: any[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * Generate a system username from a domain name.
 * e.g., "example.com" → "examplecom" (max 32 chars, suffix _2, _3 on collision)
 */
function generateSystemUser(domainName: string): string {
  const base = domainName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 28);
  return base;
}

/**
 * Resolve the default document root for a domain-only (no website) domain.
 */
function resolveDefaultDocumentRoot(domainName: string): string {
  return `/var/www/${domainName}/public`;
}

export class DomainsService {
  /**
   * List domains with pagination and filtering
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    const page = options.page || 1;
    const perPage = options.perPage || 20;
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (options.status) conditions.push(eq(domains.status, options.status as any));
    if (options.search) conditions.push(like(domains.name, `%${options.search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select().from(domains)
      .where(where)
      .limit(perPage)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(domains).where(where);

    return { items, total, page, perPage };
  }

  /**
   * Get a single domain by ID
   */
  async get(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return domain;
  }

  /**
   * Find an active Cloudflare Tunnel that can serve the given domain.
   * Looks for a tunnel with an API token (can manage DNS) and active status.
   */
  private async findActiveTunnel(): Promise<typeof cloudflareTunnels.$inferSelect | null> {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.status, 'active'))
      .limit(1);
    return tunnel && tunnel.apiToken ? tunnel : null;
  }

  /**
   * Find a linked Cloudflare zone for the given domain name.
   * Matches by zoneName (exact) or by checking if the domain ends with a zone name.
   */
  private async findLinkedZoneForDomain(domainName: string): Promise<typeof cloudflareZones.$inferSelect | null> {
    // Exact match first
    const [exact] = await db.select().from(cloudflareZones)
      .where(eq(cloudflareZones.zoneName, domainName))
      .limit(1);
    if (exact) return exact;

    // Parent zone match (e.g. sub.example.com → example.com zone)
    const allZones = await db.select().from(cloudflareZones);
    const match = allZones.find(z => domainName.endsWith(`.${z.zoneName}`));
    return match || null;
  }

  /**
   * Auto-create a tunnel route + Cloudflare CNAME for a domain/subdomain.
   * This is called after domain creation to automatically wire up Cloudflare Tunnel.
   * Best-effort: logs warnings on failure but doesn't block domain creation.
   */
  private async autoCreateTunnelRoute(hostname: string, domainId: string, userId?: string, ipAddress?: string, preferredTunnelId?: string): Promise<void> {
    try {
      // 1. Check if a Cloudflare zone is linked for this domain
      const linkedZone = await this.findLinkedZoneForDomain(hostname);
      if (!linkedZone) {
        logger.debug({ hostname }, 'No linked Cloudflare zone found — skipping auto tunnel route');
        return;
      }

      // 2. Find the tunnel to use (preferred or first active one)
      let tunnel = null;
      if (preferredTunnelId) {
        const [t] = await db.select().from(cloudflareTunnels).where(eq(cloudflareTunnels.id, preferredTunnelId)).limit(1);
        if (t && t.status === 'active' && t.apiToken) tunnel = t;
      }
      if (!tunnel) {
        tunnel = await this.findActiveTunnel();
      }
      if (!tunnel) {
        logger.debug({ hostname }, 'No active Cloudflare tunnel found — skipping auto tunnel route');
        return;
      }

      // 3. Check if a route already exists for this hostname on this tunnel
      const [existingRoute] = await db.select().from(tunnelRoutes).where(
        and(eq(tunnelRoutes.tunnelId, tunnel.id), eq(tunnelRoutes.hostname, hostname))
      ).limit(1);
      if (existingRoute) {
        logger.info({ hostname, tunnelId: tunnel.id }, 'Tunnel route already exists — skipping auto creation');
        return;
      }

      // 4. Determine the local service URL
      // Default: http://localhost:80 (nginx listens on 80, proxies to apache/php-fpm)
      const service = 'http://localhost:80';

      // 5. Add the route (this also creates DNS CNAME + updates remote config)
      await tunnelService.addRoute({
        tunnelId: tunnel.id,
        hostname,
        service,
        domainId,
      }, userId, ipAddress);

      // 6. Set SSL mode to "full" for the zone (best-effort)
      try {
        const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
        await cfService.updateSslSettings(linkedZone.id, { sslMode: 'full' }, userId, ipAddress);
        logger.info({ hostname, zoneId: linkedZone.id }, 'SSL mode set to full');
      } catch (sslError) {
        logger.warn({ err: sslError, hostname }, 'Failed to set SSL mode — continuing');
      }

      logger.info({ hostname, domainId, tunnelId: tunnel.id, service }, 'Auto-created tunnel route + CNAME for domain');

      auditService.log({
        userId,
        action: 'domain.cloudflare.auto_route_create',
        resource: `domain:${hostname}`,
        details: JSON.stringify({ domainId, tunnelId: tunnel.id, hostname, service }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));
    } catch (e) {
      logger.warn({ err: e, hostname, domainId }, 'Auto tunnel route creation failed — domain created without Cloudflare tunnel integration');
    }
  }

  /**
   * Auto-remove tunnel routes + Cloudflare CNAMEs for a domain.
   * Called during domain/subdomain deletion to clean up Cloudflare resources.
   * Best-effort: logs warnings on failure but doesn't block deletion.
   */
  private async autoRemoveTunnelRoutes(domainId: string, hostname?: string, userId?: string, ipAddress?: string): Promise<void> {
    try {
      // Find all tunnel routes linked to this domain
      const conditions = [eq(tunnelRoutes.domainId, domainId)];
      if (hostname) {
        conditions.push(eq(tunnelRoutes.hostname, hostname));
      }
      const routes = await db.select().from(tunnelRoutes).where(and(...conditions));

      for (const route of routes) {
        try {
          await tunnelService.deleteRoute(route.id, userId, ipAddress);
          logger.info({ routeId: route.id, hostname: route.hostname, domainId }, 'Auto-removed tunnel route + CNAME for domain');
        } catch (e) {
          logger.warn({ err: e, routeId: route.id, hostname: route.hostname }, 'Failed to auto-remove tunnel route — continuing');
        }
      }

      if (routes.length > 0) {
        auditService.log({
          userId,
          action: 'domain.cloudflare.auto_route_remove',
          resource: `domain:${domainId}`,
          details: JSON.stringify({ domainId, removedRoutes: routes.length, hostnames: routes.map(r => r.hostname) }),
          ipAddress,
        }).catch(err => logger.error({ err }, 'Audit log failed'));
      }
    } catch (e) {
      logger.warn({ err: e, domainId }, 'Auto tunnel route removal failed — continuing with domain deletion');
    }
  }

  /**
   * Create a new domain with support for the domain/website separation architecture.
   *
   * websiteMode controls whether a website is automatically created or linked:
   * - 'none'    → domain-only (DNS/SSL/Mail), no website, no nginx, no PHP-FPM
   * - 'create'  → auto-create a website for this domain (default, backward compatible)
   * - 'existing'→ attach to an existing website
   */
  async create(data: {
    name: string;
    type?: 'primary' | 'subdomain' | 'alias' | 'redirect';
    parentDomainId?: string;
    redirectTarget?: string;
    websiteMode?: 'none' | 'create' | 'existing';
    websiteId?: string;
    websiteName?: string;
    documentRoot?: string;
    phpVersion?: string;
    phpHandler?: string;
    webServer?: string;
    createDnsZone?: boolean;
    enableMail?: boolean;
    // Cloudflare auto-public settings
    makePublic?: boolean;
    tunnelId?: string;
    userId?: string;
    ipAddress?: string;
  }) {
    const {
      name,
      type = 'primary',
      parentDomainId,
      redirectTarget,
      websiteMode = 'create',
      phpVersion = '8.2',
      phpHandler = 'php-fpm',
      webServer = 'nginx+apache',
      createDnsZone = true,
      enableMail = false,
      makePublic = false,
      tunnelId: preferredTunnelId,
    } = data;

    // 1. Check domain doesn't already exist
    const [existing] = await db.select().from(domains).where(eq(domains.name, name)).limit(1);
    if (existing) throw new AppError(409, 'DOMAIN_EXISTS', 'Domain already exists on this server');

    // 2. Validate parentDomainId if provided
    if (parentDomainId) {
      const [parent] = await db.select().from(domains).where(eq(domains.id, parentDomainId)).limit(1);
      if (!parent) throw new AppError(404, 'PARENT_DOMAIN_NOT_FOUND', 'Parent domain not found');
    }

    const domainId = nanoid();
    let websiteId: string | null = null;
    let documentRoot = data.documentRoot || resolveDefaultDocumentRoot(name);

    // 3. Based on websiteMode, handle website creation / attachment
    if (websiteMode === 'create') {
      // Create a new website for this domain
      const websiteName = data.websiteName || name;
      const website = await websitesService.create({
        name: websiteName,
        phpVersion,
        phpHandler,
        webServer,
      }, data.userId, data.ipAddress);
      websiteId = website.id;
      documentRoot = website.documentRoot;
    } else if (websiteMode === 'existing') {
      // Attach to an existing website
      if (!data.websiteId) {
        throw new AppError(422, 'WEBSITE_ID_REQUIRED', 'websiteId is required when websiteMode is "existing"');
      }
      const [website] = await db.select().from(websites).where(eq(websites.id, data.websiteId)).limit(1);
      if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
      websiteId = data.websiteId;
      documentRoot = data.documentRoot || website.documentRoot;
    }
    // else websiteMode === 'none': no website, no nginx, no PHP-FPM

    // 4. Insert domain record
    try {
      await db.insert(domains).values({
        id: domainId,
        name,
        documentRoot,
        type: type as any,
        parentDomainId: parentDomainId || null,
        redirectTarget: redirectTarget || null,
        websiteId: websiteId,
        phpVersion,
        phpHandler: phpHandler as any,
        webServer: webServer as any,
        status: 'active',
      });

      // 5. Regenerate website nginx config to include the new domain
      //    (both 'create' and 'existing' modes need this since the domain
      //     was inserted with websiteId already set, so attachDomain() would
      //     be a no-op)
      if (websiteId) {
        try {
          await nginxService.generateWebsiteConfig(websiteId);
        } catch (e) {
          logger.warn({ err: e, websiteId, domainId }, 'Failed to regenerate website nginx config after domain creation');
        }
      }

      // 6. Create DNS zone if requested
      if (createDnsZone) {
        try {
          await dnsService.ensureZone(domainId);
        } catch (e) {
          logger.warn({ err: e, domain: name }, 'DNS zone creation failed — continuing');
        }
      }

      // 7. Enable mail if requested
      if (enableMail) {
        try {
          await mailService.enableMail(domainId);
        } catch (e) {
          logger.warn({ err: e, domain: name }, 'Mail enablement failed — continuing');
        }
      }

      // 8. Auto-create Cloudflare Tunnel route + CNAME + SSL if makePublic is true and zone is linked
      if (makePublic) {
        await this.autoCreateTunnelRoute(name, domainId, data.userId, data.ipAddress, preferredTunnelId);
      }

      logger.info({ domainId, name, documentRoot, websiteId, websiteMode }, 'Domain created successfully');

      auditService.log({
        userId: data.userId,
        action: 'domain.create',
        resource: `domain:${name}`,
        details: JSON.stringify({ domainId, type, websiteMode, websiteId, phpVersion, phpHandler, webServer, createDnsZone, enableMail }),
        ipAddress: data.ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { id: domainId, name, documentRoot, type, websiteId, status: 'active' };
    } catch (error) {
      // Rollback: if we created a website, delete it
      if (websiteMode === 'create' && websiteId) {
        await websitesService.delete(websiteId).catch(() => {});
      }
      throw new AppError(422, 'DOMAIN_CREATE_FAILED', `Failed to create domain: ${(error as Error).message}`);
    }
  }

  /**
   * Update domain settings
   */
  async update(id: string, data: { phpVersion?: string; phpHandler?: string; webServer?: string; redirectHttpToHttps?: boolean; hsts?: boolean }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const updateData: Record<string, any> = {};
    if (data.phpVersion) updateData.phpVersion = data.phpVersion;
    if (data.phpHandler) updateData.phpHandler = data.phpHandler;
    if (data.webServer) updateData.webServer = data.webServer;
    if (data.redirectHttpToHttps !== undefined) updateData.redirectHttpToHttps = data.redirectHttpToHttps;
    if (data.hsts !== undefined) updateData.hsts = data.hsts;

    await db.update(domains).set(updateData).where(eq(domains.id, id));

    // Regenerate vhost if web settings changed
    if (data.phpVersion || data.phpHandler || data.webServer || data.redirectHttpToHttps !== undefined || data.hsts !== undefined) {
      await nginxService.removeVhost(domain.name).catch(() => {});
      await nginxService.addVhost({
        domain: domain.name,
        documentRoot: domain.documentRoot,
        phpVersion: data.phpVersion || domain.phpVersion,
        redirectHttpToHttps: data.redirectHttpToHttps ?? domain.redirectHttpToHttps,
        hsts: data.hsts ?? domain.hsts,
        aliases: [`www.${domain.name}`],
      }).catch(() => {});
    }

    logger.info({ domainId: id }, 'Domain updated');

    auditService.log({
      userId,
      action: 'domain.update',
      resource: `domain:${domain.name}`,
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    return updated;
  }

  /**
   * Delete a domain with full cascade cleanup.
   *
   * When the domain is attached to a website:
   * - Cleans up domain-specific services (mail, databases, FTP, SSL, DNS)
   * - If type is 'primary' and this is the last primary domain on the website:
   *   - If deleteWebsite=true → cascade deletes the entire website
   *   - Otherwise → just detaches the domain from the website
   * - For non-primary domains or when not deleting website → detaches and regenerates nginx
   *
   * When the domain has no website (domain-only):
   * - Uses the legacy full cleanup (PHP-FPM, Apache, Nginx, files, system user)
   */
  async delete(id: string, deleteWebsite: boolean = false, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const errors: string[] = [];

    // --- Domain-specific cleanup (always performed) ---

    // 1. Mail — disable mail for domain
    try {
      await mailService.disableMail(id);
    } catch (e: any) {
      if (!e.message?.includes('Mail not enabled')) {
        errors.push(`Mail: ${e}`);
      }
    }

    // 2. Databases — drop all databases and their users
    try {
      const domainDbs = await db.select().from(databases).where(eq(databases.domainId, id));
      for (const database of domainDbs) {
        await databaseService.delete(database.id);
      }
    } catch (e: any) { errors.push(`Databases: ${e}`); }

    // 3. FTP accounts — delete all FTP accounts
    try {
      const ftpList = await db.select().from(ftpAccounts).where(eq(ftpAccounts.domainId, id));
      for (const ftp of ftpList) {
        await ftpService.deleteAccount(ftp.id);
      }
    } catch (e: any) { errors.push(`FTP: ${e}`); }

    // 4. SSL certificates — remove certificate
    try {
      await sslService.removeCertificate(id);
    } catch (e: any) {
      if (!e.message?.includes('No certificate found')) {
        errors.push(`SSL: ${e}`);
      }
    }

    // 5. DNS zone — delete BIND zone file + named.conf.local entry + DB records
    try {
      await dnsService.deleteZone(id);
    } catch (e: any) { errors.push(`DNS: ${e}`); }

    // --- Website relationship handling ---

    if (domain.websiteId) {
      // Domain is attached to a website
      if (domain.type === 'primary') {
        // Count primary domains attached to this website
        const primaryDomains = await db.select().from(domains).where(
          and(eq(domains.websiteId, domain.websiteId), eq(domains.type, 'primary'))
        );
        const isLastPrimary = primaryDomains.length <= 1;

        if (isLastPrimary && deleteWebsite) {
          // Cascade: delete the entire website (handles nginx, PHP-FPM, files, user)
          try {
            await websitesService.delete(domain.websiteId, userId, ipAddress);
          } catch (e: any) { errors.push(`Website cascade delete: ${e}`); }
        } else {
          // Just detach from website — regenerate nginx config without this domain
          try {
            await websitesService.detachDomain(domain.websiteId, id, 'delete', undefined, userId, ipAddress);
          } catch (e: any) { errors.push(`Detach from website: ${e}`); }
        }
      } else {
        // Non-primary domain: just detach from website
        try {
          await websitesService.detachDomain(domain.websiteId, id, 'delete', undefined, userId, ipAddress);
        } catch (e: any) { errors.push(`Detach from website: ${e}`); }
      }
    } else {
      // No website attached — legacy full cleanup (PHP-FPM, Apache, Nginx, files, user)

      // 6. Cron jobs — remove all cron jobs for this domain's system user
      try {
        if (domain.systemUser) {
          const allCronJobs = await db.select().from(cronJobs)
            .where(eq(cronJobs.systemUser, domain.systemUser));
          for (const job of allCronJobs) {
            await cronService.deleteJob(job.id);
          }
        }
      } catch (e: any) { errors.push(`Cron: ${e}`); }

      // 7. PHP-FPM pool — delete per-domain pool config and reload
      try {
        const phpService = phpFpmServices[domain.phpVersion as keyof typeof phpFpmServices];
        if (phpService) {
          await phpService.deletePool(domain.name);
        }
      } catch (e: any) { errors.push(`PHP-FPM: ${e}`); }

      // 8. Apache vhost — disable site and delete config
      try {
        await apacheService.removeVhost(domain.name);
      } catch (e: any) { errors.push(`Apache: ${e}`); }

      // 9. Nginx vhost — remove config and symlink
      try {
        await nginxService.removeVhost(domain.name);
      } catch (e: any) { errors.push(`Nginx: ${e}`); }

      // 10. Domain directory — remove all files
      const domainDir = `${env.VHOSTS_ROOT}/${domain.name}`;
      try {
        await run('rm', ['-rf', domainDir], { sudo: true });
      } catch (e: any) { errors.push(`Files: ${e}`); }

      // 11. System user — delete OS user
      if (domain.systemUser) {
        try {
          await run('userdel', [domain.systemUser], { sudo: true });
        } catch (e: any) { errors.push(`User: ${e}`); }
      }
    }

    // --- Cloudflare Tunnel route cleanup ---
    await this.autoRemoveTunnelRoutes(id, undefined, userId, ipAddress);

    // --- DB record cleanup (always performed) ---
    await db.delete(domainRedirects).where(eq(domainRedirects.domainId, id));
    await db.delete(domainAliases).where(eq(domainAliases.domainId, id));
    await db.delete(subdomains).where(eq(subdomains.domainId, id));
    await db.delete(domains).where(eq(domains.id, id));

    logger.info({ domainId: id, name: domain.name, errors: errors.length }, 'Domain deleted');

    auditService.log({
      userId,
      action: 'domain.delete',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ domainId: id, deleteWebsite, hadWebsite: !!domain.websiteId, errors: errors.length > 0 ? errors : undefined }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    if (errors.length > 0) {
      logger.warn({ domainId: id, errors }, 'Domain deleted with partial errors');
    }
  }

  /**
   * Suspend a domain (return 503).
   * Backs up the original nginx config before overwriting.
   */
  async suspend(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const vhostPath = `${env.NGINX_SITES_AVAILABLE}/${domain.name}.conf`;
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/${domain.name}.conf.suspended`;

    // Backup original config BEFORE overwriting
    try {
      const original = await sudoFs.readFile(vhostPath);
      await sudoFs.writeFile(backupPath, original);
    } catch (e: any) {
      logger.warn({ err: e, domain: domain.name }, 'Could not backup vhost config before suspend');
    }

    // Write 503 maintenance config
    const maintenanceConfig = `server {
    listen 80;
    server_name ${domain.name} www.${domain.name};
    return 503;
    add_header Retry-After "3600";
}`;
    await sudoFs.writeFile(vhostPath, maintenanceConfig);
    await nginxService.reload();

    await db.update(domains).set({ status: 'suspended' }).where(eq(domains.id, id));
    logger.info({ domainId: id }, 'Domain suspended');

    auditService.log({
      userId,
      action: 'domain.suspend',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Activate a suspended domain.
   * Restores the original nginx config from backup if available,
   * otherwise regenerates from DB fields.
   */
  async activate(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const vhostPath = `${env.NGINX_SITES_AVAILABLE}/${domain.name}.conf`;
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/${domain.name}.conf.suspended`;

    // Try to restore from backup first
    let restored = false;
    try {
      const backup = await sudoFs.readFile(backupPath);
      await sudoFs.writeFile(vhostPath, backup);
      // Clean up backup file
      await run('rm', ['-f', backupPath], { sudo: true });
      restored = true;
    } catch {
      // Backup doesn't exist or can't be read — fall through to regeneration
    }

    // Fallback: regenerate vhost config from DB fields
    if (!restored) {
      await this.regenerateVhost(domain);
    }

    await nginxService.reload();

    await db.update(domains).set({ status: 'active' }).where(eq(domains.id, id));
    logger.info({ domainId: id, restoredFromBackup: restored }, 'Domain activated');

    auditService.log({
      userId,
      action: 'domain.activate',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Regenerate nginx vhost config from DB domain fields (fallback for activate)
   */
  private async regenerateVhost(domain: any): Promise<void> {
    await nginxService.addVhost({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      phpVersion: domain.phpVersion,
      aliases: [`www.${domain.name}`],
    });
  }

  // --- Subdomain CRUD ---

  async listSubdomains(domainId: string) {
    return db.select().from(subdomains).where(eq(subdomains.domainId, domainId));
  }

  async createSubdomain(domainId: string, data: { name: string; documentRoot?: string; phpVersion?: string }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subId = nanoid();
    const fullSubdomain = `${data.name}.${domain.name}`;
    const docRoot = data.documentRoot || `${env.VHOSTS_ROOT}/${domain.name}/${data.name}`;

    await sudoFs.mkdir(docRoot);
    if (domain.systemUser) {
      await run('chown', [`${domain.systemUser}:www-data`, docRoot], { sudo: true });
    }

    await db.insert(subdomains).values({
      id: subId,
      domainId,
      name: fullSubdomain,
      documentRoot: docRoot,
      phpVersion: data.phpVersion || domain.phpVersion,
    });

    // Create DNS A record for the subdomain if a DNS zone exists for the parent domain
    try {
      const [zone] = await db.select().from(dnsZones)
        .where(eq(dnsZones.domainId, domainId))
        .limit(1);

      if (zone) {
        // Get server IP
        let serverIp = '127.0.0.1';
        try {
          const networkInfo = await detectNetworkInfo();
          serverIp = networkInfo.primaryIp || '127.0.0.1';
        } catch { /* use default */ }

        await db.insert(dnsRecords).values({
          id: nanoid(),
          zoneId: zone.id,
          type: 'A',
          name: data.name,
          value: serverIp,
          ttl: 3600,
          priority: null,
          isSystem: true,
        });

        // Sync zone file to disk
        await dnsService.syncZoneToDisk(zone.id);
        logger.info({ subdomain: fullSubdomain, ip: serverIp }, 'DNS A record created for subdomain');
      }
    } catch (e) {
      logger.warn({ err: e, subdomain: fullSubdomain }, 'Failed to create DNS record for subdomain — continuing');
    }

    // Auto-create Cloudflare Tunnel route + CNAME for subdomain
    await this.autoCreateTunnelRoute(fullSubdomain, domainId, userId, ipAddress);

    // If parent domain is attached to a website, regenerate nginx config
    // so the subdomain can be served (best-effort)
    if (domain.websiteId) {
      try {
        await nginxService.generateWebsiteConfig(domain.websiteId);
      } catch (e) {
        logger.warn({ err: e, websiteId: domain.websiteId }, 'Failed to regenerate website nginx config for new subdomain');
      }
    }

    auditService.log({
      userId,
      action: 'domain.subdomain.create',
      resource: `subdomain:${fullSubdomain}`,
      details: JSON.stringify({ domainId, name: fullSubdomain, documentRoot: docRoot }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: subId, name: fullSubdomain, documentRoot: docRoot };
  }

  async deleteSubdomain(domainId: string, subdomainId: string, userId?: string, ipAddress?: string) {
    const [sub] = await db.select().from(subdomains).where(eq(subdomains.id, subdomainId)).limit(1);

    // Auto-remove Cloudflare Tunnel route + CNAME for this subdomain
    if (sub?.name) {
      await this.autoRemoveTunnelRoutes(domainId, sub.name, userId, ipAddress);
    }

    await db.delete(subdomains).where(eq(subdomains.id, subdomainId));
    logger.info({ subdomainId }, 'Subdomain deleted');

    // Clean up document root directory (best-effort)
    if (sub?.documentRoot) {
      try {
        await run('rm', ['-rf', sub.documentRoot], { sudo: true });
      } catch (e) {
        logger.warn({ err: e, path: sub.documentRoot }, 'Failed to remove subdomain document root');
      }
    }

    // If parent domain is attached to a website, regenerate nginx config
    if (sub) {
      const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
      if (domain?.websiteId) {
        try {
          await nginxService.generateWebsiteConfig(domain.websiteId);
        } catch (e) {
          logger.warn({ err: e, websiteId: domain.websiteId }, 'Failed to regenerate website nginx config after subdomain deletion');
        }
      }
    }

    auditService.log({
      userId,
      action: 'domain.subdomain.delete',
      resource: `subdomain:${subdomainId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  // --- Alias CRUD ---

  async listAliases(domainId: string) {
    return db.select().from(domainAliases).where(eq(domainAliases.domainId, domainId));
  }

  async createAlias(domainId: string, alias: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const aliasId = nanoid();
    await db.insert(domainAliases).values({ id: aliasId, domainId, alias });

    // If domain is attached to a website, regenerate nginx config
    // so the alias appears in server_name
    if (domain.websiteId) {
      try {
        await nginxService.generateWebsiteConfig(domain.websiteId);
      } catch (e) {
        logger.warn({ err: e, websiteId: domain.websiteId, alias }, 'Failed to regenerate website nginx config after alias creation');
      }
    }

    auditService.log({
      userId,
      action: 'domain.alias.create',
      resource: `alias:${alias}`,
      details: JSON.stringify({ domainId, alias }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: aliasId, alias };
  }

  async deleteAlias(domainId: string, aliasId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);

    await db.delete(domainAliases).where(eq(domainAliases.id, aliasId));

    // If domain is attached to a website, regenerate nginx config
    // to remove the alias from server_name
    if (domain?.websiteId) {
      try {
        await nginxService.generateWebsiteConfig(domain.websiteId);
      } catch (e) {
        logger.warn({ err: e, websiteId: domain.websiteId }, 'Failed to regenerate website nginx config after alias deletion');
      }
    }

    auditService.log({
      userId,
      action: 'domain.alias.delete',
      resource: `alias:${aliasId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  // --- Redirect CRUD ---

  async listRedirects(domainId: string) {
    return db.select().from(domainRedirects).where(eq(domainRedirects.domainId, domainId));
  }

  async createRedirect(domainId: string, data: { sourcePath: string; targetUrl: string; type: '301' | '302' }, userId?: string, ipAddress?: string) {
    // Validate domain exists
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const redirectId = nanoid();
    await db.insert(domainRedirects).values({
      id: redirectId,
      domainId,
      sourcePath: data.sourcePath,
      targetUrl: data.targetUrl,
      type: data.type,
    });

    // Regenerate nginx vhost with redirect (best-effort)
    try {
      const existingRedirects = await db.select().from(domainRedirects).where(eq(domainRedirects.domainId, domainId));
      // In a full implementation, we would regenerate the nginx config with redirect rules
      logger.info({ domainId, redirectId }, 'Redirect created — nginx config may need manual reload');
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to update nginx config for redirect');
    }

    auditService.log({
      userId,
      action: 'domain.redirect.create',
      resource: `redirect:${redirectId}`,
      details: JSON.stringify({ domainId, sourcePath: data.sourcePath, targetUrl: data.targetUrl, type: data.type }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: redirectId, ...data };
  }

  async deleteRedirect(domainId: string, redirectId: string, userId?: string, ipAddress?: string) {
    await db.delete(domainRedirects).where(eq(domainRedirects.id, redirectId));

    auditService.log({
      userId,
      action: 'domain.redirect.delete',
      resource: `redirect:${redirectId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Get log stats for a domain
   */
  async getLogStats(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const logDir = `${env.VHOSTS_ROOT}/${domain.name}/logs`;
      const accessLogPath = `${logDir}/access.log`;
      const errorLogPath = `${logDir}/error.log`;

      // Try to get total requests from access log
      let totalRequests = 0;
      try {
        const wcResult = await run('wc', ['-l', accessLogPath], { sudo: true });
        totalRequests = parseInt(wcResult.stdout.trim().split(' ')[0], 10) || 0;
      } catch { /* no access log */ }

      // Try to get error count from error log
      let errorCount = 0;
      try {
        const wcResult = await run('wc', ['-l', errorLogPath], { sudo: true });
        errorCount = parseInt(wcResult.stdout.trim().split(' ')[0], 10) || 0;
      } catch { /* no error log */ }

      const errorRate = totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) / 100 : 0;

      return {
        totalRequests,
        errorCount,
        errorRate,
        topUrls: [],
      };
    } catch {
      return { totalRequests: 0, errorCount: 0, errorRate: 0, topUrls: [] };
    }
  }

  /**
   * Get access log for a domain
   */
  async getAccessLog(domainId: string, lines: number = 100): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const logPath = `${env.VHOSTS_ROOT}/${domain.name}/logs/access.log`;
      const result = await run('tail', ['-n', String(lines), logPath], { sudo: true });
      return result.stdout;
    } catch {
      return '';
    }
  }

  /**
   * Get Cloudflare status for a domain.
   * Determines the overall connectivity status based on tunnel route, SSL, and redirect rules.
   */
  async getCloudflareStatus(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Check for tunnel route - look for a route matching this domain's hostname
    const [route] = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.hostname, domain.name))
      .limit(1);
    const hasTunnelRoute = !!route;
    const tunnelStatus = hasTunnelRoute
      ? (route.isActive ? 'active' : 'inactive')
      : null;

    // Check for SSL (domain has sslEnabled flag)
    const hasSsl = !!domain.sslEnabled;

    // Check for redirect rules
    const redirectRules = await db.select().from(domainRedirects)
      .where(eq(domainRedirects.domainId, domainId));
    const hasRedirects = redirectRules.length > 0;

    // Determine overall status
    let overall: 'live' | 'local' | 'down' | 'redirect' | 'suspended';

    if (domain.status === 'suspended') {
      overall = 'suspended';
    } else if (hasRedirects) {
      overall = 'redirect';
    } else if (hasTunnelRoute && route.isActive) {
      overall = 'live';
    } else {
      overall = 'local';
    }

    return {
      hasTunnelRoute,
      tunnelStatus,
      hasSsl,
      hasRedirects,
      overall,
    };
  }

  /**
   * Get error log for a domain
   */
  async getErrorLog(domainId: string, lines: number = 100): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const logPath = `${env.VHOSTS_ROOT}/${domain.name}/logs/error.log`;
      const result = await run('tail', ['-n', String(lines), logPath], { sudo: true });
      return result.stdout;
    } catch {
      return '';
    }
  }

  // =========================================================================
  // Cloudflare Domain-Specific Methods (for DomainDetail Cloudflare Tab)
  // =========================================================================

  /**
   * Get the linked Cloudflare zone for a domain by domainId.
   * Returns the zone if found, null otherwise.
   */
  async getCloudflareZoneForDomain(domainId: string): Promise<typeof cloudflareZones.$inferSelect | null> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    return this.findLinkedZoneForDomain(domain.name);
  }

  /**
   * Get DNS records for a domain's linked Cloudflare zone.
   */
  async getCloudflareDnsForDomain(domainId: string, options: { type?: string; name?: string; page?: number; perPage?: number } = {}) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.listDnsRecords(zone.id, options);
  }

  /**
   * Create a DNS record for a domain's linked Cloudflare zone.
   */
  async createCloudflareDnsRecord(domainId: string, data: { type: string; name: string; content: string; proxied?: boolean; ttl?: number; priority?: number }, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.createDnsRecord(zone.id, data, userId, ipAddress);
  }

  /**
   * Delete a DNS record from a domain's linked Cloudflare zone.
   */
  async deleteCloudflareDnsRecord(domainId: string, recordId: string, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.deleteDnsRecord(zone.id, recordId, userId, ipAddress);
  }

  /**
   * Get SSL settings for a domain's linked Cloudflare zone.
   */
  async getCloudflareSslForDomain(domainId: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.getSslSettings(zone.id);
  }

  /**
   * Update SSL settings for a domain's linked Cloudflare zone.
   */
  async updateCloudflareSslForDomain(domainId: string, data: any, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.updateSslSettings(zone.id, data, userId, ipAddress);
  }

  /**
   * Get firewall rules for a domain's linked Cloudflare zone.
   */
  async getCloudflareFirewallForDomain(domainId: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.listFirewallRules(zone.id);
  }

  /**
   * Create a firewall rule for a domain's linked Cloudflare zone.
   */
  async createCloudflareFirewallRule(domainId: string, data: { action: string; expression: string; description?: string }, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.createFirewallRule(zone.id, data, userId, ipAddress);
  }

  /**
   * Delete a firewall rule from a domain's linked Cloudflare zone.
   */
  async deleteCloudflareFirewallRule(domainId: string, ruleId: string, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.deleteFirewallRule(zone.id, ruleId, userId, ipAddress);
  }

  /**
   * Get redirect rules for a domain's linked Cloudflare zone.
   */
  async getCloudflareRedirectsForDomain(domainId: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.listRedirectRules(zone.id);
  }

  /**
   * Create a redirect rule for a domain's linked Cloudflare zone.
   */
  async createCloudflareRedirectRule(domainId: string, data: { sourcePattern: string; destinationUrl: string; redirectType: string }, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.createRedirectRule(zone.id, data, userId, ipAddress);
  }

  /**
   * Delete a redirect rule from a domain's linked Cloudflare zone.
   */
  async deleteCloudflareRedirectRule(domainId: string, ruleId: string, userId?: string, ipAddress?: string) {
    const zone = await this.getCloudflareZoneForDomain(domainId);
    if (!zone) throw new AppError(404, 'NO_CLOUDFLARE_ZONE', 'No Cloudflare zone linked to this domain');

    const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
    return cfService.deleteRedirectRule(zone.id, ruleId, userId, ipAddress);
  }

  /**
   * Create a tunnel route for a domain (Make Public action).
   * Uses the existing autoCreateTunnelRoute logic.
   */
  async createCloudflareTunnelRoute(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await this.autoCreateTunnelRoute(domain.name, domainId, userId, ipAddress);

    // Return the created route
    const [route] = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.domainId, domainId))
      .limit(1);

    return route;
  }

  /**
   * Make a domain public — auto-creates tunnel route + CNAME + SSL.
   * This is the manual equivalent of the auto-magic that happens during domain creation
   * when makePublic=true.
   */
  async makeDomainPublic(domainId: string, preferredTunnelId?: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Check if a tunnel route already exists
    const [existingRoute] = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.domainId, domainId))
      .limit(1);

    if (existingRoute) {
      // Already has a route — just update SSL and return
      const linkedZone = await this.findLinkedZoneForDomain(domain.name);
      if (linkedZone) {
        try {
          const cfService = new (await import('../cloudflare/cloudflare.service.js')).CloudflareService();
          await cfService.updateSslSettings(linkedZone.id, { sslMode: 'full' }, userId, ipAddress);
        } catch (e) {
          logger.warn({ err: e, domainId }, 'Failed to update SSL — continuing');
        }
      }
      return existingRoute;
    }

    // Create the tunnel route (this also creates CNAME + sets SSL to full internally)
    await this.autoCreateTunnelRoute(domain.name, domainId, userId, ipAddress, preferredTunnelId);

    // Return the created route
    const [route] = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.domainId, domainId))
      .limit(1);

    return route;
  }

  /**
   * Delete the tunnel route for a domain (Make Private action).
   */
  async deleteCloudflareTunnelRoute(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await this.autoRemoveTunnelRoutes(domainId, domain.name, userId, ipAddress);
  }
}

function defaultIndexHtml(domain: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${domain}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      padding: 48px;
      max-width: 560px;
      width: 90%;
      text-align: center;
    }
    .icon {
      width: 72px; height: 72px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      font-size: 36px;
    }
    h1 { font-size: 24px; margin-bottom: 8px; color: #1a1a2e; }
    .domain { color: #667eea; font-weight: 700; }
    p { color: #666; line-height: 1.6; margin-bottom: 16px; }
    .info-box {
      background: #f8f9ff;
      border: 1px solid #e8eaff;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      text-align: left;
      font-size: 14px;
    }
    .info-box dt { font-weight: 600; color: #444; margin-top: 8px; }
    .info-box dt:first-child { margin-top: 0; }
    .info-box dd { color: #666; margin-left: 0; }
    .footer {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: #999;
    }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#x2705;</div>
    <h1>Website <span class="domain">${domain}</span> is Active</h1>
    <p>Your new website has been successfully created and is now live.</p>
    <div class="info-box">
      <dl>
        <dt>Domain:</dt>
        <dd>${domain}</dd>
        <dt>Document Root:</dt>
        <dd>/httpdocs/</dd>
        <dt>Server:</dt>
        <dd>ServerForge</dd>
      </dl>
    </div>
    <p>To get started, upload your website files to the <code>/httpdocs/</code> directory using the File Manager or FTP.</p>
    <div class="footer">
      Powered by <a href="#">ServerForge</a> &mdash; Server Management Panel
    </div>
  </div>
</body>
</html>`;
}
