import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function firewallRoutes(app: FastifyInstance) {
  // ─── List rules for a server ───
  app.get('/api/v1/servers/:id/firewall', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    const rules = await prisma.firewallRule.findMany({
      where: { serverId: id },
      orderBy: { createdAt: 'desc' },
    });

    return { ok: true, data: rules };
  });

  // ─── Create rule ───
  app.post('/api/v1/servers/:id/firewall', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { action, port, protocol, source } = request.body as {
      action: string;
      port?: number;
      protocol: string;
      source?: string;
    };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    const rule = await prisma.firewallRule.create({
      data: {
        serverId: id,
        action,
        port,
        protocol,
        source: source || 'any',
        teamId: user.teamId,
      },
    });

    // Apply on server
    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      const ufwAction = action === 'allow' ? 'allow' : 'deny';
      const portSpec = port ? `${port}` : '';
      const sourceSpec = source && source !== 'any' ? `from ${source}` : '';
      const protoSpec = protocol !== 'both' ? `proto ${protocol}` : '';

      await exec(id, `sudo ufw ${ufwAction} ${sourceSpec} ${portSpec} ${protoSpec}`.replace(/\s+/g, ' ').trim());
    } catch (err) {
      // Rule saved to DB even if apply fails
    }

    return { ok: true, data: rule };
  });

  // ─── Delete rule ───
  app.delete('/api/v1/servers/:id/firewall/:ruleId', async (request, reply) => {
    const user = getUser(request);
    const { id, ruleId } = request.params as { id: string; ruleId: string };

    const rule = await prisma.firewallRule.findFirst({
      where: { id: ruleId, serverId: id, teamId: user.teamId },
    });
    if (!rule) return reply.code(404).send({ ok: false, error: 'Rule not found' });

    // Remove from server
    try {
      const server = await prisma.server.findFirst({ where: { id, teamId: user.teamId, deletedAt: null }, include: { sshKey: true } });
      if (server) {
        if (!isConnected(id)) await decryptAndConnect(id, server);

        const ufwAction = rule.action === 'allow' ? 'delete allow' : 'delete deny';
        const portSpec = rule.port ? `${rule.port}` : '';
        await exec(id, `sudo ufw ${ufwAction} ${portSpec}`.trim());
      }
    } catch {}

    await prisma.firewallRule.delete({ where: { id: ruleId } });
    return { ok: true };
  });

  // ─── Sync UFW status ───
  app.get('/api/v1/servers/:id/firewall/status', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      const status = await exec(id, 'sudo ufw status verbose');
      return { ok: true, data: { status } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: 'Failed to get firewall status' });
    }
  });
}
