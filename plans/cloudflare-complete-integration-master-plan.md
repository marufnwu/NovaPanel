# NovaPanel Cloudflare Complete Integration Master Plan

## The Core Paradigm Shift

### Traditional Server (Public IP)
```
Panel → Nginx vhosts + Local BIND9 DNS + Let's Encrypt SSL
```
- Panel manages local DNS zones
- Panel obtains SSL certificates via HTTP-01 or DNS-01
- All DNS records stored locally in BIND

### Local Server Behind Cloudflare Tunnel
```
Panel → Nginx vhosts + Cloudflare DNS (API) + Cloudflare SSL (API)
       + Tunnel routes (API) + cloudflared process (OS)
```
- **Local BIND9 is irrelevant** for public-facing domains
- **Let's Encrypt is irrelevant** for tunnel-served domains (unless "strict" SSL mode)
- **Cloudflare Dashboard is irrelevant** if panel does everything via API
- Cloudflare becomes DNS provider AND traffic router AND SSL terminator

**Key Implication**: When a domain is served via Cloudflare Tunnel, the panel MUST own:
1. Cloudflare DNS records via API
2. Tunnel ingress routes via API
3. Cloudflare SSL/TLS mode via API
4. Cloudflare zone settings via API

---

## Complete Feature Specification

### 1. Cloudflare DNS Record Management

**Record Types Supported:**
| Type | Purpose | Panel Handling |
|------|---------|----------------|
| **A** | IPv4 address | For non-tunnel resources (e.g., mail server on VPS) |
| **AAAA** | IPv6 address | Same as A for IPv6 |
| **CNAME** | Alias to tunnel | Core record for tunnel routes: `{tunnel-id}.cfargotunnel.com` |
| **MX** | Mail routing | Points to mail provider (Google, Microsoft, Zoho, etc.) |
| **TXT** | Text records | SPF, DKIM, DMARC, domain verification |
| **NS** | Nameservers | Read-only display of Cloudflare's NS |
| **SRV** | Service discovery | For services needing SRV records |
| **CAA** | Certificate Authority | Optional security record |

**API Endpoints:**
- `GET /zones/:zone_id/dns_records` - List all
- `POST /zones/:zone_id/dns_records` - Create
- `PUT /zones/:zone_id/dns_records/:record_id` - Update
- `PATCH /zones/:zone_id/dns_records` - Batch update
- `DELETE /zones/:zone_id/dns_records/:record_id` - Delete

**CNAME for Tunnel Routes:**
```
name: @ or subdomain
content: {tunnel-id}.cfargotunnel.com
proxied: true (always)
```

---

### 2. Tunnel Route Management

**Per Website Flow:**
```
1. Nginx vhost: yourdomain.com → port 80 (HTTP)
2. Tunnel route: yourdomain.com → http://localhost:80
3. Cloudflare CNAME: @ → {tunnel-id}.cfargotunnel.com (proxied)
4. Tunnel remote config updated via API
5. SSL mode set to "flexible" (default for local server)
```

**Per Subdomain Flow:**
```
1. Nginx server_name includes shop.yourdomain.com
2. Tunnel route: shop.yourdomain.com → http://localhost:80
3. Cloudflare CNAME: shop → {tunnel-id}.cfargotunnel.com (proxied)
```

**Path-Based Routing (single domain):**
```
yourdomain.com/api → http://localhost:3001
yourdomain.com → http://localhost:80
```

**Per Service:**
```
db.yourdomain.com → http://localhost:8080 (phpMyAdmin)
mail.yourdomain.com → http://localhost:80 (webmail)
panel.yourdomain.com → https://localhost:3000 (panel itself)
```

**Delete Domain:**
```
1. Remove Nginx vhost
2. Remove tunnel ingress route
3. Delete Cloudflare CNAME
4. Update tunnel remote config
```

---

### 3. Cloudflare SSL/TLS Mode Management

**SSL Modes (PATCH /zones/{zone_id}/settings/ssl):**

| Mode | Edge→Server | Server Cert | Use Case |
|------|-------------|-------------|----------|
| `off` | HTTP | None | Avoid - security risk |
| `flexible` | HTTP | None | **Default for local servers** - simplest |
| `full` | HTTPS | Self-signed OK | Server has self-signed cert |
| `strict` | HTTPS | Valid cert only | Requires Let's Encrypt with DNS-01 |

**Panel Must:**
- Show current SSL mode per zone
- Allow admin to change with explanation
- Default to "flexible" for new local server setups
- Warn when "strict" is selected on a local server

**SSL Settings to Manage:**
```
always_use_https          - Force HTTPS redirect
security_header          - HSTS settings
min_tls_version          - TLS 1.0/1.1/1.2/1.3
http2                    - HTTP/2 toggle
http3                    - HTTP/3 (QUIC) toggle
```

---

### 4. Cloudflare Zone Settings Management

**Settings Exposed via API:**
| Setting | API Endpoint | Panel Control |
|---------|--------------|---------------|
| Always HTTPS | `PATCH .../always_use_https` | Toggle |
| HSTS | `PATCH .../security_header` | Toggle + max-age |
| Min TLS | `PATCH .../min_tls_version` | Selector |
| HTTP/2 | `PATCH .../http2` | Toggle |
| HTTP/3 | `PATCH .../http3` | Toggle |
| Browser Cache TTL | `PATCH .../browser_cache_ttl` | Selector |
| Development Mode | `PATCH .../development_mode` | Toggle (3hr auto-disable) |
| Email Obfuscation | `PATCH .../email_obfuscation` | Toggle |
| Hotlink Protection | `PATCH .../hotlink_protection` | Toggle |
| Pause Cloudflare | `PATCH .../paused` | Toggle (bypass proxy) |
| Cache Purge | `POST .../purge_cache` | Button + URL list |

---

### 5. Redirect Rules (Modern Ruleset API)

**Use Cases:**
- Redirect www to non-www (or vice versa)
- Redirect HTTP to HTTPS for specific paths
- Redirect old URLs to new URLs (301)
- Forward entire domain to another domain
- Wildcard redirect rules

**Implementation:**
```
POST /zones/{zone_id}/rulesets/{ruleset_id}/rules
```

**Admin Flow:**
```
Domain → Redirects Tab → Add Redirect
→ Source URL pattern
→ Destination URL
→ Type (301/302)
→ Panel calls Cloudflare API
→ No dashboard needed
```

---

### 6. Per-Domain Website Integration

**Create Website for Domain:**
```
Admin: "Create website for yourdomain.com"

Panel automatically:
1. Nginx vhost for yourdomain.com (port 80)
2. Tunnel route: yourdomain.com → http://localhost:80
3. Cloudflare CNAME: @ → {tunnel-id}.cfargotunnel.com (proxied)
4. Update tunnel remote config via API
5. Set SSL mode to "flexible"

Result: Site live on internet immediately. Zero manual steps.
```

**Add Subdomain:**
```
Admin: "Add subdomain shop.yourdomain.com"

Panel automatically:
1. Nginx server_name for shop.yourdomain.com
2. Tunnel route: shop.yourdomain.com → http://localhost:80
3. Cloudflare CNAME: shop → {tunnel-id}.cfargotunnel.com (proxied)
4. Update tunnel remote config

Result: Subdomain live immediately.
```

**Delete Domain:**
```
Panel automatically:
1. Remove Nginx vhost
2. Remove tunnel ingress route
3. Delete Cloudflare CNAME
4. Update tunnel remote config

Result: Clean removal. Nothing left in Cloudflare.
```

---

### 7. Mail DNS Configuration

**Mail Provider Presets:**
| Provider | Records Created |
|----------|----------------|
| Google Workspace | MX + TXT (SPF) + DKIM + DMARC |
| Microsoft 365 | MX + TXT (SPF) + DKIM + DMARC |
| Zoho Mail | MX + TXT (SPF) + DKIM + DMARC |
| Custom | Manual entry for all record types |

**Important Limitations:**
- SMTP submission (port 587) does NOT work through Cloudflare Tunnel
- Cloudflare only proxies HTTP/HTTPS, not raw TCP by default
- Mail sending requires:
  - External SMTP relay (SendGrid, Amazon SES, Mailgun)
  - Cloudflare Spectrum (paid) for TCP proxying
- Panel should communicate this when mail is enabled on local server

---

### 8. Wildcard Subdomain Support

**Requirements:**
- Cloudflare DNS wildcard proxying requires paid plan (Pro+)
- Panel must check plan level and show feature availability

**Flow:**
```
Domain → Advanced → "Enable wildcard subdomain"
→ Creates * CNAME in Cloudflare (proxied)
→ Adds wildcard ingress rule: *.yourdomain.com → http://localhost:80
→ Updates Nginx with catch-all server_name
```

---

### 9. Cloudflare Zone Overview in Panel

**Information Displayed:**
| Info | Source |
|------|--------|
| Zone status | `GET /zones/:zone_id` |
| Current nameservers | `GET /zones/:zone_id` |
| All DNS records | `GET /zones/:zone_id/dns_records` |
| SSL/TLS mode | `GET /zones/:zone_id/settings/ssl` |
| Zone plan | `GET /zones/:zone_id` (plan.name) |
| Page rules count | `GET /zones/:zone_id/pagerules` |
| Zone errors/warnings | `GET /zones/:zone_id/analytics` |

**Action Buttons:**
| Action | API Call |
|--------|----------|
| Pause Cloudflare | `PATCH /zones/:zone_id/settings/paused` |
| Purge cache | `POST /zones/:zone_id/cache/purge` |
| Open in CF dashboard | External link |

---

### 10. Tunnel Health & Verification

**Per-Route Testing:**
```
"Test route" button
→ Panel makes internal request through tunnel
→ Shows: response code, latency, error details
```

**Per-Domain Verification:**
| Check | What It Tests |
|-------|---------------|
| Verify DNS | CNAME exists in Cloudflare and proxied |
| Verify route | Ingress rule exists in tunnel config |
| Verify site | End-to-end: public URL → CF → tunnel → Nginx → response |

**Tunnel Metrics:**
```
GET /accounts/{id}/cfd_tunnel/{tunnel_id}/connections
→ Active connections count
→ Which Cloudflare edge nodes
→ Connection ages
→ Bytes transferred
```

---

## Complete Feature Checklist

### Cloudflare DNS Management (via API)
- [ ] List all DNS records (live from CF API)
- [ ] Create A, AAAA, CNAME, MX, TXT, SRV, CAA records
- [ ] Edit any DNS record
- [ ] Delete any DNS record
- [ ] Wildcard CNAME for *.domain.com
- [ ] Mail provider presets (Google, Microsoft, Zoho, custom)
- [ ] SPF / DKIM / DMARC record management
- [ ] Import/export zone in BIND format

### Tunnel Route Management (via API)
- [ ] List all ingress routes
- [ ] Add route: hostname → local service
- [ ] Add path-based route: hostname/path → local service
- [ ] Edit route
- [ ] Delete route
- [ ] Enable / disable individual route
- [ ] Wildcard route: *.domain.com → http://localhost:80
- [ ] Auto-create CNAME when route added
- [ ] Auto-delete CNAME when route deleted

### Website ↔ Domain Integration
- [ ] Create website → auto-create tunnel route + CNAME
- [ ] Add subdomain → auto-create tunnel route + CNAME
- [ ] Delete domain → auto-remove tunnel route + CNAME
- [ ] Manual route linking for external domains

### SSL / TLS (via Cloudflare API)
- [ ] View current SSL mode per zone
- [ ] Change SSL mode (off/flexible/full/strict)
- [ ] Force HTTPS toggle
- [ ] HSTS enable / disable
- [ ] Minimum TLS version selector
- [ ] Origin CA certificate generation (free Cloudflare cert)

### Zone Settings (via Cloudflare API)
- [ ] Always use HTTPS
- [ ] Development mode toggle
- [ ] Browser cache TTL
- [ ] HTTP/2 and HTTP/3 toggle
- [ ] Email obfuscation
- [ ] Hotlink protection
- [ ] Pause / unpause Cloudflare proxy
- [ ] Purge entire cache
- [ ] Purge cache by URL

### Redirect Rules (via Cloudflare API)
- [ ] Add redirect: URL pattern → destination
- [ ] www to non-www (or reverse) redirect
- [ ] Domain forwarding
- [ ] Custom wildcard redirect rules
- [ ] 301 / 302 type selection
- [ ] Edit / delete redirect rules

### Zone Overview
- [ ] Zone status and nameservers
- [ ] Cloudflare account plan display
- [ ] All DNS records (live view)
- [ ] Active redirect rules count
- [ ] Zone-level errors / warnings
- [ ] Quick action buttons

### Cloudflared Process (via OS)
- [ ] Start / stop / restart service
- [ ] View live logs (WebSocket)
- [ ] Connection health (active connectors)
- [ ] Protocol selection (http2/quic/auto)

### Verification Tools
- [ ] Test individual route end-to-end
- [ ] Verify DNS CNAME exists and proxied
- [ ] Verify tunnel has active connections
- [ ] Per-domain health check (DNS + route + site response)

### Plan Limitations (Not Possible via API)
- [ ] Wildcard DNS proxying (requires paid plan)
- [ ] Cloudflare Access policies (Zero Trust - separate product)
- [ ] Cloudflare Spectrum (TCP proxying for mail, etc.)
- [ ] WAF custom rules (requires Pro+)
- [ ] Panel detects plan level and shows unavailable features

---

## Implementation Architecture

### Unified Cloudflare Service

```typescript
// apps/api/src/services/cloudflare.service.ts

export class CloudflareService {
  private apiToken: string;
  private accountId?: string;
  
  // --- Zone Management ---
  async listZones(): Promise<CloudflareZone[]>
  async getZone(zoneId: string): Promise<CloudflareZone>
  async createZone(name: string): Promise<CloudflareZone>
  async deleteZone(zoneId: string): Promise<void>
  
  // --- DNS Records ---
  async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]>
  async createDnsRecord(zoneId: string, record: CloudflareDnsRecordInput): Promise<CloudflareDnsRecord>
  async updateDnsRecord(zoneId: string, recordId: string, record: CloudflareDnsRecordInput): Promise<CloudflareDnsRecord>
  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void>
  
  // --- SSL/TLS ---
  async getSslSettings(zoneId: string): Promise<SslSettings>
  async updateSslSettings(zoneId: string, settings: SslSettingsInput): Promise<void>
  async getOriginCertificate(zoneId: string, hosts: string[]): Promise<OriginCertificate>
  
  // --- Zone Settings ---
  async getZoneSettings(zoneId: string): Promise<ZoneSettings>
  async updateZoneSettings(zoneId: string, settings: Partial<ZoneSettings>): Promise<void>
  
  // --- Firewall ---
  async listFirewallRules(zoneId: string): Promise<FirewallRule[]>
  async createFirewallRule(zoneId: string, rule: FirewallRuleInput): Promise<FirewallRule>
  async updateFirewallRule(zoneId: string, ruleId: string, rule: Partial<FirewallRuleInput>): Promise<FirewallRule>
  async deleteFirewallRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Cache ---
  async getCacheSettings(zoneId: string): Promise<CacheSettings>
  async updateCacheSettings(zoneId: string, settings: Partial<CacheSettings>): Promise<void>
  async purgeCache(zoneId: string, files?: string[]): Promise<void>
  async purgeEverything(zoneId: string): Promise<void>
  
  // --- Redirect Rules ---
  async listRedirectRules(zoneId: string): Promise<RedirectRule[]>
  async createRedirectRule(zoneId: string, rule: RedirectRuleInput): Promise<RedirectRule>
  async updateRedirectRule(zoneId: string, ruleId: string, rule: Partial<RedirectRuleInput>): Promise<RedirectRule>
  async deleteRedirectRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Analytics ---
  async getZoneAnalytics(zoneId: string, since: Date, until: Date): Promise<ZoneAnalytics>
  
  // --- Utility ---
  async verifyDns(zoneId: string): Promise<DnsVerification>
  async checkPlanFeatures(zoneId: string): Promise<PlanFeatures>
}
```

### Database Schema Extensions

```typescript
// apps/api/src/db/schema/cloudflare.ts

export const cloudflareZones = sqliteTable('cloudflare_zones', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id'),               // CF zone ID
  zoneName: text('zone_name').notNull(),
  accountId: text('account_id'),
  apiToken: text('api_token'),            // encrypted
  plan: text('plan'),
  sslMode: text('ssl_mode').default('flexible'),
  isPaused: integer('is_paused', { mode: 'boolean' }).default(false),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const cloudflareZoneSettings = sqliteTable('cloudflare_zone_settings', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => cloudflareZones.id),
  alwaysUseHttps: integer('always_use_https', { mode: 'boolean' }).default(false),
  http2: integer('http2', { mode: 'boolean' }).default(true),
  http3: integer('http3', { mode: 'boolean' }).default(true),
  browserCacheTtl: integer('browser_cache_ttl').default(14400),
  developmentMode: integer('development_mode', { mode: 'boolean' }).default(false),
  emailObfuscation: integer('email_obfuscation', { mode: 'boolean' }).default(true),
  hotlinkProtection: integer('hotlink_protection', { mode: 'boolean' }).default(false),
});

export const cloudflareRedirectRules = sqliteTable('cloudflare_redirect_rules', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => cloudflareZones.id),
  ruleId: text('rule_id'),               // CF ruleset ID
  sourcePattern: text('source_pattern').notNull(),
  destinationUrl: text('destination_url').notNull(),
  redirectType: text('redirect_type', { enum: ['301', '302'] }).default('301'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
```

---

## API Routes

### Zone Management
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones` | GET | List all zones |
| `/cloudflare/zones` | POST | Create zone |
| `/cloudflare/zones/:id` | GET | Zone overview |
| `/cloudflare/zones/:id` | PUT | Update zone settings |
| `/cloudflare/zones/:id` | DELETE | Delete zone |

### DNS Records
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones/:id/dns` | GET | List all DNS records |
| `/cloudflare/zones/:id/dns` | POST | Create DNS record |
| `/cloudflare/zones/:id/dns/:recordId` | PUT | Update record |
| `/cloudflare/zones/:id/dns/:recordId` | DELETE | Delete record |
| `/cloudflare/zones/:id/dns/import` | POST | Import from BIND format |
| `/cloudflare/zones/:id/dns/export` | GET | Export as BIND format |

### SSL/TLS
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones/:id/ssl` | GET | Get SSL settings |
| `/cloudflare/zones/:id/ssl` | PUT | Update SSL settings |
| `/cloudflare/zones/:id/ssl/origin` | POST | Generate Origin CA cert |

### Zone Settings
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones/:id/settings` | GET | Get all zone settings |
| `/cloudflare/zones/:id/settings` | PUT | Update settings |
| `/cloudflare/zones/:id/cache` | GET/PUT | Cache settings |
| `/cloudflare/zones/:id/cache/purge` | POST | Purge cache |

### Redirects & Rules
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones/:id/redirects` | GET | List redirect rules |
| `/cloudflare/zones/:id/redirects` | POST | Create redirect |
| `/cloudflare/zones/:id/redirects/:ruleId` | PUT/DELETE | Update/delete |

### Tunnel Integration
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones/:id/tunnel-routes` | GET | List tunnel routes |
| `/cloudflare/zones/:id/tunnel-routes` | POST | Add tunnel route |
| `/cloudflare/zones/:id/tunnel-routes/:routeId` | DELETE | Remove tunnel route |

### Verification
| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones/:id/verify-dns` | GET | Verify DNS CNAME |
| `/cloudflare/zones/:id/verify-route` | GET | Verify tunnel route |
| `/cloudflare/zones/:id/health` | GET | Full health check |

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
1. Unified Cloudflare API client service
2. Zone management (list, create, delete)
3. Basic DNS record CRUD

### Phase 2: Tunnel Integration (Week 2)
4. Tunnel route sync with Cloudflare CNAMEs
5. Auto-create CNAME when route added
6. Auto-delete CNAME when route deleted
7. Website → domain → tunnel route automation

### Phase 3: SSL & Settings (Week 3)
8. SSL mode management
9. Zone settings (HTTPS, HTTP/2, cache TTL)
10. Origin CA certificate support

### Phase 4: Advanced Features (Week 4)
11. Redirect rules
12. Mail DNS presets
13. Verification tools
14. Zone overview dashboard

### Phase 5: Polish (Week 5)
15. Error handling and retry logic
16. Plan feature detection
17. UI/UX refinement
18. Documentation

---

## Required API Token Permissions

```json
{
  "permissions": {
    "Zone": { "read": true, "write": true },
    "DNS": { "read": true, "write": true },
    "SSL": { "read": true, "write": true },
    "Firewall": { "read": true, "write": true },
    "Cache Settings": { "read": true, "write": true },
    "Page Rules": { "read": true, "write": true },
    "Account Settings": { "read": true }
  }
}
```

---

## Key Cloudflare API Reference

### Zone Operations
```
GET    /zones
POST   /zones
GET    /zones/:zone_id
PATCH  /zones/:zone_id
DELETE /zones/:zone_id
```

### DNS Operations
```
GET    /zones/:zone_id/dns_records
POST   /zones/:zone_id/dns_records
PUT    /zones/:zone_id/dns_records/:record_id
PATCH  /zones/:zone_id/dns_records
DELETE /zones/:zone_id/dns_records/:record_id
```

### SSL/TLS Operations
```
GET    /zones/:zone_id/settings/ssl
PATCH  /zones/:zone_id/settings/ssl
GET    /zones/:zone_id/ssl/certificate
POST   /zones/:zone_id/ssl/certificate
DELETE /zones/:zone_id/ssl/certificate/:cert_id
```

### Zone Settings
```
GET    /zones/:zone_id/settings
PATCH  /zones/:zone_id/settings/{setting_name}
POST   /zones/:zone_id/cache/purge
PATCH  /zones/:zone_id/settings/paused
```

### Redirect/Rulesets (Modern API)
```
GET    /zones/:zone_id/rulesets
POST   /zones/:zone_id/rulesets/{ruleset_id}/rules
PUT    /zones/:zone_id/rulesets/{ruleset_id}/rules/{rule_id}
DELETE /zones/:zone_id/rulesets/{ruleset_id}/rules/{rule_id}
```

### Tunnel Operations
```
GET    /accounts/:account_id/cfd_tunnel
POST   /accounts/:account_id/cfd_tunnel
GET    /accounts/:account_id/cfd_tunnel/:tunnel_id
DELETE /accounts/:account_id/cfd_tunnel/:tunnel_id
PUT    /accounts/:account_id/cfd_tunnel/:tunnel_id/configurations
GET    /accounts/:account_id/cfd_tunnel/:tunnel_id/connections
```

---

## Paradigm Summary

**When server is behind Cloudflare Tunnel, NovaPanel architecture becomes:**

```
┌─────────────────────────────────────────────────────────┐
│                        NovaPanel                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Domain Management                                     │
│   ├── Domain Registration (registrar NS set)            │
│   ├── DNS Records ─────────────────────────────────────│
│   │   └──► Cloudflare DNS API (NOT local BIND)         │
│   │                                                         │
│   ├── Website Creation ────────────────────────────────│
│   │   └──► Nginx vhost + Tunnel route + Cloudflare CNAME│
│   │                                                         │
│   ├── SSL Certificates ────────────────────────────────│
│   │   └──► Cloudflare SSL mode + Origin CA (NOT LE)    │
│   │                                                         │
│   └── Mail DNS ────────────────────────────────────────│
│       └──► Cloudflare DNS API (MX, TXT records)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Local BIND9 DNS → Irrelevant for public-facing tunnel domains**
**Let's Encrypt → Irrelevant for tunnel-served domains (unless strict SSL)**
**Cloudflare Dashboard → Irrelevant if panel does everything via API**