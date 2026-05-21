import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deploymentsService } from './deployments.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createDeploymentSchema = z.object({
  sourceType: z.enum(['git', 'docker_registry', 'upload', 'rollback']),
  gitRef: z.string().optional(),
  commitSha: z.string().optional(),
  commitMessage: z.string().optional(),
  gitWebhookSecret: z.string().optional(),
});

export default async function deploymentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/sites/:siteId/deployments', async (req) => {
    const { siteId } = req.params as { siteId: string };
    const items = await deploymentsService.listBySite(siteId);
    return { success: true, data: items };
  });

  fastify.post('/sites/:siteId/deployments', async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const data = createDeploymentSchema.parse(req.body);
    const deployment = await deploymentsService.create({ siteId, ...data });
    return reply.status(201).send({ success: true, data: deployment });
  });

  fastify.get('/deployments/:id', async (req) => {
    const { id } = req.params as { id: string };
    const deployment = await deploymentsService.get(id);
    if (!deployment) return { success: false, error: 'Deployment not found' };
    return { success: true, data: deployment };
  });

  fastify.post('/deployments/:id/build-logs', async (req) => {
    const { id } = req.params as { id: string };
    const { log } = z.object({ log: z.string() }).parse(req.body);
    await deploymentsService.appendBuildLog(id, log);
    return { success: true };
  });

  fastify.post('/deployments/:id/deploy-logs', async (req) => {
    const { id } = req.params as { id: string };
    const { log } = z.object({ log: z.string() }).parse(req.body);
    await deploymentsService.appendDeployLog(id, log);
    return { success: true };
  });

  fastify.post('/deployments/:id/cancel', async (req) => {
    const { id } = req.params as { id: string };
    const result = await deploymentsService.cancel(id);
    return { success: true, data: result };
  });

  fastify.post('/sites/:siteId/deployments/:id/rollback', async (req) => {
    const { siteId, id } = req.params as { siteId: string; id: string };
    const result = await deploymentsService.rollback(siteId, id);
    return { success: true, data: result };
  });
}