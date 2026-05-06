import type { FastifyInstance } from 'fastify';
import { logger } from '../../config/logger.js';
import { authService } from '../auth/auth.service.js';

interface TerminalSession {
  ptyProcess: any;
  ws: any;
  createdAt: Date;
}

const activeSessions = new Map<string, TerminalSession>();

export async function registerTerminalWs(fastify: FastifyInstance) {
  // @ts-ignore — @fastify/websocket augments FastifyInstance with websocket route handler
  fastify.get('/ws/terminal', { websocket: true }, async (socket: any, req: any) => {
    const user = await validateTerminalAuth(req);

    if (!user) {
      socket.close(4001, 'Authentication required');
      return;
    }

    const isAdmin = user.role === 'admin';
    const shell = isAdmin ? '/bin/bash' : '/bin/rbash';
    // For admin users, use /opt/novapanel as home dir since /root is not accessible to the novapanel service user
    const homeDir = isAdmin ? '/opt/novapanel' : `/var/www/vhosts/${user.username}`;
    // Use 'novapanel' as username instead of 'root' since node-pty runs as novapanel user
    const username = isAdmin ? 'novapanel' : user.username;

    logger.info({ userId: user.id, username, role: user.role }, 'Terminal session opened');

    // Try to spawn PTY (node-pty may not be available)
    let ptyProcess: any = null;
    try {
      const pty = await import('node-pty');
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: homeDir,
        env: {
          HOME: homeDir,
          USER: username,
          TERM: 'xterm-256color',
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        },
      });
    } catch {
      socket.send(JSON.stringify({ type: 'error', data: 'node-pty not available on this server' }));
      socket.close();
      return;
    }

    const sessionId = `${user.id}-${Date.now()}`;
    activeSessions.set(sessionId, { ptyProcess, ws: socket, createdAt: new Date() });

    // PTY output → WebSocket
    ptyProcess.onData((data: string) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      socket.send(JSON.stringify({ type: 'exit', exitCode }));
      socket.close();
      activeSessions.delete(sessionId);
      logger.info({ userId: user.id, exitCode }, 'Terminal session ended');
    });

    // WebSocket → PTY input
    socket.on('message', (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        switch (message.type) {
          case 'input':
            ptyProcess.write(message.data);
            break;
          case 'resize':
            if (message.cols && message.rows) {
              try { ptyProcess.resize(message.cols, message.rows); } catch {}
            }
            break;
          case 'ping':
            socket.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        logger.error({ error }, 'Terminal message parse error');
      }
    });

    socket.on('close', () => {
      try { ptyProcess.kill(); } catch {}
      activeSessions.delete(sessionId);
      logger.info({ userId: user.id }, 'Terminal WebSocket closed');
    });

    socket.send(JSON.stringify({
      type: 'connected',
      data: { shell, homeDir, username, role: user.role },
    }));
  });
}

/**
 * Validate terminal WS authentication.
 * 1. Try session cookie (sf_session) — preferred, secure
 * 2. Fallback: try query param sessionHash (SHA-256 hash of session ID)
 * 3. Fallback: try query param token (API token)
 */
async function validateTerminalAuth(req: any): Promise<any | null> {
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
  if (token) {
    const user = await authService.validateApiToken(token);
    if (user && user.isActive) {
      return user;
    }
  }

  return null;
}

export function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    const age = now - session.createdAt.getTime();
    if (age > 8 * 60 * 60 * 1000) {
      try {
        session.ptyProcess.kill();
        session.ws.close(1000, 'Session timeout');
      } catch {}
      activeSessions.delete(id);
    }
  }
}
