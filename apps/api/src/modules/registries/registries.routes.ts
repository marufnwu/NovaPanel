import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registriesService } from './registries.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createRegistrySchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(['dockerhub', 'ghcr', 'ecr', 'gcr', 'selfhosted']),
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const updateRegistrySchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export default async function registryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/list', async (req) => {
    const orgId = (req.query as { orgId?: string }).orgId;
    const items = await registriesService.list(orgId);
    return { success: true, data: items };
  });

  fastify.post('/', async (req, reply) => {
    const data = createRegistrySchema.parse(req.body);
    const registry = await registriesService.create(data);
    return reply.status(201).send({ success: true, data: registry });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const registry = await registriesService.get(id);
    if (!registry) return { success: false, error: 'Registry not found' };
    return { success: true, data: registry };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateRegistrySchema.parse(req.body);
    const registry = await registriesService.update(id, data);
    return { success: true, data: registry };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await registriesService.delete(id);
    return { success: true, data: result };
  });
}