import type { FastifyInstance } from 'fastify';
import { DomainsService } from './domains.service.js';
import { createDomainSchema, updateDomainSchema, deleteDomainSchema, createSubdomainSchema, createAliasSchema, createRedirectSchema, verifyDomainDnsSchema } from './domains.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { detectNetworkInfo } from '../../utils/network.js';
import { verifyDomainPointsToIp } from '../../utils/network.js';
import { AppError } from '../../errors.js';

export default async function domainRoutes(fastify: FastifyInstance) {
  const service = new DomainsService();

  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/domains — List all domains
  fastify.get('/', async (req) => {
    const { page, perPage, search, status } = req.query as any;
    const result = await service.list({ page, perPage, search, status });
    return { success: true, data: result.items };
  });

  // POST /api/v1/domains — Create domain
  fastify.post('/', async (req, reply) => {
    const data = createDomainSchema.parse(req.body);

    // Verify domain DNS points to this server unless skipDnsVerification is true
    if (!data.skipDnsVerification) {
      const networkInfo = await detectNetworkInfo();
      const serverIp = networkInfo.primaryIp;

      if (serverIp) {
        const verification = await verifyDomainPointsToIp(data.name, serverIp);
        if (!verification.pointsToServer) {
          throw new AppError(
            400,
            'DOMAIN_DNS_NOT_POINTING',
            `Domain ${data.name} does not point to this server. Expected IP: ${serverIp}, found: ${verification.resolvesTo.join(', ') || 'none'}. Please ensure your domain's A record points to this server's IP address.`,
          );
        }
      }
    }

    const domain = await service.create({ ...data, userId: req.user.id, ipAddress: req.ip });
    return reply.status(201).send({ success: true, data: domain });
  });

  // GET /api/v1/domains/verify-dns — Verify domain DNS points to this server
  fastify.get('/verify-dns', async (req) => {
    const { domain } = verifyDomainDnsSchema.parse(req.query);
    const networkInfo = await detectNetworkInfo();
    const serverIp = networkInfo.primaryIp;

    if (!serverIp) {
      return {
        success: false,
        error: 'Could not determine server IP address',
        data: null,
      };
    }

    const verification = await verifyDomainPointsToIp(domain, serverIp);
    return {
      success: true,
      data: {
        domain,
        serverIp,
        resolvesTo: verification.resolvesTo,
        pointsToServer: verification.pointsToServer,
        error: verification.error,
      },
    };
  });

  // GET /api/v1/domains/:id — Get domain detail
  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const domain = await service.get(id);
    return { success: true, data: domain };
  });

  // PUT /api/v1/domains/:id — Update domain
  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateDomainSchema.parse(req.body);
    const domain = await service.update(id, data, req.user.id, req.ip);
    return { success: true, data: domain };
  });

  // DELETE /api/v1/domains/:id — Delete domain
  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { deleteWebsite = false } = req.body
      ? deleteDomainSchema.parse(req.body)
      : { deleteWebsite: false };
    await service.delete(id, deleteWebsite, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /api/v1/domains/:id/suspend
  fastify.post('/:id/suspend', async (req) => {
    const { id } = req.params as { id: string };
    await service.suspend(id, req.user.id, req.ip);
    return { success: true, data: { status: 'suspended' } };
  });

  // POST /api/v1/domains/:id/activate
  fastify.post('/:id/activate', async (req) => {
    const { id } = req.params as { id: string };
    await service.activate(id, req.user.id, req.ip);
    return { success: true, data: { status: 'active' } };
  });

  // --- Subdomains ---
  fastify.get('/:id/subdomains', async (req) => {
    const { id } = req.params as { id: string };
    const items = await service.listSubdomains(id);
    return { success: true, data: items };
  });

  fastify.post('/:id/subdomains', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createSubdomainSchema.parse(req.body);
    const sub = await service.createSubdomain(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: sub });
  });

  fastify.delete('/:id/subdomains/:subId', async (req) => {
    const { id, subId } = req.params as { id: string; subId: string };
    await service.deleteSubdomain(id, subId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Aliases ---
  fastify.get('/:id/aliases', async (req) => {
    const { id } = req.params as { id: string };
    const items = await service.listAliases(id);
    return { success: true, data: items };
  });

  fastify.post('/:id/aliases', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { alias } = createAliasSchema.parse(req.body);
    const item = await service.createAlias(id, alias, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: item });
  });

  fastify.delete('/:id/aliases/:aliasId', async (req) => {
    const { id, aliasId } = req.params as { id: string; aliasId: string };
    await service.deleteAlias(id, aliasId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Redirects ---
  fastify.get('/:id/redirects', async (req) => {
    const { id } = req.params as { id: string };
    const items = await service.listRedirects(id);
    return { success: true, data: items };
  });

  fastify.post('/:id/redirects', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createRedirectSchema.parse(req.body);
    const item = await service.createRedirect(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: item });
  });

  fastify.delete('/:id/redirects/:redirectId', async (req) => {
    const { id, redirectId } = req.params as { id: string; redirectId: string };
    await service.deleteRedirect(id, redirectId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Domain Log Stats ---
  fastify.get('/:id/logs/stats', async (req) => {
    const { id } = req.params as { id: string };
    try {
      const stats = await service.getLogStats(id);
      return { success: true, data: stats };
    } catch (error: any) {
      return { success: true, data: { totalRequests: 0, errorCount: 0, errorRate: 0, topUrls: [] } };
    }
  });

  // --- Domain Log Access ---
  fastify.get('/:id/logs/access', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as { lines?: string };
    const lines = parseInt(query.lines || '100') || 100;
    try {
      const log = await service.getAccessLog(id, lines);
      return { success: true, data: { log } };
    } catch (error: any) {
      return { success: true, data: { log: '' } };
    }
  });

  // --- Domain Error Log ---
  fastify.get('/:id/logs/error', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as { lines?: string };
    const lines = parseInt(query.lines || '100') || 100;
    try {
      const log = await service.getErrorLog(id, lines);
      return { success: true, data: { log } };
    } catch (error: any) {
      return { success: true, data: { log: '' } };
    }
  });

  // --- Cloudflare Status ---
  fastify.get('/:id/cloudflare-status', async (req) => {
    const { id } = req.params as { id: string };
    const status = await service.getCloudflareStatus(id);
    return { success: true, data: status };
  });

  // --- Cloudflare Zone (linked zone for this domain) ---
  fastify.get('/:id/cloudflare-zone', async (req) => {
    const { id } = req.params as { id: string };
    const zone = await service.getCloudflareZoneForDomain(id);
    return { success: true, data: zone };
  });

  // --- Cloudflare DNS Records for this domain's zone ---
  fastify.get('/:id/cloudflare/dns', async (req) => {
    const { id } = req.params as { id: string };
    const { type, name, page, perPage } = req.query as any;
    const data = await service.getCloudflareDnsForDomain(id, { type, name, page, perPage });
    return { success: true, data };
  });

  // POST /api/v1/domains/:id/cloudflare/dns — Create DNS record
  fastify.post('/:id/cloudflare/dns', async (req) => {
    const { id } = req.params as { id: string };
    const { type, name, content, proxied, ttl, priority } = req.body as any;
    const data = await service.createCloudflareDnsRecord(id, { type, name, content, proxied, ttl, priority }, req.user.id, req.ip);
    return { success: true, data };
  });

  // DELETE /api/v1/domains/:id/cloudflare/dns/:recordId — Delete DNS record
  fastify.delete('/:id/cloudflare/dns/:recordId', async (req) => {
    const { id, recordId } = req.params as { id: string; recordId: string };
    await service.deleteCloudflareDnsRecord(id, recordId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Cloudflare SSL Settings for this domain's zone ---
  fastify.get('/:id/cloudflare/ssl', async (req) => {
    const { id } = req.params as { id: string };
    const data = await service.getCloudflareSslForDomain(id);
    return { success: true, data };
  });

  // PUT /api/v1/domains/:id/cloudflare/ssl — Update SSL settings
  fastify.put('/:id/cloudflare/ssl', async (req) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    const result = await service.updateCloudflareSslForDomain(id, data, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // --- Cloudflare Firewall Rules for this domain's zone ---
  fastify.get('/:id/cloudflare/firewall', async (req) => {
    const { id } = req.params as { id: string };
    const data = await service.getCloudflareFirewallForDomain(id);
    return { success: true, data };
  });

  // POST /api/v1/domains/:id/cloudflare/firewall — Create firewall rule
  fastify.post('/:id/cloudflare/firewall', async (req) => {
    const { id } = req.params as { id: string };
    const { action, expression, description } = req.body as any;
    const data = await service.createCloudflareFirewallRule(id, { action, expression, description }, req.user.id, req.ip);
    return { success: true, data };
  });

  // DELETE /api/v1/domains/:id/cloudflare/firewall/:ruleId — Delete firewall rule
  fastify.delete('/:id/cloudflare/firewall/:ruleId', async (req) => {
    const { id, ruleId } = req.params as { id: string; ruleId: string };
    await service.deleteCloudflareFirewallRule(id, ruleId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Cloudflare Redirect Rules for this domain's zone ---
  fastify.get('/:id/cloudflare/redirects', async (req) => {
    const { id } = req.params as { id: string };
    const data = await service.getCloudflareRedirectsForDomain(id);
    return { success: true, data };
  });

  // POST /api/v1/domains/:id/cloudflare/redirects — Create redirect rule
  fastify.post('/:id/cloudflare/redirects', async (req) => {
    const { id } = req.params as { id: string };
    const { sourcePattern, destinationUrl, redirectType } = req.body as any;
    const data = await service.createCloudflareRedirectRule(id, { sourcePattern, destinationUrl, redirectType }, req.user.id, req.ip);
    return { success: true, data };
  });

  // DELETE /api/v1/domains/:id/cloudflare/redirects/:ruleId — Delete redirect rule
  fastify.delete('/:id/cloudflare/redirects/:ruleId', async (req) => {
    const { id, ruleId } = req.params as { id: string; ruleId: string };
    await service.deleteCloudflareRedirectRule(id, ruleId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Cloudflare Tunnel Route for this domain ---
  fastify.post('/:id/cloudflare/route', async (req) => {
    const { id } = req.params as { id: string };
    const data = await service.createCloudflareTunnelRoute(id, req.user.id, req.ip);
    return { success: true, data };
  });

  // DELETE /api/v1/domains/:id/cloudflare/route — Delete tunnel route
  fastify.delete('/:id/cloudflare/route', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteCloudflareTunnelRoute(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /api/v1/domains/:id/make-public — Make domain public (auto-create tunnel route + CNAME + SSL)
  fastify.post('/:id/make-public', async (req) => {
    const { id } = req.params as { id: string };
    const { tunnelId } = req.body as { tunnelId?: string };
    const result = await service.makeDomainPublic(id, tunnelId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // POST /api/v1/domains/check-conflict — Check if a domain is already in use
  fastify.post('/check-conflict', async (req) => {
    const { domain, type } = req.body as { domain: string; type?: 'primary' | 'alias' | 'subdomain' };
    
    if (!domain) {
      throw new AppError(400, 'DOMAIN_REQUIRED', 'Domain is required');
    }

    try {
      const result = await service.checkConflict(domain, type);
      return { success: true, data: result };
    } catch (error: any) {
      // If it's a conflict error (409), return the conflict info
      if (error.code === 'DOMAIN_ALREADY_EXISTS' || error.code === 'DOMAIN_IS_ALIAS' || error.code === 'SUBDOMAIN_IS_SITE') {
        return {
          success: false,
          available: false,
          reason: error.message,
          conflictType: error.details?.conflictType,
          siteId: error.details?.siteId,
          siteName: error.details?.siteName,
          domainId: error.details?.domainId,
        };
      }
      throw error;
    }
  });
}
