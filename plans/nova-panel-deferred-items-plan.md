# NovaPanel - Deferred Items Implementation Plan

**Document Version:** 1.0  
**Created:** 2026-05-25  
**Status:** Pending Implementation

---

## Summary

This document covers **7 deferred items** from the comprehensive audit that require larger features, database migrations, or significant implementation work before they can be resolved.

| Priority | Count | Items |
|----------|-------|-------|
| MEDIUM | 7 | MEDIUM-7, MEDIUM-19, MEDIUM-20, MEDIUM-21, MEDIUM-23, MEDIUM-26, MEDIUM-27 |

---

## MEDIUM Priority Deferred Items

---

### [MEDIUM-7] - WebserverPage Reload Action Payload Is Wrong ✅ FIXED

**Severity:** MEDIUM  
**Category:** Payload-Mismatch  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/webserver/WebserverPage.tsx:48-60`
- **Backend:** `apps/api/src/modules/webserver/webserver.routes.ts:41`

**Description:**  
`handleReload` sends `{ domain: reloadTarget, action: 'reload' }` to `PUT /webserver/vhost/:domain`. The backend schema does not accept an `action` field — the reload is silently ignored.

**Root Cause:**  
Frontend assumes the backend can handle an `action` field to differentiate reload vs restart, but backend only accepts domain for vhost configuration.

**Fix Applied:**  
Changed `handleReload` to use the existing `useReloadServer()` hook which calls `POST /webserver/reload/${serverType}`. The backend already has this endpoint.

**Effort:** LOW

**Implementation Steps:**
- [x] Option A: Add `POST /webserver/vhost/:domain/reload` route in `webserver.routes.ts` - Already existed
- [x] Option A: Implement reload logic in `webserver.service.ts` - Already existed
- [x] Update `WebserverPage.tsx` to call correct endpoint - Done
- [x] Test reload functionality - Build passes

---

### [MEDIUM-19] - ContainersPage Passes ActiveOrgId as ProjectId

**Severity:** MEDIUM  
**Category:** Payload-Mismatch  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/containers/ContainersPage.tsx:27`

**Description:**  
`useContainers(activeOrgId ?? 'default')` passes orgId as projectId. Backend filters by projectId field. If container's projectId differs, filtering returns empty.

**Root Cause:**  
Developer used organization ID where project ID was expected. Organizations and projects are separate concepts.

**Fix Required:**  
1. Determine how to get actual projectId (from site context, user settings, or create project selector)
2. Pass correct projectId to `useContainers` hook

**Effort:** LOW

**Implementation Steps:**
1. [ ] Examine how containers relate to projects vs organizations
2. [ ] Determine correct source of projectId
3. [ ] Update ContainersPage to pass correct projectId
4. [ ] Test container filtering works correctly

---

### [MEDIUM-20] - No Projects Page Exists

**Severity:** MEDIUM  
**Category:** Missing-Endpoint  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/` (no ProjectsPage)
- **Backend:** `apps/api/src/modules/projects/` (exists but unused)

**Description:**  
Projects module has backend endpoints and frontend hooks, but no page component consumes them. No route, no menu entry.

**Root Cause:**  
Projects feature was backend-implemented but frontend never built.

**Fix Required:**  
1. Create `ProjectsPage.tsx` component
2. Add route to `router.tsx`
3. Add navigation entry in sidebar/menu
4. Implement CRUD operations for projects

**Effort:** MEDIUM

**Implementation Steps:**
1. [ ] Create `apps/web/src/pages/projects/ProjectsPage.tsx`
2. [ ] Implement project list view with DataTable
3. [ ] Add Create Project modal
4. [ ] Add Edit/Delete project actions
5. [ ] Add route: `/projects` in `router.tsx`
6. [ ] Add navigation item in sidebar
7. [ ] Wire up React Query hooks to backend

---

### [MEDIUM-21] - MonitorPage Alerts/Metrics/History Tabs Are Stub

**Severity:** MEDIUM  
**Category:** Fake-Data  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/monitoring/MonitoringPage.tsx`

**Description:**  
- Alerts tab shows static "Configure alert rules..." text
- Metrics tab shows static "Metrics view coming soon"
- History tab shows static "History view coming soon"

These are not stub failures — the hooks exist but the page hasn't wired them up for those tabs.

**Root Cause:**  
Monitoring page was built with placeholder UI before hook integration.

**Fix Required:**  
1. Wire Alerts tab to `useAlertRules` hook
2. Wire Metrics tab to `useMetrics` hook  
3. Wire History tab to `useAlertHistory` hook
4. Add proper loading/error states for each tab

**Effort:** MEDIUM

**Implementation Steps:**
1. [ ] Import alert hooks (`useAlertRules`, `useCreateAlertRule`, `useDeleteAlertRule`)
2. [ ] Implement Alerts tab with rule list and create form
3. [ ] Import metrics hooks (`useMetrics`, `useMetricsQuery`)
4. [ ] Implement Metrics tab with charts/graphs
5. [ ] Import alert history hooks (`useAlertHistory`)
6. [ ] Implement History tab with timeline of past alerts
7. [ ] Add loading skeletons and error states
8. [ ] Remove placeholder text

---

### [MEDIUM-23] - No Dedicated Storage/Buckets UI Page

**Severity:** MEDIUM  
**Category:** Missing-Endpoint  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/` (no storage page)
- **Backend:** `apps/api/src/modules/storage/` (exists but unused)

**Description:**  
Storage module has backend endpoints and frontend hooks, but no page component. Users cannot manage buckets or access keys through the UI.

**Root Cause:**  
Storage feature was backend-implemented but frontend never built.

**Fix Required:**  
1. Create `StoragePage.tsx` component
2. Add route to `router.tsx`
3. Add navigation entry in sidebar/menu
4. Implement bucket management and access key CRUD

**Effort:** MEDIUM

**Implementation Steps:**
1. [ ] Create `apps/web/src/pages/storage/StoragePage.tsx`
2. [ ] Implement bucket list view with DataTable
3. [ ] Add Create Bucket modal
4. [ ] Add bucket details view (objects, permissions)
5. [ ] Implement access keys management section
6. [ ] Add route: `/storage` in `router.tsx`
7. [ ] Add navigation item in sidebar
8. [ ] Wire up React Query hooks to backend

---

### [MEDIUM-26] - Domain Logs Endpoints Wrong

**Severity:** MEDIUM  
**Category:** Frontend-Endpoint-Mismatch  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/domains/DomainDetailPage.tsx` (logs tab)
- **Backend:** `apps/api/src/modules/domains/domains.routes.ts`

**Description:**  
Domain logs tab calls wrong endpoints for accessing domain-specific logs.

**Root Cause:**  
Logs were likely meant to aggregate from site logs, but domain-specific log routing wasn't implemented.

**Fix Required:**  
1. Determine correct log sources (site logs, domain logs, combined)
2. Update DomainDetailPage to call correct endpoints or site logs with domain filter
3. Implement proper log aggregation if needed

**Effort:** MEDIUM

**Implementation Steps:**
1. [ ] Analyze current DomainDetailPage logs tab implementation
2. [ ] Identify correct log source (site logs, separate domain logs)
3. [ ] Update frontend to call correct endpoint
4. [ ] If endpoint doesn't exist, create it in backend
5. [ ] Test log retrieval works for domains

---

### [MEDIUM-27] - SPF/DMARC Configure UI Exists But Non-Functional

**Severity:** MEDIUM  
**Category:** Backend-Stub  
**Files Affected:**
- **Frontend:** `apps/web/src/pages/mail/MailPage.tsx` (SPF/DMARC sections)
- **Backend:** `apps/api/src/modules/mail/mail.routes.ts`

**Description:**  
SPF/DMARC configuration UI exists in mail page but backend endpoints for setting these don't exist.

**Root Cause:**  
UI built ahead of backend implementation.

**Fix Required:**  
1. Implement `PUT /domains/:id/mail/spf` endpoint
2. Implement `PUT /domains/:id/mail/dmarc` endpoint
3. Wire UI to these endpoints
4. Or remove UI if feature not planned

**Effort:** MEDIUM

**Implementation Steps:**
1. [ ] Create SPF update endpoint in mail.routes.ts
2. [ ] Implement SPF logic in mail.service.ts (update DNS TXT record)
3. [ ] Create DMARC update endpoint in mail.routes.ts
4. [ ] Implement DMARC logic in mail.service.ts (update DNS TXT record)
5. [ ] Add frontend hooks for SPF/DMARC updates
6. [ ] Wire MailPage SPF/DMARC sections to hooks
7. [ ] Add proper error handling and success toasts

---

## Implementation Order

Recommended implementation sequence:

1. **MEDIUM-7** (WebserverPage Reload) - Quick win, unblocks reload functionality
2. **MEDIUM-19** (ContainersPage ProjectId) - Quick fix, data integrity issue
3. **MEDIUM-26** (Domain Logs) - Medium effort, improves debugging
4. **MEDIUM-27** (SPF/DMARC) - Medium effort, mail security feature
5. **MEDIUM-21** (MonitorPage Tabs) - Medium effort, monitoring completeness
6. **MEDIUM-20** (Projects Page) - Medium effort, unlocks project feature
7. **MEDIUM-23** (Storage Page) - Medium effort, unlocks storage feature

---

## Dependencies

- MEDIUM-20 and MEDIUM-23 require creating new pages (similar pattern)
- MEDIUM-27 requires DNS record manipulation (may need DNS service integration)
- MEDIUM-26 may require backend log aggregation service

---

## Notes

- All items marked MEDIUM priority
- No CRITICAL or HIGH priority items deferred
- These items were deferred because they require:
  - New pages/components (not just fixes)
  - New backend endpoints
  - Integration with DNS service
  - Log aggregation infrastructure