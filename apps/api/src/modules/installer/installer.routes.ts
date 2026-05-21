import type { FastifyInstance } from 'fastify';
import { installerService } from './installer.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function installerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/installer/apps', async () => {
    return { success: true, data: await installerService.getAvailableApps() };
  });

  fastify.get('/installer/apps/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await installerService.getApp(id) };
  });
}