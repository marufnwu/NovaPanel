import type { FastifyInstance } from 'fastify';
import { DomainsService } from './domains.service.js';
import { createDomainSchema, updateDomainSchema, createSubdomainSchema, createAliasSchema, createRedirectSchema, verifyDomainDnsSchema } from './domains.schema.js';
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
    const { page, perPage, search } = req.query as any;
    const result = await service.list({ page, perPage, search });
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

    const domain = await service.create({
      ...data,
      userId: req.user.id,
      ipAddress: req.ip,
    });
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
    const domain = await service.update(id, { ...data, userId: req.user.id, ipAddress: req.ip });
    return { success: true, data: domain };
  });

  // DELETE /api/v1/domains/:id — Delete domain
  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.delete(id, req.user.id, req.ip);
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

  // POST /api/v1/domains/:id/make-primary
  // Promote an addon domain to be the primary domain of its website
  fastify.post('/:id/make-primary', async (req) => {
    const { id } = req.params as { id: string };
    const result = await service.makePrimary(id, req.user.id, req.ip);
    return { success: true, data: result };
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
    const sub = await service.createSubdomain(id, { ...data, userId: req.user.id, ipAddress: req.ip });
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
    const item = await service.createAlias(id, { alias, userId: req.user.id, ipAddress: req.ip });
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
    const item = await service.createRedirect(id, { 
      name: data.sourcePath, 
      redirectTarget: data.targetUrl, 
      userId: req.user.id, 
      ipAddress: req.ip 
    });
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

  
}
