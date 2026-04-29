import type { FastifyInstance, FastifyReply } from 'fastify';
import { BackupService } from './backup.service.js';
import { createBackupSchema, restoreBackupSchema, createScheduleSchema, updateStorageConfigSchema } from './backup.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function backupRoutes(fastify: FastifyInstance) {
  const service = new BackupService();
  fastify.addHook('preHandler', requireAuth);

  // GET /backups
  fastify.get('/backups', async () => {
    return { success: true, data: await service.listBackups() };
  });

  // POST /backups
  fastify.post('/backups', async (req, reply: FastifyReply) => {
    const data = createBackupSchema.parse(req.body);
    const backup = await service.createBackup(data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: backup });
  });

  // POST /backups/:id/restore
  fastify.post('/backups/:id/restore', async (req) => {
    const { id } = req.params as { id: string };
    const options = restoreBackupSchema.parse(req.body || {});
    return { success: true, data: await service.restoreBackup(id, options, req.user.id, req.ip) };
  });

  // DELETE /backups/:id
  fastify.delete('/backups/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteBackup(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /backups/schedules
  fastify.get('/backups/schedules', async () => {
    return { success: true, data: await service.listSchedules() };
  });

  // POST /backups/schedules
  fastify.post('/backups/schedules', async (req, reply: FastifyReply) => {
    const data = createScheduleSchema.parse(req.body);
    const schedule = await service.createSchedule(data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: schedule });
  });

  // POST /backups/schedules/:id/toggle
  fastify.post('/backups/schedules/:id/toggle', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.toggleSchedule(id, req.user.id, req.ip) };
  });

  // DELETE /backups/schedules/:id
  fastify.delete('/backups/schedules/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteSchedule(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /backups/:id/download — Get backup download URL/path
  fastify.get('/backups/:id/download', async (req) => {
    const { id } = req.params as { id: string };
    const url = await service.getDownloadUrl(id);
    return { success: true, data: url };
  });

  // POST /backups/:id/verify — Verify backup integrity
  fastify.post('/backups/:id/verify', async (req) => {
    const { id } = req.params as { id: string };
    const result = await service.verifyBackup(id);
    return { success: true, data: result };
  });

  // GET /backups/storage — Get remote storage config
  fastify.get('/backups/storage', async () => {
    return { success: true, data: await service.getStorageConfig() };
  });

  // PUT /backups/storage — Update remote storage config
  fastify.put('/backups/storage', async (req) => {
    const config = updateStorageConfigSchema.parse(req.body);
    return { success: true, data: await service.updateStorageConfig(config, req.user.id, req.ip) };
  });
}
