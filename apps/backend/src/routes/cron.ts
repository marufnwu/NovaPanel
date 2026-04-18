import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function cronRoutes(app: FastifyInstance) {
  // ─── List cron jobs for a server ───
  app.get('/api/v1/servers/:id/cron', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    const jobs = await prisma.cronJob.findMany({
      where: { serverId: id },
      orderBy: { createdAt: 'desc' },
    });

    return { ok: true, data: jobs };
  });

  // ─── Create cron job ───
  app.post('/api/v1/servers/:id/cron', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { expression, command, description } = request.body as {
      expression: string;
      command: string;
      description?: string;
    };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    const job = await prisma.cronJob.create({
      data: {
        serverId: id,
        expression,
        command,
        description,
        teamId: user.teamId,
      },
    });

    // Apply on server
    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      // Add to crontab with a marker comment for tracking
      await exec(id, `(crontab -l 2>/dev/null; echo "${expression} ${command}  # novadash:${job.id}") | crontab -`);
    } catch {}

    return { ok: true, data: job };
  });

  // ─── Update cron job ───
  app.put('/api/v1/servers/:id/cron/:jobId', async (request, reply) => {
    const user = getUser(request);
    const { id, jobId } = request.params as { id: string; jobId: string };
    const { expression, command, description } = request.body as {
      expression?: string;
      command?: string;
      description?: string;
    };

    const job = await prisma.cronJob.findFirst({
      where: { id: jobId, serverId: id, teamId: user.teamId },
    });
    if (!job) return reply.code(404).send({ ok: false, error: 'Job not found' });

    // Remove old crontab entry and add new one
    try {
      const server = await prisma.server.findFirst({ where: { id, teamId: user.teamId, deletedAt: null }, include: { sshKey: true } });
      if (server) {
        if (!isConnected(id)) await decryptAndConnect(id, server);
        await exec(id, `crontab -l 2>/dev/null | grep -v "novadash:${jobId}" | crontab -`);

        const newExpr = expression || job.expression;
        const newCmd = command || job.command;
        await exec(id, `(crontab -l 2>/dev/null; echo "${newExpr} ${newCmd}  # novadash:${jobId}") | crontab -`);
      }
    } catch {}

    const updated = await prisma.cronJob.update({
      where: { id: jobId },
      data: {
        ...(expression ? { expression } : {}),
        ...(command ? { command } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });

    return { ok: true, data: updated };
  });

  // ─── Delete cron job ───
  app.delete('/api/v1/servers/:id/cron/:jobId', async (request, reply) => {
    const user = getUser(request);
    const { id, jobId } = request.params as { id: string; jobId: string };

    const job = await prisma.cronJob.findFirst({
      where: { id: jobId, serverId: id, teamId: user.teamId },
    });
    if (!job) return reply.code(404).send({ ok: false, error: 'Job not found' });

    // Remove from crontab
    try {
      const server = await prisma.server.findFirst({ where: { id, teamId: user.teamId, deletedAt: null }, include: { sshKey: true } });
      if (server) {
        if (!isConnected(id)) await decryptAndConnect(id, server);
        await exec(id, `crontab -l 2>/dev/null | grep -v "novadash:${jobId}" | crontab -`);
      }
    } catch {}

    await prisma.cronJob.delete({ where: { id: jobId } });
    return { ok: true };
  });

  // ─── Run cron job manually ───
  app.post('/api/v1/servers/:id/cron/:jobId/run', async (request, reply) => {
    const user = getUser(request);
    const { id, jobId } = request.params as { id: string; jobId: string };

    const job = await prisma.cronJob.findFirst({
      where: { id: jobId, serverId: id, teamId: user.teamId },
    });
    if (!job) return reply.code(404).send({ ok: false, error: 'Job not found' });

    try {
      const server = await prisma.server.findFirst({ where: { id, teamId: user.teamId, deletedAt: null }, include: { sshKey: true } });
      if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

      if (!isConnected(id)) await decryptAndConnect(id, server);
      const output = await exec(id, job.command);

      await prisma.cronJob.update({
        where: { id: jobId },
        data: { lastRunAt: new Date(), lastOutput: output },
      });

      return { ok: true, data: { output } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Execution failed' });
    }
  });
}
