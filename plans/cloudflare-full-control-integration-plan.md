# Cloudflare Full Control Integration Plan

## Objective
Enable complete Cloudflare control panel functionality within NovaPanel - eliminating need for Cloudflare dashboard for DNS, domains, SSL, firewall, cache, and Page Rules management.

---

## Current State Analysis

### Existing NovaPanel Modules

| Module | Current Implementation | Cloudflare Integration Status |
|--------|----------------------|-------------------------------|
| **Domains** | Local domain/subdomain/alias/redirect management | ❌ Not Cloudflare-aware |
| **DNS** | BIND-based local DNS zones | ⚠️ Cloudflare stubs exist but NOT implemented |
| **SSL** | Let's Encrypt (HTTP-01 + DNS-01 via Cloudflare) | ✅ Cloudflare DNS-01 working |
| **Tunnels** | Cloudflare Tunnel management | ✅ Well implemented |
| **Firewall** | Local iptables-based | ❌ No Cloudflare Firewall API |
| **Cache** | None | ❌ No Cloudflare Cache API |

### Critical Gaps

1. **DNS Service**: Cloudflare DNS methods are stubs (log only, return dummy data)
2. **No Domain Sync**: Local domains not synced with Cloudflare zones
3. **No Firewall Rules**: No Cloudflare WAF rule management
4. **No Cache Control**: No Cloudflare Cache settings API
5. **No Page Rules**: No Cloudflare Page Rules management
6. **No Origin Certificates**: No Cloudflare Origin CA certificates
7. **No SSL Modes**: No Universal SSL, Custom Certificates via Cloudflare

---

## Comprehensive Cloudflare API Integration Plan

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      NovaPanel                              │
├─────────────────────────────────────────────────────────────┤
│  Domains    │  DNS     │  SSL   │ Firewall │ Cache │ SSL  │
│  Service    │  Service │ Service│ Service  │ Service│ Modes│
├─────────────────────────────────────────────────────────────┤
│              Cloudflare Unified Service                    │
│         (Single CF API client with rate limiting)          │
├─────────────────────────────────────────────────────────────┤
│                    Cloudflare API v4                       │
│  Zones │ DNS │ SSL │ Firewall │ Cache │ Page Rules │ Workers│
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Cloudflare Unified API Client (Foundation)

#### 1.1 Create Cloudflare Service Module
**New File**: `apps/api/src/services/cloudflare.service.ts`

```typescript
interface CloudflareClientConfig {
  apiToken: string;
  accountId?: string;
  baseUrl?: string;
}

interface CloudflareZone {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'initializing' | 'moved';
  plan: { name: string };
  paused: boolean;
  type: 'full' | 'partial' | 'superfull';
}

interface CloudflareDnsRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SPF' | 'SOA' | 'SRV' | 'CAA' | 'PTR';
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  priority?: number;
  tags: string[];
  meta: { auto_added: boolean; source: string };
  comment?: string;
  created_at: string;
  updated_at: string;
}

export class CloudflareService {
  private apiToken: string;
  private accountId?: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  
  constructor(config: CloudflareClientConfig) {
    this.apiToken = config.apiToken;
    this.accountId = config.accountId;
  }
  
  // --- Zone Management ---
  async listZones(): Promise<CloudflareZone[]>
  async getZone(zoneId: string): Promise<CloudflareZone>
  async getZoneByName(name: string): Promise<CloudflareZone>
  async createZone(name: string, jumpstart?: boolean): Promise<CloudflareZone>
  async deleteZone(zoneId: string): Promise<void>
  
  // --- DNS Records ---
  async listDnsRecords(zoneId: string, filters?: {...}): Promise<CloudflareDnsRecord[]>
  async getDnsRecord(zoneId: string, recordId: string): Promise<CloudflareDnsRecord>
  async createDnsRecord(zoneId: string, record: {...}): Promise<CloudflareDnsRecord>
  async updateDnsRecord(zoneId: string, recordId: string, record: {...}): Promise<CloudflareDnsRecord>
  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void>
  async patchDnsRecords(zoneId: string, records: {...}): Promise<void>
  
  // --- SSL/TLS ---
  async getSslSettings(zoneId: string): Promise<{...}>
  async updateSslSettings(zoneId: string, settings: {...}): Promise<void>
  async getCertificates(zoneId: string): Promise<{...}>
  async uploadCustomCertificate(zoneId: string, ...): Promise<{...}>
  async deleteCustomCertificate(zoneId: string, certId: string): Promise<void>
  async getOriginCertificate(zoneId: string): Promise<{...}>
  
  // --- Firewall Rules ---
  async listFirewallRules(zoneId: string): Promise<{...}>
  async createFirewallRule(zoneId: string, rule: {...}): Promise<{...}>
  async updateFirewallRule(zoneId: string, ruleId: string, rule: {...}): Promise<{...}>
  async deleteFirewallRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Firewall Access Rules (IP allowlist) ---
  async listAccessRules(zoneId: string): Promise<{...}>
  async createAccessRule(zoneId: string, rule: {...}): Promise<{...}>
  async deleteAccessRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Cache Settings ---
  async getCacheSettings(zoneId: string): Promise<{...}>
  async updateCacheSettings(zoneId: string, settings: {...}): Promise<void>
  async purgeCache(zoneId: string, files?: string[]): Promise<void>
  
  // --- Page Rules ---
  async listPageRules(zoneId: string): Promise<{...}>
  async getPageRule(zoneId: string, ruleId: string): Promise<{...}>
  async createPageRule(zoneId: string, rule: {...}): Promise<{...}>
  async updatePageRule(zoneId: string, ruleId: string, rule: {...}): Promise<{...}>
  async deletePageRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Cloudflare Network Settings ---
  async getNetworkSettings(zoneId: string): Promise<{...}>
  async updateNetworkSettings(zoneId: string, settings: {...}): Promise<void>
  
  // --- Utility ---
  async verifyDns(zoneId: string): Promise<{...}>
  async getZoneAnalytics(zoneId: string, since: Date, until: Date): Promise<{...}>
}
}
```

#### 1.2 Rate Limiting & Error Handling
```typescript
// Token bucket rate limiting
const RATE_LIMIT = {
  requestsPerSecond: 10,
  burst: 100,
};

// Retry with exponential backoff
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};
```

---

### Phase 2: DNS & Domain Integration (High Priority)

#### 2.1 DNS Service Enhancement
**Modify**: `apps/api/src/modules/dns/dns.service.ts`

Add Cloudflare DNS alongside BIND DNS:

```typescript
// New configuration in .env
CLOUDFLARE_DNS_ENABLED=true
CLOUDFLARE_DEFAULT_PROXY=true  // Auto-proxy A,AAAA,CNAME records

export class DnsService {
  // Existing BIND methods...
  
  // NEW: Cloudflare DNS methods
  async syncWithCloudflare(domainId: string, apiToken: string): Promise<SyncResult>
  async createCloudflareRecord(domainId: string, record: {...}, cfApiToken: string): Promise<CloudflareDnsRecord>
  async deleteCloudflareRecord(domainId: string, recordId: string, cfApiToken: string): Promise<void>
  async importFromCloudflare(domainId: string, zoneId: string, cfApiToken: string): Promise<ImportResult>
  async exportToCloudflare(domainId: string, zoneId: string, cfApiToken: string): Promise<ExportResult>
}
```

#### 2.2 Domain Service Enhancement
**Modify**: `apps/api/src/modules/domains/domains.service.ts`

Sync domains with Cloudflare zones:

```typescript
export class DomainsService {
  // Existing methods...
  
  // NEW: Cloudflare zone management
  async createWithCloudflare(domainId: string, cfApiToken: string, options?: {...}): Promise<CloudflareZone>
  async deleteCloudflareZone(domainId: string, cfApiToken: string): Promise<void>
  async getCloudflareZoneInfo(domainId: string, cfApiToken: string): Promise<CloudflareZone>
  async updateCloudflareZoneSettings(domainId: string, cfApiToken: string, settings: {...}): Promise<void>
}
```

#### 2.3 Subdomain Auto-Creation on Cloudflare
When creating a subdomain, automatically create DNS record on Cloudflare:

```typescript
async createSubdomain(domainId: string, data: {...}, cfApiToken?: string) {
  // Existing local subdomain creation...
  
  // NEW: Cloudflare DNS sync
  if (cfApiToken) {
    const zone = await cloudflareService.getZoneByName(domain.name);
    await cloudflareService.createDnsRecord(zone.id, {
      type: 'A',
      name: `${data.name}.${domain.name}`,
      content: serverIp,
      proxied: false,
    });
  }
}
```

---

### Phase 3: SSL/TLS Integration (High Priority)

#### 3.1 Cloudflare Origin Certificates
**Add to**: `apps/api/src/modules/ssl/ssl.service.ts`

```typescript
// Cloudflare Origin CA Certificate (free, auto-renewed)
async issueCloudflareOriginCert(domainId: string, cfApiToken: string): Promise<{
  certificate: string;
  privateKey: string;
  expiresAt: Date;
}> {
  // Request Origin CA certificate from Cloudflare
  // Install in nginx
  // Note: Only works when proxied through Cloudflare
}
```

#### 3.2 Universal SSL Management
```typescript
// Enable/disable Universal SSL
async updateUniversalSsl(domainId: string, enabled: boolean, cfApiToken: string): Promise<void> {
  const zone = await cloudflareService.getZoneByName(domainName);
  await cloudflareService.updateSslSettings(zone.id, {
    universal: { enabled }
  });
}

// Get SSL certificate bundles from Cloudflare
async getSslCertificateBundle(domainId: string, cfApiToken: string): Promise<{
  primaryCertificate: string;
  intermediateCertificate: string;
}>
```

#### 3.3 Custom SSL Certificate via Cloudflare
```typescript
async uploadCustomViaCloudflare(domainId: string, certificate: string, privateKey: string, chain?: string, cfApiToken: string): Promise<void> {
  // Upload directly to Cloudflare for edge certificates
  const zone = await cloudflareService.getZoneByName(domainName);
  await cloudflareService.uploadCustomCertificate(zone.id, certificate, privateKey, chain);
}
```

---

### Phase 4: Firewall/WAF Integration (Medium Priority)

#### 4.1 Firewall Rules Module
**New File**: `apps/api/src/modules/firewall/firewall.cloudflare.service.ts`

```typescript
interface FirewallRule {
  id: string;
  paused: boolean;
  description: string;
  action: 'block' | 'challenge' | 'allow' | 'js_challenge' | 'log' | 'skip';
  priority?: number;
  filter: {
    id: string;
    expression: string;
    paused: boolean;
  };
}

export class FirewallService {
  // --- Cloudflare Firewall Rules ---
  async listRules(zoneId: string): Promise<FirewallRule[]>
  async createRule(zoneId: string, rule: Omit<FirewallRule, 'id'>): Promise<FirewallRule>
  async updateRule(zoneId: string, ruleId: string, rule: Partial<FirewallRule>): Promise<FirewallRule>
  async deleteRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Cloudflare Access Rules (IP Allowlist) ---
  async listAccessRules(zoneId: string): Promise<AccessRule[]>
  async createAccessRule(zoneId: string, rule: {...}): Promise<AccessRule>
  async deleteAccessRule(zoneId: string, ruleId: string): Promise<void>
  
  // --- Managed WAF Rules ---
  async listManagedRules(zoneId: string): Promise<ManagedRule[]>
  async updateManagedRule(zoneId: string, ruleId: string, settings: {...}): Promise<void>
}
```

#### 4.2 Firewall Rule Expressions
Cloudflare uses Wirefilter expressions:
```
(ip.src eq 192.168.1.1) or (http.request.uri.path contains "/admin")
```

**UI Builder**: Build expressions from dropdowns/checkboxes

---

### Phase 5: Cache Integration (Medium Priority)

#### 5.1 Cache Settings Module
**New File**: `apps/api/src/modules/cache/cache.cloudflare.service.ts`

```typescript
interface CacheSettings {
  cacheEverything: boolean;
  cacheTtl: number;
  edgeCacheTtl: number;
  browserCacheTtl: number;
  staleWhileRevalidating: boolean;
  alwaysOnline: boolean;
}

export class CacheService {
  // Get current cache settings
  async getSettings(zoneId: string): Promise<CacheSettings>
  
  // Update cache settings
  async updateSettings(zoneId: string, settings: Partial<CacheSettings>): Promise<void>
  
  // Purge specific files or all
  async purgeCache(zoneId: string, files?: string[]): Promise<{ purged: number }>
  async purgeEverything(zoneId: string): Promise<void>
  
  // Cache analytics
  async getCacheAnalytics(zoneId: string): Promise<CacheAnalytics>
}
```

#### 5.2 Cache Level Presets
```typescript
// Preset cache levels
const CACHE_PRESETS = {
  'basic': { cacheEverything: false },
  'simplified': { cacheEverything: true, edgeCacheTtl: 86400 },
  'aggressive': { cacheEverything: true, edgeCacheTtl: 604800, browserCacheTtl: 86400 },
  'standard': { /* Cloudflare standard */ },
};
```

---

### Phase 6: Page Rules Integration (Medium Priority)

#### 6.1 Page Rules Module
**New File**: `apps/api/src/modules/pagerules/pagerules.cloudflare.service.ts`

```typescript
interface PageRuleTarget {
  expression: string;
  params?: Record<string, string>;
}

interface PageRuleAction {
  id: string;  // e.g., "ssl", "cache_level", "forwarding_url"
  value?: string | Record<string, any>;
}

interface PageRule {
  id: string;
  targets: PageRuleTarget[];
  actions: PageRuleAction[];
  priority: number;
  status: 'active' | 'disabled';
}

export class PageRulesService {
  async list(zoneId: string): Promise<PageRule[]>
  async create(zoneId: string, rule: Omit<PageRule, 'id'>): Promise<PageRule>
  async update(zoneId: string, ruleId: string, rule: Partial<PageRule>): Promise<PageRule>
  async delete(zoneId: string, ruleId: string): Promise<void>
  async reorder(zoneId: string, ruleIds: string[]): Promise<void>
}
```

#### 6.2 Page Rule Actions
| Action | Description | Value Format |
|--------|-------------|-------------|
| `ssl` | Force SSL mode | `{"mode": "flexible" \| "full" \| "strict"}` |
| `cache_level` | Cache level | `{"cache_level": "bypass" \| "basic" \| "simplified" \| "aggressive" \| "cache_everything"}` |
| `forwarding_url` | Redirect | `{"url": "https://...", "status_code": 301 \| 302}` |
| `always_use_https` | Force HTTPS | no value |
| `automatic_https_rewrites` | Enable HTTPS rewrites | `{"value": "on" \| "off"}` |
| `cache_on_cookie` | Cache by cookie | `{"value": "wordpress*"}` |
| `ip_geolocation` | Add country header | no value |

---

### Phase 7: Cloudflare Settings Sync (Lower Priority)

#### 7.1 Zone Settings
```typescript
// DNS settings
async updateDnsSettings(zoneId: string, settings: {
  ttl: number;
  allowZoneWalkthrough: boolean;
  alwaysUseHttps: boolean;
  automaticAlternateNameservers: boolean;
}): Promise<void>

// SSL settings
async updateSslSettings(zoneId: string, settings: {
  mode: 'off' | 'flexible' | 'full' | 'strict';
  universalSsl: { enabled: boolean };
  minTlsVersion: '1.0' | '1.1' | '1.2' | '1.3';
  tls13: boolean;
}): Promise<void>

// Security settings
async updateSecuritySettings(zoneId: string, settings: {
  level: 'off' | 'low' | 'medium' | 'high' | 'under_attack';
  challengeTtl: number;
  browserCheck: boolean;
  botManagement: boolean;
}): Promise<void>
```

---

## Database Schema Changes

### New Tables

```typescript
// apps/api/src/db/schema/cloudflare.ts

export const cloudflareZones = sqliteTable('cloudflare_zones', {
  id: text('id').primaryKey(),           // NovaPanel ID
  zoneId: text('zone_id'),               // Cloudflare zone ID
  zoneName: text('zone_name').notNull(),
  accountId: text('account_id'),
  apiToken: text('api_token'),            // encrypted
  plan: text('plan'),
  status: text('status'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const cloudflareDnsRecords = sqliteTable('cloudflare_dns_records', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => cloudflareZones.id),
  recordId: text('record_id'),           // Cloudflare record ID
  type: text('type').notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  proxied: integer('proxied', { mode: 'boolean' }).default(false),
  ttl: integer('ttl').default(3600),
  priority: integer('priority'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const cloudflarePageRules = sqliteTable('cloudflare_page_rules', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => cloudflareZones.id),
  ruleId: text('rule_id'),              // Cloudflare rule ID
  pattern: text('pattern').notNull(),
  actions: text('actions'),             // JSON
  priority: integer('priority').default(1),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const cloudflareFirewallRules = sqliteTable('cloudflare_firewall_rules', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => cloudflareZones.id),
  ruleId: text('rule_id'),
  description: text('description'),
  action: text('action').notNull(),
  expression: text('expression').notNull(),
  priority: integer('priority'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
```

---

## API Routes

### New Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/cloudflare/zones` | GET/POST | List/create zones |
| `/cloudflare/zones/:id` | GET/PUT/DELETE | Zone CRUD |
| `/cloudflare/zones/:id/dns` | GET/POST | DNS records |
| `/cloudflare/zones/:id/dns/:recordId` | GET/PUT/DELETE | Record CRUD |
| `/cloudflare/zones/:id/ssl` | GET/PUT | SSL settings |
| `/cloudflare/zones/:id/ssl/certificate` | POST | Upload custom cert |
| `/cloudflare/zones/:id/firewall` | GET/POST | Firewall rules |
| `/cloudflare/zones/:id/firewall/:ruleId` | GET/PUT/DELETE | Rule CRUD |
| `/cloudflare/zones/:id/cache` | GET/PUT | Cache settings |
| `/cloudflare/zones/:id/cache/purge` | POST | Purge cache |
| `/cloudflare/zones/:id/pagerules` | GET/POST | Page rules |
| `/cloudflare/zones/:id/pagerules/:ruleId` | GET/PUT/DELETE | Rule CRUD |
| `/cloudflare/preflight` | GET | Connectivity pre-check |

---

## Implementation Priority

### Must Have (MVP)
1. **Cloudflare API Client** - Foundation layer
2. **DNS Zone Sync** - Sync domain DNS with Cloudflare
3. **SSL Origin Certificates** - Free Cloudflare Origin CA
4. **Basic Firewall Rules** - IP blocking/allowlisting

### Should Have
5. **Page Rules** - Redirects, cache levels
6. **Cache Purge API** - On-demand cache clearing
7. **Universal SSL Management** - Enable/disable

### Nice to Have
8. **WAF Managed Rules** - OWASP, WordPress, etc.
9. **Bot Management** - Bot score filtering
10. **Cloudflare Analytics** - Traffic insights dashboard

---

## Cloudflare API Endpoints Reference

### Zones
- `GET /zones` - List zones
- `POST /zones` - Create zone
- `GET /zones/:zone_id` - Zone details
- `PATCH /zones/:zone_id` - Update zone
- `DELETE /zones/:zone_id` - Delete zone

### DNS
- `GET /zones/:zone_id/dns_records` - List records
- `POST /zones/:zone_id/dns_records` - Create record
- `PUT /zones/:zone_id/dns_records/:record_id` - Update record
- `PATCH /zones/:zone_id/dns_records` - Batch update
- `DELETE /zones/:zone_id/dns_records/:record_id` - Delete record

### SSL/TLS
- `GET /zones/:zone_id/ssl/settings` - SSL settings
- `PUT /zones/:zone_id/ssl/settings` - Update SSL settings
- `GET /zones/:zone_id/ssl/certificate` - Custom cert info
- `POST /zones/:zone_id/ssl/certificate` - Upload custom cert
- `DELETE /zones/:zone_id/ssl/certificate/:cert_id` - Delete custom cert

### Firewall
- `GET /zones/:zone_id/firewall/rules` - Firewall rules
- `POST /zones/:zone_id/firewall/rules` - Create rule
- `PUT /zones/:zone_id/firewall/rules/:rule_id` - Update rule
- `DELETE /zones/:zone_id/firewall/rules/:rule_id` - Delete rule
- `GET /zones/:zone_id/firewall/access_rules` - Access rules (IP allowlist)
- `POST /zones/:zone_id/firewall/access_rules` - Create access rule
- `DELETE /zones/:zone_id/firewall/access_rules/:rule_id` - Delete access rule

### Cache
- `GET /zones/:zone_id/cache/settings` - Cache settings
- `PUT /zones/:zone_id/cache/settings` - Update cache settings
- `POST /zones/:zone_id/cache/purge` - Purge cache

### Page Rules
- `GET /zones/:zone_id/pagerules` - List page rules
- `POST /zones/:zone_id/pagerules` - Create page rule
- `PUT /zones/:zone_id/pagerules/:rule_id` - Update page rule
- `DELETE /zones/:zone_id/pagerules/:rule_id` - Delete page rule

---

## Configuration Requirements

### Required API Token Permissions
```json
{
  "permissions": {
    "Zone": { "read": true, "write": true },
    "DNS": { "read": true, "write": true },
    "SSL": { "read": true, "write": true },
    "Firewall": { "read": true, "write": true },
    "Cache Settings": { "read": true, "write": true },
    "Page Rules": { "read": true, "write": true }
  }
}
```

### Environment Variables
```bash
# Optional: Default Cloudflare API token (can be overridden per-zone)
CLOUDFLARE_API_TOKEN=

# Default settings
CLOUDFLARE_DEFAULT_PROXY=true
CLOUDFLARE_AUTO_SSL=true