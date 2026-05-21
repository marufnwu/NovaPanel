import type { FastifyInstance } from 'fastify';
import { DomainsService } from './domains.service.js';
import { createDomainSchema, updateDomainSchema, verifyDomainDnsSchema } from './domains.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { detectNetworkInfo } from '../../utils/network.js';
import { verifyDomainPointsToIp } from '../../utils/network.js';
import { AppError } from '../../errors.js';

export default async function domainRoutes(fastify: FastifyInstance) {
  const service = new DomainsService();

  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const { page, perPage, search } = req.query as any;
    const result = await service.list({ page, perPage, search });
    return { success: true, data: result.items };
  });

  fastify.post('/', async (req, reply) => {
    const data = createDomainSchema.parse(req.body);
    if (!data.skipDnsVerification) {
      const networkInfo = await detectNetworkInfo();
      const serverIp = networkInfo.primaryIp;
      if (serverIp) {
        const verification = await verifyDomainPointsToIp(data.name, serverIp);
        if (!verification.pointsToServer) {
          throw new AppError(400, 'DOMAIN_DNS_NOT_POINTING', `Domain ${data.name} does not point to this server. Expected IP: ${serverIp}, found: ${verification.resolvesTo.join(', ') || 'none'}.`);
        }
      }
    }
    const domain = await service.create({ name: data.name, siteId: data.siteId, type: data.type, userId: req.user.id, ipAddress: req.ip });
    return reply.status(201).send({ success: true, data: domain });
  });

  fastify.get('/verify-dns', async (req) => {
    const { domain } = verifyDomainDnsSchema.parse(req.query);
    const networkInfo = await detectNetworkInfo();
    const serverIp = networkInfo.primaryIp;
    if (!serverIp) return { success: false, error: 'Could not determine server IP address', data: null };
    const verification = await verifyDomainPointsToIp(domain, serverIp);
    return { success: true, data: { domain, serverIp, resolvesTo: verification.resolvesTo, pointsToServer: verification.pointsToServer, error: verification.error } };
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const domain = await service.get(id);
    return { success: true, data: domain };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateDomainSchema.parse(req.body);
    const domain = await service.update(id, data, req.user.id, req.ip);
    return { success: true, data: domain };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.delete(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  fastify.post('/:id/suspend', async (req) => {
    const { id } = req.params as { id: string };
    await service.suspend(id, req.user.id, req.ip);
    return { success: true, data: { status: 'suspended' } };
  });

  fastify.post('/:id/activate', async (req) => {
    const { id } = req.params as { id: string };
    await service.unsuspend(id, req.user.id, req.ip);
    return { success: true, data: { status: 'active' } };
  });

  fastify.get('/:id/cloudflare-status', async (req) => {
    const { id } = req.params as { id: string };
    const status = await service.getCloudflareStatus(id);
    return { success: true, data: status };
  });
}