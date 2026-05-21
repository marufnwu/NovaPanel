import type { FastifyInstance } from 'fastify';
import { TunnelService } from './tunnel.service.js';
import { setupTunnelSchema, addRouteSchema } from './tunnel.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function tunnelRoutes(fastify: FastifyInstance) {
  const service = new TunnelService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/tunnel/status', async (req) => {
    const orgId = (req.query as { orgId?: string }).orgId;
    const tunnels = await service.listTunnels(orgId);
    return { success: true, data: { configured: !!tunnels.length, tunnels } };
  });

  fastify.get('/tunnel', async (req) => {
    const orgId = (req.query as { orgId?: string }).orgId;
    const tunnels = await service.listTunnels(orgId);
    return { success: true, data: tunnels };
  });

  fastify.post('/tunnel', async (req, reply) => {
    const data = setupTunnelSchema.parse(req.body);
    const tunnel = await service.createTunnel({ name: data.name, type: 'cloudflare' }, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: tunnel });
  });

  fastify.get('/tunnel/:id', async (req) => {
    const { id } = req.params as { id: string };
    const tunnel = await service.getTunnel(id);
    if (!tunnel) return { success: false, error: 'Tunnel not found' };
    return { success: true, data: tunnel };
  });

  fastify.delete('/tunnel/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await service.deleteTunnel(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/tunnel/:id/routes', async (req) => {
    const { id } = req.params as { id: string };
    const routes = await service.getRoutes(id);
    return { success: true, data: routes };
  });

  fastify.post('/tunnel/routes', async (req, reply) => {
    const data = addRouteSchema.parse(req.body);
    const route = await service.createRoute(data.tunnelId, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: route });
  });

  fastify.delete('/tunnel/routes/:routeId', async (req) => {
    const { routeId } = req.params as { routeId: string };
    const result = await service.deleteRoute(routeId, req.user.id, req.ip);
    return { success: true, data: result };
  });
}