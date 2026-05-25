import { db } from '../../db/index.js';
import { cloudflareTunnels } from '../../db/schema/cloudflare.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { CloudflareClient } from '../../services/cloudflare-client.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

interface TunnelRoute {
  id: string;
  tunnelId: string;
  hostname: string;
  service: string;
  type: string;
  createdAt: Date;
}

export class TunnelService {
  async listTunnels(orgId?: string) {
    const tunnels = await db.select().from(cloudflareTunnels).where(orgId ? eq(cloudflareTunnels.orgId, orgId) : undefined);
    return tunnels;
  }

  async getTunnel(id: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels).where(eq(cloudflareTunnels.id, id)).limit(1);
    return tunnel || null;
  }

  async createTunnel(data: { name: string; type: string }, userId?: string, ipAddress?: string) {
    if (!env.CF_API_TOKEN) throw new AppError(400, 'CF_NOT_CONFIGURED', 'Cloudflare API token not configured');
    if (data.type !== 'cloudflare') throw new AppError(400, 'UNSUPPORTED_TYPE', 'Only Cloudflare tunnels are supported');

    const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
    const result = await cf.createTunnel(data.name, env.CF_ACCOUNT_ID);
    const id = nanoid();

    await db.insert(cloudflareTunnels).values({
      id,
      orgId: 'default',
      name: data.name,
      tunnelToken: result.token,
      status: 'inactive',
    });

    auditService.log({ userId, action: 'tunnel.create', resource: `tunnel:${data.name}`, ipAddress }).catch(() => {});

    return this.getTunnel(id);
  }

  async deleteTunnel(id: string, userId?: string, ipAddress?: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels).where(eq(cloudflareTunnels.id, id)).limit(1);
    if (!tunnel) throw new AppError(404, 'NOT_FOUND', 'Tunnel not found');

    if (env.CF_API_TOKEN) {
      try {
        const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
        await cf.deleteTunnel(id, env.CF_ACCOUNT_ID);
      } catch (err) {
        logger.warn({ err, tunnelId: id }, 'Failed to delete Cloudflare tunnel');
      }
    }

    await db.delete(cloudflareTunnels).where(eq(cloudflareTunnels.id, id));

    auditService.log({ userId, action: 'tunnel.delete', resource: `tunnel:${id}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async getRoutes(_tunnelId: string): Promise<TunnelRoute[]> {
    return [];
  }

  async createRoute(tunnelId: string, data: { hostname: string; service: string; domainId?: string }, userId?: string, ipAddress?: string) {
    if (!env.CF_API_TOKEN) throw new AppError(400, 'CF_NOT_CONFIGURED', 'Cloudflare API token not configured');

    const [tunnel] = await db.select().from(cloudflareTunnels).where(eq(cloudflareTunnels.id, tunnelId)).limit(1);
    if (!tunnel) throw new AppError(404, 'NOT_FOUND', 'Tunnel not found');

    if (!data.domainId) throw new AppError(400, 'DOMAIN_REQUIRED', 'domainId required to create tunnel route');

    const [domain] = await db.select().from(domains).where(eq(domains.id, data.domainId)).limit(1);
    if (!domain) throw new AppError(404, 'NOT_FOUND', 'Domain not found');

    const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
    const zone = await cf.getZoneByName(domain.name);
    if (!zone) throw new AppError(404, 'CF_ZONE_NOT_FOUND', `Cloudflare zone not found for ${domain.name}`);

    const recordName = data.hostname === domain.name ? domain.name : `${data.hostname}.${domain.name}`;
    await cf.createDnsRecord(zone.id, {
      type: 'CNAME',
      name: recordName,
      content: `${tunnelId}.cloudflaretunnel.com`,
      proxied: true,
      ttl: 300,
    });

    auditService.log({ userId, action: 'tunnel.route.create', resource: `route:${recordName}`, ipAddress }).catch(() => {});

    return {
      id: nanoid(),
      tunnelId,
      hostname: recordName,
      service: data.service,
      type: 'cf_tunnel',
      createdAt: new Date(),
    };
  }

  async deleteRoute(routeId: string, userId?: string, _ipAddress?: string) {
    if (!env.CF_API_TOKEN) throw new AppError(400, 'CF_NOT_CONFIGURED', 'Cloudflare API token not configured');

    // routeId is actually the domainId since routes are identified by their associated domain
    const [domain] = await db.select().from(domains).where(eq(domains.id, routeId)).limit(1);
    if (!domain) throw new AppError(404, 'NOT_FOUND', 'Route not found');

    const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
    // Look up Cloudflare zone by domain name and find tunnel DNS records
    const zone = await cf.getZoneByName(domain.name);
    if (!zone) throw new AppError(404, 'CF_ZONE_NOT_FOUND', `Cloudflare zone not found for ${domain.name}`);

    // List CNAME records and find ones pointing to cloudflaretunnel.com
    const { records } = await cf.listDnsRecords(zone.id, { name: domain.name, type: 'CNAME' });
    const record = records.find(r => r.content.includes('.cloudflaretunnel.com'));
    if (record) {
      await cf.deleteDnsRecord(zone.id, record.id);
    }

    auditService.log({ userId, action: 'tunnel.route.delete', resource: `route:${routeId}`, ipAddress: _ipAddress }).catch(() => {});
    return { success: true };
  }
}

export const tunnelService = new TunnelService();