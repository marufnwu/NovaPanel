import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function monitoringRoutes(app: FastifyInstance) {
  // ─── List uptime checks for team's sites ───
  app.get('/api/v1/monitoring/uptime', async (request) => {
    const user = getUser(request);

    const sites = await prisma.site.findMany({
      where: { teamId: user.teamId, deletedAt: null },
      select: { id: true, name: true, domain: true },
    });

    const siteIds = sites.map((s) => s.id);

    const checks = await prisma.uptimeCheck.findMany({
      where: { siteId: { in: siteIds } },
      include: {
        _count: { select: { incidents: { where: { resolvedAt: null } } } },
      },
    });

    const results = await Promise.all(
      checks.map(async (check) => {
        const cached = await redis.get(`uptime:${check.siteId}`);
        const latest = cached ? JSON.parse(cached) : null;

        return {
          id: check.id,
          siteId: check.siteId,
          url: check.url,
          status: check.status,
          responseTimeMs: check.responseTimeMs,
          lastCheckedAt: check.lastCheckedAt,
          latest,
          openIncidents: check._count.incidents,
          site: sites.find((s) => s.id === check.siteId),
        };
      }),
    );

    return { ok: true, data: results };
  });

  // ─── Get uptime incidents ───
  app.get('/api/v1/monitoring/uptime/:checkId/incidents', async (request, reply) => {
    const user = getUser(request);
    const { checkId } = request.params as { checkId: string };
    const { resolved } = request.query as { resolved?: string };

    const check = await prisma.uptimeCheck.findUnique({
      where: { id: checkId },
      include: { site: { select: { teamId: true } } },
    });

    if (!check || check.site.teamId !== user.teamId) {
      return reply.code(404).send({ ok: false, error: 'Check not found' });
    }

    const where: any = { checkId };
    if (resolved === 'false') where.resolvedAt = null;
    if (resolved === 'true') where.resolvedAt = { not: null };

    const incidents = await prisma.uptimeIncident.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return { ok: true, data: incidents };
  });

  // ─── Update uptime check ───
  app.put('/api/v1/monitoring/uptime/:checkId', async (request, reply) => {
    const user = getUser(request);
    const { checkId } = request.params as { checkId: string };
    const { url } = request.body as { url?: string };

    const check = await prisma.uptimeCheck.findUnique({
      where: { id: checkId },
      include: { site: { select: { teamId: true } } },
    });

    if (!check || check.site.teamId !== user.teamId) {
      return reply.code(404).send({ ok: false, error: 'Check not found' });
    }

    await prisma.uptimeCheck.update({
      where: { id: checkId },
      data: {
        ...(url ? { url } : {}),
      },
    });

    return { ok: true };
  });

  // ─── Delete uptime check ───
  app.delete('/api/v1/monitoring/uptime/:checkId', async (request, reply) => {
    const user = getUser(request);
    const { checkId } = request.params as { checkId: string };

    const check = await prisma.uptimeCheck.findUnique({
      where: { id: checkId },
      include: { site: { select: { teamId: true } } },
    });

    if (!check || check.site.teamId !== user.teamId) {
      return reply.code(404).send({ ok: false, error: 'Check not found' });
    }

    await prisma.uptimeCheck.delete({ where: { id: checkId } });
    return { ok: true };
  });

  // ─── Alert rules ───
  app.get('/api/v1/monitoring/alerts', async (request) => {
    const user = getUser(request);

    const rules = await prisma.alertRule.findMany({
      where: { teamId: user.teamId },
    });

    return { ok: true, data: rules };
  });

  app.post('/api/v1/monitoring/alerts', async (request, reply) => {
    const user = getUser(request);
    const body = request.body as {
      type: string;
      serverId?: string;
      siteId?: string;
      threshold?: number;
      channel: string;
      channelConfig: Record<string, string>;
      cooldownMinutes?: number;
    };

    const rule = await prisma.alertRule.create({
      data: {
        teamId: user.teamId,
        type: body.type as any,
        serverId: body.serverId,
        siteId: body.siteId,
        threshold: body.threshold,
        channel: body.channel,
        channelConfig: body.channelConfig as any,
        cooldownMinutes: body.cooldownMinutes || 15,
        active: true,
      },
    });

    return { ok: true, data: rule };
  });

  app.put('/api/v1/monitoring/alerts/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      active?: boolean;
      threshold?: number;
      channelConfig?: Record<string, string>;
      cooldownMinutes?: number;
    };

    const rule = await prisma.alertRule.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!rule) return reply.code(404).send({ ok: false, error: 'Alert rule not found' });

    const updated = await prisma.alertRule.update({
      where: { id },
      data: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.threshold !== undefined ? { threshold: body.threshold } : {}),
        ...(body.channelConfig ? { channelConfig: body.channelConfig as any } : {}),
        ...(body.cooldownMinutes !== undefined ? { cooldownMinutes: body.cooldownMinutes } : {}),
      },
    });

    return { ok: true, data: updated };
  });

  app.delete('/api/v1/monitoring/alerts/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const rule = await prisma.alertRule.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!rule) return reply.code(404).send({ ok: false, error: 'Alert rule not found' });

    await prisma.alertRule.delete({ where: { id } });
    return { ok: true };
  });

  // ─── Alert history ───
  app.get('/api/v1/monitoring/alerts/history', async (request) => {
    const raw = await redis.lrange('alert-history', 0, 99);
    const alerts = raw.map((entry) => JSON.parse(entry));

    return { ok: true, data: alerts };
  });
}
