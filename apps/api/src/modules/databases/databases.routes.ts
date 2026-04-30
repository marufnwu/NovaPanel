import type { FastifyInstance, FastifyReply } from 'fastify';
import { DatabasesService } from './databases.service.js';
import { createDbSchema, createUserSchema, changePasswordSchema, importDbSchema } from './databases.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function databaseRoutes(fastify: FastifyInstance) {
  const service = new DatabasesService();
  fastify.addHook('preHandler', requireAuth);

  // GET /databases — List databases
  fastify.get('/databases', async (req) => {
    const { domainId, page, perPage } = req.query as { domainId?: string; page?: string; perPage?: string };
    return {
      success: true,
      data: await service.list(domainId, parseInt(page || '1'), parseInt(perPage || '20')),
    };
  });

  // POST /databases — Create database
  fastify.post('/databases', async (req, reply: FastifyReply) => {
    const data = createDbSchema.parse(req.body);
    const result = await service.create(data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: result });
  });

  // DELETE /databases/:id — Delete database
  fastify.delete('/databases/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.delete(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /databases/:id/users — Create database user
  fastify.post('/databases/:id/users', async (req) => {
    const { id } = req.params as { id: string };
    const { username, password, host } = createUserSchema.parse(req.body);
    return { success: true, data: await service.createUser(id, username, password, host, req.user.id, req.ip) };
  });

  // DELETE /databases/:id/users/:userId — Delete database user
  fastify.delete('/databases/:id/users/:userId', async (req) => {
    const { userId } = req.params as { userId: string };
    await service.deleteUser(userId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // PUT /databases/:id/users/:userId/password — Change user password
  fastify.put('/databases/:id/users/:userId/password', async (req) => {
    const { userId } = req.params as { userId: string };
    const { password } = changePasswordSchema.parse(req.body);
    await service.changeUserPassword(userId, password, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /databases/:id/export — Export database
  fastify.get('/databases/:id/export', async (req) => {
    const { id } = req.params as { id: string };
    const sql = await service.exportDatabase(id, req.user.id, req.ip);
    return { success: true, data: { sql } };
  });

  // POST /databases/:id/import — Import database
  fastify.post('/databases/:id/import', async (req) => {
    const { id } = req.params as { id: string };
    const { sql } = importDbSchema.parse(req.body);
    await service.importDatabase(id, sql, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /databases/:id/info — Get database info (users, size)
  fastify.get('/databases/:id/info', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getDatabaseInfo(id) };
  });

  // POST /databases/:id/repair — Repair MariaDB tables
  fastify.post('/databases/:id/repair', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.repairDatabase(id, req.user.id, req.ip) };
  });

  // POST /databases/:id/optimize — Optimize MariaDB tables
  fastify.post('/databases/:id/optimize', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.optimizeDatabase(id, req.user.id, req.ip) };
  });

  // POST /databases/:id/clone — Clone database
  fastify.post('/databases/:id/clone', async (req) => {
    const { id } = req.params as { id: string };
    const { newName } = req.body as { newName: string };
    return { success: true, data: await service.cloneDatabase(id, newName, req.user.id, req.ip) };
  });

  // POST /databases/:id/query — Execute SQL query
  fastify.post('/databases/:id/query', async (req) => {
    const { id } = req.params as { id: string };
    const { sql } = req.body as { sql: string };
    return { success: true, data: await service.runQuery(id, sql) };
  });
}
