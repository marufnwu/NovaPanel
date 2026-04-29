# ServerForge — Phases 13-14 Continuation: Tunnel + File Manager

> **Continuation of:** `plans/phase-8-13-detailed.md`
> **Resumes at:** Tunnel Service

---

## Phase 13 — Cloudflare Tunnel (Continued)

### 13.1 Tunnel Service

#### `apps/api/src/modules/tunnel/tunnel.service.ts`

```typescript
import { db } from '../../db/index.js';
import { cloudflareTunnels, tunnelRoutes } from '../../db/schema/tunnels.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import YAML from 'yaml';

export class TunnelService {
  /**
   * Full tunnel setup: create tunnel, configure, install as service
   */
  async setup(name: string, apiToken: string, accountId?: string) {
    // 1. Create tunnel via cloudflared
    const createResult = await run('cloudflared', ['tunnel', 'create', name], {
      sudo: true,
      timeout: 60_000,
    });
    if (!createResult.success) {
      throw new AppError(422, 'TUNNEL_CREATE_FAILED', `Failed to create tunnel: ${createResult.stderr}`);
    }

    // Parse tunnel ID from output
    const tunnelId = this.parseTunnelId(createResult.stdout);
    if (!tunnelId) {
      throw new AppError(422, 'TUNNEL_ID_PARSE_FAILED', 'Could not parse tunnel ID from cloudflared output');
    }

    // 2. Read credentials JSON (cloudflared creates it)
    const credsPath = `/root/.cloudflared/${tunnelId}.json`;
    const credentialsJson = await readFile(credsPath, 'utf-8');

    // 3. Store in DB
    const tunnelDbId = nanoid();
    await db.insert(cloudflareTunnels).values({
      id: tunnelDbId,
      name,
      tunnelId,
      accountId: accountId || null,
      apiToken: encrypt(apiToken),
      credentialsJson: encrypt(credentialsJson),
      status: 'inactive',
    });

    // 4. Generate initial config
    await this.writeConfigFile(tunnelId, []);

    // 5. Install as systemd service
    await run('cloudflared', ['service', 'install'], { sudo: true });
    await run('systemctl', ['enable', 'cloudflared'], { sudo: true });

    logger.info({ name, tunnelId }, 'Cloudflare tunnel created');
    return { id: tunnelDbId, name, tunnelId, status: 'inactive' };
  }

  /**
   * Get tunnel status
   */
  async getStatus() {
    const result = await run('systemctl', ['is-active', 'cloudflared']);
    const status = result.stdout.trim() === 'active' ? 'active' : 'inactive';

    // Get tunnel info from DB
    const tunnels = await db.select().from(cloudflareTunnels);

    return {
      status,
      tunnels: tunnels.map(t => ({
        id: t.id,
        name: t.name,
        tunnelId: t.tunnelId,
        status: t.status,
      })),
    };
  }

  /**
   * Start tunnel
   */
  async start() {
    await run('systemctl', ['start', 'cloudflared'], { sudo: true });

    // Update DB status
    const tunnels = await db.select().from(cloudflareTunnels);
    for (const t of tunnels) {
      await db.update(cloudflareTunnels).set({ status: 'active' }).where(eq(cloudflareTunnels.id, t.id));
    }

    logger.info('Cloudflare tunnel started');
    return { status: 'active' };
  }

  /**
   * Stop tunnel
   */
  async stop() {
    await run('systemctl', ['stop', 'cloudflared'], { sudo: true });

    const tunnels = await db.select().from(cloudflareTunnels);
    for (const t of tunnels) {
      await db.update(cloudflareTunnels).set({ status: 'inactive' }).where(eq(cloudflareTunnels.id, t.id));
    }

    logger.info('Cloudflare tunnel stopped');
    return { status: 'inactive' };
  }

  /**
   * List tunnel routes (ingress rules)
   */
  async listRoutes(tunnelDbId?: string) {
    if (tunnelDbId) {
      return db.select().from(tunnelRoutes).where(eq(tunnelRoutes.tunnelId, tunnelDbId));
    }
    return db.select().from(tunnelRoutes);
  }

  /**
   * Add a tunnel route (hostname -> service mapping)
   */
  async addRoute(data: {
    tunnelId: string;       // DB id of the tunnel
    hostname: string;       // e.g., panel.example.com
    service: string;        // e.g., http://localhost:8443
    domainId?: string;
  }) {
    const routeId = nanoid();

    await db.insert(tunnelRoutes).values({
      id: routeId,
      tunnelId: data.tunnelId,
      hostname: data.hostname,
      service: data.service,
      domainId: data.domainId || null,
      isActive: true,
    });

    // Get tunnel UUID and regenerate config
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, data.tunnelId)).limit(1);
    if (tunnel) {
      const allRoutes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, data.tunnelId));
      await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
      await this.reloadDaemon();
    }

    // Create DNS CNAME via Cloudflare API
    if (tunnel?.apiToken) {
      await this.createDnsCname(tunnel, data.hostname);
    }

    logger.info({ hostname: data.hostname, service: data.service }, 'Tunnel route added');
    return { id: routeId, hostname: data.hostname, service: data.service };
  }

  /**
   * Delete a tunnel route
   */
  async deleteRoute(routeId: string) {
    const [route] = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.id, routeId)).limit(1);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    await db.delete(tunnelRoutes).where(eq(tunnelRoutes.id, routeId));

    // Regenerate config
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);
    if (tunnel) {
      const allRoutes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, route.tunnelId));
      await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
      await this.reloadDaemon();
    }

    logger.info({ routeId }, 'Tunnel route deleted');
  }

  /**
   * Toggle a route active/inactive
   */
  async toggleRoute(routeId: string) {
    const [route] = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.id, routeId)).limit(1);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    const newStatus = !route.isActive;
    await db.update(tunnelRoutes).set({ isActive: newStatus }).where(eq(tunnelRoutes.id, routeId));

    // Regenerate config with only active routes
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);
    if (tunnel) {
      const allRoutes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, route.tunnelId));
      await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
      await this.reloadDaemon();
    }

    return { id: routeId, isActive: newStatus };
  }

  // --- Private Helpers ---

  /**
   * Write cloudflared config.yml
   */
  private async writeConfigFile(tunnelUuid: string, routes: any[]) {
    const configDir = '/etc/cloudflared';
    await mkdir(configDir, { recursive: true });

    const activeRoutes = routes.filter(r => r.isActive);

    const config = {
      tunnel: tunnelUuid,
      'credentials-file': `${configDir}/${tunnelUuid}.json`,
      ingress: [
        ...activeRoutes.map(r => ({
          hostname: r.hostname,
          service: r.service,
        })),
        { service: 'http_status:404' }, // Catch-all (required)
      ],
    };

    const yamlContent = YAML.stringify(config);
    await writeFile(`${configDir}/config.yml`, yamlContent, 'utf-8');

    logger.debug({ tunnelUuid, routeCount: activeRoutes.length }, 'Tunnel config written');
  }

  /**
   * Reload cloudflared daemon
   */
  private async reloadDaemon() {
    await run('systemctl', ['reload', 'cloudflared'], { sudo: true }).catch(() => {
      // If reload not supported, restart
      return run('systemctl', ['restart', 'cloudflared'], { sudo: true });
    });
  }

  /**
   * Parse tunnel ID from cloudflared output
   */
  private parseTunnelId(output: string): string | null {
    // Output format: "Created tunnel <name> with id <uuid>"
    const match = output.match(/id\s+([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  /**
   * Create DNS CNAME record via Cloudflare API
   */
  private async createDnsCname(tunnel: any, hostname: string) {
    const apiToken = decrypt(tunnel.apiToken);
    const tunnelId = tunnel.tunnelId;

    // First, find the zone ID for this hostname
    const domain = hostname.split('.').slice(-2).join('.');
    const zonesResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const zonesData = await zonesResponse.json() as any;
    const zoneId = zonesData.result?.[0]?.id;

    if (!zoneId) {
      logger.warn({ hostname, domain }, 'Could not find Cloudflare zone for hostname');
      return;
    }

    // Create CNAME record
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
        proxied: true,
      }),
    });

    logger.info({ hostname, zoneId }, 'DNS CNAME created via Cloudflare API');
  }
}
```

### 13.2 Tunnel Routes

#### `apps/api/src/modules/tunnel/tunnel.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { TunnelService } from './tunnel.service.js';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

const setupSchema = z.object({
  name: z.string().min(1).max(64),
  apiToken: z.string().min(1),
  accountId: z.string().optional(),
});

const addRouteSchema = z.object({
  tunnelId: z.string(),
  hostname: z.string().min(1),
  service: z.string().min(1),
  domainId: z.string().optional(),
});

export default async function tunnelRoutes(fastify: FastifyInstance) {
  const service = new TunnelService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/tunnel', async () => {
    return { success: true, data: await service.getStatus() };
  });

  fastify.post('/tunnel/setup', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = setupSchema.parse(req.body);
      return { success: true, data: await service.setup(data.name, data.apiToken, data.accountId) };
    },
  });

  fastify.get('/tunnel/status', async () => {
    return { success: true, data: await service.getStatus() };
  });

  fastify.post('/tunnel/start', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      return { success: true, data: await service.start() };
    },
  });

  fastify.post('/tunnel/stop', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      return { success: true, data: await service.stop() };
    },
  });

  fastify.get('/tunnel/routes', async () => {
    return { success: true, data: await service.listRoutes() };
  });

  fastify.post('/tunnel/routes', async (req) => {
    const data = addRouteSchema.parse(req.body);
    return { success: true, data: await service.addRoute(data) };
  });

  fastify.delete('/tunnel/routes/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteRoute(id);
    return { success: true, data: null };
  });

  fastify.post('/tunnel/routes/:id/toggle', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.toggleRoute(id) };
  });
}
```

### 13.3 Tunnel Frontend

#### `apps/web/src/api/hooks/tunnel.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface TunnelStatus {
  status: 'active' | 'inactive' | 'error';
  tunnels: Array<{ id: string; name: string; tunnelId: string; status: string }>;
}

export interface TunnelRoute {
  id: string;
  tunnelId: string;
  hostname: string;
  service: string;
  isActive: boolean;
}

export function useTunnelStatus() {
  return useQuery({
    queryKey: ['tunnel', 'status'],
    queryFn: () => api.get<TunnelStatus>('/api/v1/tunnel/status'),
    refetchInterval: 10_000,
  });
}

export function useTunnelRoutes() {
  return useQuery({
    queryKey: ['tunnel', 'routes'],
    queryFn: () => api.get<TunnelRoute[]>('/api/v1/tunnel/routes'),
  });
}

export function useSetupTunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; apiToken: string; accountId?: string }) =>
      api.post('/api/v1/tunnel/setup', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useAddRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { tunnelId: string; hostname: string; service: string }) =>
      api.post('/api/v1/tunnel/routes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useStartTunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/v1/tunnel/start'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}

export function useStopTunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/v1/tunnel/stop'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnel'] }),
  });
}
```

#### `apps/web/src/pages/tunnel/TunnelPage.tsx`

```typescript
import { useState } from 'react';
import { useTunnelStatus, useTunnelRoutes, useSetupTunnel, useAddRoute, useStartTunnel, useStopTunnel } from '../../api/hooks/tunnel';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Cloud, Play, Square, Plus, Wifi, WifiOff } from 'lucide-react';

export function TunnelPage() {
  const { data: status, isLoading } = useTunnelStatus();
  const { data: routes } = useTunnelRoutes();
  const startMutation = useStartTunnel();
  const stopMutation = useStopTunnel();

  if (isLoading) return <div>Loading tunnel status...</div>;

  const isActive = status?.status === 'active';
  const hasTunnel = (status?.tunnels?.length || 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cloudflare Tunnel</h1>
        <p className="text-muted-foreground">Expose your server securely via Cloudflare Tunnel</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isActive ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
            Tunnel Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Badge variant={isActive ? 'default' : 'destructive'}>
                {isActive ? 'Connected' : 'Disconnected'}
              </Badge>
              {hasTunnel && (
                <span className="ml-3 text-sm text-muted-foreground">
                  Tunnel: {status!.tunnels[0].name} ({status!.tunnels[0].tunnelId})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!hasTunnel ? (
                <SetupTunnelDialog />
              ) : isActive ? (
                <Button variant="destructive" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
              ) : (
                <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                  <Play className="mr-2 h-4 w-4" /> Start
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routes Table */}
      {hasTunnel && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ingress Routes</CardTitle>
            <AddRouteDialog tunnelId={status!.tunnels[0].id} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!routes?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No routes configured. Add a route to expose a service.
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-medium">{route.hostname}</TableCell>
                      <TableCell><code className="text-xs">{route.service}</code></TableCell>
                      <TableCell>
                        <Badge variant={route.isActive ? 'default' : 'secondary'}>
                          {route.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Toggle</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SetupTunnelDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [apiToken, setApiToken] = useState('');
  const setupMutation = useSetupTunnel();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setupMutation.mutate({ name, apiToken }, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Cloud className="mr-2 h-4 w-4" /> Setup Tunnel</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup Cloudflare Tunnel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Tunnel Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-server" required />
          </div>
          <div>
            <label className="text-sm font-medium">Cloudflare API Token</label>
            <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)}
              placeholder="Requires Zone:DNS:Edit permission" required />
            <p className="text-xs text-muted-foreground mt-1">
              Create at: Cloudflare Dashboard > My Profile > API Tokens
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={setupMutation.isPending}>
            {setupMutation.isPending ? 'Setting up...' : 'Create Tunnel'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRouteDialog({ tunnelId }: { tunnelId: string }) {
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState('');
  const [service, setService] = useState('http://localhost:80');
  const addMutation = useAddRoute();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({ tunnelId, hostname, service }, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Route</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tunnel Route</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Hostname</label>
            <Input value={hostname} onChange={(e) => setHostname(e.target.value)}
              placeholder="panel.example.com" required />
          </div>
          <div>
            <label className="text-sm font-medium">Local Service</label>
            <Input value={service} onChange={(e) => setService(e.target.value)}
              placeholder="http://localhost:80" required />
            <p className="text-xs text-muted-foreground mt-1">
              Common: http://localhost:80 (web), https://localhost:8443 (panel)
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={addMutation.isPending}>Add Route</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Phase 14 — File Manager: Detailed Specification

### 14.1 File Manager Service

#### `apps/api/src/modules/files/files.service.ts`

```typescript
import { readdir, stat, readFile, writeFile, mkdir, rm, rename, chmod } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { createReadStream as archiveReadStream } from 'node:fs';

export class FilesService {
  /**
   * Validate and resolve a safe path within subscription home dir
   * Prevents path traversal attacks
   */
  private safePath(homeDir: string, requestedPath: string): string {
    const resolved = path.resolve(homeDir, requestedPath);
    if (!resolved.startsWith(homeDir)) {
      throw new AppError(403, 'PATH_TRAVERSAL', 'Access denied: path outside home directory');
    }
    return resolved;
  }

  /**
   * List directory contents
   */
  async listDirectory(homeDir: string, relativePath: string = '/') {
    const targetPath = this.safePath(homeDir, relativePath);

    try {
      const entries = await readdir(targetPath, { withFileTypes: true });
      const items = await Promise.all(
        entries
          .filter(entry => !entry.name.startsWith('.')) // Hide dotfiles
          .map(async (entry) => {
            const fullPath = path.join(targetPath, entry.name);
            try {
              const stats = await stat(fullPath);
              return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : this.getFileType(entry.name),
                size: stats.size,
                permissions: stats.mode.toString(8).slice(-3),
                modifiedAt: stats.mtime.toISOString(),
                isDirectory: entry.isDirectory(),
              };
            } catch {
              return null;
            }
          })
      );

      return items.filter(Boolean);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'DIR_NOT_FOUND', 'Directory not found');
      }
      if (error.code === 'EACCES') {
        throw new AppError(403, 'ACCESS_DENIED', 'Permission denied');
      }
      throw error;
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(homeDir: string, relativePath: string, filename: string, content: Buffer) {
    const targetDir = this.safePath(homeDir, relativePath);
    const targetPath = path.join(targetDir, filename);

    // Ensure target is still within home dir
    this.safePath(homeDir, path.join(relativePath, filename));

    await writeFile(targetPath, content);
    logger.info({ path: targetPath, size: content.length }, 'File uploaded');
    return { name: filename, size: content.length };
  }

  /**
   * Create a directory
   */
  async createDirectory(homeDir: string, relativePath: string, dirName: string) {
    const targetPath = this.safePath(homeDir, path.join(relativePath, dirName));
    await mkdir(targetPath, { recursive: true });
    return { name: dirName, created: true };
  }

  /**
   * Delete a file or directory
   */
  async deleteItem(homeDir: string, relativePath: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    await rm(targetPath, { recursive: true, force: true });
    logger.info({ path: targetPath }, 'Item deleted');
  }

  /**
   * Rename a file or directory
   */
  async renameItem(homeDir: string, oldRelativePath: string, newRelativePath: string) {
    const oldPath = this.safePath(homeDir, oldRelativePath);
    const newPath = this.safePath(homeDir, newRelativePath);
    await rename(oldPath, newPath);
    return { oldPath: oldRelativePath, newPath: newRelativePath };
  }

  /**
   * Update file permissions
   */
  async updatePermissions(homeDir: string, relativePath: string, mode: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    const modeNum = parseInt(mode, 8);
    if (isNaN(modeNum) || modeNum < 0 || modeNum > 0o777) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'Invalid permission mode');
    }
    await chmod(targetPath, modeNum);
    return { path: relativePath, mode };
  }

  /**
   * Archive files/directories into a tar.gz
   */
  async archiveItems(homeDir: string, paths: string[], archiveName: string) {
    const archivePath = this.safePath(homeDir, archiveName);
    const targetPaths = paths.map(p => this.safePath(homeDir, p));

    // Use tar command for reliable archiving
    const result = await run('tar', [
      '-czf', archivePath,
      '-C', homeDir,
      ...targetPaths.map(p => path.relative(homeDir, p)),
    ], { sudo: true, timeout: 120_000 });

    if (!result.success) {
      throw new AppError(422, 'ARCHIVE_FAILED', `Archive creation failed: ${result.stderr}`);
    }

    return { name: archiveName, size: (await stat(archivePath)).size };
  }

  /**
   * Extract an archive
   */
  async extractArchive(homeDir: string, archiveRelativePath: string, targetDir?: string) {
    const archivePath = this.safePath(homeDir, archiveRelativePath);
    const extractDir = targetDir
      ? this.safePath(homeDir, targetDir)
      : path.dirname(archivePath);

    await mkdir(extractDir, { recursive: true });

    const result = await run('tar', [
      '-xzf', archivePath,
      '-C', extractDir,
    ], { sudo: true, timeout: 120_000 });

    if (!result.success) {
      throw new AppError(422, 'EXTRACT_FAILED', `Extraction failed: ${result.stderr}`);
    }

    return { extracted: true, targetDir: extractDir };
  }

  /**
   * Get file content for text editing
   */
  async getFileContent(homeDir: string, relativePath: string): Promise<string> {
    const targetPath = this.safePath(homeDir, relativePath);
    const stats = await stat(targetPath);
    if (stats.isDirectory()) throw new AppError(400, 'IS_DIRECTORY', 'Cannot read directory as file');
    if (stats.size > 5 * 1024 * 1024) throw new AppError(422, 'FILE_TOO_LARGE', 'File too large for editing (max 5MB)');

    return readFile(targetPath, 'utf-8');
  }

  /**
   * Save file content from text editor
   */
  async saveFileContent(homeDir: string, relativePath: string, content: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    await writeFile(targetPath, content, 'utf-8');
    return { saved: true };
  }

  /**
   * Get download stream for a file
   */
  getDownloadStream(homeDir: string, relativePath: string) {
    const targetPath = this.safePath(homeDir, relativePath);
    return createReadStream(targetPath);
  }

  /**
   * Determine file type from extension
   */
  private getFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const typeMap: Record<string, string> = {
      '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.svg': 'image', '.webp': 'image',
      '.mp4': 'video', '.avi': 'video', '.mkv': 'video',
      '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio',
      '.pdf': 'document',
      '.doc': 'document', '.docx': 'document',
      '.xls': 'spreadsheet', '.xlsx': 'spreadsheet',
      '.zip': 'archive', '.tar': 'archive', '.gz': 'archive', '.rar': 'archive', '.7z': 'archive',
      '.php': 'code', '.js': 'code', '.ts': 'code', '.py': 'code', '.html': 'code', '.css': 'code',
      '.json': 'code', '.xml': 'code', '.yml': 'code', '.yaml': 'code',
      '.txt': 'text', '.md': 'text', '.log': 'text', '.csv': 'text',
      '.sql': 'database',
    };
    return typeMap[ext] || 'file';
  }
}
```

### 14.2 File Manager Routes

#### `apps/api/src/modules/files/files.routes.ts`

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FilesService } from './files.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { db } from '../../db/index.js';
import { subscriptions } from '../../db/schema/subscriptions.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const mkdirSchema = z.object({ path: z.string(), name: z.string() });
const renameSchema = z.object({ oldPath: z.string(), newPath: z.string() });
const chmodSchema = z.object({ path: z.string(), mode: z.string() });
const archiveSchema = z.object({ paths: z.array(z.string()), name: z.string() });
const extractSchema = z.object({ archivePath: z.string(), targetDir: z.string().optional() });
const saveContentSchema = z.object({ path: z.string(), content: z.string() });

export default async function fileRoutes(fastify: FastifyInstance) {
  const service = new FilesService();
  fastify.addHook('preHandler', requireAuth);

  /**
   * Helper: Get subscription home dir from request
   * In production, this would come from the authenticated user's subscription
   */
  async function getHomeDir(req: FastifyRequest): Promise<string> {
    // Simplified: get first active subscription for user
    const subs = await db.select().from(subscriptions)
      .where(eq(subscriptions.userId, req.user.id)).limit(1);
    if (!subs.length) throw new Error('No subscription found');
    return subs[0].homeDir;
  }

  // GET /api/v1/files?path=...
  fastify.get('/files', async (req) => {
    const { path: relativePath = '/' } = req.query as { path?: string };
    const homeDir = await getHomeDir(req);
    const items = await service.listDirectory(homeDir, relativePath);
    return { success: true, data: { path: relativePath, items } };
  });

  // POST /api/v1/files/upload (multipart)
  fastify.post('/files/upload', async (req) => {
    const data = await req.file();
    if (!data) throw new Error('No file uploaded');

    const { path: relativePath = '/' } = req.query as { path?: string };
    const homeDir = await getHomeDir(req);
    const buffer = await data.toBuffer();
    const result = await service.uploadFile(homeDir, relativePath, data.filename, buffer);
    return { success: true, data: result };
  });

  // POST /api/v1/files/mkdir
  fastify.post('/files/mkdir', async (req) => {
    const { path: relativePath, name } = mkdirSchema.parse(req.body);
    const homeDir = await getHomeDir(req);
    return { success: true, data: await service.createDirectory(homeDir, relativePath, name) };
  });

  // DELETE /api/v1/files?path=...
  fastify.delete('/files', async (req) => {
    const { path: relativePath } = req.query as { path: string };
    if (!relativePath) throw new Error('Path is required');
    const homeDir = await getHomeDir(req);
    await service.deleteItem(homeDir, relativePath);
    return { success: true, data: null };
  });

  // POST /api/v1/files/rename
  fastify.post('/files/rename', async (req) => {
    const { oldPath, newPath } = renameSchema.parse(req.body);
    const homeDir = await getHomeDir(req);
    return { success: true, data: await service.renameItem(homeDir, oldPath, newPath) };
  });

  // PUT /api/v1/files/permissions
  fastify.put('/files/permissions', async (req) => {
    const { path: relativePath, mode } = chmodSchema.parse(req.body);
    const homeDir = await getHomeDir(req);
    return { success: true, data: await service.updatePermissions(homeDir, relativePath, mode) };
  });

  // POST /api/v1/files/archive
  fastify.post('/files/archive', async (req) => {
    const { paths, name } = archiveSchema.parse(req.body);
    const homeDir = await getHomeDir(req);
    return { success: true, data: await service.archiveItems(homeDir, paths, name) };
  });

  // POST /api/v1/files/extract
  fastify.post('/files/extract', async (req) => {
    const { archivePath, targetDir } = extractSchema.parse(req.body);
    const homeDir = await getHomeDir(req);
    return { success: true, data: await service.extractArchive(homeDir, archivePath, targetDir) };
  });

  // GET /api/v1/files/content?path=... (for text editor)
  fastify.get('/files/content', async (req) => {
    const { path: relativePath } = req.query as { path: string };
    const homeDir = await getHomeDir(req);
    const content = await service.getFileContent(homeDir, relativePath);
    return { success: true, data: { path: relativePath, content } };
  });

  // PUT /api/v1/files/content (save from text editor)
  fastify.put('/files/content', async (req) => {
    const { path: relativePath, content } = saveContentSchema.parse(req.body);
    const homeDir = await getHomeDir(req);
    return { success: true, data: await service.saveFileContent(homeDir, relativePath, content) };
  });

  // GET /api/v1/files/download?path=...
  fastify.get('/files/download', async (req, reply: FastifyReply) => {
    const { path: relativePath } = req.query as { path: string };
    const homeDir = await getHomeDir(req);
    const stream = service.getDownloadStream(homeDir, relativePath);
    const filename = relativePath.split('/').pop() || 'file';
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  });
}
```

### 14.3 File Manager Frontend

#### `apps/web/src/api/hooks/files.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface FileItem {
  name: string;
  type: 'directory' | 'file' | 'image' | 'code' | 'text' | 'archive';
  size: number;
  permissions: string;
  modifiedAt: string;
  isDirectory: boolean;
}

export interface DirectoryListing {
  path: string;
  items: FileItem[];
}

export function useDirectoryListing(path: string = '/') {
  return useQuery({
    queryKey: ['files', path],
    queryFn: () => api.get<DirectoryListing>(`/api/v1/files?path=${encodeURIComponent(path)}`),
  });
}

export function useCreateDirectory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { path: string; name: string }) =>
      api.post('/api/v1/files/mkdir', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.delete(`/api/v1/files?path=${encodeURIComponent(path)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useRenameItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { oldPath: string; newPath: string }) =>
      api.post('/api/v1/files/rename', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useSaveFileContent() {
  return useMutation({
    mutationFn: (data: { path: string; content: string }) =>
      api.put('/api/v1/files/content', data),
  });
}
```

---

## Route Registration Update

After completing Phases 8-14, update `apps/api/src/routes.ts`:

```typescript
import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/health', async () => ({
    status: 'ok', version: '1.0.0', timestamp: new Date().toISOString(),
  }));

  // Phase 3
  await fastify.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/v1/auth' });
  await fastify.register(import('./modules/users/users.routes.js'), { prefix: '/api/v1/users' });
  await fastify.register(import('./modules/subscriptions/subscriptions.routes.js'), { prefix: '/api/v1' });

  // Phase 5
  await fastify.register(import('./modules/stats/stats.routes.js'), { prefix: '/api/v1/stats' });

  // Phase 6
  await fastify.register(import('./modules/domains/domains.routes.js'), { prefix: '/api/v1/domains' });

  // Phase 7
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
  await fastify.register(import('./modules/ftp/ftp.routes.js'), { prefix: '/api/v1' });

  // Phase 13 — Tunnel
  await fastify.register(import('./modules/tunnel/tunnel.routes.js'), { prefix: '/api/v1' });

  // Phase 14 — Files
  await fastify.register(import('./modules/files/files.routes.js'), { prefix: '/api/v1' });
}
```

---

## Summary of Phases 8-14 Deliverables

| File | Purpose |
|---|---|
| `db/schema/ssl.ts` | SSL certificates table |
| `modules/ssl/ssl.service.ts` | Let's Encrypt, custom cert, self-signed, renew, remove |
| `modules/ssl/ssl.routes.ts` | 7 SSL endpoints |
| `jobs/ssl-renew.job.ts` | Auto-renew BullMQ worker (daily at 3 AM) |
| `db/schema/dns.ts` | DNS zones + records tables |
| `modules/dns/dns.service.ts` | Zone CRUD, record CRUD, import/export BIND, reset defaults |
| `modules/dns/dns.routes.ts` | 7 DNS endpoints |
| `modules/mail/mail.service.ts` | Mail enable/disable, mailbox CRUD, aliases, DKIM generation |
| `modules/mail/mail.routes.ts` | 12 mail endpoints |
| `modules/databases/databases.service.ts` | MariaDB/PostgreSQL DB + user CRUD, export/import |
| `modules/databases/databases.routes.ts` | 8 database endpoints |
| `modules/ftp/ftp.service.ts` | ProFTPd account CRUD |
| `modules/tunnel/tunnel.service.ts` | Full Cloudflare tunnel lifecycle, route management, DNS CNAME |
| `modules/tunnel/tunnel.routes.ts` | 9 tunnel endpoints |
| `pages/tunnel/TunnelPage.tsx` | Setup wizard, status card, routes table |
| `api/hooks/tunnel.ts` | Tunnel TanStack Query hooks |
| `modules/files/files.service.ts` | Browse, upload, download, edit, chmod, archive, extract with path traversal protection |
| `modules/files/files.routes.ts` | 11 file manager endpoints including multipart upload |
| `api/hooks/files.ts` | File manager TanStack Query hooks |

**Total: ~25 additional files for Phases 8-14**

---

*End of Phases 8-14 Detailed Implementation Guide*
