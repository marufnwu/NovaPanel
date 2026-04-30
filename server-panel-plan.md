# ServerForge — Plesk Clone Server Panel
## Complete AI Coding Agent Plan

> **Project Codename:** `ServerForge`
> **Version Target:** v1.0.0
> **Primary Use:** Local server management via Cloudflare Tunnel (also supports remote/VPS)
> **License:** MIT

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema](#5-database-schema)
6. [Module Breakdown](#6-module-breakdown)
7. [API Design](#7-api-design)
8. [Frontend UI Plan](#8-frontend-ui-plan)
9. [Cloudflare Tunnel Integration](#9-cloudflare-tunnel-integration)
10. [Security Architecture](#10-security-architecture)
11. [Service Management Engine](#11-service-management-engine)
12. [Background Job System](#12-background-job-system)
13. [Development Phases](#13-development-phases)
14. [Environment & Config](#14-environment--config)
15. [Testing Strategy](#15-testing-strategy)
16. [Deployment](#16-deployment)
17. [AI Agent Implementation Notes](#17-ai-agent-implementation-notes)

---

## 1. Project Overview

### Goals
Build a self-hosted, open-source server control panel that replicates core Plesk functionality, optimized for:
- Local home/office servers exposed via **Cloudflare Tunnel** (no port forwarding required)
- VPS/dedicated servers (traditional access)
- Multi-user with role-based access (Admin → Reseller → Customer)
- Full domain, web server, email, DNS, database, and SSL management via a modern web UI

### Non-Goals (v1.0)
- Windows Server support (Linux-only for v1)
- Paid billing/invoicing (planned for v2)
- Kubernetes/container orchestration

### Target OS
- Ubuntu 22.04 LTS / 24.04 LTS
- Debian 11 / 12
- AlmaLinux / Rocky Linux 8+

---

## 2. Tech Stack

### Backend
| Layer | Technology | Reason |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Async I/O, large ecosystem |
| Framework | **Fastify 4** | Faster than Express, schema-based |
| Language | **TypeScript 5** | Type safety for system ops |
| Auth | **Lucia v3** + **JWT** | Session + API token dual auth |
| ORM | **Drizzle ORM** | Lightweight, type-safe |
| Database | **SQLite (libsql/Turso)** | Zero-dependency, embedded, file-based |
| Queue | **BullMQ + Redis (via Valkey)** | Background jobs, scheduled tasks |
| Shell Exec | **execa** | Safe subprocess execution |
| SSH | **node-ssh** | Remote node support |
| WebSocket | **Fastify WS plugin** | Real-time terminal, logs |
| Validation | **Zod** | Schema validation |
| Logging | **Pino** | Fast structured logging |

### Frontend
| Layer | Technology |
|---|---|
| Framework | **React 18 + Vite** |
| Language | **TypeScript** |
| UI Library | **shadcn/ui + Radix UI** |
| Styling | **Tailwind CSS v3** |
| State | **Zustand + TanStack Query v5** |
| Terminal | **xterm.js** |
| Charts | **Recharts** |
| Forms | **React Hook Form + Zod** |
| Icons | **Lucide React** |
| Router | **TanStack Router** |

### Infrastructure / Services
| Service | Technology |
|---|---|
| Web Server | **Nginx + Apache2** (dual stack) |
| PHP | **PHP-FPM** (multi-version via ondrej/php) |
| Mail MTA | **Postfix** |
| Mail IMAP | **Dovecot** |
| Spam Filter | **SpamAssassin** |
| Database | **MariaDB 10.11** + **PostgreSQL 15** |
| DNS | **BIND9** |
| FTP | **ProFTPd** |
| SSL | **Certbot** (Let's Encrypt) + custom cert upload |
| Firewall | **UFW** + **Fail2Ban** |
| Tunnel | **cloudflared** (Cloudflare Tunnel daemon) |
| Process Mgr | **PM2** (for ServerForge itself) |
| Cron | **node-cron** + system crontab management |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        External Access                           │
│                                                                  │
│   Browser ──► Cloudflare Edge ──► cloudflared tunnel daemon     │
│   Browser ──► Direct IP:8443 (fallback, local LAN)              │
└──────────────────────┬───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│                   ServerForge Panel (Node.js)                    │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  REST API   │  │  WebSocket   │  │   Static React SPA      │ │
│  │  /api/v1/*  │  │  /ws/*       │  │   (Vite Build Output)   │ │
│  └──────┬──────┘  └──────┬───────┘  └─────────────────────────┘ │
│         │                │                                        │
│  ┌──────▼────────────────▼────────────────────────────────────┐  │
│  │                  Core Service Layer                         │  │
│  │                                                             │  │
│  │  DomainSvc │ WebSvc │ MailSvc │ DNSSvc │ DBSvc │ SSLSvc    │  │
│  │  UserSvc   │ FTPSvc │ CronSvc │ FirewallSvc │ TunnelSvc   │  │
│  └──────┬─────────────────────────────────────────────────────┘  │
│         │                                                          │
│  ┌──────▼──────────────────────────────────────────────────────┐ │
│  │              System Executor (execa wrapper)                 │ │
│  │   Runs shell commands as root via sudoers rules              │ │
│  └──────┬──────────────────────────────────────────────────────┘ │
│         │                                                          │
│  ┌──────▼────────────────────┐  ┌────────────────────────────┐   │
│  │   SQLite (panel state)    │  │  BullMQ + Valkey (jobs)    │   │
│  └───────────────────────────┘  └────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│                     Host OS Services                             │
│                                                                  │
│   Nginx ─── Apache2 ─── PHP-FPM pools                           │
│   Postfix ── Dovecot ── SpamAssassin                             │
│   MariaDB ── PostgreSQL                                          │
│   BIND9 ─── ProFTPd                                              │
│   UFW ───── Fail2Ban                                             │
│   cloudflared                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Multi-Node Architecture (future v2)
```
Master Node (ServerForge Panel)
    ├── Agent Node 1 (node-ssh + remote execa)
    ├── Agent Node 2
    └── Agent Node N
```

---

## 4. Directory Structure

```
serverforge/
├── apps/
│   ├── api/                          # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── server.ts             # Fastify instance setup
│   │   │   ├── config/
│   │   │   │   ├── env.ts            # Environment config (zod)
│   │   │   │   └── constants.ts      # App constants
│   │   │   ├── db/
│   │   │   │   ├── index.ts          # Drizzle client
│   │   │   │   ├── schema/           # All table schemas
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── domains.ts
│   │   │   │   │   ├── subscriptions.ts
│   │   │   │   │   ├── databases.ts
│   │   │   │   │   ├── email.ts
│   │   │   │   │   ├── dns.ts
│   │   │   │   │   ├── ssl.ts
│   │   │   │   │   ├── ftp.ts
│   │   │   │   │   ├── cron.ts
│   │   │   │   │   ├── tunnels.ts
│   │   │   │   │   └── audit.ts
│   │   │   │   └── migrations/       # Drizzle migrations
│   │   │   ├── modules/              # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.schema.ts
│   │   │   │   │   └── auth.middleware.ts
│   │   │   │   ├── users/
│   │   │   │   ├── domains/
│   │   │   │   ├── subscriptions/
│   │   │   │   ├── webserver/
│   │   │   │   ├── php/
│   │   │   │   ├── mail/
│   │   │   │   ├── dns/
│   │   │   │   ├── databases/
│   │   │   │   ├── ssl/
│   │   │   │   ├── ftp/
│   │   │   │   ├── cron/
│   │   │   │   ├── firewall/
│   │   │   │   ├── tunnel/
│   │   │   │   ├── files/
│   │   │   │   ├── terminal/
│   │   │   │   ├── logs/
│   │   │   │   ├── stats/
│   │   │   │   └── backup/
│   │   │   ├── services/             # System-level executors
│   │   │   │   ├── executor.ts       # Safe shell command wrapper
│   │   │   │   ├── nginx.service.ts
│   │   │   │   ├── apache.service.ts
│   │   │   │   ├── php-fpm.service.ts
│   │   │   │   ├── postfix.service.ts
│   │   │   │   ├── dovecot.service.ts
│   │   │   │   ├── bind.service.ts
│   │   │   │   ├── mariadb.service.ts
│   │   │   │   ├── postgres.service.ts
│   │   │   │   ├── certbot.service.ts
│   │   │   │   ├── ufw.service.ts
│   │   │   │   ├── fail2ban.service.ts
│   │   │   │   ├── cloudflared.service.ts
│   │   │   │   └── proftpd.service.ts
│   │   │   ├── jobs/                 # BullMQ workers
│   │   │   │   ├── queue.ts
│   │   │   │   ├── ssl-renew.job.ts
│   │   │   │   ├── backup.job.ts
│   │   │   │   ├── stats-collect.job.ts
│   │   │   │   └── mail-queue.job.ts
│   │   │   ├── ws/                   # WebSocket handlers
│   │   │   │   ├── terminal.ws.ts
│   │   │   │   └── logs.ws.ts
│   │   │   ├── templates/            # Config file templates
│   │   │   │   ├── nginx/
│   │   │   │   │   ├── vhost.conf.hbs
│   │   │   │   │   ├── vhost-ssl.conf.hbs
│   │   │   │   │   └── proxy.conf.hbs
│   │   │   │   ├── apache/
│   │   │   │   │   ├── vhost.conf.hbs
│   │   │   │   │   └── vhost-ssl.conf.hbs
│   │   │   │   ├── bind/
│   │   │   │   │   └── zone.hbs
│   │   │   │   ├── postfix/
│   │   │   │   └── php-fpm/
│   │   │   │       └── pool.conf.hbs
│   │   │   └── utils/
│   │   │       ├── crypto.ts
│   │   │       ├── ip.ts
│   │   │       └── validators.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── router.tsx            # TanStack Router config
│       │   ├── store/                # Zustand stores
│       │   │   ├── auth.store.ts
│       │   │   └── ui.store.ts
│       │   ├── api/                  # API client (TanStack Query)
│       │   │   ├── client.ts
│       │   │   └── hooks/
│       │   ├── pages/
│       │   │   ├── login/
│       │   │   ├── dashboard/
│       │   │   ├── domains/
│       │   │   ├── webserver/
│       │   │   ├── php/
│       │   │   ├── mail/
│       │   │   ├── dns/
│       │   │   ├── databases/
│       │   │   ├── ssl/
│       │   │   ├── ftp/
│       │   │   ├── cron/
│       │   │   ├── firewall/
│       │   │   ├── tunnel/
│       │   │   ├── files/
│       │   │   ├── terminal/
│       │   │   ├── logs/
│       │   │   ├── backup/
│       │   │   └── settings/
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── Topbar.tsx
│       │   │   │   └── Layout.tsx
│       │   │   ├── ui/               # shadcn components
│       │   │   └── shared/
│       │   └── lib/
│       │       ├── utils.ts
│       │       └── constants.ts
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/                          # Bash installer scripts
│   ├── install.sh                    # Main installer
│   ├── setup-nginx.sh
│   ├── setup-apache.sh
│   ├── setup-mail.sh
│   ├── setup-dns.sh
│   ├── setup-db.sh
│   ├── setup-php.sh
│   ├── setup-ssl.sh
│   ├── setup-firewall.sh
│   ├── setup-cloudflared.sh
│   └── uninstall.sh
│
├── configs/                          # Default config stubs
│   ├── nginx/
│   ├── apache/
│   └── sudoers.d/
│       └── serverforge               # Sudoers rules for panel
│
├── package.json                      # Monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                        # Turborepo pipeline
├── .env.example
└── README.md
```

---

## 5. Database Schema

> All tables use SQLite via Drizzle ORM. File location: `/var/lib/serverforge/db.sqlite`

### 5.1 Users & Roles

```typescript
// schema/users.ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // nanoid
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'reseller', 'customer'] }).notNull().default('customer'),
  parentId: text('parent_id').references(() => users.id), // reseller->customer tree
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false),
  apiToken: text('api_token'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address')
});
```

### 5.2 Subscriptions (Service Plans)

```typescript
// schema/subscriptions.ts
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  maxDomains: integer('max_domains').default(-1),       // -1 = unlimited
  maxDiskMb: integer('max_disk_mb').default(-1),
  maxBandwidthMb: integer('max_bandwidth_mb').default(-1),
  maxDatabases: integer('max_databases').default(-1),
  maxEmailAccounts: integer('max_email_accounts').default(-1),
  maxFtpAccounts: integer('max_ftp_accounts').default(-1),
  phpVersions: text('php_versions'),                   // JSON array
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  planId: text('plan_id').notNull().references(() => plans.id),
  systemUser: text('system_user').notNull().unique(), // OS user account
  homeDir: text('home_dir').notNull(),               // /var/www/vhosts/{username}
  diskUsedMb: integer('disk_used_mb').default(0),
  bandwidthUsedMb: integer('bandwidth_used_mb').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.3 Domains

```typescript
// schema/domains.ts
export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id),
  name: text('name').notNull().unique(),              // example.com
  documentRoot: text('document_root').notNull(),      // /var/www/vhosts/user/example.com/httpdocs
  phpVersion: text('php_version').default('8.2'),
  phpHandler: text('php_handler', { enum: ['php-fpm', 'cgi', 'disabled'] }).default('php-fpm'),
  webServer: text('web_server', { enum: ['nginx', 'apache', 'nginx+apache'] }).default('nginx+apache'),
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(false),
  sslCertId: text('ssl_cert_id'),
  redirectHttpToHttps: integer('redirect_http_to_https', { mode: 'boolean' }).default(false),
  hsts: integer('hsts', { mode: 'boolean' }).default(false),
  status: text('status', { enum: ['active', 'suspended', 'pending'] }).default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const subdomains = sqliteTable('subdomains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                       // sub.example.com
  documentRoot: text('document_root').notNull(),
  phpVersion: text('php_version'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const domainAliases = sqliteTable('domain_aliases', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const domainRedirects = sqliteTable('domain_redirects', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  sourcePath: text('source_path').notNull(),
  targetUrl: text('target_url').notNull(),
  type: text('type', { enum: ['301', '302'] }).default('301'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.4 SSL Certificates

```typescript
// schema/ssl.ts
export const sslCertificates = sqliteTable('ssl_certificates', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id),
  type: text('type', { enum: ['letsencrypt', 'custom', 'self-signed'] }).notNull(),
  certificate: text('certificate'),                   // PEM
  privateKey: text('private_key'),                    // PEM (encrypted at rest)
  chain: text('chain'),                               // CA chain PEM
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true),
  lastRenewedAt: integer('last_renewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.5 Databases

```typescript
// schema/databases.ts
export const databases = sqliteTable('databases', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id),
  name: text('name').notNull(),
  engine: text('engine', { enum: ['mariadb', 'postgresql'] }).notNull().default('mariadb'),
  charset: text('charset').default('utf8mb4'),
  collation: text('collation').default('utf8mb4_unicode_ci'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const databaseUsers = sqliteTable('database_users', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull().references(() => databases.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),     // stored for display; real auth in DB engine
  host: text('host').default('localhost'),
  privileges: text('privileges').default('ALL'),     // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.6 Email

```typescript
// schema/email.ts
export const mailDomains = sqliteTable('mail_domains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  spfRecord: text('spf_record'),
  dkimPublicKey: text('dkim_public_key'),
  dkimPrivateKey: text('dkim_private_key'),          // encrypted
  dmarcPolicy: text('dmarc_policy'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const mailboxes = sqliteTable('mailboxes', {
  id: text('id').primaryKey(),
  mailDomainId: text('mail_domain_id').notNull().references(() => mailDomains.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),              // user@example.com
  passwordHash: text('password_hash').notNull(),
  quotaMb: integer('quota_mb').default(1024),
  usedMb: integer('used_mb').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  autoresponder: integer('autoresponder', { mode: 'boolean' }).default(false),
  autoresponderMessage: text('autoresponder_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const mailAliases = sqliteTable('mail_aliases', {
  id: text('id').primaryKey(),
  mailDomainId: text('mail_domain_id').notNull().references(() => mailDomains.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),                   // alias@example.com
  destination: text('destination').notNull(),        // dest@example.com (can be external)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const mailForwards = sqliteTable('mail_forwards', {
  id: text('id').primaryKey(),
  mailboxId: text('mailbox_id').notNull().references(() => mailboxes.id, { onDelete: 'cascade' }),
  forwardTo: text('forward_to').notNull(),
  keepCopy: integer('keep_copy', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.7 DNS

```typescript
// schema/dns.ts
export const dnsZones = sqliteTable('dns_zones', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  serial: integer('serial').notNull(),
  ttl: integer('ttl').default(3600),
  primaryNs: text('primary_ns').notNull(),
  adminEmail: text('admin_email').notNull(),
  refresh: integer('refresh').default(86400),
  retry: integer('retry').default(7200),
  expire: integer('expire').default(3600000),
  minimumTtl: integer('minimum_ttl').default(172800),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const dnsRecords = sqliteTable('dns_records', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => dnsZones.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'] }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').default(3600),
  priority: integer('priority'),                    // for MX, SRV
  isSystem: integer('is_system', { mode: 'boolean' }).default(false), // auto-generated records
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.8 FTP

```typescript
// schema/ftp.ts
export const ftpAccounts = sqliteTable('ftp_accounts', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  homeDir: text('home_dir').notNull(),
  readonly: integer('readonly', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.9 Scheduled Tasks (Cron)

```typescript
// schema/cron.ts
export const cronJobs = sqliteTable('cron_jobs', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  command: text('command').notNull(),
  schedule: text('schedule').notNull(),             // cron expression: "0 * * * *"
  systemUser: text('system_user').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRun: integer('last_run', { mode: 'timestamp' }),
  lastStatus: text('last_status', { enum: ['success', 'failed', 'running'] }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.10 Cloudflare Tunnels

```typescript
// schema/tunnels.ts
export const cloudflareTunnels = sqliteTable('cloudflare_tunnels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tunnelId: text('tunnel_id'),                      // CF tunnel UUID
  accountId: text('account_id'),
  apiToken: text('api_token'),                      // encrypted
  credentialsJson: text('credentials_json'),        // encrypted JSON
  status: text('status', { enum: ['active', 'inactive', 'error'] }).default('inactive'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const tunnelRoutes = sqliteTable('tunnel_routes', {
  id: text('id').primaryKey(),
  tunnelId: text('tunnel_id').notNull().references(() => cloudflareTunnels.id, { onDelete: 'cascade' }),
  hostname: text('hostname').notNull(),             // panel.example.com
  service: text('service').notNull(),               // http://localhost:8080
  domainId: text('domain_id').references(() => domains.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### 5.11 Audit Log

```typescript
// schema/audit.ts
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),                 // e.g., "domain.create"
  resource: text('resource'),                       // e.g., "domain:abc123"
  details: text('details'),                         // JSON
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

---

## 6. Module Breakdown

### 6.1 Auth Module (`/modules/auth/`)

**Responsibilities:**
- Login with username/password
- Session management (Lucia)
- JWT API token generation
- 2FA via TOTP (otpauth library)
- Password reset via email

**Routes:**
```
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/2fa/enable
POST /api/v1/auth/2fa/verify
POST /api/v1/auth/password/reset
GET  /api/v1/auth/me
```

**Implementation Notes:**
- Store sessions in SQLite sessions table
- Implement rate limiting (5 attempts / 15 min per IP)
- API tokens: `sf_` prefix, stored as SHA256 hash in DB
- RBAC: admin > reseller > customer, checked via middleware

---

### 6.2 Domain Module (`/modules/domains/`)

**Responsibilities:**
- Add/remove/suspend domains
- Configure document roots
- Create subdomains, aliases, redirects
- Reverse proxy configuration per domain

**Routes:**
```
GET    /api/v1/domains
POST   /api/v1/domains
GET    /api/v1/domains/:id
PUT    /api/v1/domains/:id
DELETE /api/v1/domains/:id
POST   /api/v1/domains/:id/suspend
POST   /api/v1/domains/:id/activate
GET    /api/v1/domains/:id/subdomains
POST   /api/v1/domains/:id/subdomains
DELETE /api/v1/domains/:id/subdomains/:subId
GET    /api/v1/domains/:id/aliases
POST   /api/v1/domains/:id/aliases
DELETE /api/v1/domains/:id/aliases/:aliasId
GET    /api/v1/domains/:id/redirects
POST   /api/v1/domains/:id/redirects
DELETE /api/v1/domains/:id/redirects/:redirectId
```

**On domain creation, execute sequentially:**
1. Create system user (`useradd -m -d /var/www/vhosts/{user} -s /usr/sbin/nologin`)
2. Create directory structure:
   - `httpdocs/`
   - `private/`
   - `logs/`
   - `tmp/`
   - `ssl/`
3. Write Nginx vhost config (from Handlebars template)
4. Write Apache vhost config (from Handlebars template)
5. Write PHP-FPM pool config
6. Create DNS zone in BIND9
7. Reload Nginx, Apache, PHP-FPM, BIND9
8. Persist to SQLite

---

### 6.3 Web Server Module (`/modules/webserver/`)

**Responsibilities:**
- Toggle Nginx/Apache/dual-stack per domain
- Manage PHP handler settings per domain
- Custom Nginx/Apache directives input (with validation)
- .htaccess support status
- Hotlink protection
- IP access restrictions per domain

**Routes:**
```
GET  /api/v1/domains/:id/webserver
PUT  /api/v1/domains/:id/webserver
GET  /api/v1/domains/:id/webserver/config-preview
POST /api/v1/domains/:id/webserver/reload
POST /api/v1/domains/:id/webserver/test-config
```

**Nginx Vhost Template (`vhost.conf.hbs`):**
```nginx
# ServerForge generated — do not edit manually
server {
    listen 80;
    server_name {{domain}} www.{{domain}};
    root {{documentRoot}};
    index index.php index.html;

    access_log /var/www/vhosts/{{user}}/logs/{{domain}}-access.log;
    error_log  /var/www/vhosts/{{user}}/logs/{{domain}}-error.log;

    {{#if proxyToApache}}
    location ~ \.php$ {
        proxy_pass http://127.0.0.1:7080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    {{else}}
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php{{phpVersion}}-fpm-{{user}}.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
    {{/if}}

    {{customDirectives}}
}
```

---

### 6.4 PHP Module (`/modules/php/`)

**Responsibilities:**
- List available PHP versions on server
- Set PHP version per domain
- Manage PHP-FPM pool settings (memory limit, max execution time, etc.)
- Per-domain `php.ini` overrides

**Routes:**
```
GET  /api/v1/php/versions
GET  /api/v1/domains/:id/php
PUT  /api/v1/domains/:id/php
GET  /api/v1/domains/:id/php/ini
PUT  /api/v1/domains/:id/php/ini
POST /api/v1/domains/:id/php/restart-fpm
```

**PHP-FPM Pool Template:**
```ini
; Pool: {{user}}_{{domain}}
[{{poolName}}]
user = {{systemUser}}
group = {{systemUser}}
listen = /run/php/php{{phpVersion}}-fpm-{{poolName}}.sock
listen.owner = www-data
pm = dynamic
pm.max_children = {{maxChildren}}
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
php_admin_value[memory_limit] = {{memoryLimit}}
php_admin_value[upload_max_filesize] = {{uploadMaxFilesize}}
php_admin_value[max_execution_time] = {{maxExecutionTime}}
php_admin_value[open_basedir] = {{documentRoot}}:/tmp
```

---

### 6.5 Mail Module (`/modules/mail/`)

**Responsibilities:**
- Enable/disable mail for domains
- Create/delete mailboxes
- Set per-mailbox quotas
- Email aliases and forwarding
- DKIM key generation and DNS injection
- SPF/DMARC record management
- Webmail (Roundcube) access link
- Spam filter settings

**Routes:**
```
GET    /api/v1/domains/:id/mail
POST   /api/v1/domains/:id/mail/enable
DELETE /api/v1/domains/:id/mail/disable
GET    /api/v1/domains/:id/mail/mailboxes
POST   /api/v1/domains/:id/mail/mailboxes
PUT    /api/v1/domains/:id/mail/mailboxes/:mbId
DELETE /api/v1/domains/:id/mail/mailboxes/:mbId
GET    /api/v1/domains/:id/mail/aliases
POST   /api/v1/domains/:id/mail/aliases
DELETE /api/v1/domains/:id/mail/aliases/:aliasId
POST   /api/v1/domains/:id/mail/dkim/generate
GET    /api/v1/domains/:id/mail/dkim/status
```

**DKIM Generation Flow:**
```typescript
// 1. Generate 2048-bit RSA key pair
const { publicKey, privateKey } = await generateKeyPair('rsa', { modulusLength: 2048 });
// 2. Store in mailDomains table (encrypted private key)
// 3. Auto-inject TXT DNS record: mail._domainkey.example.com
// 4. Configure Postfix opendkim
// 5. Reload postfix + opendkim
```

---

### 6.6 DNS Module (`/modules/dns/`)

**Responsibilities:**
- Full DNS zone management (BIND9)
- CRUD for all record types (A, AAAA, MX, CNAME, TXT, NS, SRV, CAA)
- Zone import/export (BIND format)
- DNS template support
- External DNS mode (delegate to Cloudflare)

**Routes:**
```
GET    /api/v1/domains/:id/dns
POST   /api/v1/domains/:id/dns/records
PUT    /api/v1/domains/:id/dns/records/:recId
DELETE /api/v1/domains/:id/dns/records/:recId
POST   /api/v1/domains/:id/dns/import
GET    /api/v1/domains/:id/dns/export
POST   /api/v1/domains/:id/dns/reset-to-defaults
```

**Zone file generation via BIND service:**
```typescript
async function writeZoneFile(domain: Domain, records: DnsRecord[]): Promise<void> {
  const template = await readTemplate('bind/zone.hbs');
  const zoneContent = Handlebars.compile(template)({ domain, records, serial: Date.now() });
  await writeFile(`/etc/bind/zones/db.${domain.name}`, zoneContent);
  await executor.run('rndc reload');
}
```

---

### 6.7 Database Module (`/modules/databases/`)

**Responsibilities:**
- Create/delete MariaDB and PostgreSQL databases
- Create database users and assign privileges
- per-subscription database listing
- phpMyAdmin SSO link generation
- Database export (mysqldump / pg_dump)
- Database import from SQL file

**Routes:**
```
GET    /api/v1/databases
POST   /api/v1/databases
DELETE /api/v1/databases/:id
POST   /api/v1/databases/:id/users
DELETE /api/v1/databases/:id/users/:userId
PUT    /api/v1/databases/:id/users/:userId/password
GET    /api/v1/databases/:id/phpmyadmin-url
POST   /api/v1/databases/:id/export
POST   /api/v1/databases/:id/import
```

---

### 6.8 SSL Module (`/modules/ssl/`)

**Responsibilities:**
- Issue Let's Encrypt certificates (HTTP-01 challenge via Certbot)
- Issue wildcard certificates (DNS-01 challenge via Cloudflare API)
- Upload custom certificates (PEM format)
- Generate self-signed certificates
- Auto-renew monitoring (via BullMQ job)
- Force HTTPS redirect
- HSTS management

**Routes:**
```
GET    /api/v1/domains/:id/ssl
POST   /api/v1/domains/:id/ssl/letsencrypt
POST   /api/v1/domains/:id/ssl/custom
POST   /api/v1/domains/:id/ssl/self-signed
DELETE /api/v1/domains/:id/ssl
POST   /api/v1/domains/:id/ssl/renew
GET    /api/v1/ssl/expiring               # Admin: list expiring certs
```

**Let's Encrypt flow:**
```typescript
async function issueLetsEncrypt(domain: string, email: string): Promise<void> {
  await executor.run(
    `certbot certonly --webroot -w /var/www/vhosts/${user}/httpdocs ` +
    `-d ${domain} -d www.${domain} --email ${email} --agree-tos --non-interactive`
  );
  const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
  const keyPath  = `/etc/letsencrypt/live/${domain}/privkey.pem`;
  // Update Nginx vhost with SSL block
  await webserverService.enableSSL(domain, certPath, keyPath);
}
```

---

### 6.9 FTP Module (`/modules/ftp/`)

**Routes:**
```
GET    /api/v1/domains/:id/ftp
POST   /api/v1/domains/:id/ftp
PUT    /api/v1/domains/:id/ftp/:ftpId
DELETE /api/v1/domains/:id/ftp/:ftpId
POST   /api/v1/domains/:id/ftp/:ftpId/change-password
```

---

### 6.10 Firewall Module (`/modules/firewall/`)

**Responsibilities:**
- View UFW rules
- Add/delete custom rules (allow/deny by port, IP, protocol)
- Preset rules (allow SSH, HTTP, HTTPS, FTP, SMTP, IMAP)
- Fail2Ban jail management and unban IP

**Routes:**
```
GET    /api/v1/firewall/rules
POST   /api/v1/firewall/rules
DELETE /api/v1/firewall/rules/:id
GET    /api/v1/firewall/fail2ban/jails
GET    /api/v1/firewall/fail2ban/banned
POST   /api/v1/firewall/fail2ban/unban
```

---

### 6.11 Cloudflare Tunnel Module (`/modules/tunnel/`)

**Responsibilities:**
- Configure Cloudflare account credentials (API Token)
- Create and manage named tunnels via `cloudflared`
- Map hostnames to local services (e.g., `panel.example.com → https://localhost:8443`)
- Map domain vhosts through tunnel automatically
- Show tunnel status and connection health
- Supports both panel access tunnel and per-domain tunnels

**Routes:**
```
GET    /api/v1/tunnel
POST   /api/v1/tunnel/setup
GET    /api/v1/tunnel/status
POST   /api/v1/tunnel/start
POST   /api/v1/tunnel/stop
GET    /api/v1/tunnel/routes
POST   /api/v1/tunnel/routes
DELETE /api/v1/tunnel/routes/:id
POST   /api/v1/tunnel/routes/:id/toggle
```

**Config file generated at `/etc/cloudflared/config.yml`:**
```yaml
tunnel: {{tunnelId}}
credentials-file: /etc/cloudflared/{{tunnelId}}.json

ingress:
  {{#each routes}}
  - hostname: {{this.hostname}}
    service: {{this.service}}
  {{/each}}
  - service: http_status:404
```

**Tunnel setup flow:**
```typescript
async function setupTunnel(name: string, apiToken: string): Promise<void> {
  // 1. Authenticate cloudflared
  await executor.run(`cloudflared tunnel login`);
  // 2. Create tunnel
  const out = await executor.run(`cloudflared tunnel create ${name}`);
  const tunnelId = parseTunnelId(out.stdout);
  // 3. Generate config
  await writeTunnelConfig(tunnelId, routes);
  // 4. Create DNS CNAME records via CF API
  await createCloudflareDns(tunnelId, hostname, apiToken);
  // 5. Install as systemd service
  await executor.run(`cloudflared service install`);
  await executor.run(`systemctl enable --now cloudflared`);
}
```

---

### 6.12 File Manager Module (`/modules/files/`)

**Responsibilities:**
- Browse, upload, download files in subscription home dirs
- Create/delete/rename files and folders
- Edit text files (CodeMirror-based editor in UI)
- Change file permissions (chmod)
- Archive and extract (zip, tar.gz)
- Disk usage per directory

**Routes:**
```
GET    /api/v1/files?path=...
POST   /api/v1/files/upload
POST   /api/v1/files/mkdir
DELETE /api/v1/files
POST   /api/v1/files/rename
PUT    /api/v1/files/permissions
POST   /api/v1/files/archive
POST   /api/v1/files/extract
GET    /api/v1/files/download?path=...
```

**Security:** All path operations MUST sanitize and jail to subscription home dir.
```typescript
function safePath(subscriptionHomeDir: string, requestedPath: string): string {
  const resolved = path.resolve(subscriptionHomeDir, requestedPath);
  if (!resolved.startsWith(subscriptionHomeDir)) {
    throw new ForbiddenError('Path traversal detected');
  }
  return resolved;
}
```

---

### 6.13 Terminal Module (`/modules/terminal/`)

**Responsibilities:**
- Browser-based terminal via WebSocket + `node-pty` + `xterm.js`
- Admin: full shell as root
- Customer: jailed shell as subscription system user
- Session logging (optional)

**WebSocket:**
```
WS /ws/terminal?token=...
```

**Implementation:**
```typescript
import { spawn } from 'node-pty';

wss.on('connection', (ws, req) => {
  const user = verifyToken(req.query.token);
  const shell = user.role === 'admin' ? '/bin/bash' : '/bin/rbash';
  const pty = spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80, rows: 30,
    env: { HOME: user.homeDir, USER: user.systemUser, ...process.env }
  });
  pty.onData(data => ws.send(JSON.stringify({ type: 'output', data })));
  ws.on('message', msg => {
    const { type, data } = JSON.parse(msg);
    if (type === 'input') pty.write(data);
    if (type === 'resize') pty.resize(data.cols, data.rows);
  });
  ws.on('close', () => pty.kill());
});
```

---

### 6.14 Stats Module (`/modules/stats/`)

**Responsibilities:**
- Real-time CPU, RAM, Disk, Network graphs
- Per-domain disk usage
- Per-domain bandwidth usage
- Service status monitoring (up/down for each service)
- Server uptime

**Routes:**
```
GET /api/v1/stats/server           # CPU, RAM, disk, uptime
GET /api/v1/stats/services         # All service statuses
GET /api/v1/stats/domains/:id      # Disk + bandwidth for domain
GET /api/v1/stats/network          # Network in/out
```

**Data collection (BullMQ repeatable job every 30s):**
```typescript
import si from 'systeminformation';

async function collectStats() {
  const cpu  = await si.currentLoad();
  const mem  = await si.mem();
  const disk = await si.fsStats();
  const net  = await si.networkStats();
  // Store in SQLite stats table (rolling 24h window)
}
```

---

### 6.15 Backup Module (`/modules/backup/`)

**Responsibilities:**
- Manual and scheduled backups per subscription
- Backup contents: files + databases + configs
- Local storage (configurable path)
- Remote storage (SFTP, S3-compatible, Backblaze B2)
- One-click restore
- Partial restore (files only, DB only)

**Routes:**
```
GET    /api/v1/backups
POST   /api/v1/backups
GET    /api/v1/backups/:id
DELETE /api/v1/backups/:id
POST   /api/v1/backups/:id/restore
GET    /api/v1/backup/schedule
PUT    /api/v1/backup/schedule
```

**Backup process:**
```
1. Dump databases → SQL files
2. tar.gz of httpdocs + email data
3. Export DNS zones
4. Store metadata JSON
5. Compress all into single .sfbk archive
6. Upload to remote if configured
7. Prune old backups per retention policy
```

---

### 6.16 Logs Module (`/modules/logs/`)

**Responsibilities:**
- Tail domain access/error logs in real-time (WebSocket)
- View panel/system logs
- Log rotation settings
- Fail2Ban log viewer

**Routes:**
```
GET /api/v1/domains/:id/logs/access
GET /api/v1/domains/:id/logs/error
WS  /ws/logs?domain=...&type=access|error
GET /api/v1/logs/panel
GET /api/v1/logs/fail2ban
```

---

## 7. API Design

### Base URL
```
https://{panel-domain}/api/v1/
```

### Authentication
```
# Session-based (browser)
Cookie: sf_session={sessionId}

# Token-based (API / programmatic)
Authorization: Bearer sf_{apiToken}
```

### Standard Response Envelope
```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "DOMAIN_EXISTS",
    "message": "Domain already exists on this server",
    "field": "name"        // for validation errors
  }
}
```

### HTTP Status Codes
| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete) |
| 400 | Validation Error |
| 401 | Unauthenticated |
| 403 | Forbidden (role) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable (system error) |
| 429 | Rate Limited |
| 500 | Internal Error |

### Pagination
```
GET /api/v1/domains?page=1&perPage=20&search=example&sort=name&order=asc
```

---

## 8. Frontend UI Plan

### Layout Structure
```
┌──────────────────────────────────────────────────────┐
│  TOPBAR: Logo | Server status | Notifications | User │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  SIDEBAR   │            MAIN CONTENT                 │
│            │                                         │
│  Dashboard │    (Page-specific content here)         │
│  Domains   │                                         │
│  Web Srv   │                                         │
│  PHP       │                                         │
│  Mail      │                                         │
│  DNS       │                                         │
│  Databases │                                         │
│  SSL       │                                         │
│  FTP       │                                         │
│  Files     │                                         │
│  Terminal  │                                         │
│  Cron      │                                         │
│  Firewall  │                                         │
│  Tunnel    │                                         │
│  Backups   │                                         │
│  Logs      │                                         │
│  Settings  │                                         │
│            │                                         │
└────────────┴─────────────────────────────────────────┘
```

### Design System
- **Theme:** Dark-first, toggleable to light
- **Primary Color:** `#3B82F6` (blue-500)
- **Background:** `#0F172A` (slate-900) dark / `#F8FAFC` light
- **Sidebar width:** 240px collapsed → 60px
- **Font:** `JetBrains Mono` for code, `Inter` for UI
- **Border radius:** `8px` consistently
- **Shadows:** Subtle layered shadows for cards

### Key Pages

#### Dashboard Page
- Server health overview (CPU donut, RAM bar, Disk pie)
- Quick stat tiles: Domains, Mailboxes, Databases, Active Tunnels
- Services status grid (green/red indicators with restart button)
- Recent activity log
- Quick actions: Add Domain, New Database, Issue SSL

#### Domain List Page
- Table: Domain | Status | PHP | SSL | Created | Actions
- Per-row actions: Configure, Suspend, Delete, Open site
- Bulk actions: Suspend all, Delete selected
- "Add Domain" slide-over panel

#### Domain Detail Page (tabs)
- **Overview:** Summary stats, quick actions
- **Web Server:** Server selection, PHP settings, custom directives
- **SSL:** Certificate status, issue/renew buttons
- **DNS:** Record table, add record form inline
- **Mail:** Mailbox list, domain mail settings
- **Databases:** DB list per domain
- **FTP:** FTP account management
- **Redirects:** URL redirect rules
- **Logs:** Live log tail viewer
- **Backups:** Domain-specific backup history

#### Terminal Page
- Full-page xterm.js terminal
- Connection status indicator
- Copy/paste helper bar
- Font size / theme controls

#### Tunnel Page
- Tunnel status card with animated connection indicator
- Ingress routes table: Hostname → Service mapping
- Add route form
- cloudflared logs tail
- Setup wizard (first-time guided flow)

---

## 9. Cloudflare Tunnel Integration

### Overview

Cloudflare Tunnel (`cloudflared`) creates an outbound-only connection from the server to Cloudflare's edge — no inbound firewall ports required.

### Use Cases in ServerForge

| Use Case | Tunnel Route |
|---|---|
| Access panel from internet | `panel.yourdomain.com → https://localhost:8443` |
| Expose domain website | `example.com → http://localhost:80` |
| Webmail access | `mail.example.com → http://localhost:80` |
| phpMyAdmin | `db.yourdomain.com → http://localhost:8080` |

### Setup Wizard Steps (UI-guided)

```
Step 1: Enter Cloudflare API Token (requires Zone:DNS:Edit permission)
Step 2: Select/create Cloudflare account & zone
Step 3: CloudFlared installs and authenticates
Step 4: Panel generates tunnel + credentials JSON
Step 5: Add first route (panel access hostname)
Step 6: DNS CNAME auto-created via CF API
Step 7: Tunnel starts via systemd
```

### Tunnel Management Service

```typescript
// services/cloudflared.service.ts

export class CloudflareTunnelService {
  async createTunnel(name: string): Promise<string> {
    const result = await executor.run(`cloudflared tunnel create ${name}`);
    return this.parseTunnelId(result.stdout);
  }

  async listTunnels(): Promise<Tunnel[]> {
    const result = await executor.run('cloudflared tunnel list --output json');
    return JSON.parse(result.stdout);
  }

  async deleteTunnel(id: string): Promise<void> {
    await executor.run(`cloudflared tunnel delete ${id}`);
  }

  async writeConfig(tunnelId: string, routes: TunnelRoute[]): Promise<void> {
    const config = buildYamlConfig(tunnelId, routes);
    await writeFile('/etc/cloudflared/config.yml', config);
  }

  async reloadDaemon(): Promise<void> {
    await executor.run('systemctl reload cloudflared');
  }

  async getTunnelStatus(): Promise<'active' | 'inactive' | 'error'> {
    const result = await executor.run('systemctl is-active cloudflared');
    return result.stdout.trim() as any;
  }

  async createCloudflareDnsRecord(
    zoneId: string,
    tunnelId: string,
    hostname: string,
    apiToken: string
  ): Promise<void> {
    // CF API: create CNAME record pointing to {tunnelId}.cfargotunnel.com
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CNAME',
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
        proxied: true
      })
    });
  }
}
```

### Local-Only Mode (no Cloudflare)

If Cloudflare tunnel is not configured, the panel is accessible at:
- `https://SERVER_LOCAL_IP:8443`
- `https://localhost:8443`

Self-signed certificate is generated on first boot for HTTPS.

---

## 10. Security Architecture

### 10.1 Command Execution Safety

All shell commands run via a typed executor, never raw `exec(userInput)`:

```typescript
// services/executor.ts
import { execa } from 'execa';

const ALLOWED_COMMANDS = new Set([
  'useradd', 'userdel', 'passwd', 'chown', 'chmod',
  'nginx', 'apache2ctl', 'php-fpm8.2', 'systemctl',
  'certbot', 'cloudflared', 'rndc', 'mysqladmin',
  // ... strict allowlist
]);

export async function executor(cmd: string, args: string[]): Promise<ExecResult> {
  if (!ALLOWED_COMMANDS.has(cmd)) {
    throw new Error(`Command not allowed: ${cmd}`);
  }
  // Sanitize all args (no shell metacharacters)
  const safeArgs = args.map(arg => sanitizeArg(arg));
  return execa(cmd, safeArgs, { reject: false });
}
```

### 10.2 Sudoers Configuration

```
# /etc/sudoers.d/serverforge
serverforge ALL=(ALL) NOPASSWD: /usr/sbin/useradd, /usr/sbin/userdel, \
  /usr/bin/passwd, /usr/bin/chown, /usr/bin/chmod, \
  /usr/sbin/nginx, /usr/sbin/apache2ctl, \
  /bin/systemctl restart nginx, /bin/systemctl restart apache2, \
  /usr/bin/certbot, /usr/bin/cloudflared, \
  /usr/sbin/rndc reload
```

### 10.3 Rate Limiting

```typescript
// Via @fastify/rate-limit
fastify.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
  // Stricter limits for auth routes
});

// Auth endpoints: 5 attempts / 15 min
fastify.register(rateLimit, { routeConfig: { rateLimit: { max: 5, timeWindow: '15 minutes' } } });
```

### 10.4 Encryption

- **Passwords:** Argon2id via `@node-rs/argon2`
- **Sensitive config (API tokens, DKIM keys):** AES-256-GCM, key stored in env `SF_ENCRYPTION_KEY`
- **API tokens:** `sf_` prefix + 32-byte random hex, stored as SHA256 hash
- **DB connection:** SQLite WAL mode, file permissions `600`, owned by `serverforge` user

### 10.5 Content Security

- All uploaded file types validated (whitelist MIME types)
- File manager paths jailed to subscription home directory
- XSS prevented by `@fastify/helmet` headers
- CSRF protection via `@fastify/csrf-protection`
- HTTP headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`

### 10.6 Authentication Security

- Session tokens: 32-byte random, stored as-is in secure HTTP-only cookie
- JWT for API: HS256, 24h expiry
- 2FA: TOTP (RFC 6238), backup codes (8 single-use codes)
- Brute force: Fail2Ban integration + in-app rate limiting
- Login events logged to audit_logs table

---

## 11. Service Management Engine

Each system service has a corresponding service class:

```typescript
// Base interface
interface SystemService {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  reload(): Promise<void>;
  status(): Promise<ServiceStatus>;
  isInstalled(): Promise<boolean>;
}

// Example implementation
export class NginxService implements SystemService {
  async restart() {
    await executor('systemctl', ['restart', 'nginx']);
  }

  async reload() {
    await executor('systemctl', ['reload', 'nginx']);
  }

  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await executor('nginx', ['-t']);
    return { valid: result.exitCode === 0, output: result.stderr };
  }

  async addVhost(domain: Domain): Promise<void> {
    const config = renderTemplate('nginx/vhost.conf.hbs', { domain });
    await writeFile(`/etc/nginx/sites-available/${domain.name}.conf`, config);
    await symlink(
      `/etc/nginx/sites-available/${domain.name}.conf`,
      `/etc/nginx/sites-enabled/${domain.name}.conf`
    );
    await this.testConfig(); // Validate before reload
    await this.reload();
  }

  async removeVhost(domainName: string): Promise<void> {
    await unlink(`/etc/nginx/sites-enabled/${domainName}.conf`);
    await unlink(`/etc/nginx/sites-available/${domainName}.conf`);
    await this.reload();
  }
}
```

---

## 12. Background Job System

Using **BullMQ** with **Valkey** (Redis-compatible):

```typescript
// jobs/queue.ts
import { Queue, Worker } from 'bullmq';

export const Queues = {
  ssl:    new Queue('ssl', { connection }),
  backup: new Queue('backup', { connection }),
  stats:  new Queue('stats', { connection }),
  mail:   new Queue('mail', { connection }),
};

// Repeating jobs registered on startup:
await Queues.ssl.add('renew-check', {}, { repeat: { pattern: '0 3 * * *' } });     // 3am daily
await Queues.stats.add('collect', {}, { repeat: { pattern: '*/30 * * * * *' } });  // every 30s
await Queues.backup.add('scheduled', {}, { repeat: { pattern: '0 2 * * *' } });    // 2am daily
```

**SSL Renew Job:**
```typescript
// jobs/ssl-renew.job.ts
new Worker('ssl', async (job) => {
  const expiringSoon = await db.query.sslCertificates.findMany({
    where: and(
      eq(sslCertificates.autoRenew, true),
      lt(sslCertificates.expiresAt, addDays(new Date(), 30))
    )
  });
  for (const cert of expiringSoon) {
    await certbotService.renew(cert.domain);
  }
}, { connection });
```

---

## 13. Development Phases

### Phase 1 — Core Foundation (Weeks 1–3)
- [ ] Monorepo setup (pnpm workspaces + Turborepo)
- [ ] Fastify server with TypeScript
- [ ] SQLite + Drizzle ORM setup + all migrations
- [ ] Auth module (login, sessions, 2FA, API tokens)
- [ ] React frontend scaffold + routing + layout
- [ ] System executor service with allowlist
- [ ] Installer script (`scripts/install.sh`)
- [ ] Dashboard page with server stats

### Phase 2 — Domain & Web (Weeks 4–6)
- [ ] Domain CRUD + system user creation
- [ ] Nginx vhost generation + reload
- [ ] Apache vhost generation + reload
- [ ] PHP-FPM pool management (multi-version)
- [ ] Subdomain, alias, redirect management
- [ ] Document root file serving verified
- [ ] Domain detail page UI (all tabs)

### Phase 3 — SSL & DNS (Weeks 7–8)
- [ ] BIND9 zone file generation
- [ ] DNS record CRUD (all types)
- [ ] DNS zone import/export
- [ ] Let's Encrypt HTTP-01 integration
- [ ] Custom certificate upload
- [ ] Self-signed cert generation
- [ ] Auto-renew BullMQ job
- [ ] DNS UI + SSL UI pages

### Phase 4 — Mail (Weeks 9–10)
- [ ] Postfix virtual mailbox config generation
- [ ] Dovecot virtual user config
- [ ] Mailbox CRUD
- [ ] Aliases and forwarding
- [ ] DKIM key generation + DNS injection
- [ ] SPF/DMARC record helpers
- [ ] SpamAssassin per-domain settings
- [ ] Mail UI pages

### Phase 5 — Databases & FTP (Weeks 11–12)
- [ ] MariaDB database/user creation via CLI
- [ ] PostgreSQL database/user creation via CLI
- [ ] Database import/export
- [ ] phpMyAdmin SSO link
- [ ] ProFTPd config generation
- [ ] FTP account CRUD
- [ ] Database + FTP UI pages

### Phase 6 — Cloudflare Tunnel (Weeks 13–14)
- [ ] cloudflared installation + auth flow
- [ ] Tunnel creation + route management
- [ ] YAML config generation
- [ ] Cloudflare API DNS record creation
- [ ] Systemd service management
- [ ] Setup wizard UI
- [ ] Tunnel status + routes UI
- [ ] Per-domain tunnel route auto-creation

### Phase 7 — Files, Terminal, Logs (Weeks 15–16)
- [ ] File manager API (browse, upload, download, edit, chmod)
- [ ] File manager UI with drag-and-drop upload
- [ ] CodeMirror text editor integration
- [ ] WebSocket terminal (node-pty + xterm.js)
- [ ] Log tail via WebSocket
- [ ] Cron job management UI

### Phase 8 — Security & Firewall (Week 17)
- [ ] UFW rule management
- [ ] Fail2Ban integration (view jails, unban)
- [ ] Firewall UI
- [ ] Audit log viewer
- [ ] Security headers enforcement

### Phase 9 — Backups (Week 18)
- [ ] Local backup creation (files + DB + DNS)
- [ ] Backup restore
- [ ] S3-compatible remote storage
- [ ] Backup scheduler UI
- [ ] Retention policy enforcement

### Phase 10 — Polish & Testing (Weeks 19–20)
- [ ] Full test suite (unit + integration + e2e)
- [ ] Error handling polish
- [ ] Mobile-responsive UI fixes
- [ ] Installer script final testing on Ubuntu/Debian/AlmaLinux
- [ ] Documentation (README, API docs via Scalar)
- [ ] Docker Compose dev environment

---

## 14. Environment & Config

### `.env` file (at `/etc/serverforge/.env`)

```bash
# Server
NODE_ENV=production
PORT=8443
HOST=0.0.0.0
PANEL_URL=https://panel.example.com

# Database
DB_PATH=/var/lib/serverforge/db.sqlite

# Auth
SESSION_SECRET=<64-char-random-hex>
JWT_SECRET=<64-char-random-hex>
SF_ENCRYPTION_KEY=<32-char-random-hex>

# Redis / Valkey (BullMQ)
REDIS_URL=redis://127.0.0.1:6379

# Admin Bootstrap
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<initial-password>   # cleared after first login

# Paths
VHOSTS_ROOT=/var/www/vhosts
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
APACHE_SITES_AVAILABLE=/etc/apache2/sites-available
BIND_ZONES_DIR=/etc/bind/zones
PHP_FPM_POOL_DIR=/etc/php/{version}/fpm/pool.d
CLOUDFLARED_CONFIG=/etc/cloudflared/config.yml
BACKUP_DIR=/var/backups/serverforge

# Cloudflare (optional)
CF_API_TOKEN=
CF_ACCOUNT_ID=
CF_ZONE_ID=

# Mail
MAIL_HOSTNAME=mail.example.com

# SSL / Let's Encrypt
LE_EMAIL=admin@example.com

# Logs
LOG_LEVEL=info
LOG_DIR=/var/log/serverforge
```

---

## 15. Testing Strategy

### Unit Tests (Vitest)
```
- Executor allowlist validation
- Path traversal detection in file manager
- DNS record validation
- Config template rendering
- Password hashing + verification
- API response envelope formatting
```

### Integration Tests (Vitest + testcontainers)
```
- Auth flow: login → session → protected route
- Domain creation → vhost file written
- Database creation → MariaDB user created
- SSL certificate DB record written
- Tunnel config YAML generated correctly
```

### E2E Tests (Playwright)
```
- Login flow
- Add domain → verify vhost active
- Issue SSL → verify HTTPS works
- Add mailbox → verify Dovecot user
- Add DNS record → verify BIND zone
- File upload via file manager
```

### Test File Layout
```
apps/api/src/__tests__/
  unit/
    executor.test.ts
    file-manager.test.ts
    template-engine.test.ts
  integration/
    auth.test.ts
    domains.test.ts
    ssl.test.ts
apps/web/src/__tests__/
  e2e/
    login.spec.ts
    domains.spec.ts
```

---

## 16. Deployment

### Installer Script Summary (`scripts/install.sh`)

```bash
#!/bin/bash
set -euo pipefail

echo "==> Installing ServerForge Panel"

# 1. System deps
apt-get update
apt-get install -y curl wget gnupg2 software-properties-common

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install pnpm
npm install -g pnpm pm2

# 4. Install Valkey (Redis-compatible)
apt-get install -y valkey

# 5. Install web servers
apt-get install -y nginx apache2

# 6. Install PHP (multi-version via ondrej/php)
add-apt-repository ppa:ondrej/php -y
apt-get install -y php8.1-fpm php8.2-fpm php8.3-fpm php8.4-fpm

# 7. Install MariaDB
apt-get install -y mariadb-server

# 8. Install PostgreSQL
apt-get install -y postgresql postgresql-contrib

# 9. Install mail stack
apt-get install -y postfix dovecot-core dovecot-imapd spamassassin

# 10. Install BIND9
apt-get install -y bind9 bind9utils

# 11. Install ProFTPd
apt-get install -y proftpd-basic

# 12. Install security tools
apt-get install -y ufw fail2ban certbot python3-certbot-nginx

# 13. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb

# 14. Setup ServerForge user
useradd -r -s /usr/sbin/nologin serverforge
mkdir -p /var/lib/serverforge /var/log/serverforge /var/backups/serverforge
chown serverforge: /var/lib/serverforge /var/log/serverforge

# 15. Install panel
cp -r . /opt/serverforge
cd /opt/serverforge
pnpm install --frozen-lockfile
pnpm build

# 16. Install sudoers
cp configs/sudoers.d/serverforge /etc/sudoers.d/serverforge
chmod 440 /etc/sudoers.d/serverforge

# 17. Start panel via PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "==> ServerForge installed! Access at https://$(hostname -I | awk '{print $1}'):8443"
```

### PM2 Config (`ecosystem.config.js`)
```javascript
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
```

### Docker Compose (Dev)
```yaml
version: '3.9'
services:
  app:
    build: .
    ports: ['8443:8443']
    volumes:
      - ./:/app
      - db:/var/lib/serverforge
    environment:
      - NODE_ENV=development

  valkey:
    image: valkey/valkey:7
    ports: ['6379:6379']

  mailhog:
    image: mailhog/mailhog
    ports: ['1025:1025', '8025:8025']

volumes:
  db:
```

---

## 17. AI Agent Implementation Notes

> This section provides specific guidance for AI coding agents implementing this project.

### Order of Implementation
```
1. Scaffold monorepo with pnpm + turborepo
2. Setup Fastify + TypeScript + Drizzle
3. Run all migrations to create DB
4. Implement Auth module end-to-end (most other modules depend on it)
5. Implement Executor service (all system modules depend on it)
6. Implement Stats module (Dashboard needs it first)
7. Implement Domain module (all other modules reference domainId)
8. Implement remaining modules in order: WebServer → SSL → DNS → Mail → DB → FTP → Tunnel → Files → Terminal → Cron → Firewall → Backup → Logs
9. Implement Frontend pages after their corresponding API modules
```

### Critical Patterns to Follow

**1. Always validate paths before file system operations:**
```typescript
// NEVER: fs.readFile(userInput)
// ALWAYS:
const safe = safePath(subscription.homeDir, req.body.path);
await fs.readFile(safe);
```

**2. Always test configs before reloading services:**
```typescript
const test = await nginxService.testConfig();
if (!test.valid) throw new Error(`Invalid nginx config: ${test.output}`);
await nginxService.reload();
```

**3. Always wrap system operations in try/catch with cleanup:**
```typescript
try {
  await createSystemUser(username);
  await createDirectories(homeDir);
  await writeNginxVhost(domain);
  await db.insert(domains).values(domainRecord);
  await nginxService.reload();
} catch (error) {
  // Rollback: remove partial state
  await executor('userdel', ['-r', username]).catch(() => {});
  await rm(homeDir, { recursive: true, force: true }).catch(() => {});
  await unlink(nginxVhostPath).catch(() => {});
  throw error;
}
```

**4. Use typed Zod schemas for all API input:**
```typescript
const createDomainSchema = z.object({
  name: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, 'Invalid domain name'),
  subscriptionId: z.string().nanoid(),
  phpVersion: z.enum(['8.1', '8.2', '8.3', '8.4']).default('8.2'),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).default('nginx+apache'),
});
```

**5. Emit events for audit log on every mutating operation:**
```typescript
fastify.addHook('onSend', async (req, reply) => {
  if (req.method !== 'GET' && reply.statusCode < 400) {
    await auditService.log({ userId: req.user.id, action: req.routeOptions.config?.auditAction, ... });
  }
});
```

### Config File Locations Reference

| Service | Config Directory |
|---|---|
| Nginx vhosts | `/etc/nginx/sites-available/`, `/etc/nginx/sites-enabled/` |
| Apache vhosts | `/etc/apache2/sites-available/`, `/etc/apache2/sites-enabled/` |
| PHP-FPM pools | `/etc/php/{version}/fpm/pool.d/` |
| BIND zones | `/etc/bind/zones/` + `named.conf.local` |
| Postfix | `/etc/postfix/main.cf`, `/etc/postfix/virtual` |
| Dovecot | `/etc/dovecot/conf.d/` |
| ProFTPd | `/etc/proftpd/proftpd.conf` |
| Cloudflared | `/etc/cloudflared/config.yml` |
| Panel itself | `/opt/serverforge/` |
| Panel DB | `/var/lib/serverforge/db.sqlite` |
| Panel logs | `/var/log/serverforge/` |
| Domain files | `/var/www/vhosts/{systemUser}/{domain}/` |
| SSL certs (LE) | `/etc/letsencrypt/live/{domain}/` |

---

*End of ServerForge AI Coding Agent Plan — v1.0*
*Generated for AI-assisted implementation. Follow each phase sequentially for best results.*