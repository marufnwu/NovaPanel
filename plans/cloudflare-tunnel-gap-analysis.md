# Cloudflare Tunnel API Gap Analysis

> Comprehensive comparison of NovaPanel's tunnel implementation against the full Cloudflare Tunnel API capabilities.

**Date**: 2026-05-05  
**Scope**: All tunnel-related files in `apps/api/src/modules/tunnel/`, `apps/web/src/`, and existing plan documents.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [CF API Endpoint Coverage](#2-cf-api-endpoint-coverage)
3. [Configuration Options Gap](#3-configuration-options-gap)
4. [Service Protocol Support](#4-service-protocol-support)
5. [Connection Management](#5-connection-management)
6. [Tunnel Lifecycle Management](#6-tunnel-lifecycle-management)
7. [Monitoring and Logging](#7-monitoring-and-logging)
8. [Security Features](#8-security-features)
9. [Architecture Gaps](#9-architecture-gaps)
10. [Priority Matrix](#10-priority-matrix)

---

## 1. Executive Summary

NovaPanel implements approximately **30% of the full Cloudflare Tunnel API surface**. The implementation covers the essential CRUD operations and remote configuration but misses significant capabilities in connection management, advanced routing, security policies, monitoring, and multi-tunnel architecture.

### Coverage at a Glance

| Category | CF API Features | NovaPanel Coverage | Gap % |
|---|---|---|---|
| Tunnel CRUD Endpoints | 5 | 3 | 40% |
| Configuration Endpoints | 2 | 1 | 50% |
| Connection Endpoints | 2 | 0 | 0% |
| Token/Management Endpoints | 2 | 0 | 0% |
| originRequest Options | 12 | 1 | 8% |
| Service Protocols | 9 | 3 | 33% |
| Path-based Routing | 1 | 0 | 0% |
| WARP Routing | 1 | 0 | 0% |
| Global originRequest | 1 | 0 | 0% |

---

## 2. CF API Endpoint Coverage

### 2.1 Tunnels CRUD

| # | CF API Endpoint | Method | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `/accounts/{id}/cfd_tunnel` | `GET` | ❌ Not implemented | **Medium** | Cannot list all tunnels from CF account; only shows tunnels in local DB | Simple | Supports `is_deleted`, `name`, `uuid`, `is_recently_active` filters. Useful for discovering tunnels created outside NovaPanel. |
| 2 | `/accounts/{id}/cfd_tunnel` | `POST` | ✅ Implemented | — | — | — | Used in [`setup()`](../apps/api/src/modules/tunnel/tunnel.service.ts:78). Sends `name` and `config_src: "cloudflare"`. |
| 3 | `/accounts/{id}/cfd_tunnel/{id}` | `GET` | ✅ Implemented | — | — | — | Used in [`getTunnelInfo()`](../apps/api/src/modules/tunnel/tunnel.service.ts:294) and [`getStatus()`](../apps/api/src/modules/tunnel/tunnel.service.ts:505). Returns status, connections, timestamps. |
| 4 | `/accounts/{id}/cfd_tunnel/{id}` | `PATCH` | ❌ Not implemented | **High** | Cannot rename tunnels, rotate tunnel secrets, or update metadata | Simple | Supports updating `name`, `tunnel_secret`, `metadata`. Critical for secret rotation security practice. |
| 5 | `/accounts/{id}/cfd_tunnel/{id}` | `DELETE` | ✅ Implemented | — | — | — | Used in [`deleteTunnel()`](../apps/api/src/modules/tunnel/tunnel.service.ts:362). Does not use `cascade` query param. |

**Gap Detail for #1 — List Tunnels**:
- CF API supports listing all tunnels with filters like `is_deleted=false`, `name=...`, `is_recently_active=true`
- NovaPanel only shows tunnels stored in its local SQLite DB
- Tunnels created via `cloudflared` CLI or Cloudflare Dashboard are invisible to NovaPanel
- **User Impact**: Users with pre-existing tunnels cannot manage them through NovaPanel

**Gap Detail for #4 — Update Tunnel**:
- CF API supports `PATCH` for renaming, secret rotation, and metadata updates
- NovaPanel has no mechanism to rename a tunnel after creation
- Secret rotation is a security best practice — without it, compromised secrets require full tunnel recreation
- **User Impact**: Cannot rename tunnels or rotate secrets without deleting and recreating

### 2.2 Configurations — Remote Config

| # | CF API Endpoint | Method | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 6 | `/accounts/{id}/cfd_tunnel/{id}/configurations` | `GET` | ❌ Not implemented | **Medium** | Cannot view the actual live config on CF side; only shows local DB representation | Simple | The current [`getTunnelConfig()`](../apps/api/src/modules/tunnel/tunnel.service.ts:440) reads from local DB, not from CF API. This can be stale or incorrect. |
| 7 | `/accounts/{id}/cfd_tunnel/{id}/configurations` | `PUT` | ✅ Partially implemented | — | — | — | Used in [`updateRemoteConfig()`](../apps/api/src/modules/tunnel/tunnel.service.ts:780). Only sends `ingress` array with `hostname`, `service`, and `noTLSVerify`. Missing all other `originRequest` fields, `warp-routing`, and `path` fields. |

**Gap Detail for #6 — Get Live Configuration**:
- The current `getTunnelConfig()` builds config from local DB records, which may diverge from what's actually on Cloudflare
- No way to detect config drift between local DB and CF remote config
- **User Impact**: Config preview may show incorrect/stale information

**Gap Detail for #7 — Set Configuration**:
- Only 3 fields sent per ingress rule: `hostname`, `service`, `originRequest.noTLSVerify`
- Missing 11 other `originRequest` options, `path` field, global `originRequest`, and `warp-routing`
- **User Impact**: Advanced routing configurations are impossible through NovaPanel

### 2.3 Connections

| # | CF API Endpoint | Method | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 8 | `/accounts/{id}/cfd_tunnel/{id}/connections` | `GET` | ❌ Not implemented | **High** | No visibility into active connections: client_id, client_version, edge_ip, origin_ip, opened_at, is_pending_reconnect | Simple | Connection data is partially available via the tunnel detail GET endpoint but not queried directly. The dedicated connections endpoint provides richer data. |
| 9 | `/accounts/{id}/cfd_tunnel/{id}/connections` | `DELETE` | ❌ Not implemented | **Medium** | Cannot cleanup stale connections; stale connections may prevent tunnel restart | Simple | Accepts `client_id` in body. Useful when cloudflared crashes without cleanly closing connections. |

**Gap Detail for #8 — List Connections**:
- Shows detailed per-connection data: `client_id`, `client_version`, `edge_ip`, `origin_ip`, `opened_at`, `is_pending_reconnect`
- NovaPanel shows a connection count but no connection details
- **User Impact**: Cannot diagnose which edge PoP a tunnel is connected to, or detect stale/reconnecting connections

**Gap Detail for #9 — Cleanup Stale Connections**:
- When cloudflared crashes, connections may remain registered on CF side
- These stale connections can prevent the tunnel from being properly restarted
- The `cascade` query param on tunnel DELETE also helps with this
- **User Impact**: Tunnel may fail to reconnect after a crash until stale connections expire

### 2.4 Token

| # | CF API Endpoint | Method | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 10 | `/accounts/{id}/cfd_tunnel/{id}/token` | `GET` | ❌ Not implemented | **High** | Cannot retrieve tunnel token after initial creation; if token is lost, tunnel must be recreated | Simple | The token from tunnel creation is stored encrypted in DB, but if DB is corrupted or token needs to be re-fetched, there is no fallback. |

**Gap Detail for #10 — Get Tunnel Token**:
- NovaPanel stores the tunnel token from creation in encrypted DB column
- If the DB record is lost/corrupted, the token cannot be recovered
- CF API provides a way to retrieve the token at any time
- Also needed for re-installing cloudflared on a new server
- **User Impact**: DB corruption or server migration requires full tunnel recreation

### 2.5 Connectors

| # | CF API Endpoint | Method | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 11 | `/accounts/{id}/cfd_tunnel/{id}/connectors/{connector_id}` | `GET` | ❌ Not implemented | **Low** | No visibility into individual connector details | Simple | Shows `tunnel_id`, `tunnel_name`, `client_id`, `client_version`, `edge_ip`, `origin_ip`, `virtual_network_id`. Mainly useful for multi-connector setups. |

### 2.6 Management

| # | CF API Endpoint | Method | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 12 | `/accounts/{id}/cfd_tunnel/{id}/management` | `POST` | ❌ Not implemented | **Low** | Cannot stream management events/logs from cloudflared programmatically | Medium | Accepts `client_id` in body. Returns a management token for streaming events. This is for advanced programmatic management, not essential for panel UI. |

---

## 3. Configuration Options Gap

### 3.1 originRequest Options

The CF API supports 12 `originRequest` fields that can be set **globally** (apply to all ingress rules) or **per-rule** (override global settings). NovaPanel exposes only 1 of 12.

| # | Option | Type | Default | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `access` | `object` | `{required: false}` | ❌ Not implemented | **High** | Cannot configure Zero Trust access policies per route | Medium | Contains `required`, `teamName`, `audTag[]`. Critical for securing admin panels, internal APIs, staging environments. |
| 2 | `caPool` | `string` | `""` | ❌ Not implemented | **Medium** | Cannot specify custom CA certificates for origin validation | Simple | Path to CA certificate bundle. Needed when origin uses a private CA. |
| 3 | `connectTimeout` | `number` | `30` | ❌ Not implemented | **Medium** | No control over origin connection timeout | Simple | Seconds. Useful for slow origins or high-latency backends. |
| 4 | `disableChunkedEncoding` | `boolean` | `false` | ❌ Not implemented | **Low** | Cannot disable chunked transfer encoding | Simple | Needed for origins that do not support chunked encoding. |
| 5 | `http2Origin` | `boolean` | `false` | ❌ Not implemented | **Medium** | Cannot enable HTTP/2 to origin | Simple | Enables HTTP/2 connection to origin server. Useful for gRPC or HTTP/2 backends. |
| 6 | `httpHostHeader` | `string` | `""` | ❌ Not implemented | **High** | Cannot set custom Host header sent to origin | Simple | Critical for virtual hosting where origin expects a specific Host header. Very common requirement. |
| 7 | `keepAliveConnections` | `number` | `0` | ❌ Not implemented | **Low** | No control over connection pooling | Simple | Max idle connections to keep. Performance tuning for high-traffic tunnels. |
| 8 | `keepAliveTimeout` | `number` | `0` | ❌ Not implemented | **Low** | No control over keep-alive timeout | Simple | Timeout in seconds for idle connections. Performance tuning. |
| 9 | `noTLSVerify` | `boolean` | `false` | ✅ Implemented | — | — | — | Only originRequest option exposed. Stored as `noTlsVerify` in DB and sent as `noTLSVerify` in CF API. |
| 10 | `originServerName` | `string` | `""` | ❌ Not implemented | **Medium** | Cannot set SNI for TLS handshake | Simple | Server name used during TLS handshake to origin. Needed when origin cert CN differs from hostname. |
| 11 | `proxyType` | `string` | `""` | ❌ Not implemented | **Low** | Cannot configure SOCKS proxy | Simple | Set to `"socks"` for SOCKS5 proxy. Niche use case. |
| 12 | `tcpKeepAlive` | `number` | `0` | ❌ Not implemented | **Low** | No control over TCP keep-alive interval | Simple | Seconds. Connection reliability tuning. |
| 13 | `tlsTimeout` | `number` | `0` | ❌ Not implemented | **Low** | No control over TLS handshake timeout | Simple | Seconds. Connection reliability tuning. |

**Summary**: 1/12 originRequest options implemented (8% coverage).

### 3.2 Global vs Per-Rule originRequest

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Global `originRequest` config | ❌ Not implemented | **Medium** | Cannot set defaults for all ingress rules; must repeat settings per route | Simple |
| Per-rule `originRequest` override | ❌ Only `noTLSVerify` | **High** | Most origin settings cannot be customized per route | Medium |

**Current behavior**: [`updateRemoteConfig()`](../apps/api/src/modules/tunnel/tunnel.service.ts:780) only adds `originRequest` to ingress rules when `noTlsVerify` is true. No global `originRequest` is ever sent.

### 3.3 Path-based Routing

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| `path` field on ingress rules | ❌ Not implemented | **High** | Cannot route based on URL path; all traffic for a hostname goes to one service | Medium |

**Gap Detail**:
- CF API supports a `path` field on each ingress rule (e.g., `/api` routes only `/api/*` to that service)
- This enables patterns like:
  - `app.example.com` → `http://localhost:3000` (frontend)
  - `app.example.com/api` → `http://localhost:8080` (API)
  - `app.example.com/ws` → `http://localhost:9090` (WebSocket)
- Currently NovaPanel only supports hostname-level routing
- **User Impact**: Users must use separate subdomains for each service instead of path-based routing

### 3.4 WARP Routing

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| `warp-routing.enabled` | ❌ Not implemented | **Low** | Cannot enable WARP routing for private network access | Medium |

**Gap Detail**:
- WARP routing allows tunneling private network traffic through Cloudflare WARP
- This is a separate feature from public hostname routing
- Useful for accessing internal services without exposing them publicly
- **User Impact**: Niche feature; most users need public hostname routing only

### 3.5 Ingress Rule Ordering

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Route matching priority/ordering | ❌ Not implemented | **High** | CF matches ingress rules top-to-bottom; NovaPanel sends routes in DB order with no control | Medium |

**Gap Detail**:
- Cloudflare evaluates ingress rules in order and uses the first match
- Path-based rules must come before less-specific rules
- NovaPanel currently sends routes in arbitrary DB order
- No UI for reordering routes
- **User Impact**: With path-based routing, incorrect order causes wrong routing

---

## 4. Service Protocol Support

The CF API supports 9 service protocol schemes. NovaPanel supports 3 (33%).

| # | Protocol | Scheme | NovaPanel Status | Priority | Impact | Complexity | Notes |
|---|---|---|---|---|---|---|---|
| 1 | HTTP | `http://` | ✅ Supported | — | — | — | Primary protocol. Used for most web services. |
| 2 | HTTPS | `https://` | ✅ Supported | — | — | — | Used with TLS-enabled origins. Works with `noTLSVerify` for self-signed certs. |
| 3 | HTTP Status | `http_status:` | ✅ Partial | — | — | — | Only used for hardcoded catch-all `http_status:404`. Not available as user-selectable option. |
| 4 | TCP | `tcp://` | ❌ Not supported | **High** | Cannot tunnel arbitrary TCP services (databases, game servers, custom protocols) | Simple | Very common use case for database access. Just needs protocol selection in UI and schema validation. |
| 5 | SSH | `ssh://` | ❌ Not supported | **High** | Cannot tunnel SSH access through Cloudflare | Simple | Popular use case for secure remote access. Often combined with Cloudflare Access browser-rendered terminal. |
| 6 | RDP | `rdp://` | ❌ Not supported | **Medium** | Cannot tunnel Remote Desktop Protocol | Simple | Useful for Windows server management. Niche for Linux-focused panels. |
| 7 | Unix Socket | `unix://` | ❌ Not supported | **Medium** | Cannot connect to Unix domain sockets | Simple | Useful for Docker sockets, PHP-FPM via unix socket, or local service sockets. |
| 8 | Unix Socket + TLS | `unix+tls://` | ❌ Not supported | **Low** | Cannot connect to TLS-enabled Unix sockets | Simple | Very niche. |
| 9 | SMB | `smb://` | ❌ Not supported | **Low** | Cannot tunnel SMB/CIFS file sharing | Simple | Very niche for a web panel. |

**Current UI Limitation**: The [`AddRouteModal`](../apps/web/src/pages/tunnels/TunnelsPage.tsx:191) only offers HTTP/HTTPS presets with a free-form text input. There is no protocol selector, validation, or guidance for non-HTTP protocols.

**Current Schema Limitation**: The [`addRouteSchema`](../apps/api/src/modules/tunnel/tunnel.schema.ts:10) validates `service` as `z.string().min(1)` with no protocol validation. Any string is accepted.

---

## 5. Connection Management

### 5.1 Connection Visibility

| Feature | CF API | NovaPanel Status | Priority | Impact | Complexity |
|---|---|---|---|---|---|
| List active connections | `GET /connections` returns `client_id`, `client_version`, `edge_ip`, `origin_ip`, `opened_at`, `is_pending_reconnect` | ❌ Not implemented | **High** | No visibility into which edge PoPs the tunnel is connected to, connection health, or client versions | Simple |
| Connection count | Available via tunnel detail GET | ✅ Partial | — | — | — |
| Edge IP visibility | `edge_ip` field | ❌ Not implemented | **Medium** | Cannot see which Cloudflare edge locations serve the tunnel | Simple |
| Client version | `client_version` field | ❌ Not implemented | **Medium** | Cannot check if cloudflared is up to date | Simple |
| Connection age | `opened_at` field | ❌ Not implemented | **Low** | Cannot see how long connections have been active | Simple |
| Reconnect detection | `is_pending_reconnect` field | ❌ Not implemented | **Medium** | Cannot detect unstable connections that keep reconnecting | Simple |

### 5.2 Connection Operations

| Feature | CF API | NovaPanel Status | Priority | Impact | Complexity |
|---|---|---|---|---|---|
| Cleanup stale connections | `DELETE /connections` with `client_id` | ❌ Not implemented | **Medium** | Stale connections after crashes can prevent tunnel restart | Simple |
| Cascade delete | `DELETE /cfd_tunnel/{id}?cascade=true` | ❌ Not implemented | **Medium** | Tunnel deletion may fail if connections are active | Simple |

---

## 6. Tunnel Lifecycle Management

### 6.1 Creation

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Create with `config_src: "cloudflare"` | ✅ Implemented | — | — | — |
| Create with `tunnel_secret` | ❌ Not exposed | **Low** | NovaPanel uses the auto-generated secret; custom secrets not supported | Simple |
| Create with `metadata` | ❌ Not exposed | **Low** | Cannot attach custom metadata to tunnels | Simple |
| Multi-account tunnel creation | ⚠️ Partial | **Medium** | `accountId` can be specified but no account management UI exists | Medium |

### 6.2 Update

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Rename tunnel | ❌ Not implemented | **High** | Tunnel name is permanent after creation; users must delete and recreate to rename | Simple |
| Rotate tunnel secret | ❌ Not implemented | **Critical** | Compromised tunnel secrets cannot be rotated; full recreation required | Medium |
| Update metadata | ❌ Not implemented | **Low** | Cannot attach or modify custom metadata | Simple |

### 6.3 Token Management

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Store tunnel token from creation | ✅ Implemented | — | — | — |
| Retrieve token from CF API | ❌ Not implemented | **High** | Token cannot be recovered if DB is lost | Simple |
| Re-install cloudflared with token | ❌ No UI | **Medium** | Cannot re-install cloudflared on a new server using existing tunnel | Medium |

### 6.4 Deletion

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Delete tunnel from CF API | ✅ Implemented | — | — | — |
| Uninstall cloudflared service | ✅ Implemented | — | — | — |
| Delete DNS CNAME records | ✅ Implemented | — | — | — |
| Delete local DB records | ✅ Implemented | — | — | — |
| Cascade cleanup connections | ❌ Not used | **Medium** | Active connections may prevent clean deletion | Simple |
| Delete credentials files | ✅ Implemented | — | — | — |

---

## 7. Monitoring and Logging

### 7.1 Health Monitoring

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| On-demand status check | ✅ Implemented via [`getStatus()`](../apps/api/src/modules/tunnel/tunnel.service.ts:470) | — | — | — |
| Process running check | ✅ Implemented via `systemctl is-active` | — | — | — |
| Edge connectivity check | ✅ Implemented via CF API connection query | — | — | — |
| Periodic health polling | ❌ Not implemented | **Critical** | Tunnel can go down without anyone knowing until next manual check | Medium |
| Health history/timeline | ❌ Not implemented | **High** | No historical health data for diagnosing intermittent issues | Medium |
| Uptime percentage | ❌ Not implemented | **Medium** | No uptime metrics | Medium |
| Latency measurement | ❌ Not implemented | **Low** | No performance metrics | Simple |
| Auto-recovery/restart | ❌ Not implemented | **Critical** | Tunnel stays down after crash until manual intervention | Medium |

### 7.2 Logging

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Real-time log streaming | ✅ Implemented via WebSocket [`tunnel.ws.ts`](../apps/api/src/modules/tunnel/tunnel.ws.ts) | — | — | — |
| Log persistence | ❌ Not implemented | **Medium** | Log history lost when WebSocket disconnects | Medium |
| Log search/filter | ❌ Not implemented | **Medium** | Cannot search through logs for specific events | Medium |
| Log export | ❌ Not implemented | **Low** | Cannot download logs for external analysis | Simple |
| Structured log parsing | ❌ Not implemented | **Medium** | Raw journalctl text output; no level-based filtering | Medium |

### 7.3 Notifications

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Tunnel status change notifications | ❌ Not implemented | **Critical** | Users are not alerted when their publicly-exposed services go offline | Simple |
| Auto-recovery notifications | ❌ Not implemented | **High** | Users do not know if tunnel auto-recovered or failed | Simple |
| cloudflared version outdated | ❌ Not implemented | **Low** | No warning when cloudflared is out of date | Simple |

---

## 8. Security Features

### 8.1 Zero Trust Access Policies

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Per-route access policy | ❌ Not implemented | **High** | All routes are publicly accessible; no authentication layer | Complex |
| Email-based access | ❌ Not implemented | **High** | Cannot restrict access to specific email addresses | Complex |
| IP-based access | ❌ Not implemented | **Medium** | Cannot restrict access to specific IP ranges | Complex |
| Service token auth | ❌ Not implemented | **Medium** | Cannot use service tokens for machine-to-machine auth | Complex |
| Access group integration | ❌ Not implemented | **Low** | Cannot use CF Access groups | Complex |

**Gap Detail**: The `originRequest.access` field supports `{ required, teamName, audTag[] }` which enables Cloudflare Zero Trust. This is a major security feature that allows restricting tunnel access to authenticated users. Without it, any tunnel route is publicly accessible to anyone who knows the hostname.

### 8.2 TLS/SSL Settings

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Skip TLS verification | ✅ Implemented | — | — | — |
| Custom CA pool | ❌ Not implemented | **Medium** | Cannot validate origin certs from private CAs | Simple |
| Origin server name / SNI | ❌ Not implemented | **Medium** | Cannot handle SNI mismatches between hostname and cert CN | Simple |
| TLS timeout | ❌ Not implemented | **Low** | No control over TLS handshake timeout | Simple |

### 8.3 Token Security

| Feature | Status | Priority | Impact | Complexity |
|---|---|---|---|---|
| Encrypt tokens at rest | ✅ Implemented via AES-256-GCM | — | — | — |
| Token rotation | ❌ Not implemented | **Critical** | API tokens and tunnel secrets cannot be rotated | Medium |
| Token permission validation | ✅ Implemented via [`validateToken()`](../apps/api/src/modules/tunnel/tunnel.service.ts:165) | — | — | — |
| Minimum permission check | ❌ Not implemented | **Medium** | Does not verify token has specific required permissions (Tunnel:Edit, DNS:Edit) | Medium |

---

## 9. Architecture Gaps

### 9.1 Single cloudflared Service Limitation

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| All tunnels share one `cloudflared` systemd service | **Critical** | Start/stop affects ALL tunnels; cannot run tunnels independently | Large |

**Detail**: The [`start()`](../apps/api/src/modules/tunnel/tunnel.service.ts:560) and [`stop()`](../apps/api/src/modules/tunnel/tunnel.service.ts:582) methods run `systemctl start/stop cloudflared` globally. While the DB schema supports multiple tunnel records, only one can be active at a time because there is only one cloudflared service. This is the single most impactful architectural limitation.

### 9.2 No Background Health Worker

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| No scheduler/worker for periodic health checks | **Critical** | Tunnel health is only checked on-demand; no proactive monitoring | Medium |

### 9.3 Config Drift

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| Local DB can diverge from CF remote config | **High** | Config preview may be inaccurate; no sync mechanism | Medium |

**Detail**: If someone modifies the tunnel config via Cloudflare Dashboard or CLI, NovaPanel's local DB will not reflect those changes. There is no reconciliation mechanism.

### 9.4 No Tunnel Import/Discovery

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| Cannot import existing tunnels or discover tunnels created externally | **Medium** | Users with pre-existing tunnels must recreate them in NovaPanel | Medium |

### 9.5 No Route Ordering

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| Ingress rules sent in arbitrary DB order | **High** | CF matches rules top-to-bottom; wrong order causes incorrect routing | Medium |

### 9.6 No Configuration Validation

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| Routes pushed to CF API without pre-validation | **High** | Invalid config can cause tunnel errors or downtime | Medium |

### 9.7 No Diagnostics Tool

| Issue | Priority | Impact | Complexity |
|---|---|---|---|
| No way to diagnose tunnel connectivity issues | **Medium** | Users must manually check cloudflared logs, DNS, and service status | Medium |

---

## 10. Priority Matrix

### Critical Priority — Must Address

These gaps represent fundamental limitations that affect reliability, security, or core functionality.

| # | Gap | Category | User Impact |
|---|---|---|---|
| G1 | Single cloudflared service — cannot run multiple tunnels independently | Architecture | Start/stop breaks all tunnels |
| G2 | No periodic health monitoring — tunnel goes down silently | Monitoring | Services offline without alerting |
| G3 | No auto-recovery — tunnel stays down after crash | Monitoring | Requires manual intervention |
| G4 | No status change notifications | Monitoring | Users unaware of outages |
| G5 | Cannot rotate tunnel secret | Lifecycle | Security vulnerability |
| G6 | Cannot rotate API token | Lifecycle | Security vulnerability |

### High Priority — Should Address

These gaps significantly impact the user experience and are expected in professional tunnel management tools.

| # | Gap | Category | User Impact |
|---|---|---|---|
| G7 | Only 1/12 `originRequest` options exposed | Configuration | Cannot fine-tune origin connections |
| G8 | No `httpHostHeader` support | Configuration | Virtual hosting not possible |
| G9 | No path-based routing | Configuration | Must use separate subdomains |
| G10 | No TCP/SSH protocol support | Protocols | Cannot tunnel databases or SSH |
| G11 | No connection details visibility | Connections | Cannot diagnose connectivity |
| G12 | Cannot rename tunnel | Lifecycle | Must recreate to rename |
| G13 | Cannot retrieve token from CF API | Lifecycle | DB corruption requires recreation |
| G14 | No Zero Trust access policies | Security | All routes publicly accessible |
| G15 | No route ordering control | Architecture | Incorrect routing with path rules |
| G16 | No config drift detection | Architecture | Local and remote config may differ |
| G17 | No configuration validation | Architecture | Invalid config can cause downtime |
| G18 | No tunnel listing from CF API | CRUD | External tunnels invisible |
| G19 | No tunnel update via PATCH | CRUD | Cannot update name/secret/metadata |
| G20 | No live config read from CF API | Configuration | Config preview may be stale |
| G21 | No health history/timeline | Monitoring | Cannot diagnose intermittent issues |

### Medium Priority — Nice to Have

These gaps affect advanced use cases or provide incremental improvements.

| # | Gap | Category | User Impact |
|---|---|---|---|
| G22 | No `connectTimeout` control | Configuration | Cannot tune connection timeouts |
| G23 | No `http2Origin` support | Configuration | Cannot enable HTTP/2 to origin |
| G24 | No `originServerName` / SNI | Configuration | SNI mismatch issues |
| G25 | No `caPool` / custom CA | Configuration | Private CA validation not possible |
| G26 | No RDP protocol support | Protocols | No Remote Desktop tunneling |
| G27 | No Unix socket support | Protocols | Cannot connect to Docker/FPM sockets |
| G28 | No stale connection cleanup | Connections | Crashes may leave stale connections |
| G29 | No cascade delete | Lifecycle | Active connections may block deletion |
| G30 | No tunnel import/discovery | Architecture | Must recreate existing tunnels |
| G31 | No diagnostics tool | Architecture | Manual troubleshooting required |
| G32 | No log persistence/search | Logging | Log history lost on disconnect |
| G33 | No minimum permission check | Security | Token may lack required permissions |
| G34 | No global `originRequest` defaults | Configuration | Must repeat settings per route |
| G35 | No connector details | Connections | No visibility into connector info |

### Low Priority — Future Consideration

| # | Gap | Category | User Impact |
|---|---|---|---|
| G36 | No WARP routing | Configuration | Niche feature for private networks |
| G37 | No `disableChunkedEncoding` | Configuration | Needed for rare origin incompatibilities |
| G38 | No `keepAliveConnections` / `keepAliveTimeout` | Configuration | Performance tuning |
| G39 | No `tcpKeepAlive` / `tlsTimeout` | Configuration | Connection reliability tuning |
| G40 | No `proxyType` / SOCKS | Configuration | Very niche proxy use case |
| G41 | No SMB protocol | Protocols | Very niche |
| G42 | No Unix+TLS protocol | Protocols | Very niche |
| G43 | No management event streaming | API | Advanced programmatic use |
| G44 | No cloudflared version monitoring | Monitoring | Outdated version risks |
| G45 | No log export | Logging | Cannot download logs |

---

## Appendix A: Current CF API Usage Map

```
CF API Endpoint                          NovaPanel Usage
─────────────────────────────────────── ────────────────────────────────────────
GET  /accounts                           ✅ getAccounts() - resolve account ID
GET  /user/tokens/verify                 ✅ validateUserToken() - verify user token
GET  /accounts                           ✅ validateAccountToken() - verify acct token
GET  /zones                              ✅ fetchZones() - list zones
GET  /zones?name=                        ✅ validateHostnameZone(), DNS helpers
GET  /zones/{id}/dns_records             ✅ createDnsCname(), deleteDnsCname()
POST /zones/{id}/dns_records             ✅ createDnsCname(), createPublicDnsCname()
DEL  /zones/{id}/dns_records/{id}        ✅ deleteDnsCname(), createDnsCname()
POST /accounts/{id}/cfd_tunnel           ✅ setup() - create tunnel
GET  /accounts/{id}/cfd_tunnel/{id}      ✅ getTunnelInfo(), getStatus()
DEL  /accounts/{id}/cfd_tunnel/{id}      ✅ deleteTunnel()
PUT  /accounts/{id}/cfd_tunnel/{id}/
     configurations                      ✅ updateRemoteConfig() - partial

GET  /accounts/{id}/cfd_tunnel           ❌ NOT USED - list tunnels
PATCH /accounts/{id}/cfd_tunnel/{id}     ❌ NOT USED - update tunnel
GET  /accounts/{id}/cfd_tunnel/{id}/
     configurations                      ❌ NOT USED - get live config
GET  /accounts/{id}/cfd_tunnel/{id}/
     connections                         ❌ NOT USED - list connections
DEL  /accounts/{id}/cfd_tunnel/{id}/
     connections                         ❌ NOT USED - cleanup connections
GET  /accounts/{id}/cfd_tunnel/{id}/
     token                               ❌ NOT USED - retrieve token
GET  /accounts/{id}/cfd_tunnel/{id}/
     connectors/{connector_id}           ❌ NOT USED - connector details
POST /accounts/{id}/cfd_tunnel/{id}/
     management                          ❌ NOT USED - management token
```

## Appendix B: Current originRequest Coverage

```
originRequest Field          NovaPanel DB Column    CF API Key Sent
─────────────────────────── ────────────────────── ──────────────────
noTLSVerify                  no_tls_verify          noTLSVerify        ✅
access                       —                      —                  ❌
caPool                       —                      —                  ❌
connectTimeout               —                      —                  ❌
disableChunkedEncoding       —                      —                  ❌
http2Origin                  —                      —                  ❌
httpHostHeader               —                      —                  ❌
keepAliveConnections         —                      —                  ❌
keepAliveTimeout             —                      —                  ❌
originServerName             —                      —                  ❌
proxyType                    —                      —                  ❌
tcpKeepAlive                 —                      —                  ❌
tlsTimeout                   —                      —                  ❌
```

## Appendix C: Current Service Protocol Coverage

```
Protocol     Scheme           UI Preset    Schema Validation   Status
──────────── ──────────────── ──────────── ────────────────── ───────
HTTP         http://          ✅ Yes       None (free text)    ✅
HTTPS        https://         ✅ Yes       None (free text)    ✅
HTTP Status  http_status:     ❌ No        None                ⚠️ Catch-all only
TCP          tcp://           ❌ No        None                ❌
SSH          ssh://           ❌ No        None                ❌
RDP          rdp://           ❌ No        None                ❌
Unix         unix://          ❌ No        None                ❌
Unix+TLS     unix+tls://      ❌ No        None                ❌
SMB          smb://           ❌ No        None                ❌
```
