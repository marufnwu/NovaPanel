# NovaPanel Architecture Redesign

## Multi-Runtime Application Support (PHP, Node.js, Python, Static)

**Document Version:** 1.0
**Last Updated:** 2026-05-19
**Status:** Implementation Plan

---

## 1. Executive Summary

NovaPanel currently operates as a PHP-centric shared hosting control panel. This architecture redesign transforms NovaPanel into a modern PaaS-like platform supporting multiple application runtimes (PHP, Node.js, Python, Static) while maintaining the simplicity and reliability expected of a self-hosted panel.

The new architecture introduces four core principles:

1. **Desired vs Actual State Model** — Configuration is declarative; the system continuously reconciles actual state toward desired state
2. **Reconciler Pattern** — A dedicated reconciliation loop ensures configurations remain consistent across all runtimes
3. **Immutable Deployments** — Each deployment is versioned, isolated, and switchable via symlinks
4. **Runtime Abstraction** — Unified interface hides implementation differences between PHP-FPM, Node.js clusters, and Python virtual environments

### Motivation

The current architecture couples websites too tightly with domains, making multi-runtime support and zero-downtime deployments difficult. The new design separates concerns:

- **Sites** are logical application containers with runtime configuration
- **Domains** are routing endpoints with behavior roles
- **Deployments** are immutable versioned snapshots
- **Runtimes** are pluggable execution environments

---

## 2. Architecture Overview

### 2.1 Desired vs Actual State Model

Every managed entity has two states:

| Concept | Description |
|---------|-------------|
| **Desired State** | Stored in the database — what the user has configured |
| **Actual State** | The current runtime state on the server |
| **Reconciliation** | The process of bringing actual state to match desired state |

Example: A user sets `site.processes = 4` (desired). The reconciler ensures 4 PHP-FPM workers are running (actual).

### 2.2 Reconciler Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     Reconciliation Loop                      │
│                                                              │
│  for each site in sites:                                     │
│    actual = inspectProcessState(site.id)                    │
│    desired = loadDesiredState(site.id)                      │
│    diff = computeDiff(desired, actual)                      │
│    if diff.hasChanges:                                       │
│      applyChanges(diff)                                      │
│      logChange(diff)                                        │
│    fi                                                       │
│  od                                                         │
└─────────────────────────────────────────────────────────────┘
```

The reconciler runs every 30 seconds as a background job, detecting drift and correcting it automatically.

### 2.3 Immutable Deployments

Each deployment is a complete snapshot of the application at a point in time:

```
/var/www/sites/{site_id}/
├── deployments/
│   ├── deploy_001/          # Version 1
│   │   ├── httpdocs/        # Application files
│   │   └── .env             # Deployment-specific env
│   ├── deploy_002/          # Version 2
│   │   ├── httpdocs/
│   │   └── .env
│   └── deploy_003/          # Version 3 (current)
│       ├── httpdocs/
│       └── .env
├── shared/                   # Persistent across deployments
│   ├── .env                  # Base environment variables
│   ├── uploads/             # User uploads
│   └── storage/             # Application storage
└── httpdocs -> symlink to deployments/deploy_003/httpdocs
```

Rollback is simply updating the `httpdocs` symlink.

### 2.4 Runtime Abstraction

All runtimes implement a common interface:

```typescript
interface Runtime {
  readonly name: 'php' | 'node' | 'python' | 'static'
  readonly versions: string[]
  
  configure(siteId: string, config: RuntimeConfig): Promise<void>
  start(siteId: string): Promise<void>
  stop(siteId: string): Promise<void>
  getStatus(siteId: string): Promise<RuntimeStatus>
  getHealth(siteId: string): Promise<HealthCheckResult>
}
```

---

## 3. Database Schema Design

### Phase 1: Core Tables

#### 3.1 `sites` — Minimal Identity Table

```sql
CREATE TABLE sites (
  id TEXT PRIMARY KEY,                    -- nanoid, e.g., 'st_abc123'
  name TEXT NOT NULL,                      -- Human label: "Main Site"
  system_user TEXT NOT NULL UNIQUE,        -- OS user: sf_abc123
  home_dir TEXT NOT NULL,                  -- /var/www/sites/st_abc123
  status TEXT NOT NULL DEFAULT 'active',  -- active|suspended|deploying
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER,                     -- Soft delete
  
  UNIQUE(system_user)
);
```

```typescript
interface Site {
  id: string
  name: string
  systemUser: string
  homeDir: string
  status: 'active' | 'suspended' | 'deploying'
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
```

#### 3.2 `site_runtimes` — JSONB Runtime Configuration with Versioning

```sql
CREATE TABLE site_runtimes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Runtime identification
  runtime TEXT NOT NULL,                   -- php|node|python|static
  version TEXT NOT NULL,                  -- "8.2", "20", "3.11"
  
  -- Configuration as JSONB
  config JSONB NOT NULL,                  -- Runtime-specific configuration
  
  -- Versioning
  config_version INTEGER NOT NULL DEFAULT 1,  -- Auto-increment on config changes
  
  -- Active flag (one active per site)
  is_active INTEGER NOT NULL DEFAULT 1,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  UNIQUE(site_id, runtime)
);
```

```typescript
interface SiteRuntime {
  id: string
  siteId: string
  runtime: 'php' | 'node' | 'python' | 'static'
  version: string
  config: PhpConfig | NodeConfig | PythonConfig | StaticConfig
  configVersion: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// PHP-specific config
interface PhpConfig {
  schemaVersion: 1
  runtime: 'php'
  version: string                    // "8.1" | "8.2" | "8.3"
  handler: 'php-fpm' | 'cgi'
  poolConfig?: {
    pm: 'static' | 'dynamic' | 'ondemand'
    pmMaxChildren: number
    pmStartServers: number
    pmMinSpareServers: number
    pmMaxSpareServers: number
  }
}

// Node.js-specific config
interface NodeConfig {
  schemaVersion: 1
  runtime: 'node'
  version: string                    // "18" | "20" | "22"
  buildCommand: string              // npm run build
  startCommand: string              // node server.js
  nodeEnv: 'development' | 'production'
  buildOutput: string               // dist/, build/, etc.
  pm2Cluster?: boolean              // Enable cluster mode
  pm2Instances?: number             // Number of instances
}

// Python-specific config
interface PythonConfig {
  schemaVersion: 1
  runtime: 'python'
  version: string                   // "3.10" | "3.11" | "3.12"
  venvPath: string                  // "venv", ".venv"
  startCommand: string              // gunicorn app:app
  requirementsPath: string          // requirements.txt
  buildCommand?: string             // pip install -r requirements.txt
  environment?: Record<string, string>
}

// Static-specific config
interface StaticConfig {
  schemaVersion: 1
  runtime: 'static'
  buildCommand?: string             // npm run build
  outputDirectory: string          // "dist", "build", "_site"
  cleanUrls: boolean               // Enable clean URLs (rewrite to index.html)
}
```

#### 3.3 `site_processes` — Process Management with Auto Port Allocation

```sql
CREATE TABLE site_processes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  runtime TEXT NOT NULL,             -- php|node|python
  
  -- Process identification
  process_name TEXT NOT NULL,        -- "php-fpm", "node-primary", "node-worker-1"
  
  -- Auto-allocated ports (for Node.js/Python)
  port INTEGER,                      -- NULL for PHP-FPM (uses socket)
  
  -- Process state
  pid INTEGER,                        -- Current PID, NULL if not running
  status TEXT NOT NULL DEFAULT 'stopped',  -- stopped|starting|running|stopping|error
  
  -- Resource limits
  max_memory_mb INTEGER,              -- Memory limit
  cpu_affinity TEXT,                  -- CPU affinity mask
  
  -- Health
  last_health_check INTEGER,          -- Timestamp
  health_status TEXT,                  -- healthy|unhealthy|unknown
  
  started_at INTEGER,
  stopped_at INTEGER,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
interface SiteProcess {
  id: string
  siteId: string
  runtime: 'php' | 'node' | 'python'
  processName: string
  port: number | null
  pid: number | null
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
  maxMemoryMb: number | null
  cpuAffinity: string | null
  lastHealthCheck: Date | null
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
  startedAt: Date | null
  stoppedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

#### 3.4 `domains` — Role/Behavior Model with Parent Relationships

```sql
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  
  -- Domain identity
  name TEXT NOT NULL UNIQUE,          -- "example.com"
  is_primary INTEGER NOT NULL DEFAULT 0,
  
  -- Role and behavior
  role TEXT NOT NULL DEFAULT 'web',   -- web|redirect|parked|cdn|mail-only
  behavior TEXT NOT NULL DEFAULT 'serve',  -- serve|redirect|proxy|suspend
  
  -- Routing (for proxy role)
  proxy_to TEXT,                      -- URL for proxy role
  proxy_path_mapping JSONB,           -- [{"source": "/api", "target": "http://localhost:3000"}]
  
  -- Parent relationship (for subdomains, parked domains)
  parent_domain_id TEXT REFERENCES domains(id),
  
  -- Redirect configuration (for redirect role)
  redirect_code INTEGER,              -- 301|302|307|308
  redirect_target TEXT,
  
  -- Document root (NULL for non-serve roles)
  document_root TEXT,
  
  -- Per-domain runtime override
  runtime_override TEXT,               -- Override site runtime for this domain
  
  -- SSL
  ssl_enabled INTEGER NOT NULL DEFAULT 0,
  ssl_cert_id TEXT,
  
  -- Suspension
  is_suspended INTEGER NOT NULL DEFAULT 0,
  suspended_config TEXT,               -- JSON of original config for restoration
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',  -- active|suspended|pending|failed
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
interface Domain {
  id: string
  siteId: string | null
  name: string
  isPrimary: boolean
  role: 'web' | 'redirect' | 'parked' | 'cdn' | 'mail-only'
  behavior: 'serve' | 'redirect' | 'proxy' | 'suspend'
  proxyTo: string | null
  proxyPathMapping: ProxyPathMapping[] | null
  parentDomainId: string | null
  redirectCode: 301 | 302 | 307 | 308 | null
  redirectTarget: string | null
  documentRoot: string | null
  runtimeOverride: string | null
  sslEnabled: boolean
  sslCertId: string | null
  isSuspended: boolean
  suspendedConfig: object | null
  status: 'active' | 'suspended' | 'pending' | 'failed'
  createdAt: Date
  updatedAt: Date
}

interface ProxyPathMapping {
  source: string      // /api
  target: string     // http://localhost:3000
}
```

**Domain Role Definitions:**

| Role | Behavior | Description |
|------|----------|-------------|
| `web` | serve | Serves application from document root |
| `redirect` | redirect | HTTP redirect to target URL |
| `parked` | serve | Serves same content as primary domain |
| `cdn` | proxy | CDN proxy with caching |
| `mail-only` | suspend | No web serving, DNS for mail |

#### 3.5 `site_states` — Actual State Tracking for Reconciliation

```sql
CREATE TABLE site_states (
  site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Runtime state
  runtime_status TEXT NOT NULL DEFAULT 'unknown',  -- unknown|configured|starting|running|stopped|error
  runtime_error TEXT,
  
  -- Process state (JSON)
  processes JSONB NOT NULL DEFAULT '[]',
  
  -- Nginx state
  nginx_configured INTEGER NOT NULL DEFAULT 0,
  nginx_config_hash TEXT,
  nginx_last_sync INTEGER,
  
  -- SSL state
  ssl_configured INTEGER NOT NULL DEFAULT 0,
  ssl_cert_hash TEXT,
  
  -- Directory state
  directory_structure JSONB,
  
  -- Health
  overall_health TEXT NOT NULL DEFAULT 'unknown',  -- healthy|degraded|unhealthy|unknown
  last_successful_deploy_at INTEGER,
  
  -- Version tracking
  deployed_version TEXT,
  desired_version TEXT,
  
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
interface SiteState {
  siteId: string
  runtimeStatus: 'unknown' | 'configured' | 'starting' | 'running' | 'stopped' | 'error'
  runtimeError: string | null
  processes: ProcessSnapshot[]
  nginxConfigured: boolean
  nginxConfigHash: string | null
  nginxLastSync: Date | null
  sslConfigured: boolean
  sslCertHash: string | null
  directoryStructure: DirectorySnapshot | null
  overallHealth: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  lastSuccessfulDeployAt: Date | null
  deployedVersion: string | null
  desiredVersion: string | null
  updatedAt: Date
}

interface ProcessSnapshot {
  name: string
  pid: number | null
  status: string
  memoryMb: number
  cpuPercent: number
  uptime: number
}

interface DirectorySnapshot {
  deployments: string[]
  currentSymlink: string
  sharedDirs: string[]
}
```

#### 3.6 `background_jobs` — Async Job Queue with Idempotency

```sql
CREATE TABLE background_jobs (
  id TEXT PRIMARY KEY,
  
  -- Job identification
  job_type TEXT NOT NULL,              -- deployment|ssl_renewal|backup|reconciliation|cleanup
  job_priority INTEGER NOT NULL DEFAULT 5,  -- 1-10, lower = higher priority
  
  -- Payload
  payload JSONB NOT NULL,              -- Job-specific data
  
  -- Deduplication key for idempotency
  dedupe_key TEXT,                    -- NULL means not dedupeable
  dedupe_ttl_seconds INTEGER DEFAULT 300,
  
  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|cancelled
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Timing
  run_at INTEGER,                     -- Scheduled run time (NULL = ASAP)
  started_at INTEGER,
  completed_at INTEGER,
  
  -- Result
  result JSONB,
  error TEXT,
  
  -- Progress tracking
  progress_percent INTEGER,
  progress_message TEXT,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
type JobType = 
  | 'deployment.create'
  | 'deployment.rollback'
  | 'deployment.cleanup'
  | 'ssl.renew'
  | 'ssl.provision'
  | 'backup.create'
  | 'backup.restore'
  | 'reconciliation.run'
  | 'reconciliation.site'
  | 'process.start'
  | 'process.stop'
  | 'process.restart'
  | 'health_check'
  | 'cleanup.orphaned'

interface BackgroundJob {
  id: string
  jobType: JobType
  jobPriority: number
  payload: Record<string, unknown>
  dedupeKey: string | null
  dedupeTtlSeconds: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  attempts: number
  maxAttempts: number
  runAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  result: Record<string, unknown> | null
  error: string | null
  progressPercent: number | null
  progressMessage: string | null
  createdAt: Date
  updatedAt: Date
}

// Job type definitions with payload schemas

interface DeploymentCreatePayload {
  siteId: string
  deploymentId: string
  source: 'upload' | 'git' | 'restore'
  gitRepo?: string
  gitBranch?: string
}

interface ReconciliationRunPayload {
  siteId?: string  // NULL means all sites
  force: boolean
}

interface SslRenewPayload {
  domainId: string
  force: boolean
}
```

**Job State Machine:**

```
          ┌─────────────────────────────────────────────────┐
          │                                                 │
          ▼                                                 │
    ┌──────────┐     submit     ┌──────────┐    finish    ┌───────────┐
    │  PENDING  │──────────────▶│  RUNNING │─────────────▶│ COMPLETED │
    └──────────┘               └──────────┘              └───────────┘
         │                           │
         │                           │ error
         │                           ▼
         │                      ┌──────────┐
         │    max_attempts     │  FAILED  │
         │    exceeded         └──────────┘
         │                           │
         │                           │ retry (if attempts < max)
         └───────────────────────────┘
```

**Idempotency via Dedupe Key:**

```typescript
async function enqueueJob(
  jobType: JobType,
  payload: Record<string, unknown>,
  options: { dedupeKey?: string; dedupeTtlSeconds?: number } = {}
): Promise<BackgroundJob> {
  if (options.dedupeKey) {
    // Check for existing job with same dedupe key within TTL
    const existing = await db.query(backgroundJobs).findFirst({
      where: and(
        eq(backgroundJobs.dedupeKey, options.dedupeKey),
        eq(backgroundJobs.status, 'running'),
        // TTL check
      )
    })
    if (existing) {
      return existing  // Idempotent - return existing job
    }
  }
  // Create new job...
}
```

#### 3.7 `ssl_certificates` — Certificate Management

```sql
CREATE TABLE ssl_certificates (
  id TEXT PRIMARY KEY,
  
  -- Certificate identity
  type TEXT NOT NULL,                 -- letsencrypt|custom|self-signed
  provider TEXT,                      -- letsencrypt|cloudflare|custom
  
  -- Certificate data
  certificate TEXT NOT NULL,          -- PEM
  private_key TEXT NOT NULL,         -- PEM (encrypted at rest)
  chain TEXT,                        -- CA chain PEM
  san_domains TEXT,                  -- JSON array of Subject Alternative Names
  
  -- Wildcard flag
  is_wildcard INTEGER NOT NULL DEFAULT 0,
  
  -- Validity
  issuer TEXT,
  not_before INTEGER,
  not_after INTEGER,
  expires_at INTEGER,
  
  -- Auto-renewal
  auto_renew INTEGER NOT NULL DEFAULT 1,
  renewal_fail_count INTEGER NOT NULL DEFAULT 0,
  last_renewed_at INTEGER,
  last_renewal_error TEXT,
  
  -- Provisioning source
  provisioning_context JSONB,        -- How cert was obtained (dns_provider, validation_method, etc.)
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
interface SslCertificate {
  id: string
  type: 'letsencrypt' | 'custom' | 'self-signed'
  provider: 'letsencrypt' | 'cloudflare' | 'custom' | null
  certificate: string
  privateKey: string
  chain: string | null
  sanDomains: string[]
  isWildcard: boolean
  issuer: string | null
  notBefore: Date | null
  notAfter: Date | null
  expiresAt: Date | null
  autoRenew: boolean
  renewalFailCount: number
  lastRenewedAt: Date | null
  lastRenewalError: string | null
  provisioningContext: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}
```

#### 3.8 `domain_ssl_bindings` — Domain-Certificate Mappings

```sql
CREATE TABLE domain_ssl_bindings (
  id TEXT PRIMARY KEY,
  
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  ssl_cert_id TEXT NOT NULL REFERENCES ssl_certificates(id),
  
  -- Binding details
  is_active INTEGER NOT NULL DEFAULT 1,
  binding_type TEXT NOT NULL DEFAULT 'standard',  -- standard|sni|cloudflare
  
  -- Validation
  validation_method TEXT,             -- http-01|dns-01|tls-alpn-01
  validation_token TEXT,
  validation_proof TEXT,
  
  -- Certificate info at binding time
  cert_fingerprint TEXT,
  cert_serial TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'provisioning',  -- provisioning|validated|active|failed|expired
  
  provisioned_at INTEGER,
  activated_at INTEGER,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  UNIQUE(domain_id, ssl_cert_id)
);
```

```typescript
interface DomainSslBinding {
  id: string
  domainId: string
  sslCertId: string
  isActive: boolean
  bindingType: 'standard' | 'sni' | 'cloudflare'
  validationMethod: 'http-01' | 'dns-01' | 'tls-alpn-01' | null
  validationToken: string | null
  validationProof: string | null
  certFingerprint: string | null
  certSerial: string | null
  status: 'provisioning' | 'validated' | 'active' | 'failed' | 'expired'
  provisionedAt: Date | null
  activatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

---

### Phase 2: Supporting Tables

#### 3.9 `deployments` — Deployment Tracking with Immutable Structure

```sql
CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Deployment identification
  deployment_number INTEGER NOT NULL,  -- Sequential: 001, 002, 003
  version TEXT NOT NULL,              -- User-defined or auto: "v1.0.0", "2026-05-19-001"
  
  -- Source
  source_type TEXT NOT NULL,          -- upload|git|restore|clone
  source_info JSONB,                  -- { repo: "...", branch: "...", commit: "..." }
  
  -- Build
  build_command TEXT,
  build_output_dir TEXT,
  build_log TEXT,
  build_status TEXT,                  -- pending|running|success|failed
  
  -- File structure
  deployment_path TEXT NOT NULL,       -- /var/www/sites/{site_id}/deployments/deploy_001
  file_count INTEGER,
  size_bytes INTEGER,
  
  -- Environment
  env_vars JSONB,                     -- Deployment-specific environment variables
  
  -- Rollback support
  is_current INTEGER NOT NULL DEFAULT 0,  -- Only one current at a time
  previous_deployment_id TEXT,
  
  -- Metadata
  creator_id TEXT,                    -- User who initiated
  deployment_message TEXT,            -- Commit message or description
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|preparing|building|deployed|failed|rolled_back
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);
```

```typescript
interface Deployment {
  id: string
  siteId: string
  deploymentNumber: number
  version: string
  sourceType: 'upload' | 'git' | 'restore' | 'clone'
  sourceInfo: GitSourceInfo | UploadSourceInfo | null
  buildCommand: string | null
  buildOutputDir: string | null
  buildLog: string | null
  buildStatus: 'pending' | 'running' | 'success' | 'failed' | null
  deploymentPath: string
  fileCount: number | null
  sizeBytes: number | null
  envVars: Record<string, string>
  isCurrent: boolean
  previousDeploymentId: string | null
  creatorId: string | null
  deploymentMessage: string | null
  status: 'pending' | 'preparing' | 'building' | 'deployed' | 'failed' | 'rolled_back'
  createdAt: Date
  completedAt: Date | null
}

interface GitSourceInfo {
  repo: string
  branch: string
  commit: string
  commitMessage: string
  author: string
}

interface UploadSourceInfo {
  filename: string
  sizeBytes: number
  uploadedBy: string
}
```

#### 3.10 `site_env_vars` — Environment Variables with Scope

```sql
CREATE TABLE site_env_vars (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Variable identification
  key TEXT NOT NULL,
  
  -- Value and scope
  value TEXT NOT NULL,                -- Encrypted at rest
  is_secret INTEGER NOT NULL DEFAULT 0,  -- Secret vars are hidden in UI
  
  -- Scope
  scope TEXT NOT NULL DEFAULT 'runtime',  -- runtime|deployment|build|system
  
  -- For deployment-scoped vars
  deployment_id TEXT REFERENCES deployments(id) ON DELETE CASCADE,
  
  -- Metadata
  description TEXT,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  UNIQUE(site_id, key, scope, deployment_id)
);
```

```typescript
interface SiteEnvVar {
  id: string
  siteId: string
  key: string
  value: string
  isSecret: boolean
  scope: 'runtime' | 'deployment' | 'build' | 'system'
  deploymentId: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
}
```

#### 3.11 `site_health_checks` — Health Monitoring

```sql
CREATE TABLE site_health_checks (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Check identification
  check_type TEXT NOT NULL,          -- http|tcp|process|disk|memory|cpu
  check_name TEXT NOT NULL,
  
  -- Configuration
  config JSONB NOT NULL,              -- { url: "...", interval: 60, timeout: 5 }
  
  -- Result
  status TEXT NOT NULL DEFAULT 'unknown',  -- healthy|unhealthy|unknown
  status_code INTEGER,                -- HTTP status code
  response_time_ms INTEGER,
  error_message TEXT,
  
  -- Thresholds
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_failures_threshold INTEGER NOT NULL DEFAULT 3,
  
  -- Last check
  last_check_at INTEGER,
  next_check_at INTEGER,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
interface SiteHealthCheck {
  id: string
  siteId: string
  checkType: 'http' | 'tcp' | 'process' | 'disk' | 'memory' | 'cpu'
  checkName: string
  config: HttpCheckConfig | TcpCheckConfig | ProcessCheckConfig
  status: 'healthy' | 'unhealthy' | 'unknown'
  statusCode: number | null
  responseTimeMs: number | null
  errorMessage: string | null
  consecutiveFailures: number
  consecutiveFailuresThreshold: number
  lastCheckAt: Date | null
  nextCheckAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface HttpCheckConfig {
  url: string
  method: 'GET' | 'HEAD'
  expectedStatus: number
  expectedBody?: string
  headers?: Record<string, string>
  interval: number       // seconds
  timeout: number       // seconds
}

interface TcpCheckConfig {
  host: string
  port: number
  interval: number
  timeout: number
}

interface ProcessCheckConfig {
  processName: string
  checkPid: boolean
  checkMemory: boolean
  maxMemoryMb: number
  interval: number
}
```

#### 3.12 `activity_logs` — Audit Trail

```sql
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  
  -- Actor
  actor_type TEXT NOT NULL,          -- user|system|api_token|webhook
  actor_id TEXT,
  actor_ip TEXT,
  
  -- Action
  action TEXT NOT NULL,              -- "site.create", "deployment.rollback", "ssl.renew"
  resource_type TEXT NOT NULL,       -- "site", "domain", "deployment", "ssl_cert"
  resource_id TEXT,
  
  -- Details
  details JSONB,                     -- Additional context
  changes JSONB,                     -- Diff of changed fields
  
  -- Result
  result TEXT,                       -- success|failure|partial
  error_message TEXT,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

```typescript
interface ActivityLog {
  id: string
  actorType: 'user' | 'system' | 'api_token' | 'webhook'
  actorId: string | null
  actorIp: string | null
  action: string
  resourceType: string
  resourceId: string | null
  details: Record<string, unknown> | null
  changes: Record<string, { old: unknown; new: unknown }> | null
  result: 'success' | 'failure' | 'partial' | null
  errorMessage: string | null
  createdAt: Date
}
```

---

## 4. Runtime Configuration Schema

### 4.1 PHP Runtime

```json
{
  "schemaVersion": 1,
  "runtime": "php",
  "version": "8.2",
  "handler": "php-fpm",
  "pool": {
    "pm": "dynamic",
    "pmMaxChildren": 20,
    "pmStartServers": 3,
    "pmMinSpareServers": 2,
    "pmMaxSpareServers": 10,
    "pmMaxRequests": 500,
    "pmStatusPath": "/php-status"
  },
  "iniOverrides": {
    "memory_limit": "128M",
    "upload_max_filesize": "10M",
    "max_execution_time": "30"
  },
  "extensions": {
    "enabled": ["mysql", "gd", "zip"],
    "disabled": []
  },
  "blackfire": {
    "enabled": false,
    "serverId": null,
    "serverToken": null
  }
}
```

### 4.2 Node.js Runtime

```json
{
  "schemaVersion": 1,
  "runtime": "node",
  "version": "20",
  "buildCommand": "npm run build",
  "startCommand": "node dist/server.js",
  "buildOutput": "dist",
  "nodeEnv": "production",
  "pm2": {
    "clusterMode": true,
    "instances": 4,
    "maxMemoryRestart": "512M",
    "autorestart": true,
    "watch": false,
    "env": {
      "NODE_ENV": "production",
      "PORT": "{{AUTO_PORT}}"
    }
  },
  "viteConfig": null,
  "typescript": {
    "enabled": true,
    "tsconfigPath": "tsconfig.json"
  },
  "ports": {
    "autoAllocate": true,
    "min": 30000,
    "max": 40000
  }
}
```

### 4.3 Python Runtime

```json
{
  "schemaVersion": 1,
  "runtime": "python",
  "version": "3.11",
  "venvPath": "venv",
  "startCommand": "gunicorn app:app --bind 0.0.0.0:{{AUTO_PORT}} --workers 4 --timeout 30",
  "requirementsPath": "requirements.txt",
  "buildCommand": "pip install -r requirements.txt",
  "environment": {
    "PYTHONUNBUFFERED": "1",
    "DJANGO_SETTINGS_MODULE": "settings"
  },
  "pip": {
    "indexUrl": null,
    "extraIndexUrls": [],
    "noCache": true
  },
  "ports": {
    "autoAllocate": true,
    "min": 30000,
    "max": 40000
  },
  "runtime": {
    "path": "/usr/bin/python3.11",
    "virtualEnv": "{{SITE_HOME}}/venv"
  }
}
```

### 4.4 Static Runtime

```json
{
  "schemaVersion": 1,
  "runtime": "static",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "headers": {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff"
  },
  "redirects": [
    {
      "from": "/old-page",
      "to": "/new-page",
      "code": 301
    }
  ],
  "basicAuth": {
    "enabled": false,
    "username": null
  },
  "compress": true,
  "cors": {
    "enabled": false,
    "origins": []
  }
}
```

---

## 5. Directory Structure

### Immutable Deployment Structure

```
/var/www/sites/{site_id}/
├── deployments/
│   ├── deploy_001/
│   │   ├── httpdocs/              # Application files
│   │   │   ├── index.html
│   │   │   ├── css/
│   │   │   ├── js/
│   │   │   └── ...
│   │   ├── .env                   # Deployment-specific env (sensitive)
│   │   ├── .nova-meta.json        # Deployment metadata
│   │   └── .build-log.txt
│   ├── deploy_002/
│   │   ├── httpdocs/
│   │   ├── .env
│   │   └── .nova-meta.json
│   └── deploy_003/ (current symlink -> deployments/deploy_003)
│       ├── httpdocs/
│       └── .env
├── shared/
│   ├── .env                       # Base environment variables (secrets)
│   ├── .env.local                 # Local overrides (gitignored)
│   ├── uploads/                   # User-uploaded content (persistent)
│   │   ├── avatars/
│   │   └── attachments/
│   ├── storage/                   # Application storage (persistent)
│   │   ├── logs/
│   │   └── cache/
│   └── tmp/                       # Temporary files (cleanable)
├── logs/
│   ├── access.log                 # Nginx access log
│   ├── error.log                  # Nginx error log
│   └── runtime.log                # Application runtime logs
├── ssl/
│   ├── fullchain.pem             # SSL certificate
│   └── privkey.pem                # SSL private key
└── httpdocs -> symlink to deployments/deploy_003/httpdocs
```

### Symlink Strategy for Zero-Downtime Deployments

1. New deployment is built to `deployments/deploy_NNN/`
2. Build validation passes
3. `httpdocs` symlink atomically updated to point to `deployments/deploy_NNN/httpdocs`
4. Old deployment remains in place for rollback until explicitly cleaned up

```
# Atomic symlink update (atomic because rename replaces the symlink)
mv /var/www/sites/{site_id}/httpdocs /var/www/sites/{site_id}/httpdocs_old
ln -s /var/www/sites/{site_id}/deployments/deploy_003/httpdocs /var/www/sites/{site_id}/httpdocs
```

### Directory Permissions

```
/var/www/sites/{site_id}/
├── owner: sf_{site_id}:www-data
├── mode: 0755 (directories), 0644 (files)
└── special:
    ├── ssl/                       # Mode 0750, owner sf_{site_id}:www-data
    ├── shared/.env               # Mode 0600, owner sf_{site_id}:www-data
    └── logs/                     # Mode 0755, writable by www-data
```

---

## 6. Nginx Configuration Architecture

### One Config Per Site

Each site has exactly one Nginx configuration file:

```
/etc/nginx/sites-available/nova-{site_id}.conf
/etc/nginx/sites-enabled/nova-{site_id}.conf (symlink)
```

The site-level config includes:
- All domains (primary, addon, subdomain) as `server_name` entries
- Document root pointing to the `httpdocs` symlink
- Runtime-specific location blocks (PHP-FPM proxy, Node.js proxy, static file handling)
- SSL configuration for all domains
- Health check endpoints

### Config Renderer Abstraction Layer

```typescript
interface NginxConfigRenderer {
  /**
   * Render complete nginx config for a site
   */
  render(siteId: string, context: RenderContext): Promise<string>
  
  /**
   * Validate rendered config without writing
   */
  validate(config: string): Promise<ValidationResult>
  
  /**
   * Get config schema version
   */
  getSchemaVersion(): number
}

interface RenderContext {
  site: Site
  runtime: SiteRuntime
  domains: Domain[]
  sslBindings: DomainSslBinding[]
  currentDeployment: Deployment | null
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

### Implementations

```typescript
class PhpNginxRenderer implements NginxConfigRenderer {
  async render(siteId: string, context: RenderContext): Promise<string> {
    // Build PHP-FPM location blocks
  }
}

class NodeNginxRenderer implements NginxConfigRenderer {
  async render(siteId: string, context: RenderContext): Promise<string> {
    // Build Node.js proxy blocks with upstream configuration
  }
}

class PythonNginxRenderer implements NginxConfigRenderer {
  async render(siteId: string, context: RenderContext): Promise<string> {
    // Build Python proxy blocks (gunicorn/uwsgi)
  }
}

class StaticNginxRenderer implements NginxConfigRenderer {
  async render(siteId: string, context: RenderContext): Promise<string> {
    // Build static file serving with clean URLs
  }
}
```

### Validation Pipeline

```
User action or reconciliation trigger
         │
         ▼
┌─────────────────────────────────────┐
│  1. Render Config                    │
│     Generate nginx config from DB    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  2. Dry-run Validation              │
│     nginx -T (test config syntax)   │
└─────────────────────────────────────┘
         │
         ├── Invalid ──▶ Rollback, alert
         │
         ▼
┌─────────────────────────────────────┐
│  3. Atomic Write                    │
│     Write to temp, then rename      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  4. Reload Nginx                    │
│     systemctl reload nginx          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  5. Post-reload validation          │
│     Verify process is running       │
└─────────────────────────────────────┘
```

### Nginx Config Template

```nginx
# NovaPanel Site Config - {site_id}
# Generated: {timestamp}

upstream {site_id}_php {
    server unix:/run/php/php{version}-fpm.sock;
}

upstream {site_id}_node {
    server 127.0.0.1:{node_port};
}

server {
    listen 80;
    server_name {server_names};
    root {document_root};
    
    access_log {home_dir}/logs/access.log;
    error_log {home_dir}/logs/error.log;
    
    index index.php index.html index.htm;
    
    # PHP handling
    location ~ \.php$ {
        fastcgi_pass {site_id}_php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # Node.js proxy
    location / {
        proxy_pass http://{site_id}_node;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files
    location /static/ {
        alias {shared_dir}/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 7. Process Manager Abstraction

```typescript
interface ProcessManager {
  /**
   * Start application for a site
   */
  start(siteId: string): Promise<void>
  
  /**
   * Stop application for a site
   */
  stop(siteId: string): Promise<void>
  
  /**
   * Restart application for a site
   */
  restart(siteId: string): Promise<void>
  
  /**
   * Get process status for a site
   */
  getStatus(siteId: string): Promise<ProcessStatus>
  
  /**
   * Stream logs for a site
   */
  logs(siteId: string, options?: LogOptions): Promise<string>
  
  /**
   * Scale process count (for Node.js/Python)
   */
  scale(siteId: string, count: number): Promise<void>
}

interface ProcessStatus {
  siteId: string
  runtime: 'php' | 'node' | 'python'
  processes: ProcessInfo[]
  overallStatus: 'running' | 'stopped' | 'degraded' | 'error'
}

interface ProcessInfo {
  name: string
  pid: number | null
  status: 'running' | 'stopped' | 'restarting'
  memoryMb: number
  cpuPercent: number
  uptime: number
}

interface LogOptions {
  tail?: number      // Number of lines to tail
  since?: Date       // Logs since timestamp
  filter?: string   // Filter pattern
}
```

### Implementations

#### Pm2Manager (Node.js)

```typescript
class Pm2Manager implements ProcessManager {
  async start(siteId: string): Promise<void> {
    const site = await loadSite(siteId)
    const config = await loadRuntimeConfig(siteId)
    
    await run('pm2', [
      'start',
      'ecosystem.config.js',
      '--name', `nova-${siteId}`,
      '--',
      '--port', config.port.toString()
    ], { sudo: true })
  }
  
  async stop(siteId: string): Promise<void> {
    await run('pm2', ['stop', `nova-${siteId}`], { sudo: true })
  }
  
  async getStatus(siteId: string): Promise<ProcessStatus> {
    const output = await run('pm2', ['jlist'], { sudo: true })
    const processes = JSON.parse(output.stdout)
    // Filter for this site...
  }
}
```

#### SystemdManager (Python, custom PHP)

```typescript
class SystemdManager implements ProcessManager {
  async start(siteId: string): Promise<void> {
    await run('systemctl', ['start', `nova-${siteId}`], { sudo: true })
  }
  
  async stop(siteId: string): Promise<void> {
    await run('systemctl', ['stop', `nova-${siteId}`], { sudo: true })
  }
  
  async getStatus(siteId: string): Promise<ProcessStatus> {
    // Query systemctl status
  }
}
```

#### PhpFpmManager (PHP-FPM)

```typescript
class PhpFpmManager implements ProcessManager {
  private socketPath(version: string): string {
    return `/run/php/php${version}-fpm.sock`
  }
  
  async start(siteId: string): Promise<void> {
    // PHP-FPM pools are always running, managed by systemd
    // Start/stop is a no-op
  }
  
  async stop(siteId: string): Promise<void> {
    // PHP-FPM pools are always running
  }
  
  async getStatus(siteId: string): Promise<ProcessStatus> {
    // Query FPM status via pm-status endpoint
  }
}
```

---

## 8. Background Job System

### Job Types Enum

```typescript
const JOB_TYPES = {
  // Deployment jobs
  'deployment.create': { maxAttempts: 3, timeout: 600 },
  'deployment.rollback': { maxAttempts: 1, timeout: 60 },
  'deployment.cleanup': { maxAttempts: 1, timeout: 120 },
  
  // SSL jobs
  'ssl.provision': { maxAttempts: 3, timeout: 300 },
  'ssl.renew': { maxAttempts: 3, timeout: 300 },
  
  // Backup jobs
  'backup.create': { maxAttempts: 2, timeout: 3600 },
  'backup.restore': { maxAttempts: 1, timeout: 3600 },
  
  // Reconciliation
  'reconciliation.site': { maxAttempts: 1, timeout: 60 },
  'reconciliation.full': { maxAttempts: 1, timeout: 300 },
  
  // Process management
  'process.start': { maxAttempts: 3, timeout: 30 },
  'process.stop': { maxAttempts: 2, timeout: 30 },
  'process.restart': { maxAttempts: 3, timeout: 60 },
  
  // Health
  'health_check': { maxAttempts: 1, timeout: 10 },
  
  // Cleanup
  'cleanup.orphaned': { maxAttempts: 1, timeout: 120 },
} as const
```

### Job State Machine

```
                    ┌────────────────────────────────────────┐
                    │                                        │
                    ▼                                        │
  ┌────────┐  pick  ┌────────┐  finish  ┌───────────┐      │
  │ PENDING │───────▶│ RUNNING │─────────▶│ COMPLETED │      │
  └────────┘        └────────┘           └───────────┘      │
       │                 │                                    │
       │                 │ error                               │
       │                 ▼                                    │
       │            ┌────────┐                                │
       │            │ FAILED │                                │
       │            └────────┘                                │
       │                 │                                    │
       │    attempts < max                                     │
       │                 │                                    │
       └─────────────────┘                                    │
                    │                                        │
                    │ max_attempts reached                   │
                    ▼                                        │
             ┌───────────┐                                   │
             │ CANCELLED │                                   │
             └───────────┘                                   │
```

### Idempotency via Dedupe Key

```typescript
async function enqueueJob(
  jobType: JobType,
  payload: Record<string, unknown>,
  options: {
    dedupeKey?: string
    dedupeTtlSeconds?: number
    priority?: number
    runAt?: Date
  } = {}
): Promise<{ job: BackgroundJob; isDuplicate: boolean }> {
  
  // Check for existing job with same dedupe key
  if (options.dedupeKey) {
    const cutoffTime = Date.now() - (options.dedupeTtlSeconds ?? 300) * 1000
    
    const existing = await db.query(backgroundJobs).findFirst({
      where: and(
        eq(backgroundJobs.dedupeKey, options.dedupeKey),
        inArray(backgroundJobs.status, ['pending', 'running']),
        gt(backgroundJobs.createdAt, new Date(cutoffTime))
      )
    })
    
    if (existing) {
      return { job: existing, isDuplicate: true }
    }
  }
  
  // Create new job
  const job = await db.insert(backgroundJobs).values({
    id: nanoid(),
    jobType,
    payload,
    dedupeKey: options.dedupeKey ?? null,
    dedupeTtlSeconds: options.dedupeTtlSeconds ?? 300,
    jobPriority: options.priority ?? 5,
    runAt: options.runAt ?? null,
    status: 'pending',
    maxAttempts: JOB_TYPES[jobType].maxAttempts,
  })
  
  return { job, isDuplicate: false }
}
```

### Retry Logic

```typescript
async function processJob(jobId: string): Promise<void> {
  const job = await db.query.backgroundJobs.findById(jobId)
  
  try {
    await db.update(backgroundJobs)
      .set({ status: 'running', startedAt: new Date(), attempts: job.attempts + 1 })
      .where(eq(backgroundJobs.id, jobId))
    
    await executeJob(job)  // Job-type-specific handler
    
    await db.update(backgroundJobs)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(backgroundJobs.id, jobId))
    
  } catch (error) {
    if (job.attempts + 1 >= job.maxAttempts) {
      await db.update(backgroundJobs)
        .set({ status: 'failed', error: error.message })
        .where(eq(backgroundJobs.id, jobId))
    } else {
      // Reschedule with exponential backoff
      const delaySeconds = Math.pow(2, job.attempts) * 30
      await db.update(backgroundJobs)
        .set({ 
          status: 'pending', 
          runAt: new Date(Date.now() + delaySeconds * 1000) 
        })
        .where(eq(backgroundJobs.id, jobId))
    }
  }
}
```

---

## 9. Reconciliation Flow

### Pseudocode

```typescript
async function runReconciliation(siteId?: string): Promise<ReconciliationResult> {
  const sites = siteId 
    ? [await loadSite(siteId)] 
    : await loadAllActiveSites()
  
  const results: SiteReconciliationResult[] = []
  
  for (const site of sites) {
    try {
      const result = await reconcileSite(site)
      results.push(result)
    } catch (error) {
      results.push({
        siteId: site.id,
        success: false,
        error: error.message,
        changes: []
      })
    }
  }
  
  return { results, timestamp: new Date() }
}

async function reconcileSite(site: Site): Promise<SiteReconciliationResult> {
  const changes: Change[] = []
  
  // 1. Load desired state
  const desired = {
    runtime: await loadRuntimeConfig(site.id),
    domains: await loadDomains(site.id),
    processes: await loadDesiredProcesses(site.id),
    ssl: await loadSslBindings(site.id),
  }
  
  // 2. Load actual state
  const actual = {
    runtime: await inspectRuntimeState(site.id),
    nginx: await inspectNginxConfig(site.id),
    processes: await inspectProcesses(site.id),
    ssl: await inspectSslState(site.id),
  }
  
  // 3. Compute diff
  const diff = computeDiff(desired, actual)
  
  // 4. Apply changes
  if (diff.nginxConfigChanged) {
    await applyNginxConfig(site.id, desired.nginx)
    changes.push({ type: 'nginx_config', success: true })
  }
  
  if (diff.processCountChanged) {
    await scaleProcesses(site.id, desired.processCount)
    changes.push({ type: 'process_scale', success: true })
  }
  
  if (diff.sslChanged) {
    await applySslBindings(site.id, desired.ssl)
    changes.push({ type: 'ssl_binding', success: true })
  }
  
  // 5. Update state tracking
  await updateSiteState(site.id, {
    nginxLastSync: new Date(),
    runtimeStatus: actual.runtime.status,
    overallHealth: computeHealth(diff, actual)
  })
  
  // 6. Log changes
  await logReconciliation(site.id, changes)
  
  return {
    siteId: site.id,
    success: true,
    changes,
    durationMs: 0  // measure time
  }
}

function computeDiff(desired: DesiredState, actual: ActualState): StateDiff {
  return {
    nginxConfigChanged: hash(desired.nginx) !== actual.nginx.hash,
    processCountChanged: desired.processCount !== actual.processCount,
    sslChanged: !deepEqual(desired.ssl, actual.ssl),
    runtimeConfigChanged: hash(desired.runtime) !== actual.runtime.hash,
  }
}
```

### Reconciliation Triggers

| Trigger | Priority | Reason |
|---------|----------|--------|
| Manual (user action) | High | Immediate apply |
| Cron (every 30s) | Medium | Drift detection |
| Deployment complete | High | Post-deploy sync |
| Health check failure | High | Failure recovery |
| Scheduled SSL renewal | Medium | Certificate refresh |

---

## 10. API Design

### New Endpoint Structure

#### Sites

```
GET    /api/v1/sites                    # List all sites
POST   /api/v1/sites                    # Create site
GET    /api/v1/sites/:id                # Get site details
PATCH  /api/v1/sites/:id               # Update site
DELETE /api/v1/sites/:id               # Delete site

POST   /api/v1/sites/:id/suspend       # Suspend site
POST   /api/v1/sites/:id/activate      # Activate site
POST   /api/v1/sites/:id/restart       # Restart runtime

GET    /api/v1/sites/:id/state         # Get actual state
POST   /api/v1/sites/:id/reconcile     # Trigger reconciliation

GET    /api/v1/sites/:id/processes     # List processes
GET    /api/v1/sites/:id/logs          # Get logs
```

#### Domains

```
GET    /api/v1/domains                  # List all domains
POST   /api/v1/domains                  # Create domain
GET    /api/v1/domains/:id              # Get domain
PATCH  /api/v1/domains/:id              # Update domain
DELETE /api/v1/domains/:id              # Delete domain

POST   /api/v1/domains/:id/attach      # Attach to site
POST   /api/v1/domains/:id/detach      # Detach from site
POST   /api/v1/domains/:id/suspend     # Suspend domain
POST   /api/v1/domains/:id/activate    # Activate domain

POST   /api/v1/domains/:id/ssl/provision   # Provision SSL
POST   /api/v1/domains/:id/ssl/renew       # Renew SSL
```

#### Deployments

```
GET    /api/v1/sites/:site_id/deployments              # List deployments
POST   /api/v1/sites/:site_id/deployments              # Create deployment
GET    /api/v1/sites/:site_id/deployments/:id          # Get deployment
POST   /api/v1/sites/:site_id/deployments/:id/rollback # Rollback to deployment
DELETE /api/v1/sites/:site_id/deployments/:id           # Delete deployment

GET    /api/v1/sites/:site_id/deployments/:id/logs     # Get build logs
POST   /api/v1/sites/:site_id/deployments/:id/redeploy # Rebuild deployment
```

#### Jobs

```
GET    /api/v1/jobs                   # List jobs
GET    /api/v1/jobs/:id               # Get job status
POST   /api/v1/jobs/:id/cancel        # Cancel job
POST   /api/v1/jobs/:id/retry         # Retry failed job

GET    /api/v1/sites/:site_id/jobs    # List jobs for site
```

### Response Format

```typescript
// Success response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-05-19T00:13:44Z",
    "requestId": "req_abc123"
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid site configuration",
    "details": [
      { "field": "runtime.version", "message": "Unsupported version" }
    ]
  }
}

// Paginated response
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

## 11. Site Creation Wizard Flow

### 6-Step Wizard

#### Step 1: Basic Information

```
Fields:
- Site Name (required)
- System User (auto-generated from name, editable)
- Description (optional)

Validation:
- Name: alphanumeric, dashes, 3-50 chars
- System User: lowercase, alphanumeric, starts with sf_
```

#### Step 2: Runtime Selection

```
Runtime Options:
┌─────────┬────────────────────────────────────┐
│ PHP     │ PHP 8.1, 8.2, 8.3                   │
│ Node.js │ Node.js 18, 20, 22                  │
│ Python  │ Python 3.10, 3.11, 3.12            │
│ Static  │ Static HTML/JS/CSS                │
└─────────┴────────────────────────────────────┘

Each selection reveals configuration options:
- PHP: Version selector, handler (FPM/CGI)
- Node.js: Version selector, framework (Express/Fastify/None)
- Python: Version selector, framework (Django/Flask/None)
- Static: Build command (optional)
```

#### Step 3: Domain Configuration

```
Primary Domain:
- Domain name input
- Auto-detect www subdomain

Additional Domains:
- Add subdomains
- Add addon domains
- Parked domains

SSL Options:
- Provision Let's Encrypt (default)
- Custom certificate (upload)
- No SSL (not recommended)
```

#### Step 4: Deployment Configuration

```
Deployment Method:
┌─────────────────┬──────────────────────────────────┐
│ Upload          │ ZIP archive upload                │
│ Git             │ Repository URL, branch, credentials│
│ Clone           │ Clone from existing site          │
└─────────────────┴──────────────────────────────────┘

Environment Variables:
- Add key-value pairs
- Mark as secret (hidden in UI)
```

#### Step 5: Process Configuration

```
PHP:
- Pool size (auto/manual)
- Memory limit
- Max execution time

Node.js:
- Instances (1-16)
- Memory per instance
- Build command

Python:
- Workers (1-16)
- Memory per worker
- Start command
```

#### Step 6: Review and Create

```
Summary:
- Site name and ID
- Runtime configuration
- Domains
- Deployment method
- Process configuration

Estimated resources:
- Estimated RAM usage
- Estimated disk usage

Buttons:
[Create Site] [Back to Modify]
```

---

## 12. Implementation Phases

### Phase 1: Database Schema (Week 1-2)

| Week | Tasks |
|------|-------|
| Week 1, Day 1-2 | Create new schema migration files |
| Week 1, Day 3-4 | Implement site_runtimes, site_states tables |
| Week 1, Day 5 | Implement site_processes table |
| Week 2, Day 1-2 | Implement domains redesign with role/behavior |
| Week 2, Day 3-4 | Implement background_jobs table |
| Week 2, Day 5 | Implement ssl_certificates, domain_ssl_bindings |
| Week 2, Day 6-7 | Migration scripts for existing data |

**Deliverables:**
- Migration scripts for all new tables
- TypeScript types for all new schemas
- Data migration from old schema

### Phase 2: Runtime System (Week 3-4)

| Week | Tasks |
|------|-------|
| Week 3, Day 1-2 | Implement Runtime interface and base classes |
| Week 3, Day 3-4 | Implement PhpRuntime with PHP-FPM pool management |
| Week 3, Day 5 | Implement NodeRuntime with PM2 integration |
| Week 4, Day 1-2 | Implement PythonRuntime with Gunicorn integration |
| Week 4, Day 3-4 | Implement StaticRuntime for static file serving |
| Week 4, Day 5 | Process manager abstraction layer |
| Week 4, Day 6-7 | Unit tests for all runtime implementations |

**Deliverables:**
- Runtime implementations for all 4 types
- Process manager abstraction with PM2/Systemd/PhpFpm managers
- Unit tests with >80% coverage

### Phase 3: Domain System (Week 5-6)

| Week | Tasks |
|------|-------|
| Week 5, Day 1-2 | Implement domain role/behavior system |
| Week 5, Day 3-4 | Implement NginxConfigRenderer abstraction |
| Week 5, Day 5 | Implement site-level nginx config generator |
| Week 6, Day 1-2 | Implement domain attach/detach flows |
| Week 6, Day 3-4 | Implement SSL binding system |
| Week 6, Day 5 | Implement domain suspension/restoration |
| Week 6, Day 6-7 | Integration tests for domain operations |

**Deliverables:**
- Domain role/behavior system
- Nginx config renderer implementations
- SSL binding system
- Domain reconciliation

### Phase 4: Deployment System (Week 7-8)

| Week | Tasks |
|------|-------|
| Week 7, Day 1-2 | Implement deployment table and service |
| Week 7, Day 3-4 | Implement immutable deployment structure |
| Week 7, Day 5 | Implement deployment upload handler |
| Week 8, Day 1-2 | Implement Git deployment with webhook support |
| Week 8, Day 3-4 | Implement symlink-based deployment switching |
| Week 8, Day 5 | Implement rollback system |
| Week 8, Day 6-7 | Deployment cleanup and old version removal |

**Deliverables:**
- Deployment creation and management
- Zero-downtime deployment switching
- Rollback capability
- Deployment cleanup job

### Phase 5: Reconciliation (Week 9-10)

| Week | Tasks |
|------|-------|
| Week 9, Day 1-2 | Implement reconciliation loop |
| Week 9, Day 3-4 | Implement state diff detection |
| Week 9, Day 5 | Implement change application |
| Week 10, Day 1-2 | Implement background job processor |
| Week 10, Day 3-4 | Implement health check system |
| Week 10, Day 5 | Implement alerting on reconciliation failures |
| Week 10, Day 6-7 | End-to-end testing and bug fixes |

**Deliverables:**
- Reconciliation loop running every 30 seconds
- Health check system with alerting
- Background job processor
- End-to-end integration tests

---

## 13. Files to Create/Modify

### New Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/db/schema/sites.ts` | Site identity table |
| `apps/api/src/db/schema/site_runtimes.ts` | Runtime configuration table |
| `apps/api/src/db/schema/site_processes.ts` | Process management table |
| `apps/api/src/db/schema/site_states.ts` | State tracking for reconciliation |
| `apps/api/src/runtimes/base.runtime.ts` | Base runtime interface |
| `apps/api/src/runtimes/php.runtime.ts` | PHP runtime implementation |
| `apps/api/src/runtimes/node.runtime.ts` | Node.js runtime implementation |
| `apps/api/src/runtimes/python.runtime.ts` | Python runtime implementation |
| `apps/api/src/runtimes/static.runtime.ts` | Static runtime implementation |
| `apps/api/src/services/process-manager.ts` | Process manager abstraction |
| `apps/api/src/services/pm2.manager.ts` | PM2 process manager |
| `apps/api/src/services/systemd.manager.ts` | Systemd process manager |
| `apps/api/src/services/php-fpm.manager.ts` | PHP-FPM process manager |
| `apps/api/src/services/nginx-renderer.ts` | Nginx config renderer abstraction |
| `apps/api/src/modules/reconciliation/reconciler.ts` | Reconciliation service |
| `apps/api/src/modules/jobs/job-processor.ts` | Background job processor |
| `apps/api/src/modules/jobs/handlers/*.ts` | Job type handlers |
| `apps/api/src/modules/deployments/deployments.service.ts` | Deployment management |
| `apps/api/src/modules/deployments/deployments.routes.ts` | Deployment API routes |

### Files to Modify

| File | Modification |
|------|-------------|
| `apps/api/src/db/schema/websites.ts` | Rename to `sites`, add new fields |
| `apps/api/src/db/schema/domains.ts` | Add role/behavior fields, parent relationships |
| `apps/api/src/db/schema/ssl.ts` | Add `domain_ssl_bindings` handling |
| `apps/api/src/db/schema/index.ts` | Export new schema files |
| `apps/api/src/modules/websites/websites.service.ts` | Refactor to use new site model |
| `apps/api/src/modules/websites/websites.routes.ts` | Update routes to match new API |
| `apps/api/src/modules/domains/domains.service.ts` | Update for domain role/behavior |
| `apps/api/src/modules/domains/domains.routes.ts` | Update routes |
| `apps/api/src/services/nginx.service.ts` | Refactor to use renderer abstraction |
| `apps/api/src/modules/background_jobs/*.ts` | Create if not exists for job system |
| `apps/api/src/modules/deployments/*.ts` | Expand for immutable deployments |
| `apps/api/src/services/executor.ts` | Add job execution capabilities |
| `apps/api/src/services/job-events.ts` | Job event emission |
| `apps/web/src/router.tsx` | Add new routes for new API structure |

### Files to Deprecate

| File | Replacement |
|------|-------------|
| `apps/api/src/db/schema/websites.ts` | `apps/api/src/db/schema/sites.ts` |
| Legacy per-domain nginx configs | Site-level nginx config |

---

## 14. Migration Strategy

### Overview

The migration is designed to be backward-compatible, allowing incremental migration of existing sites while new features are being developed.

### Phase 0: Schema Migration (Before Feature Development)

```sql
-- Add new columns to existing tables with defaults
ALTER TABLE websites ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE domains ADD COLUMN role TEXT DEFAULT 'web';
ALTER TABLE domains ADD COLUMN behavior TEXT DEFAULT 'serve';
ALTER TABLE domains ADD COLUMN parent_domain_id TEXT;
ALTER TABLE domains ADD COLUMN is_suspended INTEGER DEFAULT 0;
```

### Phase 1: Data Migration

```typescript
async function migrateExistingData(): Promise<void> {
  // 1. Migrate websites to sites
  const websites = await db.select().from(oldWebsites)
  for (const website of websites) {
    await db.insert(sites).values({
      id: website.id,
      name: website.name,
      systemUser: website.systemUser,
      homeDir: website.homeDir,
      status: website.status,
    })
    
    // Create default runtime for each site
    await db.insert(siteRuntimes).values({
      id: nanoid(),
      siteId: website.id,
      runtime: 'php',
      version: website.phpVersion,
      config: {
        schemaVersion: 1,
        runtime: 'php',
        version: website.phpVersion,
        handler: website.phpHandler,
      },
      isActive: true,
    })
    
    // Create initial site state
    await db.insert(siteStates).values({
      siteId: website.id,
      runtimeStatus: 'configured',
      processes: [],
      nginxConfigured: true,
      sslConfigured: website.sslEnabled,
      overallHealth: 'unknown',
    })
  }
  
  // 2. Migrate domains
  const domains = await db.select().from(oldDomains)
  for (const domain of domains) {
    await db.update(domains).set({
      role: domain.type === 'primary' ? 'web' : domain.type,
      behavior: 'serve',
      isPrimary: domain.isPrimary,
      documentRoot: domain.documentRoot,
      sslEnabled: domain.sslEnabled,
      sslCertId: domain.sslCertId,
    }).where(eq(domains.id, domain.id))
  }
  
  // 3. Create SSL certificate bindings
  const sslCerts = await db.select().from(sslCertificates)
  for (const cert of sslCerts) {
    if (cert.domainId) {
      await db.insert(domainSslBindings).values({
        id: nanoid(),
        domainId: cert.domainId,
        sslCertId: cert.id,
        isActive: true,
        bindingType: 'standard',
        status: 'active',
      })
    }
  }
}
```

### Phase 2: Nginx Config Migration

```typescript
async function migrateNginxConfigs(): Promise<void> {
  const sites = await db.select().from(sites)
  for (const site of sites) {
    // Generate new site-level nginx config
    await nginxService.generateWebsiteConfig(site.id)
    
    // Remove legacy per-domain configs
    const domains = await db.select().from(domains).where(eq(domains.websiteId, site.id))
    for (const domain of domains) {
      await nginxService.removeVhost(domain.name).catch(() => {})
    }
  }
}
```

### Phase 3: Deployment Structure Migration

```typescript
async function migrateDeploymentStructure(siteId: string): Promise<void> {
  const site = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1)
  
  // Create deployments directory
  await sudoFs.mkdir(`${site.homeDir}/deployments`)
  
  // Create first deployment from current document root
  const deploymentId = nanoid()
  const deploymentPath = `${site.homeDir}/deployments/deploy_001`
  
  // Copy current files to new deployment structure
  await run('cp', ['-r', `${site.homeDir}/httpdocs`, deploymentPath], { sudo: true })
  
  // Create deployment record
  await db.insert(deployments).values({
    id: deploymentId,
    siteId: site.id,
    deploymentNumber: 1,
    version: 'v1.0.0-initial',
    sourceType: 'migrate',
    deploymentPath: deploymentPath,
    isCurrent: true,
    status: 'deployed',
    createdAt: new Date(),
    completedAt: new Date(),
  })
  
  // Create symlink
  await run('ln', ['-sf', `${deploymentPath}/httpdocs`, `${site.homeDir}/httpdocs`], { sudo: true })
}
```

### Rollback Strategy

If migration encounters issues:

1. **Database rollback**: Transaction-based migration; revert on failure
2. **Nginx config rollback**: Keep backup of old configs, restore on failure
3. **Deployment rollback**: Keep original `httpdocs` directory until new structure confirmed
4. **Site suspension**: Mark migrated sites with `status = 'migrating'` for safety

### Migration Verification

```typescript
async function verifyMigration(): Promise<MigrationReport> {
  const report = {
    sites: { total: 0, migrated: 0, failed: 0 },
    domains: { total: 0, migrated: 0, failed: 0 },
    deployments: { total: 0, migrated: 0, failed: 0 },
    sslBindings: { total: 0, migrated: 0, failed: 0 },
  }
  
  // Verify each site has runtime and state
  const sites = await db.select().from(sites)
  for (const site of sites) {
    const runtime = await db.select().from(siteRuntimes).where(eq(siteRuntimes.siteId, site.id)).limit(1)
    const state = await db.select().from(siteStates).where(eq(siteStates.siteId, site.id)).limit(1)
    
    if (!runtime || !state) {
      report.sites.failed++
    } else {
      report.sites.migrated++
    }
    report.sites.total++
  }
  
  // Verify domain-role assignments
  const domains = await db.select().from(domains)
  for (const domain of domains) {
    if (domain.role && domain.behavior) {
      report.domains.migrated++
    } else {
      report.domains.failed++
    }
    report.domains.total++
  }
  
  // Verify deployment structure
  for (const site of sites) {
    const deployments = await db.select().from(deployments).where(eq(deployments.siteId, site.id))
    if (deployments.length > 0) {
      report.deployments.migrated++
    } else {
      report.deployments.failed++
    }
    report.deployments.total++
  }
  
  return report
}
```

---

## Appendix A: TypeScript Type Definitions

```typescript
// Core types for the new architecture

type SiteStatus = 'active' | 'suspended' | 'deploying'
type Runtime = 'php' | 'node' | 'python' | 'static'
type DomainRole = 'web' | 'redirect' | 'parked' | 'cdn' | 'mail-only'
type DomainBehavior = 'serve' | 'redirect' | 'proxy' | 'suspend'
type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
type JobType = 
  | 'deployment.create' 
  | 'deployment.rollback' 
  | 'ssl.renew' 
  | 'backup.create' 
  | 'reconciliation.site' 
  | 'process.start'
```

---

## Appendix B: Configuration Reference

### Environment Variables

```bash
# NovaPanel Runtime Configuration
RUNTIME_BASE_DIR=/var/www/sites
RUNTIME_DEPLOYMENTS_DIR=deployments
RUNTIME_SHARED_DIR=shared

# Process Management
PM2_HOME=/var/www/.pm2
PROCESS_MANAGER=pm2  # pm2|systemd|php-fpm

# Nginx
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
NGINX_CONFIG_VALIDATION=true

# Reconciliation
RECONCILIATION_INTERVAL_MS=30000
RECONCILIATION_BATCH_SIZE=10

# Jobs
JOB_WORKER_COUNT=4
JOB_MAX_ATTEMPTS=3
JOB_RETRY_BACKOFF_SECONDS=30

# Health Checks
HEALTH_CHECK_INTERVAL_SECONDS=60
HEALTH_CHECK_TIMEOUT_SECONDS=10
HEALTH_FAILURE_THRESHOLD=3
```

---

## Appendix C: API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SITE_NOT_FOUND` | 404 | Site does not exist |
| `SITE_SUSPENDED` | 403 | Site is suspended |
| `DOMAIN_NOT_FOUND` | 404 | Domain does not exist |
| `DOMAIN_ATTACHED` | 409 | Domain already attached to another site |
| `RUNTIME_UNSUPPORTED` | 422 | Runtime type not supported |
| `RUNTIME_VERSION_INVALID` | 422 | Unsupported runtime version |
| `DEPLOYMENT_FAILED` | 422 | Deployment failed |
| `SSL_PROVISION_FAILED` | 422 | SSL certificate provision failed |
| `RECONCILIATION_FAILED` | 500 | Reconciliation encountered errors |
| `JOB_NOT_FOUND` | 404 | Background job not found |
| `JOB_CANCELLED` | 409 | Job already cancelled |

---

*Document generated for NovaPanel Architecture Redesign v1.0*