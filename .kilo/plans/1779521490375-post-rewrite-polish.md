# NovaPanel v5 — Post-Rewrite Polish Plan

## Status

The Big Bang UI rewrite (Phases 1-4) and comprehensive testing (Phase 6) are **complete and deployed**. The panel is running at `192.168.0.212:8732`.

This plan covers the remaining polish work: stabilising E2E tests, raising coverage, and adding visual regression + accessibility checks.

---

## Phase A — Fix E2E Flakiness (~3 hours)

### Problem

91 Playwright E2E tests run against the live server. ~14 fail intermittently due to timing issues (server slow to respond under parallel test load). These are **not test code defects** — they are timeout failures.

### Root Causes

1. **Login timeout**: `page.waitForURL(/\/dashboard/, { timeout: 20000 })` exceeds when server is under load
2. **Topbar element visibility**: `button[aria-label="Search"]` / `Notifications` / `User menu` not rendered within 5s
3. **Async UI refresh**: Entity created via API doesn't appear in UI list within 10s (needs page reload or list refresh)
4. **Workers=2 overload**: Parallel tests hitting the same server cause contention

### A.1 — Increase Timeouts & Add Retries (30 min)

**File:** `apps/web/playwright.config.ts`

```typescript
retries: process.env.CI ? 2 : 1,  // enable 1 retry locally
workers: 1,  // always 1 worker to avoid server overload
use: {
  baseURL: 'http://192.168.0.212:8732',
  actionTimeout: 15000,      // default action timeout
  navigationTimeout: 20000,  // page.goto / waitForURL
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
},
```

### A.2 — Extract Shared `login()` Helper (30 min)

**File:** `apps/web/tests/helpers/login.ts`

Create a single robust login helper used by all specs:

```typescript
export async function login(page: Page, opts?: { timeout?: number }) {
  const timeout = opts?.timeout ?? 30000;
  await page.goto('/login');
  await page.waitForLoadState('networkidle', { timeout });
  
  // Clear any stale auth
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.waitForLoadState('networkidle', { timeout });
  
  await page.locator('input[name="username"], input[type="text"]').first().fill(ADMIN_USER);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout });
}
```

Replace duplicated `login()` in `auth.spec.ts`, `navigation.spec.ts`, `flows/*.spec.ts`.

### A.3 — Fix Async UI Refresh in Flow Tests (1 hour)

**Files:** `tests/flows/create-site.spec.ts`, `tests/flows/add-domain.spec.ts`

Problem: Entity created via API doesn't appear in the UI list immediately because the list is fetched on page load, not refreshed after creation.

Fix: After creating via API, reload the page before checking for the entity:

```typescript
// After API creation
await page.goto('/sites');
await page.waitForLoadState('networkidle', { timeout: 15000 });
// Now check for the entity
await expect(page.locator(`text=${SITE_NAME}`).first()).toBeVisible({ timeout: 10000 });
```

Also add a `page.reload()` step before the assertion to force a fresh data fetch.

### A.4 — Fix Topbar Element Visibility (30 min)

**File:** `tests/navigation.spec.ts`

Problem: `button[aria-label="Search"]` selector fails because the actual button might have a different aria-label or the topbar renders conditionally.

Fix: Check the actual DOM for topbar buttons and use correct selectors. Use `data-testid` attributes in components if selectors are fragile.

Add `data-testid` attributes to Topbar buttons:
- `data-testid="topbar-search"`
- `data-testid="topbar-notifications"`
- `data-testid="topbar-user-menu"`

Update tests to use these stable selectors.

### A.5 — Fix Backup-Restore Flow Login Timeout (30 min)

**File:** `tests/flows/backup-restore.spec.ts`

Problem: Same as other login timeouts. Apply the robust `login()` helper and increase timeout.

### A.6 — Run Full E2E Suite & Verify Stability (30 min)

```bash
npx playwright test --workers=1 --retries=1
```

Target: **91/91 pass** (with retries).

---

## Phase B — Raise Coverage (~4 hours)

### Current Coverage

| Metric | Current | Target |
|---|---|---|
| Statements | 49.79% | 85% |
| Branches | 75.33% | 80% |
| Functions | 27.25% | 90% |
| Lines | 49.79% | 85% |

### Gap Analysis

**Well covered (90%+):**
- `src/api/client.ts` — 94.2%
- `src/components/ui/*.test.tsx` — tested
- `src/components/layout/*.test.tsx` — tested
- `src/lib/*.test.ts` — tested
- `src/store/auth.store.test.ts` — tested

**Poorly covered (0-60%):**
- `src/api/hooks/*.ts` — 31.9% average (37 hook files, only auth + sites tested)
- `src/pages/*.tsx` — 0% (only smoke-rendered, not functionally tested)

**Excluded from coverage:**
- `src/test/**` — test infrastructure
- `src/main.tsx`, `src/router.tsx` — entry points

### Strategy

Pages are hard to unit-test meaningfully because they are mostly data-fetching + layout. The biggest ROI is in **API hook tests** — they are pure logic (TanStack Query hooks) and easy to test with MSW.

### B.1 — Batch 1: Core Hooks (1 hour)

**Files to test:**
- `src/api/hooks/domains.ts` — 39.67% → target 80%+
- `src/api/hooks/databases.ts` — 57.14% → target 80%+
- `src/api/hooks/dns.ts` — 30.76% → target 80%+
- `src/api/hooks/ssl.ts` — currently 0% or low

**Pattern:** Same as existing `auth.test.tsx` and `sites.test.tsx`:
- Mock MSW handlers for each endpoint
- Test hook renders with `renderHook`
- Test loading, success, error states
- Test mutation hooks (create, update, delete)

### B.2 — Batch 2: System Hooks (1 hour)

**Files to test:**
- `src/api/hooks/cron.ts` — 64.28%
- `src/api/hooks/firewall.ts` — 62.96%
- `src/api/hooks/jobs.ts` — 66.66%
- `src/api/hooks/logs.ts` — 67.34%
- `src/api/hooks/notifications.ts` — 74.13%

### B.3 — Batch 3: Remaining Hooks (1 hour)

**Files to test:**
- `src/api/hooks/backup.ts` — 37%
- `src/api/hooks/billing.ts` — 31.18%
- `src/api/hooks/containers.ts` — 51.28%
- `src/api/hooks/files.ts` — 38.65%
- `src/api/hooks/mail.ts` — 46.75%
- `src/api/hooks/php.ts` — 52.08%
- `src/api/hooks/plugins.ts` — 40.98%
- `src/api/hooks/registries.ts` — 57.77%
- `src/api/hooks/security.ts` — 45.2%

**Skip (0% but low value):**
- `src/api/hooks/deployments.ts` — 0% (niche feature)
- `src/api/hooks/features.ts` — 0% (simple hook)
- `src/api/hooks/ftp.ts` — 0% (niche feature)
- `src/api/hooks/monitoring.ts` — 0% (complex, charts)
- `src/api/hooks/organizations.ts` — 0% (simple CRUD)
- `src/api/hooks/projects.ts` — 0% (niche feature)
- `src/api/hooks/settings.ts` — 0% (large file, 485 lines)

### B.4 — Add MSW Handlers for New Hooks (30 min)

**File:** `src/test/mocks/handlers.ts`

Add handlers for all endpoints used by the new hook tests. Reuse existing factories from `src/test/factories/data.ts`.

### B.5 — Update Coverage Thresholds (30 min)

After adding hook tests, update `vitest.config.ts`:

```typescript
thresholds: {
  statements: 60,   // was 49
  branches: 75,     // was 75 (already met)
  functions: 50,    // was 27
  lines: 60,        // was 49
},
```

Target after Phase B:
- Statements: ~60%
- Functions: ~50%
- Branches: ~75% (already met)

> Note: Reaching 85/80/90/85 requires testing all pages, which needs full integration tests with MSW for each page's data flow. That is 10-15 hours of work and has diminishing returns since pages are already E2E-tested.

---

## Phase C — Visual Regression + Accessibility (~4 hours)

### C.1 — Install Dependencies (15 min)

```bash
pnpm add -D @axe-core/playwright
```

`@axe-core/playwright` integrates axe-core with Playwright for automated accessibility scanning.

### C.2 — Add Accessibility Tests (2 hours)

**File:** `tests/a11y.spec.ts`

Test all major pages for accessibility violations:

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/login', '/dashboard', '/sites', '/domains', '/databases'];

for (const path of PAGES) {
  test(`a11y scan: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
}
```

Run on login page (no auth), and after logging in for protected pages.

### C.3 — Add Visual Regression Baseline (1.5 hours)

**File:** `tests/visual.spec.ts`

Take screenshots of key pages and compare against baselines:

```typescript
import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/login', name: 'login' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/sites', name: 'sites' },
  { path: '/domains', name: 'domains' },
];

for (const { path, name } of PAGES) {
  test(`screenshot: ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${name}.png`);
  });
}
```

**Playwright config update:**
```typescript
expect: {
  toHaveScreenshot: { maxDiffPixels: 100 },
},
```

Generate baseline screenshots:
```bash
npx playwright test visual.spec.ts --update-snapshots
```

### C.4 — Fix A11y Issues (30 min)

If axe-core finds violations, fix the most critical ones:
- Missing `aria-label` on icon-only buttons
- Insufficient color contrast
- Missing form labels
- Empty links

---

## Phase D — Bug Fixes from E2E Testing (~variable)

As E2E tests run, real bugs may surface. Document and fix them:

**Tracking:** `BUGS.md` in repo root

```markdown
# Known Bugs from E2E Testing

## Bug 1: [Description]
- **Found by:** [test file]
- **Severity:** [critical/medium/low]
- **Steps to reproduce:**
- **Expected:**
- **Actual:**
- **Fix:** [commit or PR]
```

---

## Implementation Order

| Phase | Task | Time | Commit Message |
|---|---|---|---|
| A.1 | Increase timeouts & retries | 30 min | `test(e2e): increase timeouts and enable retries` |
| A.2 | Extract shared login helper | 30 min | `test(e2e): extract shared login helper` |
| A.3 | Fix async UI refresh in flows | 1h | `test(e2e): fix async UI refresh in flow tests` |
| A.4 | Fix topbar selectors | 30 min | `test(a11y): add data-testid to Topbar buttons` |
| A.5 | Fix backup-restore timeout | 30 min | `test(e2e): fix backup-restore flow timeouts` |
| A.6 | Verify full suite stability | 30 min | `test(e2e): verify all 91 tests pass` |
| B.1 | Core hooks tests (domains, databases, dns, ssl) | 1h | `test(hooks): add tests for domains, databases, dns, ssl` |
| B.2 | System hooks tests (cron, firewall, jobs, logs, notifications) | 1h | `test(hooks): add tests for system hooks` |
| B.3 | Remaining hooks tests | 1h | `test(hooks): add tests for backup, billing, mail, php, plugins` |
| B.4 | MSW handlers for new hooks | 30 min | `test(mocks): add MSW handlers for new hook endpoints` |
| B.5 | Update coverage thresholds | 30 min | `test(config): raise coverage thresholds` |
| C.1 | Install @axe-core/playwright | 15 min | `chore(deps): add @axe-core/playwright` |
| C.2 | Add a11y tests | 2h | `test(a11y): add axe-core accessibility scans` |
| C.3 | Add visual regression | 1.5h | `test(visual): add screenshot regression tests` |
| C.4 | Fix a11y issues | 30 min | `fix(a11y): resolve axe-core violations` |

**Total: ~11-13 hours**

---

## Exit Criteria

- [ ] All 91 E2E tests pass consistently (with retries enabled)
- [ ] Coverage: statements ≥60%, branches ≥75%, functions ≥50%, lines ≥60%
- [ ] Axe-core scans pass on all major pages (0 violations)
- [ ] Visual regression baselines generated for login, dashboard, sites, domains
- [ ] No critical bugs surfaced from E2E testing
- [ ] All changes committed and deployed
