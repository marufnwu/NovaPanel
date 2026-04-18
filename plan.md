# Server Management Panel — Full Project Plan

> **Core Philosophy:** Everything is managed from within the panel. No external dashboard interaction, no manual SSH commands, no manual config editing. The panel is the single source of truth for every server, site, tunnel, domain, process, and secret.

> **Version:** 2.0 | **Updated:** April 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Design Principles](#2-design-principles)
3. [System Architecture](#3-system-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Core Abstractions](#5-core-abstractions)
6. [Phase 1 — Foundation & Server Connectivity](#6-phase-1--foundation--server-connectivity)
7. [Phase 2 — Cloudflare: Tunnels, DNS & SSL (First-Class)](#7-phase-2--cloudflare-tunnels-dns--ssl-first-class)
8. [Phase 3 — Application Stack Support](#8-phase-3--application-stack-support)
9. [Phase 4 — Automated Site Provisioning](#9-phase-4--automated-site-provisioning)
10. [Phase 5 — Monitoring, Logs & Alerts](#10-phase-5--monitoring-logs--alerts)
11. [Phase 6 — Security & Access Control](#11-phase-6--security--access-control)
12. [Automated Provisioning Flow (End-to-End)](#12-automated-provisioning-flow-end-to-end)
13. [Service Driver Architecture](#13-service-driver-architecture)
14. [Job Queue Strategy](#14-job-queue-strategy)
15. [Folder Structure](#15-folder-structure)
16. [API Design](#16-api-design)
17. [Database Schema](#17-database-schema)
18. [Deployment Strategy](#18-deployment-strategy)
19. [Future Scalability Hooks](#19-future-scalability-hooks)
20. [Milestone Roadmap](#20-milestone-roadmap)

---

## 1. Project Overview

**Panel Name:** `NovaDash` *(rename freely)*

NovaDash is a self-hosted server management panel that gives you complete control over your infrastructure from a single browser tab. It is built to manage:

- **Multiple servers** — local machines, VPS, remote bare metal, all in one place
- **Multiple application stacks** — Node.js, Laravel (PHP), Python, static sites, Docker
- **Multiple domains and subdomains** — DNS records, routing rules, all auto-managed
- **Cloudflare Tunnel** — installed, configured, and maintained by the panel itself with zero manual interaction
- **All processes** — PM2, Supervisor, PHP-FPM, systemd services, managed from the UI
- **All secrets** — `.env` files, API keys, SSH keys, stored encrypted and injected automatically

**What you never need to do manually:**
- Touch the Cloudflare dashboard
- SSH into a server to run a command
- Edit a config file directly
- Manually create DNS records
- Manually restart a process after a deploy

---

## 2. Design Principles

These principles govern every architectural and feature decision:

| Principle | Meaning in practice |
|---|---|
| **Panel-owned everything** | Every config file, process, tunnel, and DNS record is created and managed by the panel, never manually |
| **Zero external interaction** | The Cloudflare dashboard, server terminal, and any other external tool should never be needed after initial panel setup |
| **Driver-based stack support** | Each application stack (Node, Laravel, Python) is a swappable driver — adding a new stack never touches core logic |
| **Async-first operations** | Any task taking more than 2 seconds runs in a job queue with real-time status feedback in the UI |
| **Encrypted at rest, always** | SSH keys, `.env` values, API tokens — AES-256 encrypted in DB, never exposed in plaintext |
| **Graceful degradation** | Cloudflare features are additive — panel works fully for SSH-accessible servers without CF integration |
| **Idempotent operations** | Every provisioning action can be safely re-run (re-deploy, re-install tunnel, re-generate Nginx config) |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (UI)                              │
│                  Next.js Frontend — NovaDash                     │
│   Dashboard │ Servers │ Sites │ Tunnels │ DNS │ Terminal │ Logs  │
└─────────────────────────┬────────────────────────────────────────┘
                          │  HTTPS + WebSocket (WSS)
┌─────────────────────────▼────────────────────────────────────────┐
│                     Panel Backend (API Server)                   │
│                     Node.js + Fastify                            │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │  REST API   │  │  WebSocket   │  │     BullMQ Job Queue   │   │
│  │  /api/v1/   │  │  /ws/        │  │  (async heavy tasks)   │   │
│  └─────────────┘  └──────────────┘  └────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   Service Layer                          │    │
│  │  SSH │ Nginx │ PM2 │ Supervisor │ Cloudflare │ Metrics   │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────┬──────────────────────┬──────────────────────────────────┘
         │                      │
         ▼                      ▼
   PostgreSQL              Redis
   (all config,            (sessions, job queue,
    metadata,               real-time pub/sub,
    audit logs,             metrics cache)
    encrypted secrets)
         │
         │  SSH (ssh2)
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Managed Server(s)                           │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  cloudflared│  │    Nginx    │  │  PM2 / Supervisor / FPM  │  │
│  │  (tunnel)   │  │  (reverse   │  │  (process management)    │  │
│  │             │  │   proxy)    │  │                          │  │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘  │
│                                                                  │
│  App 1: Node.js :3000  App 2: Laravel :8000  App 3: Python :5000 │
└──────────────────────────────────────────────────────────────────┘
         │
         │  outbound post-quantum encrypted tunnel
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare Network                            │
│   CDN │ WAF │ DDoS Protection │ DNS │ Tunnel Routing             │
│                                                                  │
│   app.example.com  ──► tunnel ──► server:3000                    │
│   api.example.com  ──► tunnel ──► server:5000                    │ 
│   blog.example.com ──► tunnel ──► server:8000                    │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
   Public Internet Users
```

**Two server connectivity modes — both fully panel-managed:**

```
Mode A: Local Server (no public IP)
  Panel ──SSH──► Local Server
  Local Server ──cloudflared tunnel──► Cloudflare ──► Internet

Mode B: Remote VPS (has public IP)
  Panel ──SSH──► Remote VPS
  Remote VPS ──cloudflared tunnel──► Cloudflare ──► Internet
  (or direct Nginx + Certbot SSL without tunnel)
```

---

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) | SSR, fast UI — frontend only (all API calls go to Fastify backend) |
| UI Components | shadcn/ui + Tailwind CSS | Accessible, themeable, no bloat |
| Backend API | Node.js + Fastify | Fast, low overhead, excellent plugin ecosystem |
| ORM | Prisma | Type-safe DB access, easy migrations |
| Database | PostgreSQL | Relational integrity, JSONB for flexible config storage |
| Cache + Queue | Redis + BullMQ | Session store, job queue, real-time pub/sub |
| SSH | `ssh2` (node) | Persistent SSH connections, command execution, SFTP |
| Web Terminal | Xterm.js + WebSocket | Full browser SSH terminal |
| Auth | JWT (access + refresh) + bcrypt | Stateless, scalable |
| Cloudflare SDK | Cloudflare API v4 (REST) | Tunnel CRUD, DNS management, zone settings |
| Process Manager | PM2 programmatic API | Node.js process lifecycle |
| Supervisor control | `supervisorctl` via SSH | Python / Laravel queue processes |
| Reverse Proxy | Nginx (template engine) | Auto-generated server blocks per site |
| Encryption | Node.js `crypto` AES-256-GCM | All secrets at rest |
| Containerization | Docker + Docker Compose | Panel itself runs in Docker |

---

## 5. Core Abstractions

Before diving into phases, these are the four core entities everything builds on:

### 5.1 Server
A machine the panel manages. Has a connection method (SSH key), a type (local/remote), and an optional assigned Cloudflare tunnel.

### 5.2 Site
An application running on a server. Has a stack type, a domain, a local port, a process definition, and an Nginx config. Creating a site triggers the full automated provisioning flow.

### 5.3 Tunnel
A `cloudflared` instance running on a server. Has a Cloudflare tunnel ID, a config file on the server, and a list of ingress routes (hostname → local service). Fully managed by the panel.

### 5.4 Domain / Zone
A domain registered in Cloudflare. The panel syncs DNS records from the CF API, and auto-creates/deletes records as sites and tunnels are added or removed.

---

## 6. Phase 1 — Foundation & Server Connectivity

**Goal:** Panel runs, connects to servers, reads metrics, offers a terminal. No external tools needed from this point on.

### 6.1 Panel Bootstrap
- [ ] First-run setup wizard (admin account creation, panel URL, SMTP optional)
- [ ] Docker Compose startup: panel + PostgreSQL + Redis in one command
- [ ] Panel itself exposed via its own Cloudflare Tunnel (bootstrapped via a one-time CLI setup — after this, all tunnel management is in-UI)
- [ ] Health check endpoint (`/api/health`)

### 6.2 Authentication
- [ ] Email + password login
- [ ] JWT access token (15 min) + refresh token (30 days) stored in httpOnly cookie
- [ ] Redis-backed session blacklist (instant logout/revoke)
- [ ] First registered user auto-assigned `admin` role
- [ ] 2FA via TOTP (authenticator app) — optional but available from day 1

### 6.3 Server Management
- [ ] Add server: name, hostname/IP, SSH port, username, auth (SSH key or password)
- [ ] SSH key: generate new keypair in panel, or paste existing — stored AES-256 encrypted
- [ ] Test SSH connection button with live feedback
- [ ] Server list with live status badges (online / offline / degraded)
- [ ] Server detail page: overview, sites list, processes, metrics, terminal
- [ ] Server tags (e.g. `production`, `staging`, `local`) for organization
- [ ] Soft-delete servers (keeps historical data)

### 6.4 System Metrics
- [ ] Real-time CPU usage (per core + aggregate)
- [ ] RAM (total / used / free / cached)
- [ ] Disk usage per partition
- [ ] Network I/O (bytes in/out per interface)
- [ ] System uptime + load average (1m, 5m, 15m)
- [ ] Data streamed via WebSocket, polled every 10s, cached in Redis
- [ ] 24h historical sparklines (stored in PostgreSQL, sampled every 5 min)

### 6.5 Web Terminal
- [ ] Full Xterm.js terminal per server
- [ ] WebSocket-backed SSH session
- [ ] Multiple concurrent terminal tabs
- [ ] Terminal session tied to auth — closes on logout
- [ ] Copy/paste, resize, color support

### 6.6 File Manager (Basic)
- [ ] Browse server filesystem via SFTP
- [ ] Upload files to server from browser
- [ ] Download files from server
- [ ] Edit text files (`.env`, configs) inline with a code editor (CodeMirror)
- [ ] Create / rename / delete files and directories

---

## 7. Phase 2 — Cloudflare: Tunnels, DNS & SSL (First-Class)

**Goal:** Complete Cloudflare management with zero need to visit the Cloudflare dashboard ever again. Tunnel is a core feature, not an add-on.

### 7.1 Cloudflare Account Integration
- [ ] Connect Cloudflare account via API Token (stored encrypted)
- [ ] Auto-detect and list all zones (domains) the token has access to
- [ ] Sync DNS records from Cloudflare into panel DB (cached, refreshable)
- [ ] Show zone health (SSL mode, proxy status, plan type)
- [ ] Support multiple CF accounts / API tokens

### 7.2 `cloudflared` Lifecycle Management
The panel owns `cloudflared` fully on every managed server:

- [ ] **Detect** — check if `cloudflared` is installed on the server
- [ ] **Install** — auto-download correct binary for server OS/arch, set permissions, register as systemd service
- [ ] **Authenticate** — use CF API token to authenticate `cloudflared` (no browser OAuth needed)
- [ ] **Create tunnel** — call CF API to create named tunnel, store `credentials.json` on server (via SFTP)
- [ ] **Status** — show live tunnel status: connected datacenters, latency, uptime
- [ ] **Update** — upgrade `cloudflared` binary from panel
- [ ] **Uninstall** — remove service, credentials, and delete tunnel from CF API

### 7.3 Tunnel Ingress Route Management
- [ ] View all hostname → service mappings for a tunnel
- [ ] Add route: pick domain/subdomain + local service (host:port or unix socket)
- [ ] Edit / delete routes
- [ ] Reorder routes (order matters in `config.yml` — catch-all goes last)
- [ ] Panel auto-writes `config.yml` to server via SFTP and reloads `cloudflared`
- [ ] Support all protocols: `http`, `https`, `tcp`, `ssh`, `rdp`, `unix`
- [ ] Wildcard subdomain routing support

### 7.4 Automated DNS Management
When a tunnel route is added (e.g. `app.example.com → localhost:3000`):
- [ ] Panel auto-creates a CNAME DNS record pointing to the tunnel hostname (`<tunnel-id>.cfargotunnel.com`) in Cloudflare
- [ ] Proxy (orange cloud) enabled automatically
- [ ] When route is deleted — DNS record is deleted automatically
- [ ] Manual DNS record management also available (A, CNAME, MX, TXT, SRV records)
- [ ] TTL control, proxy toggle, import/export DNS records

### 7.5 SSL / HTTPS (Fully Automated)
- [ ] For tunneled sites: SSL mode set to `Full (Strict)` via CF API automatically on site creation
- [ ] For VPS sites with public IP: Certbot Let's Encrypt integration (cert obtained and renewed by panel)
- [ ] SSL certificate status per site (valid / expiring / expired)
- [ ] Auto-renewal 30 days before expiry (via BullMQ scheduled job)
- [ ] HSTS settings configurable per zone from panel

### 7.6 Cloudflare Security Settings (Per Zone / Per Site)
- [ ] WAF mode: Off / On / Attack mode — toggle from panel
- [ ] Bot Fight Mode toggle
- [ ] Browser Integrity Check toggle
- [ ] IP Access Rules (allow/deny IPs or countries) — manage from panel
- [ ] Rate limiting rules (basic) — create from panel

---

## 8. Phase 3 — Application Stack Support

**Goal:** Deploy and fully manage applications of any supported stack without touching the server manually.

### 8.1 Stack Driver Interface

Every stack implements the same driver interface internally:

```typescript
interface StackDriver {
  install(site): Promise<void>      // install runtime, dependencies
  configure(site): Promise<void>    // generate Nginx config, process config
  start(site): Promise<void>        // start the process
  stop(site): Promise<void>         // stop the process
  restart(site): Promise<void>      // restart the process
  reload(site): Promise<void>       // zero-downtime reload where supported
  getLogs(site): AsyncIterable      // return log stream
  getStatus(site): Promise<Status>  // running / stopped / error
  deploy(site): Promise<void>       // pull latest, install deps, migrate, restart
  uninstall(site): Promise<void>    // clean removal of all site resources
}
```

This means adding a new stack (e.g. Go, Ruby) only requires writing a new driver — zero changes to core panel logic.

### 8.2 Node.js Stack
- [ ] PM2 process management (start, stop, restart, reload, delete)
- [ ] Cluster mode support (multi-core)
- [ ] `npm install` / `yarn install` / `pnpm install` triggered from panel
- [ ] Build step support (`npm run build`) before restart
- [ ] PM2 ecosystem file auto-generated by panel
- [ ] Environment variable injection via PM2 env config (never written to disk as plaintext)
- [ ] PM2 startup script generation (survives server reboot)
- [ ] Live log streaming (stdout + stderr)
- [ ] Port auto-assignment with conflict detection

### 8.3 Laravel (PHP) Stack
- [ ] PHP version selection (7.4, 8.0, 8.1, 8.2, 8.3) via PHP-FPM pools
- [ ] PHP-FPM pool auto-configured per site (isolated user, socket)
- [ ] Artisan command runner UI (dropdown of common commands + custom input)
- [ ] `composer install` / `composer update` from panel
- [ ] `.env` file managed in panel (encrypted storage, injected on deploy)
- [ ] Laravel Scheduler: auto-add cron entry via `crontab` management
- [ ] Queue Worker: managed via Supervisor (auto-generates `supervisord.conf`)
- [ ] Laravel Octane support (Swoole/RoadRunner process via Supervisor)
- [ ] Storage link, cache clear, config cache from panel buttons
- [ ] Migration runner with output display

### 8.4 Python Stack
- [ ] Virtual environment creation and management (`venv` / `virtualenv`)
- [ ] `pip install -r requirements.txt` from panel
- [ ] WSGI apps: Gunicorn with auto-generated config via Supervisor
- [ ] ASGI apps: Uvicorn with auto-generated config via Supervisor
- [ ] FastAPI / Django / Flask detection for sensible defaults
- [ ] Environment variable injection via Supervisor config
- [ ] Live log streaming via Supervisor
- [ ] Restart / reload from panel

### 8.5 Static Sites
- [ ] Serve from a directory via Nginx `root`
- [ ] SPA mode: `try_files` fallback to `index.html` for client-side routing
- [ ] File upload from browser directly to site root
- [ ] Optional: Git pull deploy (pull latest, no build step)
- [ ] Cache headers management (per file type)

### 8.6 Docker / Docker Compose Stack
- [ ] Detect Docker on server
- [ ] View running containers per server
- [ ] Start / stop / restart containers from panel
- [ ] View container logs
- [ ] `docker-compose up/down/pull` from panel
- [ ] Port mapping visible in panel (auto-configure Nginx to proxy to container port)

### 8.7 Nginx Config Engine
- [ ] Template-based config generation per stack type
- [ ] Templates: `proxy_pass` (Node/Python), `fastcgi_pass` (PHP), `root` (static)
- [ ] Custom headers, cache rules, gzip, rate limiting — configurable from UI
- [ ] Raw config editor (advanced mode) with syntax highlighting
- [ ] `nginx -t` validation before apply — deploy blocked if config is invalid
- [ ] Nginx reload after every change (graceful, zero-downtime)
- [ ] Per-site Nginx config stored in panel DB (source of truth)

### 8.8 Cron / Scheduler Manager
- [ ] View all cron jobs on a server
- [ ] Add / edit / delete cron entries from panel
- [ ] Test run a cron command immediately
- [ ] Cron expression builder UI
- [ ] Last run time and output log

### 8.9 Database Manager
- [ ] Support: MySQL / MariaDB, PostgreSQL, SQLite
- [ ] Create and drop databases
- [ ] Create users, assign privileges
- [ ] Connection string auto-generated for `.env` injection
- [ ] Simple SQL query runner
- [ ] Backup: trigger `mysqldump` / `pg_dump` and download from panel
- [ ] Database size and table list view

---

## 9. Phase 4 — Automated Site Provisioning

**Goal:** Creating a new site triggers a fully automated, zero-touch provisioning pipeline.

### 9.1 New Site Form (What You Fill In)
```
Site Name:        My Blog
Server:           [dropdown — select server]
Stack:            Laravel
Domain:           blog.example.com
Local Port:       8000  (auto-suggested, conflict-checked)
PHP Version:      8.2
Git Repo:         https://github.com/user/blog (optional)
Environment Vars: [key-value editor]
```

### 9.2 What the Panel Does Automatically

> **Note:** The steps below show a Laravel example, but all steps are generated dynamically by the active `StackDriver` (see §8.1). Each driver defines its own `install()`, `configure()`, `start()`, and `deploy()` sequences.

```
Step 1 — Pre-flight checks
  ✓ Port 8000 not in use on server
  ✓ blog.example.com not already configured
  ✓ CF zone for example.com is connected
  ✓ Tunnel exists on target server

Step 2 — Application setup
  ✓ Create directory /var/www/blog
  ✓ Set correct file ownership and permissions
  ✓ If Git repo provided: git clone into directory
  ✓ composer install
  ✓ Inject .env file (from panel's encrypted store)
  ✓ php artisan key:generate
  ✓ php artisan migrate --force
  ✓ php artisan storage:link

Step 3 — Process management
  ✓ Generate PHP-FPM pool config → write to server → reload PHP-FPM
  ✓ Generate Supervisor config for queue worker → write → supervisorctl reread + update
  ✓ Add Laravel cron entry to crontab

Step 4 — Reverse proxy
  ✓ Generate Nginx server block for blog.example.com
  ✓ Write to /etc/nginx/sites-available/blog.example.com
  ✓ Symlink to sites-enabled
  ✓ nginx -t (abort if fails)
  ✓ nginx -s reload

Step 5 — Cloudflare
  ✓ Add ingress route to tunnel config: blog.example.com → http://localhost:8000
  ✓ Write updated config.yml to server via SFTP
  ✓ Reload cloudflared service
  ✓ Call CF API: create CNAME record blog → <tunnel-id>.cfargotunnel.com
  ✓ Call CF API: set SSL mode to Full Strict for example.com

Step 6 — Verification
  ✓ HTTP health check: GET https://blog.example.com (retry 5x, 10s apart)
  ✓ Mark site as "live" in panel DB
  ✓ Send notification (if configured)

Total time: ~60–90 seconds. Zero manual steps.
```

### 9.3 Job Queue Feedback
All provisioning steps run in BullMQ. The UI shows a real-time step-by-step progress panel with:
- Each step name and status (pending / running / done / failed)
- Live log output per step
- Ability to retry from the failed step
- Full provision log saved to DB for audit

---

## 10. Phase 5 — Monitoring, Logs & Alerts

**Goal:** Full observability across all servers and sites from the panel.

### 10.1 Real-Time Log Viewer
- [ ] Stream logs via WebSocket for: PM2 apps, Nginx access/error, PHP-FPM, Supervisor workers, `cloudflared`, systemd services
- [ ] Log level filtering (error / warn / info / debug)
- [ ] Text search within streamed logs
- [ ] Pause/resume streaming
- [ ] Download full log file
- [ ] Log rotation config per service from panel

### 10.2 Process Monitor
- [ ] All PM2 processes: status, CPU%, memory, restarts, uptime
- [ ] All Supervisor programs: status, PID, uptime
- [ ] All PHP-FPM pools: active workers, idle workers, request rate
- [ ] `cloudflared` status: connected DCs, tunnel age, bytes transferred
- [ ] Kill / restart any process from panel

### 10.3 Uptime Monitor
- [ ] HTTP(S) health checks per site (configurable interval: 1/5/10 min)
- [ ] Response time tracking with historical chart
- [ ] Uptime percentage (last 24h / 7d / 30d)
- [ ] Status page (public-facing, optional — shareable link)
- [ ] Incident log with start/end time and duration

### 10.4 Alerts & Notifications
- [ ] Alert rules: CPU > X%, RAM > X%, disk > X%, site down, process crashed
- [ ] Notification channels: Email (SMTP), webhook (Slack/Discord compatible), Telegram
- [ ] Alert cooldown period (no spam — e.g. max 1 alert per 15 min per rule)
- [ ] Alert history log with resolve status
- [ ] "Alert me when deploy fails" per site toggle

### 10.5 Metrics History
- [ ] CPU, RAM, disk, network stored every 5 minutes
- [ ] Retention: 7 days full resolution, 30 days hourly aggregates, 1 year daily aggregates
- [ ] Charts: line graphs with zoom, time range selector
- [ ] Per-server and per-site breakdown

---

## 11. Phase 6 — Security & Access Control

**Goal:** Safe to give team members access. Everything auditable. Servers hardened by default.

### 11.1 Role-Based Access Control (RBAC)

| Role | Capabilities |
|---|---|
| `admin` | Full access — servers, sites, CF, panel settings, users |
| `developer` | Manage assigned servers and sites — deploy, restart, view logs |
| `viewer` | Read-only — metrics, logs, site status. No actions |

- [ ] Assign users to specific servers (not all servers by default)
- [ ] Assign users to specific sites
- [ ] Permission override per user per resource

### 11.2 Audit Log
- [ ] Every action logged: user, action, target, timestamp, IP address
- [ ] Actions include: site created, site deployed, server added, DNS record changed, tunnel route added, user logged in, `.env` accessed
- [ ] Searchable, filterable audit log UI
- [ ] Export audit log as CSV

### 11.3 SSH Key Management
- [ ] Generate SSH keypair in panel (RSA 4096 or Ed25519)
- [ ] Private key stored AES-256-GCM encrypted
- [ ] Public key auto-pushed to server's `authorized_keys` on server creation
- [ ] Rotate keys: generate new pair, push to server, revoke old key — all from panel
- [ ] View fingerprint only (never expose private key in UI)

### 11.4 Secret / Environment Variable Management
- [ ] Per-site `.env` key-value store (AES-256-GCM encrypted, per-key IV)
- [ ] Secret values masked in UI by default (click to reveal)
- [ ] Secret version history (last 5 versions per key, with timestamp)
- [ ] Rollback to previous `.env` version from panel
- [ ] Secrets injected at deploy time — never written to disk unencrypted
- [ ] Bulk import `.env` file (paste raw `.env` content, panel parses and encrypts)

### 11.5 Firewall Manager
- [ ] View UFW status and rules on any managed server
- [ ] Add / delete rules from panel
- [ ] Quick presets: allow HTTP/HTTPS, allow SSH from panel IP only, deny all inbound
- [ ] Since sites use Cloudflare Tunnel, panel can enforce "deny all inbound except SSH" — no ports 80/443 needed publicly
- [ ] Cloudflare IP range whitelisting for direct-access VPS setups

### 11.6 Panel Security Hardening
- [ ] Rate limiting on login endpoint (5 attempts → 15-min lockout)
- [ ] IP allowlist for panel access (optional)
- [ ] All panel traffic over HTTPS (via its own Cloudflare Tunnel)
- [ ] Automatic session expiry
- [ ] Security headers (HSTS, CSP, X-Frame-Options) on panel itself

---

## 12. Automated Provisioning Flow (End-to-End)

```
User Action                     Panel Action (automated)
───────────────────────────────────────────────────────────────────

[Add Server]
  Enter: hostname, SSH key      → Test SSH connection
                                → Detect OS, available runtimes
                                → Install/update cloudflared if needed
                                → Register server in DB
                                → Begin metric polling

[Connect Cloudflare Account]
  Enter: API token              → Fetch and cache all zones + DNS records
                                → Map zones to servers (by domain match)

[Create Tunnel]
  Pick: server, tunnel name     → Call CF API: create tunnel
                                → Write credentials.json to server via SFTP
                                → Generate base config.yml
                                → Register cloudflared as systemd service
                                → Start service
                                → Confirm tunnel is connected (poll CF API)

[Add New Site]
  Fill: domain, stack, port     → Full 6-step provisioning pipeline (see §9.2)
  ↓ ~90 seconds later
  Site is live at https://domain.com — zero manual steps

[Deploy Site]
  Click: Deploy button          → git pull (if git configured)
                                → install dependencies
                                → run build step
                                → run migrations (if applicable)
                                → restart/reload process (zero-downtime if supported)
                                → health check
                                → mark deploy as success/failed in deploy history

[Add DNS Record]
  Fill: type, name, value       → Call CF API immediately
                                → Sync record back into panel DB
                                → Show in panel DNS table

[Delete Site]
  Click: Delete                 → Stop and remove process (PM2/Supervisor)
                                → Remove PHP-FPM pool (if PHP)
                                → Remove Nginx config + symlink + reload
                                → Remove tunnel ingress route → reload cloudflared
                                → Delete CNAME record via CF API
                                → Remove cron entries
                                → Archive site data in DB (soft delete)
```

---

## 13. Service Driver Architecture

The service layer uses a driver pattern so every component is swappable:

```
services/
├── proxy/
│   ├── proxy.interface.ts       # ProxyDriver interface
│   ├── nginx.driver.ts          # Nginx implementation
│   └── caddy.driver.ts          # Future: Caddy implementation
│
├── process/
│   ├── process.interface.ts     # ProcessDriver interface
│   ├── pm2.driver.ts            # PM2 (Node.js)
│   ├── supervisor.driver.ts     # Supervisor (Python, Laravel queues)
│   └── systemd.driver.ts        # Future: systemd services
│
├── stack/
│   ├── stack.interface.ts       # StackDriver interface (see §8.1)
│   ├── nodejs.driver.ts
│   ├── laravel.driver.ts
│   ├── python.driver.ts
│   ├── static.driver.ts
│   └── docker.driver.ts
│
├── tunnel/
│   ├── tunnel.interface.ts
│   └── cloudflared.driver.ts    # Only implementation for now
│
└── dns/
    ├── dns.interface.ts
    └── cloudflare.driver.ts     # Future: Route53, Namecheap, etc.
```

Adding a new stack = write one file implementing `StackDriver`. Nothing else changes.

---

## 14. Job Queue Strategy

All long-running operations go through BullMQ. Never run blocking operations in HTTP request handlers.

| Queue | Jobs | Concurrency |
|---|---|---|
| `provisioning` | Full site setup, server setup | 2 |
| `deploy` | Git pull, install, build, migrate, restart | 3 per server |
| `cloudflare` | API calls (rate-limited) | 1 |
| `metrics` | Server metric polling | 10 |
| `monitoring` | Uptime checks, health pings | 20 |
| `maintenance` | SSL renewal, log rotation, cleanup | 2 |
| `notifications` | Email, webhook, Telegram sends | 5 |

**Job features:**
- Retry with exponential backoff (3 retries by default)
- Job progress events pushed to frontend via Redis pub/sub → WebSocket
- Failed jobs stored with full error context for debugging
- Job history kept for 7 days

---

## 15. Folder Structure

> Monorepo managed via **pnpm workspaces**. Frontend and backend are separate apps that share types via a shared package.

```
novadash/
├── apps/
│   ├── frontend/                          # Next.js app (UI only — no API routes)
│   │   ├── app/
│   │   │   ├── (auth)/                    # Login, Register, 2FA
│   │   │   ├── dashboard/                 # Global overview
│   │   │   ├── servers/
│   │   │   │   └── [id]/
│   │   │   │       ├── overview/          # Metrics + status
│   │   │   │       ├── sites/             # Sites on this server
│   │   │   │       ├── processes/         # PM2 + Supervisor
│   │   │   │       ├── terminal/          # Web SSH terminal
│   │   │   │       ├── files/             # File manager
│   │   │   │       ├── tunnel/            # cloudflared management
│   │   │   │       ├── firewall/          # UFW rules
│   │   │   │       └── databases/         # DB manager
│   │   │   ├── sites/
│   │   │   │   ├── new/                   # New site wizard
│   │   │   │   └── [id]/                  # Site detail: env, logs, deploys
│   │   │   ├── domains/                   # DNS + zone management
│   │   │   ├── monitoring/                # Uptime + alerts
│   │   │   ├── audit/                     # Audit log
│   │   │   └── settings/                  # Panel settings, users, CF tokens
│   │   └── components/
│   │       ├── ui/                        # shadcn/ui base components
│   │       ├── server/
│   │       ├── site/
│   │       ├── terminal/                  # Xterm.js wrapper
│   │       ├── charts/                    # Metrics charts
│   │       └── logs/                      # Log viewer component
│   │
│   └── backend/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── servers.ts
│       │   │   ├── sites.ts
│       │   │   ├── tunnels.ts
│       │   │   ├── domains.ts
│       │   │   ├── processes.ts
│       │   │   ├── databases.ts
│       │   │   ├── monitoring.ts
│       │   │   ├── metrics.ts
│       │   │   ├── files.ts
│       │   │   ├── cron.ts
│       │   │   ├── firewall.ts
│       │   │   ├── ssh-keys.ts
│       │   │   ├── settings.ts
│       │   │   └── audit.ts
│       │   ├── services/
│       │   │   ├── ssh/
│       │   │   │   ├── ssh.service.ts     # Core SSH connection manager
│       │   │   │   └── sftp.service.ts    # File transfer
│       │   │   ├── proxy/
│       │   │   ├── process/
│       │   │   ├── stack/
│       │   │   ├── tunnel/
│       │   │   ├── dns/
│       │   │   ├── metrics.service.ts
│       │   │   └── crypto.service.ts      # AES-256 encrypt/decrypt
│       │   ├── jobs/
│       │   │   ├── queues.ts              # Queue definitions
│       │   │   ├── provisioning.job.ts
│       │   │   ├── deploy.job.ts
│       │   │   ├── cloudflare.job.ts
│       │   │   ├── metrics.job.ts
│       │   │   ├── monitoring.job.ts
│       │   │   └── maintenance.job.ts
│       │   ├── prisma/
│       │   │   └── schema.prisma
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   └── rbac.middleware.ts
│       │   └── utils/
│       └── Dockerfile
│
├── packages/
│   └── shared/                            # Shared TypeScript types between frontend & backend
│       ├── types/
│       └── index.ts
│
├── pnpm-workspace.yaml
├── docker-compose.yml                     # panel + postgres + redis
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

---

## 16. API Design

All endpoints under `/api/v1/` — `Authorization: Bearer <token>`

```
# Auth
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/2fa/setup
POST   /auth/2fa/verify

# Servers
GET    /servers
POST   /servers
GET    /servers/:id
PUT    /servers/:id
DELETE /servers/:id
POST   /servers/:id/test-connection
GET    /servers/:id/metrics
GET    /servers/:id/metrics/history
GET    /servers/:id/processes
POST   /servers/:id/processes/:pid/restart

# Tunnels (per server)
GET    /servers/:id/tunnel
POST   /servers/:id/tunnel                 # create + install
PUT    /servers/:id/tunnel/routes          # update ingress routes
POST   /servers/:id/tunnel/reload
DELETE /servers/:id/tunnel

# Sites
GET    /sites
POST   /sites                              # triggers full provisioning
GET    /sites/:id
PUT    /sites/:id
DELETE /sites/:id
POST   /sites/:id/deploy
POST   /sites/:id/restart
POST   /sites/:id/stop
GET    /sites/:id/logs                     # WebSocket upgrade
GET    /sites/:id/deploys
GET    /sites/:id/env                      # encrypted, masked response
PUT    /sites/:id/env

# Domains & DNS
GET    /domains                            # all CF zones
GET    /domains/:zoneId/records
POST   /domains/:zoneId/records
PUT    /domains/:zoneId/records/:recordId
DELETE /domains/:zoneId/records/:recordId
POST   /domains/:zoneId/sync

# Databases
GET    /servers/:id/databases
POST   /servers/:id/databases
DELETE /servers/:id/databases/:dbId
POST   /servers/:id/databases/:dbId/query
POST   /servers/:id/databases/:dbId/backup  # trigger backup, returns download URL

# Monitoring
GET    /monitoring/sites
GET    /monitoring/sites/:id/history
GET    /alerts
POST   /alerts
DELETE /alerts/:id

# File Manager (per server, via SFTP)
GET    /servers/:id/files?path=/           # browse directory listing
GET    /servers/:id/files/download?path=/  # download file
POST   /servers/:id/files/upload           # upload file (multipart)
PUT    /servers/:id/files/content          # save file content (inline editor)
POST   /servers/:id/files/mkdir            # create directory
POST   /servers/:id/files/rename           # rename file/directory
DELETE /servers/:id/files?path=/           # delete file/directory

# Cron Manager (per server)
GET    /servers/:id/cron
POST   /servers/:id/cron
PUT    /servers/:id/cron/:jobId
DELETE /servers/:id/cron/:jobId
POST   /servers/:id/cron/:jobId/run        # test-run immediately

# Firewall Manager (per server)
GET    /servers/:id/firewall
POST   /servers/:id/firewall/rules
DELETE /servers/:id/firewall/rules/:ruleId
POST   /servers/:id/firewall/presets       # apply quick presets (allow HTTP/HTTPS, etc.)

# SSH Keys
GET    /ssh-keys
POST   /ssh-keys                           # generate or import
GET    /ssh-keys/:id
DELETE /ssh-keys/:id
POST   /ssh-keys/:id/rotate                # rotate keypair, push to assigned servers

# Panel Settings
GET    /settings
PUT    /settings
GET    /settings/users
POST   /settings/users
PUT    /settings/users/:id
DELETE /settings/users/:id

# Notification Channels
GET    /notifications/channels
POST   /notifications/channels
PUT    /notifications/channels/:id
DELETE /notifications/channels/:id
POST   /notifications/channels/:id/test    # send test notification

# Audit
GET    /audit                              # paginated, filterable

# WebSocket channels (auth via one-time ticket — obtain via POST /auth/ws-ticket, pass as ?ticket= on connect)
WS     /ws/metrics/:serverId
WS     /ws/logs/:siteId
WS     /ws/terminal/:serverId
WS     /ws/jobs/:jobId                     # provisioning/deploy progress
```

---

## 17. Database Schema

```sql
-- Teams (multi-tenant root)
teams (
  id, name, slug,
  plan,                                   -- 'free' | 'pro' | 'enterprise' (future billing hook)
  created_at
)

-- Users & Auth
users (
  id, email, password_hash, role,          -- 'admin' | 'developer' | 'viewer'
  totp_secret_encrypted, totp_enabled,
  team_id, last_login_at, created_at
)

-- User-Server assignments (RBAC)
user_servers (
  id, user_id, server_id,
  permission,                              -- 'manage' | 'view'
  created_at
)

-- User-Site assignments (RBAC)
user_sites (
  id, user_id, site_id,
  permission,                              -- 'manage' | 'deploy' | 'view'
  created_at
)

-- Servers
servers (
  id, name, host, port, username,
  auth_type,                              -- 'key' | 'password'
  ssh_key_id, password_encrypted,
  os_info,                                -- JSONB: distro, arch, kernel
  status,                                 -- 'online' | 'offline' | 'unknown'
  tags,                                   -- JSONB: array of tag strings
  team_id, created_at, deleted_at
)

-- SSH Keys
ssh_keys (
  id, name, public_key,
  private_key_encrypted,                  -- AES-256-GCM
  fingerprint, team_id, created_at
)

-- Cloudflare Tunnels
tunnels (
  id, server_id, cf_tunnel_id, name,
  status,                                 -- 'connected' | 'disconnected' | 'installing'
  ingress_routes,                         -- JSONB array of {hostname, service}
  credentials_path,
  installed_at, created_at
)

-- Cloudflare Accounts
cf_accounts (
  id, name, api_token_encrypted,
  email, account_id, team_id, created_at
)

-- Cloudflare Zones (domains)
cf_zones (
  id, cf_account_id, zone_id,
  zone_name, ssl_mode, proxy_status, plan,
  synced_at, created_at
)

-- DNS Records (panel-cached)
dns_records (
  id, zone_id, cf_record_id,
  type, name, content, proxied, ttl,
  managed_by_panel,                       -- true = auto-managed, false = manual
  synced_at
)

-- Sites / Applications
sites (
  id, server_id, name,
  domain, subdomain,
  stack_type,                             -- 'nodejs' | 'laravel' | 'python' | 'static' | 'docker'
  root_path, port,
  php_version, process_name,
  git_url, git_branch,
  status,                                 -- 'provisioning' | 'live' | 'stopped' | 'error'
  nginx_config,
  team_id, created_at, deleted_at
)

-- Site Environment Variables
site_env_vars (
  id, site_id, key,
  value_encrypted,                        -- per-value AES-256-GCM
  version INTEGER,                        -- auto-incremented; latest version is current
  created_at, created_by
)

-- Deploy History
deploys (
  id, site_id, triggered_by,
  status,                                 -- 'running' | 'success' | 'failed'
  git_commit, git_message,
  log_output, duration_ms,
  started_at, finished_at
)

-- Cron Jobs
cron_jobs (
  id, server_id,
  expression,                             -- cron expression (e.g. '* * * * *')
  command,
  description,
  last_run_at, last_output,
  team_id, created_at
)

-- Firewall Rules
firewall_rules (
  id, server_id,
  action,                                 -- 'allow' | 'deny'
  port,                                   -- null = all ports
  protocol,                               -- 'tcp' | 'udp' | 'both'
  source,                                 -- IP/CIDR or 'any'
  team_id, created_at
)

-- Notification Channels
notification_channels (
  id, team_id,
  type,                                   -- 'email' | 'webhook' | 'telegram'
  config,                                 -- JSONB: {to, webhook_url, bot_token, chat_id, ...}
  active, created_at
)

-- Server Metrics (time-series)
metrics (
  id, server_id,
  cpu_percent, ram_used, ram_total,
  disk_used, disk_total, net_in, net_out,
  load_avg,                               -- JSONB: {1m, 5m, 15m}
  recorded_at
)

-- Uptime Checks
uptime_checks (
  id, site_id, url, interval_seconds,
  status,                                 -- 'up' | 'down'
  last_checked_at, last_status_change_at,
  response_time_ms
)

-- Uptime Incidents
uptime_incidents (
  id, check_id, started_at, resolved_at, duration_seconds
)

-- Alert Rules
alert_rules (
  id, server_id, site_id,
  type,                                   -- 'cpu' | 'ram' | 'disk' | 'site_down' | 'deploy_fail'
  threshold, channel,                     -- 'email' | 'webhook' | 'telegram'
  channel_config,                         -- JSONB
  cooldown_minutes, active, team_id
)

-- Audit Logs
audit_logs (
  id, user_id, action,
  target_type, target_id,
  meta,                                   -- JSONB: old/new values, context
  ip_address, user_agent, created_at
)

-- Job History (audit mirror of BullMQ's Redis state)
job_history (
  id, queue, type, payload,
  status,                                 -- 'pending' | 'running' | 'done' | 'failed'
  progress,                               -- JSONB: [{step, status, log}]
  error, attempts,
  created_at, started_at, finished_at
)
```

### Indexes

```sql
-- Metrics (high-write, time-range queries)
CREATE INDEX idx_metrics_server_time ON metrics (server_id, recorded_at DESC);

-- Sites lookups
CREATE INDEX idx_sites_server ON sites (server_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sites_domain ON sites (domain) WHERE deleted_at IS NULL;
CREATE INDEX idx_sites_status ON sites (status);

-- Audit log queries
CREATE INDEX idx_audit_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_target ON audit_logs (target_type, target_id);
CREATE INDEX idx_audit_time ON audit_logs (created_at DESC);

-- Deploy history
CREATE INDEX idx_deploys_site ON deploys (site_id, started_at DESC);

-- DNS records
CREATE INDEX idx_dns_zone ON dns_records (zone_id);

-- Environment variables (latest version lookup)
CREATE INDEX idx_env_site_key ON site_env_vars (site_id, key, version DESC);

-- Job history
CREATE INDEX idx_job_history_status ON job_history (status, created_at DESC);
CREATE INDEX idx_job_history_queue ON job_history (queue, created_at DESC);

-- Tunnels
CREATE INDEX idx_tunnels_server ON tunnels (server_id);
```

---

## 18. Deployment Strategy

### Running NovaDash Itself

```bash
# Clone the repo
git clone https://github.com/you/novadash && cd novadash

# Configure
cp .env.example .env
# Edit .env: set ENCRYPTION_KEY, DB credentials, JWT secrets

# Start everything
docker-compose up -d
# Panel runs at http://localhost:3000
```

### Expose the Panel (One-Time Bootstrap)
```bash
# This is the ONE manual step — done once, never repeated:
cloudflared tunnel create novadash-panel
cloudflared tunnel route dns novadash-panel panel.yourdomain.com
cloudflared tunnel run novadash-panel
# After this, all tunnel management is inside the panel itself
```

### Panel Environment Variables
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ENCRYPTION_KEY=<64-char hex, generated once, never change>
JWT_SECRET=<random 64 chars>
JWT_REFRESH_SECRET=<random 64 chars>
PANEL_URL=https://panel.yourdomain.com
```

### Self-Referential Management
Once live, the panel manages its own Cloudflare Tunnel under Settings → Panel Tunnel. Even restarting the panel's own tunnel can be triggered from within the UI.

---

## 19. Future Scalability Hooks

Baked into the architecture from day 1 — no rewrites needed to enable these later:

| Future Feature | How It's Already Prepared |
|---|---|
| Multi-tenant / SaaS | `team_id` on every DB table; RBAC already in place |
| New app stacks (Go, Ruby, .NET) | `StackDriver` interface — write one file |
| New reverse proxy (Caddy) | `ProxyDriver` interface — write one file |
| New DNS provider (Route53) | `DnsDriver` interface — write one file |
| CI/CD pipelines | BullMQ `deploy` queue + webhook endpoint stubbed |
| Git webhooks (auto-deploy on push) | Webhook receiver endpoint; site has `git_url` + `git_branch` |
| Mobile app | Versioned REST API (`/api/v1/`) + JWT auth |
| Multiple panel instances | Stateless API + Redis shared state |
| Kubernetes / container orchestration | `ProcessDriver` interface wraps kubectl |
| Public status page | `uptime_checks` + `uptime_incidents` tables ready |
| Billing / plan limits | Auth has roles + team structure; add plan column to teams |
| Backup automation | `maintenance` job queue already exists |

---

## 20. Milestone Roadmap

| Milestone | Weeks | Deliverable |
|---|---|---|
| **M1 — Skeleton** | 1–2 | Monorepo, Docker Compose, DB schema, auth (JWT + 2FA), basic UI shell |
| **M2 — Server Connect** | 3–4 | SSH connection, server CRUD, live metrics dashboard, WebSocket |
| **M3 — Terminal + Files** | 5–6 | Xterm.js terminal, SFTP file manager, inline code editor |
| **M4 — Tunnel Engine** | 7–8 | cloudflared install/manage, ingress routes, CF API, auto-DNS |
| **M5 — Node.js Sites** | 9–10 | Full provisioning pipeline: Node.js + Nginx + PM2 + tunnel route |
| **M6 — Laravel + Python** | 11–12 | PHP-FPM + Supervisor drivers, artisan runner, venv management |
| **M7 — DNS + SSL** | 13 | Full DNS record management, SSL automation, CF security settings |
| **M8 — Monitoring** | 14–15 | Log viewer, uptime checks, alerting (email + webhook), metrics history |
| **M9 — Security** | 16–17 | RBAC, audit log, firewall manager, secret versioning, SSH key rotation |
| **M10 — Polish** | 18 | Error handling, retry flows, UI polish, documentation, Docker image publish |

---

## Core Rules (Never Break These)

1. **The panel writes every config file** — Nginx, PM2, Supervisor, cloudflared. Never ask the user to edit them manually.
2. **Every long task is a job** — provisioning, deploy, install, restart. Always async with real-time feedback.
3. **Every secret is encrypted** — SSH keys, API tokens, `.env` values, passwords. AES-256-GCM. Never plaintext in DB or logs.
4. **Cloudflare DNS is always in sync** — when a site is created/deleted, DNS updates happen in the same transaction. No orphan records.
5. **Tunnel config is owned by the panel** — `config.yml` on the server is always generated from the panel DB. Direct edits on the server will be overwritten on next sync.
6. **Idempotent everything** — re-running provisioning, re-deploying, re-configuring Nginx should always be safe.
7. **Graceful degradation** — if Cloudflare is not connected, sites still work via direct Nginx + Certbot for servers with public IPs.

---

*Plan version: 2.0 | Updated: April 2026*