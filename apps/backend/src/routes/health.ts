import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (_request, reply) => {
    let db = 'disconnected';
    let cache = 'disconnected';

    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'connected';
    } catch {
      // db check failed
    }

    try {
      const pong = await redis.ping();
      cache = pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      // redis check failed
    }

    const healthy = db === 'connected' && cache === 'connected';
    reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      db,
      redis: cache,
    });
  });
}
