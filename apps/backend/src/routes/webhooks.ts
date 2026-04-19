import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { deployQueue } from '../jobs/provisioning.job.js';
import { randomBytes } from 'node:crypto';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function webhookRoutes(app: FastifyInstance) {
  // ─── List webhooks for team ───
  app.get('/api/v1/webhooks', async (request) => {
    const user = getUser(request);

    const webhooks = await prisma.site.findMany({
      where: { teamId: user.teamId, deletedAt: null },
      select: {
        id: true,
        name: true,
        domain: true,
        deployWebhookToken: true,
      },
    });

    return { ok: true, data: webhooks };
  });

  // ─── Generate webhook token for a site ───
  app.post('/api/v1/sites/:id/webhook', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    const token = randomBytes(32).toString('hex');

    await prisma.site.update({
      where: { id },
      data: { deployWebhookToken: token },
    });

    return { ok: true, data: { url: `/api/v1/hooks/deploy/${token}`, token } };
  });

  // ─── Revoke webhook ───
  app.delete('/api/v1/sites/:id/webhook', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    await prisma.site.update({
      where: { id },
      data: { deployWebhookToken: null },
    });

    return { ok: true };
  });

  // ─── Incoming webhook (public, no auth) ───
  app.post('/api/v1/hooks/deploy/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const site = await prisma.site.findFirst({
      where: { deployWebhookToken: token, deletedAt: null },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Invalid webhook token' });

    if (site.status === 'provisioning') {
      return reply.code(409).send({ ok: false, error: 'Site is already being provisioned' });
    }

    await deployQueue.add('deploy', {
      siteId: site.id,
      userId: 'webhook',
    });

    return { ok: true, message: `Deploy triggered for ${site.name}` };
  });
}
