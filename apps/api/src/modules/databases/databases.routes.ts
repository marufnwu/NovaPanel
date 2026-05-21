import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { databasesService } from './databases.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createDatabaseSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'sqlite']),
  version: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().optional(),
  databaseName: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  backupsEnabled: z.boolean().optional(),
  backupSchedule: z.string().optional(),
  publicAccess: z.boolean().optional(),
});

const updateDatabaseSchema = z.object({
  name: z.string().min(1).optional(),
  backupsEnabled: z.boolean().optional(),
  backupSchedule: z.string().optional(),
  publicAccess: z.boolean().optional(),
  status: z.enum(['running', 'stopped', 'error']).optional(),
});

const createDbUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().optional(),
  privileges: z.array(z.string()).optional(),
});

const updatePrivilegesSchema = z.object({
  privileges: z.array(z.string()),
});

export default async function databaseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const projectId = (req.query as { projectId?: string }).projectId;
    const result = await databasesService.list(projectId);
    return { success: true, data: result.items, meta: { total: result.total } };
  });

  fastify.post('/', async (req, reply) => {
    const data = createDatabaseSchema.parse(req.body);
    const database = await databasesService.create(data);
    return reply.status(201).send({ success: true, data: database });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const database = await databasesService.get(id);
    return { success: true, data: database };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateDatabaseSchema.parse(req.body);
    const database = await databasesService.update(id, data);
    return { success: true, data: database };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await databasesService.delete(id);
    return { success: true, data: result };
  });

  fastify.post('/:id/start', async (req) => {
    const { id } = req.params as { id: string };
    const database = await databasesService.start(id);
    return { success: true, data: database };
  });

  fastify.post('/:id/stop', async (req) => {
    const { id } = req.params as { id: string };
    const database = await databasesService.stop(id);
    return { success: true, data: database };
  });

  fastify.post('/:id/restart', async (req) => {
    const { id } = req.params as { id: string };
    const database = await databasesService.restart(id);
    return { success: true, data: database };
  });

  fastify.get('/:id/users', async (req) => {
    const { id } = req.params as { id: string };
    const users = await databasesService.listUsers(id);
    return { success: true, data: users };
  });

  fastify.post('/:id/users', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createDbUserSchema.parse(req.body);
    const user = await databasesService.createUser({ databaseId: id, ...data });
    return reply.status(201).send({ success: true, data: user });
  });

  fastify.delete('/:id/users/:userId', async (req) => {
    const { userId } = req.params as { userId: string };
    const result = await databasesService.deleteUser(userId);
    return { success: true, data: result };
  });

  fastify.put('/:id/users/:userId/privileges', async (req) => {
    const { userId } = req.params as { userId: string };
    const { privileges } = updatePrivilegesSchema.parse(req.body);
    const user = await databasesService.updateUserPrivileges(userId, privileges);
    return { success: true, data: user };
  });
}