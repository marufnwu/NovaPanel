import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tokensService } from './tokens.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const generateTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresIn: z.enum(['30d', '90d', '1y', 'never']).default('never'),
  permissions: z.array(z.string()).min(1),
});

export default async function tokensRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /tokens — List all tokens for authenticated user
  fastify.get('/tokens', {
    handler: async (req) => {
      const data = tokensService.listTokens(req.user.id);
      return { success: true, data };
    },
  });

  // POST /tokens — Generate a new API token
  fastify.post('/tokens', {
    handler: async (req) => {
      const body = generateTokenSchema.parse(req.body);
      const data = tokensService.generateToken({
        userId: req.user.id,
        name: body.name,
        expiresIn: body.expiresIn,
        permissions: body.permissions,
      }, req.ip);
      return { success: true, data };
    },
  });

  // DELETE /tokens/:id — Revoke a token
  fastify.delete('/tokens/:id', {
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const data = tokensService.revokeToken(req.user.id, id, req.ip);
      return { success: true, data };
    },
  });

  // GET /tokens/:id/usage — Get token usage history
  fastify.get('/tokens/:id/usage', {
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const data = tokensService.getTokenUsage(req.user.id, id);
      return { success: true, data };
    },
  });
}
