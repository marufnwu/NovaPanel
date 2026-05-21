import type { FastifyInstance } from 'fastify';
import { logger } from '../../config/logger.js';

interface TunnelLogSession {
  ws: any;
  tunnelId: string;
  createdAt: Date;
}

const activeLogSessions = new Map<string, TunnelLogSession>();

export async function registerTunnelLogsWs(fastify: FastifyInstance) {
  // @ts-ignore — @fastify/websocket augments FastifyInstance with websocket route handler
  fastify.get('/ws/tunnel/logs', { websocket: true }, async (socket: any, req: any) => {
    logger.info({ url: req.url }, 'WebSocket connection to tunnel logs');
  });
}