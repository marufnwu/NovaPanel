# NovaPanel — Current Implementation Architecture

## Overview

NovaPanel is a self-hosted server control panel built as a TypeScript monorepo. It provides web hosting, domain management, database administration, file management, terminal access, and monitoring through a unified web interface.

**Repository**: `marufnwu/NovaPanel` (branch: `modern`)
**License**: Private
**Node Version**: 20.x (`.nvmrc`)
**Primary Port**: 8732

---

## Monorepo Structure

```
NovaPanel/
├── apps/
│   ├── api/           # Fastify backend (TypeScript)
│   └── web/           # React SPA frontend (Vite)
├── packages/
│   └── schemas/       # Shared Zod schemas
├── scripts/
│   ├── install.sh     # Server installer
│   └── rebuild-and-deploy.sh
├── AGENTS.md          # Agent guidance
└── README.md
```

---

## Shared Package: `@serverforge/schemas`

| File | Exports |
|------|---------|
| `sites.ts` | `RuntimeConfigSchema`, `SiteSchema`, `SiteWithRuntimeSchema`, `CreateSiteInputSchema`, `SiteProcessSchema`, `SiteStateSchema` |
| `domains.ts` | `DomainTypeEnum`, `DomainSchema`, `CreateDomainInputSchema` |
| `auth.ts` | `loginSchema`, `UserSchema`, `SessionSchema` |

**Used by**: Both `apps/api` and `apps/web`
**Build output**: `packages/schemas/dist/*.js` + `.d.ts`

---

## Backend Architecture (`apps/api`)

### Server Framework

```
Fastify
├── @fastify/cors
├── @fastify/helmet
├── @fastify/cookie
├── @fastify/rate-limit
├── @fastify/multipart
├── @fastify/websocket
└── @fastify/static (serves ../web/dist)
```

### Database Stack

| Component | Technology |
|-----------|-----------|
| Driver | `@libsql/client` (SQLite) |
| ORM | Drizzle ORM (`drizzle-orm@0.38.4`) |
| Migrations | `drizzle-kit` + `migrate.ts` runner |
| Schema | SQLite tables in `src/db/schema/*.ts` |

### Database Schema (Current)

| Table | Purpose |
|-------|---------|
| `users` | Admin authentication |
| `sessions` | Cookie-based sessions |
| `temp_tokens` | 2FA flow tokens |
| `two_factor_backup_codes` | 2FA recovery |
| `sites` | v4 site identity |
| `site_runtimes` | Runtime configuration (JSON) |
| `site_processes` | PM2 process state |
| `site_states` | Infrastructure state |
| `domains` | Unified domain records |
| `domain_redirects` | Path-level redirects |
| `ssl_certificates` | SSL cert metadata |
| `databases` | MariaDB/PostgreSQL instances |
| `database_users` | DB user credentials |
| `dns_zones` | BIND9 zone data |
| `dns_records` | DNS records |
| `mail_domains` | Mail domain config |
| `mailboxes` | Email accounts |
| `mail_aliases` | Email aliases |
| `mail_forwards` | Email forwards |
| `ftp_accounts` | ProFTPD accounts |
| `cron_jobs` | Scheduled tasks |
| `cron_job_history` | Cron execution history |
| `cloudflare_tunnels` | Tunnel config |
| `tunnel_routes` | Tunnel route mappings |
| `audit_logs` | Activity audit |
| `server_stats` | Historical metrics |
| `backup_schedules` | Backup configuration |
| `backups` | Backup records |
| `installed_apps` | Installer app instances |
| `app_install_logs` | Installer logs |
| `app_configurations` | App config key-value |
| `api_tokens` | Programmatic API tokens |
| `notifications` | System notifications |
| `notification_preferences` | Per-user notification settings |
| `background_jobs` | Async job queue |
| `activity_logs` | Detailed activity |
| `deployments` | Site deployment records |
| `site_env_vars` | Environment variables |
| `site_health_checks` | Health check config |
| `domain_ssl_bindings` | Domain ↔ SSL cert links |

### Module Pattern

Each feature module follows:

```
src/modules/<feature>/
├── <feature>.routes.ts     # Route registration (Fastify)
├── <feature>.schema.ts     # Zod validation schemas
├── <feature>.service.ts    # Business logic
└── <feature>.ws.ts         # WebSocket handlers (optional)
```

### API Routes

```
/api/v1/
├── health                  # GET
├── auth/
│   ├── login               # POST
│   ├── logout              # POST
│   ├── me                  # GET
│   ├── 2fa/enable          # POST
│   ├── 2fa/verify          # POST
│   ├── 2fa/disable         # POST
│   ├── backup-codes        # GET
│   ├── regenerate-backup-codes # POST
│   ├── password            # PUT
│   ├── email               # PUT
│   ├── profile             # PUT
│   ├── sessions            # GET
│   ├── sessions/:id        # DELETE
│   ├── forgot-password     # POST
│   ├── verify-reset-token  # POST
│   ├── reset-password      # POST
│   └── token               # POST
├── stats/
│   ├── server              # GET
│   ├── services            # GET
│   ├── services/:name/restart # POST
│   ├── summary             # GET
│   ├── network             # GET
│   ├── disk                # GET
│   ├── expiring-ssl        # GET
│   ├── domains/:id         # GET
│   ├── processes           # GET
│   ├── tcp-connections     # GET
│   ├── fd                  # GET
│   ├── disk-io             # GET
│   └── domain-bandwidth    # GET
├── domains                 # CRUD + suspend/activate
├── sites                   # CRUD + process lifecycle
├── webserver               # Nginx/Apache config
├── php                     # PHP-FPM pools
├── ssl                     # Certificate management
├── dns                     # BIND9 zones
├── mail                    # Postfix/Dovecot
├── databases               # MariaDB/PostgreSQL
├── ftp                     # ProFTPD accounts
├── tunnel                  # Cloudflare Tunnel
├── files                   # File manager
├── terminal (WebSocket)    # Shell access
├── logs                    # System logs
├── cron                    # Cron jobs
├── firewall                # UFW rules
├── backup                  # Backup management
├── audit                   # Audit log
├── settings                # Panel configuration
├── notifications           # Notification preferences
├── installer               # Application installer
├── tokens                  # API token management
└── cloudflare              # Full Cloudflare integration
```

### Response Format

```typescript
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
}
```

### Infrastructure Services

```
Reconciler Loop
├── Watches DB for desired state changes
├── Compares desired vs actual system state
├── Queues jobs for drift correction
└── Updates DB with actual state

Job Queue
├── BullMQ-compatible queue
├── Background job processing
├── Retry with exponential backoff
└── Job status tracking

Scheduler
├── Cron job evaluation
├── Triggers cron jobs at scheduled times
└── Records execution history
```

### System Integration

| Service | Interface |
|---------|-----------|
| Nginx | Config files + `nginx -s reload` |
| Apache | Config files + `systemctl` |
| PHP-FPM | Pool config files |
| BIND9 | Zone files + `rndc reload` |
| Postfix | `postconf` + config files |
| Dovecot | Config files |
| ProFTPD | Config files + `ftpd.passwd` |
| MariaDB | `mariadb` CLI |
| PostgreSQL | `psql` CLI |
| PM2 | `pm2` CLI (via process manager service) |
| systemd | `systemctl` (via sudo allowlist) |
| Certbot | `certbot` CLI |
| Cloudflared | `cloudflared` CLI + config |

### Security Model

- **Command Allowlist**: Only whitelisted commands can run via `sudo`
- **Sudoers**: `novapanel` user has NOPASSWD for specific commands only
- **Session**: Cookie-based (`sf_session`) with httpOnly + sameSite
- **2FA**: TOTP + backup codes
- **Rate Limiting**: Per-endpoint configurable
- **CORS**: Origin validation
- **Helmet**: Security headers

---

## Frontend Architecture (`apps/web`)

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Router | TanStack Router (code-based) |
| State | Zustand (`store/auth.store.ts`) |
| Styling | Tailwind CSS |
| Components | shadcn/ui + custom |
| Icons | Lucide React |
| Charts | Recharts |
| Terminal | xterm.js + addons |
| Build | Vite |

### Routing Structure

```
/login                    → LoginPage
/reset-password           → ResetPasswordPage
/ (protected)
  ├── /                   → DashboardPage
  ├── /domains            → DomainsPage
  ├── /sites              → SitesPage
  ├── /sites/$id          → SiteDetailPage
  ├── /webserver          → WebserverPage
  ├── /php                → PhpPage
  ├── /ssl                → SslPage
  ├── /dns                → DnsPage
  ├── /mail               → MailPage
  ├── /databases          → DatabasesPage
  ├── /databases/$id      → DatabaseDetailPage
  ├── /ftp                → FtpPage
  ├── /files              → FilesPage
  ├── /terminal           → TerminalPage
  ├── /cron               → CronPage
  ├── /firewall           → FirewallPage
  ├── /logs               → LogsPage
  ├── /backups            → BackupsPage
  ├── /installer          → InstallerPage
  ├── /cloudflare         → CloudflarePage
  ├── /monitoring         → MonitoringPage
  ├── /notifications      → NotificationsPage
  ├── /audit              → AuditPage
  ├── /settings           → ProfilePage
  ├── /settings/server    → ServerSettingsPage
  └── /settings/api-tokens → ApiTokensPage
```

### API Client Pattern

```typescript
// apps/web/src/api/client.ts
const API_BASE = '/api/v1';

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

### Query Pattern (TanStack Query)

```typescript
// apps/web/src/api/hooks/sites.ts
export function useSites(options?: { includeRuntime?: boolean }) {
  return useQuery({
    queryKey: ['sites', options],
    queryFn: () => api.get<SiteWithRuntime[]>('/sites'),
  });
}
```

### Sidebar Navigation

```
Overview
  Dashboard
Web
  Domains
  Sites
  Web Server (feature-gated: nginx)
  PHP
  SSL
Services
  DNS
  Mail (feature-gated: postfix)
  Databases (feature-gated: mysql)
  FTP (feature-gated: ftp)
Network
  Cloudflare
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
  Notifications
  Audit Log
Account
  Profile
  Server Settings
```

### Component Architecture

```
components/
├── layout/
│   ├── AppLayout.tsx      # Sidebar + TopBar + content
│   ├── Sidebar.tsx        # Navigation groups
│   └── TopBar.tsx         # Breadcrumbs + actions
├── ui/                    # shadcn/ui + custom primitives
├── auth/
│   └── AuthGuard.tsx      # Route protection
├── files/
│   ├── FilePreviewModal.tsx
│   └── CodeEditor.tsx
└── jobs/
    └── JobNotificationProvider.tsx
```

---

## Build & Deploy

### Local Build

```bash
pnpm build          # schemas → api → web (turbo)
pnpm --filter api build    # tsc + copy migrations
pnpm --filter web build    # tsc -b + vite build
pnpm --filter @serverforge/schemas build
```

### Server Deploy

```bash
# Fresh install (root)
sudo bash scripts/install.sh

# Rebuild & deploy
bash scripts/rebuild-and-deploy.sh
```

### Runtime

```bash
# Development
pnpm --filter api dev     # tsx watch src/index.ts
pnpm --filter web dev     # vite

# Production
node apps/api/dist/index.js         # auto-runs migrations
node apps/api/dist/index.js --skip-migrate  # skip migrations
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | Entry point, starts server + reconciler + scheduler |
| `apps/api/src/server.ts` | Fastify server creation, middleware, static files |
| `apps/api/src/routes.ts` | Route registration with prefixes |
| `apps/api/src/db/migrate.ts` | Migration runner (called on startup) |
| `apps/api/src/db/seed.ts` | Admin user seeding |
| `apps/web/src/router.tsx` | TanStack route definitions |
| `apps/web/src/App.tsx` | Root component with providers |
| `apps/web/src/api/client.ts` | HTTP client wrapper |
| `apps/web/src/store/auth.store.ts` | Zustand auth state |
| `packages/schemas/src/sites.ts` | Site Zod schemas |
| `packages/schemas/src/domains.ts` | Domain Zod schemas |
| `scripts/install.sh` | Full server installer |
| `scripts/rebuild-and-deploy.sh` | Git pull + build + restart |

---

## Environment Variables

```bash
NODE_ENV=production
PORT=8732
HOST=0.0.0.0
PANEL_URL=http://hostname:8732
DB_PATH=/var/lib/novapanel/novapanel.db
SESSION_SECRET=...
JWT_SECRET=...
SF_ENCRYPTION_KEY=...
REDIS_URL=redis://127.0.0.1:6379
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=...
VHOSTS_ROOT=/var/www/vhosts
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
BIND_ZONES_DIR=/etc/bind/zones
BACKUP_DIR=/var/lib/novapanel/backups
MAIL_HOSTNAME=mail.localhost
LE_EMAIL=admin@localhost
LOG_LEVEL=info
```

---

## Current Status

| Component | Status |
|-----------|--------|
| API Build | Passes |
| Web Build | Passes |
| Schemas Build | Passes |
| Migrations | Single fresh migration (0009) |
| Panel Service | Running on port 8732 |
| Database | Seeded with admin user |
| Firewall | Port 8732 open |

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite (libsql) | Single-node simplicity, zero-config |
| Zod schemas in shared package | Both API and Web import types without ESM issues |
| Fastify serves web SPA | Single port, simple deploy |
| TanStack Router (code-based) | Type-safe routing without file conventions |
| Feature flags via `/settings/features` | Hide items when services not installed |
| Reconciler pattern | Infrastructure as state, auto-healing |
| Command allowlist | Security via sudo restrictions |
| `--skip-migrate` flag | Allows startup when migrations fail |
