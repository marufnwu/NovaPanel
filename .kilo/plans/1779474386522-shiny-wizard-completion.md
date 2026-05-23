# NovaPanel UI Modernization — Completion Plan

**Original plan:** `1779474386522-shiny-wizard.md`  
**Status:** Phases 1–6 structurally complete. Multiple items were partially implemented or need finishing.

---

## What Was Completed in Previous Sessions

| Phase | Item | Status | Notes |
|-------|------|--------|-------|
| 1.1 | Remove fake SMTP from NotificationsPage | Partial | SMTP tab replaced with placeholder linking to Server Settings |
| 1.2 | Fix Alert Rules in NotificationsPage | Done | Removed fake CRUD; placeholder links to Monitoring |
| 1.3 | Fix Monitoring graphs | Partial | `useMetrics()` called first, but still falls back to `generateHistoricalData()` |
| 1.4 | Fix Backup progress | Partial | Uses `backup.status` from API, but still has fixed 2s interval step advancement |
| 1.5 | Fix PHP Version save | Partial | Has TODO comment; no backend endpoint exists |
| 1.6 | Fix Audit log pagination | Not started | Still fetches 500 entries and filters client-side |
| 2 | Restructure Sidebar | Done | 5 groups implemented; Services page created |
| 3 | StatusBar | Done | Mounted in AppLayout with CPU/RAM/Disk/service health |
| 4 | Site as Central Unit | Partial | 8 scoped tabs added to SiteDetailPage, all are `PlaceholderTab` |
| 5 | ActivityFeed | Partial | Component exists and uses WebSocket, but no initial fetch from `GET /jobs` |
| 6.1 | Breadcrumbs | Done | Mounted in AppLayout; detail pages show generic "Detail" instead of entity names |
| 6.2 | DataTable → DataTableV2 | Done | Migrated DatabasesPage and DomainsPage; old DataTable unused |
| 6.3 | ConfirmDialog DELETE friction | Partial | Sites, Databases, Domain bulk delete have it. Missing: Restore Backup, Server Reboot/Shutdown |
| 6.4 | Alert Rules unified | Done | MonitoringPage is single source of truth |

---

## Remaining Work — Detailed Implementation Plan

### Priority 1: Trust-Breaking Fixes (Phase 1 Completion)

These fix simulated/broken features that erode user trust.

#### 1.1 SMTP Configuration — Full Implementation

**Gap:** No `PUT /settings/smtp` or `POST /settings/smtp/test` endpoints exist. ServerSettingsPage has no Email collapsible.

**API changes:**
- `apps/api/src/modules/settings/settings.routes.ts`: add:
  - `GET /settings/smtp` → `settingsService.getSmtpConfig()`
  - `PUT /settings/smtp` → `settingsService.updateSmtpConfig(data, userId, ip)`
  - `POST /settings/smtp/test` → `settingsService.sendTestEmail(userId)`
- `apps/api/src/modules/settings/settings.service.ts`: implement:
  - `getSmtpConfig()`: read from DB/settings store
  - `updateSmtpConfig(data, userId, ip)`: validate + save + audit log
  - `sendTestEmail(userId)`: send test email using configured SMTP, return success/error
- `apps/api/src/modules/settings/settings.schema.ts`: add `smtpConfigSchema` with fields:
  - `host` (string), `port` (number), `username` (string), `password` (string), `fromAddress` (string), `encryption` (enum: 'none' | 'tls' | 'ssl')
- `apps/web/src/api/hooks/settings.ts`: add hooks:
  - `useSmtpSettings()`, `useUpdateSmtpSettings()`, `useSendTestEmail()`

**Web changes:**
- `apps/web/src/pages/settings/ServerSettingsPage.tsx`:
  - Add "Email" collapsible section with form fields (host, port, username, password, from_address, encryption dropdown)
  - Wire Save → `useUpdateSmtpSettings().mutate()`
  - Add "Send Test Email" button → `useSendTestEmail().mutate()` with success/error toast

---

#### 1.3 Monitoring Graphs — Remove Fake Data Fallback

**Gap:** `generateHistoricalData()` is still called as fallback when `useMetrics()` returns no data.

**API status:** `GET /stats/network` and `GET /stats/disk` exist in `stats.routes.ts` (lines 46–61).

**Web changes:**
- `apps/web/src/pages/monitoring/MonitoringPage.tsx`:
  - Find `generateHistoricalData()` function (~line 127) and all call sites.
  - For network graph: replace fallback with `useNetworkStats(timeRange)` hook calling `GET /stats/network`
  - For disk graph: replace fallback with `useDiskStats(timeRange)` hook calling `GET /stats/disk`
  - If API returns empty array → show `EmptyState` with "No data yet" instead of synthesizing.
  - Keep `useMetrics()` for custom metric overlays only.

---

#### 1.4 Backup Progress — Remove Fixed Interval, Poll Real Job

**Gap:** `BackupProgressModal` still has `setInterval` advancing steps every 2s (lines 78–86).

**API status:** `GET /jobs/:id` exists in `jobs.routes.ts` (line 24).

**Web changes:**
- `apps/web/src/pages/backups/BackupsPage.tsx`:
  - In `BackupProgressModal`, import `useJob` from `../../api/hooks/jobs`.
  - Replace the `setInterval` useEffect with:
    - `const { data: job } = useJob(backupId, { refetchInterval: 2000 });`
  - Map `job.status` to steps:
    - `pending`/`queued` → step 0 (Preparing)
    - `running` → step 1 or 2 based on `job.progress` (if available)
    - `success` → step 3 (Finalizing) then auto-close after 2s
    - `failed` → show error state with `job.error`
  - Remove `currentStep` state and the interval entirely.

---

#### 1.5 PHP Version Save — Add Backend Endpoint

**Gap:** Save button has TODO comment (line 414); no `PUT /settings/php-version` endpoint.

**API changes:**
- `apps/api/src/modules/settings/settings.routes.ts`: add:
  - `GET /settings/php-version` → `settingsService.getPhpVersion()`
  - `PUT /settings/php-version` → `settingsService.updatePhpVersion(version, userId, ip)`
- `apps/api/src/modules/settings/settings.service.ts`: implement:
  - `getPhpVersion()`: read default PHP version from config
  - `updatePhpVersion(version, userId, ip)`: validate version against installed list, update config, run `update-alternatives` or equivalent, audit log
- `apps/api/src/modules/settings/settings.schema.ts`: add `updatePhpVersionSchema` with `version: z.string()`

**Web changes:**
- `apps/web/src/api/hooks/settings.ts`: add `usePhpVersionSettings()` and `useUpdatePhpVersion()`
- `apps/web/src/pages/settings/ServerSettingsPage.tsx`:
  - Replace TODO comment with actual mutation call
  - Wire Save button → `useUpdatePhpVersion().mutate({ version: selectedVersion })`
  - On success: `toast.success('Default PHP version updated')`

---

#### 1.6 Audit Log Pagination — Server-Side Query Params

**Gap:** `GET /audit` only supports `limit` and `offset`. UI fetches 500 entries and filters client-side.

**API changes:**
- `apps/api/src/modules/audit/audit.routes.ts`:
  - Expand handler to read query params: `search`, `category`, `user`, `from`, `to`, `page`, `per_page`
  - Build Drizzle query dynamically with `.where()` conditions
  - Return `{ success: true, data: results, meta: { total, page, perPage, totalPages } }`
- Use Drizzle's `like()` for search, `eq()` for category/user, `gte()`/`lte()` for date range.

**Web changes:**
- `apps/web/src/api/hooks/audit.ts`:
  - Expand `useAuditLog()` to accept `filters?: { search?: string; category?: string; user?: string; from?: string; to?: string; page?: number; perPage?: number }`
  - Build query string from filters
- `apps/web/src/pages/audit/AuditPage.tsx`:
  - Remove client-side `filteredEntries` useMemo
  - Pass filter state directly to `useAuditLog(filters)`
  - Wire pagination controls to `filters.page`
  - Wire search input to `filters.search` with debounce (300ms)
  - Wire category filter to `filters.category`
  - Keep CSV export but export current page only (or add "Export All" option)

---

### Priority 2: Site Detail Real Content (Phase 4 Completion)

**Gap:** All 8 scoped tabs in SiteDetailPage render `PlaceholderTab` only.

**Approach:** Extract reusable components from global pages and scope them to the site.

**Files to change:**
- `apps/web/src/pages/sites/SiteDetailPage.tsx`:
  - **Database tab**: reuse `DatabasesPage` create modal + show attached DBs filtered by `siteId`. Use `useDatabases()` and filter client-side by `siteId`.
  - **SSL tab**: extract `SslCard` from `SslPage.tsx` and pass `domainId` from site's primary domain. Use existing `useDomainSsl(domainId)` hooks.
  - **DNS tab**: extract `DnsRecordsTable` from `DnsPage.tsx` and pass `domainId`. Use existing `useDomainDnsRecords(domainId)` hooks.
  - **PHP tab**: extract `PhpConfigForm` from `PhpPage.tsx` scoped to site's domain. Use `usePhpConfig(domainId)`.
  - **Webserver tab**: extract `WebserverConfig` from `WebserverPage.tsx` scoped to site's domain. Use `useWebserverConfig(domainId)`.
  - **Logs tab**: create new component `SiteLogsViewer` calling `GET /domains/:id/access-log` and `GET /domains/:id/error-log`.
  - **Cron tab**: reuse `CronPage` job list filtered by `siteId`. Use `useCronJobs()` and filter by `siteId`.

**Important:** Do NOT duplicate API hooks. Create wrapper components in `apps/web/src/pages/sites/components/` that accept `siteId`/`domainId` and internally call the same hooks used by global pages.

---

### Priority 3: Activity Feed Enhancement (Phase 5 Completion)

#### 5.1 Initial Job List from API

**Gap:** ActivityFeed only shows jobs received via WebSocket. No initial list.

**API status:** `GET /jobs` exists with `status`, `type`, `limit`, `offset` params.

**Web changes:**
- `apps/web/src/components/jobs/ActivityFeed.tsx`:
  - Import `useJobs` from `../../api/hooks/jobs`
  - Call `const { data: apiJobs } = useJobs({ limit: 50, offset: 0 })`
  - Merge `apiJobs` with WebSocket `jobs` state (deduplicate by `jobId`)
  - Show merged list instead of WebSocket-only list

#### 5.2 Unread Indicator

**Gap:** No unread count badge on ActivityFeed button.

**Web changes:**
- `apps/web/src/components/jobs/ActivityFeed.tsx`:
  - Track `unreadCount` in local state (reset when `open` changes to true)
  - Derive from: `jobs.filter(j => j.status === 'failed').length` (red dot) or `jobs.filter(j => ['queued','running'].includes(j.status)).length` (blue dot)
- `apps/web/src/components/layout/TopBar.tsx`:
  - ActivityFeed button already mounted at line 119
  - Ensure it shows the badge from `useJobNotifications().runningCount` (already exists)

---

### Priority 4: Final Polish (Phase 6 Completion)

#### 6.1 Breadcrumb Dynamic Names

**Gap:** Detail pages show generic "Detail" instead of entity name.

**Web changes:**
- `apps/web/src/components/layout/AppLayout.tsx`:
  - In `buildBreadcrumbs()`, when segment is `$id` (dynamic), derive entity name:
    - For `/sites/$id`: call `useSite(id)` — but this would require hooks in a non-component function.
  - Better approach: each detail page passes breadcrumb items to a context or the Breadcrumb component accepts override props.
  - **Recommended**: Create `useBreadcrumbs()` hook that each detail page calls to set breadcrumb items in a Zustand store or React context. `AppLayout` reads from this context.
  - Alternatively simpler: Detail pages render their own `<Breadcrumb>` locally above content, overriding the global one.

**Decision needed:** Should we use a breadcrumb context or local override per page?

#### 6.3 ConfirmDialog Consistency — Remaining High-Impact Actions

**Gap:** Missing `requireTyping="DELETE"` on:
- Restore Backup (`BackupsPage.tsx`)
- Server Reboot (`ServerSettingsPage.tsx`)
- Server Shutdown (`ServerSettingsPage.tsx`)

**Web changes:**
- `apps/web/src/pages/backups/BackupsPage.tsx`: Add `requireTyping="DELETE"` to Restore confirmation dialog.
- `apps/web/src/pages/settings/ServerSettingsPage.tsx`: Add `requireTyping="DELETE"` to Reboot and Shutdown ConfirmDialogs.

#### 6.4 Alert Rules Tab Position

**Gap:** Plan suggested moving Alert Rules to tab 2.

**Decision needed:** Is this still desired? Current order: Overview | Metrics | Alerts | History. The plan suggested: Overview | Alerts | Metrics | History.

**Web changes (if approved):**
- `apps/web/src/pages/monitoring/MonitoringPage.tsx`: Reorder tab array so `'alerts'` comes before `'metrics'`.

---

## Implementation Order

1. **Phase 1.3** (Monitoring graphs) — pure frontend, API endpoints already exist
2. **Phase 1.4** (Backup progress) — pure frontend, API endpoint exists
3. **Phase 5.1 + 5.2** (ActivityFeed) — pure frontend, API endpoint exists
4. **Phase 1.6** (Audit pagination) — frontend + minor API query param additions
5. **Phase 1.5** (PHP version) — frontend + new API endpoint
6. **Phase 1.1** (SMTP) — frontend + new API endpoint + service method
7. **Phase 4.1** (SiteDetail tabs) — frontend component extraction (no API changes)
8. **Phase 6.1, 6.3, 6.4** — final polish

## Open Decisions

| # | Question | Context |
|---|----------|---------|
| 1 | Breadcrumb entity names: context store or local override? | Detail pages need to pass names like "MySite" into the global Breadcrumb |
| 2 | Alert Rules tab order: keep current or move to tab 2? | Plan suggested moving Alerts before Metrics |
| 3 | SiteDetail tab content: full component extraction or simplified read-only views? | Full extraction is more work but provides full functionality |

---

## Files That Will Change

### API (backend)
- `apps/api/src/modules/settings/settings.routes.ts` — add smtp, php-version endpoints
- `apps/api/src/modules/settings/settings.service.ts` — add smtp, php-version methods
- `apps/api/src/modules/settings/settings.schema.ts` — add smtp, php-version schemas
- `apps/api/src/modules/audit/audit.routes.ts` — add query param filtering

### Web (frontend)
- `apps/web/src/api/hooks/settings.ts` — add smtp, php-version hooks
- `apps/web/src/api/hooks/audit.ts` — add filter params
- `apps/web/src/pages/monitoring/MonitoringPage.tsx` — remove generateHistoricalData fallback
- `apps/web/src/pages/backups/BackupsPage.tsx` — poll useJob, remove interval
- `apps/web/src/pages/settings/ServerSettingsPage.tsx` — wire php-version save, add email section
- `apps/web/src/pages/audit/AuditPage.tsx` — server-side pagination
- `apps/web/src/components/jobs/ActivityFeed.tsx` — fetch initial jobs, unread badge
- `apps/web/src/pages/sites/SiteDetailPage.tsx` — replace placeholders with real content
- `apps/web/src/components/layout/AppLayout.tsx` — dynamic breadcrumb names

## Verification Steps Per Phase

After each phase:
1. Run `cd apps/web && npx tsc --noEmit` — TypeScript must pass
2. Run `pnpm --filter web build` — build must succeed
3. Run `pnpm --filter api build` — API build must succeed
4. Run `npx vitest run` in `apps/api/` — tests must pass
5. Manual spot-check: login → navigate to affected page → confirm no runtime errors
