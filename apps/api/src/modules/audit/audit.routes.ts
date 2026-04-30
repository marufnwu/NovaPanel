import type { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { desc } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /audit — List audit logs (admin only)
  fastify.get('/audit', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { limit, offset } = req.query as { limit?: string; offset?: string };
      const results = await db.select().from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(parseInt(limit || '50'))
        .offset(parseInt(offset || '0'));
      return { success: true, data: results };
    },
  });
}
