# NovaPanel Modernization Plan — Rich & User-Friendly Server Management Panel

> **Goal**: Transform NovaPanel into a modern, highly flexible, and user-friendly server management panel with premium UI/UX, advanced backend capabilities, and professional developer experience.
> **Scope**: Both backend API and frontend UI. All changes must maintain backward compatibility where possible.

---

## Phase 0: Foundation & Design System (Weeks 1-2)

### 0.1 Adopt shadcn/ui Component Architecture
**Why**: Currently, UI components are hand-rolled per page (Card, CardHeader, CardTitle duplicated in SiteDetailPage, modal forms use raw HTML inputs). This creates inconsistency and maintenance burden.

**Actions**:
- Initialize `shadcn/ui` in `apps/web` (compatible with existing Tailwind + Radix setup)
- Install base components: `Button`, `Input`, `Select`, `Dialog`, `DropdownMenu`, `Table`, `Tabs`, `Card`, `Badge`, `Skeleton`, `Tooltip`, `Popover`, `Command`, `Calendar`, `DataTable`, `Form`, `Label`, `Switch`, `Checkbox`, `Textarea`, `Separator`, `ScrollArea`, `Accordion`, `Sheet`, `Toast`, `Sonner`
- Replace all raw HTML form inputs across pages with shadcn `Input`, `Select`, `Textarea`
- Replace custom modal implementations with shadcn `Dialog` + `Sheet` (for mobile drawers)
- Replace custom `ConfirmDialog` with shadcn `AlertDialog`
- Create consistent `Badge` variants for all entity statuses (site, domain, service, job)
- Add `Skeleton` loading screens for all data-fetching pages (currently only basic spinners exist)

**Pages to refactor first**:
- `SitesPage` → Replace table + modal with shadcn `DataTable` + `Dialog`
- `DomainsPage` → Replace listing with sortable/filterable `DataTable`
- `DatabasesPage` → Replace modals with `Dialog` + `Form`
- `DashboardPage` → Keep layout, upgrade cards to shadcn `Card`

### 0.2 Form System Overhaul
**Why**: All forms use manual `useState` + basic validation. No field-level error display, no dirty tracking, no auto-save.

**Actions**:
- Integrate `react-hook-form` + `@hookform/resolvers` + `zod` properly across ALL forms
- Create reusable `FormField` wrapper that combines shadcn `Form`, `Label`, `Input`, and error display
- Add form-level validation with inline error messages (currently errors appear as generic text below forms)
- Add loading states to all submit buttons (currently some have `disabled` but no spinner)
- Add dirty-state confirmation when closing modals with unsaved changes
- Create `AutoSaveForm` component for long forms (e.g., server settings, DNS records)

**Forms to upgrade**:
- Create Site (3-step wizard) → Convert to proper wizard with `FormProvider`
- Create Website → Add Zod schema validation
- Create Database + User → Unified form with nested field arrays
- Domain creation → Add DNS verification feedback inline
- SSL certificate request → Stepper with progress
- Settings forms → Auto-save on blur

### 0.3 Theme & Accessibility
**Why**: Dark mode exists but is basic. No system preference detection. Accessibility is minimal.

**Actions**:
- Enhance `ThemeToggle` to support `system` preference (light/dark/system)
- Add `prefers-color-scheme` media query listener
- Ensure all interactive elements have proper `aria-label`, `role`, keyboard navigation
- Add focus-visible rings to all buttons/links (currently inconsistent)
- Ensure color contrast ratios meet WCAG 2.1 AA
- Add `reduced-motion` media query support for animations

---

## Phase 1: Data Presentation & Interaction (Weeks 3-4)

### 1.1 Advanced Data Tables (TanStack Table)
**Why**: Every list view uses basic `<table>` with no sorting, filtering, pagination, or column management. Dashboard summary cards link to pages that are hard to navigate with many items.

**Actions**:
- Integrate `@tanstack/react-table` across all list pages
- Add features to every table:
  - **Column sorting** (click headers)
  - **Column filtering** (text, select, date range filters)
  - **Global search** (search across all columns)
  - **Pagination** (page size selector, page numbers)
  - **Column visibility toggle** (show/hide columns)
  - **Row selection** (checkboxes for bulk actions)
  - **Row expansion** (inline detail panels instead of separate pages)
  - **Density toggle** (compact/comfortable)
  - **Export to CSV/JSON**
- Create reusable `DataTable` component in `components/ui/data-table/`
- Create `DataTableToolbar` with search, filters, and action buttons
- Create `DataTablePagination` component

**Tables to upgrade**:
| Page | Current State | Target Features |
|------|--------------|-----------------|
| Sites | Basic table, no sort/filter | Full TanStack Table + row actions |
| Websites | Basic table | Full TanStack Table + bulk suspend/delete |
| Domains | Basic listing | Full table + type filter + status filter + SSL filter |
| Databases | Basic table | Full table + engine filter + size column |
| FTP Accounts | Basic table | Full table + status filter |
| Cron Jobs | Basic table | Full table + schedule filter + last run sort |
| Audit Log | Basic list | Full table + date range + action type filter |
| Backups | Basic table | Full table + status + size + restore action |
| SSL Certs | Basic table | Full table + expiry sort + auto-renew toggle |
| Files | List view | Add sortable columns + filter by type + search |

### 1.2 List & Card View Toggle
**Why**: Some users prefer grid/card views over tables (e.g., for websites, apps).

**Actions**:
- Add view toggle (List / Grid / Compact) to all entity list pages
- Create `EntityCard` component for grid view with rich preview
- Website/Site cards show: favicon preview, domain count, SSL status, quick actions
- App cards show: app icon, version, status, quick actions
- Remember view preference in localStorage per page

### 1.3 Bulk Actions
**Why**: Managing many entities one-by-one is tedious. No bulk operations exist.

**Actions**:
- Add bulk action bar that appears when rows are selected
- Actions: Delete, Suspend, Activate, Export, Restart (for services)
- Show selection count + "Select all" / "Clear selection"
- Bulk actions require confirmation dialog with impact summary
- Backend: Add bulk endpoints (POST /api/v1/sites/bulk-delete, etc.) or handle batch in frontend

---

## Phase 2: Navigation, Search & Command Palette (Week 5)

### 2.1 Global Command Palette (Cmd+K)
**Why**: Server management panels have many features. Users need quick navigation without hunting through sidebar.

**Actions**:
- Install `cmdk` (or use shadcn `Command`)
- Create global `CommandPalette` triggered by `Ctrl+K` / `Cmd+K`
- Sections in palette:
  - **Navigation**: Jump to any page (Dashboard, Domains, Sites, etc.)
  - **Actions**: "Create Site", "Add Domain", "Create Database", "Open Terminal", "Restart Nginx"
  - **Entities**: Search and jump to specific sites, domains, databases by name
  - **Settings**: Toggle dark mode, open profile, open server settings
  - **Recent**: Recently visited pages
- Add keyboard shortcut hints in UI (e.g., "Press ⌘K to search")
- Add shortcut badges to action buttons where applicable

### 2.2 Global Search
**Why**: Command palette is for navigation/actions, but users also need to search across all data.

**Actions**:
- Add global search API endpoint: `GET /api/v1/search?q=...`
- Search across: sites, domains, databases, users, files (by name), logs
- Return typed results with icons and context
- Frontend: Add search bar to TopBar (collapsible, expands on click or `/` key)
- Search results show: entity type, name, status, and direct action links

### 2.3 Breadcrumbs & Navigation Enhancements
**Why**: Current breadcrumbs are basic path segments. No context menus or quick actions.

**Actions**:
- Enhance breadcrumbs with dropdown menus (e.g., Domains > [dropdown of recent domains])
- Add "Recent Items" section to sidebar (auto-populated from navigation history)
- Add keyboard shortcuts for main navigation (`g d` for Domains, `g s` for Sites, etc.)
- Add page-level action buttons in PageHeader consistently

---

## Phase 3: Real-time, Visualization & Monitoring (Weeks 6-7)

### 3.1 Real-time Dashboard Charts
**Why**: Dashboard has sparklines but no historical data visualization. Users need trends.

**Actions**:
- Replace CPU sparkline with `recharts` AreaChart with time-axis
- Add Memory usage history chart (stacked area: used, cached, free)
- Add Disk usage treemap or pie chart showing mount point breakdown
- Add Network I/O line chart (rx/tx over time)
- Add Service uptime chart (heatmap or timeline)
- Backend: Store historical stats in `stats` table with timestamps (already exists but may need aggregation)
- Add time range selector: 1h, 6h, 24h, 7d, 30d
- Auto-refresh with smooth transitions (no page flicker)

### 3.2 Live Log Viewer
**Why**: Logs page likely shows static tail output. No real-time streaming, search, or filtering.

**Actions**:
- Create `LogViewer` component with:
  - Real-time streaming via WebSocket or Server-Sent Events
  - Syntax highlighting for log levels (ERROR, WARN, INFO)
  - Search/filter by text, date range, log level
  - Pause/resume streaming
  - Export filtered results
  - Line numbers and timestamps
- Apply to: System logs, Domain access logs, Domain error logs, Nginx logs, Mail logs
- Backend: Add log streaming WebSocket endpoint or SSE endpoint

### 3.3 Process Monitor
**Why**: No process-level visibility exists. Users can't see what's consuming resources.

**Actions**:
- Create new `/processes` page or integrate into Monitoring
- Show: process tree, CPU/memory per process, site association
- Real-time updates (every 5s)
- Ability to kill/restart processes from UI
- Backend: Add `systeminformation` process list endpoint with site mapping

### 3.4 Resource Usage Alerts
**Why**: Dashboard shows warnings (disk > 80%) but no configurable alerting.

**Actions**:
- Add alert configuration in settings
- Alert types: CPU threshold, RAM threshold, Disk threshold, Service down, SSL expiry
- Alert delivery: In-app notification, email (if configured), webhook
- Alert history page with acknowledgment
- Backend: Add `alerts` table + scheduler checks

---

## Phase 4: File Manager & Editor Enhancements (Week 8)

### 4.1 Rich File Manager
**Why**: FilesPage exists with 1780 lines but lacks modern file manager features.

**Actions**:
- Add drag-and-drop upload support (native HTML5 + visual feedback)
- Add file tree sidebar (collapsible, searchable)
- Add split view (file tree + content preview side by side)
- Add breadcrumb navigation with dropdown history
- Add file search within directory (recursive)
- Add file permissions editor (chmod visual: owner/group/public checkboxes)
- Add file diff viewer (compare two files or versions)
- Add image thumbnail grid view
- Add video/audio preview player
- Add archive creation (zip/tar) with password option
- Add multi-select with bulk actions (delete, move, copy, chmod)

### 4.2 Code Editor Improvements
**Why**: CodeMirror editor exists but lacks IDE-like features.

**Actions**:
- Add file tabs (open multiple files simultaneously)
- Add auto-save with draft indicator
- Add find/replace with regex support
- Add minimap (CodeMirror extension)
- Add line numbers toggle
- Add word wrap toggle
- Add theme matching (dark/light sync with app)
- Add syntax highlighting for more languages (nginx conf, apache conf, ini, env)
- Add linting hints where applicable (JSON validation, nginx config syntax)

---

## Phase 5: Backend API Modernization (Weeks 9-10)

### 5.1 API Documentation & Contract
**Why**: Fastify swagger plugins are installed but not configured. No API docs for frontend developers or third-party integrations.

**Actions**:
- Configure `@fastify/swagger` + `@fastify/swagger-ui` in `server.ts`
- Add OpenAPI 3.1 schema generation from Zod schemas (use `zod-to-json-schema`)
- Auto-generate API docs at `/api/docs`
- Add request/response examples to all endpoints
- Add authentication docs (cookie + Bearer token)
- Ensure all route schemas export OpenAPI-compatible metadata

### 5.2 Request Tracing & Observability
**Why**: No request ID propagation. Hard to debug issues across frontend and backend.

**Actions**:
- Add `x-request-id` header generation and propagation
- Add structured logging middleware (log all requests with duration, status, user)
- Add performance metrics endpoint for monitoring API health
- Add rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- Add API versioning strategy document (currently v1 hardcoded)

### 5.3 Webhook & Event System
**Why**: No external integrations beyond Cloudflare. Users can't trigger external actions.

**Actions**:
- Add `webhooks` table (url, events, secret, active)
- Events: site.created, site.deleted, domain.added, ssl.renewed, backup.completed, alert.triggered
- Sign payloads with HMAC-SHA256
- Add webhook delivery log (attempts, responses, retries)
- Add webhook testing UI (send test event)

### 5.4 GraphQL API (Optional but Recommended)
**Why**: REST requires many endpoints for complex queries. Frontend sometimes over-fetches.

**Actions**:
- Add `/api/v1/graphql` endpoint using `mercurius` (Fastify GraphQL)
- Expose core entities: sites, domains, databases, services, stats
- Enable for: complex dashboard queries, site detail with nested domains + processes + stats
- Keep REST for mutations and file operations (GraphQL is bad for file uploads)

### 5.5 Background Job Visibility
**Why**: Job queue exists but UI visibility is limited to a badge count.

**Actions**:
- Add job progress tracking (percentage, current step)
- Add job log streaming (real-time output from job handlers)
- Add job retry controls (retry now, cancel, view error details)
- Add job history page with filtering by type, status, date
- Backend: Enhance `background_jobs` table with `progressMessage`, `logs` JSON array

---

## Phase 6: Advanced Features (Weeks 11-12)

### 6.1 Docker Container Management
**Why**: Docker module exists in routes but has 0 files. Modern panels need container management.

**Actions**:
- Create `docker` module: `docker.routes.ts`, `docker.schema.ts`, `docker.service.ts`
- Features: List containers, Start/Stop/Restart, View logs, Exec into container, Resource usage
- Frontend: New `/docker` page with container cards/table
- Show: image, ports, status, CPU/memory, volume mounts
- Integrate with existing sites (link containers to sites for deployment)

### 6.2 Git Deployment Pipeline
**Why**: No Git integration exists. Modern developers expect CI/CD-like deployment from Git.

**Actions**:
- Add `git` settings to sites (repository URL, branch, deploy key)
- Add deployment triggers: manual, webhook (GitHub/GitLab), scheduled
- Add deployment history (commit hash, author, status, duration)
- Add deployment rollback (one-click to previous deployment)
- Add build log viewer (real-time streaming)
- Frontend: Site detail gets "Deployments" tab with commit history and deploy button

### 6.3 Environment Variable Editor
**Why**: No centralized env var management. Users manually edit `.env` files.

**Actions**:
- Add `site_env_vars` table (already exists in schema!)
- Frontend: Site detail gets "Environment" tab with key-value editor
- Features: Add/edit/delete env vars, import from `.env`, export to `.env`
- Mask sensitive values (passwords, tokens) with reveal toggle
- Validate env var names (no spaces, valid format)
- Apply env vars to site processes (restart with new env)

### 6.4 Database Query Editor
**Why**: DatabasesPage has management but no query interface.

**Actions**:
- Add query editor to database detail page
- Features: SQL textarea with syntax highlighting, result table, query history, saved queries
- Export results to CSV/JSON
- Show query execution time and row count
- Read-only mode toggle for safety
- Backend: Add `POST /api/v1/db/:id/query` endpoint (already partially exists via `runQuery`)

---

## Phase 7: Performance & Mobile (Week 13)

### 7.1 Frontend Performance
**Why**: No code splitting, no virtualized lists, potential for large bundle size.

**Actions**:
- Add route-based code splitting with `React.lazy()` + `Suspense`
- Add virtualized lists for large tables (`@tanstack/react-virtual`)
- Add image optimization (lazy loading, proper sizing)
- Add service worker for offline asset caching
- Add optimistic updates for mutations (currently waiting for API response)
- Prefetch data on hover for navigation links

### 7.2 Mobile Experience
**Why**: Sidebar collapses but mobile experience likely needs work.

**Actions**:
- Add mobile bottom navigation bar (Dashboard, Sites, Domains, More)
- Convert sidebar to slide-out drawer on mobile
- Make tables horizontally scrollable with sticky first column
- Add touch-friendly action buttons (min 44px tap targets)
- Test all modals on small screens (currently some may overflow)
- Add pull-to-refresh on mobile for lists

### 7.3 PWA Support
**Why**: Panel admins may want app-like experience on mobile/desktop.

**Actions**:
- Add `manifest.json` with icons, theme color, display mode
- Add service worker with offline page caching
- Add "Add to Home Screen" prompt
- Ensure all icons work at various sizes

---

## Phase 8: Developer Experience & Testing (Week 14)

### 8.1 Testing Infrastructure
**Why**: Only one test file exists (`auth.service.test.ts`). No E2E, no component tests.

**Actions**:
- Add Playwright for E2E tests (critical flows: login, create site, add domain, create database)
- Add Vitest component tests for reusable UI components
- Add API integration tests for all modules
- Add CI/CD GitHub Actions workflow (lint, test, build)

### 8.2 Linting & Code Quality
**Why**: README mentions ESLint/Prettier but no configs exist.

**Actions**:
- Add ESLint config with TypeScript, React, and accessibility rules
- Add Prettier config (consistent with existing code style)
- Add pre-commit hooks (lint-staged + husky)
- Add TypeScript strict mode enforcement (already enabled, ensure no regressions)

### 8.3 Storybook
**Why**: No isolated component development environment.

**Actions**:
- Add Storybook for `apps/web`
- Create stories for: Button variants, Form components, DataTable, Modals, Cards, Badges
- Useful for testing dark mode, accessibility, and responsive behavior

---

## Implementation Priority Matrix

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **P0** | shadcn/ui integration + Form system | High | Medium |
| **P0** | TanStack Table on all list pages | High | Medium |
| **P0** | Command Palette (Cmd+K) | High | Low |
| **P1** | Real-time dashboard charts | High | Medium |
| **P1** | Live log viewer with search | High | Medium |
| **P1** | Bulk actions on tables | High | Low |
| **P1** | File manager drag-drop + bulk ops | High | Medium |
| **P2** | OpenAPI docs + Swagger UI | Medium | Low |
| **P2** | Webhook system | Medium | Medium |
| **P2** | Environment variable editor | Medium | Low |
| **P2** | Mobile navigation improvements | Medium | Medium |
| **P3** | GraphQL API | Medium | High |
| **P3** | Docker management | Medium | High |
| **P3** | Git deployment pipeline | High | High |
| **P3** | Database query editor | Medium | Medium |
| **P3** | PWA support | Low | Low |
| **P3** | Storybook | Low | Medium |
| **P3** | E2E tests | High | High |

---

## Key Technical Decisions

1. **shadcn/ui over custom components**: Faster development, consistent design, accessible by default, easy to customize with Tailwind.
2. **TanStack Table over custom tables**: Industry standard, virtual scrolling, sorting/filtering/pagination built-in.
3. **Keep TanStack Router**: File-based routing migration is not worth the effort for code-based router. Instead, add route guards and lazy loading.
4. **Keep REST primary, GraphQL optional**: REST is simpler for file operations and mutations. GraphQL only for complex read queries.
5. **SQLite stays**: For single-admin panel, SQLite is sufficient. Add connection pooling if needed.
6. **No framework switch**: Keep Fastify + React. Migration to Next.js or Nest.js is not justified.

---

## Files to Create/Modify (High-Level)

### New Frontend Components
```
apps/web/src/components/ui/
  ├── button.tsx              # shadcn Button
  ├── input.tsx               # shadcn Input
  ├── select.tsx              # shadcn Select
  ├── dialog.tsx              # shadcn Dialog
  ├── form.tsx                # shadcn Form (react-hook-form integration)
  ├── data-table.tsx          # Reusable TanStack Table wrapper
  ├── data-table-toolbar.tsx  # Search + filters + bulk actions
  ├── data-table-pagination.tsx
  ├── command.tsx             # Command palette base
  ├── command-palette.tsx     # Global Cmd+K palette
  ├── badge.tsx               # shadcn Badge (status variants)
  ├── skeleton.tsx            # Loading skeletons
  ├── chart.tsx               # Recharts wrapper
  ├── log-viewer.tsx          # Real-time log streaming
  ├── file-dropzone.tsx       # Drag-and-drop upload
  ├── env-var-editor.tsx      # Key-value env editor
  ├── query-editor.tsx        # SQL query editor
  └── toast/                  # Sonner toast (replace custom)

apps/web/src/hooks/
  ├── use-keyboard-shortcut.ts
  ├── use-command-palette.ts
  ├── use-realtime.ts
  └── use-media-query.ts
```

### New Backend Modules
```
apps/api/src/modules/
  ├── docker/
  │   ├── docker.routes.ts
  │   ├── docker.schema.ts
  │   └── docker.service.ts
  ├── webhooks/
  │   ├── webhooks.routes.ts
  │   ├── webhooks.schema.ts
  │   └── webhooks.service.ts
  └── search/
      ├── search.routes.ts
      └── search.service.ts
```

### Modified Core Files
```
apps/web/src/
  ├── router.tsx              # Add lazy loading
  ├── App.tsx                 # Add CommandPalette provider
  ├── index.css               # Ensure shadcn theme vars compatible
  └── pages/*/                # Refactor all list pages + forms

apps/api/src/
  ├── server.ts               # Add Swagger + request ID
  ├── routes.ts               # Add new modules
  └── services/
      └── job-queue/
          └── job-queue.ts    # Add progress tracking
```

---

## Appendix A: Core Architecture Analysis & Gaps

> Deep dive into the current architecture of Domains, Websites, Sites, SSL, Databases, and File Manager — with specific gaps and modernization recommendations.

---

### A.1 Domain & Website Architecture (v3/v4 Hybrid)

#### Current State
The system is in a **migration limbo** between two architectures:

| Layer | Legacy (v3) | New (v4) | Status |
|-------|-------------|----------|--------|
| Container | `websites` table | `sites` table | **Both coexist** |
| FK on domains | `domains.websiteId` | `domains.siteId` | **Both exist** |
| Subdomains | `subdomains` table | `domains.type='subdomain'` | **Separate table still used** |
| Aliases | `domain_aliases` table | `domains.type='parked'` | **Separate table still used** |
| Nginx config | Per-domain vhosts | Website-scoped single conf | **Both methods exist** |

**Critical Issues**:
1. **Dual FKs on domains**: `websiteId` → `websites.id` AND `siteId` → `sites.id`. This creates ambiguity — which one is authoritative?
2. **Subdomains in separate table**: `subdomains` table has its own `domainId` FK and `websiteId` FK. The `domains` table also has `isSubdomain` boolean. Data can get out of sync.
3. **Domain aliases in separate table**: `domain_aliases` duplicates what should be `domains.type='parked'` with `parentDomainId`.
4. **NginxService uses both patterns**: `generateWebsiteConfig()` (v3 website-scoped) exists alongside legacy `addVhost()` (per-domain). The SSL service still calls `addVhost()` directly.
5. **No unified document root logic**: `resolveHomeDir()` in files module tries both `websites.documentRoot` and `domain.documentRoot` with complex fallback logic.

#### Architectural Recommendations

**Option A: Complete v4 Migration (Recommended)**
1. **Single container table**: Drop `websites`, migrate all data to `sites`. `sites` is cleaner (minimal identity, no PHP config).
2. **Single domain table**: Drop `subdomains` and `domain_aliases`. Migrate all rows to `domains` with appropriate `type` and `parentDomainId`.
3. **Single FK**: Remove `domains.websiteId`, keep only `domains.siteId`.
4. **Unified nginx config**: Remove legacy `addVhost()`/`removeVhost()`. All nginx operations go through `generateWebsiteConfig()`.
5. **Unified docroot resolver**: Single function that takes `(siteId, domainType, domainId)` and returns the correct path.

**Option B: Keep Both with Clear Bridge**
If migration is too risky, create a `SiteAdapter` service that normalizes both tables into a single interface. Frontend never knows which table it came from.

**UI Impact**:
- SitesPage and WebsitesPage show similar data — **merge them** into one "Sites" page with a migration banner for legacy sites.
- Domain detail should show all related entities (subdomains, aliases, redirects) in unified tabs, not separate pages.
- Site creation wizard should create the site + primary domain in one transaction (currently separate steps).

---

### A.2 SSL Certificate Architecture

#### Current State
The SSL system is surprisingly robust but has architectural gaps:

**Strengths**:
- Encrypted storage of certs/keys in SQLite via `encrypt()`/`decrypt()`
- Let's Encrypt HTTP-01 and DNS-01 (Cloudflare) support
- Auto-renew flag with scheduler integration
- Certificate chain validation
- Mixed content scanner (scans files for HTTP URLs)
- HSTS and OCSP stapling config endpoints
- Certificate detail parsing via openssl

**Gaps**:
1. **No certificate transparency / CT log monitoring**: Can't detect unauthorized certs issued for your domains.
2. **No ACME account management**: No way to view/regenerate the ACME account key.
3. **SAN certificate limitations**: While `sanDomains` column exists, the UI and service don't expose multi-domain cert creation.
4. **No certificate pinning / HPKP**: Modern panels should support key pinning config.
5. **SSL status not real-time**: Dashboard shows expiring certs, but domain list doesn't show SSL status inline.
6. **No wildcard support in UI**: DNS-01 exists but wildcard checkbox is hardcoded to `false`.
7. **Mixed content scanner is basic**: Regex-based, only scans 500 files, no JavaScript-generated content detection.

#### Architectural Recommendations

1. **SSL Health Pipeline**:
   ```
   Daily Cron → check all certs → if < 30 days → enqueue renewal job
   Renewal Job → certbot renew → update DB → regenerate nginx conf → notify
   ```
   Currently this logic is fragmented between scheduler and certbot service.

2. **Unified SSL State Machine**:
   ```
   pending → issuing → active → expiring → renewed | failed
   ```
   Add `sslStatus` column to domains (or `sslCertificates.status`). Currently only `autoRenew` boolean exists.

3. **Certificate Bundle Management**:
   - Store intermediate certs separately for reuse
   - Allow users to upload CA bundles independently
   - Show certificate trust chain visualization in UI

4. **Frontend SSL Widget**:
   - Every domain row should show a shield icon: green (valid), yellow (expiring < 30d), red (expired/missing)
   - One-click "Fix SSL" for expired certs (auto-renew + reload)
   - SSL score/rating (A+ to F) based on config (HSTS, OCSP, ciphers)

---

### A.3 Database Architecture

#### Current State
The database module supports MariaDB and PostgreSQL with a clean abstraction:

**Strengths**:
- `mariadbService` and `postgresService` implement the same interface pattern
- Passwords encrypted at rest in `databaseUsers.passwordHash`
- Query endpoint is read-only (safety guard)
- Operations: create, delete, export, import, repair, optimize, clone, query

**Gaps**:
1. **No connection pooling tracking**: `databaseUsers` stores credentials but no connection count/limit.
2. **No backup scheduling per database**: Backups module exists but no integration with database list.
3. **Query endpoint is too restrictive**: Only SELECT/SHOW/DESCRIBE. Users can't run `EXPLAIN`, `ANALYZE`, or `CHECK TABLE`.
4. **No database size history**: `getDatabaseInfo()` fetches current size but no trend data.
5. **No slow query log integration**: Can't identify slow queries from the panel.
6. **No schema visualization**: No ER diagram or table list view.
7. **Import is synchronous**: Large SQL dumps block the request. Should be a background job.
8. **No database-level permissions**: All users get `ALL PRIVILEGES`. No fine-grained control.

#### Architectural Recommendations

1. **Database Health Monitor**:
   - Background job that runs daily: `mysqlcheck --all-databases`, logs results
   - Track size over time in `stats` table or new `database_metrics` table
   - Alert when database grows > threshold

2. **Query Editor Enhancement**:
   - Allow `EXPLAIN`, `ANALYZE`, `CHECK TABLE`, `SHOW INDEX` (safe diagnostics)
   - Add query plan visualization for EXPLAIN output
   - Save query history per user
   - Add "Query Bookmarks" (saved queries)

3. **Schema Browser**:
   - `GET /db/:id/tables` → list tables with row counts
   - `GET /db/:id/tables/:table` → columns, indexes, foreign keys
   - `GET /db/:id/tables/:table/structure` → CREATE TABLE statement
   - Frontend: Sidebar tree view of tables → columns → indexes

4. **Import as Background Job**:
   - Large imports should enqueue `BACKUP_RESTORE` job
   - Progress tracking (% complete)
   - Handle partial failures gracefully

---

### A.4 File Manager Architecture

#### Current State
The file manager is feature-rich (1780 lines in `FilesPage.tsx`) with backend support:

**Strengths**:
- Path traversal protection via `safePath()`
- Dangerous extension blocking on upload
- Streamed uploads (no memory buffering)
- Directory tree API
- Archive/extract support
- File content editing with CodeMirror
- Image/video/PDF preview
- Chmod and ownership management

**Gaps**:
1. **No file versioning**: Edit a file → no way to undo or see history.
2. **No Git integration**: Modern devs expect to see `.git` status in file manager.
3. **No search indexing**: File search is likely slow on large directories (no indexer).
4. **Upload size limit is global**: 100MB for all uploads. No per-site or per-file-type limits.
5. **No file sharing / public links**: Can't generate temporary public URLs for files.
6. **No file comparison**: Can't diff two files visually.
7. **No batch rename**: No regex rename, sequential rename, etc.
8. **Editor lacks tabs**: Can only edit one file at a time.

#### Architectural Recommendations

1. **File Versioning (Optional)**:
   - On save, copy old file to `.novapanel/backups/{filename}.{timestamp}`
   - UI: "Previous Versions" dropdown in editor
   - Auto-cleanup after N days

2. **Git Status Integration**:
   - If directory is a git repo, show file status in listing (modified, untracked, staged)
   - Add "Git" panel: recent commits, branch, diff
   - Backend: `git status --porcelain` parser

3. **Advanced Editor**:
   - Tabbed interface (multiple files)
   - Split view (side-by-side edit)
   - File diff against previous version or another file
   - Find in project (recursive search across all files)

4. **File Search Index**:
   - For large sites, use `ripgrep` or `ag` for fast content search
   - API: `GET /files/search?q=...&path=...&type=code|text`
   - Results: file, line number, preview snippet

---

### A.5 Service Integration Architecture

#### Current State
System services (nginx, mariadb, postfix, etc.) are managed via individual service classes:

**Pattern**:
```typescript
interface SystemService {
  name: string;
  displayName: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  reload(): Promise<void>;
  status(): Promise<ServiceInfo>;
  isInstalled(): Promise<boolean>;
}
```

**Gaps**:
1. **No service dependency graph**: Starting nginx before php-fpm can cause errors.
2. **No service health checks**: `status()` checks `systemctl is-active` but doesn't verify the service is actually responding.
3. **No configuration validation before reload**: Nginx has `nginx -t`, but other services lack pre-flight checks.
4. **No rolling restart**: All restarts are immediate (downtime).

#### Recommendations

1. **Service Orchestrator**:
   ```typescript
   class ServiceOrchestrator {
     async restartWithDeps(serviceName: string) {
       // Stop dependent services → Restart target → Start dependents
     }
   }
   ```

2. **Health Check Endpoints**:
   - Nginx: `curl -I http://localhost` → check response
   - PHP-FPM: `cgi-fcgi` or socket connect
   - MariaDB: `mysqladmin ping`
   - Display health status in service cards (green = healthy, not just running)

---

## Questions for User

1. **Priority**: Should we focus on UI modernization first (Phases 0-2) or do you want backend features (webhooks, Docker, Git deployment) in parallel?
2. **Scope**: Is Docker container management a priority for your users, or should we focus on web hosting features (sites, domains, databases) first?
3. **Budget/Team**: Is this a solo project or do you have team members who can work on frontend and backend simultaneously?
4. **Mobile**: Do your users actively manage servers from mobile devices, or is desktop the primary target?
5. **Existing Data**: Are there existing production installations that need zero-downtime migrations, or is this pre-release?
6. **Architecture**: Should we prioritize completing the v4 migration (sites replacing websites, unified domains table) before adding new UI features?

---

## Success Metrics

- **Consistency**: All form inputs, buttons, tables, and modals use the same component library
- **Performance**: First Contentful Paint < 1.5s, Time to Interactive < 3s
- **Accessibility**: Pass axe-core audit with 0 critical violations
- **Developer Experience**: New feature pages can be built in < 2 hours using existing components
- **User Efficiency**: Common tasks (create site, add domain) achievable in < 3 clicks from anywhere
