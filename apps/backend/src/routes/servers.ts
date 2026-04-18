import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../services/crypto.service.js';
import { testConnection, exec, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload, AuthType } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  authType: z.enum(['key', 'password']),
  sshKeyId: z.string().optional(),
  password: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export async function serverRoutes(app: FastifyInstance) {
  // ─── List Servers ───
  app.get('/api/v1/servers', async (request) => {
    const user = getUser(request);
    const servers = await prisma.server.findMany({
      where: { teamId: user.teamId, deletedAt: null },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        sshKeyId: true,
        status: true,
        tags: true,
        osInfo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { ok: true, data: servers };
  });

  // ─── Create Server ───
  app.post('/api/v1/servers', async (request, reply) => {
    const user = getUser(request);
    const body = createServerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }
    const { name, host, port, username, authType, sshKeyId, password, tags } = body.data;

    if (authType === 'key' && !sshKeyId) {
      return reply.code(400).send({ ok: false, error: 'sshKeyId is required when authType is "key"' });
    }
    if (authType === 'password' && !password) {
      return reply.code(400).send({ ok: false, error: 'password is required when authType is "password"' });
    }

    let passwordEncrypted: string | null = null;
    if (password) {
      passwordEncrypted = encrypt(password);
    }

    const server = await prisma.server.create({
      data: {
        name,
        host,
        port,
        username,
        authType: authType as AuthType,
        sshKeyId: sshKeyId ?? null,
        passwordEncrypted,
        tags,
        teamId: user.teamId,
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        sshKeyId: true,
        status: true,
        tags: true,
        osInfo: true,
        createdAt: true,
      },
    });

    return reply.code(201).send({ ok: true, data: server });
  });

  // ─── Get Server ───
  app.get('/api/v1/servers/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        sshKeyId: true,
        status: true,
        tags: true,
        osInfo: true,
        createdAt: true,
        tunnel: { select: { id: true, name: true, status: true } },
      },
    });

    if (!server) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    return { ok: true, data: server };
  });

  // ─── Update Server ───
  app.put('/api/v1/servers/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = updateServerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const existing = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!existing) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    const server = await prisma.server.update({
      where: { id },
      data: body.data,
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        sshKeyId: true,
        status: true,
        tags: true,
        osInfo: true,
        createdAt: true,
      },
    });

    return { ok: true, data: server };
  });

  // ─── Delete Server (soft) ───
  app.delete('/api/v1/servers/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const existing = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!existing) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    await prisma.server.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.code(200).send({ ok: true });
  });

  // ─── Test Connection ───
  app.post('/api/v1/servers/:id/test-connection', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    try {
      const connectOpts = {
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.authType === 'password' && server.passwordEncrypted
          ? decrypt(server.passwordEncrypted)
          : undefined,
        privateKey: server.authType === 'key' && server.sshKey
          ? decrypt(server.sshKey.privateKeyEncrypted)
          : undefined,
      };

      const client = await testConnection(connectOpts);

      // Detect OS info
      let osInfo: { distro: string; arch: string; kernel: string } | undefined;
      try {
        // We need to exec on this test client before closing
        const unameOutput = await new Promise<string>((resolve, reject) => {
          client.exec('uname -s -m -r && cat /etc/os-release 2>/dev/null | head -2', (err, stream) => {
            if (err) { reject(err); return; }
            let out = '';
            stream.on('data', (d: Buffer) => { out += d.toString(); });
            stream.on('close', () => resolve(out));
          });
        });

        const lines = unameOutput.trim().split('\n');
        const unameParts = lines[0]?.split(' ') ?? [];
        const prettyName = lines.find((l) => l.startsWith('PRETTY_NAME='))?.replace('PRETTY_NAME=', '')?.replace(/"/g, '');

        osInfo = {
          kernel: unameParts[2] ?? 'unknown',
          arch: unameParts[1] ?? 'unknown',
          distro: prettyName ?? unameParts[0] ?? 'unknown',
        };

        await prisma.server.update({
          where: { id },
          data: { osInfo, status: 'online' },
        });
      } catch {
        await prisma.server.update({
          where: { id },
          data: { status: 'online' },
        });
      }

      client.end();

      return { ok: true, data: { connected: true, osInfo } };
    } catch (err) {
      await prisma.server.update({
        where: { id },
        data: { status: 'offline' },
      });

      const message = err instanceof Error ? err.message : 'Connection failed';
      return { ok: true, data: { connected: false, error: message } };
    }
  });

  // ─── Connect Server (establish persistent SSH) ───
  app.post('/api/v1/servers/:id/connect', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    try {
      await decryptAndConnect(id, server);
      await prisma.server.update({ where: { id }, data: { status: 'online' } });
      return { ok: true, data: { status: 'online' } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      await prisma.server.update({ where: { id }, data: { status: 'offline' } });
      return reply.code(502).send({ ok: false, error: message });
    }
  });
}
