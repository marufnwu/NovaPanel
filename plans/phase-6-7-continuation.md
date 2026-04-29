# ServerForge — Phases 6-7 Continuation: Domain & Web Server Modules

> **Continuation of:** `plans/phase-4-7-detailed.md`
> **Resumes at:** DomainsService.create method

---

## Phase 6 — Domain Module (Continued)

### 6.1 Domain Service — `create` Method (Continued from phase-4-7-detailed.md)

```typescript
// Continuing DomainsService.create() from line 2049...

    const domainCount = (await db.select({ count: count() }).from(domains)
      .where(eq(domains.subscriptionId, subscriptionId)))[0].count;

    // Get plan limits
    const [plan] = await db.select().from(plans).where(eq(plans.id, subscription.planId)).limit(1);
    if (plan && plan.maxDomains !== -1 && domainCount >= plan.maxDomains) {
      throw new AppError(403, 'PLAN_LIMIT_EXCEEDED', `Domain limit reached (${plan.maxDomains})`);
    }

    // 3. Generate system paths
    const domainId = nanoid();
    const poolName = `${subscription.systemUser}_${name.replace(/\./g, '')}`;
    const homeDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}`;
    const documentRoot = `${homeDir}/${name}/httpdocs`;
    const logDir = `${homeDir}/${name}/logs`;
    const sslDir = `${homeDir}/${name}/ssl`;
    const privateDir = `${homeDir}/${name}/private`;
    const tmpDir = `${homeDir}/${name}/tmp`;

    // 4. Execute full creation flow with rollback
    try {
      // 4a. Create directory structure
      await mkdir(documentRoot, { recursive: true });
      await mkdir(logDir, { recursive: true });
      await mkdir(sslDir, { recursive: true });
      await mkdir(privateDir, { recursive: true });
      await mkdir(tmpDir, { recursive: true });

      // Write default index.html
      await writeFile(`${documentRoot}/index.html`, defaultIndexHtml(name));

      // Set ownership
      await run('chown', ['-R', `${subscription.systemUser}:${subscription.systemUser}`, `${homeDir}/${name}`], { sudo: true });
      await run('chmod', ['755', documentRoot], { sudo: true });

      // 4b. Create PHP-FPM pool
      const poolContext: PoolContext = {
        poolName,
        systemUser: subscription.systemUser,
        phpVersion,
        documentRoot,
        maxChildren: 5,
        memoryLimit: '256M',
        uploadMaxFilesize: '64M',
        maxExecutionTime: '30',
      };
      await phpFpmService.createPool(poolContext);

      // 4c. Create Nginx vhost
      const nginxContext: VhostContext = {
        domain: name,
        documentRoot,
        user: subscription.systemUser,
        phpVersion,
        phpHandler: phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
        proxyToApache: webServer === 'nginx+apache',
        poolName,
        logDir,
        aliases: [`www.${name}`],
      };
      await nginxService.addVhost(nginxContext);

      // 4d. Create Apache vhost (if dual-stack)
      if (webServer === 'nginx+apache' || webServer === 'apache') {
        const apacheContext: ApacheVhostContext = {
          domain: name,
          documentRoot,
          user: subscription.systemUser,
          phpVersion,
          poolName,
          logDir,
          aliases: [`www.${name}`],
        };
        await apacheService.addVhost(apacheContext);
      }

      // 4e. Create DNS zone with default records
      const serverIp = await getServerIp();
      const zoneContext: ZoneContext = {
        domain: name,
        serial: Math.floor(Date.now() / 1000),
        ttl: 3600,
        primaryNs: 'ns1.example.com',
        adminEmail: 'admin.example.com',
        refresh: 86400,
        retry: 7200,
        expire: 3600000,
        minimumTtl: 172800,
        serverIp,
        records: [
          { type: 'A', name: '@', value: serverIp },
          { type: 'A', name: 'www', value: serverIp },
          { type: 'A', name: 'mail', value: serverIp },
          { type: 'MX', name: '@', value: `mail.${name}`, priority: 10 },
          { type: 'TXT', name: '@', value: `"v=spf1 a mx ip4:${serverIp} ~all"` },
        ],
      };
      await bindService.createZone(zoneContext);

      // 4f. Insert into database
      await db.insert(domains).values({
        id: domainId,
        subscriptionId,
        name,
        documentRoot,
        phpVersion,
        phpHandler,
        webServer,
        sslEnabled: false,
        redirectHttpToHttps: false,
        hsts: false,
        status: 'active',
      });

      logger.info({ domainId, name }, 'Domain created successfully');

      return { id: domainId, name, documentRoot, status: 'active' };

    } catch (error) {
      // ROLLBACK: Clean up partial state
      logger.error({ error, name }, 'Domain creation failed, rolling back...');

      await phpFpmService.removePool(poolName, phpVersion).catch(() => {});
      await nginxService.removeVhost(name).catch(() => {});
      await apacheService.removeVhost(name).catch(() => {});
      await bindService.removeZone(name).catch(() => {});
      await run('rm', ['-rf', `${homeDir}/${name}`], { sudo: true }).catch(() => {});

      throw new AppError(422, 'DOMAIN_CREATE_FAILED', `Failed to create domain: ${(error as Error).message}`);
    }
  }

  /**
   * Update domain settings
   */
  async update(id: string, data: UpdateDomainInput) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const updates: Partial<typeof domains.$inferInsert> = {};
    const subscription = await this.getSubscription(domain.subscriptionId);

    // If PHP version changed, recreate FPM pool
    if (data.phpVersion && data.phpVersion !== domain.phpVersion) {
      const oldPoolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
      await phpFpmService.removePool(oldPoolName, domain.phpVersion);

      const newPoolName = oldPoolName; // same name, different version
      await phpFpmService.createPool({
        poolName: newPoolName,
        systemUser: subscription.systemUser,
        phpVersion: data.phpVersion,
        documentRoot: domain.documentRoot,
        maxChildren: 5,
        memoryLimit: '256M',
        uploadMaxFilesize: '64M',
        maxExecutionTime: '30',
      });

      updates.phpVersion = data.phpVersion;

      // Reload nginx to pick up new FPM socket path
      await nginxService.reload();
    }

    if (data.webServer) updates.webServer = data.webServer;
    if (data.phpHandler) updates.phpHandler = data.phpHandler;
    if (data.redirectHttpToHttps !== undefined) updates.redirectHttpToHttps = data.redirectHttpToHttps;
    if (data.hsts !== undefined) updates.hsts = data.hsts;

    if (Object.keys(updates).length > 0) {
      await db.update(domains).set(updates).where(eq(domains.id, id));
    }

    logger.info({ domainId: id, updates }, 'Domain updated');
    return this.get(id);
  }

  /**
   * Delete a domain with full system cleanup
   */
  async delete(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subscription = await this.getSubscription(domain.subscriptionId);
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;

    // Remove in reverse order of creation
    await bindService.removeZone(domain.name).catch(() => {});
    await apacheService.removeVhost(domain.name).catch(() => {});
    await nginxService.removeVhost(domain.name).catch(() => {});
    await phpFpmService.removePool(poolName, domain.phpVersion).catch(() => {});

    // Remove domain files
    const domainDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}`;
    await run('rm', ['-rf', domainDir], { sudo: true }).catch(() => {});

    // Delete DB records (cascading)
    await db.delete(domainRedirects).where(eq(domainRedirects.domainId, id));
    await db.delete(domainAliases).where(eq(domainAliases.domainId, id));
    await db.delete(subdomains).where(eq(subdomains.domainId, id));
    await db.delete(domains).where(eq(domains.id, id));

    logger.info({ domainId: id, name: domain.name }, 'Domain deleted');
  }

  /**
   * Suspend a domain (return 503)
   */
  async suspend(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Replace vhost with maintenance page
    const maintenanceConfig = `
server {
    listen 80;
    server_name ${domain.name} www.${domain.name};
    return 503;
    error_page 503 /maintenance.html;
    location = /maintenance.html {
        root /opt/serverforge/maintenance;
        internal;
    }
}`;
    const { writeFile: write } = await import('node:fs/promises');
    await write(`${env.NGINX_SITES_AVAILABLE}/${domain.name}.conf`, maintenanceConfig);
    await nginxService.reload();

    await db.update(domains).set({ status: 'suspended' }).where(eq(domains.id, id));
    logger.info({ domainId: id }, 'Domain suspended');
  }

  /**
   * Activate a suspended domain
   */
  async activate(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Recreate proper vhost
    const subscription = await this.getSubscription(domain.subscriptionId);
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;

    await nginxService.addVhost({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
      proxyToApache: domain.webServer === 'nginx+apache',
      poolName,
      logDir: `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`,
    });

    await db.update(domains).set({ status: 'active' }).where(eq(domains.id, id));
    logger.info({ domainId: id }, 'Domain activated');
  }

  // --- Subdomain CRUD ---

  async listSubdomains(domainId: string) {
    return db.select().from(subdomains).where(eq(subdomains.domainId, domainId));
  }

  async createSubdomain(domainId: string, data: { name: string; documentRoot?: string; phpVersion?: string }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subId = nanoid();
    const fullSubdomain = `${data.name}.${domain.name}`;
    const docRoot = data.documentRoot || `${domain.documentRoot}/${data.name}`;

    // Create directory
    await mkdir(docRoot, { recursive: true });
    const subscription = await this.getSubscription(domain.subscriptionId);
    await run('chown', [`${subscription.systemUser}:${subscription.systemUser}`, docRoot], { sudo: true });

    // Add to nginx vhost server_name
    // (Simplified: in production, regenerate full vhost with new subdomain)

    await db.insert(subdomains).values({
      id: subId,
      domainId,
      name: fullSubdomain,
      documentRoot: docRoot,
      phpVersion: data.phpVersion || domain.phpVersion,
    });

    return { id: subId, name: fullSubdomain, documentRoot: docRoot };
  }

  async deleteSubdomain(domainId: string, subdomainId: string) {
    const [sub] = await db.select().from(subdomains).where(eq(subdomains.id, subdomainId)).limit(1);
    if (!sub) throw new AppError(404, 'SUBDOMAIN_NOT_FOUND', 'Subdomain not found');

    await db.delete(subdomains).where(eq(subdomains.id, subdomainId));
    // Regenerate vhost without this subdomain
    logger.info({ subdomainId }, 'Subdomain deleted');
  }

  // --- Alias CRUD ---

  async listAliases(domainId: string) {
    return db.select().from(domainAliases).where(eq(domainAliases.domainId, domainId));
  }

  async createAlias(domainId: string, alias: string) {
    const aliasId = nanoid();
    await db.insert(domainAliases).values({ id: aliasId, domainId, alias });
    // Regenerate vhost with new alias
    return { id: aliasId, alias };
  }

  async deleteAlias(domainId: string, aliasId: string) {
    await db.delete(domainAliases).where(eq(domainAliases.id, aliasId));
  }

  // --- Redirect CRUD ---

  async listRedirects(domainId: string) {
    return db.select().from(domainRedirects).where(eq(domainRedirects.domainId, domainId));
  }

  async createRedirect(domainId: string, data: { sourcePath: string; targetUrl: string; type: '301' | '302' }) {
    const redirectId = nanoid();
    await db.insert(domainRedirects).values({
      id: redirectId,
      domainId,
      sourcePath: data.sourcePath,
      targetUrl: data.targetUrl,
      type: data.type,
    });
    // Regenerate vhost with redirect directive
    return { id: redirectId, ...data };
  }

  async deleteRedirect(domainId: string, redirectId: string) {
    await db.delete(domainRedirects).where(eq(domainRedirects.id, redirectId));
  }

  // --- Helpers ---

  private async getSubscription(subscriptionId: string) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!sub) throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    return sub;
  }
}

// Helper functions
function defaultIndexHtml(domain: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Welcome to ${domain}</title></head>
<body>
  <h1>Success! ${domain} is working</h1>
  <p>Managed by ServerForge</p>
</body>
</html>`;
}

async function getServerIp(): Promise<string> {
  const result = await run('hostname', ['-I']);
  return result.stdout.trim().split(' ')[0] || '127.0.0.1';
}

interface ListOptions {
  page?: number;
  perPage?: number;
  search?: string;
  subscriptionId?: string;
  status?: string;
}
```

### 6.2 Domain Routes

#### `apps/api/src/modules/domains/domains.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { DomainsService } from './domains.service.js';
import { createDomainSchema, updateDomainSchema, createSubdomainSchema, createAliasSchema, createRedirectSchema } from './domains.schema.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';

export default async function domainRoutes(fastify: FastifyInstance) {
  const service = new DomainsService();

  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/domains — List all domains
  fastify.get('/', async (req) => {
    const { page, perPage, search, subscriptionId, status } = req.query as any;
    return service.list({ page, perPage, search, subscriptionId, status });
  });

  // POST /api/v1/domains — Create domain
  fastify.post('/', {
    preHandler: [requireRole('admin', 'reseller')],
    handler: async (req, reply) => {
      const data = createDomainSchema.parse(req.body);
      const domain = await service.create(data);
      return reply.status(201).send({ success: true, data: domain });
    },
  });

  // GET /api/v1/domains/:id — Get domain detail
  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const domain = await service.get(id);
    return { success: true, data: domain };
  });

  // PUT /api/v1/domains/:id — Update domain
  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateDomainSchema.parse(req.body);
    const domain = await service.update(id, data);
    return { success: true, data: domain };
  });

  // DELETE /api/v1/domains/:id — Delete domain
  fastify.delete('/:id', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      await service.delete(id);
      return { success: true, data: null };
    },
  });

  // POST /api/v1/domains/:id/suspend
  fastify.post('/:id/suspend', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      await service.suspend(id);
      return { success: true, data: { status: 'suspended' } };
    },
  });

  // POST /api/v1/domains/:id/activate
  fastify.post('/:id/activate', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      await service.activate(id);
      return { success: true, data: { status: 'active' } };
    },
  });

  // --- Subdomains ---
  fastify.get('/:id/subdomains', async (req) => {
    const { id } = req.params as { id: string };
    const items = await service.listSubdomains(id);
    return { success: true, data: items };
  });

  fastify.post('/:id/subdomains', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createSubdomainSchema.parse(req.body);
    const sub = await service.createSubdomain(id, data);
    return reply.status(201).send({ success: true, data: sub });
  });

  fastify.delete('/:id/subdomains/:subId', async (req) => {
    const { id, subId } = req.params as { id: string; subId: string };
    await service.deleteSubdomain(id, subId);
    return { success: true, data: null };
  });

  // --- Aliases ---
  fastify.get('/:id/aliases', async (req) => {
    const { id } = req.params as { id: string };
    const items = await service.listAliases(id);
    return { success: true, data: items };
  });

  fastify.post('/:id/aliases', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { alias } = createAliasSchema.parse(req.body);
    const item = await service.createAlias(id, alias);
    return reply.status(201).send({ success: true, data: item });
  });

  fastify.delete('/:id/aliases/:aliasId', async (req) => {
    const { id, aliasId } = req.params as { id: string; aliasId: string };
    await service.deleteAlias(id, aliasId);
    return { success: true, data: null };
  });

  // --- Redirects ---
  fastify.get('/:id/redirects', async (req) => {
    const { id } = req.params as { id: string };
    const items = await service.listRedirects(id);
    return { success: true, data: items };
  });

  fastify.post('/:id/redirects', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createRedirectSchema.parse(req.body);
    const item = await service.createRedirect(id, data);
    return reply.status(201).send({ success: true, data: item });
  });

  fastify.delete('/:id/redirects/:redirectId', async (req) => {
    const { id, redirectId } = req.params as { id: string; redirectId: string };
    await service.deleteRedirect(id, redirectId);
    return { success: true, data: null };
  });
}
```

### 6.3 Domain API Contracts

#### `POST /api/v1/domains`

**Request:**
```json
{
  "subscriptionId": "V1StGXR8_Z",
  "name": "example.com",
  "phpVersion": "8.2",
  "phpHandler": "php-fpm",
  "webServer": "nginx+apache"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "name": "example.com",
    "documentRoot": "/var/www/vhosts/admin/example.com/httpdocs",
    "status": "active"
  }
}
```

**Response (409 — Domain Exists):**
```json
{
  "success": false,
  "error": {
    "code": "DOMAIN_EXISTS",
    "message": "Domain already exists on this server"
  }
}
```

**Response (422 — System Error):**
```json
{
  "success": false,
  "error": {
    "code": "DOMAIN_CREATE_FAILED",
    "message": "Failed to create domain: Invalid Nginx config: ..."
  }
}
```

#### `GET /api/v1/domains?page=1&perPage=20&search=example`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123def456",
      "subscriptionId": "V1StGXR8_Z",
      "name": "example.com",
      "documentRoot": "/var/www/vhosts/admin/example.com/httpdocs",
      "phpVersion": "8.2",
      "phpHandler": "php-fpm",
      "webServer": "nginx+apache",
      "sslEnabled": false,
      "status": "active",
      "createdAt": 1713897600
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 1
  }
}
```

### 6.4 Domain Frontend

#### `apps/web/src/api/hooks/domains.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Domain {
  id: string;
  subscriptionId: string;
  name: string;
  documentRoot: string;
  phpVersion: string;
  phpHandler: string;
  webServer: string;
  sslEnabled: boolean;
  status: 'active' | 'suspended' | 'pending';
  createdAt: number;
}

export interface DomainListResponse {
  items: Domain[];
  meta: { page: number; perPage: number; total: number };
}

export function useDomains(params?: { page?: number; perPage?: number; search?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.perPage) query.set('perPage', String(params.perPage));
  if (params?.search) query.set('search', params.search);

  return useQuery({
    queryKey: ['domains', params],
    queryFn: () => api.get<DomainListResponse>(`/api/v1/domains?${query.toString()}`),
  });
}

export function useDomain(id: string) {
  return useQuery({
    queryKey: ['domains', id],
    queryFn: () => api.get<Domain>(`/api/v1/domains/${id}`),
    enabled: !!id,
  });
}

export function useCreateDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      subscriptionId: string;
      name: string;
      phpVersion?: string;
      phpHandler?: string;
      webServer?: string;
    }) => api.post<Domain>('/api/v1/domains', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useDeleteDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useSuspendDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/domains/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useActivateDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/domains/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}
```

#### `apps/web/src/pages/domains/DomainListPage.tsx`

```typescript
import { useState } from 'react';
import { useDomains, useCreateDomain, useDeleteDomain, useSuspendDomain } from '../../api/hooks/domains';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, ExternalLink, Pause, Trash2, Settings } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export function DomainListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDomains({ page, perPage: 20, search });
  const createMutation = useCreateDomain();
  const deleteMutation = useDeleteDomain();
  const suspendMutation = useSuspendDomain();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domains</h1>
          <p className="text-muted-foreground">Manage your web domains</p>
        </div>
        <AddDomainDialog onSubmit={(data) => createMutation.mutate(data)} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PHP</TableHead>
                <TableHead>Web Server</TableHead>
                <TableHead>SSL</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : !data?.items?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No domains found</TableCell></TableRow>
              ) : (
                data.items.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.name}</TableCell>
                    <TableCell>
                      <Badge variant={domain.status === 'active' ? 'default' : 'secondary'}>
                        {domain.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{domain.phpVersion}</TableCell>
                    <TableCell>{domain.webServer}</TableCell>
                    <TableCell>
                      <Badge variant={domain.sslEnabled ? 'default' : 'outline'}>
                        {domain.sslEnabled ? 'Active' : 'None'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(domain.createdAt * 1000).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate({ to: `/domains/${domain.id}` })}>
                            <Settings className="mr-2 h-4 w-4" /> Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`http://${domain.name}`, '_blank')}>
                            <ExternalLink className="mr-2 h-4 w-4" /> Open Site
                          </DropdownMenuItem>
                          {domain.status === 'active' && (
                            <DropdownMenuItem onClick={() => suspendMutation.mutate(domain.id)}>
                              <Pause className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => { if (confirm('Delete this domain?')) deleteMutation.mutate(domain.id); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data?.meta && data.meta.total > data.meta.perPage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((data.meta.page - 1) * data.meta.perPage) + 1} - {Math.min(data.meta.page * data.meta.perPage, data.meta.total)} of {data.meta.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * data.meta.perPage >= data.meta.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddDomainDialog({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phpVersion, setPhpVersion] = useState('8.2');
  const [webServer, setWebServer] = useState('nginx+apache');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ subscriptionId: 'default', name, phpVersion, webServer });
    setOpen(false);
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Domain</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Domain</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Domain Name</label>
            <Input
              placeholder="example.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">PHP Version</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={phpVersion}
              onChange={(e) => setPhpVersion(e.target.value)}
            >
              <option value="8.1">PHP 8.1</option>
              <option value="8.2">PHP 8.2</option>
              <option value="8.3">PHP 8.3</option>
              <option value="8.4">PHP 8.4</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Web Server</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={webServer}
              onChange={(e) => setWebServer(e.target.value)}
            >
              <option value="nginx">Nginx Only</option>
              <option value="apache">Apache Only</option>
              <option value="nginx+apache">Nginx + Apache</option>
            </select>
          </div>
          <Button type="submit" className="w-full">Create Domain</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Phase 7 — Web Server + PHP Modules: Detailed Specification

### 7.1 Web Server Service

#### `apps/api/src/modules/webserver/webserver.schema.ts`

```typescript
import { z } from 'zod';

export const updateWebServerSchema = z.object({
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).optional(),
  customNginxDirectives: z.string().max(5000).optional(),
  customApacheDirectives: z.string().max(5000).optional(),
});
```

#### `apps/api/src/modules/webserver/webserver.service.ts`

```typescript
import { db } from '../../db/index.js';
import { domains, subscriptions } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { NginxService, type VhostContext } from '../../services/nginx.service.js';
import { ApacheService, type ApacheVhostContext } from '../../services/apache.service.js';
import { AppError } from '../../errors.js';
import { env } from '../../config/env.js';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';

const nginxService = new NginxService();
const apacheService = new ApacheService();

export class WebServerService {
  /**
   * Get current web server config for a domain
   */
  async getConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    return {
      webServer: domain.webServer,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler,
      sslEnabled: domain.sslEnabled,
      redirectHttpToHttps: domain.redirectHttpToHttps,
      hsts: domain.hsts,
    };
  }

  /**
   * Update web server configuration for a domain
   */
  async updateConfig(domainId: string, data: {
    webServer?: string;
    customNginxDirectives?: string;
    customApacheDirectives?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
    const logDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`;

    // Regenerate Nginx vhost
    const nginxContext: VhostContext = {
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler === 'php-fpm' ? 'php-fpm' : 'proxy-to-apache',
      proxyToApache: (data.webServer || domain.webServer) === 'nginx+apache',
      poolName,
      logDir,
      aliases: [`www.${domain.name}`],
      customDirectives: data.customNginxDirectives,
    };
    await nginxService.addVhost(nginxContext);

    // Regenerate Apache vhost if needed
    if ((data.webServer || domain.webServer) === 'nginx+apache' || (data.webServer || domain.webServer) === 'apache') {
      const apacheContext: ApacheVhostContext = {
        domain: domain.name,
        documentRoot: domain.documentRoot,
        user: subscription.systemUser,
        phpVersion: domain.phpVersion,
        poolName,
        logDir,
        aliases: [`www.${domain.name}`],
        customDirectives: data.customApacheDirectives,
      };
      await apacheService.addVhost(apacheContext);
    }

    // Update DB
    if (data.webServer) {
      await db.update(domains).set({ webServer: data.webServer as any }).where(eq(domains.id, domainId));
    }

    return this.getConfig(domainId);
  }

  /**
   * Preview the rendered Nginx config without applying
   */
  async previewConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;
    const logDir = `${env.VHOSTS_ROOT}/${subscription.systemUser}/${domain.name}/logs`;

    const template = await readFile(
      new URL('../../templates/nginx/vhost.conf.hbs', import.meta.url), 'utf-8'
    );
    const compiled = Handlebars.compile(template);
    const rendered = compiled({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      user: subscription.systemUser,
      phpVersion: domain.phpVersion,
      proxyToApache: domain.webServer === 'nginx+apache',
      poolName,
      logDir,
      aliases: [`www.${domain.name}`],
      timestamp: new Date().toISOString(),
    });

    return { config: rendered };
  }

  /**
   * Reload web server (test + reload)
   */
  async reload(domainId: string) {
    const nginxTest = await nginxService.testConfig();
    if (!nginxTest.valid) {
      throw new AppError(422, 'INVALID_CONFIG', `Nginx config test failed: ${nginxTest.output}`);
    }
    await nginxService.reload();
    return { success: true };
  }

  /**
   * Test web server config without reloading
   */
  async testConfig(domainId: string) {
    const nginxTest = await nginxService.testConfig();
    const apacheTest = await apacheService.testConfig();
    return {
      nginx: nginxTest,
      apache: apacheTest,
    };
  }
}
```

#### `apps/api/src/modules/webserver/webserver.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { WebServerService } from './webserver.service.js';
import { updateWebServerSchema } from './webserver.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function webServerRoutes(fastify: FastifyInstance) {
  const service = new WebServerService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/domains/:id/webserver', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getConfig(id) };
  });

  fastify.put('/domains/:id/webserver', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateWebServerSchema.parse(req.body);
    return { success: true, data: await service.updateConfig(id, data) };
  });

  fastify.get('/domains/:id/webserver/config-preview', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.previewConfig(id) };
  });

  fastify.post('/domains/:id/webserver/reload', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.reload(id) };
  });

  fastify.post('/domains/:id/webserver/test-config', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.testConfig(id) };
  });
}
```

### 7.2 PHP Module

#### `apps/api/src/modules/php/php.service.ts`

```typescript
import { db } from '../../db/index.js';
import { domains, subscriptions } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { PhpFpmService, type PoolContext } from '../../services/php-fpm.service.js';
import { NginxService } from '../../services/nginx.service.js';
import { AppError } from '../../errors.js';
import { env } from '../../config/env.js';
import { readFile, writeFile } from 'node:fs/promises';

const phpFpmService = new PhpFpmService();
const nginxService = new NginxService();

export class PhpService {
  /**
   * List installed PHP versions
   */
  async listVersions() {
    const versions = await phpFpmService.listInstalledVersions();
    return { versions };
  }

  /**
   * Get PHP config for a domain
   */
  async getConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    return {
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler,
    };
  }

  /**
   * Set PHP version for a domain
   */
  async setVersion(domainId: string, phpVersion: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subscription] = await db.select().from(subscriptions)
      .where(eq(subscriptions.id, domain.subscriptionId)).limit(1);
    const poolName = `${subscription.systemUser}_${domain.name.replace(/\./g, '')}`;

    // Remove old pool
    await phpFpmService.removePool(poolName, domain.phpVersion);

    // Create new pool with updated version
    await phpFpmService.createPool({
      poolName,
      systemUser: subscription.systemUser,
      phpVersion,
      documentRoot: domain.documentRoot,
      maxChildren: 5,
      memoryLimit: '256M',
      uploadMaxFilesize: '64M',
      maxExecutionTime: '30',
    });

    // Update DB
    await db.update(domains).set({ phpVersion }).where(eq(domains.id, domainId));

    // Reload nginx (socket path changed)
    await nginxService.reload();

    return { phpVersion };
  }

  /**
   * Get per-domain php.ini overrides
   */
  async getIni(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const iniPath = `${domain.documentRoot}/../.user.ini`;
    try {
      const content = await readFile(iniPath, 'utf-8');
      return { content };
    } catch {
      return { content: '' };
    }
  }

  /**
   * Update per-domain php.ini overrides
   */
  async updateIni(domainId: string, content: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const iniPath = `${domain.documentRoot}/../.user.ini`;
    await writeFile(iniPath, content, 'utf-8');

    return { success: true };
  }

  /**
   * Restart PHP-FPM for a domain
   */
  async restartFpm(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await phpFpmService.restartVersion(domain.phpVersion);
    return { success: true };
  }
}
```

#### `apps/api/src/modules/php/php.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { PhpService } from './php.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { z } from 'zod';

const setVersionSchema = z.object({
  phpVersion: z.enum(['8.1', '8.2', '8.3', '8.4']),
});

const updateIniSchema = z.object({
  content: z.string().max(10000),
});

export default async function phpRoutes(fastify: FastifyInstance) {
  const service = new PhpService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/php/versions', async () => {
    return { success: true, data: await service.listVersions() };
  });

  fastify.get('/domains/:id/php', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getConfig(id) };
  });

  fastify.put('/domains/:id/php', async (req) => {
    const { id } = req.params as { id: string };
    const { phpVersion } = setVersionSchema.parse(req.body);
    return { success: true, data: await service.setVersion(id, phpVersion) };
  });

  fastify.get('/domains/:id/php/ini', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getIni(id) };
  });

  fastify.put('/domains/:id/php/ini', async (req) => {
    const { id } = req.params as { id: string };
    const { content } = updateIniSchema.parse(req.body);
    return { success: true, data: await service.updateIni(id, content) };
  });

  fastify.post('/domains/:id/php/restart-fpm', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.restartFpm(id) };
  });
}
```

### 7.3 Route Registration Update

#### Update `apps/api/src/routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // Phase 3: Auth
  await fastify.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/v1/auth' });
  await fastify.register(import('./modules/users/users.routes.js'), { prefix: '/api/v1/users' });
  await fastify.register(import('./modules/subscriptions/subscriptions.routes.js'), { prefix: '/api/v1' });

  // Phase 5: Stats
  await fastify.register(import('./modules/stats/stats.routes.js'), { prefix: '/api/v1/stats' });

  // Phase 6: Domains
  await fastify.register(import('./modules/domains/domains.routes.js'), { prefix: '/api/v1/domains' });

  // Phase 7: Web Server + PHP
  await fastify.register(import('./modules/webserver/webserver.routes.js'), { prefix: '/api/v1' });
  await fastify.register(import('./modules/php/php.routes.js'), { prefix: '/api/v1' });
}
```

---

## Summary of Phases 4-7 Deliverables

| File | Purpose |
|---|---|
| `services/executor.ts` | Safe command executor with allowlist + sanitization |
| `services/types.ts` | SystemService interface, ServiceInfo, ServiceStatus |
| `services/nginx.service.ts` | Nginx vhost management, test, reload, SSL enable |
| `services/apache.service.ts` | Apache vhost management, a2ensite/a2dissite |
| `services/php-fpm.service.ts` | PHP-FPM pool CRUD, version detection, restart |
| `services/bind.service.ts` | BIND9 zone file CRUD, named.conf.local management |
| `services/certbot.service.ts` | Let's Encrypt issue/renew/delete, self-signed |
| `services/mariadb.service.ts` | MariaDB database/user CRUD, export/import |
| `services/postgres.service.ts` | PostgreSQL database/user CRUD, export/import |
| `services/index.ts` | Barrel export |
| `templates/nginx/vhost.conf.hbs` | Nginx HTTP vhost template |
| `templates/nginx/vhost-ssl.conf.hbs` | Nginx HTTPS vhost template with HSTS |
| `templates/apache/vhost.conf.hbs` | Apache vhost template |
| `templates/php-fpm/pool.conf.hbs` | PHP-FPM pool config template |
| `templates/bind/zone.hbs` | BIND9 zone file template |
| `modules/stats/stats.service.ts` | Server metrics, service statuses, domain stats |
| `modules/stats/stats.routes.ts` | Stats API endpoints |
| `jobs/queue.ts` | BullMQ queue setup + repeatable job registration |
| `jobs/stats-collect.job.ts` | 30-second stats collection worker |
| `pages/dashboard/DashboardPage.tsx` | Full dashboard with CPU/RAM/Disk, services grid |
| `components/layout/Layout.tsx` | Sidebar + Topbar + content area |
| `components/layout/Sidebar.tsx` | Collapsible navigation with all menu items |
| `components/layout/Topbar.tsx` | User menu, notifications |
| `modules/domains/domains.schema.ts` | Domain CRUD Zod validation |
| `modules/domains/domains.service.ts` | Full domain lifecycle with rollback |
| `modules/domains/domains.routes.ts` | Domain + subdomain + alias + redirect routes |
| `modules/webserver/webserver.service.ts` | Web server config management |
| `modules/webserver/webserver.routes.ts` | Web server API endpoints |
| `modules/php/php.service.ts` | PHP version management, ini overrides |
| `modules/php/php.routes.ts` | PHP API endpoints |
| `pages/domains/DomainListPage.tsx` | Domain table with search, add, actions |
| `api/hooks/domains.ts` | Domain TanStack Query hooks |
| `api/hooks/stats.ts` | Stats TanStack Query hooks |

**Total: ~35 additional files for Phases 4-7**

---

*End of Phases 4-7 Detailed Implementation Guide*
