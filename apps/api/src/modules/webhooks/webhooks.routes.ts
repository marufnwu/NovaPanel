import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { webhooksService } from './webhooks.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createWebhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
});

export default async function webhooksRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/organizations/:orgId/webhooks', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const items = await webhooksService.list(orgId);
    return { success: true, data: items };
  });

  fastify.post('/organizations/:orgId/webhooks', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const data = createWebhookSchema.parse(req.body);
    const webhook = await webhooksService.create(orgId, data);
    return reply.status(201).send({ success: true, data: webhook });
  });

  fastify.get('/webhooks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const webhook = await webhooksService.get(id);
    if (!webhook) return { success: false, error: 'Webhook not found' };
    return { success: true, data: webhook };
  });

  fastify.put('/webhooks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateWebhookSchema.parse(req.body);
    const webhook = await webhooksService.update(id, data);
    return { success: true, data: webhook };
  });

  fastify.delete('/webhooks/:id', async (req) => {
    const { id } = req.params as { id: string };
    await webhooksService.delete(id);
    return { success: true };
  });

  fastify.post('/webhooks/:id/regenerate-secret', async (req) => {
    const { id } = req.params as { id: string };
    const secret = await webhooksService.regenerateSecret(id);
    return { success: true, data: { secret } };
  });

  fastify.get('/webhooks/:id/deliveries', async (req) => {
    const { id } = req.params as { id: string };
    const deliveries = await webhooksService.listDeliveries(id);
    return { success: true, data: deliveries };
  });

  fastify.post('/organizations/:orgId/webhooks/trigger', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const { event, payload } = z.object({
      event: z.string().min(1),
      payload: z.record(z.unknown()),
    }).parse(req.body);
    await webhooksService.triggerEvent(orgId, event, payload as Record<string, unknown>);
    return reply.status(202).send({ success: true });
  });
}