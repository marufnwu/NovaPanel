import type { FastifyInstance } from 'fastify';
import { getSystemLogs } from './logs.service.js';
import { systemLogsQuerySchema } from './logs.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function logsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/logs/system — read system log file
  fastify.get('/logs/system', async (req) => {
    const query = systemLogsQuerySchema.parse(req.query);
    const { log, entries } = await getSystemLogs(query.lines);
    return { success: true, data: { log, entries } };
  });
}