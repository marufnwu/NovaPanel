import type { FastifyInstance } from 'fastify';
import { jobEventBus } from '../../services/job-events.js';
import { authService } from '../auth/auth.service.js';
import { logger } from '../../config/logger.js';

const activeConnections = new Set<any>();

export async function registerJobsWs(fastify: FastifyInstance) {
  const unsubscribe = jobEventBus.onJob((event) => {
    const payload = JSON.stringify(event);
    for (const socket of activeConnections) {
      if (socket.readyState === 1) {
        socket.send(payload);
      }
    }
  });

  fastify.addHook('onClose', () => {
    unsubscribe();
    activeConnections.clear();
  });

  // @ts-ignore
  fastify.get('/ws/jobs', { websocket: true }, async (socket: any, req: any) => {
    const user = await validateAuth(req);
    if (!user) {
      socket.close(4001, 'Authentication required');
      return;
    }

    activeConnections.add(socket);
    logger.info({ userId: user.id }, 'Jobs WebSocket connected');

    socket.send(JSON.stringify({
      type: 'connected',
      status: 'connected',
      timestamp: new Date().toISOString(),
    }));

    socket.on('close', () => {
      activeConnections.delete(socket);
      logger.info({ userId: user.id }, 'Jobs WebSocket disconnected');
    });

    socket.on('error', (err: any) => {
      logger.error({ err, userId: user.id }, 'Jobs WebSocket error');
      activeConnections.delete(socket);
    });

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {}
    });
  });
}

async function validateAuth(req: any) {
  const sessionCookie = req.cookies?.sf_session;
  if (sessionCookie) {
    const result = await authService.validateSession(sessionCookie);
    if (result?.user && result.user.isActive) return result.user;
  }

  const sessionHash = (req.query as any)?.sessionHash;
  if (sessionHash) {
    const result = await authService.validateSessionByHash(sessionHash);
    if (result?.user && result.user.isActive) return result.user;
  }

  return null;
}