import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../services/crypto.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function notificationRoutes(app: FastifyInstance) {
  // ─── List channels ───
  app.get('/api/v1/notifications/channels', async (request) => {
    const user = getUser(request);

    const channels = await prisma.notificationChannel.findMany({
      where: { teamId: user.teamId },
      orderBy: { createdAt: 'desc' },
    });

    return { ok: true, data: channels };
  });

  // ─── Create channel ───
  app.post('/api/v1/notifications/channels', async (request, reply) => {
    const user = getUser(request);
    const { type, config } = request.body as {
      type: string;
      config: Record<string, string>;
    };

    const encryptedConfig = encrypt(JSON.stringify(config));

    const channel = await prisma.notificationChannel.create({
      data: {
        teamId: user.teamId,
        type,
        config: { encrypted: encryptedConfig } as any,
        active: true,
      },
    });

    return { ok: true, data: channel };
  });

  // ─── Update channel ───
  app.put('/api/v1/notifications/channels/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      active?: boolean;
      config?: Record<string, string>;
    };

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!channel) return reply.code(404).send({ ok: false, error: 'Channel not found' });

    await prisma.notificationChannel.update({
      where: { id },
      data: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.config ? { config: { encrypted: encrypt(JSON.stringify(body.config)) } as any } : {}),
      },
    });

    return { ok: true };
  });

  // ─── Delete channel ───
  app.delete('/api/v1/notifications/channels/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!channel) return reply.code(404).send({ ok: false, error: 'Channel not found' });

    await prisma.notificationChannel.delete({ where: { id } });
    return { ok: true };
  });

  // ─── Test channel ───
  app.post('/api/v1/notifications/channels/:id/test', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const channel = await prisma.notificationChannel.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!channel) return reply.code(404).send({ ok: false, error: 'Channel not found' });

    const configData = channel.config as any;
    const config = JSON.parse(decrypt(configData.encrypted));

    try {
      switch (channel.type) {
        case 'webhook':
          await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'NovaDash test notification', timestamp: new Date().toISOString() }),
          });
          break;
        case 'telegram':
          await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: config.chatId, text: 'NovaDash test notification' }),
          });
          break;
        case 'slack':
          await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'NovaDash test notification' }),
          });
          break;
        default:
          return reply.code(400).send({ ok: false, error: 'Unknown channel type' });
      }
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: 'Test notification failed: ' + (err instanceof Error ? err.message : 'Unknown error') });
    }
  });
}
