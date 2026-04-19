import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function processesRoutes(app: FastifyInstance) {
  // ─── List processes ───
  app.get('/api/v1/servers/:id/processes', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      const [pm2Raw, supervisorRaw, systemdRaw] = await Promise.all([
        exec(id, 'pm2 jlist 2>/dev/null || echo "[]"').catch(() => '[]'),
        exec(id, 'supervisorctl status 2>/dev/null || echo ""').catch(() => ''),
        exec(id, 'systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | head -20 || echo ""').catch(() => ''),
      ]);

      // Parse PM2
      let pm2: any[] = [];
      try { pm2 = JSON.parse(pm2Raw); } catch {}

      // Parse Supervisor
      const supervisor = supervisorRaw
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => {
          const parts = line.split(/\s+/);
          return { name: parts[0], status: parts[1] || 'unknown', pid: parts[3] || '-' };
        });

      // Parse systemd
      const systemd = systemdRaw
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => {
          const parts = line.split(/\s+/);
          return { unit: parts[0], load: parts[1], active: parts[2], sub: parts[3] };
        });

      return { ok: true, data: { pm2, supervisor, systemd } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to list processes' });
    }
  });

  // ─── Restart PM2 process ───
  app.post('/api/v1/servers/:id/processes/pm2/:name/restart', async (request, reply) => {
    const user = getUser(request);
    const { id, name } = request.params as { id: string; name: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      await exec(id, `pm2 restart ${name}`);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Restart failed' });
    }
  });

  // ─── Stop PM2 process ───
  app.post('/api/v1/servers/:id/processes/pm2/:name/stop', async (request, reply) => {
    const user = getUser(request);
    const { id, name } = request.params as { id: string; name: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      await exec(id, `pm2 stop ${name}`);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Stop failed' });
    }
  });

  // ─── Restart Supervisor process ───
  app.post('/api/v1/servers/:id/processes/supervisor/:name/restart', async (request, reply) => {
    const user = getUser(request);
    const { id, name } = request.params as { id: string; name: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      await exec(id, `sudo supervisorctl restart ${name}`);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Restart failed' });
    }
  });

  // ─── One-off command execution ───
  app.post('/api/v1/servers/:id/exec', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { command } = request.body as { command: string };

    if (!command || !command.trim()) {
      return reply.code(400).send({ ok: false, error: 'Command is required' });
    }

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      const output = await exec(id, command);
      return { ok: true, data: { output } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Execution failed' });
    }
  });
}
