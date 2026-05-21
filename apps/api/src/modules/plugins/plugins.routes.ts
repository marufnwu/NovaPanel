import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pluginsService } from './plugins.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createPluginSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  manifest: z.record(z.unknown()).default({}),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const updatePluginSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  manifest: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export default async function pluginsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/plugins', async () => {
    const items = await pluginsService.list();
    return { success: true, data: items };
  });

  fastify.post('/plugins', async (req, reply) => {
    const data = createPluginSchema.parse(req.body);
    const plugin = await pluginsService.create(data);
    return reply.status(201).send({ success: true, data: plugin });
  });

  fastify.get('/plugins/:id', async (req) => {
    const { id } = req.params as { id: string };
    const plugin = await pluginsService.get(id);
    if (!plugin) return { success: false, error: 'Plugin not found' };
    return { success: true, data: plugin };
  });

  fastify.put('/plugins/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updatePluginSchema.parse(req.body);
    const plugin = await pluginsService.update(id, data);
    return { success: true, data: plugin };
  });

  fastify.delete('/plugins/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pluginsService.delete(id);
    return { success: true };
  });

  fastify.post('/plugins/:id/toggle', async (req) => {
    const { id } = req.params as { id: string };
    const plugin = await pluginsService.toggle(id);
    return { success: true, data: plugin };
  });

  fastify.put('/plugins/:id/config', async (req) => {
    const { id } = req.params as { id: string };
    const { config } = z.object({ config: z.record(z.unknown()) }).parse(req.body);
    const plugin = await pluginsService.updateConfig(id, config);
    return { success: true, data: plugin };
  });
}