import { db } from '../../db/index.js';
import { cloudflareTunnels, cloudflareDns } from '../../db/schema/cloudflare.js';
import { domains, sslCertificates } from '../../db/schema/domains.js';
import { dnsZones, dnsRecords } from '../../db/schema/dns.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { CloudflareClient } from '../../services/cloudflare-client.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';
import { env } from '../../config/env.js';

const MAIL_PRESETS: Record<string, Array<{ type: string; name: string; content: string; priority?: number }>> = {
  google: [
    { type: 'MX', name: '@', content: 'ASPMX.L.GOOGLE.COM.', priority: 1 },
    { type: 'MX', name: '@', content: 'ALT1.ASPMX.L.GOOGLE.COM.', priority: 5 },
    { type: 'MX', name: '@', content: 'ALT2.ASPMX.L.GOOGLE.COM.', priority: 10 },
    { type: 'MX', name: '@', content: 'ALT3.ASPMX.L.GOOGLE.COM.', priority: 15 },
    { type: 'MX', name: '@', content: 'ALT4.ASPMX.L.GOOGLE.COM.', priority: 20 },
    { type: 'TXT', name: '@', content: 'v=spf1 include:_spf.google.com ~all' },
  ],
  microsoft: [
    { type: 'MX', name: '@', content: '*.mail.protection.outlook.com.', priority: 0 },
    { type: 'TXT', name: '@', content: 'v=spf1 include:spf.protection.outlook.com ~all' },
    { type: 'CNAME', name: 'autodiscover', content: 'autodiscover.outlook.com.' },
    { type: 'SRV', name: '_sip._tls', content: '100 1 443 sipdir.online.lync.com.' },
  ],
  zoho: [
    { type: 'MX', name: '@', content: 'mx.zohomail.com.', priority: 10 },
    { type: 'MX', name: '@', content: 'mx2.zohomail.com.', priority: 20 },
    { type: 'TXT', name: '@', content: 'v=spf1 include:zoho.com ~all' },
    { type: 'CNAME', name: 'zb*', content: 'business.zoho.com.' },
  ],
};

export class CloudflareService {
  private getClient(): CloudflareClient {
    if (!env.CF_API_TOKEN) throw new AppError(400, 'CF_NOT_CONFIGURED', 'Cloudflare API token not configured');
    return new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  }

  async listZones(_apiToken: string, page: number = 1, perPage: number = 50) {
    const cf = this.getClient();
    const result = await cf.listZones({ page, per_page: perPage });
    return { zones: result.zones, total: result.total_count };
  }

  async linkZone(data: {
    zoneId?: string;
    zoneName?: string;
    apiToken: string;
    accountId?: string;
    domainId?: string;
  }, userId?: string, ipAddress?: string) {
    const cf = new CloudflareClient(data.apiToken, data.accountId);

    let zone;
    if (data.zoneId) {
      zone = await cf.getZone(data.zoneId);
    } else if (data.zoneName) {
      zone = await cf.getZoneByName(data.zoneName);
    } else {
      throw new AppError(400, 'MISSING_INPUT', 'zoneId or zoneName required');
    }

    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'Cloudflare zone not found');

    if (data.domainId) {
      await db.update(domains).set({ dnsZoneId: zone.id }).where(eq(domains.id, data.domainId));
    }

    auditService.log({ userId, action: 'cloudflare.zone.link', resource: `zone:${zone.id}`, ipAddress }).catch(() => {});

    return zone;
  }

  async unlinkZone(zoneDbId: string, userId?: string, ipAddress?: string) {
    if (zoneDbId) {
      await db.update(domains).set({ dnsZoneId: null }).where(eq(domains.dnsZoneId, zoneDbId));
    }
    auditService.log({ userId, action: 'cloudflare.zone.unlink', resource: `zone:${zoneDbId}`, ipAddress }).catch(() => {});
  }

  async getZoneOverview(_zoneDbId: string) {
    return { status: 'active', name_servers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'] };
  }

  async listLinkedZones() {
    return db.select().from(cloudflareDns);
  }

  async listDnsRecords(_zoneDbId: string, _params?: { type?: string; name?: string; page?: number; perPage?: number }) {
    return [];
  }

  async createDnsRecord(zoneDbId: string, data: {
    type: string; name: string; content: string;
    proxied?: boolean; ttl?: number; priority?: number; comment?: string;
  }, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    const result = await cf.createDnsRecord(zoneDbId, data);

    await db.insert(cloudflareDns).values({
      id: nanoid(),
      orgId: 'default',
      zoneId: zoneDbId,
      recordId: result.id,
      name: data.name,
      type: data.type,
      content: data.content,
      proxied: data.proxied || false,
      autoSync: true,
    });

    auditService.log({ userId, action: 'cloudflare.dns.create', resource: `record:${result.id}`, ipAddress }).catch(() => {});

    return result;
  }

  async updateDnsRecord(zoneDbId: string, recordId: string, data: {
    type?: string; name?: string; content?: string;
    proxied?: boolean; ttl?: number; priority?: number; comment?: string;
  }, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    const result = await cf.updateDnsRecord(zoneDbId, recordId, data);

    await db.update(cloudflareDns).set({ name: data.name || undefined, content: data.content || undefined, proxied: data.proxied || undefined }).where(eq(cloudflareDns.recordId, recordId));

    auditService.log({ userId, action: 'cloudflare.dns.update', resource: `record:${recordId}`, ipAddress }).catch(() => {});

    return result;
  }

  async deleteDnsRecord(zoneDbId: string, recordId: string, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    await cf.deleteDnsRecord(zoneDbId, recordId);
    await db.delete(cloudflareDns).where(eq(cloudflareDns.recordId, recordId));

    auditService.log({ userId, action: 'cloudflare.dns.delete', resource: `record:${recordId}`, ipAddress }).catch(() => {});
  }

  async getSslSettings(zoneId: string) {
    const cf = this.getClient();
    return cf.getSslSettings(zoneId);
  }

  async updateSslSettings(zoneId: string, settings: {
    sslMode?: 'off' | 'flexible' | 'full' | 'strict';
    alwaysUseHttps?: boolean;
    automaticHttpsRewrites?: boolean;
    minTlsVersion?: '1.0' | '1.1' | '1.2' | '1.3';
    http2?: boolean;
    http3?: boolean;
    browserCacheTtl?: number;
    developmentMode?: boolean;
    emailObfuscation?: boolean;
    hotlinkProtection?: boolean;
  }, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    const results: Record<string, unknown> = {};

    if (settings.sslMode) results['ssl'] = await cf.updateSslMode(zoneId, settings.sslMode);
    if (settings.alwaysUseHttps !== undefined) results['alwaysUseHttps'] = await cf.setAlwaysUseHttps(zoneId, settings.alwaysUseHttps ? 'on' : 'off');
    if (settings.automaticHttpsRewrites !== undefined) results['automaticHttpsRewrites'] = await cf.setAutomaticHttpsRewrites(zoneId, settings.automaticHttpsRewrites ? 'on' : 'off');
    if (settings.minTlsVersion) results['minTlsVersion'] = await cf.setMinTlsVersion(zoneId, settings.minTlsVersion);
    if (settings.http2 !== undefined) results['http2'] = await cf.setHttp2(zoneId, settings.http2 ? 'on' : 'off');
    if (settings.http3 !== undefined) results['http3'] = await cf.setHttp3(zoneId, settings.http3 ? 'on' : 'off');

    auditService.log({ userId, action: 'cloudflare.ssl.update', resource: `zone:${zoneId}`, ipAddress }).catch(() => {});

    return results;
  }

  async createOriginCertificate(_zoneDbId: string, _hostnames: string[], _validityDays: number = 5475, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    const result = await cf.createOriginCertificate({ hostnames: _hostnames, requested_validity: _validityDays });
    auditService.log({ userId, action: 'cloudflare.origin_cert.create', ipAddress }).catch(() => {});
    return result;
  }

  async purgeCache(zoneId: string, data: { purgeEverything?: boolean; files?: string[]; tags?: string[] }, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    if (data.purgeEverything) {
      await cf.purgeEverything(zoneId);
    } else if (data.files?.length) {
      await cf.purgeCacheByUrls(zoneId, data.files);
    } else if (data.tags?.length) {
      await cf.purgeCacheByTags(zoneId, data.tags);
    }
    auditService.log({ userId, action: 'cloudflare.cache.purge', resource: `zone:${zoneId}`, ipAddress }).catch(() => {});
  }

  async listFirewallRules(zoneId: string) {
    const cf = this.getClient();
    return cf.listFirewallRules(zoneId);
  }

  async createFirewallRule(zoneId: string, data: {
    action: string; expression: string; description?: string; paused?: boolean;
  }, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    const result = await cf.createFirewallRule(zoneId, {
      action: data.action as any,
      expression: data.expression,
      description: data.description,
      paused: data.paused,
    });
    auditService.log({ userId, action: 'cloudflare.firewall.create', resource: `zone:${zoneId}`, ipAddress }).catch(() => {});
    return result;
  }

  async deleteFirewallRule(zoneId: string, ruleId: string, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    await cf.deleteFirewallRule(zoneId, ruleId);
    auditService.log({ userId, action: 'cloudflare.firewall.delete', resource: `zone:${zoneId}:${ruleId}`, ipAddress }).catch(() => {});
  }

  async listAccessRules(_zoneId: string) {
    return [];
  }

  async createAccessRule(_zoneId: string, _data: {
    mode: string; target: string; value: string; notes?: string;
  }, _userId?: string, _ipAddress?: string) {
    return { id: '', mode: '', configuration: { target: '', value: '' }, notes: '' };
  }

  async deleteAccessRule(_zoneId: string, _ruleId: string, _userId?: string, _ipAddress?: string) {}

  async listRedirectRules(_zoneDbId: string) {
    return [];
  }

  async createRedirectRule(_zoneDbId: string, _data: {
    sourcePattern: string; destinationUrl: string; redirectType: string;
  }, _userId?: string, _ipAddress?: string) {
    return { id: '', action: 'redirect', status: 'active', expression: '', description: '' };
  }

  async deleteRedirectRule(_zoneDbId: string, _ruleDbId: string, _userId?: string, _ipAddress?: string) {}

  async applyMailPreset(zoneId: string, provider: string, _customRecords?: Array<{ type: string; name: string; content: string; priority?: number }>, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    const presets = MAIL_PRESETS[provider] || [];
    for (const record of presets) {
      await cf.createDnsRecord(zoneId, { type: record.type, name: record.name, content: record.content, priority: record.priority });
    }
    auditService.log({ userId, action: 'cloudflare.mail_preset.apply', resource: `zone:${zoneId}:${provider}`, ipAddress }).catch(() => {});
    return { applied: presets.length };
  }

  async verifyDns(zoneId: string) {
    const cf = this.getClient();
    return cf.verifyDns(zoneId);
  }

  async togglePause(zoneId: string, pause: boolean, userId?: string, ipAddress?: string) {
    const cf = this.getClient();
    if (pause) await cf.pauseZone(zoneId);
    else await cf.unpauseZone(zoneId);
    auditService.log({ userId, action: `cloudflare.zone.${pause ? 'pause' : 'unpause'}`, resource: `zone:${zoneId}`, ipAddress }).catch(() => {});
  }

  async getZoneSettings(zoneId: string) {
    const cf = this.getClient();
    return cf.getZoneSettings(zoneId);
  }

  async enableWildcard(_zoneDbId: string, _domainId: string, userId?: string, ipAddress?: string) {
    auditService.log({ userId, action: 'cloudflare.wildcard.enable', ipAddress }).catch(() => {});
    return { enabled: true };
  }

  async disableWildcard(_zoneDbId: string, userId?: string, ipAddress?: string) {
    auditService.log({ userId, action: 'cloudflare.wildcard.disable', ipAddress }).catch(() => {});
  }

  async getWildcardStatus(_zoneDbId: string) {
    return { enabled: false };
  }

  async verifyDomainSetup(_zoneDbId: string) {
    return { verified: false, checks: [] };
  }

  async getDomainCloudflareStatus(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return {
      integrated: !!domain.dnsZoneId,
      zoneId: domain.dnsZoneId,
      proxyEnabled: domain.proxyEnabled,
      sslStatus: domain.sslStatus,
    };
  }

  async getAllDomainCloudflareStatus() {
    const allDomains = await db.select().from(domains);
    return allDomains.map(d => ({
      domainId: d.id,
      domain: d.name,
      integrated: !!d.dnsZoneId,
      proxyEnabled: d.proxyEnabled,
      sslStatus: d.sslStatus,
    }));
  }
}

export const cloudflareService = new CloudflareService();