import type { FastifyInstance, FastifyReply } from 'fastify';
import fs from 'node:fs';
import { BackupService } from './backup.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { logger } from '../../config/logger.js';

export default async function backupRoutes(fastify: FastifyInstance) {
  const service = new BackupService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/backups', async () => {
    return { success: true, data: await service.listBackups() };
  });

  fastify.post('/backups', async (req, reply: FastifyReply) => {
    const body = req.body as any;
    const backup = await service.createBackup({
      resourceType: body.resourceType || 'site',
      type: body.type || 'full',
    }, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: backup });
  });

  fastify.post('/backups/:id/restore', async (req) => {
    const { id } = req.params as { id: string };
    const options = (req.body as any) || {};
    return { success: true, data: await service.restoreBackup(id, options, req.user.id, req.ip) };
  });

  fastify.delete('/backups/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteBackup(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  fastify.get('/backups/schedules', async () => {
    return { success: true, data: await service.listSchedules() };
  });

  fastify.post('/backups/schedules', async (req, reply: FastifyReply) => {
    const body = req.body as any;
    const schedule = await service.createSchedule({
      name: body.name || 'Backup Schedule',
      resourceType: body.resourceType || 'site',
      resourceId: body.resourceId,
      cronExpression: body.cronExpression,
      retentionDays: body.retentionDays || 30,
      storageBackend: body.storageBackend || 'local',
      enabled: body.enabled !== false,
    }, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: schedule });
  });

  fastify.post('/backups/schedules/:id/toggle', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.toggleSchedule(id, req.user.id, req.ip) };
  });

  fastify.delete('/backups/schedules/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteSchedule(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  fastify.put('/backups/schedules/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    return { success: true, data: await service.updateSchedule(id, {
      name: body.name,
      cronExpression: body.cronExpression,
      retentionDays: body.retentionDays,
      storageBackend: body.storageBackend,
      enabled: body.enabled,
    }, req.user.id, req.ip) };
  });

  fastify.post('/backups/schedules/:id/run', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.runBackupNow(id, req.user.id, req.ip) };
  });

  fastify.get('/backups/:id/download', async (req, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const { tmpPath, filename, sizeBytes } = await service.prepareDownload(id);

      const stream = fs.createReadStream(tmpPath);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Type', 'application/octet-stream');
      if (sizeBytes > 0) {
        reply.header('Content-Length', sizeBytes);
      }

      stream.on('end', () => {
        fs.unlink(tmpPath, () => {});
      });
      stream.on('error', () => {
        fs.unlink(tmpPath, () => {});
      });

      return reply.send(stream);
    } catch (err) {
      logger.error({ err, backupId: id }, 'Backup download failed');
      throw err;
    }
  });

  fastify.post('/backups/:id/verify', async (req) => {
    const { id } = req.params as { id: string };
    const result = await service.verifyBackup(id);
    return { success: true, data: result };
  });

  fastify.get('/backups/storage', async () => {
    return { success: true, data: { type: 'local' } };
  });

  fastify.put('/backups/storage', async (req) => {
    return { success: true, data: { type: 'local' } };
  });
}