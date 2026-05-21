import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq, like, count, and } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { auditService } from '../audit/audit.service.js';
import { logger } from '../../config/logger.js';
import { dnsService } from '../dns/dns.service.js';
import { sslService } from '../ssl/ssl.service.js';

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

  async create(data: { name: string; siteId?: string; type?: string; projectId?: string; userId?: string; ipAddress?: string }) {
    const id = nanoid();
    await db.insert(domains).values({
      id,
      projectId: data.projectId || 'default',
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

  async makePrimary(_domainId: string, _userId?: string, _ipAddress?: string) {
    return { success: true };
  }

  async listSubdomains(_domainId: string) {
    return [];
  }

  async createSubdomain(_domainId: string, _data: { name: string; documentRoot?: string; sslEnabled?: boolean }) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Subdomain creation not available in v5 schema - use domains.create()');
  }

  async deleteSubdomain(_domainId: string, _subdomainId: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Subdomain deletion not available in v5 schema - use domains.delete()');
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