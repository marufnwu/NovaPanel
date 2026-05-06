import type { FastifyInstance } from 'fastify';
import { TunnelService } from './tunnel.service.js';
import { setupTunnelSchema, addRouteSchema, editRouteSchema } from './tunnel.schema.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function tunnelRoutes(fastify: FastifyInstance) {
  const service = new TunnelService();
  fastify.addHook('preHandler', requireAuth);

  // GET /tunnel/status
  fastify.get('/tunnel/status', async () => {
    return { success: true, data: await service.getStatus() };
  });

  // POST /tunnel/validate-token — Validate Cloudflare API token
  fastify.post('/tunnel/validate-token', async (req) => {
    const { apiToken } = req.body as { apiToken: string };
    return { success: true, data: await service.validateToken(apiToken) };
  });

  // POST /tunnel/fetch-zones — Fetch Cloudflare zones
  fastify.post('/tunnel/fetch-zones', async (req) => {
    const { apiToken, accountId } = req.body as { apiToken: string; accountId?: string };
    return { success: true, data: await service.fetchZones(apiToken, accountId) };
  });

  // GET /tunnel/:id/info — Get detailed tunnel information
  fastify.get('/tunnel/:id/info', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getTunnelInfo(id) };
  });

  // GET /tunnel/:id/config — Get tunnel configuration as JSON
  fastify.get('/tunnel/:id/config', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getTunnelConfig(id) };
  });

  // POST /tunnel/setup — Create and configure tunnel (admin)
  fastify.post('/tunnel/setup', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = setupTunnelSchema.parse(req.body);
      return { success: true, data: await service.setup(data.name, data.apiToken, data.accountId, data.zoneId, req.user.id, req.ip) };
    },
  });

  // DELETE /tunnel/:id — Delete tunnel (admin)
  fastify.delete('/tunnel/:id', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      return { success: true, data: await service.deleteTunnel(id, req.user.id, req.ip) };
    },
  });

  // POST /tunnel/start (admin)
  fastify.post('/tunnel/start', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      return { success: true, data: await service.start(req.user.id, req.ip) };
    },
  });

  // POST /tunnel/stop (admin)
  fastify.post('/tunnel/stop', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      return { success: true, data: await service.stop(req.user.id, req.ip) };
    },
  });

  // GET /tunnel/routes
  fastify.get('/tunnel/routes', async () => {
    return { success: true, data: await service.listRoutes() };
  });

  // POST /tunnel/routes — Add route
  fastify.post('/tunnel/routes', async (req) => {
    const data = addRouteSchema.parse(req.body);
    return { success: true, data: await service.addRoute(data, req.user.id, req.ip) };
  });

  // PUT /tunnel/routes/:id — Edit route
  fastify.put('/tunnel/routes/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = editRouteSchema.parse(req.body);
    return { success: true, data: await service.editRoute(id, data, req.user.id, req.ip) };
  });

  // DELETE /tunnel/routes/:id
  fastify.delete('/tunnel/routes/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteRoute(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /tunnel/routes/:id/toggle
  fastify.post('/tunnel/routes/:id/toggle', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.toggleRoute(id, req.user.id, req.ip) };
  });

  // POST /tunnel/:id/sync-routes — Sync remote routes from Cloudflare API into local DB
  fastify.post('/tunnel/:id/sync-routes', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.syncRemoteRoutes(id, req.user.id, req.ip) };
  });

  // POST /tunnel/dns/cname — Create DNS CNAME record
  fastify.post('/tunnel/dns/cname', async (req, reply) => {
    const { zoneId, hostname, target } = req.body as { zoneId: string; hostname: string; target: string };
    try {
      const result = await service.createPublicDnsCname(zoneId, hostname, target);
      return { success: true, data: result };
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({ success: false, error: error.message || 'Failed to create DNS CNAME' });
    }
  });
}
