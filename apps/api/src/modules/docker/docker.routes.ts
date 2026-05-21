import type { FastifyInstance } from 'fastify';
import { dockerService } from './docker.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { sites } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';

export default async function dockerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.post('/sites/:id/docker-build', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { deploymentsService } = await import('../deployments/deployments.service.js');
    const deployment = await deploymentsService.create({ siteId: id, sourceType: 'git' });
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    const buildDir = site?.gitRepo ? `/tmp/novapanel/builds/${id}/${deployment.id}` : undefined;
    dockerService.buildSite(id, deployment.id, buildDir).catch(err => {
      req.log.error({ err }, 'Build failed');
    });
    return reply.status(202).send({ success: true, data: { deploymentId: deployment.id } });
  });

  fastify.get('/sites/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const status = await dockerService.getContainerStatus(id);
    return { success: true, data: status };
  });

  fastify.get('/sites/:id/logs', async (req) => {
    const { id } = req.params as { id: string };
    const logs = await dockerService.streamLogs(id);
    return { success: true, data: { logs } };
  });

  fastify.post('/sites/:id/stop', async (req) => {
    const { id } = req.params as { id: string };
    await dockerService.stopSite(id);
    return { success: true, data: null };
  });

  fastify.get('/sites/:id/dockerfile', async (req) => {
    const { id } = req.params as { id: string };
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) return { success: false, error: 'Site not found' };
    const dockerfile = dockerService.generateDockerfileForRuntime(site.runtime, site.runtimeVersion || undefined, site.startCommand || undefined, site.port || undefined);
    return { success: true, data: { dockerfile } };
  });
}