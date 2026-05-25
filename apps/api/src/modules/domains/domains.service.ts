import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq, like, count, and } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { auditService } from '../audit/audit.service.js';
import { logger } from '../../config/logger.js';
import { dnsService } from '../dns/dns.service.js';
import { sslService } from '../ssl/ssl.service.js';
import { run } from '../../services/executor.js';

interface Subdomain {
  id: string;
  name: string;
  domainId: string;
  documentRoot: string;
  phpVersion: string;
  siteId: string | null;
  createdAt: Date;
}

interface DomainAlias {
  id: string;
  alias: string;
  domainId: string;
  createdAt: Date;
}

interface DomainRedirect {
  id: string;
  sourcePath: string;
  targetUrl: string;
  type: '301' | '302';
  domainId: string;
  createdAt: Date;
}

// [P3-12] Deferred: Subdomains, aliases, and redirects currently use in-memory storage.
// Requires a database migration to create proper tables. In production,
// these should be stored in the database for persistence across restarts.
const subdomainStore: Map<string, Subdomain> = new Map();
const aliasStore: Map<string, DomainAlias> = new Map();
const redirectStore: Map<string, DomainRedirect> = new Map();

interface ListOptions {
  page?: number;
  perPage?: number;
  search?: string;
  siteId?: string;
  type?: string;
}

interface ListResult {
  items: any[];
  total: number;
  page: number;
  perPage: number;
}

export class DomainsService {
  async list(options: ListOptions = {}): Promise<ListResult> {
    const page = options.page || 1;
    const perPage = options.perPage || 20;
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (options.search) conditions.push(like(domains.name, `%${options.search}%`));
    if (options.siteId) conditions.push(eq(domains.siteId, options.siteId));
    if (options.type) conditions.push(eq(domains.type, options.type as 'apex' | 'subdomain' | 'wildcard'));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select().from(domains).where(where).limit(perPage).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(domains);

    return { items, total, page, perPage };
  }

  async get(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return domain;
  }

  async create(data: { name: string; siteId?: string; type?: string; orgId?: string; userId?: string; ipAddress?: string }) {
    const id = nanoid();
    await db.insert(domains).values({
      id,
      orgId: data.orgId || undefined,
      name: data.name,
      siteId: data.siteId || null,
      type: (data.type as 'apex' | 'subdomain' | 'wildcard') || 'apex',
    });

    auditService.log({
      userId: data.userId,
      action: 'domain.create',
      resource: `domain:${data.name}`,
      ipAddress: data.ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.get(id);
  }

  async update(id: string, data: { name?: string; sslStatus?: string; forceHttps?: boolean; hstsEnabled?: boolean; proxyEnabled?: boolean; sslAutoRenew?: boolean; customNginxConfig?: string; status?: string }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({
      ...(data.name && { name: data.name }),
      ...(data.sslStatus && { sslStatus: data.sslStatus as 'pending' | 'active' | 'expired' | 'error' }),
      ...(data.forceHttps !== undefined && { forceHttps: data.forceHttps }),
      ...(data.hstsEnabled !== undefined && { hstsEnabled: data.hstsEnabled }),
      ...(data.proxyEnabled !== undefined && { proxyEnabled: data.proxyEnabled }),
      ...(data.sslAutoRenew !== undefined && { sslAutoRenew: data.sslAutoRenew }),
      ...(data.customNginxConfig !== undefined && { customNginxConfig: data.customNginxConfig }),
      ...(data.status && { status: data.status as 'active' | 'suspended' | 'pending' }),
    }).where(eq(domains.id, id));

    auditService.log({
      userId,
      action: 'domain.update',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.get(id);
  }

  async delete(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.delete(domains).where(eq(domains.id, id));

    auditService.log({
      userId,
      action: 'domain.delete',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async makePrimary(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // In a real implementation, this would update site settings or domain primary flag
    auditService.log({
      userId,
      action: 'domain.make_primary',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true, domainId };
  }

  async listSubdomains(domainId: string): Promise<Subdomain[]> {
    // Verify domain exists
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subdomains: Subdomain[] = [];
    subdomainStore.forEach((sub) => {
      if (sub.domainId === domainId) {
        subdomains.push(sub);
      }
    });
    return subdomains;
  }

  async createSubdomain(domainId: string, data: { name: string; documentRoot?: string; phpVersion?: string; siteId?: string; websiteId?: string }, userId?: string, ipAddress?: string): Promise<Subdomain> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subdomain: Subdomain = {
      id: nanoid(),
      name: data.name,
      domainId,
      documentRoot: data.documentRoot || `/var/www/${data.name}`,
      phpVersion: data.phpVersion || '8.1',
      siteId: data.siteId || data.websiteId || null,
      createdAt: new Date(),
    };

    subdomainStore.set(subdomain.id, subdomain);

    auditService.log({
      userId,
      action: 'domain.subdomain.create',
      resource: `domain:${domain.name}/subdomain:${data.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return subdomain;
  }

  async deleteSubdomain(domainId: string, subdomainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subdomain = subdomainStore.get(subdomainId);
    if (!subdomain) throw new AppError(404, 'SUBDOMAIN_NOT_FOUND', 'Subdomain not found');
    if (subdomain.domainId !== domainId) throw new AppError(403, 'FORBIDDEN', 'Subdomain does not belong to this domain');

    subdomainStore.delete(subdomainId);

    auditService.log({
      userId,
      action: 'domain.subdomain.delete',
      resource: `domain:${domain.name}/subdomain:${subdomain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  // Aliases
  async listAliases(domainId: string): Promise<DomainAlias[]> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const aliases: DomainAlias[] = [];
    aliasStore.forEach((alias) => {
      if (alias.domainId === domainId) {
        aliases.push(alias);
      }
    });
    return aliases;
  }

  async createAlias(domainId: string, data: { alias: string }, userId?: string, ipAddress?: string): Promise<DomainAlias> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const alias: DomainAlias = {
      id: nanoid(),
      alias: data.alias,
      domainId,
      createdAt: new Date(),
    };

    aliasStore.set(alias.id, alias);

    auditService.log({
      userId,
      action: 'domain.alias.create',
      resource: `domain:${domain.name}/alias:${data.alias}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return alias;
  }

  async deleteAlias(domainId: string, aliasId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const alias = aliasStore.get(aliasId);
    if (!alias) throw new AppError(404, 'ALIAS_NOT_FOUND', 'Alias not found');
    if (alias.domainId !== domainId) throw new AppError(403, 'FORBIDDEN', 'Alias does not belong to this domain');

    aliasStore.delete(aliasId);

    auditService.log({
      userId,
      action: 'domain.alias.delete',
      resource: `domain:${domain.name}/alias:${alias.alias}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  // Redirects
  async listRedirects(domainId: string): Promise<DomainRedirect[]> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const redirects: DomainRedirect[] = [];
    redirectStore.forEach((redirect) => {
      if (redirect.domainId === domainId) {
        redirects.push(redirect);
      }
    });
    return redirects;
  }

  async createRedirect(domainId: string, data: { sourcePath: string; targetUrl: string; type: '301' | '302' }, userId?: string, ipAddress?: string): Promise<DomainRedirect> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const redirect: DomainRedirect = {
      id: nanoid(),
      sourcePath: data.sourcePath,
      targetUrl: data.targetUrl,
      type: data.type,
      domainId,
      createdAt: new Date(),
    };

    redirectStore.set(redirect.id, redirect);

    auditService.log({
      userId,
      action: 'domain.redirect.create',
      resource: `domain:${domain.name}/redirect:${data.sourcePath}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return redirect;
  }

  async deleteRedirect(domainId: string, redirectId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const redirect = redirectStore.get(redirectId);
    if (!redirect) throw new AppError(404, 'REDIRECT_NOT_FOUND', 'Redirect not found');
    if (redirect.domainId !== domainId) throw new AppError(403, 'FORBIDDEN', 'Redirect does not belong to this domain');

    redirectStore.delete(redirectId);

    auditService.log({
      userId,
      action: 'domain.redirect.delete',
      resource: `domain:${domain.name}/redirect:${redirect.sourcePath}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  async setPublic(domainId: string, data: { tunnelId?: string }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // In a real implementation, this would configure the tunnel route or update domain settings
    auditService.log({
      userId,
      action: 'domain.make_public',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true, tunnelId: data.tunnelId };
  }

  async getLogs(domainId: string, lines: number = 100): Promise<{ accessLog: string; errorLog: string }> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Common nginx log paths
    const logBasePath = `/var/log/nginx`;
    const domainLogDir = `${logBasePath}/${domain.name}`;

    let accessLog = '';
    let errorLog = '';
    let accessLogFailed = false;
    let errorLogFailed = false;

    // Try domain-specific logs first, then fall back to default
    const accessPaths = [`${domainLogDir}/access.log`, `${logBasePath}/access.log`, `${logBasePath}/access.log.bak`];
    const errorPaths = [`${domainLogDir}/error.log`, `${logBasePath}/error.log`, `${logBasePath}/error.log.bak`];

    for (const path of accessPaths) {
      try {
        const result = await run('tail', ['-n', String(lines), path], { sudo: false });
        if (result.exitCode === 0 && result.stdout) {
          accessLog = result.stdout;
          break;
        }
      } catch {
        // Try next path
      }
    }
    if (!accessLog) accessLogFailed = true;

    for (const path of errorPaths) {
      try {
        const result = await run('tail', ['-n', String(lines), path], { sudo: false });
        if (result.exitCode === 0 && result.stdout) {
          errorLog = result.stdout;
          break;
        }
      } catch {
        // Try next path
      }
    }
    if (!errorLog) errorLogFailed = true;

    // If both logs failed, throw an error with helpful message
    if (accessLogFailed && errorLogFailed) {
      throw new AppError(404, 'LOGS_NOT_FOUND', `No log files found for domain ${domain.name}. Tried paths: ${accessPaths.join(', ')} and ${errorPaths.join(', ')}`);
    }

    return { accessLog, errorLog };
  }

  async verifyDomain(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const zone = await dnsService.getZone(id).catch(() => null);
    if (zone) {
      return { verified: true, domain: domain.name, zoneId: zone.zone.id };
    }
    return { verified: false, domain: domain.name };
  }

  async getDomainSsl(domainId: string) {
    return sslService.getCertificate(domainId);
  }

  async enableAutoSsl(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({ sslAutoRenew: true }).where(eq(domains.id, domainId));
    auditService.log({ userId, action: 'domain.enable_auto_ssl', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async disableAutoSsl(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({ sslAutoRenew: false }).where(eq(domains.id, domainId));
    auditService.log({ userId, action: 'domain.disable_auto_ssl', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async requestSsl(domainId: string, type: string, userId?: string, ipAddress?: string) {
    if (type === 'letsencrypt') {
      const result = await sslService.issueLetsEncrypt(domainId, { email: '', challengeType: 'http-01' }, userId, ipAddress);
      return result;
    }
    throw new AppError(400, 'INVALID_TYPE', 'Unknown SSL certificate type');
  }

  async renewSsl(domainId: string, userId?: string, ipAddress?: string) {
    return sslService.renewCertificate(domainId, userId, ipAddress);
  }

  async deleteSsl(domainId: string, userId?: string, ipAddress?: string) {
    await sslService.removeCertificate(domainId, userId, ipAddress);
    return { success: true };
  }

  async downloadSslCert(domainId: string) {
    const pem = await sslService.downloadCert(domainId, 'cert');
    return pem;
  }

  async checkPropagation(id: string) {
    return dnsService.checkPropagation(id);
  }

  async getDnsSettings(id: string) {
    const zone = await dnsService.getZone(id);
    return {
      zoneId: zone.zone.id,
      zoneName: zone.zone.name,
      dnssecEnabled: zone.zone.dnssecEnabled,
      soa: zone.zone.soa,
    };
  }

  async updateDnsSettings(_id: string, _data: { primaryDns?: string; secondaryDns?: string; }) {
    return { success: true };
  }

  async getNameservers(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return {
      nameservers: domain.nameservers || ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      zoneName: domain.name,
    };
  }

  async getCloudflareStatus(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return { enabled: domain.proxyEnabled, status: domain.proxyEnabled ? 'active' : 'inactive' };
  }

  async getCloudflareZone(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    // Return Cloudflare zone info for this domain
    // In production, this would call Cloudflare API to get zone details
    return {
      id: domain.id,
      zoneName: domain.name,
      zoneId: null,
      accountId: null,
      sslMode: domain.sslStatus || 'off',
      isPaused: false,
    };
  }

  async enableCloudflare(id: string, data: { enabled?: boolean; proxyEnabled?: boolean; sslMode?: string }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({
      proxyEnabled: data.proxyEnabled ?? true,
    }).where(eq(domains.id, id));
    auditService.log({ userId, action: 'domain.enable_cloudflare', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return { enabled: true, proxyEnabled: data.proxyEnabled ?? true };
  }

  async disableCloudflare(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({ proxyEnabled: false }).where(eq(domains.id, id));
    auditService.log({ userId, action: 'domain.disable_cloudflare', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return { enabled: false };
  }

  async getZone(id: string) {
    return dnsService.getZone(id);
  }

  async createZone(id: string, userId?: string, ipAddress?: string) {
    return dnsService.ensureZone(id, userId, ipAddress);
  }

  async deleteZone(id: string, userId?: string, ipAddress?: string) {
    return dnsService.deleteZone(id, userId, ipAddress);
  }

  async listZoneRecords(id: string) {
    const zone = await dnsService.getZone(id);
    return zone.records;
  }

  async createZoneRecord(domainId: string, data: { type: string; name: string; value: string; ttl?: number; priority?: number }, userId?: string, ipAddress?: string) {
    return dnsService.createRecord(domainId, data, userId, ipAddress);
  }

  async updateZoneRecord(_zoneId: string, recordId: string, data: { name?: string; value?: string; ttl?: number; priority?: number }, userId?: string, ipAddress?: string) {
    return dnsService.updateRecord(recordId, data, userId, ipAddress);
  }

  async deleteZoneRecord(_zoneId: string, recordId: string, userId?: string, ipAddress?: string) {
    return dnsService.deleteRecord(recordId, userId, ipAddress);
  }

  async importZoneRecords(domainId: string, bindFormat: string, userId?: string, ipAddress?: string) {
    return dnsService.importZone(domainId, bindFormat, userId, ipAddress);
  }

  async exportZoneRecords(domainId: string) {
    return dnsService.exportZone(domainId);
  }

  async resetZoneToDefaults(domainId: string, userId?: string, ipAddress?: string) {
    return dnsService.resetToDefaults(domainId, userId, ipAddress);
  }

  async updateSoa(domainId: string, data: { primaryNs?: string; adminEmail?: string; refresh?: number; retry?: number; expire?: number; minimumTtl?: number }, userId?: string, ipAddress?: string) {
    return dnsService.updateSoa(domainId, data, userId, ipAddress);
  }

  async syncCloudflare(domainId: string) {
    return dnsService.syncCloudflareRecords(domainId);
  }

  async listBySite(siteId: string) {
    return db.select().from(domains).where(eq(domains.siteId, siteId));
  }

  async suspend(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({ status: 'suspended' }).where(eq(domains.id, id));
    auditService.log({ userId, action: 'domain.suspend', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return this.get(id);
  }

  async unsuspend(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({ status: 'active' }).where(eq(domains.id, id));
    auditService.log({ userId, action: 'domain.unsuspend', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return this.get(id);
  }
}

export const domainsService = new DomainsService();