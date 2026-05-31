import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { databasesService } from './databases.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  changePasswordSchema,
  exportSchema,
  repairSchema,
  optimizeSchema,
  cloneSchema,
  querySchema,
} from './databases.schema.js';

const createDatabaseSchema = z.object({
  orgId: z.string().min(1),
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
  siteId: z.string().optional(),
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
    const orgId = (req.query as { orgId?: string }).orgId || req.orgId;
    const result = await databasesService.list(orgId);
    return { success: true, data: result.items, meta: { total: result.total } };
  });

  fastify.post('/', async (req, reply) => {
    const data = createDatabaseSchema.parse(req.body);
    const orgId = req.orgId;
    const database = await databasesService.create({ ...data, orgId: orgId! });
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

  // Change user password
  fastify.put('/:id/users/:userId/password', async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const { password } = changePasswordSchema.parse(req.body);
    const result = await databasesService.changeUserPassword(id, userId, password);
    return { success: true, data: result };
  });

  // Change database password (for the database itself, not a specific user)
  fastify.post('/:id/change-password', async (req) => {
    const { id } = req.params as { id: string };
    const { password } = changePasswordSchema.parse(req.body);
    const result = await databasesService.changePassword(id, password);
    return { success: true, data: result };
  });

  // Export database
  fastify.post('/:id/export', async (req) => {
    const { id } = req.params as { id: string };
    const { outputPath } = exportSchema.parse(req.body || {});
    const result = await databasesService.exportDatabase(id, outputPath);
    return { success: true, data: result };
  });

  // Import database
  fastify.post('/:id/import', async (req) => {
    const { id } = req.params as { id: string };
    const { sql } = z.object({ sql: z.string().min(1) }).parse(req.body);
    const result = await databasesService.importDatabase(id, sql);
    return { success: true, data: result };
  });

  // Repair database
  fastify.post('/:id/repair', async (req) => {
    const { id } = req.params as { id: string };
    repairSchema.parse(req.body || {});
    const result = await databasesService.repairDatabase(id);
    return { success: true, data: result };
  });

  // Optimize database
  fastify.post('/:id/optimize', async (req) => {
    const { id } = req.params as { id: string };
    optimizeSchema.parse(req.body || {});
    const result = await databasesService.optimizeDatabase(id);
    return { success: true, data: result };
  });

  // Clone database
  fastify.post('/:id/clone', async (req) => {
    const { id } = req.params as { id: string };
    const { targetName } = cloneSchema.parse(req.body);
    const result = await databasesService.cloneDatabase(id, targetName);
    return { success: true, data: result };
  });

  // Execute query
  fastify.post('/:id/query', async (req) => {
    const { id } = req.params as { id: string };
    const { sql, limit } = querySchema.parse(req.body);
    const result = await databasesService.runQuery(id, sql, limit);
    return { success: true, data: result };
  });
}