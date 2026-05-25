import { db } from '../../db/index.js';
import { dnsZones, dnsRecords } from '../../db/schema/dns.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';
import { CloudflareClient } from '../../services/cloudflare-client.js';
import { env } from '../../config/env.js';

export class DnsService {
  async getZone(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));
    return { zone, records };
  }

  async ensureZone(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const existing = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (existing[0]) return existing[0];

    const [zone] = await db.insert(dnsZones).values({
      id: nanoid(),
      orgId: domain.orgId,
      domainId,
      name: domain.name,
      dnssecEnabled: false,
    }).returning();

    auditService.log({ userId, action: 'dns.zone.create', resource: `zone:${zone.id}`, ipAddress }).catch(() => {});

    return zone;
  }

  async createRecord(domainId: string, data: {
    type: string; name: string; value: string; ttl?: number; priority?: number;
  }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    let zoneArr = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    let zone = zoneArr[0];
    if (!zone) zone = await this.ensureZone(domainId, userId, ipAddress);

    const [record] = await db.insert(dnsRecords).values({
      id: nanoid(),
      zoneId: zone.id,
      name: data.name,
      type: data.type as 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS' | 'PTR',
      value: data.value,
      ttl: data.ttl || 3600,
      priority: data.priority || null,
    }).returning();

    auditService.log({ userId, action: 'dns.record.create', resource: `record:${record.id}`, ipAddress }).catch(() => {});

    if (env.CF_API_TOKEN) {
      await this.syncRecordToCloudflare(zone, record, domain.name).catch(err =>
        logger.warn({ err, recordId: record.id }, 'Failed to sync DNS record to Cloudflare')
      );
    }

    return record;
  }

  async updateRecord(recordId: string, data: { name?: string; value?: string; ttl?: number; priority?: number }, userId?: string, ipAddress?: string) {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, recordId)).limit(1);
    if (!record) throw new AppError(404, 'RECORD_NOT_FOUND', 'DNS record not found');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.ttl !== undefined) updateData.ttl = data.ttl;
    if (data.priority !== undefined) updateData.priority = data.priority;

    const [updated] = await db.update(dnsRecords).set(updateData).where(eq(dnsRecords.id, recordId)).returning();

    auditService.log({ userId, action: 'dns.record.update', resource: `record:${recordId}`, ipAddress }).catch(() => {});

    if (env.CF_API_TOKEN) {
      const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.id, record.zoneId)).limit(1);
      if (zone) {
        const [domain] = await db.select().from(domains).where(eq(domains.id, zone.domainId)).limit(1);
        if (domain) {
          await this.syncRecordToCloudflare(zone, updated, domain.name, recordId).catch(err =>
            logger.warn({ err, recordId }, 'Failed to sync DNS record update to Cloudflare')
          );
        }
      }
    }

    return updated;
  }

  async deleteRecord(recordId: string, userId?: string, ipAddress?: string) {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, recordId)).limit(1);
    if (!record) throw new AppError(404, 'RECORD_NOT_FOUND', 'DNS record not found');

    await db.delete(dnsRecords).where(eq(dnsRecords.id, recordId));

    auditService.log({ userId, action: 'dns.record.delete', resource: `record:${recordId}`, ipAddress }).catch(() => {});

    if (env.CF_API_TOKEN) {
      const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.id, record.zoneId)).limit(1);
      if (zone) {
        const [domain] = await db.select().from(domains).where(eq(domains.id, zone.domainId)).limit(1);
        if (domain) {
          const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
          const cfZone = await cf.getZoneByName(domain.name);
          if (cfZone) {
            await cf.deleteDnsRecord(cfZone.id, recordId).catch(err =>
              logger.warn({ err, recordId }, 'Failed to delete DNS record from Cloudflare')
            );
          }
        }
      }
    }
  }

  async importZone(domainId: string, bindFormat: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    let zoneArr = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    let zone = zoneArr[0];
    if (!zone) zone = await this.ensureZone(domainId, userId, ipAddress);

    const lines = bindFormat.split('\n');
    let soa: Record<string, unknown> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('@') && trimmed.includes('SOA')) {
        soa = { raw: trimmed };
        continue;
      }

      const aMatch = trimmed.match(/^([^\s]+)\s+(\d+)?\s+IN\s+(A|AAAA|CNAME|MX|TXT|SRV)\s+(.+)$/);
      if (aMatch) {
        const [, name, ttl, type, value] = aMatch;
        const recordName = name === '@' ? domain.name : name;
        const recordTtl = ttl ? parseInt(ttl) : 3600;

        if (type === 'MX') {
          const mxMatch = value.match(/^(\d+)\s+(.+)$/);
          if (mxMatch) {
            await db.insert(dnsRecords).values({
              id: nanoid(),
              zoneId: zone.id,
              name: recordName,
              type: 'MX',
              value: mxMatch[2],
              priority: parseInt(mxMatch[1]),
              ttl: recordTtl,
            }).onConflictDoNothing();
          }
        } else {
          await db.insert(dnsRecords).values({
            id: nanoid(),
            zoneId: zone.id,
            name: recordName,
            type: type as 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS' | 'PTR',
            value: value.replace(/[;.]$/, ''),
            ttl: recordTtl,
          }).onConflictDoNothing();
        }
      }
    }

    if (soa) {
      await db.update(dnsZones).set({ soa: JSON.stringify(soa) }).where(eq(dnsZones.id, zone.id));
    }

    auditService.log({ userId, action: 'dns.zone.import', resource: `zone:${zone.id}`, ipAddress }).catch(() => {});

    return zone;
  }

  async exportZone(domainId: string): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));

    const lines: string[] = [];
    lines.push(`$ORIGIN ${domain.name}.`);
    lines.push(`$TTL 3600`);
    lines.push(`@  IN  SOA  ns1.${domain.name}.  admin.${domain.name}.  (`);
    // Use format: YYYYMMDDNN (year-month-day-sequence) for proper DNS serial
    const now = new Date();
    const serialBase = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const serial = `${serialBase}01`; // Base serial with 01 as sequence
    lines.push(`  ${serial}  ; Serial`);
    lines.push(`  7200  ; Refresh`);
    lines.push(`  3600  ; Retry`);
    lines.push(`  1209600  ; Expire`);
    lines.push(`  3600 )  ; Minimum TTL`);
    lines.push(``);

    for (const record of records) {
      const name = record.name === domain.name ? '@' : record.name;
      const priority = record.priority ? `${record.priority} ` : '';
      lines.push(`${name}  ${record.ttl}  IN  ${record.type}  ${priority}${record.value}`);
    }

    return lines.join('\n');
  }

  async resetToDefaults(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    await db.delete(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));

    auditService.log({ userId, action: 'dns.zone.reset', resource: `zone:${zone.id}`, ipAddress }).catch(() => {});

    return zone;
  }

  async getRawZone(domainId: string): Promise<string> {
    return this.exportZone(domainId);
  }

  /**
   * [P3-10] TODO: Implement actual DNS propagation checking.
   * Currently returns stub data - production should query
   * multiple DNS servers (Cloudflare, Google, etc.) to verify
   * record propagation across the internet.
   */
  async checkPropagation(domainId: string): Promise<{ checks: Array<{ nameserver: string; ip: string; resolves: boolean }> }> {
    const checks = [
      { nameserver: 'ns1.cloudflare.com', ip: '162.159.1.1', resolves: false },
      { nameserver: 'ns2.cloudflare.com', ip: '162.159.2.1', resolves: false },
      { nameserver: 'Google DNS', ip: '8.8.8.8', resolves: false },
    ];
    return { checks };
  }

  async updateSoa(domainId: string, data: {
    primaryNs?: string;
    adminEmail?: string;
    refresh?: number;
    retry?: number;
    expire?: number;
    minimumTtl?: number;
  }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const currentSoa = zone.soa ? JSON.parse(JSON.stringify(zone.soa)) : {};
    const newSoa = {
      ...currentSoa,
      primaryNs: data.primaryNs || currentSoa.primaryNs,
      adminEmail: data.adminEmail || currentSoa.adminEmail,
      refresh: data.refresh || currentSoa.refresh,
      retry: data.retry || currentSoa.retry,
      expire: data.expire || currentSoa.expire,
      minimumTtl: data.minimumTtl || currentSoa.minimumTtl,
    };

    await db.update(dnsZones).set({ soa: JSON.stringify(newSoa), updatedAt: new Date() }).where(eq(dnsZones.id, zone.id));

    auditService.log({ userId, action: 'dns.zone.update_soa', resource: `zone:${zone.id}`, ipAddress }).catch(() => {});

    return newSoa;
  }

  async getCloudflareConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return { enabled: !!env.CF_API_TOKEN, apiToken: env.CF_API_TOKEN ? '***' : '', zoneId: env.CF_ZONE_ID || '', zoneName: domain.name, lastSyncAt: null };
  }

  async updateCloudflareConfig(domainId: string, data: { enabled?: boolean; apiToken?: string; zoneId?: string; zoneName?: string }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return { enabled: data.enabled ?? !!env.CF_API_TOKEN, apiToken: data.apiToken || env.CF_API_TOKEN || '', zoneId: data.zoneId || env.CF_ZONE_ID || '', zoneName: data.zoneName || domain.name, lastSyncAt: null };
  }

  async syncCloudflareRecords(domainId: string) {
    if (!env.CF_API_TOKEN) return { synced: false, recordsProcessed: 0, message: 'Cloudflare API token not configured' };

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));
    const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
    const cfZone = await cf.getZoneByName(domain.name);

    if (!cfZone) return { synced: false, recordsProcessed: 0, message: `Cloudflare zone not found for ${domain.name}` };

    let processed = 0;
    for (const record of records) {
      try {
        const existingRecords = await cf.listDnsRecords(cfZone.id, { name: `${record.name}.${domain.name}` });
        if (existingRecords.records[0]) {
          await cf.updateDnsRecord(cfZone.id, existingRecords.records[0].id, {
            type: record.type,
            name: record.name,
            content: record.value,
            proxied: record.proxied,
            ttl: record.ttl,
            priority: record.priority || undefined,
          });
        } else {
          await cf.createDnsRecord(cfZone.id, {
            type: record.type,
            name: record.name,
            content: record.value,
            proxied: record.proxied,
            ttl: record.ttl,
            priority: record.priority || undefined,
          });
        }
        processed++;
      } catch (err) {
        logger.warn({ err, recordId: record.id }, 'Failed to sync DNS record to Cloudflare');
      }
    }

    return { synced: true, recordsProcessed: processed, message: `Synced ${processed} records to Cloudflare` };
  }

  async deleteZone(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) return;

    await db.delete(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));
    await db.delete(dnsZones).where(eq(dnsZones.id, zone.id));

    auditService.log({ userId, action: 'dns.zone.delete', resource: `zone:${zone.id}`, ipAddress }).catch(() => {});
  }

  async syncZoneToDisk(_zoneId: string) {
    // In v5, we store records in SQLite and sync to Cloudflare
    // No local BIND zone files needed
  }

  private async syncRecordToCloudflare(zone: { id: string; name: string }, record: { id: string; name: string; type: string; value: string; ttl: number; priority?: number | null; proxied?: boolean }, domainName: string, _recordId?: string) {
    if (!env.CF_API_TOKEN) return;
    const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
    const cfZone = await cf.getZoneByName(domainName);
    if (!cfZone) return;

    const recordName = record.name === domainName ? '@' : record.name;
    await cf.createDnsRecord(cfZone.id, {
      type: record.type,
      name: recordName,
      content: record.value,
      proxied: record.proxied || false,
      ttl: record.ttl,
      priority: record.priority || undefined,
    });
  }
}

export const dnsService = new DnsService();