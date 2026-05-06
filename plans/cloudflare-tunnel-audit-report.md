# Cloudflare Tunnel Audit Report

## WHAT THE OFFICIAL DOCS SAY

### API Token Permissions Required

**For tunnel creation/management** (at least one):
- `Cloudflare One Connectors Write`
- `Cloudflare One Connector: cloudflared Write`
- `Cloudflare Tunnel Write`

**For DNS record creation** (at least one):
- `DNS Write`

The older setup guide also mentions: Account: Cloudflare Tunnel Edit, Zone: DNS Edit.

### How to Create a Tunnel

```
POST https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel
Authorization: Bearer $CLOUDFLARE_API_TOKEN
Content-Type: application/json

{ "name": "api-tunnel", "config_src": "cloudflare" }
```

Response includes `result.id` (tunnel UUID) and `result.token` (tunnel token JWT).

### config_src: "cloudflare" vs local

- `config_src: "cloudflare"` = **remotely-managed** tunnel. Configuration stored on Cloudflare, managed via dashboard, API, or Terraform. No local config file needed.
- Local config = configuration stored in local `cloudflared` directory, managed via CLI and config.yml files.

### How to Configure Ingress Rules

```
PUT /accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations
Authorization: Bearer $CLOUDFLARE_API_TOKEN

{
  "config": {
    "ingress": [
      { "hostname": "app.example.com", "service": "http://localhost:80", "originRequest": {} },
      { "service": "http_status:404" }
    ]
  }
}
```

- The **entire** ingress config must be sent at once (PUT replaces all rules).
- Must include a **catch-all rule** as the LAST entry: `{ "service": "http_status:404" }`.

### How DNS Records Are Created

```
POST /zones/$ZONE_ID/dns_records
{ "type": "CNAME", "proxied": true, "name": "app.example.com", "content": "<TUNNEL_ID>.cfargotunnel.com" }
```

- Type: CNAME
- Content: `<tunnel-uuid>.cfargotunnel.com`
- Proxied: **true** (always)

### Tunnel TOKEN vs API Token

- **API Token**: Used for Cloudflare API calls (create tunnel, manage config, DNS). Has specific permissions.
- **Tunnel Token**: A JWT returned in `result.token` from the create response. Used ONLY to run cloudflared. Anyone with this token can run the tunnel.

### How cloudflared Is Installed and Run

```
sudo cloudflared service install <TUNNEL_TOKEN>
```

Single command installs cloudflared as a systemd service. No config file needed for remotely-managed tunnels.

### How to Check Tunnel Health via API

```
GET /accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID
```

Response includes:
- `status`: `"healthy"`, `"inactive"`, `"down"`, or `"degraded"`
- `connections`: array of active connections (healthy tunnel has 4 connections)

### What Happens to DNS Records When a Tunnel Stops

DNS records are NOT deleted. Visitors see a `1016` error. DNS records and tunnels are independent.

---

## WHAT THE CURRENT CODE DOES

### Files Mapped

| File | Purpose |
|------|---------|
| `apps/api/src/db/schema/tunnels.ts` | DB schema for `cloudflare_tunnels` and `tunnel_routes` tables |
| `apps/api/src/modules/tunnel/tunnel.service.ts` | Core tunnel service - all Cloudflare API interaction, cloudflared management |
| `apps/api/src/modules/tunnel/tunnel.routes.ts` | Fastify route handlers for tunnel API endpoints |
| `apps/api/src/modules/tunnel/tunnel.schema.ts` | Zod validation schemas for tunnel endpoints |
| `apps/web/src/api/hooks/tunnel.ts` | React Query hooks for tunnel frontend API calls |
| `apps/web/src/pages/tunnels/TunnelsPage.tsx` | Full tunnel management UI page |

### Current Flow Summary

The codebase has **already been migrated** to the remote config approach (the migration plan in `plans/tunnel-remote-config-migration.md` was implemented). The core backend approach is correct:

1. **Tunnel creation**: Uses `POST /accounts/{id}/cfd_tunnel` with `config_src: "cloudflare"` ✅
2. **Route management**: Uses `PUT /accounts/{id}/cfd_tunnel/{id}/configurations` ✅
3. **DNS creation**: Creates CNAME with correct type, content, and proxied flag ✅
4. **cloudflared install**: Uses `cloudflared service install <TUNNEL_TOKEN>` ✅
5. **Catch-all rule**: Includes `{ service: "http_status:404" }` at end of ingress ✅

---

## ISSUES FOUND

### ISSUE 1: Frontend passes zoneId as accountId (CRITICAL)

**Files**: `apps/web/src/pages/tunnels/TunnelsPage.tsx` line 53, `apps/web/src/api/hooks/tunnel.ts` line 117

**What the code does**:
```typescript
// TunnelsPage.tsx line 53 - in SetupModal handleSubmit
setup.mutate({ name: form.name, apiToken: form.apiToken, accountId: form.zoneId })

// tunnel.ts line 117 - useSetupTunnel
mutationFn: (data: { name: string; apiToken: string; accountId?: string }) =>
  api.post('/tunnel/setup', data),
```

The user selects a **zone** in the UI, but it is passed as `accountId` to the setup mutation. The `zoneId` field is never sent to the backend.

**What the docs say**: Account ID and Zone ID are completely different things. Account ID identifies the Cloudflare account. Zone ID identifies a specific domain zone.

**Impact**: The backend receives a zone ID where it expects an account ID. If `accountId` is provided, it will be used directly in the API URL (`/accounts/${resolvedAccountId}/cfd_tunnel`), which will fail because it is a zone ID, not an account ID.

**Fix**: 
1. The setup flow should auto-detect the account ID (backend already does this when accountId is null).
2. Pass the selected `zoneId` as `zoneId` (not as `accountId`).
3. Update `useSetupTunnel` to include `zoneId` in the mutation payload.

---

### ISSUE 2: Frontend status hook loses degraded status and tunnel list (CRITICAL)

**File**: `apps/web/src/api/hooks/tunnel.ts` lines 53-76

**What the code does**:
```typescript
return {
  status: data.status as 'active' | 'inactive',  // loses 'degraded'
  tunnels: [] as CloudflareTunnel[],               // always empty
} as TunnelStatus;
```

**Impact**:
1. The `degraded` status is cast away - users never see when their tunnel is degraded.
2. The tunnel list is always empty - the tunnels page cannot render tunnel cards.
3. The page will always show "No tunnels configured" empty state because `tunnels` is always `[]`.

**Fix**: The backend `getStatus()` method needs to return the tunnel list from the database. The frontend hook needs to properly map the response.

---

### ISSUE 3: Backend getStatus does not return tunnel list

**File**: `apps/api/src/modules/tunnel/tunnel.service.ts` lines 440-506

**What the code does**: The `getStatus()` method queries the tunnels table (line 456) but only uses it to check API connectivity. It does not return the tunnel list in the response.

**Impact**: The frontend has no way to get the list of configured tunnels. There is no `GET /tunnel/list` endpoint either.

**Fix**: Include the tunnel list from the DB in the status response.

---

### ISSUE 4: Backend getTunnelInfo uses DB status instead of API status

**File**: `apps/api/src/modules/tunnel/tunnel.service.ts` line 310

**What the code does**:
```typescript
return {
  id: info.id,
  name: info.name,
  status: tunnel.status,  // from DB, NOT from API
  connections: info.connections || [],
};
```

**What the docs say**: The API returns `status` directly in the response: `"healthy"`, `"inactive"`, `"down"`, or `"degraded"`.

**Impact**: The status shown is the DB-cached status (set manually on start/stop), not the real-time status from Cloudflare. A tunnel could be down on Cloudflare but still show as "active" in the UI.

**Fix**: Use `info.status` from the API response, and map Cloudflare status values to the panel's status values.

---

### ISSUE 5: getStatus uses created_at instead of conns_active_at

**File**: `apps/api/src/modules/tunnel/tunnel.service.ts` line 479

**What the code does**:
```typescript
lastConnectedAt: data.result.created_at || null;
```

**What the docs say**: The API response includes `conns_active_at` which is when connections were last active.

**Impact**: Shows tunnel creation time instead of last connection time.

**Fix**: Use `data.result.conns_active_at` instead of `data.result.created_at`.

---

### ISSUE 6: DNS CNAME creation looks up zone by domain name instead of using stored zoneId

**File**: `apps/api/src/modules/tunnel/tunnel.service.ts` lines 789-847

**What the code does**: Makes an API call to find the zone by domain name:
```typescript
const domain = hostname.split('.').slice(-2).join('.');
const zonesResponse = await fetch(`/zones?name=${domain}`);
const zoneId = zonesData.result?.[0]?.id;
```

**What should happen**: The zone ID should be stored in the tunnel record and used directly.

**Impact**: 
- Extra unnecessary API call on every DNS operation.
- Could fail for subdomains deeper than 2 levels (e.g., `app.staging.example.com` would look for `staging.example.com` instead of `example.com`).
- The stored `zoneId` in the DB is never used for DNS operations.

**Fix**: Use the stored `tunnel.zoneId` when available, fall back to domain lookup only if not stored.

---

### ISSUE 7: Double DNS creation in AddRouteModal

**File**: `apps/web/src/pages/tunnels/TunnelsPage.tsx` lines 202-227

**What the code does**: The backend `addRoute()` already creates DNS CNAME automatically (line 601-603 in service). The frontend also has an "Auto-create DNS record" checkbox that calls `createDnsCname` on success.

**Impact**: If the checkbox is checked, DNS is created twice - once by the backend, once by the frontend. This either creates a duplicate record or the second call fails.

**Fix**: Remove the "Auto-create DNS record" checkbox from the frontend since the backend already handles it.

---

### ISSUE 8: deleteTunnel does not clean up DNS records for routes

**File**: `apps/api/src/modules/tunnel/tunnel.service.ts` lines 328-404

**What the code does**: When deleting a tunnel, it stops the service, deletes from Cloudflare API, uninstalls cloudflared, and deletes from DB. But it does NOT delete DNS CNAME records for the tunnel's routes.

**What the docs say**: DNS records and tunnels are independent. Deleting a tunnel does not auto-delete DNS records.

**Impact**: Orphaned DNS CNAME records pointing to a deleted tunnel UUID. Visitors to those domains will see a `1016` error.

**Fix**: Before deleting from DB, iterate through all routes and call `deleteDnsCname()` for each.

---

### ISSUE 9: UI shows misleading token permission requirements

**File**: `apps/web/src/pages/tunnels/TunnelsPage.tsx` line 101

**What the code shows**: `"Token needs Zone - DNS - Edit permissions"`

**What the docs say**: The token needs:
- `Cloudflare Tunnel Write` (or equivalent) for tunnel operations
- `DNS Write` for DNS operations

**Impact**: Users may create a token with only DNS permissions, missing the Tunnel permissions required to create tunnels.

**Fix**: Update the help text to list both required permissions.

---

### ISSUE 10: Frontend TunnelStatus type missing degraded

**File**: `apps/web/src/api/hooks/tunnel.ts` line 24

**What the code does**:
```typescript
export interface TunnelStatus {
  status: 'active' | 'inactive';
  tunnels: CloudflareTunnel[];
}
```

**Impact**: TypeScript prevents proper handling of the 'degraded' status.

**Fix**: Add 'degraded' to the status union type.

---

## FIXES REQUIRED - PRIORITY ORDER

### Fix 1: Frontend setup flow - pass zoneId correctly (CRITICAL)
**Files to change**:
- `apps/web/src/pages/tunnels/TunnelsPage.tsx` - line 53: pass `zoneId: form.zoneId` instead of `accountId: form.zoneId`
- `apps/web/src/api/hooks/tunnel.ts` - line 117: include `zoneId` in mutation payload type

### Fix 2: Backend getStatus must return tunnel list (CRITICAL)
**Files to change**:
- `apps/api/src/modules/tunnel/tunnel.service.ts` - `getStatus()`: include tunnel list from DB in response
- `apps/web/src/api/hooks/tunnel.ts` - `useTunnelStatus()`: properly map tunnels from response
- `apps/web/src/api/hooks/tunnel.ts` - `TunnelStatus` interface: add 'degraded' to status type

### Fix 3: Backend getTunnelInfo must use API status (HIGH)
**Files to change**:
- `apps/api/src/modules/tunnel/tunnel.service.ts` - `getTunnelInfo()`: use `info.status` from API, map CF status values

### Fix 4: Backend getStatus uses wrong field for lastConnectedAt (MEDIUM)
**Files to change**:
- `apps/api/src/modules/tunnel/tunnel.service.ts` - line 479: use `conns_active_at` instead of `created_at`

### Fix 5: DNS CNAME creation should use stored zoneId (MEDIUM)
**Files to change**:
- `apps/api/src/modules/tunnel/tunnel.service.ts` - `createDnsCname()`: use `tunnel.zoneId` when available

### Fix 6: Remove duplicate DNS creation from frontend (MEDIUM)
**Files to change**:
- `apps/web/src/pages/tunnels/TunnelsPage.tsx` - `AddRouteModal`: remove auto-create DNS checkbox and logic

### Fix 7: deleteTunnel must clean up DNS records (HIGH)
**Files to change**:
- `apps/api/src/modules/tunnel/tunnel.service.ts` - `deleteTunnel()`: iterate routes and delete DNS before DB cleanup

### Fix 8: Update token permission help text (LOW)
**Files to change**:
- `apps/web/src/pages/tunnels/TunnelsPage.tsx` - line 101: update help text with both Tunnel and DNS permissions

### Fix 9: "Expose Panel" uses wrong port (HIGH)
**Files to change**:
- `apps/web/src/pages/tunnels/TunnelsPage.tsx` - `ExposePanelModal`: hardcoded `http://localhost:3000` should use actual panel port from env (default 8443)
- Backend needs to expose panel port to frontend via a settings/status endpoint

**What the code does**: `ExposePanelModal` hardcodes `service: 'http://localhost:3000'`
**What it should do**: Use the actual panel port (8443 from env.ts PORT default). The panel runs on port 8443, not 3000.
**Impact**: "Expose Panel" feature creates a route pointing to the wrong port. Panel will be unreachable through the tunnel.

### Fix 10: "Quick Expose Domains" always uses HTTP (MEDIUM)
**Files to change**:
- `apps/web/src/pages/tunnels/TunnelsPage.tsx` - `handleExposeDomain`: check domain SSL status and use `https://localhost:443` with `noTlsVerify: true` when SSL is enabled

**What the code does**: Always creates route with `service: 'http://localhost:80'`
**What it should do**: If domain has `sslEnabled: true`, use `https://localhost:443` with `noTlsVerify: true`
**Impact**: Domains with SSL enabled won't work properly through the tunnel.

### Fix 11: domainId not passed when exposing domains (LOW)
**Files to change**:
- `apps/web/src/pages/tunnels/TunnelsPage.tsx` - `handleExposeDomain`: pass `domainId: domain.id` in the route creation payload

**What the code does**: Creates route without `domainId` - the link between tunnel route and domain is lost
**What it should do**: Pass `domainId` so the route is linked to the domain in the database

---

## DOMAIN ROUTING ARCHITECTURE

### How domain/subdomain to website routing works

The architecture relies on **Cloudflare Tunnel + nginx virtual host matching**:

```
User visits panel.example.com
  -> DNS CNAME: panel.example.com -> <tunnelId>.cfargotunnel.com
  -> Cloudflare routes through tunnel to localhost:PORT
  -> nginx matches Host header "panel.example.com"
  -> Serves correct website from document root
```

The nginx service configures `server_name ${domain}` for each domain, so nginx correctly routes based on the Host header. This means:

- **Main domain** e.g. `example.com`: Route `example.com -> http://localhost:80` -> nginx matches Host -> serves correct site
- **Subdomain** e.g. `panel.example.com`: Route `panel.example.com -> http://localhost:8443` -> tunnel routes to panel
- **Website domain** e.g. `blog.example.com`: Route `blog.example.com -> http://localhost:80` -> nginx matches Host -> serves blog

Each hostname needs its own:
1. Tunnel ingress rule - hostname to service mapping
2. DNS CNAME record - hostname to tunnel UUID
3. Nginx virtual host - server_name matching

---

## VERIFICATION CHECKLIST

After fixes, the flow should match:

- [ ] Admin enters API token → Panel validates via CF API → Token stored encrypted
- [ ] Admin creates tunnel → `POST /accounts/{id}/cfd_tunnel` with `config_src: "cloudflare"` → tunnelId + tunnelToken stored → `cloudflared service install <TOKEN>` → cloudflared starts
- [ ] Admin adds route → `PUT /configurations` with full ingress array + catch-all → DNS CNAME created with `{type: CNAME, proxied: true, content: "<tunnelId>.cfargotunnel.com"}` → stored in DB
- [ ] Admin checks status → `GET /accounts/{id}/cfd_tunnel/{id}` → uses API `status` field and `connections` array → shows accurate healthy/inactive/down/degraded
- [ ] Admin deletes route → `PUT /configurations` with route removed → DNS CNAME deleted → removed from DB
- [ ] Admin deletes tunnel → DNS records cleaned up → tunnel deleted from CF API → cloudflared uninstalled → removed from DB
- [ ] Ingress always has catch-all `{ service: "http_status:404" }` as last rule

---

## THINGS THAT NEED MANUAL TESTING

1. **Full tunnel creation flow**: Create a tunnel from the UI and verify it appears in Cloudflare dashboard
2. **Route addition**: Add a route and verify DNS CNAME is created in Cloudflare
3. **Route deletion**: Delete a route and verify DNS record is removed from Cloudflare
4. **Tunnel deletion**: Delete a tunnel and verify all DNS records are cleaned up
5. **Status accuracy**: Stop cloudflared service and verify status changes in UI
6. **Degraded status**: Simulate degraded state and verify it shows correctly
7. **Panel URL auto-update**: Create a route for the panel domain and verify PANEL_URL updates
