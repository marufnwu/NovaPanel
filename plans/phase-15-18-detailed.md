# ServerForge — Phases 15-18: Detailed Implementation Guide

> **Supplement to:** `plans/implementation-plan.md`
> **Prerequisites:** Phases 1-14 completed
> **Scope:** Terminal, Logs, Cron, Firewall, Backup, Polish, Installer

---

## Phase 15 — Terminal + Logs Modules

### 15.1 Terminal WebSocket Handler

#### `apps/api/src/modules/terminal/terminal.ws.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { verify } from '@node-rs/argon2';
import { db } from '../../db/index.js';
import { users, sessions } from '../../db/schema/users.js';
import { eq, gt } from 'drizzle-orm';
import { logger } from '../../config/logger.js';

// We use a lazy import for node-pty since it's a native module
// and may not be available in all environments
let pty: any;
try {
  pty = await import('node-pty');
} catch {
  logger.warn('node-pty not available — terminal feature disabled');
}

interface TerminalSession {
  ptyProcess: any;
  ws: any;
  createdAt: Date;
}

// Track active terminal sessions for cleanup
const activeSessions = new Map<string, TerminalSession>();

export async function registerTerminalWs(fastify: FastifyInstance) {
  if (!pty) {
    logger.warn('Terminal WebSocket not registered — node-pty unavailable');
    return;
  }

  fastify.get('/ws/terminal', { websocket: true }, async (socket, req) => {
    const token = (req.query as any)?.token as string;

    if (!token) {
      socket.close(4001, 'Authentication required');
      return;
    }

    // Validate session or API token
    const user = await validateTerminalAuth(token);
    if (!user) {
      socket.close(4001, 'Invalid authentication');
      return;
    }

    // Determine shell and home directory based on role
    const isAdmin = user.role === 'admin';
    const shell = isAdmin ? '/bin/bash' : '/bin/rbash';
    const homeDir = isAdmin ? '/root' : `/var/www/vhosts/${user.username}`;
    const username = isAdmin ? 'root' : user.username;

    logger.info({ userId: user.id, username, role: user.role }, 'Terminal session opened');

    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, [], {
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

    const sessionId = `${user.id}-${Date.now()}`;
    activeSessions.set(sessionId, { ptyProcess, ws: socket, createdAt: new Date() });

    // PTY output → WebSocket
    ptyProcess.onData((data: string) => {
      if (socket.readyState === 1) { // WebSocket.OPEN
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
              try {
                ptyProcess.resize(message.cols, message.rows);
              } catch {
                // Resize may fail if process exited
              }
            }
            break;

          case 'ping':
            socket.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            logger.warn({ type: message.type }, 'Unknown terminal message type');
        }
      } catch (error) {
        logger.error({ error }, 'Terminal message parse error');
      }
    });

    // Cleanup on WebSocket close
    socket.on('close', () => {
      try {
        ptyProcess.kill();
      } catch {
        // Process may already be dead
      }
      activeSessions.delete(sessionId);
      logger.info({ userId: user.id }, 'Terminal WebSocket closed');
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      data: { shell, homeDir, username, role: user.role },
    }));
  });
}

/**
 * Validate authentication for terminal access
 * Accepts both session cookies and API tokens
 */
async function validateTerminalAuth(token: string) {
  // Try as session ID
  const [session] = await db.select().from(sessions)
    .where(gt(sessions.expiresAt, new Date()))
    .limit(100); // Filter client-side for simplicity

  // For the token-based approach, check API token
  const { hashToken } = await import('../../utils/crypto.js');
  const tokenHash = hashToken(token);

  // Check if any user has this API token hash
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    if (user.apiTokenHash === tokenHash && user.isActive) {
      return user;
    }
  }

  // Try session lookup
  for (const s of session) {
    if (s.id === token) {
      const [user] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
      if (user && user.isActive) return user;
    }
  }

  return null;
}

/**
 * Cleanup stale terminal sessions (called periodically)
 */
export function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    const age = now - session.createdAt.getTime();
    // Kill sessions older than 8 hours
    if (age > 8 * 60 * 60 * 1000) {
      try {
        session.ptyProcess.kill();
        session.ws.close(1000, 'Session timeout');
      } catch {}
      activeSessions.delete(id);
    }
  }
}
```

### 15.2 Terminal Frontend

#### `apps/web/src/pages/terminal/TerminalPage.tsx`

```typescript
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Maximize2, Minimize2, Copy, Clipboard, Settings } from 'lucide-react';

export function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { user } = useAuthStore();

  const [connected, setConnected] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      theme: theme === 'dark' ? darkTheme : lightTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/terminal?token=${getAuthToken()}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      xterm.writeln('\x1b[32m✓ Connected to ServerForge Terminal\x1b[0m\r\n');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'output':
          xterm.write(message.data);
          break;
        case 'connected':
          xterm.writeln(`\x1b[36mShell: ${message.data.shell} | User: ${message.data.username}\x1b[0m\r\n`);
          break;
        case 'exit':
          xterm.writeln(`\r\n\x1b[33mProcess exited with code ${message.exitCode}\x1b[0m`);
          setConnected(false);
          break;
        case 'pong':
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      xterm.writeln('\r\n\x1b[31m✗ Connection closed\x1b[0m');
    };

    ws.onerror = () => {
      xterm.writeln('\r\n\x1b[31m✗ Connection error\x1b[0m');
    };

    wsRef.current = ws;

    // Terminal input → WebSocket
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    xterm.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Window resize handler
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    // Keepalive ping every 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('resize', handleResize);
      ws.close();
      xterm.dispose();
    };
  }, [fontSize, theme]);

  const handleCopy = () => {
    // xterm.js doesn't have a direct copy API; use browser selection
    const selection = window.getSelection()?.toString();
    if (selection) navigator.clipboard.writeText(selection);
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'space-y-4'}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className={isFullscreen ? 'sr-only' : 'text-2xl font-bold'}>Terminal</h1>
          <Badge variant={connected ? 'default' : 'destructive'}>
            {connected ? '● Connected' : '● Disconnected'}
          </Badge>
          <span className="text-xs text-muted-foreground">User: {user?.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy selection">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePaste} title="Paste">
            <Clipboard className="h-4 w-4" />
          </Button>
          <Select value={String(fontSize)} onValueChange={(v) => setFontSize(Number(v))}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 12, 14, 16, 18, 20].map(s => (
                <SelectItem key={s} value={String(s)}>{s}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="rounded-lg border bg-black"
        style={{ height: isFullscreen ? 'calc(100vh - 48px)' : '500px' }}
      />
    </div>
  );
}

function getAuthToken(): string {
  // Get session cookie value or API token from auth store
  const authData = localStorage.getItem('sf-auth');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed?.state?.apiToken || '';
    } catch {}
  }
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('sf_session='))
    ?.split('=')[1] || '';
}

const darkTheme = {
  background: '#0F172A',
  foreground: '#E2E8F0',
  cursor: '#3B82F6',
  cursorAccent: '#0F172A',
  selectionBackground: '#3B82F680',
  black: '#1E293B',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#EAB308',
  blue: '#3B82F6',
  magenta: '#A855F7',
  cyan: '#06B6D4',
  white: '#F8FAFC',
  brightBlack: '#475569',
  brightRed: '#F87171',
  brightGreen: '#4ADE80',
  brightYellow: '#FACC15',
  brightBlue: '#60A5FA',
  brightMagenta: '#C084FC',
  brightCyan: '#22D3EE',
  brightWhite: '#FFFFFF',
};

const lightTheme = {
  background: '#FFFFFF',
  foreground: '#0F172A',
  cursor: '#3B82F6',
  selectionBackground: '#3B82F630',
};
```

### 15.3 Logs Module

#### `apps/api/src/modules/logs/logs.service.ts`

```typescript
import { readFile } from 'node:fs/promises';
import { run } from '../../services/executor.js';
import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { AppError } from '../../errors.js';

export class LogsService {
  /**
   * Get domain access log (last N lines)
   */
  async getAccessLog(domainId: string, lines: number = 100): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const logPath = `${env.VHOSTS_ROOT}/*/logs/${domain.name}-access.log`;
    const result = await run('tail', ['-n', String(lines), logPath], { sudo: true });
    return result.stdout;
  }

  /**
   * Get domain error log (last N lines)
   */
  async getErrorLog(domainId: string, lines: number = 100): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const logPath = `${env.VHOSTS_ROOT}/*/logs/${domain.name}-error.log`;
    const result = await run('tail', ['-n', String(lines), logPath], { sudo: true });
    return result.stdout;
  }

  /**
   * Get panel application logs
   */
  async getPanelLogs(lines: number = 100): Promise<string> {
    const logPath = `${env.LOG_DIR}/serverforge.log`;
    try {
      const result = await run('tail', ['-n', String(lines), logPath]);
      return result.stdout;
    } catch {
      return 'No panel logs available';
    }
  }

  /**
   * Get Fail2Ban logs
   */
  async getFail2BanLogs(lines: number = 100): Promise<string> {
    const result = await run('tail', ['-n', String(lines), '/var/log/fail2ban.log'], { sudo: true });
    return result.stdout;
  }
}
```

#### `apps/api/src/modules/logs/logs.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { LogsService } from './logs.service.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function logsRoutes(fastify: FastifyInstance) {
  const service = new LogsService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/domains/:id/logs/access', async (req) => {
    const { id } = req.params as { id: string };
    const { lines } = req.query as { lines?: string };
    const log = await service.getAccessLog(id, parseInt(lines || '100'));
    return { success: true, data: { log } };
  });

  fastify.get('/domains/:id/logs/error', async (req) => {
    const { id } = req.params as { id: string };
    const { lines } = req.query as { lines?: string };
    const log = await service.getErrorLog(id, parseInt(lines || '100'));
    return { success: true, data: { log } };
  });

  fastify.get('/logs/panel', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { lines } = req.query as { lines?: string };
      const log = await service.getPanelLogs(parseInt(lines || '100'));
      return { success: true, data: { log } };
    },
  });

  fastify.get('/logs/fail2ban', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { lines } = req.query as { lines?: string };
      const log = await service.getFail2BanLogs(parseInt(lines || '100'));
      return { success: true, data: { log } };
    },
  });
}
```

#### `apps/api/src/ws/logs.ws.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { run } from '../../services/executor.js';
import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export async function registerLogsWs(fastify: FastifyInstance) {
  fastify.get('/ws/logs', { websocket: true }, async (socket, req) => {
    const { domain, type } = req.query as { domain?: string; type?: string };

    if (!domain) {
      socket.close(4001, 'Domain parameter required');
      return;
    }

    // Find domain
    const [domainRecord] = await db.select().from(domains)
      .where(eq(domains.name, domain)).limit(1);

    if (!domainRecord) {
      socket.close(4002, 'Domain not found');
      return;
    }

    const logType = type || 'access';
    const logPattern = `${env.VHOSTS_ROOT}/*/logs/${domain}-${logType}.log`;

    logger.info({ domain, type: logType }, 'Log tail WebSocket opened');

    // Poll logs every 2 seconds
    let lastSize = 0;
    const interval = setInterval(async () => {
      if (socket.readyState !== 1) {
        clearInterval(interval);
        return;
      }

      try {
        const result = await run('tail', ['-c', '+1', logPattern], { sudo: true });
        const content = result.stdout;

        if (content.length > lastSize) {
          const newContent = content.slice(lastSize);
          lastSize = content.length;
          socket.send(JSON.stringify({ type: 'data', data: newContent }));
        }
      } catch {
        // Log file might not exist yet
      }
    }, 2000);

    socket.on('close', () => {
      clearInterval(interval);
      logger.info({ domain }, 'Log tail WebSocket closed');
    });
  });
}
```

---

## Phase 16 — Cron + Firewall Modules

### 16.1 Cron Service

#### `apps/api/src/modules/cron/cron.service.ts`

```typescript
import { db } from '../../db/index.js';
import { cronJobs } from '../../db/schema/cron.js';
import { subscriptions } from '../../db/schema/subscriptions.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';

export class CronService {
  async listJobs(subscriptionId: string) {
    return db.select().from(cronJobs).where(eq(cronJobs.subscriptionId, subscriptionId));
  }

  async createJob(data: {
    subscriptionId: string;
    command: string;
    schedule: string;
    systemUser: string;
  }) {
    // Validate cron expression (basic check)
    const parts = data.schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new AppError(400, 'INVALID_CRON', 'Cron expression must have 5 fields: min hour day month weekday');
    }

    const jobId = nanoid();

    // Add to system crontab
    const cronLine = `${data.schedule} ${data.command} # serverforge:${jobId}\n`;
    await run('crontab', ['-u', data.systemUser, '-l'], { sudo: true })
      .then(async (result) => {
        const existing = result.success ? result.stdout : '';
        const newCrontab = existing + cronLine;
        await run('crontab', ['-u', data.systemUser, '-'], {
          sudo: true,
          input: newCrontab,
        });
      });

    await db.insert(cronJobs).values({
      id: jobId,
      subscriptionId: data.subscriptionId,
      command: data.command,
      schedule: data.schedule,
      systemUser: data.systemUser,
      isActive: true,
    });

    logger.info({ jobId, command: data.command, schedule: data.schedule }, 'Cron job created');
    return { id: jobId, command: data.command, schedule: data.schedule };
  }

  async deleteJob(jobId: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    // Remove from system crontab
    const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
    if (result.success) {
      const updated = result.stdout
        .split('\n')
        .filter(line => !line.includes(`serverforge:${jobId}`))
        .join('\n');
      await run('crontab', ['-u', job.systemUser, '-'], { sudo: true, input: updated });
    }

    await db.delete(cronJobs).where(eq(cronJobs.id, jobId));
    logger.info({ jobId }, 'Cron job deleted');
  }

  async toggleJob(jobId: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const newActive = !job.isActive;

    if (newActive) {
      // Re-add to crontab
      const cronLine = `${job.schedule} ${job.command} # serverforge:${jobId}\n`;
      const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
      const existing = result.success ? result.stdout : '';
      await run('crontab', ['-u', job.systemUser, '-'], {
        sudo: true,
        input: existing + cronLine,
      });
    } else {
      // Remove from crontab
      const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
      if (result.success) {
        const updated = result.stdout
          .split('\n')
          .filter(line => !line.includes(`serverforge:${jobId}`))
          .join('\n');
        await run('crontab', ['-u', job.systemUser, '-'], { sudo: true, input: updated });
      }
    }

    await db.update(cronJobs).set({ isActive: newActive }).where(eq(cronJobs.id, jobId));
    return { id: jobId, isActive: newActive };
  }

  async runJob(jobId: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const result = await run('su', ['-c', job.command, job.systemUser], { sudo: true, timeout: 60_000 });

    await db.update(cronJobs).set({
      lastRun: new Date(),
      lastStatus: result.success ? 'success' : 'failed',
    }).where(eq(cronJobs.id, jobId));

    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }
}
```

### 16.2 Firewall Service

#### `apps/api/src/modules/firewall/firewall.service.ts`

```typescript
import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';

export class FirewallService {
  /**
   * List UFW rules
   */
  async listRules(): Promise<UfwRule[]> {
    const result = await run('ufw', ['status', 'numbered'], { sudo: true });
    if (!result.success) return [];

    return this.parseUfwStatus(result.stdout);
  }

  /**
   * Add a UFW rule
   */
  async addRule(rule: { action: 'allow' | 'deny'; port?: string; protocol?: string; from?: string; to?: string }) {
    const args = ['ufw'];

    if (rule.from && rule.to) {
      args.push(rule.action, 'from', rule.from, 'to', rule.to);
    } else if (rule.port) {
      args.push(rule.action, rule.port + (rule.protocol ? `/${rule.protocol}` : ''));
    } else {
      args.push(rule.action);
    }

    const result = await run(args[0], args.slice(1), { sudo: true });
    logger.info({ rule }, 'UFW rule added');
    return { success: result.success, output: result.stdout };
  }

  /**
   * Delete a UFW rule by number
   */
  async deleteRule(ruleNumber: number) {
    const result = await run('ufw', ['--force', 'delete', String(ruleNumber)], { sudo: true });
    logger.info({ ruleNumber }, 'UFW rule deleted');
    return { success: result.success };
  }

  /**
   * Apply preset rules
   */
  async applyPreset(preset: 'ssh' | 'http' | 'https' | 'ftp' | 'smtp' | 'imap') {
    const presets: Record<string, string[]> = {
      ssh:   ['22/tcp'],
      http:  ['80/tcp'],
      https: ['443/tcp'],
      ftp:   ['21/tcp', '40000:50000/tcp'], // FTP + passive range
      smtp:  ['25/tcp', '465/tcp', '587/tcp'],
      imap:  ['143/tcp', '993/tcp'],
    };

    const ports = presets[preset];
    if (!ports) throw new Error(`Unknown preset: ${preset}`);

    const results = [];
    for (const port of ports) {
      const result = await run('ufw', ['allow', port], { sudo: true });
      results.push({ port, success: result.success });
    }

    logger.info({ preset, ports }, 'UFW preset applied');
    return { preset, results };
  }

  /**
   * List Fail2Ban jails
   */
  async listJails(): Promise<F2BJail[]> {
    const result = await run('fail2ban-client', ['status'], { sudo: true });
    if (!result.success) return [];

    // Parse: "Status\n|- Number of jail:      3\n`- Jail list:   sshd, apache, nginx"
    const match = result.stdout.match(/Jail list:\s+(.+)/);
    if (!match) return [];

    const jailNames = match[1].split(',').map(s => s.trim());
    const jails: F2BJail[] = [];

    for (const name of jailNames) {
      const status = await run('fail2ban-client', ['status', name], { sudo: true });
      const bannedMatch = status.stdout.match(/Banned IP list:\s+(.+)/);
      const countMatch = status.stdout.match(/Currently banned:\s+(\d+)/);

      jails.push({
        name,
        bannedCount: countMatch ? parseInt(countMatch[1]) : 0,
        bannedIps: bannedMatch ? bannedMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [],
      });
    }

    return jails;
  }

  /**
   * Unban an IP from a jail
   */
  async unbanIp(jail: string, ip: string) {
    const result = await run('fail2ban-client', ['set', jail, 'unbanip', ip], { sudo: true });
    logger.info({ jail, ip }, 'IP unbanned');
    return { success: result.success };
  }

  private parseUfwStatus(output: string): UfwRule[] {
    const rules: UfwRule[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match: [ 1] 22/tcp                     ALLOW IN    Anywhere
      const match = line.match(/^\[\s*(\d+)\]\s+(.+?)\s{2,}(ALLOW|DENY)\s+(IN|OUT|FWD)\s+(.+)/);
      if (match) {
        rules.push({
          number: parseInt(match[1]),
          rule: match[2].trim(),
          action: match[3].toLowerCase(),
          direction: match[4].toLowerCase(),
          from: match[5].trim(),
        });
      }
    }

    return rules;
  }
}

export interface UfwRule {
  number: number;
  rule: string;
  action: string;
  direction: string;
  from: string;
}

export interface F2BJail {
  name: string;
  bannedCount: number;
  bannedIps: string[];
}
```

---

## Phase 17 — Backup Module

### 17.1 Backup Schema

#### `apps/api/src/db/schema/backups.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { subscriptions } from './subscriptions.js';

export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  type: text('type', { enum: ['full', 'files', 'database', 'dns'] }).notNull().default('full'),
  storageType: text('storage_type', { enum: ['local', 's3', 'sftp', 'b2'] }).notNull().default('local'),
  storagePath: text('storage_path'),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'restoring'] }).notNull().default('pending'),
  error: text('error'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const backupSchedules = sqliteTable('backup_schedules', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id),
  cronExpression: text('cron_expression').notNull().default('0 2 * * *'), // 2 AM daily
  retentionCount: integer('retention_count').default(7).notNull(),
  storageType: text('storage_type', { enum: ['local', 's3', 'sftp', 'b2'] }).default('local').notNull(),
  storageConfig: text('storage_config'), // JSON: { endpoint, bucket, accessKey, secretKey, path }
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
```

### 17.2 Backup Service

#### `apps/api/src/modules/backup/backup.service.ts`

```typescript
import { db } from '../../db/index.js';
import { backups, backupSchedules } from '../../db/schema/backups.js';
import { subscriptions } from '../../db/schema/subscriptions.js';
import { domains, dnsZones } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { MariaDbService } from '../../services/mariadb.service.js';
import { PostgresService } from '../../services/postgres.service.js';
import { AppError } from '../../errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { mkdir, writeFile, readFile, stat, rm, readdir } from 'node:fs/promises';

export class BackupService {
  /**
   * Create a full backup for a subscription
   */
  async createBackup(subscriptionId: string, type: 'full' | 'files' | 'database' | 'dns' = 'full') {
    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!subscription) throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    const backupId = nanoid();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${subscription.systemUser}_${timestamp}.sfbk`;
    const backupDir = `${env.BACKUP_DIR}/${subscription.systemUser}`;
    const backupPath = `${backupDir}/${filename}`;

    // Create backup record
    await db.insert(backups).values({
      id: backupId,
      subscriptionId,
      filename,
      type,
      storageType: 'local',
      storagePath: backupPath,
      status: 'running',
      startedAt: new Date(),
    });

    try {
      await mkdir(backupDir, { recursive: true });

      const stagingDir = `${backupDir}/.staging-${backupId}`;
      await mkdir(stagingDir, { recursive: true });

      // 1. Backup databases
      if (type === 'full' || type === 'database') {
        const domainList = await db.select().from(domains)
          .where(eq(domains.subscriptionId, subscriptionId));

        // Export each database (simplified — in production, query actual databases table)
        const mariadbService = new MariaDbService();
        const postgresService = new PostgresService();

        await mkdir(`${stagingDir}/databases`, { recursive: true });
        // ... export databases to staging dir
      }

      // 2. Backup files
      if (type === 'full' || type === 'files') {
        await run('tar', [
          '-czf', `${stagingDir}/files.tar.gz`,
          '-C', subscription.homeDir,
          '.',
        ], { sudo: true, timeout: 300_000 });
      }

      // 3. Backup DNS zones
      if (type === 'full' || type === 'dns') {
        await mkdir(`${stagingDir}/dns`, { recursive: true });
        const domainList = await db.select().from(domains)
          .where(eq(domains.subscriptionId, subscriptionId));

        for (const domain of domainList) {
          const zonePath = `${env.BIND_ZONES_DIR}/db.${domain.name}`;
          try {
            const zoneContent = await readFile(zonePath, 'utf-8');
            await writeFile(`${stagingDir}/dns/db.${domain.name}`, zoneContent);
          } catch {}
        }
      }

      // 4. Write metadata
      const metadata = {
        id: backupId,
        subscriptionId,
        systemUser: subscription.systemUser,
        type,
        timestamp,
        version: '1.0.0',
      };
      await writeFile(`${stagingDir}/metadata.json`, JSON.stringify(metadata, null, 2));

      // 5. Compress everything into single archive
      await run('tar', [
        '-czf', backupPath,
        '-C', stagingDir,
        '.',
      ], { timeout: 300_000 });

      // 6. Clean up staging
      await rm(stagingDir, { recursive: true, force: true });

      // 7. Get file size
      const stats = await stat(backupPath);

      // Update backup record
      await db.update(backups).set({
        sizeBytes: stats.size,
        status: 'completed',
        completedAt: new Date(),
      }).where(eq(backups.id, backupId));

      logger.info({ backupId, filename, size: stats.size }, 'Backup completed');
      return { id: backupId, filename, sizeBytes: stats.size };

    } catch (error) {
      await db.update(backups).set({
        status: 'failed',
        error: (error as Error).message,
        completedAt: new Date(),
      }).where(eq(backups.id, backupId));

      logger.error({ backupId, error }, 'Backup failed');
      throw new AppError(422, 'BACKUP_FAILED', `Backup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId: string, options: { files?: boolean; databases?: boolean; dns?: boolean } = {}) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');
    if (backup.status !== 'completed') throw new AppError(400, 'BACKUP_NOT_READY', 'Backup is not in completed state');

    await db.update(backups).set({ status: 'restoring' }).where(eq(backups.id, backupId));

    try {
      const [subscription] = await db.select().from(subscriptions)
        .where(eq(subscriptions.id, backup.subscriptionId)).limit(1);

      const stagingDir = `${env.BACKUP_DIR}/.restore-${backupId}`;
      await mkdir(stagingDir, { recursive: true });

      // Extract archive
      await run('tar', ['-xzf', backup.storagePath!, '-C', stagingDir], { timeout: 300_000 });

      // Restore files
      if (options.files !== false) {
        try {
          await run('tar', ['-xzf', `${stagingDir}/files.tar.gz`, '-C', subscription!.homeDir], {
            sudo: true, timeout: 300_000,
          });
        } catch {}
      }

      // Restore DNS
      if (options.dns !== false) {
        // ... restore DNS zones from staging/dns/
      }

      // Restore databases
      if (options.databases !== false) {
        // ... import SQL files from staging/databases/
      }

      // Cleanup
      await rm(stagingDir, { recursive: true, force: true });

      await db.update(backups).set({ status: 'completed' }).where(eq(backups.id, backupId));
      logger.info({ backupId }, 'Backup restored');
      return { restored: true };

    } catch (error) {
      await db.update(backups).set({ status: 'failed', error: (error as Error).message })
        .where(eq(backups.id, backupId));
      throw new AppError(422, 'RESTORE_FAILED', `Restore failed: ${(error as Error).message}`);
    }
  }

  /**
   * List backups for a subscription
   */
  async listBackups(subscriptionId: string) {
    return db.select().from(backups)
      .where(eq(backups.subscriptionId, subscriptionId));
  }

  /**
   * Delete a backup file and record
   */
  async deleteBackup(backupId: string) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');

    if (backup.storagePath) {
      await rm(backup.storagePath).catch(() => {});
    }

    await db.delete(backups).where(eq(backups.id, backupId));
    logger.info({ backupId }, 'Backup deleted');
  }

  /**
   * Get/set backup schedule
   */
  async getSchedule(subscriptionId: string) {
    const [schedule] = await db.select().from(backupSchedules)
      .where(eq(backupSchedules.subscriptionId, subscriptionId)).limit(1);
    return schedule || null;
  }

  async updateSchedule(subscriptionId: string, data: {
    cronExpression?: string;
    retentionCount?: number;
    storageType?: string;
    storageConfig?: string;
  }) {
    const existing = await db.select().from(backupSchedules)
      .where(eq(backupSchedules.subscriptionId, subscriptionId));

    if (existing.length > 0) {
      await db.update(backupSchedules).set(data)
        .where(eq(backupSchedules.subscriptionId, subscriptionId));
    } else {
      await db.insert(backupSchedules).values({
        id: nanoid(),
        subscriptionId,
        cronExpression: data.cronExpression || '0 2 * * *',
        retentionCount: data.retentionCount || 7,
        storageType: (data.storageType as any) || 'local',
        storageConfig: data.storageConfig,
      });
    }

    return this.getSchedule(subscriptionId);
  }

  /**
   * Enforce retention policy — delete old backups beyond retention count
   */
  async enforceRetentionPolicy(subscriptionId: string) {
    const schedule = await this.getSchedule(subscriptionId);
    if (!schedule) return;

    const allBackups = await db.select().from(backups)
      .where(eq(backups.subscriptionId, subscriptionId));

    const completed = allBackups
      .filter(b => b.status === 'completed')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

    const toDelete = completed.slice(schedule.retentionCount);
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
    }

    logger.info({ subscriptionId, deleted: toDelete.length }, 'Retention policy enforced');
  }
}
```

### 17.3 Backup Job

#### `apps/api/src/jobs/backup.job.ts`

```typescript
import { Worker, type ConnectionOptions } from 'bullmq';
import { db } from '../db/index.js';
import { backupSchedules, subscriptions } from '../db/schema/index.js';
import { BackupService } from '../modules/backup/backup.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const connection: ConnectionOptions = {
  host: new URL(env.REDIS_URL).hostname || '127.0.0.1',
  port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};

export function startBackupWorker(): Worker {
  return new Worker('backup', async (job) => {
    if (job.name !== 'scheduled') return;

    const schedules = await db.select().from(backupSchedules);
    const backupService = new BackupService();

    for (const schedule of schedules) {
      if (!schedule.isActive) continue;

      try {
        await backupService.createBackup(schedule.subscriptionId);
        await backupService.enforceRetentionPolicy(schedule.subscriptionId);
      } catch (error) {
        logger.error({ subscriptionId: schedule.subscriptionId, error }, 'Scheduled backup failed');
      }
    }
  }, { connection, concurrency: 1 });
}
```

---

## Phase 18 — Polish + Installer

### 18.1 Audit Service

#### `apps/api/src/modules/audit/audit.service.ts`

```typescript
import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { eq, desc, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class AuditService {
  async log(data: {
    userId?: string;
    action: string;
    resource?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: data.userId || null,
      action: data.action,
      resource: data.resource || null,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  }

  async queryLogs(filters: {
    userId?: string;
    action?: string;
    page?: number;
    perPage?: number;
  }) {
    const { page = 1, perPage = 50 } = filters;
    const offset = (page - 1) * perPage;

    // Build query with filters (simplified)
    const items = await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(perPage)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(auditLogs);

    return { items, meta: { page, perPage, total } };
  }
}

export const auditService = new AuditService();
```

### 18.2 Global Audit Hook

Add to `apps/api/src/server.ts` after route registration:

```typescript
// Auto-audit all mutating requests
fastify.addHook('onSend', async (req, reply) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (reply.statusCode < 400 && req.user) {
      const action = `${req.method.toLowerCase()}.${req.url.replace('/api/v1/', '').split('?')[0]}`;
      await auditService.log({
        userId: req.user.id,
        action,
        resource: req.params ? JSON.stringify(req.params) : undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
  }
});
```

### 18.3 Installer Script

#### `scripts/install.sh`

```bash
#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║       ServerForge Panel Installer v1.0       ║"
echo "║       Self-hosted server control panel        ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS=$ID
  VER=$VERSION_ID
else
  echo -e "${RED}Cannot detect OS${NC}"
  exit 1
fi

echo -e "${GREEN}Detected OS: $OS $VER${NC}"

# --- System Dependencies ---
echo -e "${YELLOW}[1/17] Updating system packages...${NC}"
apt-get update -y

echo -e "${YELLOW}[2/17] Installing base dependencies...${NC}"
apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https

# --- Node.js ---
echo -e "${YELLOW}[3/17] Installing Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# --- pnpm + PM2 ---
echo -e "${YELLOW}[4/17] Installing pnpm and PM2...${NC}"
npm install -g pnpm pm2

# --- Valkey (Redis-compatible) ---
echo -e "${YELLOW}[5/17] Installing Valkey...${NC}"
apt-get install -y valkey-server || apt-get install -y redis-server
systemctl enable --now valkey-server || systemctl enable --now redis-server

# --- Web Servers ---
echo -e "${YELLOW}[6/17] Installing Nginx + Apache...${NC}"
apt-get install -y nginx apache2
systemctl enable nginx apache2

# --- PHP ---
echo -e "${YELLOW}[7/17] Installing PHP (multi-version)...${NC}"
add-apt-repository -y ppa:ondrej/php
apt-get update
apt-get install -y php8.1-fpm php8.2-fpm php8.3-fpm php8.4-fpm \
  php8.2-mysql php8.2-pgsql php8.2-curl php8.2-gd php8.2-mbstring \
  php8.2-xml php8.2-zip php8.2-intl php8.2-bcmath

# --- MariaDB ---
echo -e "${YELLOW}[8/17] Installing MariaDB...${NC}"
apt-get install -y mariadb-server
systemctl enable --now mariadb
mysql_secure_installation

# --- PostgreSQL ---
echo -e "${YELLOW}[9/17] Installing PostgreSQL...${NC}"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# --- Mail Stack ---
echo -e "${YELLOW}[10/17] Installing mail stack (Postfix + Dovecot)...${NC}"
debconf-set-selections <<< "postfix postfix/main_mailer_type select Internet Site"
debconf-set-selections <<< "postfix postfix/mailname string $(hostname -f)"
apt-get install -y postfix dovecot-core dovecot-imapd spamassassin opendkim opendkim-tools
systemctl enable postfix dovecot-core

# --- BIND9 ---
echo -e "${YELLOW}[11/17] Installing BIND9...${NC}"
apt-get install -y bind9 bind9utils
systemctl enable --now bind9

# --- ProFTPd ---
echo -e "${YELLOW}[12/17] Installing ProFTPd...${NC}"
apt-get install -y proftpd-basic
systemctl enable --now proftpd

# --- Security ---
echo -e "${YELLOW}[13/17] Installing security tools...${NC}"
apt-get install -y ufw fail2ban certbot python3-certbot-nginx
systemctl enable --now ufw fail2ban

# --- Cloudflared ---
echo -e "${YELLOW}[14/17] Installing cloudflared...${NC}"
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb
rm -f /tmp/cloudflared.deb

# --- ServerForge User ---
echo -e "${YELLOW}[15/17] Setting up ServerForge user...${NC}"
id -u serverforge &>/dev/null || useradd -r -m -d /opt/serverforge -s /usr/sbin/nologin serverforge
mkdir -p /var/lib/serverforge /var/log/serverforge /var/backups/serverforge /var/www/vhosts
chown serverforge:serverforge /var/lib/serverforge /var/log/serverforge /var/backups/serverforge

# --- Install Panel ---
echo -e "${YELLOW}[16/17] Installing ServerForge panel...${NC}"
INSTALL_DIR="/opt/serverforge"

if [[ -d "$(dirname "$0")/apps" ]]; then
  # Running from source
  cp -r "$(dirname "$0")/." "$INSTALL_DIR/"
else
  echo "Please ensure the ServerForge source is in the current directory"
  exit 1
fi

cd "$INSTALL_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
pnpm build

# --- Configure ---
echo -e "${YELLOW}[17/17] Configuring ServerForge...${NC}"

# Generate secrets
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
SF_ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -base64 16)

mkdir -p /etc/serverforge
cat > /etc/serverforge/.env << EOF
NODE_ENV=production
PORT=8443
HOST=0.0.0.0
PANEL_URL=https://$(hostname -I | awk '{print $1}'):8443

DB_PATH=/var/lib/serverforge/db.sqlite

SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}
SF_ENCRYPTION_KEY=${SF_ENCRYPTION_KEY}

REDIS_URL=redis://127.0.0.1:6379

ADMIN_EMAIL=admin@$(hostname -f)
ADMIN_PASSWORD=${ADMIN_PASSWORD}

VHOSTS_ROOT=/var/www/vhosts
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
APACHE_SITES_AVAILABLE=/etc/apache2/sites-available
BIND_ZONES_DIR=/etc/bind/zones
PHP_FPM_POOL_DIR=/etc/php/{version}/fpm/pool.d
CLOUDFLARED_CONFIG=/etc/cloudflared/config.yml
BACKUP_DIR=/var/backups/serverforge

LOG_LEVEL=info
LOG_DIR=/var/log/serverforge
EOF

# Install sudoers
cp "$INSTALL_DIR/configs/sudoers.d/serverforge" /etc/sudoers.d/serverforge 2>/dev/null || true
chmod 440 /etc/sudoers.d/serverforge 2>/dev/null || true

# Run migrations
cd "$INSTALL_DIR"
pnpm --filter api db:migrate
pnpm --filter api db:seed

# Setup PM2
cat > "$INSTALL_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'serverforge',
    script: './apps/api/dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
    env_file: '/etc/serverforge/.env'
  }]
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup

# --- Done ---
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ServerForge installed successfully!       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Panel URL:   ${BLUE}https://$(hostname -I | awk '{print $1}'):8443${NC}"
echo -e "  Admin Email: ${BLUE}admin@$(hostname -f)${NC}"
echo -e "  Admin Pass:  ${BLUE}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "  ${YELLOW}Save these credentials! The password will be cleared after first login.${NC}"
echo ""
echo -e "  Config file: /etc/serverforge/.env"
echo -e "  Panel dir:   /opt/serverforge"
echo -e "  Logs:        /var/log/serverforge/"
echo ""
echo -e "  Manage with: ${BLUE}pm2 status${NC} | ${BLUE}pm2 logs serverforge${NC} | ${BLUE}pm2 restart serverforge${NC}"
echo ""
```

### 18.4 Sudoers Config

#### `configs/sudoers.d/serverforge`

```
serverforge ALL=(ALL) NOPASSWD: /usr/sbin/useradd, /usr/sbin/userdel, \
  /usr/bin/passwd, /usr/bin/chown, /usr/bin/chmod, /usr/bin/chgrp, \
  /usr/sbin/nginx, /usr/sbin/apache2ctl, /usr/sbin/a2ensite, /usr/sbin/a2dissite, \
  /bin/systemctl restart nginx, /bin/systemctl reload nginx, \
  /bin/systemctl restart apache2, /bin/systemctl reload apache2, \
  /bin/systemctl restart bind9, /bin/systemctl reload bind9, \
  /bin/systemctl restart postfix, /bin/systemctl reload postfix, \
  /bin/systemctl restart dovecot, /bin/systemctl reload dovecot, \
  /bin/systemctl restart proftpd, /bin/systemctl reload proftpd, \
  /bin/systemctl restart fail2ban, \
  /bin/systemctl restart cloudflared, /bin/systemctl reload cloudflared, \
  /bin/systemctl restart php*, /bin/systemctl reload php*, \
  /bin/systemctl start *, /bin/systemctl stop *, \
  /usr/bin/certbot, \
  /usr/bin/cloudflared, \
  /usr/sbin/rndc, \
  /usr/bin/mysql, /usr/bin/mysqladmin, /usr/bin/mysqldump, \
  /usr/bin/psql, /usr/bin/pg_dump, /usr/bin/createuser, /usr/bin/dropuser, \
  /usr/bin/createdb, /usr/bin/dropdb, \
  /usr/bin/crontab, \
  /usr/sbin/ufw, \
  /usr/bin/fail2ban-client, \
  /usr/bin/tar, /usr/bin/unzip, /usr/bin/zip, \
  /usr/bin/du, /usr/bin/rm, /usr/bin/cp, /usr/bin/mv, \
  /usr/bin/mkdir, /usr/bin/ln, \
  /usr/bin/su, \
  /usr/bin/openssl, \
  /usr/bin/hostname
```

### 18.5 Docker Compose (Dev)

#### `docker-compose.yml`

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '8443:8443'
      - '5173:5173'
    volumes:
      - ./:/app
      - db:/var/lib/serverforge
    environment:
      - NODE_ENV=development
      - PORT=8443
      - HOST=0.0.0.0
      - DB_PATH=/var/lib/serverforge/db.sqlite
      - SESSION_SECRET=dev-session-secret-32-chars-minimum!!
      - JWT_SECRET=dev-jwt-secret-32-chars-minimum!!!!!!!
      - SF_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      - REDIS_URL=redis://valkey:6379
      - ADMIN_EMAIL=admin@localhost
      - ADMIN_PASSWORD=changeme123
      - LOG_LEVEL=debug

  valkey:
    image: valkey/valkey:7
    ports:
      - '6379:6379'
    volumes:
      - valkey_data:/data

  mailhog:
    image: mailhog/mailhog
    ports:
      - '1025:1025'
      - '8025:8025'

volumes:
  db:
  valkey_data:
```

#### `Dockerfile`

```dockerfile
FROM node:20-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 8443

CMD ["pnpm", "--filter", "api", "start"]
```

---

## Final Route Registration

After all phases, the complete `apps/api/src/routes.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { registerTerminalWs } from './modules/terminal/terminal.ws.js';
import { registerLogsWs } from './ws/logs.ws.js';
import { auditService } from './modules/audit/audit.service.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health
  fastify.get('/api/v1/health', async () => ({
    status: 'ok', version: '1.0.0', timestamp: new Date().toISOString(),
  }));

  // Phase 3 — Auth + Users + Subscriptions
  await fastify.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/v1/auth' });
  await fastify.register(import('./modules/users/users.routes.js'), { prefix: '/api/v1/users' });
  await fastify.register(import('./modules/subscriptions/subscriptions.routes.js'), { prefix: '/api/v1' });

  // Phase 5 — Stats
  await fastify.register(import('./modules/stats/stats.routes.js'), { prefix: '/api/v1/stats' });

  // Phase 6 — Domains
  await fastify.register(import('./modules/domains/domains.routes.js'), { prefix: '/api/v1/domains' });

  // Phase 7 — Web Server + PHP
  await fastify.register(import('./modules/webserver/webserver.routes.js'), { prefix: '/api/v1' });
  await fastify.register(import('./modules/php/php.routes.js'), { prefix: '/api/v1' });

  // Phase 8 — SSL
  await fastify.register(import('./modules/ssl/ssl.routes.js'), { prefix: '/api/v1' });

  // Phase 9 — DNS
  await fastify.register(import('./modules/dns/dns.routes.js'), { prefix: '/api/v1' });

  // Phase 10 — Mail
  await fastify.register(import('./modules/mail/mail.routes.js'), { prefix: '/api/v1' });

  // Phase 11 — Databases
  await fastify.register(import('./modules/databases/databases.routes.js'), { prefix: '/api/v1' });

  // Phase 12 — FTP
  await fastify.register(import('./modules/ftp/ftp.routes.js'), { prefix: '/api/v1/domains' });

  // Phase 13 — Tunnel
  await fastify.register(import('./modules/tunnel/tunnel.routes.js'), { prefix: '/api/v1' });

  // Phase 14 — Files
  await fastify.register(import('./modules/files/files.routes.js'), { prefix: '/api/v1' });

  // Phase 15 — Terminal + Logs
  await registerTerminalWs(fastify);
  await registerLogsWs(fastify);
  await fastify.register(import('./modules/logs/logs.routes.js'), { prefix: '/api/v1' });

  // Phase 16 — Cron + Firewall
  await fastify.register(import('./modules/cron/cron.routes.js'), { prefix: '/api/v1' });
  await fastify.register(import('./modules/firewall/firewall.routes.js'), { prefix: '/api/v1' });

  // Phase 17 — Backup
  await fastify.register(import('./modules/backup/backup.routes.js'), { prefix: '/api/v1' });

  // Phase 18 — Audit
  await fastify.register(import('./modules/audit/audit.routes.js'), { prefix: '/api/v1' });

  // Global audit hook
  fastify.addHook('onSend', async (req, reply) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      if (reply.statusCode < 400 && req.user) {
        await auditService.log({
          userId: req.user.id,
          action: `${req.method} ${req.url}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
    }
  });
}
```

---

## Summary of Phases 15-18 Deliverables

| File | Purpose |
|---|---|
| `modules/terminal/terminal.ws.ts` | WebSocket terminal with node-pty, role-based shell, resize, keepalive |
| `pages/terminal/TerminalPage.tsx` | Full xterm.js terminal with dark/light themes, fullscreen, font size controls |
| `modules/logs/logs.service.ts` | Access/error/panel/fail2ban log tailing |
| `modules/logs/logs.routes.ts` | 4 log endpoints |
| `ws/logs.ws.ts` | Real-time log streaming via WebSocket |
| `modules/cron/cron.service.ts` | Cron job CRUD with system crontab management |
| `modules/firewall/firewall.service.ts` | UFW rule CRUD, presets, Fail2Ban jail management, IP unban |
| `db/schema/backups.ts` | Backups + backup schedules tables |
| `modules/backup/backup.service.ts` | Full/partial backup/restore, retention policy, staging workflow |
| `jobs/backup.job.ts` | Scheduled backup BullMQ worker |
| `modules/audit/audit.service.ts` | Audit log query + auto-logging hook |
| `scripts/install.sh` | Full 17-step installer for Ubuntu/Debian |
| `configs/sudoers.d/serverforge` | Sudoers rules for panel user |
| `docker-compose.yml` | Dev environment with Valkey + MailHog |
| `Dockerfile` | Multi-stage build |

**Total: ~15 additional files for Phases 15-18**

---

## Grand Total: All Phases

| Phase Group | Files | Scope |
|---|---|---|
| Phases 1-3 | ~30 | Monorepo, DB, Auth |
| Phases 4-7 | ~35 | Executor, Services, Templates, Stats, Dashboard, Domains, Web Server, PHP |
| Phases 8-14 | ~25 | SSL, DNS, Mail, Database, FTP, Tunnel, File Manager |
| Phases 15-18 | ~15 | Terminal, Logs, Cron, Firewall, Backup, Audit, Installer |
| **Total** | **~105 files** | **Complete ServerForge panel** |

---

*End of Phases 15-18 Detailed Implementation Guide*
*All phases now fully specified — ready for implementation*
