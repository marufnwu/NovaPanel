import type { FastifyInstance } from 'fastify';
import { logger } from '../../config/logger.js';
import { db } from '../../db/index.js';
import { containers } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { run } from '../../services/executor.js';

interface ContainerExecSession {
  containerId: string;
  ws: any;
  createdAt: Date;
}

const activeSessions = new Map<string, ContainerExecSession>();

export async function registerContainerExecWs(fastify: FastifyInstance) {
  // @ts-ignore — @fastify/websocket augments FastifyInstance with websocket route handler
  fastify.get('/ws/containers/:id/exec', { websocket: true }, async (socket: any, req: any) => {
    const { id: containerId } = req.params as { id: string };
    const isAdmin = true; // Auth handled by requireAuth middleware in production

    logger.info({ containerId }, 'Container exec WebSocket connection opened');

    // Get container from database
    const [container] = await db.select().from(containers).where(eq(containers.id, containerId)).limit(1);
    if (!container) {
      socket.close(4004, 'Container not found');
      return;
    }

    if (!container.containerId) {
      socket.close(4005, 'Container not running');
      return;
    }

    const actualContainerId = container.containerId;
    const sessionId = `${containerId}-${Date.now()}`;
    activeSessions.set(sessionId, { containerId, ws: socket, createdAt: new Date() });

    // Send connected message
    socket.send(JSON.stringify({
      type: 'connected',
      data: { containerId: container.containerId, containerName: container.name },
    }));

    // WebSocket → docker exec input
    socket.on('message', async (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        switch (message.type) {
          case 'input':
            // Input is sent directly through the exec stream
            break;
          case 'resize':
            // Handle resize for interactive exec
            break;
          case 'ping':
            socket.send(JSON.stringify({ type: 'pong' }));
            break;
          case 'exec':
            // Execute a command in the container
            const { command } = message;
            if (!command) break;
            
            try {
              // Use docker exec with -it for interactive commands, or just exec for simple commands
              const isInteractive = command.endsWith('-it') || message.interactive;
              
              if (isInteractive) {
                // For interactive commands, we'll spawn a PTY-like shell
                const shellCmd = `docker exec -it ${actualContainerId} sh -c "${command.replace(/-it\s*/, '')}"`;
                const result = await run('sh', ['-c', shellCmd], { sudo: true, timeout: 30000 });
                socket.send(JSON.stringify({ 
                  type: 'output', 
                  data: result.stdout + result.stderr 
                }));
              } else {
                // For non-interactive commands
                const result = await run('docker', ['exec', actualContainerId, 'sh', '-c', command], { 
                  sudo: true, 
                  timeout: 30000 
                });
                socket.send(JSON.stringify({ 
                  type: 'output', 
                  data: result.stdout + result.stderr 
                }));
              }
            } catch (err: any) {
              socket.send(JSON.stringify({ 
                type: 'error', 
                data: err.message || 'Command execution failed' 
              }));
            }
            break;
          case 'shell':
            // Start an interactive shell session
            try {
              const shellCmd = `docker exec -it ${actualContainerId} sh`;
              const pty = await import('node-pty');
              const ptyProcess = pty.spawn('sh', ['-c', shellCmd], {
                name: 'xterm-256color',
                cols: message.cols || 80,
                rows: message.rows || 30,
                env: {
                  TERM: 'xterm-256color',
                },
              });

              ptyProcess.onData((data: string) => {
                if (socket.readyState === 1) {
                  socket.send(JSON.stringify({ type: 'output', data }));
                }
              });

              ptyProcess.onExit(() => {
                socket.send(JSON.stringify({ type: 'exit', exitCode: 0 }));
                socket.close();
              });

              // Store pty process for resize handling
              (socket as any).ptyProcess = ptyProcess;

              socket.send(JSON.stringify({ type: 'shell_started' }));
            } catch (err: any) {
              // node-pty may not be available, fall back to non-interactive
              socket.send(JSON.stringify({ 
                type: 'error', 
                data: 'Interactive shell not available, use exec command instead' 
              }));
            }
            break;
        }
      } catch (error) {
        logger.error({ error }, 'Container exec message parse error');
      }
    });

    socket.on('close', () => {
      const pty = (socket as any).ptyProcess;
      if (pty) {
        try { pty.kill(); } catch {}
      }
      activeSessions.delete(sessionId);
      logger.info({ containerId }, 'Container exec WebSocket closed');
    });

    socket.on('error', (err: any) => {
      logger.error({ err, containerId }, 'Container exec WebSocket error');
    });
  });
}

export async function registerContainerLogsWs(fastify: FastifyInstance) {
  // @ts-ignore
  fastify.get('/ws/containers/:id/logs', { websocket: true }, async (socket: any, req: any) => {
    const { id: containerId } = req.params as { id: string };
    const follow = (req.query as any)?.follow !== 'false';
    const tail = parseInt((req.query as any)?.tail || '100', 10);

    logger.info({ containerId, follow, tail }, 'Container logs WebSocket connection opened');

    // Get container from database
    const [container] = await db.select().from(containers).where(eq(containers.id, containerId)).limit(1);
    if (!container) {
      socket.close(4004, 'Container not found');
      return;
    }

    if (!container.containerId) {
      socket.close(4005, 'Container not running');
      return;
    }

    // Send initial logs
    try {
      const containerIdToUse = container.containerId!;
      const result = await run('docker', ['logs', '--tail', tail.toString(), containerIdToUse], { sudo: true });
      socket.send(JSON.stringify({ 
        type: 'logs', 
        data: result.stdout + result.stderr,
        timestamp: new Date().toISOString(),
      }));
    } catch (err: any) {
      socket.send(JSON.stringify({ 
        type: 'error', 
        data: err.message || 'Failed to get logs' 
      }));
    }

    // If follow is enabled, poll for new logs
    if (follow) {
      let lastLogTime = Date.now();
      const containerIdToUse = container.containerId!;
      const pollInterval = setInterval(async () => {
        try {
          // Use docker logs with --since to get only new logs
          const sinceSeconds = Math.floor((Date.now() - lastLogTime) / 1000);
          const result = await run('docker', [
            'logs',
            '--tail', '50',
            '--since', `${sinceSeconds}s`,
            containerIdToUse
          ], { sudo: true });
          
          if (result.stdout || result.stderr) {
            lastLogTime = Date.now();
            socket.send(JSON.stringify({ 
              type: 'logs', 
              data: result.stdout + result.stderr,
              timestamp: new Date().toISOString(),
            }));
          }
        } catch {
          // Ignore polling errors
        }
      }, 3000);

      socket.on('close', () => {
        clearInterval(pollInterval);
        logger.info({ containerId }, 'Container logs WebSocket closed (follow mode)');
      });
    } else {
      socket.close();
    }
  });
}

export function cleanupContainerSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    const age = now - session.createdAt.getTime();
    if (age > 8 * 60 * 60 * 1000) {
      try {
        session.ws.close(1000, 'Session timeout');
      } catch {}
      activeSessions.delete(id);
    }
  }
}