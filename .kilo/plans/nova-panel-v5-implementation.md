# NovaPanel v5 Implementation Plan

## Objective
Migrate NovaPanel from v4 (single-admin server panel) to v5 (cloud-native, multi-tenant, container-ready platform). **No backward compatibility required** — clean break, fresh schema, fresh migrations.

## Strategy
1. **Clean Slate Migration** — Drop all v4 tables, create unified v5 schema
2. **Foundation First** — Identity, tenancy, sites, domains, containers
3. **Feature Parity** — Match v4 features before adding new ones
4. **Incremental Delivery** — Each phase deployable and testable

---

## Phase 1: Foundation & Identity (Week 1)

### 1.1 Database Schema Redesign

**New schema files to create (replace existing):**

#### `apps/api/src/db/schema/organizations.ts`
```typescript
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] }).default('free'),
  status: text('status', { enum: ['active', 'suspended', 'cancelled'] }).default('active'),
  settings: text('settings', { mode: 'json' }).default('{}'),
  quotas: text('quotas', { mode: 'json' }).default('{}'),
  branding: text('branding', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const organizationMembers = sqliteTable('organization_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'member', 'billing'] }).default('member'),
  permissions: text('permissions', { mode: 'json' }).default('[]'), // granular RBAC
  invitedBy: text('invited_by'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### `apps/api/src/db/schema/projects.ts`
```typescript
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  environment: text('environment', { enum: ['production', 'staging', 'development'] }).default('production'),
  settings: text('settings', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### `apps/api/src/db/schema/users.ts` (rewrite)
- Remove `role: 'admin'` enum → `role` becomes free text for system roles
- Add `emailVerified`, `avatarUrl`, `locale`, `timezone`
- Keep sessions, tempTokens, twoFactorBackupCodes
- Remove `apiTokenHash` (moved to `api_tokens` table properly)

#### `apps/api/src/db/schema/api_keys.ts` (rename from api-tokens.ts)
```typescript
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id').references(() => organizations.id),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(), // e.g., "np_abc"
  keyHash: text('key_hash').notNull(),
  permissions: text('permissions', { mode: 'json' }).default('[]'),
  scopes: text('scopes', { mode: 'json' }).default('[]'),
  rateLimit: integer('rate_limit').default(1000),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### `apps/api/src/db/schema/audit_logs.ts` (rewrite)
```typescript
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id'),
  actorType: text('actor_type', { enum: ['user', 'api_key', 'system'] }).notNull(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(), // e.g., "site:create"
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  metadata: text('metadata', { mode: 'json' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### `apps/api/src/db/schema/roles_permissions.ts` (new)
```typescript
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  permissions: text('permissions', { mode: 'json' }).default('[]'),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
});
```

### 1.2 Auth Module Rewrite

**Files:**
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.routes.ts`

**Changes:**
1. Remove single-admin assumption — login returns `{ user, organizations[], activeOrg }`
2. Add SSO endpoints: `GET /api/v1/auth/sso/:provider`, `GET /api/v1/auth/sso/:provider/callback`
3. Add `POST /api/v1/auth/switch-org` to change active organization context
4. JWT token payload: `{ sub, orgId, projectId?, permissions[] }`
5. All routes require `x-organization-id` header or infer from JWT

### 1.3 Shared Schemas Update

**File:** `packages/schemas/src/auth.ts` (new)
```typescript
export const OrganizationSchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), plan: z.string() });
export const ProjectSchema = z.object({ id: z.string(), orgId: z.string(), name: z.string(), slug: z.string(), environment: z.string() });
export const LoginResponseSchema = z.object({ user: UserSchema, organizations: z.array(OrganizationSchema), token: z.string() });
```

**File:** `packages/schemas/src/permissions.ts` (new)
```typescript
export const PermissionSchema = z.enum([
  'sites:read', 'sites:write', 'sites:delete',
  'domains:read', 'domains:write', 'domains:delete',
  'databases:read', 'databases:write', 'databases:delete',
  'containers:read', 'containers:write', 'containers:delete',
  'files:read', 'files:write', 'files:delete',
  'settings:read', 'settings:write',
  'billing:read', 'billing:write',
  'members:read', 'members:write',
]);
```

### 1.4 Frontend Changes

**Files:**
- `apps/web/src/pages/login/LoginPage.tsx` — Add "Continue with GitHub/Google" buttons
- `apps/web/src/components/layout/Sidebar.tsx` — Add org/project switcher at top
- `apps/web/src/context/OrganizationContext.tsx` (new) — Global org/project context
- `apps/web/src/api/hooks/auth.ts` — Update to handle org switching

**Acceptance Criteria:**
- [ ] Can create organization
- [ ] Can invite members by email
- [ ] Can switch active org
- [ ] API requests include `x-organization-id`
- [ ] All existing pages still load (with org context)

---

## Phase 2: Site & Runtime Overhaul (Week 2)

### 2.1 Site Schema v5

**File:** `apps/api/src/db/schema/sites.ts` (rewrite)
```typescript
export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  
  // Runtime type
  runtime: text('runtime', { enum: ['docker', 'node', 'python', 'php', 'go', 'ruby', 'rust', 'static'] }).notNull(),
  runtimeVersion: text('runtime_version'), // "20", "8.3", "3.11"
  
  // Source
  sourceType: text('source_type', { enum: ['git', 'docker_registry', 'upload', 'empty'] }).default('empty'),
  gitRepo: text('git_repo'),
  gitBranch: text('git_branch').default('main'),
  gitWebhookSecret: text('git_webhook_secret'),
  
  // Build config
  buildCommand: text('build_command'),
  outputDirectory: text('output_directory').default('dist'),
  installCommand: text('install_command'),
  
  // Process config
  startCommand: text('start_command'),
  port: integer('port'), // user-defined or auto
  replicas: integer('replicas').default(1),
  autoRestart: integer('auto_restart', { mode: 'boolean' }).default(true),
  
  // Resource limits
  memoryLimit: integer('memory_limit'), // MB
  cpuLimit: integer('cpu_limit'), // percentage
  
  // State
  status: text('status', { enum: ['active', 'building', 'deploying', 'error', 'suspended'] }).default('active'),
  healthCheckPath: text('health_check_path').default('/health'),
  
  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

**Removed tables (v4 cleanup):**
- `site_runtimes` → merged into `sites`
- `site_processes` → replaced by Docker/container runtime
- `site_states` → replaced by live health check queries
- `deployments` → rewrite with `deployments` v5 schema

**New table:** `apps/api/src/db/schema/deployments.ts` (rewrite)
```typescript
export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  siteId: text('site_id').notNull().references(() => sites.id),
  sequence: integer('sequence').notNull(),
  
  sourceType: text('source_type', { enum: ['git', 'docker_registry', 'upload', 'rollback'] }),
  gitRef: text('git_ref'), // branch or tag
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
  
  status: text('status', { enum: ['pending', 'building', 'testing', 'deploying', 'success', 'failed', 'cancelled'] }).default('pending'),
  
  buildLogs: text('build_logs'), // store as text or path to file
  deployLogs: text('deploy_logs'),
  
  deployedAt: integer('deployed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 2.2 Docker Runtime Implementation

**Files to create:**
- `apps/api/src/modules/docker/docker.service.ts`
  - `buildSite(siteId)` — build from Dockerfile or buildpack
  - `deploySite(siteId, deploymentId)` — run container with proper networking
  - `stopSite(siteId)` — stop and remove container
  - `getContainerStatus(siteId)` — query Docker API
  - `streamLogs(siteId)` — tail container logs
- `apps/api/src/modules/docker/docker.routes.ts`
  - `POST /api/v1/sites/:id/build`
  - `POST /api/v1/sites/:id/deploy`
  - `GET /api/v1/sites/:id/logs`
  - `GET /api/v1/sites/:id/status`
- `apps/api/src/modules/docker/docker.schema.ts`

**Docker naming convention:**
- Container: `novapanel-site-{siteId}`
- Network: `novapanel-net-{projectId}`
- Volume: `novapanel-vol-{siteId}`

### 2.3 Git Integration

**Files to create:**
- `apps/api/src/modules/git/git.service.ts`
  - `cloneRepo(repo, branch, targetDir)`
  - `pullLatest(targetDir, branch)`
  - `validateWebhook(secret, payload, signature)`
- `apps/api/src/modules/git/git.routes.ts`
  - `POST /api/v1/webhooks/git/:siteId` — public webhook endpoint
  - `GET /api/v1/sites/:id/git/status`
- `apps/api/src/modules/git/git.schema.ts`

### 2.4 Build Pipeline Service

**Files to create:**
- `apps/api/src/modules/build/build.service.ts`
  - `runBuild(siteId, deploymentId)` — execute build in Docker context
  - `detectRuntime(homeDir)` — auto-detect Node/Python/Go from files
  - `generateDockerfile(site)` — generate Dockerfile for non-Docker sites
- `apps/api/src/modules/build/build.routes.ts`
- `apps/api/src/modules/build/build.schema.ts`

### 2.5 Shared Schemas

**File:** `packages/schemas/src/sites.ts` (rewrite)
```typescript
export const SiteSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  slug: z.string(),
  runtime: z.enum(['docker', 'node', 'python', 'php', 'go', 'ruby', 'rust', 'static']),
  runtimeVersion: z.string().optional(),
  sourceType: z.string().optional(),
  gitRepo: z.string().optional(),
  gitBranch: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  port: z.number().optional(),
  replicas: z.number().default(1),
  status: z.string(),
  createdAt: z.string().or(z.date()),
});

export const DeploymentSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  sequence: z.number(),
  status: z.enum(['pending', 'building', 'testing', 'deploying', 'success', 'failed', 'cancelled']),
  commitSha: z.string().optional(),
  commitMessage: z.string().optional(),
  deployedAt: z.string().or(z.date()).optional(),
  durationMs: z.number().optional(),
});
```

### 2.6 Frontend Changes

**Files:**
- `apps/web/src/pages/sites/SitesPage.tsx` — Show deployment status, git info
- `apps/web/src/pages/sites/SiteDetailPage.tsx` — Add Deployments tab, Env Vars tab, Settings tab
- `apps/web/src/pages/sites/CreateSitePage.tsx` (new) — Multi-step wizard: source → runtime → config → deploy
- `apps/web/src/pages/sites/components/DeploymentList.tsx` (new)
- `apps/web/src/pages/sites/components/BuildLogs.tsx` (new)
- `apps/web/src/pages/sites/components/GitSettings.tsx` (new)
- `apps/web/src/api/hooks/sites.ts` — Update for v5 schema

**Acceptance Criteria:**
- [ ] Create site with Git repo → auto-builds on push
- [ ] Create site with Dockerfile → builds and runs container
- [ ] Create site with Node/Python/PHP → auto-detect, auto-generate Dockerfile
- [ ] Deployment history visible
- [ ] Rollback to previous deployment works
- [ ] Environment variables encrypted and injected at runtime

---

## Phase 3: Domains & SSL v5 (Week 3)

### 3.1 Domain Schema

**File:** `apps/api/src/db/schema/domains.ts` (rewrite)
```typescript
export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  siteId: text('site_id').references(() => sites.id),
  
  name: text('name').notNull(), // e.g., "example.com"
  type: text('type', { enum: ['apex', 'subdomain', 'wildcard'] }).default('apex'),
  
  // DNS
  dnsZoneId: text('dns_zone_id').references(() => dnsZones.id),
  nameservers: text('nameservers', { mode: 'json' }),
  dnssecEnabled: integer('dnssec_enabled', { mode: 'boolean' }).default(false),
  
  // SSL
  sslStatus: text('ssl_status', { enum: ['pending', 'active', 'expired', 'error'] }).default('pending'),
  sslCertId: text('ssl_cert_id').references(() => sslCertificates.id),
  sslAutoRenew: integer('ssl_auto_renew', { mode: 'boolean' }).default(true),
  forceHttps: integer('force_https', { mode: 'boolean' }).default(true),
  hstsEnabled: integer('hsts_enabled', { mode: 'boolean' }).default(false),
  
  // Proxy config
  proxyEnabled: integer('proxy_enabled', { mode: 'boolean' }).default(true),
  customNginxConfig: text('custom_nginx_config'),
  
  status: text('status', { enum: ['active', 'suspended', 'pending'] }).default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 3.2 SSL Certificate Schema

**File:** `apps/api/src/db/schema/ssl_certificates.ts` (rewrite)
```typescript
export const sslCertificates = sqliteTable('ssl_certificates', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id),
  type: text('type', { enum: ['letsencrypt', 'zerossl', 'google', 'custom', 'self_signed'] }).notNull(),
  
  // Certificate data
  certPem: text('cert_pem'),
  keyPem: text('key_pem'),
  chainPem: text('chain_pem'),
  
  // Metadata
  issuedAt: integer('issued_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true),
  renewalDaysBeforeExpiry: integer('renewal_days').default(14),
  
  // Status
  status: text('status', { enum: ['active', 'pending', 'expired', 'revoked', 'error'] }).default('pending'),
  lastError: text('last_error'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 3.3 DNS Zone Schema

**File:** `apps/api/src/db/schema/dns.ts` (rewrite)
```typescript
export const dnsZones = sqliteTable('dns_zones', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  domainId: text('domain_id').notNull(),
  name: text('name').notNull(), // e.g., "example.com"
  soa: text('soa', { mode: 'json' }),
  nsRecords: text('ns_records', { mode: 'json' }),
  dnssecEnabled: integer('dnssec_enabled', { mode: 'boolean' }).default(false),
  dnssecKeys: text('dnssec_keys', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const dnsRecords = sqliteTable('dns_records', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => dnsZones.id),
  name: text('name').notNull(), // subdomain or @
  type: text('type', { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS', 'PTR'] }).notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').default(3600),
  priority: integer('priority'), // for MX/SRV
  weight: integer('weight'), // for SRV
  port: integer('port'), // for SRV
  proxied: integer('proxied', { mode: 'boolean' }).default(false), // Cloudflare proxy
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 3.4 Services

**Files:**
- `apps/api/src/modules/ssl/ssl.service.ts` — Add wildcard (DNS-01) support, multiple providers
- `apps/api/src/modules/dns/dns.service.ts` — Full BIND9 zone management with API
- `apps/api/src/modules/domains/domains.service.ts` — Rewrite for v5 schema, add proxy rules

### 3.5 Frontend

**Files:**
- `apps/web/src/pages/domains/DomainsPage.tsx` — Add SSL status indicators, DNS quick actions
- `apps/web/src/pages/domains/DomainDetailPage.tsx` (new) — DNS records table, SSL cert details, nginx config editor
- `apps/web/src/pages/ssl/SslPage.tsx` — Certificate list with expiry warnings, provider selection
- `apps/web/src/pages/dns/DnsPage.tsx` — Zone list, record editor with type validation

**Acceptance Criteria:**
- [ ] Add domain → auto-creates DNS zone
- [ ] Enable SSL → Let's Encrypt with HTTP-01 or DNS-01
- [ ] Wildcard cert `*.example.com` works
- [ ] Custom nginx config per domain
- [ ] DNS records: A, AAAA, CNAME, MX, TXT, SRV

---

## Phase 4: Containers & Orchestration (Week 4)

### 4.1 Container Schema

**File:** `apps/api/src/db/schema/containers.ts` (new)
```typescript
export const containerServices = sqliteTable('container_services', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['compose', 'dockerfile', 'image'] }).notNull(),
  
  // Config
  composeFile: text('compose_file'), // raw docker-compose.yml
  dockerfile: text('dockerfile'),
  image: text('image'),
  
  // Environment
  env: text('env', { mode: 'json' }).default('{}'),
  secrets: text('secrets', { mode: 'json' }).default('[]'),
  
  // Networking
  networkMode: text('network_mode').default('bridge'),
  exposedPorts: text('exposed_ports', { mode: 'json' }).default('[]'),
  
  // Resources
  cpuLimit: integer('cpu_limit'),
  memoryLimit: integer('memory_limit'),
  replicas: integer('replicas').default(1),
  
  status: text('status', { enum: ['running', 'stopped', 'error', 'restarting'] }).default('stopped'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const containerVolumes = sqliteTable('container_volumes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  size: integer('size'), // MB
  mountPoint: text('mount_point'),
  driver: text('driver').default('local'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 4.2 Container Service

**Files:**
- `apps/api/src/modules/containers/containers.service.ts`
  - `deployCompose(projectId, composeFile)` — validates and deploys docker-compose
  - `deployDockerfile(serviceId)` — builds and runs
  - `scaleService(serviceId, replicas)`
  - `getServiceLogs(serviceId)`
  - `execCommand(serviceId, command)`
- `apps/api/src/modules/containers/containers.routes.ts`
- `apps/api/src/modules/containers/containers.schema.ts`

### 4.3 Registry Integration

**File:** `apps/api/src/db/schema/registries.ts` (new)
```typescript
export const registries = sqliteTable('registries', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  provider: text('provider', { enum: ['dockerhub', 'ghcr', 'ecr', 'gcr', 'selfhosted'] }).notNull(),
  url: text('url'),
  username: text('username'),
  password: text('password'), // encrypted
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 4.4 Frontend

**Files:**
- `apps/web/src/pages/containers/ContainersPage.tsx` (new)
- `apps/web/src/pages/containers/ContainerDetailPage.tsx` (new) — Logs, env vars, scaling, exec
- `apps/web/src/pages/containers/components/ComposeEditor.tsx` (new) — YAML editor with validation
- `apps/web/src/pages/containers/components/VolumeList.tsx` (new)
- `apps/web/src/pages/containers/components/RegistryList.tsx` (new)

**Acceptance Criteria:**
- [ ] Deploy Docker Compose stack
- [ ] Scale individual services up/down
- [ ] View real-time logs
- [ ] Add private registry credentials
- [ ] Exec into running container

---

## Phase 5: Databases v5 (Week 5)

### 5.1 Database Schema

**File:** `apps/api/src/db/schema/databases.ts` (rewrite)
```typescript
export const databases = sqliteTable('databases', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'sqlite'] }).notNull(),
  version: text('version'),
  
  // Connection
  host: text('host').default('localhost'),
  port: integer('port'),
  databaseName: text('database_name'),
  username: text('username'),
  password: text('password'), // encrypted
  
  // Docker config (for containerized DBs)
  containerId: text('container_id'),
  volumeId: text('volume_id'),
  
  // Features
  backupsEnabled: integer('backups_enabled', { mode: 'boolean' }).default(true),
  backupSchedule: text('backup_schedule').default('0 2 * * *'),
  publicAccess: integer('public_access', { mode: 'boolean' }).default(false),
  
  status: text('status', { enum: ['running', 'stopped', 'error', 'creating'] }).default('creating'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const databaseUsers = sqliteTable('database_users', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull(),
  username: text('username').notNull(),
  password: text('password'), // encrypted
  privileges: text('privileges', { mode: 'json' }).default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 5.2 Database Service

**Files:**
- `apps/api/src/modules/databases/databases.service.ts` (rewrite)
  - `createDatabase(projectId, type, name)` — spins up Docker container for DB
  - `backupDatabase(dbId)` — pg_dump, mysqldump, redis BGSAVE
  - `restoreDatabase(dbId, backupId)`
  - `runQuery(dbId, query)` — with read-only safety for SELECT
  - `createUser(dbId, username, privileges)`
- `apps/api/src/modules/databases/databases.routes.ts`

### 5.3 Frontend

**Files:**
- `apps/web/src/pages/databases/DatabasesPage.tsx` — Status indicators, type icons
- `apps/web/src/pages/databases/DatabaseDetailPage.tsx` (rewrite) — Connection string, backup list, query tool
- `apps/web/src/pages/databases/components/QueryTool.tsx` (new) — SQL editor with results table
- `apps/web/src/pages/databases/components/BackupList.tsx` (new)

**Acceptance Criteria:**
- [ ] Create PostgreSQL/MySQL/Redis DB → runs in Docker
- [ ] View connection string
- [ ] Run queries in web UI
- [ ] Automated backups
- [ ] Restore from backup

---

## Phase 6: Object Storage (Week 6)

### 6.1 Storage Schema

**File:** `apps/api/src/db/schema/storage.ts` (new)
```typescript
export const buckets = sqliteTable('buckets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  region: text('region').default('default'),
  publicAccess: integer('public_access', { mode: 'boolean' }).default(false),
  versioning: integer('versioning', { mode: 'boolean' }).default(false),
  corsRules: text('cors_rules', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const storageAccessKeys = sqliteTable('storage_access_keys', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  accessKeyId: text('access_key_id').notNull().unique(),
  secretKeyHash: text('secret_key_hash').notNull(),
  permissions: text('permissions', { mode: 'json' }).default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 6.2 MinIO Integration

**Files:**
- `apps/api/src/modules/storage/storage.service.ts`
  - `createBucket(projectId, name)` — calls MinIO Admin API
  - `deleteBucket(bucketId)`
  - `generatePresignedUrl(bucketId, objectKey, expiry)`
  - `listObjects(bucketId, prefix)`
- `apps/api/src/modules/storage/storage.routes.ts`
- `apps/api/src/modules/storage/storage.schema.ts`

### 6.3 Frontend

**Files:**
- `apps/web/src/pages/storage/StoragePage.tsx` (new) — Bucket list, create/delete
- `apps/web/src/pages/storage/BucketDetailPage.tsx` (new) — File browser, upload, presigned URLs
- `apps/web/src/pages/storage/components/FileBrowser.tsx` (new) — S3-style object browser

**Acceptance Criteria:**
- [ ] Create bucket in MinIO
- [ ] Upload files via web UI
- [ ] Generate presigned URLs
- [ ] Create access keys with permissions

---

## Phase 7: Monitoring & Observability (Week 7)

### 7.1 Metrics Collection

**Files:**
- `apps/api/src/modules/monitoring/monitoring.service.ts`
  - `collectSiteMetrics(siteId)` — CPU, memory, disk, network from Docker stats
  - `collectSystemMetrics()` — server-level stats
  - `storeMetric(name, labels, value, timestamp)`
- `apps/api/src/modules/monitoring/monitoring.routes.ts`
  - `GET /api/v1/sites/:id/metrics?range=1h|24h|7d`
  - `GET /api/v1/monitoring/system`

**Schema:** `apps/api/src/db/schema/metrics.ts` (new)
```typescript
export const metrics = sqliteTable('metrics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // "cpu_usage", "memory_usage"
  labels: text('labels', { mode: 'json' }).default('{}'), // { siteId: "...", containerId: "..." }
  value: integer('value').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
```

### 7.2 Log Aggregation

**Files:**
- `apps/api/src/modules/logs/logs.service.ts` (rewrite)
  - `streamSiteLogs(siteId)` — Docker logs + nginx access/error logs
  - `searchLogs(query, filters)` — full-text search over collected logs
  - `exportLogs(filters)` — download as CSV/JSON

### 7.3 Alerting

**File:** `apps/api/src/db/schema/alerts.ts` (new)
```typescript
export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  metric: text('metric').notNull(), // "cpu_usage", "memory_usage", "disk_usage"
  condition: text('condition', { enum: ['gt', 'lt', 'eq'] }).notNull(),
  threshold: integer('threshold').notNull(),
  duration: integer('duration').default(60), // seconds
  channels: text('channels', { mode: 'json' }).default('[]'), // ["email", "slack", "webhook"]
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
});
```

**Files:**
- `apps/api/src/modules/alerts/alerts.service.ts`
- `apps/api/src/modules/alerts/alerts.routes.ts`

### 7.4 Frontend

**Files:**
- `apps/web/src/pages/monitoring/MonitoringPage.tsx` (rewrite) — Real-time charts using Recharts
- `apps/web/src/pages/monitoring/components/MetricsChart.tsx` (new)
- `apps/web/src/pages/monitoring/components/LogStream.tsx` (new) — Live tail with filtering
- `apps/web/src/pages/monitoring/components/AlertRules.tsx` (new)
- `apps/web/src/pages/logs/LogsPage.tsx` — Unified log viewer with search

**Acceptance Criteria:**
- [ ] Real-time CPU/memory/disk charts per site
- [ ] Live log tail with filters
- [ ] Alert rules with email/Slack notifications
- [ ] Log search with keyword filtering

---

## Phase 8: Security & WAF (Week 8)

### 8.1 WAF Schema

**File:** `apps/api/src/db/schema/security.ts` (new)
```typescript
export const wafRules = sqliteTable('waf_rules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['owasp', 'custom', 'rate_limit', 'geo_block', 'bot'] }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(100),
  config: text('config', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const ipAllowlists = sqliteTable('ip_allowlists', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  ips: text('ips', { mode: 'json' }).default('[]'), // ["192.168.1.0/24", "10.0.0.1"]
  type: text('type', { enum: ['allow', 'block'] }).notNull(),
});
```

### 8.2 Security Service

**Files:**
- `apps/api/src/modules/security/security.service.ts`
  - `generateNginxWafConfig(projectId)` — ModSecurity rules into nginx
  - `applyRateLimit(siteId, rules)` — nginx limit_req
  - `blockIp(projectId, ip)` — nftables/ufw integration
  - `scanDependencies(siteId)` — check package.json/requirements.txt for CVEs
- `apps/api/src/modules/security/security.routes.ts`

### 8.3 Frontend

**Files:**
- `apps/web/src/pages/security/SecurityPage.tsx` (new)
- `apps/web/src/pages/security/components/WafRules.tsx` (new)
- `apps/web/src/pages/security/components/IpAllowlist.tsx` (new)
- `apps/web/src/pages/security/components/VulnerabilityScan.tsx` (new)

**Acceptance Criteria:**
- [ ] OWASP Core Rule Set active
- [ ] Custom WAF rules per site
- [ ] Rate limiting configurable
- [ ] IP allowlist/blocklist
- [ ] Dependency vulnerability scan

---

## Phase 9: Backups & Disaster Recovery (Week 9)

### 9.1 Backup Schema

**File:** `apps/api/src/db/schema/backups.ts` (rewrite)
```typescript
export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  resourceType: text('resource_type', { enum: ['site', 'database', 'container', 'config'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  
  type: text('type', { enum: ['full', 'incremental', 'snapshot'] }).default('full'),
  status: text('status', { enum: ['pending', 'running', 'success', 'failed'] }).default('pending'),
  
  size: integer('size'), // bytes
  path: text('path'), // local or S3 path
  
  // Offsite
  storageBackend: text('storage_backend', { enum: ['local', 's3', 'b2', 'wasabi'] }).default('local'),
  storagePath: text('storage_path'),
  
  retentionDays: integer('retention_days').default(30),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const backupSchedules = sqliteTable('backup_schedules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  cronExpression: text('cron_expression').notNull(),
  retentionDays: integer('retention_days').default(30),
  storageBackend: text('storage_backend').default('local'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
});
```

### 9.2 Backup Service

**Files:**
- `apps/api/src/modules/backup/backup.service.ts` (rewrite)
  - `scheduleBackup(scheduleId)` — triggered by cron
  - `backupSite(siteId)` — tarball of files + config
  - `backupDatabase(dbId)` — native DB dump
  - `uploadToS3(backupId)` — stream to configured S3 backend
  - `restoreBackup(backupId, targetResourceId)`

### 9.3 Frontend

**Files:**
- `apps/web/src/pages/backups/BackupsPage.tsx` (rewrite)
- `apps/web/src/pages/backups/components/BackupSchedules.tsx` (new)
- `apps/web/src/pages/backups/components/StorageConfig.tsx` (new)

**Acceptance Criteria:**
- [ ] Scheduled backups running
- [ ] Manual backup trigger
- [ ] Restore from backup
- [ ] S3 offsite upload

---

## Phase 10: Billing & Quotas (Week 10)

### 10.1 Billing Schema

**File:** `apps/api/src/db/schema/billing.ts` (new)
```typescript
export const usageRecords = sqliteTable('usage_records', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  resourceType: text('resource_type', { enum: ['cpu', 'memory', 'storage', 'bandwidth', 'requests'] }).notNull(),
  resourceId: text('resource_id'),
  quantity: integer('quantity').notNull(), // units consumed
  unit: text('unit').notNull(), // "seconds", "mb", "gb", "count"
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  status: text('status', { enum: ['draft', 'open', 'paid', 'overdue', 'cancelled'] }).default('draft'),
  amount: integer('amount').notNull(), // cents
  currency: text('currency').default('USD'),
  periodStart: integer('period_start', { mode: 'timestamp' }),
  periodEnd: integer('period_end', { mode: 'timestamp' }),
  lineItems: text('line_items', { mode: 'json' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 10.2 Quota Enforcement

**Files:**
- `apps/api/src/modules/billing/billing.service.ts`
  - `recordUsage(orgId, resourceType, quantity)`
  - `checkQuota(orgId, resourceType)` — middleware to block over-quota
  - `generateInvoice(orgId, periodStart, periodEnd)`
- `apps/api/src/modules/billing/billing.routes.ts`

### 10.3 Frontend

**Files:**
- `apps/web/src/pages/billing/BillingPage.tsx` (new)
- `apps/web/src/pages/billing/components/UsageChart.tsx` (new)
- `apps/web/src/pages/billing/components/InvoiceList.tsx` (new)
- `apps/web/src/pages/settings/OrganizationSettings.tsx` (new) — Plan upgrade, quota management

**Acceptance Criteria:**
- [ ] Usage tracking per org
- [ ] Quota enforcement (block new sites if over limit)
- [ ] Invoice generation
- [ ] Plan upgrade/downgrade

---

## Phase 11: API Gateway & WebSockets (Week 11)

### 11.1 API Gateway

**File:** `apps/api/src/gateway.ts` (new)
```typescript
// Fastify plugin for API gateway features
export default async function gateway(fastify: FastifyInstance) {
  // Rate limiting per API key
  await fastify.register(rateLimit, {
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
    max: async (req) => await getRateLimit(req),
  });
  
  // Request caching for GET endpoints
  await fastify.register(cache, { expiresIn: 60000 });
  
  // API versioning — /api/v1/ and /api/v2/
  fastify.addHook('onRequest', async (req) => {
    const version = req.headers['x-api-version'] || 'v1';
    req.apiVersion = version;
  });
}
```

### 11.2 WebSocket Hub

**File:** `apps/api/src/modules/ws/ws.service.ts` (rewrite)
- Room-based subscriptions: `org:{orgId}`, `project:{projectId}`, `site:{siteId}`
- Events: `deployment.update`, `metric.update`, `log.line`, `alert.triggered`

### 11.3 Frontend Real-Time

**Files:**
- `apps/web/src/api/ws.ts` (rewrite) — Reconnecting WebSocket with room subscription
- `apps/web/src/hooks/useRealtime.ts` (new) — React hook for WebSocket events

**Acceptance Criteria:**
- [ ] Rate limits enforced per API key
- [ ] WebSocket rooms for org/project/site
- [ ] Real-time deployment progress
- [ ] Real-time metrics streaming

---

## Phase 12: Marketplace & Plugins (Week 12)

### 12.1 Plugin System

**File:** `apps/api/src/db/schema/plugins.ts` (new)
```typescript
export const plugins = sqliteTable('plugins', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  author: text('author'),
  manifest: text('manifest', { mode: 'json' }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  config: text('config', { mode: 'json' }).default('{}'),
});
```

### 12.2 Plugin Runtime

**Files:**
- `apps/api/src/modules/plugins/plugin.service.ts`
  - `loadPlugins()` — scan plugins directory
  - `registerRoutes(plugin)` — inject Fastify routes from plugin
  - `registerHooks(plugin)` — lifecycle hooks
- `apps/api/src/modules/plugins/plugin.routes.ts`

### 12.3 Frontend

**Files:**
- `apps/web/src/pages/marketplace/MarketplacePage.tsx` (new)
- `apps/web/src/pages/marketplace/components/PluginCard.tsx` (new)
- `apps/web/src/pages/marketplace/components/PluginConfig.tsx` (new)

**Acceptance Criteria:**
- [ ] Install/uninstall plugins
- [ ] Plugin routes registered dynamically
- [ ] Plugin config UI generated from manifest schema

---

## Technical Implementation Details

### Database Migration Strategy

Since no backward compatibility is required:

1. **Fresh migration chain**: Delete all existing migrations, generate single `0000_fresh_start.sql`
2. **Seed script**: `apps/api/src/db/seed.ts` — create default org, admin user
3. **Data export/import**: Provide CLI tool for v4 → v5 data migration

**Files:**
- `apps/api/src/db/migrate.ts` — update to use new schema
- `apps/api/src/db/seed.ts` (rewrite)

### Frontend Router Updates

**File:** `apps/web/src/router.tsx`

Add routes:
```typescript
const createSiteRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/sites/new', component: CreateSitePage });
const containerRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/containers', component: ContainersPage });
const containerDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/containers/$id', component: ContainerDetailPage });
const storageRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/storage', component: StoragePage });
const bucketDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/storage/$id', component: BucketDetailPage });
const securityRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/security', component: SecurityPage });
const billingRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/billing', component: BillingPage });
const marketplaceRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/marketplace', component: MarketplacePage });
const orgSettingsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/settings/organization', component: OrganizationSettingsPage });
```

### Sidebar Updates

**File:** `apps/web/src/components/layout/Sidebar.tsx`

New structure:
```
Overview
  Dashboard
Web
  Sites
  Domains
  SSL
  Containers
  Storage
Services
  Databases
  DNS
  Mail
  FTP
Network
  Cloudflare
Security
  WAF & Rules
  IP Allowlist
System
  Files
  Terminal
  Cron
  Firewall
  Logs
  Monitoring
Tools
  Backups
  Installer
  Marketplace
  Webhooks
Account
  Profile
  Organization
  Billing
  API Keys
  Audit Log
```

### Testing Strategy

**Per phase:**
1. `pnpm --filter api build` passes
2. `pnpm --filter web build` passes
3. Fresh database migration succeeds
4. Seed data loads
5. All new routes respond correctly
6. Frontend pages load without errors
7. CRUD operations tested via UI

**End-to-end:**
- Deploy to dev server after each phase
- Run integration tests against real Docker daemon
- Load test WebSocket connections

### Deployment

**No changes to deployment strategy:**
- `pnpm build` (schemas → api → web)
- `scripts/rebuild-and-deploy.sh`
- systemd service on port 8732
- Fresh SQLite database per install

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| 12 weeks is too long | Deliver in phases, each deployable independently |
| Docker complexity | Start with basic `docker run`, expand to Compose later |
| SQLite limits for metrics | Metrics table with TTL cleanup, archive old data |
| WebSocket scaling | Single-node first, Redis adapter later if needed |
| Plugin security | Sandboxed execution, permission validation |

## Success Criteria

- [ ] All v4 features work under v5 (sites, domains, SSL, databases, files, etc.)
- [ ] Multi-tenant: multiple orgs with isolated resources
- [ ] GitOps: push to deploy with preview environments
- [ ] Containers: Docker Compose and standalone containers
- [ ] Object storage: S3-compatible buckets
- [ ] Monitoring: real-time metrics and alerting
- [ ] Security: WAF, rate limiting, vulnerability scanning
- [ ] Billing: usage tracking and quota enforcement
- [ ] Plugin system: installable extensions
- [ ] API gateway: rate limiting, versioning, caching
