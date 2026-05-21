import type { FastifyInstance } from 'fastify';
import { buildService } from './build.service.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function buildRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.post('/sites/:id/deploy', async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await buildService.runFullDeployPipeline(id);
    return reply.status(202).send({ success: true, data: result });
  });

  fastify.post('/sites/:id/build', async (req, reply) => {
    const { id } = req.params as { id: string };
    const deployment = await deploymentsService.create({ siteId: id, sourceType: 'git' });
    buildService.runBuild(id, deployment.id).catch(err => {
      req.log.error({ err }, 'Build failed');
    });
    return reply.status(202).send({ success: true, data: { deploymentId: deployment.id } });
  });

  fastify.get('/sites/:id/dockerfile', async (req) => {
    const { id } = req.params as { id: string };
    const dockerfile = await buildService.generateDockerfile(id);
    return { success: true, data: { dockerfile } };
  });

  fastify.get('/sites/:id/runtime', async (req) => {
    const { id } = req.params as { id: string };
    const homeDir = `/var/www/sites/${id}`;
    const detected = buildService.detectRuntime(homeDir);
    return { success: true, data: detected };
  });
}