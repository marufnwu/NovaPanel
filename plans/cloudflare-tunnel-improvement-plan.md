# Cloudflare Tunnel Improvement Plan

> Gap analysis and feature roadmap for bringing NovaPanel's Cloudflare Tunnel implementation
> to professional-grade quality, comparable to Plesk, cPanel, and Cloudflare Dashboard.

---

## 1. Current State Summary

### What Exists Now

The current implementation provides a **solid foundation** for single-tunnel management with remote configuration:

| Capability | Status | Details |
|---|---|---|
| Tunnel CRUD | ✅ Working | Create via Cloudflare API, delete, view info |
| Remote config | ✅ Working | Uses `PUT /configurations` API — no local config.yml |
| Route management | ✅ Working | Add, edit, delete, toggle routes with hostname→service mapping |
| DNS CNAME auto-creation | ✅ Working | Auto-creates/deletes CNAME records via Cloudflare API |
| Token validation | ✅ Working | Supports both user tokens and account tokens |
| Zone fetching | ✅ Working | Lists Cloudflare zones for account |
| Setup wizard | ✅ Working | 3-step wizard: Token → Zone → Name |
| Live logs | ✅ Working | WebSocket streaming from `journalctl -u cloudflared` |
| Config preview | ✅ Working | JSON display of ingress configuration |
| Quick expose domains | ✅ Working | One-click domain exposure via active tunnel |
| Expose Panel | ✅ Working | Dedicated modal for exposing NovaPanel itself |
| Audit logging | ✅ Working | All tunnel operations logged |
| Panel URL auto-update | ✅ Working | Updates `PANEL_URL` in `.env` when panel is exposed |
| Status monitoring | ⚠️ Basic | Process check + Cloudflare API connectivity check |

### Key Files

| File | Lines | Role |
|---|---|---|
| [`tunnel.service.ts`](../apps/api/src/modules/tunnel/tunnel.service.ts) | 1077 | Core business logic |
| [`tunnel.routes.ts`](../apps/api/src/modules/tunnel/tunnel.routes.ts) | 115 | API route definitions |
| [`tunnel.schema.ts`](../apps/api/src/modules/tunnel/tunnel.schema.ts) | 23 | Zod validation schemas |
| [`tunnel.ws.ts`](../apps/api/src/modules/tunnel/tunnel.ws.ts) | 193 | WebSocket log streaming |
| [`tunnels.ts`](../apps/api/src/db/schema/tunnels.ts) | 31 | Database schema |
| [`TunnelsPage.tsx`](../apps/web/src/pages/tunnels/TunnelsPage.tsx) | 858 | Frontend UI |
| [`tunnel.ts`](../apps/web/src/api/hooks/tunnel.ts) | 251 | Frontend hooks |

### Architecture Constraints

1. **Single `cloudflared` systemd service** — `start()` and `stop()` control one global service, not per-tunnel
2. **SQLite storage** — Tunnel metadata and routes stored locally
3. **Remote config approach** — No local config.yml; configuration pushed to Cloudflare API
4. **No background workers** — No scheduler or worker for health checks, auto-recovery, or metrics collection

---

## 2. Gap Analysis

### Priority Definitions

- **P0 (Must-have)**: Critical for production reliability and basic professional use
- **P1 (Should-have)**: Expected in any professional panel; significantly improves UX
- **P2 (Nice-to-have)**: Advanced features that differentiate from competitors

### Gap Summary Matrix

| # | Feature | Current State | Priority | Complexity |
|---|---|---|---|---|
| 1 | Multi-tunnel support | Broken — DB supports multiple but service controls only one | **P0** | L |
| 2 | Auto-recovery | None — relies on systemd defaults only | **P0** | M |
| 3 | Health monitoring | Basic status check on demand | **P0** | M |
| 4 | Notifications | No tunnel-specific alerts | **P0** | S |
| 5 | Error handling UX | Partial — some structured errors, no diagnostics | **P1** | M |
| 6 | Configuration validation | None — no test-before-apply | **P1** | M |
| 7 | Route flexibility | Minimal — hostname→service only | **P1** | L |
| 8 | Wizard UX | Basic 3-step, no use-case guidance | **P1** | S |
| 9 | Logging | Basic streaming, no search/export | **P1** | M |
| 10 | Backup/restore | None | **P1** | S |
| 11 | Multi-account | Partial — accountId stored but no management UI | **P2** | M |
| 12 | Traffic analytics | None | **P2** | XL |
| 13 | Access control / Zero Trust | None | **P2** | L |
| 14 | DNS management | CNAME-only, no full DNS UI in tunnel context | **P2** | M |
| 15 | API completeness | Basic CRUD only, no webhooks/events | **P2** | L |

---

## 3. Proposed Features

### 3.1 Multi-Tunnel Support — P0, Complexity: L

**What it does**: Allow users to create and independently manage multiple Cloudflare Tunnels, each running as its own systemd service with independent start/stop controls.

**Why it matters**: The current architecture shares a single `cloudflared` systemd service across all tunnels. While the DB schema supports multiple tunnel records, [`start()`](../apps/api/src/modules/tunnel/tunnel.service.ts:560) and [`stop()`](../apps/api/src/modules/tunnel/tunnel.service.ts:582) run `systemctl start/stop cloudflared` globally — meaning all tunnels share one lifecycle. This is a fundamental limitation.

**Backend changes**:
- Modify [`setup()`](../apps/api/src/modules/tunnel/tunnel.service.ts:66) to install each tunnel as a separate systemd service: `cloudflared@<tunnelId>.service` using systemd templates
- Refactor [`start()`](../apps/api/src/modules/tunnel/tunnel.service.ts:560) / [`stop()`](../apps/api/src/modules/tunnel/tunnel.service.ts:582) to accept a `tunnelDbId` parameter and control individual services
- Add a systemd template file at `/etc/systemd/system/cloudflared@.service`
- Update [`getStatus()`](../apps/api/src/modules/tunnel/tunnel.service.ts:470) to check per-tunnel process status
- Update [`deleteTunnel()`](../apps/api/src/modules/tunnel/tunnel.service.ts:347) to uninstall the specific service instance

**Frontend changes**:
- Each `TunnelCard` gets independent Start/Stop buttons that call the per-tunnel API
- Add tunnel-level status indicators with per-tunnel connection info
- Add "Start All" / "Stop All" bulk actions

**DB changes**:
- Add `serviceName` column to `cloudflareTunnels` table to track the systemd service name

---

### 3.2 Auto-Recovery with Exponential Backoff — P0, Complexity: M

**What it does**: Automatically restart tunnel services when they crash or lose connectivity, with exponential backoff to avoid thundering herd. Track restart attempts and alert after repeated failures.

**Why it matters**: Production tunnels must self-heal. Currently, if `cloudflared` crashes, it stays down until manually restarted. systemd's `Restart=on-failure` provides basic restart but no backoff, no health verification, and no notification.

**Backend changes**:
- Create a new `apps/api/src/modules/tunnel/tunnel.health.ts` service
- Implement a periodic health check using the existing scheduler infrastructure at [`scheduler.ts`](../apps/api/src/services/scheduler.ts)
- Health check logic:
  1. Query all tunnels from DB
  2. For each active tunnel, check process status via `systemctl is-active cloudflared@<tunnelId>`
  3. If process is down but DB says active → attempt restart
  4. Track restart count and last restart time in DB
  5. Exponential backoff: 5s → 10s → 30s → 60s → 5min → 15min → give up after 7 attempts
  6. On give-up, mark tunnel status as `error` and trigger notification
- Add `restartCount`, `lastRestartAt`, `lastHealthCheckAt` columns to `cloudflareTunnels`

**Frontend changes**:
- Show restart count and last restart time on tunnel cards
- Display "Auto-recovering" status with attempt count
- Show "Needs Attention" badge when auto-recovery has given up

---

### 3.3 Health Monitoring — P0, Complexity: M

**What it does**: Continuous health monitoring with connection details, latency measurement, uptime percentage, and a health history timeline.

**Why it matters**: Users need to know at a glance whether their tunnels are healthy. The current [`getStatus()`](../apps/api/src/modules/tunnel/tunnel.service.ts:470) only checks on-demand and returns a snapshot.

**Backend changes**:
- Extend [`tunnel.health.ts`](../apps/api/src/modules/tunnel/tunnel.health.ts) with:
  - Periodic health polling every 60 seconds for active tunnels
  - Store health snapshots in a new `tunnel_health_checks` table:
    - `id`, `tunnelDbId`, `status` (healthy/degraded/down), `latencyMs`, `connectionCount`, `edgeColo`, `checkedAt`
  - Compute uptime percentage from health check history
  - New API endpoints:
    - `GET /tunnel/:id/health` — current health + last 24h summary
    - `GET /tunnel/:id/health/history` — time-series data for charts
  - Latency measurement: time the Cloudflare API call to get tunnel info

**Frontend changes**:
- Health indicator on each tunnel card with color-coded status dot
- Health detail panel showing:
  - Current connections with colo (data center) locations
  - Uptime percentage (24h, 7d, 30d)
  - Average latency
  - Connection timeline chart

**DB changes**:
- New `tunnel_health_checks` table
- Add `healthStatus` column to `cloudflareTunnels` (healthy/degraded/down/unknown)

---

### 3.4 Tunnel Event Notifications — P0, Complexity: S

**What it does**: Push notifications when tunnel status changes: disconnected, reconnected, auto-recovered, or failed recovery.

**Why it matters**: Users must know immediately when their publicly-exposed services go offline. The [`notifications`](../apps/api/src/db/schema/notifications.ts:19) table and infrastructure already exist — we just need tunnel-specific event types.

**Backend changes**:
- Add `tunnel_disconnected`, `tunnel_reconnected`, `tunnel_error`, `tunnel_recovered` to the notification type enum in [`notifications.ts`](../apps/api/src/db/schema/notifications.ts:22)
- Add `tunnelEvents` boolean column to [`notificationPreferences`](../apps/api/src/db/schema/notifications.ts:4)
- In the health check service, create notifications on status transitions:
  - active → inactive: "Tunnel disconnected" notification
  - inactive → active (auto-recovery): "Tunnel recovered" notification
  - recovery gave up: "Tunnel needs attention" notification
- Add `tunnel_id` column to `notifications` table for linking

**Frontend changes**:
- Show tunnel notifications in the existing notification bell
- Add tunnel event preferences to the notification settings page
- Show recent events in the tunnel detail view

---

### 3.5 Enhanced Error Handling & Diagnostics — P1, Complexity: M

**What it does**: Structured error messages with guided troubleshooting steps, connection diagnostics tool, and common error resolution suggestions.

**Why it matters**: The existing [`createTunnelError()`](../apps/api/src/utils/error-messages.ts) provides basic error transformation, but tunnel errors are often complex (DNS misconfiguration, token expiry, network issues). Users need guided help.

**Backend changes**:
- Extend [`error-messages.ts`](../apps/api/src/utils/error-messages.ts) with comprehensive tunnel error patterns:
  - Token expired/revoked → steps to regenerate
  - Zone not found → steps to add domain to Cloudflare
  - DNS resolution failure → steps to check DNS config
  - Connection refused at origin → steps to check local service
  - cloudflared not installed → installation instructions
  - Port already in use → conflict resolution
- Add a new `POST /tunnel/:id/diagnose` endpoint:
  1. Check cloudflared binary exists and version
  2. Check systemd service status
  3. Check DNS resolution for each route hostname
  4. Check local service reachability for each route
  5. Check Cloudflare API connectivity
  6. Return structured diagnostic report

**Frontend changes**:
- Error messages in modals show structured errors with expandable "Why this happened" and "How to fix" sections
- Add "Run Diagnostics" button on tunnel cards
- Display diagnostic results in a modal with pass/fail/warning for each check
- Show suggested fixes for failed checks

---

### 3.6 Configuration Validation — P1, Complexity: M

**What it does**: Validate route configurations before applying them. Test DNS resolution, origin reachability, and hostname uniqueness before pushing to Cloudflare.

**Why it matters**: Currently, [`addRoute()`](../apps/api/src/modules/tunnel/tunnel.service.ts:615) pushes config to Cloudflare immediately. If the config is invalid, the tunnel goes offline or returns errors. Users should be able to preview and validate first.

**Backend changes**:
- Add `POST /tunnel/:id/validate-route` endpoint:
  - Validate hostname format and DNS zone ownership
  - Check if hostname is already routed by another tunnel
  - Test local service reachability (TCP connect to origin)
  - Validate no port conflicts with existing routes
  - Return validation result with warnings/errors
- Add `POST /tunnel/:id/preview-config` endpoint:
  - Accept proposed route changes
  - Return the full ingress config that would be applied
  - Highlight differences from current config
- Modify [`addRoute()`](../apps/api/src/modules/tunnel/tunnel.service.ts:615) and [`editRoute()`](../apps/api/src/modules/tunnel/tunnel.service.ts:678) to accept optional `dryRun: boolean` parameter

**Frontend changes**:
- Add "Validate" button in Add/Edit Route modals
- Show validation results inline (green checkmarks or red errors)
- Add "Preview Changes" step before applying config
- Show diff view comparing current vs proposed config

---

### 3.7 Advanced Route Configuration — P1, Complexity: L

**What it does**: Support path-based routing, HTTP header manipulation, origin request options, and protocol-specific settings.

**Why it matters**: Currently routes only support hostname → service with a `noTlsVerify` toggle. Professional use cases require:
- Path-based routing (e.g., `app.example.com/api/*` → different origin)
- Header manipulation (add/remove HTTP headers)
- Origin request settings (connect timeout, TLS settings, HTTP/2)
- Protocol support (TCP, SSH, RDP, etc.)

**Backend changes**:
- Extend `tunnelRoutes` schema with new columns:
  - `path` — path pattern for path-based routing (e.g., `/api/*`)
  - `originRequest` — JSON column for origin request config:
    - `connectTimeout`, `tlsTimeout`, `tcpKeepAlive`
    - `noHappyEyeballs`, `keepAliveConnections`, `keepAliveTimeout`
    - `httpHostHeader`, `originServerName`
    - `caPool`, `noTLSVerify` (move from dedicated column)
  - `headers` — JSON column for header manipulation rules
  - `protocol` — enum: `http`, `https`, `tcp`, `ssh`, `rdp`, `unix`
- Update [`updateRemoteConfig()`](../apps/api/src/modules/tunnel/tunnel.service.ts:780) to include new fields in ingress config
- Update Zod schemas in [`tunnel.schema.ts`](../apps/api/src/modules/tunnel/tunnel.schema.ts) to validate new fields
- Add route ordering support (Cloudflare matches routes top-to-bottom)

**Frontend changes**:
- Redesign Add/Edit Route modal with expandable sections:
  - **Basic**: hostname, service URL, protocol
  - **Path Routing**: path pattern field
  - **Origin Settings**: connect timeout, TLS options, keep-alive
  - **Headers**: add/remove header rules
- Add route ordering via drag-and-drop
- Add protocol-specific presets (SSH, RDP, TCP)
- Show route type badges (HTTP, TCP, SSH, etc.)

---

### 3.8 Guided Setup Wizards — P1, Complexity: S

**What it does**: Use-case-specific setup wizards that guide users through common scenarios: expose a website, expose an API, expose SSH, expose the panel.

**Why it matters**: The current setup wizard is generic. New users benefit from guided flows that pre-fill settings for common use cases.

**Backend changes**:
- Minimal — existing API is sufficient
- Add a `POST /tunnel/quick-setup` endpoint that accepts a use case type and creates tunnel + route in one step:
  - `expose-website`: creates tunnel + route for domain on port 80
  - `expose-panel`: creates tunnel + route for hostname on port 8732
  - `expose-ssh`: creates tunnel + route for hostname on port 22 with TCP protocol
  - `expose-api`: creates tunnel + route for hostname on specified port

**Frontend changes**:
- Add "Quick Setup" section to the empty state with use-case cards:
  - 🌐 Expose a Website
  - 🖥️ Expose Panel
  - 🔌 Expose SSH
  - ⚡ Expose API
- Each card opens a simplified form with pre-filled defaults
- Show a summary page before creating

---

### 3.9 Enhanced Logging — P1, Complexity: M

**What it does**: Structured log storage, log search/filter, log export, and persistent log history beyond the current WebSocket streaming.

**Why it matters**: The current [`tunnel.ws.ts`](../apps/api/src/modules/tunnel/tunnel.ws.ts) streams raw `journalctl` output with no persistence, no search, and no filtering. When the WebSocket disconnects, all log history is lost.

**Backend changes**:
- Create a log ingestion pipeline:
  - Run a persistent `journalctl -u cloudflared@* -f` process
  - Parse structured log lines (cloudflared outputs JSON when `--log-format json`)
  - Store parsed logs in a `tunnel_logs` table or SQLite file:
    - `id`, `tunnelDbId`, `timestamp`, `level`, `message`, `fields` (JSON)
  - Retention policy: keep last 7 days, auto-prune older entries
- Add API endpoints:
  - `GET /tunnel/:id/logs?level=&search=&from=&to=&limit=` — paginated log query
  - `GET /tunnel/:id/logs/export?format=json|csv` — download logs
- Keep WebSocket for real-time streaming but enhance with:
  - Structured log format
  - Filter by level
  - Search capability

**Frontend changes**:
- Replace the simple log display with a proper log viewer:
  - Level-based color coding (ERROR=red, WARN=yellow, INFO=blue, DEBUG=gray)
  - Search/filter bar
  - Level filter buttons
  - "Export Logs" button
  - Timestamp formatting options
  - Auto-scroll toggle

---

### 3.10 Backup & Restore — P1, Complexity: S

**What it does**: Export tunnel configurations to JSON, import configurations from JSON, and restore tunnels from backup.

**Why it matters**: Users need to migrate tunnels between servers or recover after server failures. Currently, all config is in SQLite + Cloudflare API with no export mechanism.

**Backend changes**:
- Add `GET /tunnel/export` endpoint:
  - Returns JSON with all tunnels, routes, and metadata (excluding encrypted tokens)
  - Include tunnel IDs, names, hostnames, services, settings
  - Optionally include Cloudflare API token (re-encrypted for export)
- Add `POST /tunnel/import` endpoint:
  - Accept exported JSON
  - Validate structure
  - Create tunnels and routes from imported data
  - Optionally re-create tunnels on Cloudflare API
- Add `POST /tunnel/:id/clone` endpoint:
  - Clone a tunnel configuration to a new tunnel

**Frontend changes**:
- Add "Export Config" button to tunnel page header
- Add "Import Config" button that opens file picker
- Add "Clone Tunnel" option in tunnel card menu
- Show import preview with conflict detection

---

### 3.11 Multi-Account Support — P2, Complexity: M

**What it does**: Manage tunnels across multiple Cloudflare accounts with separate API tokens, account switching, and per-account zone lists.

**Why it matters**: Agencies and freelancers often manage multiple Cloudflare accounts. The current implementation stores one API token per tunnel but has no account management UI.

**Backend changes**:
- Create a `cloudflare_accounts` table:
  - `id`, `name`, `accountId`, `apiToken` (encrypted), `isDefault`, `createdAt`
- Add account management endpoints:
  - `GET /tunnel/accounts` — list configured accounts
  - `POST /tunnel/accounts` — add account (validate token)
  - `PUT /tunnel/accounts/:id` — update account
  - `DELETE /tunnel/accounts/:id` — remove account
- Modify [`setup()`](../apps/api/src/modules/tunnel/tunnel.service.ts:66) to reference account by DB ID instead of raw API token
- Add `accountRef` foreign key to `cloudflareTunnels`

**Frontend changes**:
- Add "Cloudflare Accounts" section in tunnel settings
- Account selector in setup wizard
- Show account name on tunnel cards
- Account management modal (add/edit/remove)

---

### 3.12 Traffic Analytics — P2, Complexity: XL

**What it does**: Per-route request counts, bandwidth, error rates, response times, and top endpoints. Displayed as charts and tables.

**Why it matters**: Professional panels provide visibility into traffic patterns. This helps users understand which services are being used and identify issues.

**Backend changes**:
- Cloudflare provides analytics via GraphQL API:
  - `POST /graphql` with query for tunnel metrics
  - Filter by tunnel ID, time range
  - Metrics: requests, bytes, response codes, latency percentiles
- Add `GET /tunnel/:id/analytics?from=&to=` endpoint:
  - Query Cloudflare GraphQL API
  - Cache results for 5 minutes
  - Return time-series data + aggregates
- Add `GET /tunnel/:id/analytics/summary` for dashboard widget data

**Frontend changes**:
- Add "Analytics" tab on tunnel detail view:
  - Request count chart (time-series)
  - Bandwidth chart (in/out)
  - Response code distribution (pie chart)
  - Top routes table with request counts
  - Error rate percentage
- Add mini sparkline charts on tunnel cards
- Date range selector (1h, 24h, 7d, 30d)

---

### 3.13 Access Control / Zero Trust — P2, Complexity: L

**What it does**: Integrate with Cloudflare Access to add authentication, IP allowlists, and per-route access policies.

**Why it matters**: Many tunnel use cases require restricting access (admin panels, internal APIs, staging environments). Cloudflare Access provides this without application-level changes.

**Backend changes**:
- Add `tunnel_access_policies` table:
  - `id`, `routeId`, `policyType` (allow/deny), `authType` (email/ip/service-token/group)
  - `allowedValues` (JSON array), `createdAt`
- Add access policy management endpoints:
  - `POST /tunnel/routes/:id/access` — create access policy
  - `PUT /tunnel/routes/:id/access/:policyId` — update
  - `DELETE /tunnel/routes/:id/access/:policyId` — delete
- Integrate with Cloudflare Access API:
  - Create Access Applications for tunnel hostnames
  - Create Access Policies for each route
  - Manage service tokens

**Frontend changes**:
- Add "Access Control" section in route edit modal:
  - Toggle "Require authentication"
  - Add email allowlist
  - Add IP allowlist
  - Service token management
- Show lock icon on routes with access control
- Access policy management page

---

### 3.14 Full DNS Management in Tunnel Context — P2, Complexity: M

**What it does**: Manage all DNS records for tunnel domains, not just auto-created CNAMEs. Show DNS status, propagation, and allow manual record management.

**Why it matters**: Currently, [`createDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:838) only creates CNAME records. Users need to manage A, AAAA, MX, TXT records for their domains too. The existing [`DnsService`](../apps/api/src/modules/dns/dns.service.ts) manages BIND-based DNS, but tunnel domains use Cloudflare DNS.

**Backend changes**:
- Add Cloudflare DNS management endpoints:
  - `GET /tunnel/dns/records?zoneId=` — list all DNS records for a zone
  - `POST /tunnel/dns/records` — create any DNS record type
  - `PUT /tunnel/dns/records/:recordId` — update record
  - `DELETE /tunnel/dns/records/:recordId` — delete record
- Show tunnel-related records vs non-tunnel records
- DNS propagation checker

**Frontend changes**:
- Add "DNS Records" tab on tunnel detail view
- DNS record table with type, name, content, proxied status
- Add/Edit/Delete record modals
- Show which records are managed by tunnel (auto-created CNAMEs)
- DNS propagation status indicators

---

### 3.15 API Completeness — P2, Complexity: L

**What it does**: Webhook support for tunnel events, comprehensive API documentation, and programmatic tunnel management.

**Why it matters**: Advanced users and automation tools need API-driven tunnel management with event notifications.

**Backend changes**:
- Add webhook infrastructure:
  - `webhooks` table: `id`, `url`, `events` (JSON array), `secret`, `isActive`, `createdAt`
  - Events: `tunnel.created`, `tunnel.deleted`, `tunnel.started`, `tunnel.stopped`, `tunnel.health_changed`, `route.added`, `route.removed`
  - HMAC-signed webhook payloads
  - Retry logic with exponential backoff (3 retries)
- Add webhook management endpoints:
  - `GET /tunnel/webhooks`
  - `POST /tunnel/webhooks`
  - `PUT /tunnel/webhooks/:id`
  - `DELETE /tunnel/webhooks/:id`
  - `POST /tunnel/webhooks/:id/test` — send test webhook

**Frontend changes**:
- Add "Webhooks" section in tunnel settings
- Webhook management table
- Add webhook modal with event type checkboxes
- Test webhook button with delivery log
- Recent deliveries table with status and response

---

## 4. Recommended Implementation Order

### Phase 1: Reliability Foundation

These P0 items form the foundation that all other features depend on.

```
Phase 1a: Multi-Tunnel Support
├── Refactor systemd service to per-tunnel instances
├── Update start/stop to per-tunnel API
├── Update frontend for per-tunnel controls
└── Migration: add serviceName column

Phase 1b: Auto-Recovery
├── Create tunnel.health.ts service
├── Implement health check scheduler
├── Add restart logic with exponential backoff
├── Add restart tracking columns to DB
└── Frontend: show recovery status

Phase 1c: Health Monitoring
├── Create tunnel_health_checks table
├── Implement periodic health polling
├── Add health API endpoints
├── Frontend: health indicators and detail panel
└── Uptime percentage calculation

Phase 1d: Notifications
├── Add tunnel event types to notifications schema
├── Integrate health service with notification service
├── Frontend: tunnel notification preferences
└── Notification display for tunnel events
```

### Phase 2: User Experience

P1 features that significantly improve day-to-day usability.

```
Phase 2a: Enhanced Error Handling
├── Extend error-messages.ts with tunnel patterns
├── Add diagnostics endpoint
├── Frontend: structured error display
└── Frontend: diagnostics modal

Phase 2b: Configuration Validation
├── Add validate-route endpoint
├── Add preview-config endpoint
├── Frontend: validation in route modals
└── Frontend: config diff preview

Phase 2c: Guided Setup Wizards
├── Add quick-setup endpoint
├── Frontend: use-case cards
├── Frontend: simplified setup flows
└── Pre-filled defaults per use case

Phase 2d: Enhanced Logging
├── Create log ingestion pipeline
├── Add log storage and query API
├── Add log export endpoint
├── Frontend: log viewer with search/filter
└── Frontend: export button

Phase 2e: Backup & Restore
├── Add export/import endpoints
├── Add clone endpoint
├── Frontend: export/import buttons
└── Frontend: clone tunnel action

Phase 2f: Advanced Route Configuration
├── Extend tunnelRoutes schema
├── Update remote config builder
├── Frontend: expandable route settings
├── Route ordering support
└── Protocol-specific presets
```

### Phase 3: Advanced Features

P2 features for power users and enterprise scenarios.

```
Phase 3a: Multi-Account Support
├── Create cloudflare_accounts table
├── Account management endpoints
├── Frontend: account management UI
└── Account selector in setup

Phase 3b: Traffic Analytics
├── Cloudflare GraphQL API integration
├── Analytics endpoints with caching
├── Frontend: analytics charts
└── Dashboard widgets

Phase 3c: Access Control / Zero Trust
├── Access policy schema and endpoints
├── Cloudflare Access API integration
├── Frontend: access control UI
└── Route-level policy management

Phase 3d: Full DNS Management
├── Cloudflare DNS CRUD endpoints
├── Frontend: DNS records tab
├── Propagation checker
└── Record type management

Phase 3e: API Completeness
├── Webhook infrastructure
├── Event emission system
├── Frontend: webhook management
└── Delivery log and retry UI
```

---

## 5. Architecture Considerations

### 5.1 Systemd Template for Multi-Tunnel

The most critical infrastructure change. Create a systemd template:

```ini
# /etc/systemd/system/cloudflared@.service
[Unit]
Description=Cloudflare Tunnel %i
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/bin/cloudflared --no-autoupdate tunnel run --token %i
Restart=on-failure
RestartSec=5
TimeoutStartSec=30

[Install]
WantedBy=multi-user.target
```

Each tunnel is then managed as `cloudflared@<tunnelToken>.service`. This enables:
- Independent start/stop per tunnel
- Independent restart policies
- Independent log streams via `journalctl -u cloudflared@<token>`
- Process isolation

### 5.2 Health Check Scheduler

Leverage the existing [`scheduler.ts`](../apps/api/src/services/scheduler.ts) to run periodic health checks:

```
┌─────────────┐     every 60s      ┌──────────────────┐
│  Scheduler   │ ──────────────────►│  tunnel.health.ts │
│  (scheduler) │                    │                    │
└─────────────┘                    │  For each tunnel:  │
                                   │  1. Check process  │
                                   │  2. Check API      │
                                   │  3. Store result   │
                                   │  4. Notify if down │
                                   │  5. Restart if needed│
                                   └──────────────────┘
```

### 5.3 Database Schema Additions

New tables needed:

```
tunnel_health_checks
├── id: text PK
├── tunnelDbId: text FK → cloudflareTunnels
├── status: text enum [healthy, degraded, down]
├── latencyMs: integer
├── connectionCount: integer
├── edgeColo: text
├── checkedAt: timestamp

tunnel_logs
├── id: text PK
├── tunnelDbId: text FK → cloudflareTunnels
├── timestamp: timestamp
├── level: text enum [error, warn, info, debug]
├── message: text
├── fields: text (JSON)

cloudflare_accounts (Phase 3)
├── id: text PK
├── name: text
├── accountId: text
├── apiToken: text (encrypted)
├── isDefault: boolean
├── createdAt: timestamp

tunnel_access_policies (Phase 3)
├── id: text PK
├── routeId: text FK → tunnelRoutes
├── policyType: text
├── authType: text
├── allowedValues: text (JSON)
├── createdAt: timestamp

webhooks (Phase 3)
├── id: text PK
├── url: text
├── events: text (JSON)
├── secret: text
├── isActive: boolean
├── createdAt: timestamp
```

Column additions to existing tables:

```
cloudflareTunnels (additions):
├── serviceName: text (systemd service name)
├── healthStatus: text enum [healthy, degraded, down, unknown]
├── restartCount: integer default 0
├── lastRestartAt: timestamp
├── lastHealthCheckAt: timestamp
├── accountRef: text FK → cloudflare_accounts (Phase 3)

tunnelRoutes (additions):
├── path: text (path pattern, e.g. /api/*)
├── originRequest: text (JSON)
├── headers: text (JSON)
├── protocol: text enum [http, https, tcp, ssh, rdp, unix]
├── sortOrder: integer (route matching priority)
```

### 5.4 API Versioning Consideration

New endpoints should be added to the existing `/api/v1/tunnel/` prefix. Breaking changes (like making `start`/`stop` require a tunnel ID) should be handled with backward compatibility:
- Keep `POST /tunnel/start` and `POST /tunnel/stop` working for "start/stop all"
- Add `POST /tunnel/:id/start` and `POST /tunnel/:id/stop` for per-tunnel control

### 5.5 Security Considerations

- **Encrypted tokens**: Continue using [`encrypt()`](../apps/api/src/utils/crypto.ts) for all stored tokens
- **Webhook secrets**: Generate HMAC-SHA256 secrets for webhook signing
- **Access policies**: Store policy IDs, not credentials
- **Log sanitization**: Ensure logs don't contain sensitive tokens or headers
- **API rate limiting**: Cloudflare API has rate limits; implement client-side rate limiting for health checks

### 5.6 Performance Considerations

- **Health check batching**: Query multiple tunnels in parallel, not sequentially
- **Log storage**: SQLite for logs may grow large; implement retention policy (7 days) and consider WAL mode
- **Analytics caching**: Cache Cloudflare GraphQL responses for 5 minutes
- **WebSocket connection pooling**: Limit concurrent log sessions per user (currently has 30-min timeout in [`cleanupStaleLogSessions()`](../apps/api/src/modules/tunnel/tunnel.ws.ts:181))

---

## 6. Success Metrics

After implementation, the tunnel feature should achieve:

| Metric | Target |
|---|---|
| Tunnel setup time | < 2 minutes from wizard start to active tunnel |
| Error recovery time | < 30 seconds from crash to auto-restart |
| Notification latency | < 10 seconds from status change to user notification |
| Health check coverage | 100% of active tunnels checked every 60 seconds |
| Diagnostic accuracy | > 90% of issues identified by diagnostics tool |
| Configuration safety | Zero tunnel outages from invalid config (via validation) |
