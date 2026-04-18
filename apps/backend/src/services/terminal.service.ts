import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { Client } from 'ssh2';
import { verify } from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from './crypto.service.js';
import type { UserPayload } from '@novadash/shared';

export function setupTerminalWSS(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/terminal' });

  wss.on('connection', async (ws, request) => {
    // Authenticate via query param ticket
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('ticket');
    const serverId = url.searchParams.get('serverId');

    if (!token || !serverId) {
      ws.close(4001, 'Missing ticket or serverId');
      return;
    }

    let user: UserPayload;
    try {
      user = verify(token, config.JWT_SECRET) as UserPayload;
    } catch {
      ws.close(4001, 'Invalid ticket');
      return;
    }

    // Verify server belongs to user's team
    const srv = await prisma.server.findFirst({
      where: { id: serverId, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });

    if (!srv) {
      ws.close(4004, 'Server not found');
      return;
    }

    // Establish SSH connection
    const sshClient = new Client();
    const sshConfig: Record<string, unknown> = {
      host: srv.host,
      port: srv.port,
      username: srv.username,
      readyTimeout: 10000,
    };

    if (srv.authType === 'key' && srv.sshKey) {
      sshConfig.privateKey = decrypt(srv.sshKey.privateKeyEncrypted);
    } else if (srv.authType === 'password' && srv.passwordEncrypted) {
      sshConfig.password = decrypt(srv.passwordEncrypted);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stream: any = null;

    sshClient.on('ready', () => {
      sshClient.shell({ term: 'xterm-256color' }, (err, shellStream) => {
        if (err) {
          ws.send(JSON.stringify({ type: 'error', data: err.message }));
          ws.close();
          return;
        }

        stream = shellStream;

        shellStream.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString('base64') }));
          }
        });

        shellStream.stderr.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString('base64') }));
          }
        });

        shellStream.on('close', () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'exit' }));
            ws.close();
          }
        });

        ws.send(JSON.stringify({ type: 'connected' }));
      });
    });

    sshClient.on('error', (err) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', data: err.message }));
        ws.close();
      }
    });

    try {
      sshClient.connect(sshConfig);
    } catch (err) {
      ws.close(5000, 'SSH connection failed');
      return;
    }

    // Handle messages from frontend
    ws.on('message', (raw) => {
      if (!stream) return;
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'input':
            stream.write(Buffer.from(msg.data, 'base64'));
            break;
          case 'resize':
            if (msg.cols && msg.rows) {
              stream.setWindow(msg.rows, msg.cols, 0, 0);
            }
            break;
        }
      } catch {
        // ignore malformed messages
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      stream?.close();
      sshClient.end();
    });
  });
}
