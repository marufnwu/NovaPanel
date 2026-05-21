import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { organizationsService } from './organizations.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';

const createOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'billing']),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'billing']),
});

export default async function organizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const orgs = await organizationsService.listByUser(req.user.id);
    return { success: true, data: orgs };
  });

  fastify.post('/', async (req, reply) => {
    const data = createOrgSchema.parse(req.body);
    const org = await organizationsService.create(data, req.user.id);
    return reply.status(201).send({ success: true, data: org });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const org = await organizationsService.get(id, req.user.id);
    if (!org) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    return { success: true, data: org };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateOrgSchema.parse(req.body);
    const org = await organizationsService.update(id, data);
    return { success: true, data: org };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await organizationsService.delete(id);
    return { success: true, data: result };
  });

  fastify.get('/:id/members', async (req) => {
    const { id } = req.params as { id: string };
    const members = await organizationsService.listMembers(id);
    return { success: true, data: members };
  });

  fastify.post('/:id/members', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { email, role } = inviteMemberSchema.parse(req.body);
    const result = await organizationsService.inviteMember(id, email, role, req.user.id);
    return reply.status(201).send({ success: true, data: result });
  });

  fastify.delete('/:id/members/:userId', async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const result = await organizationsService.removeMember(id, userId);
    return { success: true, data: result };
  });

  fastify.put('/:id/members/:userId', async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const { role } = updateMemberRoleSchema.parse(req.body);
    const result = await organizationsService.updateMemberRole(id, userId, role);
    return { success: true, data: result };
  });
}