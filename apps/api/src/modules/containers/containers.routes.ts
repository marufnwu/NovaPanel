import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { containersService } from './containers.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createContainerSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['compose', 'dockerfile', 'image']),
  composeFile: z.string().optional(),
  dockerfile: z.string().optional(),
  image: z.string().optional(),
  env: z.record(z.string()).optional(),
  secrets: z.array(z.string()).optional(),
  networkMode: z.string().optional(),
  exposedPorts: z.array(z.number()).optional(),
  cpuLimit: z.number().int().optional(),
  memoryLimit: z.number().int().optional(),
  replicas: z.number().int().optional(),
});

const updateContainerSchema = z.object({
  name: z.string().min(1).optional(),
  composeFile: z.string().optional(),
  dockerfile: z.string().optional(),
  image: z.string().optional(),
  env: z.record(z.string()).optional(),
  secrets: z.array(z.string()).optional(),
  networkMode: z.string().optional(),
  exposedPorts: z.array(z.number()).optional(),
  cpuLimit: z.number().int().optional(),
  memoryLimit: z.number().int().optional(),
  replicas: z.number().int().optional(),
});

export default async function containerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const projectId = (req.query as { projectId?: string }).projectId;
    const items = await containersService.list(projectId);
    return { success: true, data: items };
  });

  fastify.post('/', async (req, reply) => {
    const data = createContainerSchema.parse(req.body);
    const container = await containersService.create(data);
    return reply.status(201).send({ success: true, data: container });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const container = await containersService.get(id);
    if (!container) return { success: false, error: 'Container not found' };
    return { success: true, data: container };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateContainerSchema.parse(req.body);
    const container = await containersService.update(id, data);
    return { success: true, data: container };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await containersService.delete(id);
    return { success: true, data: result };
  });

  fastify.post('/:id/start', async (req) => {
    const { id } = req.params as { id: string };
    const result = await containersService.start(id);
    return { success: true, data: result };
  });

  fastify.post('/:id/stop', async (req) => {
    const { id } = req.params as { id: string };
    const result = await containersService.stop(id);
    return { success: true, data: result };
  });

  fastify.post('/:id/restart', async (req) => {
    const { id } = req.params as { id: string };
    const result = await containersService.restart(id);
    return { success: true, data: result };
  });

  fastify.get('/:id/logs', async (req) => {
    const { id } = req.params as { id: string };
    const result = await containersService.getLogs(id);
    return { success: true, data: result };
  });
}