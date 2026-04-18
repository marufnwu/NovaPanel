import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/v1/audit', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Admin only' });
    }

    const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    // Get team member IDs to filter audit logs
    const teamMembers = await prisma.user.findMany({
      where: { teamId: user.teamId },
      select: { id: true },
    });
    const userIds = teamMembers.map((m) => m.id);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId: { in: userIds } },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where: { userId: { in: userIds } } }),
    ]);

    return { ok: true, data: logs, total };
  });
}
