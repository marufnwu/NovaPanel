import type { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { desc, like, and, gte, lte, eq, or, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /audit — List audit logs (admin only)
  fastify.get('/audit', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const {
        limit: limitStr,
        offset: offsetStr,
        search,
        category,
        user,
        from,
        to,
        page: pageStr,
        per_page: perPageStr,
      } = req.query as Record<string, string | undefined>;

      const limit = Math.min(parseInt(limitStr || '50'), 200);
      const offset = parseInt(offsetStr || '0');
      const page = Math.max(1, parseInt(pageStr || '1'));
      const perPage = Math.min(Math.max(1, parseInt(perPageStr || '20')), 100);

      const conditions: ReturnType<typeof eq>[] = [];

      if (user) {
        conditions.push(eq(auditLogs.actorId, user));
      }

      if (from) {
        const fromDate = new Date(from);
        conditions.push(gte(auditLogs.createdAt, fromDate));
      }

      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLogs.createdAt, toDate));
      }

      if (search) {
        const q = `%${search}%`;
        conditions.push(
          or(
            like(auditLogs.action, q),
            like(auditLogs.resourceType, q),
            like(auditLogs.resourceId, q),
            like(auditLogs.ipAddress, q),
            like(auditLogs.actorId, q),
          )!
        );
      }

      // For category filter, we need to filter action patterns server-side
      // We'll get total count first
      const allForCount = conditions.length > 0
        ? await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(and(...conditions))
        : await db.select({ count: sql<number>`count(*)` }).from(auditLogs);

      const total = Number(allForCount[0]?.count ?? 0);

      const results = conditions.length > 0
        ? await db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset)
        : await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);

      // Apply category filter post-query (action pattern matching is complex to do in SQL)
      let filtered = results;
      if (category && category !== 'all') {
        filtered = results.filter(r => {
          if (category === 'other') {
            const a = r.action.toLowerCase();
            return !a.includes('.create') && !a.includes('.update') && !a.includes('.delete') &&
              !a.includes('login') && !a.includes('logout');
          }
          const catMap: Record<string, string[]> = {
            create: ['.create', 'created'],
            update: ['.update', 'updated'],
            delete: ['.delete', 'deleted', '.remove'],
            login: ['login', 'auth.login'],
            logout: ['logout', 'auth.logout'],
          };
          const patterns = catMap[category] || [];
          return patterns.some(p => r.action.toLowerCase().includes(p));
        });
      }

      return {
        success: true,
        data: filtered,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(total / perPage),
        },
      };
    },
  });
}
