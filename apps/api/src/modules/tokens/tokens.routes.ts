import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tokensService } from './tokens.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createTokenSchema = z.object({
  name: z.string().min(1),
  expiresIn: z.enum(['30d', '90d', '1y', 'never']),
  permissions: z.array(z.string()),
});

export default async function tokensRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/tokens', async (req) => {
    return { success: true, data: await tokensService.listTokens(req.user.id) };
  });

  fastify.post('/tokens', async (req, reply) => {
    const { name, expiresIn, permissions } = createTokenSchema.parse(req.body);
    let expiresAt: Date | undefined;
    if (expiresIn === '30d') expiresAt = new Date(Date.now() + 30 * 86400 * 1000);
    else if (expiresIn === '90d') expiresAt = new Date(Date.now() + 90 * 86400 * 1000);
    else if (expiresIn === '1y') expiresAt = new Date(Date.now() + 365 * 86400 * 1000);
    const result = await tokensService.createToken(req.user.id, name, expiresAt, req.ip);
    return reply.status(201).send({ success: true, data: result });
  });

  fastify.delete('/tokens/:tokenId', async (req) => {
    const { tokenId } = req.params as { tokenId: string };
    const result = await tokensService.revokeToken(tokenId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/tokens/:tokenId/usage', async (req) => {
    const { tokenId } = req.params as { tokenId: string };
    return { success: true, data: [] };
  });
}