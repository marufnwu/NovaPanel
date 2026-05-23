# NovaPanel UX Re-Architecture: Sites, Domains, Files, SSL, DNS (Frontend-Only)

## Executive Summary

**Constraint: NO backend changes.** We use existing APIs, existing data structures, existing hooks. Only the frontend UI is reorganized.

Current problem: Sites, domains, file manager, SSL, and DNS are **five separate pages/modules** with no visual connection. A user creating a website must:
1. Go to `/sites` → Create Site
2. Go to `/domains` → Add Domain
3. Go to `/sites/:id` → somehow know to attach the domain
4. Go to `/ssl` → Issue SSL cert
5. Go to `/files` → Browse server, find site folder, upload files

This is 5 pages, multiple context switches, and no single place to see "my website is live."

**Goal:** Reorganize the frontend around a **Site Dashboard** concept. All site-related management (domains, SSL, files, DNS, logs, deployments) lives in one place. Use existing API hooks, just compose them differently in the UI.

---

## Current State (What We Have)

### Existing Data Model (read-only for this plan)
- `sites` — has `id`, `name`, `slug`, `runtime`, `status`, `projectId`
- `domains` — has `id`, `name`, `type` (apex/subdomain/wildcard), `siteId` (nullable), `sslStatus`, `sslCertId`
- `sslCertificates` — has `id`, `domainId`, `type`, `status`, `expiresAt`
- `dnsRecords` — has `id`, `zoneId`, `name`, `type`, `value`, `ttl`
- `deployments` — has `id`, `siteId`, `status`, `commitSha`, `createdAt`
- Files API accepts `websiteId` or `domainId` query param to scope to a context

### Existing Hooks (we will reuse these)
- `useSites()`, `useSite(id)`, `useCreateSite()`, `useDeleteSite()`
- `useDomains()`, `useDomain(id)`, `useCreateDomain()`, `useDeleteDomain()`
- `useSslCertificates()`, `useIssueLetsEncrypt()`, `useUploadCustomCert()`
- `useDirectoryListing(websiteId?)`, `useFileContent()`, `useSaveFileContent()`
- `useSiteDeployments()`, `useSiteLogs()`
- `useAttachDomainToSite()`, `useDetachDomainFromSite()`

---

## Current UI Problems

### 1. Site Detail Page (`/sites/:id`) is a dead end
- Tabs: Runtime / Deployments / Settings
- **No domains shown** — user must leave this page and go to `/domains` to see what URLs serve this site
- **No SSL shown** — must go to `/ssl`
- **No files shown** — must go to `/files` and manually navigate
- **No logs shown** — must go to `/logs`
- This page is essentially runtime config + deployment history only. It's not a "site dashboard."

### 2. Domains List (`/domains`) is a flat table
- Columns: Name, Type, Site, SSL Status, Actions
- `blog.example.com` and `example.com` are sibling rows
- No visual indication that `www.example.com` belongs to `example.com`
- SSL status is a text badge, not actionable inline
- Clicking a domain goes to... nothing (no domain detail page). You manage SSL from `/ssl`, DNS from `/dns`, site from `/sites`.

### 3. SSL Page (`/ssl`) is a global cert list
- Table of all SSL certificates across all domains
- User must remember which domain needs a cert
- No connection to the site that domain serves
- 1297 lines of complex UI for what should be a simple inline card

### 4. File Manager (`/files`) defaults to server root
- Opens at `/var/www/vhosts` — the user sees the whole server
- To find site files, they must know the folder structure
- 1781-line monolithic component
- No "My Site Files" shortcut from the site page

### 5. DNS Page (`/dns`) is a separate module
- No indication of which site a DNS record serves
- No quick-add templates for common patterns
- No propagation status per record

### 6. No "Create Website" Wizard
- To go live, user must mentally track: site → domain → attach → SSL → files
- Modern panels (Vercel, Railway, Netlify) have a single "Create Project" flow that handles everything

---

## Proposed UI Changes (Frontend Only)

### 1. New Site Dashboard (`/sites/:id`) — The Central Hub

This replaces the current `SiteDetailPage`. It uses existing hooks composed together.

**Hero Section** (using `useSite()` + `useDomains()`):
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Live]    My Blog                                         [Stop] [Restart]
│ https://example.com                              [Copy URL] [Open Site]
│ PHP 8.2  •  2 domains attached  •  Last deploy: 2h ago                │
└─────────────────────────────────────────────────────────────────────────┘
```
- Show `primaryDomain` (first domain with `siteId` matching this site, or first in list)
- Status badge from `site.status`
- Runtime badge from `site.runtime`
- Action buttons: Stop, Restart, Deploy (use existing mutations)

**Tabs** (reorganize existing content + add new tabs):

| Tab | Content | Source |
|-----|---------|--------|
| **Overview** | Runtime info, health check, env vars preview, attached domains preview, recent deployments preview | `useSite()`, `useSiteDeployments()`, `useDomains()` filtered by `siteId` |
| **Deployments** | Full deployment history with logs | `useSiteDeployments()` (existing) |
| **Files** | Site-scoped file manager | `useDirectoryListing(websiteId)` — pass `websiteId` to scope root |
| **Domains & SSL** | Attached domains list + inline SSL management | `useDomains()` filtered by `siteId`, `useSslCertificates()`, `useIssueLetsEncrypt()` |
| **Environment** | Env vars table | `useSiteEnvVars()` (existing) |
| **Logs** | Nginx access + error logs, app logs | `useSiteLogs()` (existing) |
| **Settings** | Runtime config, health check path, auto-restart | `useSite()` (existing) |

**Key insight:** The Files tab passes `websiteId={site.id}` to the file manager, so it opens scoped to the site's document root. No backend changes needed — the existing `FilesService.resolveHomeDir(websiteId)` already handles this.

### 2. New Sites List (`/sites`) — Card Grid

Replace the current table with a card grid. Each card shows the site's "live status."

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ ● Active             │  │ ○ Building           │  │ ○ Suspended          │
│ My Blog              │  │ API Server           │  │ Old Project          │
│ example.com          │  │ api.example.com      │  │ —                    │
│ PHP 8.2              │  │ Node.js 20           │  │ PHP 8.1              │
│ Last deploy: 2h ago  │  │ Deploying...        │  │ —                    │
│ [Manage] [Deploy]    │  │ [View Logs]          │  │ [Activate] [Delete]  │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

Each card uses:
- `useSite(site.id)` → name, runtime, status
- `useDomains()` → filter to `siteId === site.id`, take first for URL display
- `useSiteDeployments()` → last deployment status
- Click → `/sites/:id` (new Site Dashboard)

### 3. Domain Tree View (`/domains`) — Hierarchical

Replace the flat table with a tree view. Use existing data, just group it differently.

```
Domains
├─ example.com [Apex] [SSL: Active] [→ My Blog]
│  ├─ www.example.com [Sub] [SSL: Active]
│  ├─ blog.example.com [Sub] [SSL: Active]
│  └─ api.example.com [Sub] [SSL: Error - Retry]
├─ another-site.com [Apex] [SSL: Pending] [→ Another]
│  └─ www.another-site.com [Sub] [SSL: Pending]
└─ parked-domain.com [Apex] [SSL: None] [→ Not attached]
```

**Implementation:** Use `useDomains()` to get all domains. Group by:
- Find all `type='apex'` → these are tree roots
- For each apex, find domains where `name.endsWith(apexName)` → these are children
- Render as collapsible tree

**Actions per domain:**
- Click apex → expand/collapse children
- Click "→ My Blog" → navigate to `/sites/{siteId}` (Site Dashboard)
- SSL status badge → click opens inline SSL actions (issue, renew, view)
- Use `useSslCertificates()` to get cert status per domain

### 4. Inline SSL Management (inside Site Dashboard)

Inside the "Domains & SSL" tab of Site Dashboard:

```
Attached Domains
┌────────────────────────────────────────────────────────────────────┐
│ example.com (Primary)                               [SSL: Active] │
│ ├─ Issuer: Let's Encrypt                              [Renew]    │
│ ├─ Expires: Dec 1, 2025                             [Download]   │
│ └─ Auto-renew: ON                                    [Details]   │
├──────────────────────────────────────────────────────────────────┤
│ www.example.com                                      [SSL: Active]│
│ Inherits wildcard from example.com                               │
├──────────────────────────────────────────────────────────────────┤
│ blog.example.com                                    [SSL: Error] │
│ Failed to issue. [Retry] [View Error]                            │
└────────────────────────────────────────────────────────────────────┘

[Attach New Domain]  [Issue Wildcard SSL for All]
```

**Implementation:**
- List domains where `domain.siteId === site.id`
- For each domain, find matching SSL cert via `useSslCertificates()` (filter by `domainId`)
- Show cert details inline (issuer, expiry, status)
- Action buttons trigger existing mutations: `useIssueLetsEncrypt(domainId)`, `useRenewCertificate(domainId)`, etc.
- No new backend needed — existing SSL hooks work as-is

### 5. Site-Scoped File Manager (inside Site Dashboard)

Inside the "Files" tab of Site Dashboard:
- Pass `websiteId={site.id}` to the file manager component
- The existing file manager already accepts `websiteId` and resolves to `/var/www/sites/{siteId}`
- No backend changes — just frontend composition

**Visual improvements:**
- Breadcrumb shows relative path from site root (not server root)
- "Browse Server" toggle for advanced users (falls back to `/var/www/vhosts`)
- Quick actions: Upload, New Folder, New File (existing functionality)

### 6. Simplified Creation Flows

**New "Create Site" Wizard** (replaces the 3-step modal):
```
Step 1: Choose Your Setup
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Start from  │  │  Import from │  │  Use Template│
│  Scratch     │  │  Git         │  │  WordPress   │
└──────────────┘  └──────────────┘  └──────────────┘

Step 2: Configure
┌─────────────────────────────────────────────┐
│ Site Name: [my-blog                       ] │
│ Runtime:  [PHP ▼]  Version: [8.2 ▼]       │
│                                             │
│ Domain:   [example.com                     ] │
│           [✓] Auto-issue SSL                │
│           [✓] Create www subdomain          │
│                                             │
│ [Create Site and Go Live]                   │
└─────────────────────────────────────────────┘
```

**Behind the scenes (existing hooks):**
1. `useCreateSite()` → creates site
2. `useCreateDomain({ name: 'example.com', siteId: site.id })` → creates and attaches domain
3. `useIssueLetsEncrypt(domainId)` → issues SSL
4. Navigate to `/sites/{site.id}` → new Site Dashboard

**New "Add Domain" Flow** (from Site Dashboard):
```
Add Domain to "My Blog"
┌─────────────────────────────────────────────┐
│ Domain Name: [blog.example.com             ] │
│ Type: [Subdomain ○]  (inherits example.com) │
│                                             │
│ [✓] Auto-issue SSL                          │
│ [✓] Create DNS A record                     │
│                                             │
│ [Add Domain]                                │
└─────────────────────────────────────────────┘
```

### 7. DNS Inline (inside Site Dashboard → Domains & SSL tab)

For each domain in the Domains & SSL tab, add a "DNS Records" sub-section:
```
example.com DNS Records
Type    Name        Value                    TTL     Status     Actions
A       @           192.0.2.1               3600    ✓ Global   [Edit] [Delete]
CNAME   www         example.com             3600    ✓ Global   [Edit] [Delete]
MX      @           mail.example.com        3600    ⏳ Pending  [Edit] [Delete]

[Quick Add: Point to Server] [Quick Add: WWW] [Quick Add: Mail]
```

**Implementation:** Use existing `useDomainDns(domainId)` hook. Just render inline instead of on a separate page. The "Quick Add" buttons pre-fill values using `useServerContext()` to get the server IP.

### 8. Remove or Deprecate Standalone Pages

| Current Page | New Location | Action |
|--------------|--------------|--------|
| `/ssl` | Site Dashboard → Domains & SSL tab | Remove from sidebar, keep route as redirect to `/sites` |
| `/dns` | Site Dashboard → Domains & SSL tab → DNS sub-section | Remove from sidebar, keep route as redirect |
| `/files` | Site Dashboard → Files tab | Keep in sidebar as "File Manager" but default to server root |
| `/sites/:id` (old) | `/sites/:id` (new Site Dashboard) | Replace component |
| `/domains` | Keep, but render as tree view | Update component |

---

## Implementation Plan (Frontend Only)

### Phase 1: Site Dashboard Shell (3 days)
1. Create `SiteDashboardPage.tsx` with hero section + tab navigation
2. Hero section: `useSite(id)` + `useDomains()` filtered by siteId
3. Tab bar: Overview / Deployments / Files / Domains & SSL / Environment / Logs / Settings
4. Deployments tab: copy existing deployment content from old SiteDetailPage
5. Settings tab: copy existing settings content from old SiteDetailPage
6. Environment tab: copy existing env vars content
7. Update router: `/sites/:id` → new SiteDashboardPage

### Phase 2: Overview & Files Tabs (2 days)
1. Overview tab: compose runtime info + env preview + domain cards + deployment preview
2. Files tab: embed file manager with `websiteId={site.id}`
3. Ensure file manager handles `websiteId` prop correctly (it already does)

### Phase 3: Domains & SSL Tab (3 days)
1. Domain list: `useDomains()` filtered by `siteId`
2. SSL inline cards: `useSslCertificates()` filtered by domain IDs
3. Action buttons: issue, renew, download, toggle auto-renew (existing mutations)
4. DNS sub-section: `useDomainDns(domainId)` rendered inline per domain
5. "Attach Domain" button → opens modal using `useCreateDomain()` + `useAttachDomainToSite()`

### Phase 4: New Sites List (2 days)
1. Rewrite `SitesPage.tsx` as card grid
2. Each card: site name + primary domain URL + status + runtime + last deploy
3. Uses `useSites()` + `useDomains()` (filtered in component)

### Phase 5: Domain Tree View (2 days)
1. Rewrite `DomainsPage.tsx` as hierarchical tree
2. Group domains: apex as roots, subdomains as children (computed from `name.endsWith()`)
3. SSL status inline per domain
4. Click domain → navigate to `/sites/{domain.siteId}` (if attached)

### Phase 6: Simplified Creation Flows (2 days)
1. Update "Create Site" modal: inline domain + SSL options
2. Chain mutations: createSite → createDomain → issueSSL (all existing hooks)
3. Add "Add Domain" inline form to Site Dashboard
4. Add "Add Subdomain" inline form (creates domain + attaches + issues SSL)

### Phase 7: Navigation Cleanup (1 day)
1. Remove SSL and DNS from sidebar (or move under Sites)
2. Keep File Manager in sidebar but default to server root
3. Add breadcrumb: Sites → My Blog → Domains & SSL
4. Test all navigation flows

---

## File Changes

### New Files
- `apps/web/src/pages/sites/SiteDashboardPage.tsx` — replaces old SiteDetailPage
- `apps/web/src/pages/sites/components/SiteHero.tsx`
- `apps/web/src/pages/sites/components/DomainList.tsx`
- `apps/web/src/pages/sites/components/SslInlineCard.tsx`
- `apps/web/src/pages/sites/components/DnsInlineRecords.tsx`
- `apps/web/src/pages/sites/components/OverviewTab.tsx`
- `apps/web/src/pages/sites/components/FilesTab.tsx`
- `apps/web/src/pages/sites/components/LogsTab.tsx`

### Modified Files
- `apps/web/src/pages/sites/SitesPage.tsx` — rewrite as card grid
- `apps/web/src/pages/sites/SiteDetailPage.tsx` — redirect to new dashboard or remove
- `apps/web/src/pages/domains/DomainsPage.tsx` — rewrite as tree view
- `apps/web/src/pages/ssl/SslPage.tsx` — keep but remove from sidebar nav
- `apps/web/src/pages/dns/DnsPage.tsx` — keep but remove from sidebar nav
- `apps/web/src/router.tsx` — update `/sites/:id` route
- `apps/web/src/components/layout/Sidebar.tsx` — reorder/remove nav items

### No Changes
- `apps/api/**/*` — backend untouched
- `apps/web/src/api/hooks/**/*` — hooks reused as-is
- `packages/schemas/**/*` — schemas untouched

---

## Acceptance Criteria

- [ ] `/sites/:id` shows a unified Site Dashboard with hero + 7 tabs
- [ ] Site Dashboard shows primary domain URL in hero section
- [ ] Files tab opens scoped to site's document root
- [ ] Domains & SSL tab shows attached domains with inline SSL status
- [ ] DNS records editable inline within Domains & SSL tab
- [ ] `/sites` shows card grid, not table
- [ ] `/domains` shows hierarchical tree, not flat table
- [ ] Creating a site allows adding a domain inline
- [ ] SSL management happens inline, not on standalone `/ssl` page
- [ ] Sidebar navigation simplified (SSL/DNS moved under Sites or removed)
- [ ] All existing data and API hooks work without modification
- [ ] `pnpm --filter web build` passes
