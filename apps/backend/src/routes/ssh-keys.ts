import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../services/crypto.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: { user: unknown }): UserPayload {
  return request.user as unknown as UserPayload;
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  publicKey: z.string().min(1),
  privateKey: z.string().min(1),
});

export async function sshKeyRoutes(app: FastifyInstance) {
  // ─── List SSH Keys ───
  app.get('/api/v1/ssh-keys', async (request) => {
    const user = getUser(request);
    const keys = await prisma.sshKey.findMany({
      where: { teamId: user.teamId },
      select: {
        id: true,
        name: true,
        publicKey: true,
        fingerprint: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { ok: true, data: keys };
  });

  // ─── Create SSH Key ───
  app.post('/api/v1/ssh-keys', async (request, reply) => {
    const user = getUser(request);
    const body = createKeySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const { name, publicKey, privateKey } = body.data;

    const fingerprint = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('base64')
      .replace(/=+$/, '');

    const sshKey = await prisma.sshKey.create({
      data: {
        name,
        publicKey,
        privateKeyEncrypted: encrypt(privateKey),
        fingerprint: `SHA256:${fingerprint}`,
        teamId: user.teamId,
      },
      select: {
        id: true,
        name: true,
        publicKey: true,
        fingerprint: true,
        createdAt: true,
      },
    });

    return reply.code(201).send({ ok: true, data: sshKey });
  });

  // ─── Delete SSH Key ───
  app.delete('/api/v1/ssh-keys/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const key = await prisma.sshKey.findFirst({
      where: { id, teamId: user.teamId },
    });

    if (!key) {
      return reply.code(404).send({ ok: false, error: 'SSH key not found' });
    }

    // Check if key is in use by any server
    const inUse = await prisma.server.findFirst({
      where: { sshKeyId: id, deletedAt: null },
    });

    if (inUse) {
      return reply.code(409).send({ ok: false, error: 'SSH key is in use by a server' });
    }

    await prisma.sshKey.delete({ where: { id } });
    return reply.code(200).send({ ok: true });
  });
}
