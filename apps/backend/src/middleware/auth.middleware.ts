import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { UserPayload } from '@novadash/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserPayload;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api/v1/')) return;
    if (request.url === '/api/v1/auth/register') return;
    if (request.url === '/api/v1/auth/login') return;
    if (request.url === '/api/v1/auth/refresh') return;
    if (request.url === '/api/health') return;

    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ ok: false, error: 'Unauthorized' });
    }
  });
}

export const authMiddleware = fp(authPlugin);

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as unknown as UserPayload;
    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({ ok: false, error: 'Forbidden' });
    }
  };
}
