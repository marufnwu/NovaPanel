# Cloudflare Tunnel Automation Enhancement Plan

## Objective
Enhance NovaPanel's Cloudflare Tunnel integration to be more robust and automated based on comprehensive Cloudflare documentation review.

---

## Current Implementation Analysis

### What NovaPanel Already Does Well
1. **Remote Config Approach**: Uses `config_src: 'cloudflare'` for remotely-managed tunnels ✅
2. **Tunnel Token Authentication**: Uses `cloudflared service install <token>` instead of credentials files ✅
3. **API-based Tunnel Management**: Creates/deletes tunnels via Cloudflare API ✅
4. **Remote Config Updates**: Updates ingress configuration via API without service reload ✅
5. **DNS CNAME Automation**: Automatically creates/deletes CNAME records for routes ✅
6. **Token Validation**: Supports both user tokens (`cfut_`) and account tokens (`cfat_`) ✅
7. **Ingress Rules**: Properly implements hostname/service routing with `noTLSVerify` option ✅
8. **Audit Logging**: Comprehensive audit trail for tunnel operations ✅
9. **Auto PANEL_URL Update**: Updates `.env` when tunnel covers panel domain ✅

### What's Missing (Automation Gaps)

| Gap Area | Current State | Cloudflare Docs Requirement |
|----------|---------------|---------------------------|
| **Connectivity Pre-checks** | ❌ None | DNS verification, UDP/TCP port 7844 testing |
| **Metrics Endpoint** | ❌ None | Prometheus metrics at `127.0.0.1:9099` |
| **Protocol Selection** | Hardcoded `http2` | Should support `http3/auto` (QUIC) for better performance |
| **Region-specific Endpoints** | ❌ None | `region1.v2.argotunnel.com` (global), `us-region1.v2.argotunnel.com` (US), `fed-region1.v2.argotunnel.com` (FedRAMP) |
| **Tunnel Replicas/HA** | ❌ None | Support up to 25 replicas per tunnel |
| **Graceful Shutdown** | ❌ None | Proper cleanup on service stop |
| **Connection Health** | Basic status check | Detailed connection info (colo, IP, version) |
| **Pre-flight Diagnostics** | ❌ None | Run connectivity tests before tunnel creation |
| **Protocol Fallback** | ❌ None | Fallback from http3 → http2 if QUIC fails |
| **Origin Request Headers** | ❌ None | Add custom headers to origin requests |

---

## Enhancement Plan

### Phase 1: Connectivity Pre-checks (High Priority)

#### 1.1 DNS Resolution Verification
**Purpose**: Validate DNS endpoints resolve correctly before tunnel creation

```typescript
interface DnsCheckResult {
  success: boolean;
  endpoints: {
    name: string;
    resolved: boolean;
    ipAddresses: string[];
    region: 'global' | 'us' | 'fedramp';
  }[];
}
```

**DNS Endpoints by Region**:
| Region | Endpoint 1 | Endpoint 2 |
|--------|-----------|-----------|
| Global | `region1.v2.argotunnel.com` | `region2.v2.argotunnel.com` |
| US | `us-region1.v2.argotunnel.com` | `us-region2.v2.argotunnel.com` |
| FedRAMP | `fed-region1.v2.argotunnel.com` | `fed-region2.v2.argotunnel.com` |

**Implementation**:
```typescript
async checkDnsEndpoints(apiToken: string, accountId: string): Promise<DnsCheckResult> {
  // Query Cloudflare API for account metadata to determine region
  // Then resolve appropriate DNS endpoints
  // Return structured result with resolved IPs
}
```

#### 1.2 Port Connectivity Testing
**Purpose**: Verify UDP/TCP connectivity to port 7844 before tunnel creation

**Test Commands from Docs**:
```bash
# UDP test
nc -uvz -w 3 198.41.192.167 7844

# TCP test
nc -vz -w 3 198.41.192.167 7844
```

**Known IP Ranges** (from connectivity-prechecks.mdx):
- `198.41.192.0/24` - Region 1
- `198.41.128.0/24` - Region 2
- Plus many more ranges by colo

**Implementation**:
```typescript
interface ConnectivityCheckResult {
  success: boolean;
  tests: {
    protocol: 'UDP' | 'TCP';
    target: string;
    port: number;
    reachable: boolean;
    latency?: number;
  }[];
}
```

#### 1.3 Pre-flight Diagnostic Endpoint
**New Route**: `GET /tunnel/preflight`

```typescript
async preflightCheck(tunnelDbId?: string): Promise<PreflightReport> {
  const results = {
    dnsResolution: await this.checkDnsEndpoints(...),
    portConnectivity: await this.testPortConnectivity(...),
    cloudflaredInstalled: await this.checkCloudflaredInstallation(),
    serviceStatus: await this.getSystemctlStatus(),
  };
  return results;
}
```

---

### Phase 2: Metrics & Monitoring (Medium Priority)

#### 2.1 Metrics Endpoint Integration
**Cloudflare Docs**: Metrics available at `127.0.0.1:9099` (Prometheus-compatible)

**Current Gap**: NovaPanel doesn't expose or collect tunnel metrics

**Implementation**:
```typescript
interface TunnelMetrics {
  tunnelId: string;
  metrics: {
    connections: {
      id: string;
      colo: string;
      ip: string;
      clientVersion: string;
      connectedAt: string;
    }[];
    lastUpdated: string;
  };
}

// Add metrics collection to getStatus()
async collectMetrics(tunnelDbId: string): Promise<TunnelMetrics> {
  // Use existing getTunnelInfo() which already fetches connection details
  const info = await this.getTunnelInfo(tunnelDbId);
  return {
    tunnelId: tunnelDbId,
    metrics: {
      connections: info.connections,
      lastUpdated: new Date().toISOString(),
    },
  };
}
```

#### 2.2 Metrics Endpoint Route
**New Route**: `GET /tunnel/:id/metrics`

```typescript
fastify.get('/tunnel/:id/metrics', async (req) => {
  const { id } = req.params as { id: string };
  const metrics = await service.collectMetrics(id);
  // Return in Prometheus exposition format optionally
  return { success: true, data: metrics };
});
```

#### 2.3 Connection Health Tracking
**Enhancement to `getStatus()`**: Include more detailed connection info

```typescript
interface EnhancedTunnelStatus extends TunnelStatus {
  connections: Array<{
    id: string;
    colo: string;
    coloName: string;  // Human-readable (e.g., "Los Angeles, CA")
    ip: string;
    clientVersion: string;
    connectedAt: string;
    age: string;       // Human-readable (e.g., "2h 34m")
  }>;
}
```

---

### Phase 3: Protocol & Performance (Medium Priority)

#### 3.1 Protocol Selection
**Current**: Hardcoded `--protocol http2`

**Enhancement**: Support protocol selection with `http3/auto` as recommended default

**Protocol Options**:
| Protocol | Description | Use Case |
|----------|-------------|----------|
| `h2mux` | Legacy HTTP/2 multiplexing | Old deployments |
| `http2` | HTTP/2 | General use |
| `http3` | HTTP/3 over QUIC | Best performance |
| `auto` | Auto-select (QUIC with fallback) | **Recommended** |

**Schema Enhancement**:
```typescript
// In tunnel.schema.ts
const setupTunnelSchema = z.object({
  name: z.string(),
  apiToken: z.string(),
  accountId: z.string().optional(),
  zoneId: z.string().optional(),
  protocol: z.enum(['h2mux', 'http2', 'http3', 'auto']).default('auto'),
});
```

#### 3.2 Protocol Fallback Logic
**Implementation**: When using `auto`, cloudflared automatically falls back

**Service Installation Enhancement**:
```typescript
// Current (line 120 in tunnel.service.ts)
await run('cloudflared', ['--protocol', 'http2', 'service', 'install', tunnelToken], { sudo: true });

// Enhanced
await run('cloudflared', ['--protocol', protocol || 'auto', 'service', 'install', tunnelToken], { sudo: true });
```

---

### Phase 4: High Availability / Replicas (Lower Priority)

#### 4.1 Replica Support
**Cloudflare Docs**: Up to 25 replicas (connectors) per tunnel for redundancy

**Current Gap**: Single cloudflared service only

**Schema Enhancement**:
```typescript
// Add to tunnels schema
{
  replicas: integer('replicas').default(1),  // 1-25
 haMode: z.boolean().default(false),
}
```

#### 4.2 Replica Management
**New Routes**:
- `POST /tunnel/:id/replicas` - Add replica
- `DELETE /tunnel/:id/replicas/:replicaId` - Remove replica
- `GET /tunnel/:id/replicas` - List replicas

**Implementation Approach**:
- Each replica uses same tunnel token
- Replicas auto-load-balance connections
- Built-in redundancy: 4 connections per connector to 2+ datacenters

---

### Phase 5: Origin Request Configuration (Lower Priority)

#### 5.1 Custom Headers
**Cloudflare Docs**: Support adding custom headers to origin requests

**Current Gap**: Only `noTLSVerify` is configurable

**Origin Request Options**:
| Option | Description |
|--------|-------------|
| `noTLSVerify` | Skip certificate verification |
| `connectTimeout` | Connection timeout (seconds) |
| `tlsTimeout` | TLS handshake timeout |
| `keepAliveTimeout` | Keep-alive timeout |
| `headers` | Custom headers to add |

**Schema Enhancement**:
```typescript
const routeSchema = z.object({
  tunnelId: z.string(),
  hostname: z.string(),
  service: z.string(),
  noTlsVerify: z.boolean().optional(),
  originRequest: z.object({
    connectTimeout: z.number().optional(),
    tlsTimeout: z.number().optional(),
    keepAliveTimeout: z.number().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
  domainId: z.string().optional(),
});
```

---

## Implementation Checklist

### Must Have (Phase 1-2)
- [ ] **DNS Pre-check** before tunnel creation/setup
- [ ] **Port Connectivity Test** (UDP/TCP 7844) before tunnel creation
- [ ] **Preflight Diagnostic Route** `GET /tunnel/preflight`
- [ ] **Metrics Collection** in status endpoint
- [ ] **Protocol Selection** in setup schema

### Should Have (Phase 3)
- [ ] **HTTP3/Auto Protocol** as default
- [ ] **Enhanced Status** with connection details (colo name, age)
- [ ] **Error Messages** from Cloudflare API surfaced properly

### Nice to Have (Phase 4-5)
- [ ] **Replica Management** UI and API
- [ ] **Origin Request Headers** configuration
- [ ] **Region Selection** (global/US/FedRAMP)

---

## API Endpoints Summary

### Existing (to be enhanced)
| Route | Method | Enhancement |
|-------|--------|-------------|
| `/tunnel/status` | GET | Add metrics, connection details |
| `/tunnel/setup` | POST | Add protocol, pre-checks |
| `/tunnel/:id/info` | GET | Enhance with metrics |

### New Endpoints
| Route | Method | Purpose |
|-------|--------|---------|
| `/tunnel/preflight` | GET | Run connectivity diagnostics |
| `/tunnel/:id/metrics` | GET | Get Prometheus-style metrics |
| `/tunnel/preflight/dns` | POST | Test DNS resolution |
| `/tunnel/preflight/connectivity` | POST | Test port connectivity |

---

## Database Schema Changes

### Required Changes
```typescript
// apps/api/src/db/schema/tunnels.ts

export const cloudflareTunnels = sqliteTable('cloudflare_tunnels', {
  // ... existing fields ...
  protocol: text('protocol').default('auto'),           // NEW
  replicas: integer('replicas').default(1),             // NEW
});

// tunnel_routes table addition
noTlsVerify: integer('no_tls_verify', { mode: 'boolean' }).default(false),
originRequestJson: text('origin_request_json'),        // NEW: JSON for origin request config
```

---

## Testing Requirements

### Pre-flight Tests
1. DNS resolution returns correct IPs for all regional endpoints
2. Port 7844 reachable via UDP and TCP
3. cloudflared daemon responds to metrics requests

### Tunnel Lifecycle Tests
1. Create tunnel with all protocol options
2. Verify remote config updates without service reload
3. Verify DNS CNAME creation and cleanup
4. Verify metrics collection after connection established

### Error Handling Tests
1. Invalid API token returns clear error
2. DNS failure before tunnel creation gives actionable message
3. Port blocked gives firewall guidance

---

## Documentation Updates Required

1. **Admin Guide**: Document pre-flight checks
2. **Troubleshooting**: Add connectivity troubleshooting section
3. **API Reference**: Document new endpoints
4. **Best Practices**: Recommend `auto` protocol for production

---

## Priority Order

1. **DNS/Connectivity Pre-checks** - Prevent user frustration
2. **Protocol Selection** - Performance improvement
3. **Metrics Exposure** - Operational visibility
4. **Replica Support** - High availability (future)
5. **Origin Request Config** - Flexibility (future)