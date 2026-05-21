import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { gitService } from './git.service.js';
import { dockerService } from '../docker/docker.service.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { sites } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';

const webhookPayloadSchema = z.object({
  ref: z.string().optional(),
  after: z.string().optional(),
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
  })).optional(),
  repository: z.object({
    full_name: z.string().optional(),
  }).optional(),
});

export default async function gitRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/git/:siteId', async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const signature = req.headers['x-hub-signature-256'] as string || '';

    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new Error('Site not found');

    const payload = JSON.stringify(req.body);
    if (site.gitWebhookSecret && !gitService.validateWebhook(site.gitWebhookSecret, payload, signature)) {
      return reply.status(403).send({ success: false, error: 'Invalid signature' });
    }

    const deployment = await deploymentsService.create({
      siteId,
      sourceType: 'git',
      gitRef: (req.body as { ref?: string }).ref?.replace('refs/heads/', '') || site.gitBranch || 'main',
      commitSha: (req.body as { after?: string; commits?: { id: string; message: string }[] }).commits?.[0]?.id || (req.body as { after?: string }).after,
      commitMessage: (req.body as { commits?: { message: string }[] }).commits?.[0]?.message,
    });

    dockerService.buildSite(siteId, deployment.id).catch(err => {
      req.log.error({ err, siteId, deploymentId: deployment.id }, 'Webhook build failed');
    });

    return reply.status(202).send({ success: true, data: { deploymentId: deployment.id } });
  });

  fastify.get('/sites/:id/git/status', async (req) => {
    const { id } = req.params as { id: string };
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) return { success: false, error: 'Site not found' };

    return {
      success: true,
      data: {
        gitRepo: site.gitRepo,
        gitBranch: site.gitBranch,
        hasWebhookSecret: !!site.gitWebhookSecret,
      },
    };
  });
}