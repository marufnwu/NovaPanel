import type { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { cloudflareTunnels } from '../../db/schema/tunnels.js';
import { users } from '../../db/schema/users.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { hashToken } from '../../utils/crypto.js';
import { authService } from '../auth/auth.service.js';

interface TunnelLogSession {
  ws: any;
  tunnelId: string;
  createdAt: Date;
}

const activeLogSessions = new Map<string, TunnelLogSession>();

export async function registerTunnelLogsWs(fastify: FastifyInstance) {
  // @ts-ignore — @fastify/websocket augments FastifyInstance with websocket route handler
  fastify.get('/ws/tunnel/logs', { websocket: true }, async (socket: any, req: any) => {
    const tunnelId = (req.query as any)?.tunnelId as string;

    if (!tunnelId) {
      socket.close(4001, 'Tunnel ID required');
      return;
    }

    const user = await validateAuth(req);
    if (!user) {
      socket.close(4001, 'Authentication required');
      return;
    }

    if (user.role !== 'admin') {
      socket.close(4003, 'Admin access required');
      return;
    }

    // Verify tunnel exists
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelId)).limit(1);
    
    if (!tunnel) {
      socket.close(4004, 'Tunnel not found');
      return;
    }

    const sessionId = `${tunnelId}-${Date.now()}`;
    activeLogSessions.set(sessionId, { ws: socket, tunnelId, createdAt: new Date() });

    logger.info({ userId: user.id, tunnelId }, 'Tunnel logs session opened');

    // Send initial connection message
    socket.send(JSON.stringify({
      type: 'connected',
      data: { tunnelId, tunnelName: tunnel.name },
    }));

    // Start tailing cloudflared logs
    const logProcess = spawnLogTail(tunnel.tunnelId!);

    if (logProcess) {
      logProcess.on('data', (data: Buffer) => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'log',
            data: data.toString(),
            timestamp: new Date().toISOString(),
          }));
        }
      });

      logProcess.on('error', (error: Error) => {
        logger.error({ error, tunnelId }, 'Log tail process error');
        socket.send(JSON.stringify({
          type: 'error',
          data: error.message,
          timestamp: new Date().toISOString(),
        }));
      });

      logProcess.on('close', () => {
        socket.send(JSON.stringify({
          type: 'closed',
          data: 'Log stream ended',
          timestamp: new Date().toISOString(),
        }));
      });
    }

    socket.on('close', () => {
      if (logProcess) {
        try {
          logProcess.kill();
        } catch {}
      }
      activeLogSessions.delete(sessionId);
      logger.info({ userId: user.id, tunnelId }, 'Tunnel logs WebSocket closed');
    });

    socket.on('message', (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        logger.error({ error }, 'Tunnel logs message parse error');
      }
    });
  });
}

function spawnLogTail(tunnelUuid: string): any {
  try {
    const { spawn } = require('child_process');
    
    // Tail the cloudflared logs using journalctl
    const logProcess = spawn('journalctl', [
      '-u',
      'cloudflared',
      '-f',
      '-n',
      '100',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return logProcess;
  } catch (error) {
    logger.error({ error, tunnelUuid }, 'Failed to spawn log tail process');
    return null;
  }
}

/**
 * Validate tunnel WS authentication.
 * 1. Try session cookie (sf_session) — preferred, secure
 * 2. Fallback: try query param sessionHash (SHA-256 hash of session ID)
 * 3. Fallback: try query param token (API token)
 */
async function validateAuth(req: any): Promise<any | null> {
  // 1. Try session cookie
  try {
    const sessionCookie = req.cookies?.sf_session;
    if (sessionCookie) {
      const result = await authService.validateSession(sessionCookie);
      if (result?.user && result.user.isActive) {
        return result.user;
      }
    }
  } catch {
    // Cookie parsing may fail
  }

  // 2. Try query param sessionHash (hash-based WS auth)
  const sessionHash = (req.query as any)?.sessionHash as string;
  if (sessionHash) {
    const result = await authService.validateSessionByHash(sessionHash);
    if (result?.user && result.user.isActive) {
      return result.user;
    }
  }

  // 3. Try query param token (API token)
  const token = (req.query as any)?.token as string;
  if (!token) return null;

  const tokenHash = hashToken(token);
  
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    if ((user as any).apiTokenHash === tokenHash && user.isActive) {
      return user;
    }
  }

  return null;
}

export function cleanupStaleLogSessions() {
  const now = Date.now();
  for (const [id, session] of activeLogSessions) {
    const age = now - session.createdAt.getTime();
    if (age > 30 * 60 * 1000) { // 30 minutes
      try {
        session.ws.close(1000, 'Session timeout');
      } catch {}
      activeLogSessions.delete(id);
    }
  }
}
