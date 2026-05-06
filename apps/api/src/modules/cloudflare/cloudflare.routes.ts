import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors.js';
import { CloudflareService } from './cloudflare.service.js';
import {
  linkZoneSchema,
  updateZoneSettingsSchema,
  createDnsRecordSchema,
  updateDnsRecordSchema,
  createFirewallRuleSchema,
  updateFirewallRuleSchema,
  createAccessRuleSchema,
  createRedirectRuleSchema,
  updateRedirectRuleSchema,
  purgeCacheSchema,
  applyMailPresetSchema,
} from './cloudflare.schema.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function cloudflareRoutes(fastify: FastifyInstance) {
  const service = new CloudflareService();
  fastify.addHook('preHandler', requireAuth);

  // =========================================================================
  // Zone Management
  // =========================================================================

  // GET /cloudflare/zones — List all linked zones
  fastify.get('/cloudflare/zones', async () => {
    return { success: true, data: await service.listLinkedZones() };
  });

  // POST /cloudflare/zones/list — List zones from Cloudflare API (requires apiToken)
  fastify.post('/cloudflare/zones/list', async (req) => {
    const { apiToken, page, perPage } = req.body as { apiToken: string; page?: number; perPage?: number };
    const data = await service.listZones(apiToken, page, perPage);
    return { success: true, data };
  });

  // POST /cloudflare/zones/link — Link a Cloudflare zone to NovaPanel
  fastify.post('/cloudflare/zones/link', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = linkZoneSchema.parse(req.body);
      return { success: true, data: await service.linkZone(data, req.user.id, req.ip) };
    },
  });

  // DELETE /cloudflare/zones/:id — Unlink a zone
  fastify.delete('/cloudflare/zones/:id', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      await service.unlinkZone(id, req.user.id, req.ip);
      return { success: true, data: null };
    },
  });

  // GET /cloudflare/zones/:id/overview — Zone overview (live from CF API)
  fastify.get('/cloudflare/zones/:id/overview', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getZoneOverview(id) };
  });

  // POST /cloudflare/zones/:id/pause — Pause Cloudflare proxy
  fastify.post('/cloudflare/zones/:id/pause', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      return { success: true, data: await service.togglePause(id, true, req.user.id, req.ip) };
    },
  });

  // POST /cloudflare/zones/:id/unpause — Unpause Cloudflare proxy
  fastify.post('/cloudflare/zones/:id/unpause', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      return { success: true, data: await service.togglePause(id, false, req.user.id, req.ip) };
    },
  });

  // =========================================================================
  // DNS Records
  // =========================================================================

  // GET /cloudflare/zones/:id/dns — List DNS records
  fastify.get('/cloudflare/zones/:id/dns', async (req) => {
    const { id } = req.params as { id: string };
    const { type, name, page, perPage } = req.query as any;
    const data = await service.listDnsRecords(id, { type, name, page, perPage });
    return { success: true, data };
  });

  // POST /cloudflare/zones/:id/dns — Create DNS record
  fastify.post('/cloudflare/zones/:id/dns', async (req) => {
    const { id } = req.params as { id: string };
    const data = createDnsRecordSchema.parse(req.body);
    return { success: true, data: await service.createDnsRecord(id, data, req.user.id, req.ip) };
  });

  // PUT /cloudflare/zones/:id/dns/:recordId — Update DNS record
  fastify.put('/cloudflare/zones/:id/dns/:recordId', async (req) => {
    const { id, recordId } = req.params as { id: string; recordId: string };
    const data = updateDnsRecordSchema.parse(req.body);
    return { success: true, data: await service.updateDnsRecord(id, recordId, data, req.user.id, req.ip) };
  });

  // DELETE /cloudflare/zones/:id/dns/:recordId — Delete DNS record
  fastify.delete('/cloudflare/zones/:id/dns/:recordId', async (req) => {
    const { id, recordId } = req.params as { id: string; recordId: string };
    await service.deleteDnsRecord(id, recordId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // =========================================================================
  // SSL/TLS Settings
  // =========================================================================

  // GET /cloudflare/zones/:id/ssl — Get SSL settings
  fastify.get('/cloudflare/zones/:id/ssl', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getSslSettings(id) };
  });

  // PUT /cloudflare/zones/:id/ssl — Update SSL settings
  fastify.put('/cloudflare/zones/:id/ssl', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const data = updateZoneSettingsSchema.parse(req.body);
      return { success: true, data: await service.updateSslSettings(id, data, req.user.id, req.ip) };
    },
  });

  // POST /cloudflare/zones/:id/ssl/origin-cert — Create Origin CA certificate
  fastify.post('/cloudflare/zones/:id/ssl/origin-cert', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const { hostnames, validityDays } = req.body as { hostnames: string[]; validityDays?: number };
      return { success: true, data: await service.createOriginCertificate(id, hostnames, validityDays, req.user.id, req.ip) };
    },
  });

  // =========================================================================
  // Zone Settings
  // =========================================================================

  // GET /cloudflare/zones/:id/settings — Get all zone settings
  fastify.get('/cloudflare/zones/:id/settings', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getZoneSettings(id) };
  });

  // =========================================================================
  // Cache Management
  // =========================================================================

  // POST /cloudflare/zones/:id/cache/purge — Purge cache
  fastify.post('/cloudflare/zones/:id/cache/purge', async (req) => {
    const { id } = req.params as { id: string };
    const data = purgeCacheSchema.parse(req.body);
    return { success: true, data: await service.purgeCache(id, data, req.user.id, req.ip) };
  });

  // =========================================================================
  // Firewall Rules
  // =========================================================================

  // GET /cloudflare/zones/:id/firewall — List firewall rules
  fastify.get('/cloudflare/zones/:id/firewall', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listFirewallRules(id) };
  });

  // POST /cloudflare/zones/:id/firewall — Create firewall rule
  fastify.post('/cloudflare/zones/:id/firewall', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const data = createFirewallRuleSchema.parse(req.body);
      return { success: true, data: await service.createFirewallRule(id, data, req.user.id, req.ip) };
    },
  });

  // DELETE /cloudflare/zones/:id/firewall/:ruleId — Delete firewall rule
  fastify.delete('/cloudflare/zones/:id/firewall/:ruleId', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id, ruleId } = req.params as { id: string; ruleId: string };
      await service.deleteFirewallRule(id, ruleId, req.user.id, req.ip);
      return { success: true, data: null };
    },
  });

  // GET /cloudflare/zones/:id/access-rules — List access rules
  fastify.get('/cloudflare/zones/:id/access-rules', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listAccessRules(id) };
  });

  // POST /cloudflare/zones/:id/access-rules — Create access rule
  fastify.post('/cloudflare/zones/:id/access-rules', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const data = createAccessRuleSchema.parse(req.body);
      return { success: true, data: await service.createAccessRule(id, data, req.user.id, req.ip) };
    },
  });

  // DELETE /cloudflare/zones/:id/access-rules/:ruleId — Delete access rule
  fastify.delete('/cloudflare/zones/:id/access-rules/:ruleId', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id, ruleId } = req.params as { id: string; ruleId: string };
      await service.deleteAccessRule(id, ruleId, req.user.id, req.ip);
      return { success: true, data: null };
    },
  });

  // =========================================================================
  // Redirect Rules
  // =========================================================================

  // GET /cloudflare/zones/:id/redirects — List redirect rules
  fastify.get('/cloudflare/zones/:id/redirects', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listRedirectRules(id) };
  });

  // POST /cloudflare/zones/:id/redirects — Create redirect rule
  fastify.post('/cloudflare/zones/:id/redirects', async (req) => {
    const { id } = req.params as { id: string };
    const data = createRedirectRuleSchema.parse(req.body);
    return { success: true, data: await service.createRedirectRule(id, data, req.user.id, req.ip) };
  });

  // DELETE /cloudflare/zones/:id/redirects/:ruleId — Delete redirect rule
  fastify.delete('/cloudflare/zones/:id/redirects/:ruleId', async (req) => {
    const { id, ruleId } = req.params as { id: string; ruleId: string };
    await service.deleteRedirectRule(id, ruleId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // =========================================================================
  // Mail DNS Presets
  // =========================================================================

  // POST /cloudflare/zones/:id/mail-preset — Apply mail provider preset
  fastify.post('/cloudflare/zones/:id/mail-preset', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const data = applyMailPresetSchema.parse(req.body);
      return { success: true, data: await service.applyMailPreset(id, data.provider, data.customRecords, req.user.id, req.ip) };
    },
  });

  // =========================================================================
  // Verification
  // =========================================================================

  // GET /cloudflare/zones/:id/verify — Verify DNS setup
  fastify.get('/cloudflare/zones/:id/verify', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.verifyDns(id) };
  });

  // GET /cloudflare/zones/:id/verify-full — End-to-end domain verification
  fastify.get('/cloudflare/zones/:id/verify-full', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.verifyDomainSetup(id) };
  });

  // =========================================================================
  // Wildcard Subdomain Support
  // =========================================================================

  // GET /cloudflare/zones/:id/wildcard — Get wildcard status
  fastify.get('/cloudflare/zones/:id/wildcard', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getWildcardStatus(id) };
  });

  // POST /cloudflare/zones/:id/wildcard/enable — Enable wildcard subdomain
  fastify.post('/cloudflare/zones/:id/wildcard/enable', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const { domainId } = req.body as { domainId?: string };
      if (!domainId) throw new AppError(400, 'DOMAIN_ID_REQUIRED', 'domainId is required');
      return { success: true, data: await service.enableWildcard(id, domainId, req.user.id, req.ip) };
    },
  });

  // POST /cloudflare/zones/:id/wildcard/disable — Disable wildcard subdomain
  fastify.post('/cloudflare/zones/:id/wildcard/disable', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      return { success: true, data: await service.disableWildcard(id, req.user.id, req.ip) };
    },
  });

  // =========================================================================
  // Domain Cloudflare Status (for domain list/detail pages)
  // =========================================================================

  // GET /cloudflare/domain-status/:domainId — Get CF status for a domain
  fastify.get('/cloudflare/domain-status/:domainId', async (req) => {
    const { domainId } = req.params as { domainId: string };
    return { success: true, data: await service.getDomainCloudflareStatus(domainId) };
  });

  // GET /cloudflare/domain-status — Get CF status for all domains
  fastify.get('/cloudflare/domain-status', async () => {
    return { success: true, data: await service.getAllDomainCloudflareStatus() };
  });
}
