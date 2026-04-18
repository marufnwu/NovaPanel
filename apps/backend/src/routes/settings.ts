import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function settingsRoutes(app: FastifyInstance) {
  // ─── List team members (admin only) ───
  app.get('/api/v1/settings/team', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Admin only' });
    }

    const members = await prisma.user.findMany({
      where: { teamId: user.teamId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { ok: true, data: members };
  });

  // ─── Invite team member ───
  app.post('/api/v1/settings/team/invite', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Admin only' });
    }

    const { email, role } = request.body as { email: string; role: string };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ ok: false, error: 'User already exists' });
    }

    const member = await prisma.user.create({
      data: {
        email,
        role: role as any,
        teamId: user.teamId,
        passwordHash: '',
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return { ok: true, data: member };
  });

  // ─── Update member role ───
  app.put('/api/v1/settings/team/:userId', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Admin only' });
    }

    const { userId } = request.params as { userId: string };
    const { role } = request.body as { role: string };

    const member = await prisma.user.findFirst({
      where: { id: userId, teamId: user.teamId },
    });

    if (!member) {
      return reply.code(404).send({ ok: false, error: 'Member not found' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
    });

    return { ok: true };
  });

  // ─── Remove team member ───
  app.delete('/api/v1/settings/team/:userId', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Admin only' });
    }

    const { userId } = request.params as { userId: string };

    const member = await prisma.user.findFirst({
      where: { id: userId, teamId: user.teamId },
    });

    if (!member) {
      return reply.code(404).send({ ok: false, error: 'Member not found' });
    }

    await prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  });
}
