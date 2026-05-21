import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { projectsService } from './projects.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';

const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  orgId: z.string().min(1),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  environment: z.enum(['production', 'staging', 'development']).optional(),
});

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const orgId = (req.query as { orgId?: string }).orgId;
    if (!orgId) throw new AppError(400, 'ORG_ID_REQUIRED', 'orgId query param required');
    const items = await projectsService.listByOrg(orgId);
    return { success: true, data: items };
  });

  fastify.post('/', async (req, reply) => {
    const data = createProjectSchema.parse(req.body);
    const project = await projectsService.create(data, req.user.id);
    return reply.status(201).send({ success: true, data: project });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const project = await projectsService.get(id);
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
    return { success: true, data: project };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateProjectSchema.parse(req.body);
    const project = await projectsService.update(id, data);
    return { success: true, data: project };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await projectsService.delete(id);
    return { success: true, data: result };
  });
}