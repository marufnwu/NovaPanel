# Domain & Website Management Audit Report

**Date:** 2026-05-08
**System:** NovaPanel
**Status:** Audit Complete — Improvement Plan Draft

---

## Executive Summary

The domain and website management system has evolved significantly through the domain/website separation architecture. The current system supports:
- Domain-only mode (DNS/Mail without web)
- Auto-create website with domain
- Attach domain to existing website
- Cloudflare Tunnel integration with auto-route creation

**Overall Assessment: 70% Complete** — Core architecture is solid, but UX gaps and missing polish features reduce user-friendliness compared to panels like Plesk/cPanel.

---

## 1. Domain Creation Flow

### Current Flow
```
User enters domain name
  → DNS verification check (A record must point to server IP)
  → Website mode selection (create new / link existing / DNS only)
  → PHP version, handler, web server selection
  → DNS zone creation toggle
  → Mail domain toggle
  → Cloudflare "Make Public" option (if tunnel configured)
  → Submit → Domain + optional website created
```

### Backend Validation ✅
- Domain name uniqueness check (409 on duplicate)
- Parent domain existence check for subdomains
- PHP version socket verification before vhost creation
- Nginx config test + rollback on failure
- Website creation rollback on nginx failure

### Frontend UX Issues ⚠️

| Issue | Description | Severity |
|-------|-------------|----------|
| **Confusing "website mode" terminology** | User sees "Create new website", "Link to existing", "No website (DNS only)" — unclear what each means without reading description | Medium |
| **No visual feedback during creation** | Button shows "Creating..." but no progress indication | Low |
| **Document root shown but not explained** | Path `/var/www/vhosts/example.com/httpdocs` shown — user may not understand what this means | Low |
| **DNS verification manual** | User must click verify button or tab out — not automatic on form submission | Low |
| **Skip DNS verification unclear** | Orange warning checkbox appears only AFTER failed verification — user might not know what to do | Medium |
| **Success state weak** | After creation, shows "Domain created" with link to domain page — no quick stats or next steps | Medium |
| **No domain pre-check** | User enters domain, clicks create, then gets "DNS not pointing" error — wastes time | High |

### Missing Features
- **Domain pre-validation**: Check DNS before form submission with suggestions
- **Creation progress steps**: Show "Creating website files..." → "Configuring web server..." → "Setting up DNS..."
- **Quick actions after creation**: "Open Website", "Upload Files", "Configure SSL"

---

## 2. Website Management

### Current Architecture ✅

The domain/website separation is well-implemented:
- **Website** = container for files, PHP-FPM pool, system user, document root
- **Domain** = hostname that can be attached to a website (or standalone for DNS/Mail)
- One website can have multiple domains (main + aliases + subdomains)
- Domain deletion handles website cascade properly

### Features Working
- Website creation with system user, directory structure, default index.html
- PHP-FPM pool per website with correct socket path
- Nginx config per website (not per domain) with multi-server blocks
- Attach/detach domains from website
- Website suspend/activate (503 maintenance page)

### Website Detail Page Issues ⚠️

| Issue | Description | Severity |
|-------|-------------|----------|
| **No quick stats on Overview** | Disk usage, bandwidth, PHP version shown but not summarized | Low |
| **Tabs don't feel cohesive** | Domains, Files, FTP, Cron, Databases, Backups, Apps — each is a separate section without clear relationship | Medium |
| **Files tab is basic file manager** | No upload progress, no archive handling, no permission editing | High |
| **No "Open Website" button** | User must copy URL manually | Low |
| **Backup tab missing features** | No remote storage options, no encryption, no scheduled backup UI | High |
| **Apps tab is placeholder** | No application installer implemented | High |

### Missing Website Features

| Feature | Plesk/cPanel | NovaPanel |
|---------|-------------|-----------|
| One-click SSL | ✅ | Partial (Let's Encrypt works, but no wildcard) |
| PHP-FPM pool settings | ✅ | ❌ (no memory_limit, max_children, etc.) |
| Custom nginx directives | ✅ | ❌ |
| Hotlink protection | ✅ | ❌ |
| IP access restrictions | ✅ | ❌ |
| Directory password protection | ✅ | ❌ |
| Custom error pages | ✅ | ❌ |
| Log rotation settings | ✅ | ❌ |
| Web application firewall | ✅ | ❌ |

---

## 3. UI/UX Audit

### DomainsPage.tsx (2378 lines — monolithic)

#### Strengths
- Domain list with status badges (Live/Local/Down/Redirect/Suspended)
- DNS verification with visual feedback
- Subdomain/alias/redirect management in separate sections
- Cloudflare tunnel integration in domain detail

#### Issues

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|
| **Massive single file** | DomainsPage.tsx:2378 | High | One file containing all domain UI — hard to navigate and maintain |
| **No search/filter on detail page** | DomainDetailPage | Medium | Can't search within subdomains, aliases, redirects |
| **Form state confusing** | CreateDomainForm:185-198 | Medium | 10+ form fields with conditional visibility — user may miss options |
| **No keyboard shortcuts** | Global | Low | Power users expect keyboard navigation |
| **Responsive table hard to read** | Domain list | Medium | Many columns on small screens |
| **No inline edit for domain name** | DomainDetailPage | Low | Must go to settings tab to rename |
| **Delete confirmation weak** | DeleteDomain | Low | Just says "This will delete domain" — doesn't list what data will be lost |

### WebsitesPage.tsx (448 lines)

#### Strengths
- Clean list view with status badges
- Action dropdown with Edit/Suspend/Activate/Delete
- Create modal with PHP version selector

#### Issues

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|
| **No website search** | WebsitesPage | Medium | Must scroll through all websites |
| **Can't sort table columns** | WebsitesPage | Low | No click-to-sort on headers |
| **No bulk actions** | WebsitesPage | Medium | Can't suspend/delete multiple websites |
| **PHP handler selector missing** | CreateWebsiteModal:52-56 | Low | Only PHP version and web server — no handler option (php-fpm/cgi/disabled) |
| **No document root preview on create** | CreateWebsiteModal | Low | User doesn't see where files will go until after creation |

---

## 4. API Layer Audit

### DomainsService Issues

| Issue | Line | Description |
|-------|------|-------------|
| **Best-effort error handling** | 361-371 | DNS zone creation failure logged but continues — user may not know DNS didn't work |
| **Best-effort mail enablement** | 366-371 | Same issue — mail silently fails if Postfix/Dovecot not configured |
| **No validation on redirectTarget** | 243-247 | URL not validated before storing |
| **Website mode 'none' creates no nginx config** | 314 | But documentRoot still set to default path — inconsistent |
| **Subdomain creation doesn't update nginx** | 700-776 | Creates DNS A record + directory + DB record, but nginx config only regenerated if parent has websiteId |

### WebsitesService Issues

| Issue | Line | Description |
|-------|------|-------------|
| **Website create doesn't link to domain** | 96-209 | Website created independently, then domain creation calls `websitesService.create()` and links |
| **No website limits** | create() | Can't enforce max websites per server |
| **Disk usage warning only logs** | 29-41 | Warning printed to console but no user notification |

---

## 5. Nginx Service Audit

### generateWebsiteConfig() ✅
- Correctly generates one server block per attached domain
- Includes www alias + domain aliases in server_name
- Atomic write with backup before overwrite
- nginx -t test before reload
- Rollback on test failure

### Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **No SSL cert path in config** | High | `renderVhost()` accepts `ctx.ssl` but `generateWebsiteConfig()` never passes SSL data — HTTPS configs are empty |
| **No HTTP/2 or HTTP/3 settings** | Medium | Hardcoded `listen 443 ssl http2` — no HTTP/3 option |
| **No gzip settings** | Medium | Static compression not enabled |
| **No cache headers** | Medium | No browser caching configuration |
| **Hardcoded PHP socket path** | Low | `/run/php/php${version}-fpm.sock` — assumes Debian/Ubuntu path |
| **No proxy timeout settings** | Low | Default nginx timeouts may be too short for large uploads |

---

## 6. Feature Gap Analysis (vs Plesk/cPanel)

### Critical Missing (High Priority)

| Feature | Impact | Description |
|---------|--------|-------------|
| **File Manager** | High | Complete file browser with upload/download/edit permissions missing |
| **Application Installer** | High | One-click WordPress, etc. not implemented |
| **PHP-FPM Pool Settings** | High | Can't configure memory_limit, max_children, etc. per website |
| **Custom Nginx Directives** | High | Can't add custom nginx config per domain |
| **Wildcard SSL via Cloudflare** | Medium | Only HTTP-01 Let's Encrypt, no DNS-01 for wildcards |

### Important Missing (Medium Priority)

| Feature | Impact | Description |
|---------|--------|-------------|
| **Log rotation settings** | Medium | Can't configure per-domain log rotation |
| **Backup to remote storage** | Medium | Only local storage, no S3/R2 support |
| **Custom error pages** | Medium | No custom 404/500 pages per domain |
| **IP access restrictions** | Medium | Can't block IP ranges per domain |
| **Hotlink protection** | Medium | No referrer-based protection |
| **Directory password protection** | Low | No basic auth for subdirectories |

### Nice to Have (Low Priority)

| Feature | Impact | Description |
|---------|--------|-------------|
| **Website cloning** | Low | Duplicate website with all settings |
| **Domain transfer** | Low | Move domain between websites |
| **Staging environment** | Low | Clone website to staging subdomain |
| **Git deployment** | Low | Auto-deploy from Git repository |

---

## 7. Improvement Plan

### Phase 1: UX Polish (Quick Wins)
**Estimated: 1-2 days**

1. **Improve domain creation form**
   - Add domain pre-check before submission
   - Show creation progress steps
   - Add "Open Website" quick action after creation

2. **Improve domain list**
   - Add search/filter
   - Add bulk suspend/activate/delete
   - Improve responsive display

3. **Improve website list**
   - Add search
   - Add column sorting
   - Show disk usage in list

4. **Add keyboard shortcuts**
   - `n` for new domain
   - `f` for search/filter
   - `?` for help

### Phase 2: Missing Core Features
**Estimated: 1 week**

1. **File Manager completion**
   - Upload with progress bar
   - Archive extraction
   - Permission editor
   - Hidden files toggle

2. **PHP-FPM pool settings UI**
   - Memory limit
   - Max children
   - Max execution time
   - Upload max filesize

3. **Nginx custom directives**
   - Per-domain custom config
   - Syntax validation before save

4. **Custom error pages**
   - 404, 500 page editor
   - Per-domain templates

### Phase 3: Advanced Features
**Estimated: 2-3 weeks**

1. **Backup enhancements**
   - Remote storage (S3/R2/SFTP)
   - Backup encryption
   - Scheduled backups UI improvement

2. **Application Installer**
   - WordPress one-click install
   - Database auto-creation
   - WP-CLI integration

3. **Wildcard SSL via Cloudflare DNS-01**
   - API-based domain validation
   - Automatic certificate renewal

### Phase 4: Feature Parity
**Estimated: 1-2 weeks**

1. **Security features**
   - IP access restrictions
   - Hotlink protection
   - Directory password protection

2. **Log management**
   - Log rotation settings
   - Log download
   - Real-time log tail

---

## 8. Architectural Recommendations

### Split DomainsPage.tsx
The 2378-line file should be split into:
- `DomainListPage.tsx` — list view
- `DomainDetailPage.tsx` — detail view with tabs
- `CreateDomainModal.tsx` — creation form
- `components/` — reusable components

### Add Website Settings Service
Create `websiteSettings.service.ts` for:
- PHP-FPM pool configuration
- Nginx custom directives
- Per-site nginx templates

### Add Domain Health Checks
Background job to check:
- DNS resolution
- SSL certificate validity
- Website response time
- Disk usage warning threshold

---

## 9. Summary

### What's Working ✅
- Domain/website separation architecture
- Cloudflare Tunnel integration with auto-route
- Nginx config per website with multi-domain support
- DNS zone creation and management
- Suspend/activate with backup config
- Rollback on nginx config failure

### What Needs Work ⚠️
- Domain creation UX (confusing options, no progress feedback)
- Website detail page (tabs feel disconnected)
- File manager (missing upload, permissions, archives)
- PHP-FPM pool settings (no UI for advanced config)
- Nginx custom directives (not implemented)
- Backup remote storage (not implemented)
- Application installer (not implemented)

### Priority Actions
1. **Split DomainsPage.tsx** — maintainability issue
2. **Add domain pre-check** — prevents user frustration
3. **Complete file manager** — critical missing feature
4. **Add PHP-FPM pool settings UI** — common hosting need
5. **Implement custom nginx directives** — power user feature

---

*Audit completed 2026-05-08. Recommendations are based on code review of current implementation and comparison with Plesk/cPanel feature sets.*