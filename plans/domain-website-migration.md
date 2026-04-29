# Domain/Website Separation — Gap Analysis & Migration Plan

## Current State Analysis

### What the Current Codebase Has

The current system **conflates domains and websites into a single `domains` entity**. Everything is accessed through the domain, with no separate website concept.

#### Current DB Schema

| Table | Current FK | Target FK | Status |
|-------|-----------|-----------|--------|
| `domains` | — (has website fields mixed in) | Split into `domains` + `websites` | ❌ Needs split |
| `subdomains` | FK → `domains.id` | Remove table (subdomains become domain records) | ❌ Needs migration |
| `domain_aliases` | FK → `domains.id` | FK → `domains.id` | ✅ Correct |
| `domain_redirects` | FK → `domains.id` | FK → `domains.id` | ✅ Correct |
| `dns_zones` | FK → `domains.id` | FK → `domains.id` | ✅ Correct |
| `dns_records` | FK → `dns_zones.id` | FK → `dns_zones.id` | ✅ Correct |
| `ssl_certificates` | FK → `domains.id` | FK → `domains.id` | ✅ Correct |
| `mail_domains` | FK → `domains.id` | FK → `domains.id` | ✅ Correct |
| `mailboxes` | FK → `mail_domains.id` | FK → `mail_domains.id` | ✅ Correct |
| `mail_aliases` | FK → `mail_domains.id` | FK → `mail_domains.id` | ✅ Correct |
| `ftp_accounts` | FK → `domains.id` | FK → `websites.id` | ❌ Needs migration |
| `cron_jobs` | FK → `domains.id` | FK → `websites.id` | ❌ Needs migration |
| `backup_schedules` | FK → `domains.id` | FK → `websites.id` | ❌ Needs migration |
| `databases` | FK → `domains.id` | FK → `websites.id` (informational) | ❌ Needs migration |
| `installed_apps` | FK → `domainId` | FK → `websiteId` | ❌ Needs migration |
| `app_install_logs` | FK → `domainId` | FK → `websiteId` | ❌ Needs migration |

#### Current `domains` Table — Fields That Belong to Website

These fields are currently on `domains` but should move to a new `websites` table:

| Current Field | Target Location | Notes |
|--------------|----------------|-------|
| `documentRoot` | `websites.documentRoot` | Website owns files |
| `systemUser` | `websites.systemUser` | Website owns OS user |
| `phpVersion` | `websites.phpVersion` | PHP is per-website |
| `phpHandler` | `websites.phpHandler` | PHP handler is per-website |
| `webServer` | `websites.webServer` | Web server config is per-website |
| `sslEnabled` | Remove (derived from SSL cert existence) | Domain has SSL or not |
| `sslCertId` | Remove (SSL certs FK → domain already) | Redundant |
| `redirectHttpToHttps` | `domains` (routing rule) | Stays on domain |
| `hsts` | `domains` (routing rule) | Stays on domain |
| `diskUsedMb` | `websites` | Website owns disk |
| `bandwidthUsedMb` | `websites` | Website owns bandwidth |

#### Current `domains` Table — Fields That Need Adding

| New Field | Type | Notes |
|-----------|------|-------|
| `type` | text enum | primary, subdomain, alias, redirect, parked, mail-only |
| `websiteId` | text FK → websites.id | Nullable (redirect/parked domains have no website) |
| `redirectTarget` | text | URL for redirect-type domains |
| `parentDomainId` | text FK → domains.id | For subdomains |

#### Current UI Structure — What Needs to Change

| Current Page | Current Behavior | Target Behavior |
|-------------|-----------------|-----------------|
| `/domains` | Flat list, detail has ALL tabs | List only, detail has DNS/SSL/Mail/Subdomains/Settings tabs |
| `/webserver` | Standalone global page | Tab inside Website detail |
| `/php` | Standalone global page | Tab inside Website detail |
| `/ssl` | Standalone global page | Tab inside Domain detail |
| `/dns` | Standalone global page | Tab inside Domain detail |
| `/mail` | Standalone global page | Tab inside Domain detail |
| `/databases` | Standalone global page | Keep as server-global page |
| `/ftp` | Standalone global page | Tab inside Website detail |
| `/files` | Standalone global page | Tab inside Website detail |
| `/cron` | Standalone global page | Tab inside Website detail |
| `/backups` | Standalone global page | Tab inside Website detail |
| `/installer` | Standalone global page | Tab inside Website detail |
| `/logs` | Standalone global page | Tab inside Website detail |
| — | Does not exist | **NEW** `/websites` — Website list + detail page |

#### Current Services — What Needs to Change

| Service | Current Parameter | Target Parameter |
|---------|------------------|-----------------|
| `files.service.ts` | `domainId` → resolve homeDir | `websiteId` → use website.documentRoot |
| `ftp.service.ts` | `domainId` | `websiteId` |
| `cron.service.ts` | `domainId` | `websiteId` |
| `backup.service.ts` | `domainId` | `websiteId` |
| `databases.service.ts` | `domainId` | `websiteId` (informational) |
| `installer.service.ts` | `domainId` | `websiteId` |
| `logs.service.ts` | `domainName` | `websiteId` + domain name for log file |
| `webserver.service.ts` | `domainId` | `websiteId` |
| `php-fpm.service.ts` | per-domain pools | per-website pools |
| `nginx.service.ts` | per-domain vhosts | per-website vhosts (multi-domain) |

---

## Migration Plan — 10 Phases

### Phase 1: Create `websites` Table + Schema Migration

**DB Changes:**
- Create new `websites` table with: `id`, `name`, `systemUser`, `documentRoot`, `phpVersion`, `phpHandler`, `webServer`, `status`, `createdAt`
- Add to `domains` table: `type` (text, default 'primary'), `websiteId` (text FK → websites.id, nullable), `redirectTarget` (text, nullable), `parentDomainId` (text FK → domains.id, nullable)
- Migration: For each existing domain, create a website record and link it

**Files to create/modify:**
- `apps/api/src/db/schema/websites.ts` — NEW
- `apps/api/src/db/schema/domains.ts` — Add new columns
- `apps/api/src/db/migrations/0004_websites_separation.sql` — Migration
- `apps/api/src/db/schema/index.ts` — Export new schema

### Phase 2: Create Websites Service + Routes

**New files:**
- `apps/api/src/modules/websites/websites.service.ts` — CRUD for websites
- `apps/api/src/modules/websites/websites.routes.ts` — API routes
- `apps/api/src/modules/websites/websites.schema.ts` — Zod schemas

**Key operations:**
- `list()` — List all websites
- `get(id)` — Get website by ID with attached domains
- `create(data)` — Create website + system user + directory structure + PHP-FPM pool
- `update(id, data)` — Update website settings
- `delete(id)` — Full cascade delete (FTP, cron, backups, files, PHP-FPM, nginx, system user)
- `suspend(id)` / `activate(id)` — Toggle website status
- `attachDomain(websiteId, domainId)` — Link domain to website
- `detachDomain(websiteId, domainId)` — Unlink domain from website

### Phase 3: Migrate FTP/Cron/Backups/Installer to websiteId

**Modify these services to accept `websiteId` instead of `domainId`:**
- `apps/api/src/modules/ftp/ftp.service.ts` — Change FK
- `apps/api/src/modules/cron/cron.service.ts` — Change FK
- `apps/api/src/modules/backup/backup.service.ts` — Change FK
- `apps/api/src/modules/installer/installer.service.ts` — Change FK
- `apps/api/src/modules/databases/databases.service.ts` — Change FK (informational)
- `apps/api/src/db/schema/ftp.ts` — Change FK
- `apps/api/src/db/schema/cron.ts` — Change FK
- `apps/api/src/db/schema/backups.ts` — Change FK
- `apps/api/src/db/schema/databases.ts` — Change FK
- `apps/api/src/db/schema/installed-apps.ts` — Change FK

**Backward compatibility:** Keep `domainId` column temporarily, add `websiteId` column, migration script fills `websiteId` from `domain`'s linked website.

### Phase 4: Update Domain Creation Flow

**Modify `domains.service.ts`:**
- `create()` now accepts options:
  - `createWebsite: boolean` — Whether to auto-create a website
  - `createDns: boolean` — Whether to create DNS zone
  - `createMail: boolean` — Whether to enable mail
  - `type: 'primary' | 'redirect' | 'parked' | 'mail-only'`
  - `redirectTarget?: string` — For redirect type
- When `createWebsite: true`: Create website record, link domain to it
- When `type: 'redirect'`: No website created, set redirectTarget
- When `type: 'parked'`: No website created

**Modify `domains.routes.ts`:**
- Update create endpoint to accept new options

### Phase 5: Update Domain Detail Page (Frontend)

**Modify `DomainsPage.tsx`:**
- Domain list stays similar
- Domain detail tabs change to: Overview, DNS, SSL, Mail, Subdomains, Settings
- Remove Web Server, PHP, Files, FTP, Cron, Logs, Backups tabs from domain detail
- Overview tab shows attached website info (if any) with link to website
- Settings tab gets: Attach/Detach website, Change domain type, Suspend/Activate

### Phase 6: Create Websites Frontend Pages

**New files:**
- `apps/web/src/pages/websites/WebsitesPage.tsx` — Website list + detail
- `apps/web/src/api/hooks/websites.ts` — API hooks for websites

**Website detail tabs:** Overview, Web Server, PHP, Files, FTP, Cron, Logs, Backups, Apps
- Overview: Website info, attached domains list, disk usage, PHP version
- Web Server: Nginx/Apache config (moved from standalone page)
- PHP: PHP version/settings (moved from standalone page)
- Files: File manager scoped to this website
- FTP: FTP accounts for this website
- Cron: Cron jobs for this website
- Logs: Access/error logs for this website
- Backups: Backup management for this website
- Apps: Installed applications for this website

### Phase 7: Update Sidebar + Router

**Modify `Sidebar.tsx`:**
- Add "Websites" nav item between Domains and Databases
- Remove standalone Web Server, PHP pages from sidebar
- Keep SSL, DNS, Mail as standalone for quick access (they also appear as domain tabs)

**Modify `router.tsx`:**
- Add `/websites` route
- Add `/websites/:id` route for website detail
- Keep standalone routes for backward compatibility but they redirect to context-specific views

### Phase 8: Update nginx/PHP-FPM Service Layer

**Modify `nginx.service.ts`:**
- Config generation uses `websiteId` instead of `domainId`
- Multi-domain support: one website can have multiple server blocks (one per attached domain)
- Each server block references the website's documentRoot and PHP-FPM socket

**Modify `php-fpm.service.ts`:**
- Pool configs use `websiteId` instead of domain name
- Socket path: `/run/php/php{version}-fpm-{websiteId}.sock`

### Phase 9: Update File Manager Context

**Modify `files.service.ts` + `files.routes.ts`:**
- File operations accept `websiteId` instead of `domainId`
- `resolveHomeDir()` uses `website.documentRoot` instead of deriving from domain name
- File manager scoped to website's document root

### Phase 10: Data Migration Script + Testing

**Create migration script:**
- For each existing domain: create a website record with the domain's current website fields
- Link the domain to its new website via `websiteId`
- Move `subdomains` table data into `domains` table with `type='subdomain'` and `parentDomainId`
- Update all FK references from `domainId` to `websiteId` in FTP, cron, backups, databases, installed_apps

**Testing:**
- Verify all existing domains still work after migration
- Verify website creation/detachment works
- Verify domain-only (no website) creation works
- Verify multi-domain-to-one-website attachment works

---

## Impact Summary

### New Files (8)
- `apps/api/src/db/schema/websites.ts`
- `apps/api/src/modules/websites/websites.service.ts`
- `apps/api/src/modules/websites/websites.routes.ts`
- `apps/api/src/modules/websites/websites.schema.ts`
- `apps/api/src/db/migrations/0004_websites_separation.sql`
- `apps/web/src/pages/websites/WebsitesPage.tsx`
- `apps/web/src/api/hooks/websites.ts`
- Migration script

### Modified Files (25+)
- `apps/api/src/db/schema/domains.ts` — Add type, websiteId, redirectTarget, parentDomainId; remove website fields
- `apps/api/src/db/schema/ftp.ts` — Change FK to websiteId
- `apps/api/src/db/schema/cron.ts` — Change FK to websiteId
- `apps/api/src/db/schema/backups.ts` — Change FK to websiteId
- `apps/api/src/db/schema/databases.ts` — Change FK to websiteId
- `apps/api/src/db/schema/installed-apps.ts` — Change FK to websiteId
- `apps/api/src/db/schema/index.ts` — Export new schema
- `apps/api/src/modules/domains/domains.service.ts` — Restructure create/update/delete
- `apps/api/src/modules/domains/domains.routes.ts` — Update endpoints
- `apps/api/src/modules/ftp/ftp.service.ts` — Use websiteId
- `apps/api/src/modules/cron/cron.service.ts` — Use websiteId
- `apps/api/src/modules/backup/backup.service.ts` — Use websiteId
- `apps/api/src/modules/databases/databases.service.ts` — Use websiteId
- `apps/api/src/modules/installer/installer.service.ts` — Use websiteId
- `apps/api/src/modules/files/files.service.ts` — Use websiteId
- `apps/api/src/modules/files/files.routes.ts` — Use websiteId
- `apps/api/src/services/nginx.service.ts` — Multi-domain vhost generation
- `apps/api/src/services/php-fpm.service.ts` — Per-website pools
- `apps/web/src/router.tsx` — Add websites routes
- `apps/web/src/components/layout/Sidebar.tsx` — Add Websites nav item
- `apps/web/src/pages/domains/DomainsPage.tsx` — Restructure tabs
- `apps/web/src/api/hooks/domains.ts` — Update types
- Plus all route files that pass domainId to website-owned services

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Data loss during migration | Migration runs in transaction; backup first |
| Breaking existing API contracts | Keep old domainId params as aliases during transition |
| nginx config breakage | Test nginx -t before reload; keep old configs as backup |
| PHP-FPM pool naming change | Gradual migration: old pools kept until new ones verified |
| Frontend URL changes | Add redirects from old standalone pages to new contextual tabs |

### Recommended Execution Order

1. **Phase 1** (DB schema) — Foundation for everything else
2. **Phase 2** (Websites service) — Backend CRUD
3. **Phase 8** (nginx/PHP-FPM) — Service layer must be ready before frontend
4. **Phase 3** (FK migration) — Move references from domainId to websiteId
5. **Phase 4** (Domain creation flow) — Update create to support new model
6. **Phase 6** (Websites frontend) — New UI pages
7. **Phase 5** (Domain detail update) — Remove website tabs from domain
8. **Phase 7** (Sidebar + Router) — Navigation update
9. **Phase 9** (File manager) — Context scoping
10. **Phase 10** (Migration script + testing) — Final verification
