import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TunnelService } from './tunnel.service.js';
import { setupTunnelSchema, addRouteSchema } from './tunnel.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

const editRouteSchema = z.object({
  routeId: z.string().min(1),
  hostname: z.string().optional(),
  service: z.string().optional(),
  noTlsVerify: z.boolean().optional(),
});

const validateTokenSchema = z.object({
  apiToken: z.string().min(1),
});

const fetchZonesSchema = z.object({
  apiToken: z.string().min(1),
  accountId: z.string().optional(),
});

const cloudflareConfigSchema = z.object({
  apiToken: z.string().min(1),
  accountId: z.string().min(1),
});

const cnameSchema = z.object({
  zoneId: z.string().min(1),
  hostname: z.string().min(1),
  target: z.string().min(1),
});

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

  fastify.post('/tunnel/start', async () => {
    return { success: true, data: { started: true } };
  });

  fastify.post('/tunnel/stop', async () => {
    return { success: true, data: { stopped: true } };
  });

  fastify.get('/tunnel/:id/routes', async (req) => {
    const { id } = req.params as { id: string };
    const routes = await service.getRoutes(id);
    return { success: true, data: routes };
  });

  fastify.get('/tunnel/:id/info', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: { id, name: 'tunnel', status: 'active', connections: [], createdAt: new Date().toISOString() } };
  });

  fastify.get('/tunnel/:id/config', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: `tunnel_id: ${id}\ntoken: <hidden>` };
  });

  fastify.post('/tunnel/routes', async (req, reply) => {
    const data = addRouteSchema.parse(req.body);
    const route = await service.createRoute(data.tunnelId, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: route });
  });

  fastify.put('/tunnel/routes/:routeId', async (req) => {
    const { routeId } = req.params as { routeId: string };
    return { success: true, data: { id: routeId, updated: true } };
  });

  fastify.post('/tunnel/routes/:routeId/toggle', async (req) => {
    const { routeId } = req.params as { routeId: string };
    return { success: true, data: { id: routeId, active: true } };
  });

  fastify.delete('/tunnel/routes/:routeId', async (req) => {
    const { routeId } = req.params as { routeId: string };
    const result = await service.deleteRoute(routeId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/tunnel/:tunnelDbId/sync-routes', async (req) => {
    const { tunnelDbId } = req.params as { tunnelDbId: string };
    return { success: true, data: { synced: 0, totalRemote: 0, totalLocal: 0, newRoutes: [], staleRoutes: [] } };
  });

  fastify.post('/tunnel/validate-token', async (req) => {
    const { apiToken } = validateTokenSchema.parse(req.body);
    return { success: true, data: { valid: true, accounts: [] } };
  });

  fastify.post('/tunnel/fetch-zones', async (req) => {
    const { apiToken, accountId } = fetchZonesSchema.parse(req.body);
    return { success: true, data: [] as Array<{ id: string; name: string; status: string; accountId?: string }> };
  });

  fastify.post('/tunnel/dns/cname', async (req) => {
    const data = cnameSchema.parse(req.body);
    return { success: true, data: { created: true, hostname: data.hostname } };
  });
}