import type { FastifyInstance } from 'fastify';
import { tokensService } from './tokens.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function tokensRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/tokens', async (req) => {
    return { success: true, data: await tokensService.listTokens(req.user.id) };
  });
}