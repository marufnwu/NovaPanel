import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import type { UserPayload } from '@novadash/shared';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const IGNORED_PATHS = ['/api/health', '/api/v1/auth/login', '/api/v1/auth/refresh'];

export async function auditMiddleware(app: FastifyInstance) {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!AUDITED_METHODS.has(request.method)) return;

    const path = request.url.split('?')[0];
    if (IGNORED_PATHS.some((p) => path.startsWith(p))) return;

    try {
      const payload = request.user as unknown as UserPayload | undefined;
      if (!payload?.sub) return;

      // Extract resource type from path: /api/v1/servers/:id/... -> "servers"
      const parts = path.replace('/api/v1/', '').split('/');
      const resource = parts[0] || 'unknown';
      const targetId = parts.length > 1 ? parts[1] : null;

      // Derive action from method
      const actionMap: Record<string, string> = {
        POST: 'create',
        PUT: 'update',
        PATCH: 'update',
        DELETE: 'delete',
      };
      const action = actionMap[request.method] || request.method.toLowerCase();

      await prisma.auditLog.create({
        data: {
          userId: payload.sub,
          action,
          targetType: resource,
          targetId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || null,
        },
      });
    } catch {
      // Don't fail requests over audit logging errors
    }
  });
}
