import type { FastifyInstance } from 'fastify';
import { PhpService } from './php.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function phpRoutes(fastify: FastifyInstance) {
  const service = new PhpService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/php/versions', async () => {
    return { success: true, data: await service.listVersions() };
  });

  fastify.get('/php/domains', async () => {
    return { success: true, data: await service.listDomainsWithPhpVersion() };
  });
}