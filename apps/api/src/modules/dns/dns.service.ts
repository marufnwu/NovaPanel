import { db } from '../../db/index.js';
import { dnsZones, dnsRecords } from '../../db/schema/dns.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { bindService } from '../../services/bind.service.js';
import { run } from '../../services/executor.js';
import { env } from '../../config/env.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { resolve4, resolve6, resolveMx } from 'node:dns/promises';
import { auditService } from '../audit/audit.service.js';
import { createDnsError } from '../../utils/error-messages.js';

export class DnsService {
  /**
   * Get DNS zone and all records for a domain
   */
  async getZone(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    let [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);

    // Auto-create zone if it doesn't exist
    if (!zone) {
      zone = await this.ensureZone(domainId);
    }

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));

    return { zone, records };
  }

  /**
   * Ensure a DNS zone exists for a domain, creating one with defaults if missing
   */
  async ensureZone(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Check again in case it was created concurrently
    const [existing] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (existing) return existing;

    const zoneId = nanoid();
    const serial = Math.floor(Date.now() / 1000);

    await db.insert(dnsZones).values({
      id: zoneId,
      domainId,
      serial,
      ttl: 3600,
      primaryNs: 'ns1.example.com.',
      adminEmail: 'admin.example.com.',
      refresh: 86400,
      retry: 7200,
      expire: 3600000,
      minimumTtl: 172800,
      isActive: true,
    });

    // Get server IP for default records
    let serverIp = '127.0.0.1';
    try {
      const ipResult = await run('hostname', ['-I']);
      serverIp = ipResult.stdout.trim().split(' ')[0] || '127.0.0.1';
    } catch {
      // Use default IP if hostname command fails
    }

    // Insert default DNS records
    const defaultRecords = [
      { type: 'A', name: '@', value: serverIp, priority: null },
      { type: 'A', name: 'www', value: serverIp, priority: null },
      { type: 'A', name: 'mail', value: serverIp, priority: null },
      { type: 'MX', name: '@', value: `mail.${domain.name}.`, priority: 10 },
      { type: 'TXT', name: '@', value: `"v=spf1 a mx ip4:${serverIp} ~all"`, priority: null },
      { type: 'NS', name: '@', value: 'ns1.example.com.', priority: null },
      { type: 'NS', name: '@', value: 'ns2.example.com.', priority: null },
    ];

    for (const rec of defaultRecords) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId,
        type: rec.type as any,
        name: rec.name,
        value: rec.value,
        ttl: 3600,
        priority: rec.priority,
        isSystem: true,
      });
    }

    logger.info({ domainId, domain: domain.name }, 'DNS zone auto-created with default records');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.id, zoneId)).limit(1);
    return zone!;
  }

  /**
   * Create a DNS record
   */
  async createRecord(domainId: string, data: {
    type: string; name: string; value: string; ttl?: number; priority?: number;
  }, userId?: string, ipAddress?: string) {
    // Ensure zone exists (auto-create if missing)
    const zone = await this.ensureZone(domainId);

    const recordId = nanoid();
    await db.insert(dnsRecords).values({
      id: recordId,
      zoneId: zone.id,
      type: data.type as any,
      name: data.name,
      value: data.value,
      ttl: data.ttl || 3600,
      priority: data.priority,
      isSystem: false,
    });

    // Bump serial and rewrite zone file
    await this.rewriteZoneFile(zone.id);

    logger.info({ domainId, type: data.type, name: data.name }, 'DNS record created');

    auditService.log({
      userId,
      action: 'dns.record.create',
      resource: `domain:${domainId}`,
      details: JSON.stringify({ type: data.type, name: data.name, value: data.value }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: recordId, ...data };
  }

  /**
   * Update a DNS record
   */
  async updateRecord(recordId: string, data: { name?: string; value?: string; ttl?: number; priority?: number }, userId?: string, ipAddress?: string) {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, recordId)).limit(1);
    if (!record) throw new AppError(404, 'RECORD_NOT_FOUND', 'DNS record not found');

    if (record.isSystem) {
      throw new AppError(403, 'SYSTEM_RECORD', 'Cannot modify system-generated DNS record');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.ttl !== undefined) updateData.ttl = data.ttl;
    if (data.priority !== undefined) updateData.priority = data.priority;

    await db.update(dnsRecords).set(updateData).where(eq(dnsRecords.id, recordId));
    await this.rewriteZoneFile(record.zoneId);

    auditService.log({
      userId,
      action: 'dns.record.update',
      resource: `record:${recordId}`,
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: recordId, ...data };
  }

  /**
   * Delete a DNS record
   */
  async deleteRecord(recordId: string, userId?: string, ipAddress?: string) {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, recordId)).limit(1);
    if (!record) throw new AppError(404, 'RECORD_NOT_FOUND', 'DNS record not found');

    if (record.isSystem) {
      throw new AppError(403, 'SYSTEM_RECORD', 'Cannot delete system-generated DNS record');
    }

    await db.delete(dnsRecords).where(eq(dnsRecords.id, recordId));
    await this.rewriteZoneFile(record.zoneId);

    auditService.log({
      userId,
      action: 'dns.record.delete',
      resource: `record:${recordId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Import DNS zone from BIND format text
   */
  async importZone(domainId: string, bindFormat: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Parse BIND format (simplified parser)
    const records = this.parseBindFormat(bindFormat);

    // Get existing zone
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found for this domain');

    // Delete existing non-system records
    const existingRecords = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));
    for (const rec of existingRecords) {
      if (!rec.isSystem) {
        await db.delete(dnsRecords).where(eq(dnsRecords.id, rec.id));
      }
    }

    // Insert parsed records
    for (const rec of records) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: rec.type as any,
        name: rec.name,
        value: rec.value,
        ttl: rec.ttl || 3600,
        priority: rec.priority,
        isSystem: false,
      });
    }

    await this.rewriteZoneFile(zone.id);
    logger.info({ domainId, recordCount: records.length }, 'DNS zone imported');

    auditService.log({
      userId,
      action: 'dns.zone.import',
      resource: `domain:${domainId}`,
      details: JSON.stringify({ recordCount: records.length }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { imported: records.length };
  }

  /**
   * Export DNS zone as BIND format text
   */
  async exportZone(domainId: string): Promise<string> {
    const { zone, records } = await this.getZone(domainId);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);

    let output = `$ORIGIN ${domain!.name}.\n`;
    output += `$TTL ${zone.ttl}\n`;
    output += `@   IN  SOA ${zone.primaryNs}. ${zone.adminEmail}. (\n`;
    output += `        ${zone.serial}  ; Serial\n`;
    output += `        ${zone.refresh}  ; Refresh\n`;
    output += `        ${zone.retry}    ; Retry\n`;
    output += `        ${zone.expire}  ; Expire\n`;
    output += `        ${zone.minimumTtl}  ; Minimum TTL\n`;
    output += `    )\n\n`;

    for (const rec of records) {
      const priority = rec.priority ? `${rec.priority} ` : '';
      output += `${rec.name}   ${rec.ttl || ''}   IN  ${rec.type}   ${priority}${rec.value}\n`;
    }

    return output;
  }

  /**
   * Reset DNS to default records (A, www, mail, MX, SPF)
   */
  async resetToDefaults(domainId: string, userId?: string, ipAddress?: string) {
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    // Delete all non-system records
    const existingRecords = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));
    for (const rec of existingRecords) {
      if (!rec.isSystem) {
        await db.delete(dnsRecords).where(eq(dnsRecords.id, rec.id));
      }
    }

    // Get server IP
    const ipResult = await run('hostname', ['-I']);
    const serverIp = ipResult.stdout.trim().split(' ')[0] || '127.0.0.1';

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);

    // Insert default records
    const defaults = [
      { type: 'A', name: '@', value: serverIp },
      { type: 'A', name: 'www', value: serverIp },
      { type: 'A', name: 'mail', value: serverIp },
      { type: 'MX', name: '@', value: `mail.${domain!.name}.`, priority: 10 },
      { type: 'TXT', name: '@', value: `"v=spf1 a mx ip4:${serverIp} ~all"` },
      { type: 'NS', name: '@', value: 'ns1.example.com.' },
      { type: 'NS', name: '@', value: 'ns2.example.com.' },
    ];

    for (const rec of defaults) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: rec.type as any,
        name: rec.name,
        value: rec.value,
        ttl: 3600,
        priority: rec.priority,
        isSystem: true,
      });
    }

    await this.rewriteZoneFile(zone.id);
    logger.info({ domainId }, 'DNS reset to defaults');

    auditService.log({
      userId,
      action: 'dns.reset-to-defaults',
      resource: `domain:${domainId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Get the raw zone file content
   */
  async getRawZone(domainId: string): Promise<string> {
    const { zone, records } = await this.getZone(domainId);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    let content = `$ORIGIN ${domain.name}.\n`;
    content += `$TTL ${zone.ttl}\n`;
    content += `@   IN  SOA ${zone.primaryNs}. ${zone.adminEmail}. (\n`;
    content += `        ${zone.serial}  ; Serial\n`;
    content += `        ${zone.refresh}  ; Refresh\n`;
    content += `        ${zone.retry}    ; Retry\n`;
    content += `        ${zone.expire}  ; Expire\n`;
    content += `        ${zone.minimumTtl}  ; Minimum TTL\n`;
    content += `    )\n\n`;

    for (const rec of records) {
      const priority = rec.priority ? `${rec.priority} ` : '';
      content += `${rec.name}   ${rec.ttl || ''}   IN  ${rec.type}   ${priority}${rec.value}\n`;
    }

    return content;
  }

  /**
   * Check DNS propagation against public resolvers
   */
  async checkPropagation(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const resolvers = [
      { name: 'Google', ip: '8.8.8.8' },
      { name: 'Cloudflare', ip: '1.1.1.1' },
      { name: 'Quad9', ip: '9.9.9.9' },
      { name: 'OpenDNS', ip: '208.67.222.222' },
    ];

    // Get expected A record from local zone
    const { records } = await this.getZone(domainId);
    const expectedA = records.find(r => r.type === 'A' && r.name === '@')?.value;
    const expectedMx = records.filter(r => r.type === 'MX' && r.name === '@').map(r => r.value);

    const results = await Promise.allSettled(
      resolvers.map(async (resolver) => {
        const start = Date.now();
        const result: any = {
          resolver: resolver.name,
          ip: resolver.ip,
          aRecords: [] as string[],
          mxRecords: [] as string[],
          aMatches: false,
          mxMatches: false,
          latencyMs: 0,
          error: null as string | null,
        };

        try {
          // Query A record using system resolver (configured to use specific DNS)
          const aResult = await run('dig', ['+short', domain.name, 'A', `@${resolver.ip}`, '+timeout=5']);
          result.latencyMs = Date.now() - start;
          if (aResult.success && aResult.stdout.trim()) {
            result.aRecords = aResult.stdout.trim().split('\n');
            result.aMatches = expectedA ? result.aRecords.includes(expectedA) : false;
          }
        } catch (e: any) {
          result.error = e.message;
        }

        try {
          const mxResult = await run('dig', ['+short', domain.name, 'MX', `@${resolver.ip}`, '+timeout=5']);
          if (mxResult.success && mxResult.stdout.trim()) {
            result.mxRecords = mxResult.stdout.trim().split('\n');
            result.mxMatches = expectedMx.length > 0
              ? expectedMx.some(mx => result.mxRecords.some((r: string) => r.includes(mx)))
              : true;
          }
        } catch {
          // MX check failure is non-critical
        }

        return result;
      }),
    );

    return results.map((r, i) => r.status === 'fulfilled' ? r.value : {
      resolver: resolvers[i].name,
      ip: resolvers[i].ip,
      aRecords: [],
      mxRecords: [],
      aMatches: false,
      mxMatches: false,
      latencyMs: 0,
      error: r.reason?.message || 'Failed to check',
    });
  }

  /**
   * Update SOA record for a domain's DNS zone
   */
  async updateSoa(domainId: string, data: {
    primaryNs?: string;
    adminEmail?: string;
    refresh?: number;
    retry?: number;
    expire?: number;
    minimumTtl?: number;
  }) {
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'DNS zone not found');

    const updateData: Record<string, unknown> = {};
    if (data.primaryNs !== undefined) updateData.primaryNs = data.primaryNs;
    if (data.adminEmail !== undefined) updateData.adminEmail = data.adminEmail;
    if (data.refresh !== undefined) updateData.refresh = data.refresh;
    if (data.retry !== undefined) updateData.retry = data.retry;
    if (data.expire !== undefined) updateData.expire = data.expire;
    if (data.minimumTtl !== undefined) updateData.minimumTtl = data.minimumTtl;

    await db.update(dnsZones).set(updateData).where(eq(dnsZones.id, zone.id));
    await this.rewriteZoneFile(zone.id);

    logger.info({ domainId }, 'SOA record updated');
    return { success: true };
  }

  /**
   * Get Cloudflare DNS configuration for a domain
   */
  async getCloudflareConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Return default/empty config — real implementation would store/retrieve from DB or config file
    return {
      enabled: false,
      apiToken: '',
      zoneId: '',
      zoneName: domain.name,
      lastSyncAt: null,
    };
  }

  /**
   * Update Cloudflare DNS configuration for a domain
   */
  async updateCloudflareConfig(domainId: string, data: {
    enabled?: boolean;
    apiToken?: string;
    zoneId?: string;
    zoneName?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // In a real implementation, this would persist to a cloudflare_config table
    logger.info({ domainId, enabled: data.enabled }, 'Cloudflare config updated');
    return {
      enabled: data.enabled ?? false,
      apiToken: data.apiToken ?? '',
      zoneId: data.zoneId ?? '',
      zoneName: domain.name,
      lastSyncAt: null,
    };
  }

  /**
   * Sync DNS records with Cloudflare
   */
  async syncCloudflareRecords(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // In a real implementation, this would use the Cloudflare API to sync records
    logger.info({ domainId }, 'Cloudflare DNS sync requested');
    return {
      synced: true,
      recordsProcessed: 0,
      message: 'Cloudflare sync is not yet fully configured',
    };
  }

  /**
   * Delete a DNS zone and all its records for a domain
   */
  async deleteZone(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (!zone) {
      logger.info({ domainId }, 'No DNS zone to delete');
      return;
    }

    // Delete all DNS records
    await db.delete(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));

    // Delete zone record
    await db.delete(dnsZones).where(eq(dnsZones.id, zone.id));

    // Remove zone file from disk
    const zonePath = `${env.BIND_ZONES_DIR}/db.${domain.name}`;
    await run('rm', ['-f', zonePath], { sudo: true }).catch(() => {});

    // Remove entry from named.conf.local (best-effort)
    try {
      const namedConf = '/etc/bind/named.conf.local';
      const content = await sudoFs.readFile(namedConf);
      const zoneBlockRegex = new RegExp(
        `\\s*zone\\s+"${domain.name.replace(/\./g, '\\.')}\\.?"\\s*\\{[^}]*\\};?\\s*`,
        'g'
      );
      const updated = content.replace(zoneBlockRegex, '\n');
      await sudoFs.writeFile(namedConf, updated);
    } catch {
      // named.conf.local may not exist or zone block not found
    }

    // Reload BIND (best-effort)
    await bindService.reload().catch(() => {});

    logger.info({ domainId, domain: domain.name }, 'DNS zone deleted');

    auditService.log({
      userId,
      action: 'dns.zone.delete',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  // --- Public Helpers ---

  /**
   * Regenerate the BIND zone file from DB records and reload BIND.
   * Can be called from other services (e.g. mail) after inserting DNS records.
   */
  async syncZoneToDisk(zoneId: string) {
    await this.rewriteZoneFile(zoneId);
  }

  // --- Private Helpers ---

  private async rewriteZoneFile(zoneId: string) {
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.id, zoneId)).limit(1);
    if (!zone) return;

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zoneId));
    const [domain] = await db.select().from(domains).where(eq(domains.id, zone.domainId)).limit(1);
    if (!domain) return;

    // Bump serial
    const newSerial = Math.floor(Date.now() / 1000);
    await db.update(dnsZones).set({ serial: newSerial }).where(eq(dnsZones.id, zoneId));

    // Generate zone file content directly
    const serverIp = records.find(r => r.type === 'A' && r.name === '@')?.value || '127.0.0.1';

    let content = `$ORIGIN ${domain.name}.\n`;
    content += `$TTL ${zone.ttl}\n`;
    content += `@   IN  SOA ${zone.primaryNs}. ${zone.adminEmail}. (\n`;
    content += `        ${newSerial}  ; Serial\n`;
    content += `        ${zone.refresh}  ; Refresh\n`;
    content += `        ${zone.retry}    ; Retry\n`;
    content += `        ${zone.expire}  ; Expire\n`;
    content += `        ${zone.minimumTtl}  ; Minimum TTL\n`;
    content += `    )\n\n`;

    for (const rec of records) {
      const priority = rec.priority ? `${rec.priority} ` : '';
      content += `${rec.name}   ${rec.ttl || ''}   IN  ${rec.type}   ${priority}${rec.value}\n`;
    }

    await bindService.writeZoneFile(domain.name, content);
  }

  private parseBindFormat(text: string): Array<{ type: string; name: string; value: string; ttl?: number; priority?: number }> {
    const records: Array<{ type: string; name: string; value: string; ttl?: number; priority?: number }> = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('$')) continue;

      // Match: name [ttl] IN type [priority] value
      const match = trimmed.match(/^(\S+)\s+(\d+\s+)?IN\s+(A|AAAA|CNAME|MX|TXT|NS|SRV|CAA|PTR)\s+(?:(\d+)\s+)?(.+)$/i);
      if (match) {
        records.push({
          name: match[1],
          ttl: match[2] ? parseInt(match[2].trim()) : undefined,
          type: match[3].toUpperCase(),
          priority: match[4] ? parseInt(match[4]) : undefined,
          value: match[5].trim(),
        });
      }
    }

    return records;
  }
}
