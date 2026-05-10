# Subdomain Creation & Website Attachment - Comprehensive Implementation Plan

**Date:** 2026-05-10
**Status:** Implementation Planning
**Based on:** Code analysis of domain/website architecture

---

## Executive Summary

This plan details the workflow for creating subdomains and attaching domains/subdomains to websites in NovaPanel. The architecture uses a **Domain ↔ Website separation** model where domains have a `websiteId` foreign key, and subdomains are stored separately with a `domainId` FK (inheriting website attachment via their parent domain).

**Key Architecture:**
- `domains` table: `websiteId` FK links domain to website
- `subdomains` table: `domainId` FK links subdomain to parent domain (not directly to website)
- Nginx config: Generated per-website (`website-{id}.conf`) with server blocks for all attached domains
- Subdomains are served by regenerating the parent domain's website nginx config

---

## Current Architecture Analysis

### Database Schema

```typescript
// apps/api/src/db/schema/domains.ts

domains table:
  - id, name, documentRoot, systemUser, phpVersion, phpHandler, webServer
  - sslEnabled, sslCertId, redirectHttpToHttps, hsts
  - status, createdAt
  - type: 'primary' | 'subdomain' | 'alias' | 'redirect' | 'parked' | 'mail-only'
  - websiteId: FK → websites.id (ON DELETE SET NULL)
  - redirectTarget, parentDomainId

subdomains table:
  - id, domainId (FK → domains.id ON DELETE CASCADE)
  - name: full subdomain name (e.g., "blog.example.com")
  - documentRoot: path like /var/www/vhosts/example.com/subdomains/blog
  - phpVersion: inherited from parent if not specified
  - createdAt
```

### Key Relationships

```
┌─────────────┐       ┌─────────────┐
│  websites   │       │   domains   │
│─────────────│       │─────────────│
│ id (PK)     │←──────│ websiteId   │
│ name        │       │ id (PK)     │
│ documentRoot│       │ name        │
│ phpVersion  │       │ type        │
│ phpHandler  │       │ parentDomainId│
└─────────────┘       └──────┬──────┘
                              │ 1:many (domainId FK)
                              ↓
                        ┌─────────────┐
                        │ subdomains  │
                        │─────────────│
                        │ id (PK)     │
                        │ domainId (FK)│
                        │ name        │
                        │ documentRoot│
                        │ phpVersion  │
                        └─────────────┘
```

### Nginx Configuration

**File:** [`apps/api/src/services/nginx.service.ts`](apps/api/src/services/nginx.service.ts:98)

Website-scoped config generation:
- `generateWebsiteConfig(websiteId)` — Creates `/etc/nginx/sites-available/website-{id}.conf`
- Fetches all domains with `WHERE websiteId = ?`
- Renders one `server` block per domain (including www alias + domain aliases)
- Subdomains inherit website config via parent domain's `websiteId`

**Critical Gap:** Subdomains are NOT explicitly listed in nginx config. They rely on:
1. Parent domain being in nginx config
2. DNS resolving subdomain to same server IP
3. nginx catching all requests and serving from parent document root OR separate subdomain document root

---

## Subdomain Creation Workflow

### Frontend → Backend Flow

```
User Action                    Frontend Component              Backend Service
─────────────                  ────────────────               ──────────────
1. Navigate to Domain Detail   DomainsPage.tsx               -
2. Click "Subdomains" tab      -                              -
3. Enter subdomain name        SubdomainForm input            -
4. (Optional) Set doc root     Document root input            -
5. Click "Create"              handleCreateSubdomain()       -
                                ↓
                                useCreateSubdomain mutation   -
                                ↓
                                                              DomainsService.createSubdomain()
                                                              ├── Validate subdomain name
                                                              ├── Check reserved names
                                                              ├── Check conflicts
                                                              ├── Create directory
                                                              ├── Set ownership
                                                              ├── Insert subdomain record
                                                              ├── Create DNS A record (if zone exists)
                                                              ├── Auto-create Cloudflare tunnel route
                                                              ├── If parent.domain.websiteId:
                                                              │   └── nginxService.generateWebsiteConfig()
                                                              └── Audit log
```

### API Endpoints

| Method | Endpoint | Handler | File |
|--------|----------|---------|------|
| GET | `/api/v1/domains/:id/subdomains` | `listSubdomains()` | [`domains.routes.ts:114`](apps/api/src/modules/domains/domains.routes.ts:114) |
| POST | `/api/v1/domains/:id/subdomains` | `createSubdomain()` | [`domains.routes.ts:120`](apps/api/src/modules/domains/domains.routes.ts:120) |
| DELETE | `/api/v1/domains/:id/subdomains/:subId` | `deleteSubdomain()` | [`domains.routes.ts:127`](apps/api/src/modules/domains/domains.routes.ts:127) |

### Request/Response Shapes

**POST /domains/:id/subdomains**
```typescript
// Request
{
  name: string;           // e.g., "blog"
  documentRoot?: string;  // optional, defaults to /var/www/vhosts/{domain}/{name}
  phpVersion?: string;    // optional, inherits from parent domain
}

// Response
{
  success: true,
  data: {
    id: string;
    name: string;         // full name e.g., "blog.example.com"
    documentRoot: string;
  }
}
```

### Frontend Components

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| Subdomains tab | [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:1063) | ~160 | Tab content with form + list |
| Subdomain creation form | [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:1115) | ~60 | Input, validation, submit |
| Subdomain list | [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:1181) | ~40 | Table of subdomains |

### Frontend Hooks

**File:** [`apps/web/src/api/hooks/domains.ts`](apps/web/src/api/hooks/domains.ts:138)
```typescript
useSubdomains(domainId)       // GET list
useCreateSubdomain(domainId)  // POST create
useDeleteSubdomain(domainId)  // DELETE
```

---

## Domain Attachment to Website Workflow

### Frontend → Backend Flow

```
User Action                     Frontend Component               Backend Service
─────────────                   ────────────────                ──────────────
1. Navigate to Website Detail  WebsiteDetailPage.tsx          -
2. Click "Domains" tab         -                                -
3. Click "Attach Domain"       -                                -
4. Select domain from modal    LinkWebsiteModal                -
   (filtered: unassigned only)  ↓
                                useAttachDomain mutation       -
                                ↓
                                                               WebsitesService.attachDomain()
                                                               ├── Validate domain exists
                                                               ├── Check not attached elsewhere
                                                               ├── Update domain.websiteId
                                                               ├── Regenerate nginx config
                                                               └── Audit log
```

### API Endpoints

| Method | Endpoint | Handler | File |
|--------|----------|---------|------|
| POST | `/api/v1/websites/:id/domains/attach` | `attachDomain()` | [`websites.routes.ts:72`](apps/api/src/modules/websites/websites.routes.ts:72) |
| POST | `/api/v1/websites/:id/domains/detach` | `detachDomain()` | [`websites.routes.ts:79`](apps/api/src/modules/websites/websites.routes.ts:79) |

### Attach Domain Service Logic

**File:** [`apps/api/src/modules/websites/websites.service.ts`](apps/api/src/modules/websites/websites.service.ts:453)

```typescript
async attachDomain(websiteId, domainId, userId?, ipAddress?) {
  // 1. Validate domain exists and isn't attached to another website
  // 2. Update domain.websiteId in DB
  // 3. Regenerate the website's nginx config (to add the new server block)
  // 4. Audit log
}
```

### Frontend Components

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| Domains tab | [`WebsiteDetailPage.tsx`](apps/web/src/pages/websites/WebsiteDetailPage.tsx:342) | ~100 | Domain list + attach/detach |
| LinkWebsiteModal | [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:103) | ~60 | Modal for linking domain to website |

---

## DNS Record Creation During Subdomain Creation

### Flow

```
createSubdomain() call
    ↓
Check if DNS zone exists for parent domain
  dnsService.getZone(domainId) → dnsZones lookup
    ↓
If zone exists:
  ├── Detect server IP (detectNetworkInfo())
  ├── Create DNS A record:
  │   name: subdomain prefix (e.g., "blog")
  │   type: "A"
  │   value: server IP
  │   ttl: 3600
  │   isSystem: true
  └── Sync zone to disk
      dnsService.syncZoneToDisk(zone.id)
    ↓
If zone doesn't exist: Best-effort, continue without DNS
```

**File:** [`domains.service.ts:747-778`](apps/api/src/modules/domains/domains.service.ts:747)

### DNS Service Methods Involved

| Method | File | Description |
|--------|------|-------------|
| `getZone(domainId)` | [`dns.service.ts:22`](apps/api/src/modules/dns/dns.service.ts:22) | Get or create DNS zone for domain |
| `syncZoneToDisk(zoneId)` | [`dns.service.ts`](apps/api/src/modules/dns/dns.service.ts) | Write zone file to `/etc/bind/zones/` |

---

## Nginx Configuration for Subdomains

### Current Behavior

Subdomains do NOT get their own server block in nginx. Instead:

1. Parent domain is in nginx config with `server_name example.com www.example.com`
2. Subdomain DNS A record points to same server IP
3. nginx receives request for `blog.example.com`
4. **No matching server_name** → falls through to default or first server block
5. **May serve wrong content** unless:
   - Wildcard DNS (`*.example.com → server IP`)
   - Wildcard nginx config (`server_name *.example.com`)
   - OR explicit subdomain handling in parent domain's config

### Recommended Fix

The current implementation regenerates nginx config for the parent domain's website, but this only adds the parent domain's server_name — NOT the subdomain.

**Options:**
1. **Wildcard subdomain** — Add `server_name *.example.com` to parent domain's nginx config
2. **Explicit subdomain entries** — Add each subdomain as separate server_name entry
3. **Subdirectory-based** — Serve subdomains from `/subdomains/{name}/` within parent document root

**Current code regenerates nginx config:**
```typescript
// domains.service.ts:785-787
if (domain.websiteId) {
  await nginxService.generateWebsiteConfig(domain.websiteId);
}
```

But `generateWebsiteConfig` only processes `domains` table entries — not `subdomains` table.

---

## Document Root Management

### Subdomain Document Root

**Default path:** `/var/www/vhosts/{domain}/subdomains/{subdomain}`

**Example:** `blog.example.com` → `/var/www/vhosts/example.com/subdomains/blog`

**Custom path:** User can override via `documentRoot` parameter

### Directory Creation

```typescript
// domains.service.ts:734
await sudoFs.mkdir(docRoot);
// domains.service.ts:735-736
if (domain.systemUser) {
  await run('chown', [`${domain.systemUser}:www-data`, docRoot], { sudo: true });
}
```

### Gap: Website Document Root vs Subdomain Document Root

When a domain is attached to a website:
- Website has its own `documentRoot` (e.g., `/var/www/vhosts/myapp`)
- Subdomain has separate `documentRoot` (e.g., `/var/www/vhosts/example.com/subdomains/blog`)

**This creates a disconnect:**
- Parent domain serves from website.documentRoot
- Subdomain serves from subdomain.documentRoot
- These are different directories

---

## Potential Issues & Gaps

### 1. Subdomains Not Explicitly in Nginx Config

**Issue:** Subdomains rely on DNS wildcard or fallthrough, not explicit nginx server blocks.

**Current code:** [`nginx.service.ts:115-134`](apps/api/src/services/nginx.service.ts:115) only iterates `domains`, not `subdomains`.

**Fix:** Option A — Add wildcard `server_name *.domain.com` to parent domain block. Option B — Iterate subdomains and add each as additional server_name entries.

### 2. Subdomain Cannot Be Attached to Different Website

**Issue:** Subdomain's `domainId` FK links to parent domain. It cannot independently attach to a different website than its parent.

**Current design:** Subdomain inherits website attachment from parent domain (`subdomain → domain → website`).

**Limitation:** If user wants `blog.example.com` to serve from Website A while `example.com` serves from Website B, this is not supported.

### 3. No Website-Level Subdomain Management

**Issue:** Subdomains are managed at the domain level only. There's no unified view of all subdomains across all parent domains.

**Gap:** No "Subdomains" section in Website Detail Page showing subdomains of all attached domains.

### 4. DNS A Record Name Extraction Bug Risk

**Issue:** In `deleteSubdomain()`, the code extracts subdomain prefix:

```typescript
// domains.service.ts:817
const subdomainName = sub.name.split('.')[0];
```

This assumes `sub.name` is full subdomain (e.g., "blog.example.com") and takes first segment. If `sub.name` ever stores just the prefix, this breaks.

### 5. Rollback on Nginx Failure Only Rolls Back DB Record

**Issue:** Directory and DNS records created before nginx failure are not cleaned up.

```typescript
// domains.service.ts:788-792
} catch (nginxError) {
  await db.delete(subdomains).where(eq(subdomains.id, subId));
  // ⚠️ docRoot directory still exists
  // ⚠️ DNS record still exists
```

### 6. No Subdomain-Specific SSL Management

**Issue:** Subdomains are not separate SSL entities. SSL is managed at the domain level only.

**Gap:** Cannot provision separate SSL for subdomain without separate domain entry.

---

## Recommendations for Improvement

### High Priority

1. **Add wildcard server_name support**
   - Modify `generateWebsiteConfig()` to detect if domain has subdomains
   - Add `server_name *.domain.com` to catch all subdomains
   - OR explicitly list subdomains as additional server_name entries

2. **Improve rollback handling**
   - Store created resources (directory, DNS record) in subdomain record
   - On nginx failure: clean up directory + DNS record + tunnel route

3. **Subdomain document root inheritance**
   - When creating subdomain, check if parent domain is attached to website
   - If yes, set subdomain doc root relative to website doc root OR allow separate doc root

### Medium Priority

4. **Subdomain overview in Website Detail Page**
   - Add "Subdomains" section showing subdomains of all attached domains
   - Enable management from website context

5. **DNS pre-check for subdomain creation**
   - Check if subdomain DNS already exists (conflict detection)
   - Show DNS propagation status

6. **Wildcard subdomain feature**
   - Enable `*.domain.com` in Cloudflare with single click
   - Auto-create CNAME and tunnel route template

### Low Priority

7. **Independent subdomain website attachment**
   - Add optional `websiteId` to `subdomains` table
   - Allow subdomain to attach to different website than parent

8. **Subdomain-specific SSL**
   - Create subdomain as separate domain with type='subdomain'
   - Full SSL lifecycle management per subdomain

---

## Step-by-Step Workflow Summary

### Subdomain Creation

```
[Frontend] User enters subdomain name in DomainsPage subdomains tab
    ↓
[Frontend] Validate name format + check reserved + check existing
    ↓
[Frontend] useCreateSubdomain() mutation
    ↓
[API] POST /api/v1/domains/:id/subdomains
    ↓
[Backend] createSubdomain(domainId, data)
    ├── Validate domain exists
    ├── Validate subdomain name format
    ├── Check reserved names
    ├── Check conflicts
    ├── Create directory with sudoFs.mkdir()
    ├── Set ownership chown
    ├── Insert into subdomains table
    ├── Create DNS A record (best-effort, zone must exist)
    ├── Auto-create Cloudflare tunnel route (best-effort)
    ├── If parent.domain.websiteId:
    │   └── nginxService.generateWebsiteConfig(parent.domain.websiteId)
    └── Audit log
    ↓
[API] { success: true, data: { id, name, documentRoot } }
    ↓
[Frontend] Invalidate subdomains query, show success toast
```

### Domain Attachment to Website

```
[Frontend] User clicks "Attach Domain" in WebsiteDetailPage domains tab
    ↓
[Frontend] LinkWebsiteModal shows available (unassigned) domains
    ↓
[Frontend] User selects domain, clicks "Link"
    ↓
[Frontend] useAttachDomain() mutation
    ↓
[API] POST /api/v1/websites/:id/domains/attach
    ↓
[Backend] attachDomain(websiteId, domainId)
    ├── Validate domain exists
    ├── Check domain not attached to another website
    ├── Update domain.websiteId
    ├── Regenerate nginx config for this website
    └── Audit log
    ↓
[API] { success: true }
    ↓
[Frontend] Invalidate domains + websites queries, show success toast
```

---

## Files to Modify for Improvements

| File | Changes |
|------|---------|
| [`apps/api/src/services/nginx.service.ts`](apps/api/src/services/nginx.service.ts) | Add subdomain handling in `generateWebsiteConfig()` |
| [`apps/api/src/modules/domains/domains.service.ts`](apps/api/src/modules/domains/domains.service.ts) | Improve rollback, add wildcard support |
| [`apps/api/src/modules/websites/websites.service.ts`](apps/api/src/modules/websites/websites.service.ts) | Consider subdomain listing in website context |
| [`apps/web/src/pages/websites/WebsiteDetailPage.tsx`](apps/web/src/pages/websites/WebsiteDetailPage.tsx) | Add subdomains section to domains tab |
| [`apps/web/src/pages/domains/DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx) | DNS pre-check, improved error handling |
| [`apps/api/src/db/schema/domains.ts`](apps/api/src/db/schema/domains.ts) | Optional: add websiteId to subdomains for independent attachment |

---

*Plan created 2026-05-10 based on code analysis of NovaPanel domain/website architecture*