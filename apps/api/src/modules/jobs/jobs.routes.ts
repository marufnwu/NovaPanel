import type { FastifyInstance } from 'fastify';
import { jobQueue } from '../../services/job-queue/index.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function jobsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/jobs', async (req) => {
    const { status, type, limit, offset } = req.query as {
      status?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };
    const result = await jobQueue.listJobs({
      status,
      type,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    return { success: true, data: result };
  });

  fastify.get('/jobs/:id', async (req) => {
    const { id } = req.params as { id: string };
    const job = await jobQueue.getJob(id);
    if (!job) return { success: false, error: 'Job not found' };
    return { success: true, data: job };
  });

  fastify.post('/jobs/:id/cancel', async (req) => {
    const { id } = req.params as { id: string };
    const cancelled = await jobQueue.cancelJob(id);
    return { success: true, data: { cancelled } };
  });
}