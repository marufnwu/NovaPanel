import type { FastifyInstance } from 'fastify';
import { DomainsService } from './domains.service.js';
import { createDomainSchema, updateDomainSchema, verifyDomainDnsSchema, createSubdomainSchema, createAliasSchema, createRedirectSchema, makePublicSchema, updateNameserversSchema, domainLogsQuerySchema } from './domains.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { detectNetworkInfo, verifyDomainPointsToIp, verifyNameserverResolvable } from '../../utils/network.js';
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
    const networkInfo = await detectNetworkInfo();
    const serverIp = networkInfo.primaryIp;
    if (serverIp) {
      const verification = await verifyDomainPointsToIp(data.name, serverIp);
      if (!verification.pointsToServer) {
        const errorMessage = verification.error || `Domain ${data.name} does not point to this server. Expected IP: ${serverIp}, found: ${verification.resolvesTo.join(', ') || 'none'}.`;
        throw new AppError(400, verification.errorCode || 'DOMAIN_DNS_NOT_POINTING', errorMessage);
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
    return {
      success: true,
      data: {
        domain,
        serverIp,
        resolvesTo: verification.resolvesTo,
        pointsToServer: verification.pointsToServer,
        error: verification.error,
        errorCode: verification.errorCode,
        nameservers: verification.nameservers,
        nameserverAddresses: verification.nameserverAddresses,
      }
    };
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

  // --- Subdomains ---

  fastify.get('/:domainId/subdomains', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const subdomains = await service.listSubdomains(domainId);
    return { success: true, data: subdomains };
  });

  fastify.post('/:domainId/subdomains', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const data = createSubdomainSchema.parse(req.body);
    const subdomain = await service.createSubdomain(domainId, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: subdomain });
  });

  fastify.delete('/:domainId/subdomains/:subdomainId', async (req) => {
    const { domainId, subdomainId } = req.params as { domainId: string; subdomainId: string };
    await service.deleteSubdomain(domainId, subdomainId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Aliases ---

  fastify.get('/:domainId/aliases', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const aliases = await service.listAliases(domainId);
    return { success: true, data: aliases };
  });

  fastify.post('/:domainId/aliases', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const data = createAliasSchema.parse(req.body);
    const alias = await service.createAlias(domainId, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: alias });
  });

  fastify.delete('/:domainId/aliases/:aliasId', async (req) => {
    const { domainId, aliasId } = req.params as { domainId: string; aliasId: string };
    await service.deleteAlias(domainId, aliasId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Redirects ---

  fastify.get('/:domainId/redirects', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const redirects = await service.listRedirects(domainId);
    return { success: true, data: redirects };
  });

  fastify.post('/:domainId/redirects', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const data = createRedirectSchema.parse(req.body);
    const redirect = await service.createRedirect(domainId, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: redirect });
  });

  fastify.delete('/:domainId/redirects/:redirectId', async (req) => {
    const { domainId, redirectId } = req.params as { domainId: string; redirectId: string };
    await service.deleteRedirect(domainId, redirectId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // --- Domain Actions ---

  fastify.post('/:domainId/make-primary', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const result = await service.makePrimary(domainId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/:domainId/logs', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const query = domainLogsQuerySchema.parse(req.query);
    const logs = await service.getLogs(domainId, query.lines);
    return { success: true, data: logs };
  });

  fastify.get('/:domainId/logs/access', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const { lines } = domainLogsQuerySchema.parse(req.query);
    const logs = await service.getLogs(domainId, lines);
    return { success: true, data: logs.accessLog };
  });

  fastify.get('/:domainId/logs/error', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const { lines } = domainLogsQuerySchema.parse(req.query);
    const logs = await service.getLogs(domainId, lines);
    return { success: true, data: logs.errorLog };
  });

  fastify.put('/:domainId/make-public', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const data = makePublicSchema.parse(req.body);
    const result = await service.setPublic(domainId, data, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // --- Cloudflare Zone for Domain ---
  fastify.get('/:domainId/cloudflare-zone', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const result = await service.getCloudflareZone(domainId);
    return { success: true, data: result };
  });

  // --- Nameservers ---
  fastify.get('/:domainId/nameservers', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const result = await service.getNameservers(domainId);
    return { success: true, data: result };
  });

  fastify.put('/:domainId/nameservers', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const data = updateNameserversSchema.parse(req.body);
    const result = await service.updateNameservers(domainId, data.nameservers, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // GET /:domainId/nameservers/verify - verify glue records without saving
  fastify.get('/:domainId/nameservers/verify', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const result = await service.getNameservers(domainId);
    const nsList = result.nameservers || [];
    const verificationResults = await Promise.all(nsList.map((ns: string) => verifyNameserverResolvable(ns)));
    return {
      success: true,
      data: {
        nameservers: nsList,
        results: verificationResults,
        allResolvable: verificationResults.every((r: any) => r.isResolvable),
      },
    };
  });
}