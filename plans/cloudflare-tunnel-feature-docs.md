# Cloudflare Tunnel Feature Documentation

> Comprehensive technical documentation for the NovaPanel Cloudflare Tunnel integration.
> Covers architecture, API, database, frontend, and operational flows.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Complete API Endpoints](#3-complete-api-endpoints)
4. [Flow Diagrams](#4-flow-diagrams)
5. [Database Schema](#5-database-schema)
6. [Cloudflare API Integration](#6-cloudflare-api-integration)
7. [Service Management](#7-service-management)
8. [WebSocket Real-time Logs](#8-websocket-real-time-logs)
9. [Frontend Features](#9-frontend-features)
10. [Error Handling](#10-error-handling)
11. [Configuration Details](#11-configuration-details)

---

## 1. Overview

### What is Cloudflare Tunnel?

Cloudflare Tunnel (formerly Argo Tunnel) creates an encrypted connection between a server and the Cloudflare edge network using the `cloudflared` daemon. This allows services running on a private network (e.g., behind NAT or firewall) to be exposed to the internet without opening inbound ports.

Key benefits:
- **No open inbound ports** — `cloudflared` initiates outbound connections to Cloudflare's edge
- **Encrypted by default** — all traffic between the server and Cloudflare is encrypted
- **DNS integration** — CNAME records route public hostnames through the tunnel
- **Zero-trust security** — Cloudflare's WAF, Access policies, and rate limiting protect services

### How NovaPanel Uses It

NovaPanel provides a fully managed UI for creating, configuring, and monitoring Cloudflare Tunnels. The integration uses the **remote configuration** approach (not the legacy CLI/config-file approach):

- **Tunnel creation** is done via the Cloudflare API (`POST /accounts/{id}/cfd_tunnel`)
- **Route configuration** is pushed to Cloudflare's remote config via API (`PUT /accounts/{id}/cfd_tunnel/{id}/configurations`)
- **cloudflared** runs as a **systemd service** installed with a tunnel token (no local config.yml needed)
- **DNS CNAME records** are automatically created/managed via the Cloudflare API
- **Real-time logs** stream from `journalctl` over WebSocket to the frontend

### Source Files

| File | Purpose |
|------|---------|
| [`tunnel.routes.ts`](../apps/api/src/modules/tunnel/tunnel.routes.ts) | Fastify route definitions |
| [`tunnel.service.ts`](../apps/api/src/modules/tunnel/tunnel.service.ts) | Core business logic (1077 lines) |
| [`tunnel.schema.ts`](../apps/api/src/modules/tunnel/tunnel.schema.ts) | Zod request validation schemas |
| [`tunnel.ws.ts`](../apps/api/src/modules/tunnel/tunnel.ws.ts) | WebSocket handler for real-time log streaming |
| [`tunnels.ts`](../apps/api/src/db/schema/tunnels.ts) | Drizzle ORM database schema |
| [`TunnelsPage.tsx`](../apps/web/src/pages/tunnels/TunnelsPage.tsx) | React frontend page (858 lines) |
| [`tunnel.ts`](../apps/web/src/api/hooks/tunnel.ts) | TanStack Query hooks & WebSocket log client |

---

## 2. Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │           CLOUDFLARE EDGE NETWORK           │
                          │                                             │
                          │  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
                          │  │  Edge    │  │  Edge    │  │  Edge    │    │
                          │  │  PoP 1   │  │  PoP 2   │  │  PoP N   │    │
                          │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
                          │       │              │              │        │
                          │       └──────────────┼──────────────┘        │
                          │                      │                       │
                          │         ┌────────────▼────────────┐         │
                          │         │   Cloudflare API        │         │
                          │         │  api.cloudflare.com/v4   │         │
                          │         │                          │         │
                          │         │  • Tunnel CRUD           │         │
                          │         │  • Config management     │         │
                          │         │  • DNS record management │         │
                          │         └────────────▲────────────┘         │
                          └──────────────────────┼──────────────────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │    USER'S SERVER     │   (NovaPanel host)   │
                          │                      │                       │
                          │  ┌───────────────────▼──────────────────┐   │
                          │  │         NovaPanel API                │   │
                          │  │         (Fastify, port 8732)         │   │
                          │  │                                      │   │
                          │  │  ┌──────────────┐ ┌───────────────┐  │   │
                          │  │  │ tunnel.       │ │ tunnel.ws.ts  │  │   │
                          │  │  │ service.ts    │ │ (WebSocket)   │  │   │
                          │  │  └──────┬───────┘ └───────┬───────┘  │   │
                          │  │         │                  │          │   │
                          │  │  ┌──────▼───────┐  ┌──────▼───────┐  │   │
                          │  │  │ SQLite DB    │  │ journalctl   │  │   │
                          │  │  │ (tunnels &   │  │ (cloudflared │  │   │
                          │  │  │  routes)     │  │  logs)       │  │   │
                          │  │  └──────────────┘  └──────────────┘  │   │
                          │  └──────────────────────────────────────┘   │
                          │                      │                       │
                          │         ┌────────────▼────────────┐         │
                          │         │   cloudflared daemon    │         │
                          │         │   (systemd: cloudflared) │         │
                          │         │                          │         │
                          │         │   Protocol: http2        │         │
                          │         │   Config: remote (token) │         │
                          │         └──────────────────────────┘         │
                          └──────────────────────────────────────────────┘
                                                 ▲
                          ┌──────────────────────┼──────────────────────┐
                          │    USER'S BROWSER    │                       │
                          │                      │                       │
                          │  ┌───────────────────▼──────────────────┐   │
                          │  │       NovaPanel Frontend (React)      │   │
                          │  │       TunnelsPage.tsx                 │   │
                          │  │                                       │   │
                          │  │  • Setup wizard (3-step)              │   │
                          │  │  • Route management (CRUD)            │   │
                          │  │  • Live log viewer (WebSocket)        │   │
                          │  │  • Quick domain exposure              │   │
                          │  │  • Config preview                     │   │
                          │  └───────────────────────────────────────┘   │
                          └──────────────────────────────────────────────┘
```

---

## 3. Complete API Endpoints

All endpoints are under the `/api/v1` prefix. Authentication is required for all endpoints (session cookie or API token).

| Method | Path | Purpose | Auth | Admin Only | Source |
|--------|------|---------|------|------------|--------|
| `GET` | `/tunnel/status` | Get tunnel status with connectivity info | ✅ | ❌ | [`tunnel.routes.ts:11`](../apps/api/src/modules/tunnel/tunnel.routes.ts:11) |
| `POST` | `/tunnel/validate-token` | Validate a Cloudflare API token | ✅ | ❌ | [`tunnel.routes.ts:16`](../apps/api/src/modules/tunnel/tunnel.routes.ts:16) |
| `POST` | `/tunnel/fetch-zones` | Fetch Cloudflare zones for a token | ✅ | ❌ | [`tunnel.routes.ts:22`](../apps/api/src/modules/tunnel/tunnel.routes.ts:22) |
| `GET` | `/tunnel/:id/info` | Get detailed tunnel info from CF API | ✅ | ❌ | [`tunnel.routes.ts:28`](../apps/api/src/modules/tunnel/tunnel.routes.ts:28) |
| `GET` | `/tunnel/:id/config` | Get tunnel ingress config as JSON | ✅ | ❌ | [`tunnel.routes.ts:34`](../apps/api/src/modules/tunnel/tunnel.routes.ts:34) |
| `POST` | `/tunnel/setup` | Create tunnel + install cloudflared service | ✅ | ✅ | [`tunnel.routes.ts:40`](../apps/api/src/modules/tunnel/tunnel.routes.ts:40) |
| `DELETE` | `/tunnel/:id` | Delete tunnel + cleanup all resources | ✅ | ✅ | [`tunnel.routes.ts:49`](../apps/api/src/modules/tunnel/tunnel.routes.ts:49) |
| `POST` | `/tunnel/start` | Start cloudflared systemd service | ✅ | ✅ | [`tunnel.routes.ts:57`](../apps/api/src/modules/tunnel/tunnel.routes.ts:57) |
| `POST` | `/tunnel/stop` | Stop cloudflared systemd service | ✅ | ✅ | [`tunnel.routes.ts:65`](../apps/api/src/modules/tunnel/tunnel.routes.ts:65) |
| `GET` | `/tunnel/routes` | List all tunnel routes | ✅ | ❌ | [`tunnel.routes.ts:74`](../apps/api/src/modules/tunnel/tunnel.routes.ts:74) |
| `POST` | `/tunnel/routes` | Add a new route (public hostname) | ✅ | ❌ | [`tunnel.routes.ts:79`](../apps/api/src/modules/tunnel/tunnel.routes.ts:79) |
| `PUT` | `/tunnel/routes/:id` | Edit an existing route | ✅ | ❌ | [`tunnel.routes.ts:85`](../apps/api/src/modules/tunnel/tunnel.routes.ts:85) |
| `DELETE` | `/tunnel/routes/:id` | Delete a route | ✅ | ❌ | [`tunnel.routes.ts:92`](../apps/api/src/modules/tunnel/tunnel.routes.ts:92) |
| `POST` | `/tunnel/routes/:id/toggle` | Toggle route active/inactive | ✅ | ❌ | [`tunnel.routes.ts:99`](../apps/api/src/modules/tunnel/tunnel.routes.ts:99) |
| `POST` | `/tunnel/dns/cname` | Create a DNS CNAME record | ✅ | ❌ | [`tunnel.routes.ts:105`](../apps/api/src/modules/tunnel/tunnel.routes.ts:105) |
| `WS` | `/ws/tunnel/logs` | WebSocket for real-time log streaming | ✅ | ✅ | [`tunnel.ws.ts:20`](../apps/api/src/modules/tunnel/tunnel.ws.ts:20) |

### Response Format

All API responses follow the standard wrapper format:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

---

## 4. Flow Diagrams

### 4.1 Tunnel Creation Flow

```
  User (Browser)              NovaPanel API                Cloudflare API            Server (systemd)
       │                           │                            │                         │
       │  1. Click "Setup Tunnel"  │                            │                         │
       │──────────────────────────▶│                            │                         │
       │                           │                            │                         │
       │  2. Enter API Token       │                            │                         │
       │  POST /validate-token     │                            │                         │
       │──────────────────────────▶│  GET /user/tokens/verify   │                         │
       │                           │───────────────────────────▶│                         │
       │                           │◀───────────────────────────│                         │
       │  { valid: true }          │                            │                         │
       │◀──────────────────────────│                            │                         │
       │                           │                            │                         │
       │  3. Select Zone           │                            │                         │
       │  POST /fetch-zones        │                            │                         │
       │──────────────────────────▶│  GET /zones?account.id=... │                         │
       │                           │───────────────────────────▶│                         │
       │                           │◀───────────────────────────│                         │
       │  [{ id, name, status }]   │                            │                         │
       │◀──────────────────────────│                            │                         │
       │                           │                            │                         │
       │  4. Enter Name & Submit   │                            │                         │
       │  POST /tunnel/setup       │                            │                         │
       │──────────────────────────▶│                            │                         │
       │                           │                            │                         │
       │                           │  5. Resolve account ID     │                         │
       │                           │  (GET /accounts if needed) │                         │
       │                           │───────────────────────────▶│                         │
       │                           │◀───────────────────────────│                         │
       │                           │                            │                         │
       │                           │  6. Create tunnel          │                         │
       │                           │  POST /accounts/{id}/      │                         │
       │                           │       cfd_tunnel           │                         │
       │                           │  { name, config_src:       │                         │
       │                           │    "cloudflare" }          │                         │
       │                           │───────────────────────────▶│                         │
       │                           │                            │                         │
       │                           │  { id, token, ... }        │                         │
       │                           │◀───────────────────────────│                         │
       │                           │                            │                         │
       │                           │  7. Store in SQLite DB     │                         │
       │                           │  (encrypt token + apiToken)│                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │                           │  8. Install cloudflared    │                         │
       │                           │  cloudflared --protocol    │                         │
       │                           │    http2 service install   │                         │
       │                           │    <tunnelToken>           │                         │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │                         │
       │                           │  systemctl enable cloudflared                        │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │                         │
       │                           │  systemctl start cloudflared                         │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │                         │
       │                           │  9. Log audit event        │                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │  { id, name, tunnelId,    │                            │                         │
       │    status: "inactive" }   │                            │                         │
       │◀──────────────────────────│                            │                         │
       │                           │                            │                         │
       │  10. UI refreshes         │                            │    cloudflared connects │
       │      tunnel list          │                            │    to CF edge ◀────────│
```

### 4.2 Tunnel Start/Stop Flow

```
  User (Browser)              NovaPanel API                Cloudflare API            Server (systemd)
       │                           │                            │                         │
       │  ─── START FLOW ───       │                            │                         │
       │                           │                            │                         │
       │  POST /tunnel/start       │                            │                         │
       │──────────────────────────▶│                            │                         │
       │                           │  systemctl start cloudflared                        │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │      cloudflared starts │
       │                           │                            │      and connects to    │
       │                           │                            │      Cloudflare edge    │
       │                           │                            │                         │
       │                           │  Update DB: status=active  │                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │                           │  Log audit: tunnel.start   │                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │  { status: "active" }     │                            │                         │
       │◀──────────────────────────│                            │                         │
       │                           │                            │                         │
       │  ─── STOP FLOW ───        │                            │                         │
       │                           │                            │                         │
       │  POST /tunnel/stop        │                            │                         │
       │──────────────────────────▶│                            │                         │
       │                           │  systemctl stop cloudflared                         │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │      cloudflared stops  │
       │                           │                            │                         │
       │                           │  Update DB: status=inactive│                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │  { status: "inactive" }   │                            │                         │
       │◀──────────────────────────│                            │                         │
```

### 4.3 Route (Public Hostname) Configuration Flow

```
  User (Browser)              NovaPanel API                Cloudflare API
       │                           │                            │
       │  POST /tunnel/routes      │                            │
       │  { tunnelId, hostname,    │                            │
       │    service, noTlsVerify } │                            │
       │──────────────────────────▶│                            │
       │                           │                            │
       │                           │  1. Validate tunnel exists │
       │                           │──────────┐                 │
       │                           │◀─────────┘                 │
       │                           │                            │
       │                           │  2. Validate hostname zone │
       │                           │  GET /zones?name=<domain>  │
       │                           │───────────────────────────▶│
       │                           │◀───────────────────────────│
       │                           │  (ensures zone is active)  │
       │                           │                            │
       │                           │  3. Insert route into DB   │
       │                           │──────────┐                 │
       │                           │◀─────────┘                 │
       │                           │                            │
       │                           │  4. Update remote config   │
       │                           │  PUT /accounts/{id}/       │
       │                           │    cfd_tunnel/{id}/        │
       │                           │    configurations          │
       │                           │  { config: { ingress: [    │
       │                           │    { hostname, service,    │
       │                           │      originRequest },      │
       │                           │    { service: "404" }      │
       │                           │  ]}}                       │
       │                           │───────────────────────────▶│
       │                           │◀───────────────────────────│
       │                           │                            │
       │                           │  5. Create DNS CNAME       │
       │                           │  (auto, see 4.4)           │
       │                           │───────────────────────────▶│
       │                           │◀───────────────────────────│
       │                           │                            │
       │                           │  6. Auto-update PANEL_URL  │
       │                           │  (if current URL is private│
       │                           │   and route covers panel)  │
       │                           │──────────┐                 │
       │                           │◀─────────┘                 │
       │                           │                            │
       │                           │  7. Log audit event        │
       │                           │──────────┐                 │
       │                           │◀─────────┘                 │
       │                           │                            │
       │  { id, hostname, service }│                            │
       │◀──────────────────────────│                            │
       │                           │                            │
       │  NOTE: No service reload needed!                       │
       │  cloudflared picks up remote config changes            │
       │  automatically from Cloudflare's edge.                 │
```

### 4.4 DNS CNAME Configuration Flow

```
  NovaPanel API                              Cloudflare API
       │                                           │
       │  ─── AUTO CNAME (on route add) ───        │
       │                                           │
       │  1. Resolve zone ID                       │
       │     Use stored zoneId OR                  │
       │     GET /zones?name=<rootDomain>           │
       │──────────────────────────────────────────▶│
       │◀──────────────────────────────────────────│
       │                                           │
       │  2. Check for existing CNAME records      │
       │     GET /zones/{id}/dns_records           │
       │       ?name=<hostname>&type=CNAME         │
       │──────────────────────────────────────────▶│
       │◀──────────────────────────────────────────│
       │                                           │
       │  3. Delete existing CNAME records         │
       │     (if any found)                        │
       │     DELETE /zones/{id}/dns_records/{rid}  │
       │──────────────────────────────────────────▶│
       │◀──────────────────────────────────────────│
       │                                           │
       │  4. Create new CNAME record               │
       │     POST /zones/{id}/dns_records          │
       │     {                                     │
       │       type: "CNAME",                      │
       │       name: "panel.example.com",          │
       │       content: "<uuid>.cfargotunnel.com", │
       │       proxied: true                       │
       │     }                                     │
       │──────────────────────────────────────────▶│
       │◀──────────────────────────────────────────│
       │                                           │
       │  ─── MANUAL CNAME (POST /dns/cname) ──    │
       │                                           │
       │  POST /tunnel/dns/cname                   │
       │  { zoneId, hostname, target }             │
       │──────────────────────────────────────────▶│
       │  POST /zones/{id}/dns_records             │
       │  { type: "CNAME", name, content: target,  │
       │    proxied: true }                        │
       │──────────────────────────────────────────▶│
       │◀──────────────────────────────────────────│
```

### 4.5 Tunnel Deletion Flow

```
  User (Browser)              NovaPanel API                Cloudflare API            Server (filesystem)
       │                           │                            │                         │
       │  DELETE /tunnel/:id       │                            │                         │
       │──────────────────────────▶│                            │                         │
       │                           │                            │                         │
       │                           │  1. Stop cloudflared       │                         │
       │                           │     systemctl stop         │                         │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │                         │
       │                           │  2. Delete tunnel from CF  │                         │
       │                           │  DELETE /accounts/{id}/    │                         │
       │                           │    cfd_tunnel/{uuid}       │                         │
       │                           │───────────────────────────▶│                         │
       │                           │◀───────────────────────────│                         │
       │                           │                            │                         │
       │                           │  3. Uninstall cloudflared  │                         │
       │                           │     cloudflared service    │                         │
       │                           │       uninstall            │                         │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │                         │
       │                           │  4. Delete credentials     │                         │
       │                           │     /etc/cloudflared/      │                         │
       │                           │       {uuid}.json          │                         │
       │                           │     /root/.cloudflared/    │                         │
       │                           │       {uuid}.json          │                         │
       │                           │     /etc/cloudflared/      │                         │
       │                           │       config.yml           │                         │
       │                           │────────────────────────────────────────────────────▶│
       │                           │                            │                         │
       │                           │  5. Delete DNS CNAMEs      │                         │
       │                           │     for all tunnel routes  │                         │
       │                           │───────────────────────────▶│                         │
       │                           │◀───────────────────────────│                         │
       │                           │                            │                         │
       │                           │  6. Delete routes from DB  │                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │                           │  7. Delete tunnel from DB  │                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │                           │  8. Log audit event        │                         │
       │                           │──────────┐                 │                         │
       │                           │◀─────────┘                 │                         │
       │                           │                            │                         │
       │  { success: true }        │                            │                         │
       │◀──────────────────────────│                            │                         │
```

---

## 5. Database Schema

### Table: `cloudflare_tunnels`

Defined in [`tunnels.ts:5`](../apps/api/src/db/schema/tunnels.ts:5)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` (PK) | Internal NovaPanel ID (nanoid-generated) |
| `name` | `text` NOT NULL | Human-readable tunnel name (e.g., "my-server-tunnel") |
| `tunnel_id` | `text` | Cloudflare tunnel UUID (returned by CF API on creation) |
| `tunnel_token` | `text` | **AES-256-GCM encrypted** tunnel token (used for `cloudflared service install`) |
| `account_id` | `text` | Cloudflare account ID |
| `zone_id` | `text` | Cloudflare zone ID for DNS operations (optional) |
| `api_token` | `text` | **AES-256-GCM encrypted** Cloudflare API token |
| `credentials_json` | `text` | **AES-256-GCM encrypted** JSON (legacy, for old tunnels — unused in remote config) |
| `status` | `text` | Enum: `'active'` \| `'inactive'` \| `'error'` (default: `'inactive'`) |
| `created_at` | `integer` | Unix timestamp (auto-generated via `unixepoch()`) |

**TypeScript type:** `CloudflareTunnel` (inferred from table definition)

### Table: `tunnel_routes`

Defined in [`tunnels.ts:18`](../apps/api/src/db/schema/tunnels.ts:18)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` (PK) | Internal route ID (nanoid-generated) |
| `tunnel_id` | `text` NOT NULL, FK → `cloudflare_tunnels.id` | Parent tunnel (ON DELETE CASCADE) |
| `hostname` | `text` NOT NULL | Public hostname (e.g., `panel.example.com`) |
| `service` | `text` NOT NULL | Backend service URL (e.g., `http://localhost:8080`) |
| `no_tls_verify` | `integer` (boolean) | Skip TLS verification for self-signed certs (default: `false`) |
| `domain_id` | `text`, FK → `domains.id` | Optional link to NovaPanel domain record |
| `is_active` | `integer` (boolean) | Whether route is active in config (default: `true`) |
| `created_at` | `integer` | Unix timestamp (auto-generated) |

**TypeScript type:** `TunnelRoute` (inferred from table definition)

### Entity Relationship

```
  ┌──────────────────────┐        ┌──────────────────────┐
  │  cloudflare_tunnels  │        │    tunnel_routes     │
  ├──────────────────────┤        ├──────────────────────┤
  │ id (PK)         ◄────┼─── 1:N │ tunnel_id (FK)       │
  │ name                 │        │ id (PK)              │
  │ tunnel_id            │        │ hostname             │
  │ tunnel_token (enc.)  │        │ service              │
  │ account_id           │        │ no_tls_verify        │
  │ zone_id              │        │ domain_id (FK) ──────┼──► domains.id
  │ api_token (enc.)     │        │ is_active            │
  │ credentials_json     │        │ created_at           │
  │ status               │        └──────────────────────┘
  │ created_at           │
  └──────────────────────┘
```

---

## 6. Cloudflare API Integration

The tunnel service interacts with the following Cloudflare API v4 endpoints:

### Authentication

All Cloudflare API calls use Bearer token authentication:
```
Authorization: Bearer <api_token>
```

The API token is stored encrypted in the `cloudflare_tunnels.api_token` column and decrypted at runtime using [`decrypt()`](../apps/api/src/utils/crypto.ts:76).

### Endpoints Used

| CF API Endpoint | Method | Used In | Purpose |
|----------------|--------|---------|---------|
| `/accounts` | `GET` | [`getAccounts()`](../apps/api/src/modules/tunnel/tunnel.service.ts:147) | Resolve account ID when not provided |
| `/user/tokens/verify` | `GET` | [`validateUserToken()`](../apps/api/src/modules/tunnel/tunnel.service.ts:175) | Validate user-type API tokens |
| `/accounts` | `GET` | [`validateAccountToken()`](../apps/api/src/modules/tunnel/tunnel.service.ts:201) | Validate account-type API tokens (cfat_ prefix) |
| `/zones` | `GET` | [`fetchZones()`](../apps/api/src/modules/tunnel/tunnel.service.ts:237) | List available zones for token |
| `/accounts/{id}/cfd_tunnel` | `POST` | [`setup()`](../apps/api/src/modules/tunnel/tunnel.service.ts:78) | Create new tunnel |
| `/accounts/{id}/cfd_tunnel/{id}` | `GET` | [`getTunnelInfo()`](../apps/api/src/modules/tunnel/tunnel.service.ts:294), [`getStatus()`](../apps/api/src/modules/tunnel/tunnel.service.ts:505) | Get tunnel health/connections |
| `/accounts/{id}/cfd_tunnel/{id}` | `DELETE` | [`deleteTunnel()`](../apps/api/src/modules/tunnel/tunnel.service.ts:362) | Delete tunnel from Cloudflare |
| `/accounts/{id}/cfd_tunnel/{id}/configurations` | `PUT` | [`updateRemoteConfig()`](../apps/api/src/modules/tunnel/tunnel.service.ts:811) | Update tunnel ingress rules (remote config) |
| `/zones?name=<domain>` | `GET` | [`validateHostnameZone()`](../apps/api/src/modules/tunnel/tunnel.service.ts:910), [`createDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:849), [`deleteDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:948) | Look up zone ID by domain name |
| `/zones/{id}/dns_records` | `GET` | [`createDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:868), [`deleteDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:965) | List existing DNS records |
| `/zones/{id}/dns_records` | `POST` | [`createDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:882), [`createPublicDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:1053) | Create CNAME record |
| `/zones/{id}/dns_records/{id}` | `DELETE` | [`createDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:876), [`deleteDnsCname()`](../apps/api/src/modules/tunnel/tunnel.service.ts:980) | Delete DNS record |

### Remote Configuration Approach

The key architectural decision is using **`config_src: "cloudflare"`** when creating tunnels. This means:

1. **No local config.yml** — Route configuration is stored on Cloudflare's servers
2. **No service reload** — When routes change, `updateRemoteConfig()` pushes changes to Cloudflare API, and `cloudflared` picks them up automatically
3. **Token-based auth** — The tunnel token from the CF API response is used for `cloudflared service install`, eliminating the need for credentials files

### Required API Token Permissions

The Cloudflare API token needs the following permissions:
- **Account** → **Cloudflare Tunnel** → **Edit** (to create/manage tunnels)
- **Zone** → **DNS** → **Edit** (to create/manage CNAME records)
- **Zone** → **Zone Settings** → **Read** (for zone validation)

---

## 7. Service Management

### cloudflared as systemd Service

The `cloudflared` daemon runs as a systemd service managed by NovaPanel:

```bash
# Installation (during tunnel setup)
cloudflared --protocol http2 service install <tunnel_token>
systemctl enable cloudflared
systemctl start cloudflared

# Start
systemctl start cloudflared

# Stop
systemctl stop cloudflared

# Uninstallation (during tunnel deletion)
cloudflared service uninstall
```

All commands are executed with `sudo: true` via the [`run()`](../apps/api/src/services/executor.ts) executor.

### Protocol Selection

The tunnel is configured to use the **`http2`** protocol explicitly:

```typescript
await run('cloudflared', ['--protocol', 'http2', 'service', 'install', tunnelToken], { sudo: true });
```

This is specified at [`tunnel.service.ts:120`](../apps/api/src/modules/tunnel/tunnel.service.ts:120). The `http2` protocol is chosen over the default `quic` for:
- Better compatibility with proxy environments
- More predictable behavior behind corporate firewalls
- Wider support across Cloudflare edge locations

### Status Detection

The [`getStatus()`](../apps/api/src/modules/tunnel/tunnel.service.ts:470) method provides a three-tier status:

| Status | Meaning |
|--------|---------|
| `active` | Process running **and** connected to Cloudflare edge (has active connections) |
| `degraded` | Process running but **not** connected to edge (no active connections) |
| `inactive` | Process is not running |

Detection logic:
1. Run `systemctl is-active cloudflared` to check if process is running
2. If running, query Cloudflare API for each tunnel's connection status
3. Check `connections.length > 0` for edge connectivity
4. Use `conns_active_at` (not `created_at`) for last connected timestamp

### File Cleanup on Deletion

When a tunnel is deleted, the following files are removed:

| Path | Description |
|------|-------------|
| `/etc/cloudflared/{uuid}.json` | Credentials file (legacy) |
| `/root/.cloudflared/{uuid}.json` | Credentials file (legacy, alternate location) |
| `/etc/cloudflared/config.yml` | Local config file (legacy) |

---

## 8. WebSocket Real-time Logs

### Architecture

Real-time log streaming uses a WebSocket connection established between the browser and the NovaPanel API:

```
  Browser                    NovaPanel API (WS)              journalctl
     │                            │                              │
     │  WS: /ws/tunnel/logs       │                              │
     │  ?tunnelId=xxx             │                              │
     │───────────────────────────▶│                              │
     │                            │                              │
     │                            │  Auth validation             │
     │                            │  (cookie/sessionHash/token)  │
     │                            │                              │
     │                            │  Verify tunnel exists in DB  │
     │                            │                              │
     │                            │  Spawn journalctl process:   │
     │                            │  journalctl -u cloudflared   │
     │                            │    -f -n 100                 │
     │                            │─────────────────────────────▶│
     │                            │                              │
     │  { type: "connected",      │                              │
     │    data: { tunnelId,       │                              │
     │      tunnelName } }        │                              │
     │◀───────────────────────────│                              │
     │                            │                              │
     │                            │  stdout data ◀──────────────│
     │  { type: "log",            │                              │
     │    data: "...",            │                              │
     │    timestamp: "..." }      │                              │
     │◀───────────────────────────│                              │
     │                            │                              │
     │  ... more log lines ...    │                              │
     │◀───────────────────────────│                              │
     │                            │                              │
     │  { type: "ping" }          │                              │
     │───────────────────────────▶│                              │
     │  { type: "pong" }          │                              │
     │◀───────────────────────────│                              │
     │                            │                              │
     │  WS close                  │                              │
     │───────────────────────────▶│  Kill journalctl process     │
     │                            │─────────────────────────────▶│
```

### WebSocket Endpoint

**URL:** `ws(s)://<host>/api/v1/ws/tunnel/logs?tunnelId=<id>`

Defined in [`tunnel.ws.ts:20`](../apps/api/src/modules/tunnel/tunnel.ws.ts:20).

### Authentication

WebSocket authentication supports three methods (in priority order):

1. **Session cookie** (`sf_session`) — Preferred, automatic in browsers
2. **Session hash** (`?sessionHash=<sha256>`) — Hash-based WS auth
3. **API token** (`?token=<api_token>`) — Direct API token

All methods require **admin role**. See [`validateAuth()`](../apps/api/src/modules/tunnel/tunnel.ws.ts:142).

### Message Types

| Direction | Type | Description |
|-----------|------|-------------|
| Server → Client | `connected` | Initial connection confirmation with tunnel info |
| Server → Client | `log` | Log line from journalctl with timestamp |
| Server → Client | `error` | Error from log tail process |
| Server → Client | `closed` | Log stream ended |
| Client → Server | `ping` | Keep-alive ping |
| Server → Client | `pong` | Keep-alive pong |

### Session Management

- Active sessions tracked in `activeLogSessions` Map (keyed by `{tunnelId}-{timestamp}`)
- **Stale session cleanup**: Sessions older than 30 minutes are automatically closed via [`cleanupStaleLogSessions()`](../apps/api/src/modules/tunnel/tunnel.ws.ts:181)
- The `journalctl` child process is killed when the WebSocket closes

### Log Source

Logs are tailed from systemd journal:

```bash
journalctl -u cloudflared -f -n 100
```

- `-u cloudflared` — Filter to cloudflared service unit
- `-f` — Follow (stream new entries)
- `-n 100` — Show last 100 lines on connect

---

## 9. Frontend Features

The tunnel management UI is in [`TunnelsPage.tsx`](../apps/web/src/pages/tunnels/TunnelsPage.tsx) and uses TanStack Query hooks from [`tunnel.ts`](../apps/web/src/api/hooks/tunnel.ts).

### 9.1 Setup Wizard (3-Step)

A modal wizard for creating new tunnels with three steps:

| Step | Component | Description |
|------|-----------|-------------|
| **Token** | [`SetupModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:13) | Enter Cloudflare API token, validates it, fetches zones |
| **Zone** | Same modal | Select a Cloudflare zone (domain) — optional, can skip |
| **Name** | Same modal | Enter tunnel name, submits creation request |

Step indicator shows progress with dots and connecting lines. The "creating" step shows a loading spinner.

### 9.2 Tunnel Card

The [`TunnelCard`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:416) component displays:

- **Tunnel name** and truncated tunnel ID
- **Status badge** (Running/Stopped) with color coding
- **Connection count** from Cloudflare API (when running)
- **Action buttons**: View config, Start/Stop, Delete
- **Routes section**: List of configured routes with edit/toggle/delete actions
- **Live Logs section**: Collapsible real-time log viewer (only shown when running)

### 9.3 Route Management

#### Add Route Modal ([`AddRouteModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:191))

- **Public Hostname** input (e.g., `ssh.example.com`)
- **Service URL** input with presets:
  - HTTP → `http://localhost:80`
  - HTTPS → `https://localhost:443`
  - Custom (free-form)
- **Skip TLS verification** checkbox (for self-signed certs)
- Note: DNS CNAME is auto-created by the backend

#### Edit Route Modal ([`EditRouteModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:278))

- Edit hostname, service URL, and TLS verify setting
- DNS CNAME is automatically updated if hostname changes

#### Route Toggle

- Enable/disable routes without deleting them
- Disabled routes are excluded from the Cloudflare remote config

### 9.4 Config Preview Modal ([`ConfigPreviewModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:350))

- Shows the tunnel's ingress configuration as JSON
- Displays the active routes and catch-all rule
- Read-only view for debugging

### 9.5 Delete Tunnel Modal ([`DeleteTunnelModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:376))

- Confirmation dialog before deletion
- Warns that action cannot be undone

### 9.6 Expose Panel Modal ([`ExposePanelModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:606))

- Quick-action to expose the NovaPanel web interface
- Pre-configured to route to `http://localhost:8443`
- Only requires entering a public hostname

### 9.7 Quick Expose Domains

When an active tunnel exists and domains are configured:

- Shows a "Quick Expose Domains" section listing all domains
- One-click "Expose via Tunnel" button for each domain
- Auto-detects SSL status and uses HTTPS service URL if SSL is enabled
- Shows "Exposed" badge for domains that already have routes
- When no tunnel exists, shows a preview of domains that can be exposed

### 9.8 TanStack Query Hooks

All hooks are defined in [`tunnel.ts`](../apps/web/src/api/hooks/tunnel.ts):

| Hook | Type | Query Key | Endpoint |
|------|------|-----------|----------|
| [`useTunnelStatus()`](../apps/web/src/api/hooks/tunnel.ts:53) | Query | `['tunnel', 'status']` | `GET /tunnel/status` |
| [`useTunnelRoutes()`](../apps/web/src/api/hooks/tunnel.ts:87) | Query | `['tunnel', 'routes']` | `GET /tunnel/routes` |
| [`useTunnelInfo(id)`](../apps/web/src/api/hooks/tunnel.ts:94) | Query | `['tunnel', 'info', id]` | `GET /tunnel/:id/info` |
| [`useTunnelConfig(id)`](../apps/web/src/api/hooks/tunnel.ts:102) | Query | `['tunnel', 'config', id]` | `GET /tunnel/:id/config` |
| [`useValidateToken()`](../apps/web/src/api/hooks/tunnel.ts:110) | Mutation | — | `POST /tunnel/validate-token` |
| [`useFetchZones()`](../apps/web/src/api/hooks/tunnel.ts:116) | Mutation | — | `POST /tunnel/fetch-zones` |
| [`useSetupTunnel()`](../apps/web/src/api/hooks/tunnel.ts:123) | Mutation | invalidates `['tunnel']` | `POST /tunnel/setup` |
| [`useDeleteTunnel()`](../apps/web/src/api/hooks/tunnel.ts:132) | Mutation | invalidates `['tunnel']` | `DELETE /tunnel/:id` |
| [`useStartTunnel()`](../apps/web/src/api/hooks/tunnel.ts:140) | Mutation | invalidates `['tunnel']` | `POST /tunnel/start` |
| [`useStopTunnel()`](../apps/web/src/api/hooks/tunnel.ts:148) | Mutation | invalidates `['tunnel']` | `POST /tunnel/stop` |
| [`useAddTunnelRoute()`](../apps/web/src/api/hooks/tunnel.ts:156) | Mutation | invalidates `['tunnel']` | `POST /tunnel/routes` |
| [`useEditTunnelRoute()`](../apps/web/src/api/hooks/tunnel.ts:165) | Mutation | invalidates `['tunnel']` | `PUT /tunnel/routes/:id` |
| [`useDeleteTunnelRoute()`](../apps/web/src/api/hooks/tunnel.ts:174) | Mutation | invalidates `['tunnel']` | `DELETE /tunnel/routes/:id` |
| [`useToggleTunnelRoute()`](../apps/web/src/api/hooks/tunnel.ts:182) | Mutation | invalidates `['tunnel']` | `POST /tunnel/routes/:id/toggle` |
| [`useCreateDnsCname()`](../apps/web/src/api/hooks/tunnel.ts:190) | Mutation | — | `POST /tunnel/dns/cname` |
| [`useTunnelLogs(id)`](../apps/web/src/api/hooks/tunnel.ts:197) | WS Hook | — | `WS /ws/tunnel/logs` |

All mutation hooks invalidate the `['tunnel']` query key on success, causing all tunnel-related queries to refetch.

### 9.9 WebSocket Log Hook

[`useTunnelLogs(tunnelId)`](../apps/web/src/api/hooks/tunnel.ts:197) manages a WebSocket connection:

- Auto-connects when `tunnelId` is provided
- Uses `ws:` or `wss:` protocol based on page protocol
- Accumulates log entries in state (array of `{ data, timestamp }`)
- Returns `{ logs, isConnected, error }`
- Auto-closes WebSocket on unmount

---

## 10. Error Handling

### Error Propagation Chain

```
  cloudflared / Cloudflare API
       │
       │  Raw error (HTTP status, JSON error body)
       ▼
  tunnel.service.ts
       │
       │  Transforms to AppError / StructuredError
       │  Uses createTunnelError() for user-friendly messages
       ▼
  tunnel.routes.ts
       │
       │  Catches errors, returns { success: false, error: message }
       │  Sets appropriate HTTP status code
       ▼
  Frontend (api/client.ts)
       │
       │  Throws on non-success responses
       ▼
  TanStack Query mutation
       │
       │  onError callback
       ▼
  Toast notification
       │
       │  toast.error(message) — displayed to user
       ▼
```

### Error Classes

| Class | Source | Usage |
|-------|--------|-------|
| [`AppError`](../apps/api/src/errors.ts:1) | `errors.ts` | Base error with `statusCode`, `code`, `message` |
| [`StructuredError`](../apps/api/src/utils/error-messages.ts:39) | `error-messages.ts` | Extends `AppError` with `title`, `suggestion`, `cause` |

### Error Transformation

[`createTunnelError()`](../apps/api/src/utils/error-messages.ts:264) transforms raw Cloudflare errors into structured errors:

1. Raw error string is passed to [`transformTunnelError()`](../apps/api/src/utils/error-messages.ts:121)
2. Error is classified by type: `auth`, `dns`, `config`, `network`, or `unknown`
3. A `StructuredError` is created with:
   - Human-readable **title** (e.g., "Authentication failed")
   - Descriptive **message** with original error
   - Actionable **suggestion** (e.g., "Check that your Cloudflare API token is valid...")
   - Error **code** combining operation and type (e.g., `TUNNEL_CREATE_FAILED_AUTH`)

### Tunnel Error Classifications

| Error Type | Trigger Patterns | Title |
|------------|-----------------|-------|
| `auth` | "auth", "unauthorized", "invalid", "forbidden" | "Authentication failed" |
| `dns` | "dns", "cname", "record exists", "record already exists" | "DNS record conflict" |
| `config` | "tunnel not found", "not exist", "does not exist" | "Tunnel not found" |
| `network` | "timeout", "connection", "network" | "Network error" |
| `unknown` | (fallback) | "Tunnel operation failed" |

### Specific Error Codes

| Code | HTTP Status | When |
|------|-------------|------|
| `NO_ACCOUNTS` | 400 | API token has no Cloudflare accounts |
| `INVALID_TOKEN` | 400 | Token validation failed |
| `INSUFFICIENT_PERMISSIONS` | 400 | Token lacks required permissions |
| `TUNNEL_CREATE_FAILED` | 422 | Cloudflare tunnel creation failed |
| `TUNNEL_NOT_FOUND` | 404 | Tunnel not found in database |
| `ROUTE_NOT_FOUND` | 404 | Route not found in database |
| `CONFIG_UPDATE_FAILED` | 500 | Failed to update remote config |
| `ZONE_NOT_FOUND` | 422 | Hostname's domain not in Cloudflare |
| `ZONE_NOT_ACTIVE` | 400 | Zone exists but not active |
| `DNS_CNAME_FAILED` | 422 | DNS CNAME creation failed |
| `NO_TUNNEL` | 400 | No tunnel configured for DNS operation |
| `VALIDATION_FAILED` | 500 | CF API validation call failed |
| `FETCH_ZONES_ERROR` | 500 | Error fetching zones |
| `ZONE_VALIDATION_ERROR` | 500 | Zone validation API call failed |

### Graceful Degradation

The service handles errors gracefully in several places:

- **`getTunnelInfo()`**: Falls back to database data if Cloudflare API call fails
- **`getStatus()`**: Returns `degraded` status if process is running but edge connectivity check fails
- **`deleteTunnel()`**: Continues cleanup even if Cloudflare API deletion fails (logs warning)
- **`createDnsCname()`**: Silently catches errors (logs warning) — tunnel still works without CNAME
- **`deleteDnsCname()`**: Silently catches errors (logs warning)
- **`updatePanelUrlIfNeeded()`**: Silently catches errors (logs warning)

---

## 11. Configuration Details

### Protocol: http2 vs quic

The tunnel is explicitly configured to use the `http2` protocol:

```typescript
// tunnel.service.ts:120
await run('cloudflared', ['--protocol', 'http2', 'service', 'install', tunnelToken], { sudo: true });
```

This is set at tunnel creation time and cannot be changed after creation without re-creating the tunnel.

### Token Encryption

Sensitive tokens are encrypted at rest using **AES-256-GCM**:

```typescript
// crypto.ts - Encryption
encrypt(plaintext: string): string
// Returns: "iv:authTag:ciphertext" (hex-encoded, colon-separated)

// crypto.ts - Decryption
decrypt(ciphertext: string): string
// Parses: iv, authTag, ciphertext from colon-separated hex string
```

The encryption key is derived from the `SF_ENCRYPTION_KEY` environment variable (64 hex characters = 256-bit key).

**Encrypted fields in database:**
- `cloudflare_tunnels.tunnel_token` — Cloudflare tunnel token
- `cloudflare_tunnels.api_token` — Cloudflare API token
- `cloudflare_tunnels.credentials_json` — Legacy credentials (unused in remote config)

### PANEL_URL Auto-Update

When a tunnel route is added, NovaPanel checks if the `PANEL_URL` environment variable should be updated:

```typescript
// tunnel.service.ts:998-1039
private async updatePanelUrlIfNeeded(hostname: string): Promise<void>
```

**Logic:**
1. Read current `PANEL_URL` from `env.PANEL_URL`
2. Check if it's a private IP using [`isPrivateUrl()`](../apps/api/src/utils/network.ts:159)
   - Private IPs: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `127.x.x.x`, `169.254.x.x`
3. If private, update `.env` file: `PANEL_URL=https://{hostname}`
4. Also update `process.env.PANEL_URL` at runtime
5. Write updated `.env` using `sudoFs.writeFile()` (requires elevated permissions)

This ensures that after exposing the panel via a tunnel, the application knows its new public URL for generating correct redirects, webhook URLs, etc.

### Environment Variables

| Variable | Purpose | Used In |
|----------|---------|---------|
| `SF_ENCRYPTION_KEY` | 256-bit hex key for AES-256-GCM encryption | [`crypto.ts`](../apps/api/src/utils/crypto.ts:64) |
| `PANEL_URL` | Public URL of the NovaPanel instance | [`tunnel.service.ts`](../apps/api/src/modules/tunnel/tunnel.service.ts:999) |

### Zod Validation Schemas

Defined in [`tunnel.schema.ts`](../apps/api/src/modules/tunnel/tunnel.schema.ts):

```typescript
// Setup tunnel
setupTunnelSchema = {
  name: string (1-64 chars),     // Tunnel name
  apiToken: string (min 1),      // CF API token
  accountId: string (optional),  // CF account ID
  zoneId: string (optional),     // CF zone ID for DNS
}

// Add route
addRouteSchema = {
  tunnelId: string,              // NovaPanel tunnel ID
  hostname: string (min 1),      // Public hostname
  service: string (min 1),       // Backend service URL
  noTlsVerify: boolean (default false), // Skip TLS verification
  domainId: string (optional),   // Link to NovaPanel domain
}

// Edit route
editRouteSchema = {
  hostname: string (optional),
  service: string (optional),
  noTlsVerify: boolean (optional),
}
```

### Audit Logging

All tunnel operations log audit events via [`auditService.log()`](../apps/api/src/modules/audit/audit.service.ts):

| Action | Trigger | Details Logged |
|--------|---------|----------------|
| `tunnel.setup` | Tunnel created | `tunnelId`, `accountId` |
| `tunnel.delete` | Tunnel deleted | Tunnel name |
| `tunnel.start` | Service started | — |
| `tunnel.stop` | Service stopped | — |
| `tunnel.route.add` | Route added | `hostname`, `service`, `noTlsVerify` |
| `tunnel.route.edit` | Route edited | Updated fields |
| `tunnel.route.delete` | Route deleted | Route ID |
| `tunnel.route.toggle` | Route toggled | `isActive` status |

All audit entries include `userId` and `ipAddress`.
