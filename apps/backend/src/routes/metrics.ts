import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getLatestMetrics, getMetricsHistory } from '../services/metrics.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function metricsRoutes(app: FastifyInstance) {
  // ─── Latest Metrics ───
  app.get('/api/v1/servers/:id/metrics', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!server) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    const metrics = await getLatestMetrics(id);
    if (!metrics) {
      return { ok: true, data: null };
    }

    return { ok: true, data: metrics };
  });

  // ─── Metrics History ───
  app.get('/api/v1/servers/:id/metrics/history', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const query = request.query as { from?: string; to?: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!server) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);

    const metrics = await getMetricsHistory(id, from, to);

    return {
      ok: true,
      data: {
        metrics: metrics.map((m) => ({
          ...m,
          recordedAt: m.recordedAt.toISOString(),
        })),
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };
  });
}
