# Plan: Comprehensive Domain & DNS Management System Audit

## Summary

This plan audits the current domain creation conditions, DNS management backend, and UI components to identify what's available and what's needed for a complete domain management system.

---

## 1. Domain Creation Conditions (Backend)

### Current Implementation
**File:** `apps/api/src/modules/domains/domains.routes.ts` (lines 20-34)

```
POST /domains
├── Validates name format via Zod (lowercase, alphanumeric + hyphens, max 253 chars)
├── Validates type: apex | subdomain | wildcard (default: apex)
├── Optional: skipDnsVerification (default: false)
│   └── If false: verifies domain resolves to server's primary IP
│       └── If not pointing to server: throws 400 DOMAIN_DNS_NOT_POINTING
├── Creates domain in DB (no duplicate name check!)
└── Logs audit event
```

### Issues Found
1. **No duplicate domain check** — Same domain can be added multiple times
2. **DNS verification is optional** — `skipDnsVerification: false` allows bypassing DNS checks
3. **No orgId enforcement** — Domain creation doesn't validate org permissions
4. **siteId is optional but not validated** — Can reference non-existent sites

### Recommended Changes
- Add unique constraint on `domains.name` (or check before insert)
- Remove `skipDnsVerification` from public API (admin-only override)
- Validate `siteId` exists if provided
- Check domain is not already owned by another org (if multi-tenant)

---

## 2. DNS Management (Backend)

### Current Implementation
**Files:**
- `apps/api/src/modules/dns/dns.service.ts` — Full DNS service
- `apps/api/src/db/schema/dns.ts` — Database schema
- `apps/api/src/modules/domains/domains.routes.ts` — Routes (lines 181+ for Cloudflare)

### Features Available

#### DNS Zones
- `GET /domains/:domainId/dns` — Get zone + records
- `POST /domains/:domainId/dns/ensure-zone` — Create zone if missing
- `DELETE /domains/:domainId/dns` — Delete zone + all records
- `POST /domains/:domainId/dns/reset-to-defaults` — Clear all records

#### DNS Records
**Supported Types:** A, AAAA, CNAME, MX, TXT, SRV, CAA, NS, PTR
- `POST /domains/:domainId/dns/records` — Create record
- `PUT /domains/:domainId/dns/records/:recordId` — Update record
- `DELETE /domains/:domainId/dns/records/:recordId` — Delete record

#### SOA Management
- `PUT /domains/:domainId/dns/soa` — Update SOA (primaryNs, adminEmail, refresh, retry, expire, minimumTtl)

#### Import/Export
- `POST /domains/:domainId/dns/import` — Import BIND format
- `GET /domains/:domainId/dns/export` — Export BIND format
- `GET /domains/:domainId/dns/raw` — Get raw zone file

#### Cloudflare Integration
- `GET /domains/:domainId/dns/cloudflare` — Get Cloudflare config
- `PUT /domains/:domainId/dns/cloudflare` — Update Cloudflare config
- `POST /domains/:domainId/dns/cloudflare/sync` — Sync records to Cloudflare

#### Propagation Check
- `GET /domains/:domainId/dns/propagation` — Check propagation (stubbed, returns dummy data)

### Issues Found
1. **Propagation check is stubbed** — Always returns false for all resolvers
2. **No NS record management UI** — Nameservers stored in DB but no CRUD API
3. **Cloudflare sync is one-way** — Only pushes to CF, doesn't pull
4. **No DNSSEC management** — Column exists but no API endpoints
5. **Zone creation is implicit** — Records API auto-creates zone, may be confusing

---

## 3. Nameserver Management

### Current Implementation
**Schema:** `apps/api/src/db/schema/domains.ts` (line 11)
- `nameservers` field: JSON array stored in `domains` table
- No dedicated API endpoints for nameserver CRUD
- Default values: `['ns1.cloudflare.com', 'ns2.cloudflare.com']`

### What's Missing
- API endpoint to get/set nameservers for a domain
- UI to display and edit nameservers
- Validation that nameservers are valid FQDNs
- Option to use custom nameservers vs provider defaults

---

## 4. UI Components Available

### Reusable Components (`apps/web/src/components/ui/`)
| Component | Status | Used For |
|-----------|--------|----------|
| Button | ✅ Ready | Actions, form submission |
| Card | ✅ Ready | Content containers |
| DataTable | ✅ Ready | Display tabular data (records, domains) |
| Modal | ✅ Ready | Create/edit dialogs |
| Input | ✅ Ready | Form fields |
| Tabs | ✅ Ready | Section navigation |
| Skeleton | ✅ Ready | Loading states |
| EmptyState | ✅ Ready | No data display |
| ErrorState | ✅ Ready | Error display |
| StatusBadge | ✅ Ready | Status indicators |
| ConfirmDialog | ✅ Ready | Delete confirmations |
| StatCard | ✅ Ready | Dashboard stats |
| ToastProvider | ✅ Ready | Notifications |
| CommandPalette | ✅ Ready | Global search |
| UploadZone | ✅ Ready | File uploads |

### Page Components (`apps/web/src/pages/`)
| Page | Status |
|------|--------|
| DomainsPage | ✅ List view with search, create, delete |
| DomainDetailPage | ✅ Overview, subdomains, aliases, redirects, DNS, SSL, mail, Cloudflare |
| DnsPage | ✅ Basic DNS record management |
| SslPage | ✅ Certificate management |

---

## 5. Domain Detail Page Features

### Existing Tabs/Sections (from DomainDetailPage.tsx)
1. **Overview** — Domain info, status, SSL status
2. **Subdomains** — Create/delete subdomains (in-memory storage only!)
3. **Aliases** — Domain aliases (in-memory storage only!)
4. **Redirects** — URL redirects (in-memory storage only!)
5. **DNS Records** — Uses `useDnsZone` hook
6. **SSL Certificates** — Issue/renew/download certs
7. **Mail** — Mailboxes, aliases, DKIM
8. **Cloudflare** — Zone, DNS records, SSL, firewall, redirects
9. **Logs** — Access and error logs

### Issues Found
1. **Subdomains/Aliases/Redirects use in-memory storage** — Lost on server restart (see domains.service.ts lines 39-43)
2. **No nameserver management UI**
3. **No DNSSEC management UI**
4. **No propagation checker UI** (backend is stubbed anyway)

---

## 6. Recommended Implementation Plan

### Phase 1: Domain Creation Fixes
1. **Add duplicate check** in `domains.service.ts` `create()` method
2. **Validate siteId** exists if provided
3. **Remove `skipDnsVerification`** from public schema (or make admin-only)
4. **Add unique constraint** on `domains.name` in DB schema

### Phase 2: Nameserver Management
1. **Backend:** Add API endpoints for nameserver CRUD
2. **Backend:** Validate nameserver FQDNs
3. **Frontend:** Add nameserver section to DomainDetailPage

### Phase 3: DNS Improvements
1. **Implement real propagation check** using multiple DNS resolvers
2. **Add DNSSEC management** endpoints and UI
3. **Improve zone management** — explicit zone creation/deletion UI

### Phase 4: Data Persistence
1. **Migrate subdomains** from in-memory to database table
2. **Migrate aliases** from in-memory to database table
3. **Migrate redirects** from in-memory to database table

---

## 7. Files Involved

### Backend
- `apps/api/src/modules/domains/domains.routes.ts`
- `apps/api/src/modules/domains/domains.service.ts`
- `apps/api/src/modules/domains/domains.schema.ts`
- `apps/api/src/modules/dns/dns.service.ts`
- `apps/api/src/modules/dns/dns.routes.ts` (if exists, or create)
- `apps/api/src/db/schema/domains.ts`
- `apps/api/src/db/schema/dns.ts`
- `apps/api/src/db/schema/` (new: subdomains, aliases, redirects tables)

### Frontend
- `apps/web/src/pages/domains/DomainsPage.tsx`
- `apps/web/src/pages/domains/DomainDetailPage.tsx`
- `apps/web/src/pages/dns/DnsPage.tsx`
- `apps/web/src/api/hooks/domains.ts`
- `apps/web/src/api/hooks/dns.ts`
- `apps/web/src/components/layout/Sidebar.tsx`

---

## 8. UI Components Availability — Confirmed ✅

All required UI components are already built and available:
- **Button** — For actions
- **Card** — For section containers
- **DataTable** — For DNS records, subdomains, aliases
- **Modal** — For create/edit forms
- **Input** — For form fields
- **Tabs** — For domain detail sections
- **ConfirmDialog** — For delete confirmations
- **StatusBadge** — For domain/record status
- **EmptyState** — For empty lists
- **ToastProvider** — For notifications

No new UI components need to be created. The existing component library is sufficient.
