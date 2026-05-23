import type { FastifyInstance, FastifyReply } from 'fastify';
import { CronService } from './cron.service.js';
import { createCronJobSchema } from './cron.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function cronRoutes(fastify: FastifyInstance) {
  const service = new CronService();
  fastify.addHook('preHandler', requireAuth);

  // GET /cron
  fastify.get('/cron', async () => {
    return { success: true, data: await service.listJobs() };
  });

  // GET /cron/:id
  fastify.get('/cron/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getJob(id) };
  });

  // POST /cron
  fastify.post('/cron', async (req, reply: FastifyReply) => {
    const { command, schedule, siteId, name } = createCronJobSchema.parse(req.body);
    const job = await service.createJob({
      command,
      schedule,
      siteId,
      name,
    }, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: job });
  });

  // PUT /cron/:id
  fastify.put('/cron/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { schedule, command } = req.body as { schedule?: string; command?: string };
    return { success: true, data: await service.updateJob(id, { schedule, command }, req.user.id, req.ip) };
  });

  // DELETE /cron/:id
  fastify.delete('/cron/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteJob(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /cron/:id/toggle
  fastify.post('/cron/:id/toggle', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.toggleJob(id, req.user.id, req.ip) };
  });

  // POST /cron/:id/run
  fastify.post('/cron/:id/run', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.runJob(id, req.user.id, req.ip) };
  });

  // GET /cron/:id/history — Get cron job execution history
  fastify.get('/cron/:id/history', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getJobHistory(id) };
  });

  // GET /sites/:siteId/cron — Get cron jobs for a specific site
  fastify.get('/sites/:siteId/cron', async (req) => {
    const { siteId } = req.params as { siteId: string };
    return { success: true, data: await service.listBySite(siteId) };
  });
}
