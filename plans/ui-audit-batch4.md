# UI Logic Audit — Batch 4: Checks UI-16 to UI-20

**Date:** 2026-04-28  
**Scope:** Global State Consistency · Error Boundary/Crash Prevention · Progress/Long Operation UI · Copy-to-Clipboard · Empty/First-Run Experience  
**Files Audited:** 26 files across `apps/web/src/`

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 1 |
| 🟠 HIGH | 3 |
| 🟡 MEDIUM | 10 |
| 🔵 LOW | 7 |
| **Total** | **21** |

Cumulative across all batches: **Batch 1 (41) + Batch 2 (28) + Batch 3 (32) + Batch 4 (21) = 122 issues**

---

## Check UI-16: Global State Consistency

### 🔴 CRITICAL

| # | File | Issue |
|---|------|-------|
| — | — | *(No critical issues in this check)* |

### 🟠 HIGH

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-16-01 | [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:747) | Alert rules stored only in React state, lost on navigation | `AlertRulesSection` stores rules in `useState` with no API persistence. Rules are lost when user navigates away. Should persist to backend via a mutation hook. |

### 🟡 MEDIUM

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-16-02 | [`LoginPage.tsx`](apps/web/src/pages/login/LoginPage.tsx:19) | Uses `window.location.href = '/'` instead of router navigation | Bypasses TanStack Router, causes full page reload. Should use `useNavigate()` or `<Navigate>`. |
| UI-16-03 | [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:328) | No redirect when domain deleted while viewing detail | `DomainDetail` component has no mechanism to detect that its domain was deleted. If a domain is deleted from another tab or by another action while the detail view is open, the user sees stale data. |
| UI-16-04 | [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:316) | SMTP settings are frontend-only simulation | `SmtpSettingsSection` uses `setTimeout` to simulate API calls. SMTP config is saved to localStorage, not the backend. |

### 🔵 LOW

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-16-05 | [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:890) | `markAllRead` is not optimistic | The "Mark All Read" mutation waits for server response before updating the unread count. Should use `onMutate` to optimistically update the cache. |
| UI-16-06 | Multiple files | Render-time side effects for form initialization | `ServerSettingsPage.tsx`, `FtpPage.tsx`, `MailPage.tsx`, `DnsPage.tsx`, `FirewallPage.tsx` all use patterns like `if (!initialized && data) { setForm(...); setInitialized(true); }` during render. Should use `useEffect` for side effects. |

---

## Check UI-17: Error Boundary / Crash Prevention

### 🔴 CRITICAL

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-17-01 | [`App.tsx`](apps/web/src/App.tsx:16) | **No error boundary at all** | The entire app is `QueryClientProvider > ToastProvider > RouterProvider` with no React error boundary. Any unhandled exception in any component crashes the entire app to a blank white screen. Must wrap with an error boundary that shows a recovery UI. |

### 🟠 HIGH

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-17-02 | [`router.tsx`](apps/web/src/router.tsx:33) | No `errorComponent` on any route | TanStack Router supports per-route `errorComponent` for route-level error boundaries, but none are configured. Every route should have an `errorComponent` that catches render errors within that route. |

### 🟡 MEDIUM

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-17-03 | [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:286) | RawZoneModal close button uses `window.location.reload()` | The close button in `RawZoneModal` calls `window.location.reload()` instead of an `onClose` callback, causing a full page reload just to close a modal. |

### 🔵 LOW

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-17-04 | Multiple files | Invalid date handling — `new Date()` with malformed input | Many places call `new Date(timestamp).toLocaleString()` without validating the input. If `timestamp` is malformed, it renders "Invalid Date" to the user. Affected: `DashboardPage.tsx`, `CronPage.tsx`, `FirewallPage.tsx`, `AuditPage.tsx`, `TopBar.tsx`. |

### ✅ WHAT IS WORKING CORRECTLY

- **Auth store logout** ([`auth.store.ts`](apps/web/src/store/auth.store.ts:29)) — Properly clears all state fields: `user`, `isAuthenticated`, `pendingTwoFactor`, `pendingUserId`, `sessionHash`.
- **AuthGuard** ([`AuthGuard.tsx`](apps/web/src/components/auth/AuthGuard.tsx:5)) — Simple and correct. Redirects to `/login` via `<Navigate>` when not authenticated.
- **Null safety** — Extensive use of optional chaining (`?.`) throughout all pages. Loading states handled with `<LoadingSpinner />`.
- **Division-by-zero guard** ([`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:83)) — `ProgressBar` checks `max > 0` before division.
- **Mutation error display** — Most mutations show errors via inline `<p className="text-destructive">` or `toast.error()`.

---

## Check UI-18: Progress / Long Operation UI

### 🔴 CRITICAL

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| — | — | *(No critical issues in this check)* |

### 🟠 HIGH

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-18-01 | [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:51) | `BackupProgressModal` starts `setInterval` inside `useState` initializer — memory leak | The `useState(() => { const interval = setInterval(...) })` pattern runs the interval in the state initializer function. The interval is never cleaned up on unmount (no `useEffect` return cleanup). This causes memory leaks and state updates on unmounted components. Must be moved to `useEffect` with cleanup. |
| UI-18-02 | [`InstallerPage.tsx`](apps/web/src/pages/installer/InstallerPage.tsx:619) | No progress UI during app installation | The `handleInstall` callback closes the modal immediately after the install mutation starts. User has no indication that installation is in progress. Should show a progress/loading state or keep the modal open with a spinner until installation completes. |

### 🟡 MEDIUM

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-18-03 | [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:111) | SSL issuance progress is simulated, not real | `simulateProgress()` uses `setInterval` to fake progress from 0→100%. Not connected to actual server-side progress via WebSocket or polling. |
| UI-18-04 | [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:84) | No cancel option during SSL certificate issuance | Once SSL issuance starts, the user cannot cancel it. Should provide a "Cancel" button that aborts the operation. |
| UI-18-05 | [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:46) | No cancel option during backup creation | The `BackupProgressModal` has no cancel button. User must wait for the backup to complete. |

### 🔵 LOW

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-18-06 | [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:51) | Backup progress is simulated, not real | Same as UI-18-03 but for backups. Progress bar advances on a timer, not connected to actual backup progress. |
| UI-18-07 | [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:385) | No progress indicator during cron job execution | `handleRun` calls `run.mutate()` with no loading indicator. The user sees no feedback until the result modal appears. |

### ✅ WHAT IS WORKING CORRECTLY

- **TunnelsPage setup wizard** ([`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:165)) — Has a proper "creating" step with `<LoadingSpinner />`.
- **TunnelsPage live logs** ([`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:393)) — Uses WebSocket via `useTunnelLogs` for real-time log streaming. Shows connection status indicator.
- **Mutation loading states** — All mutations correctly disable buttons and show "Saving...", "Creating...", etc. during pending state.

---

## Check UI-19: Copy-to-Clipboard

### 🔴 CRITICAL

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| — | — | *(No critical issues in this check)* |

### 🟠 HIGH

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| — | — | *(No high issues in this check)* |

### 🟡 MEDIUM

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-19-01 | Multiple files | No HTTPS fallback for `navigator.clipboard` | All clipboard operations use `navigator.clipboard.writeText()` which is only available in secure contexts (HTTPS). If the panel is accessed over HTTP, clipboard operations fail silently. Should fall back to `document.execCommand('copy')` or a textarea-based approach. Affected files: `ApiTokensPage.tsx`, `ProfilePage.tsx`, `InstallerPage.tsx`, `FtpPage.tsx`, `MailPage.tsx`, `DatabasesPage.tsx`. |

### 🔵 LOW

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-19-02 | [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:258) | `handleCopyResults` has no visual feedback | The copy results button calls `navigator.clipboard.writeText` but provides no "Copied!" feedback to the user. All other copy operations in the app show a 2-second revert. |

### ✅ WHAT IS WORKING CORRECTLY

- **Consistent copy pattern** — All copy operations use `navigator.clipboard.writeText()` with a 2-second "Copied" revert. This is used correctly in:
  - [`ApiTokensPage.tsx`](apps/web/src/pages/settings/ApiTokensPage.tsx:246) — Token copy with one-time visibility warning
  - [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:307) — Backup codes copy
  - [`InstallerPage.tsx`](apps/web/src/pages/installer/InstallerPage.tsx:91) — PostInstall checklist copy
  - [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:181) — Connection info copy
  - [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:34) — Reusable `CopyButton` component
- **One-time warning for sensitive data** — `TokenCreatedModal` in `ApiTokensPage.tsx` correctly warns that the token will only be shown once.

---

## Check UI-20: Empty / First-Run Experience

### 🔴 CRITICAL

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| — | — | *(No critical issues in this check)* |

### 🟠 HIGH

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| — | — | *(No high issues in this check)* |

### 🟡 MEDIUM

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-20-01 | [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:268) | No getting-started card for first-run experience | The dashboard immediately shows server stats, services, and activity. New users see a fully populated dashboard with no guidance. Should detect first login and show a "Getting Started" card with setup steps (e.g., create first domain, enable SSL, set up backups). |

### 🔵 LOW

| # | File:Line | Issue | Detail |
|---|-----------|-------|--------|
| UI-20-02 | [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:531) | No explicit empty state for empty backup list | The backups tab iterates over `backups.map(...)` but if the list is empty, it shows nothing. Should use `<EmptyState>` component like other pages. |

### ✅ WHAT IS WORKING CORRECTLY

- **Comprehensive empty states** — Almost all pages use the `<EmptyState>` component properly:
  - [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:839) — "No domains yet" with create CTA
  - [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:520) — "No databases" with "Create your first database" CTA
  - [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:406) — "No cron jobs" with "Create your first scheduled task"
  - [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:363) — "Select a domain" prompt + "No FTP accounts" empty state
  - [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:504) — "Mail Not Enabled" with CTA, plus empty states for mailboxes, aliases, and queue
  - [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:886) — "Select a domain" prompt + "No DNS records found"
  - [`FirewallPage.tsx`](apps/web/src/pages/firewall/FirewallPage.tsx:548) — Empty states for rules, Fail2Ban jails, and login activity
  - [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:680) — "No tunnels configured" with setup CTA
  - [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:920) — Empty state for no certificates
  - [`AuditPage.tsx`](apps/web/src/pages/audit/AuditPage.tsx:459) — "No audit entries" with "Actions will appear here"
  - [`ApiTokensPage.tsx`](apps/web/src/pages/settings/ApiTokensPage.tsx:593) — Empty state for no tokens
  - [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:228) — Empty states for history and alert rules

---

## Issue Index (Batch 4)

| ID | Severity | Check | File | Summary |
|----|----------|-------|------|---------|
| UI-17-01 | 🔴 CRITICAL | Error Boundary | `App.tsx` | No error boundary — any crash = blank screen |
| UI-16-01 | 🟠 HIGH | State Consistency | `NotificationsPage.tsx` | Alert rules lost on navigation — no API persistence |
| UI-18-01 | 🟠 HIGH | Progress UI | `BackupsPage.tsx` | `setInterval` in `useState` initializer — memory leak |
| UI-18-02 | 🟠 HIGH | Progress UI | `InstallerPage.tsx` | No progress UI during app installation |
| UI-16-02 | 🟡 MEDIUM | State Consistency | `LoginPage.tsx` | `window.location.href` instead of router navigation |
| UI-16-03 | 🟡 MEDIUM | State Consistency | `DomainsPage.tsx` | No redirect when domain deleted from detail view |
| UI-16-04 | 🟡 MEDIUM | State Consistency | `NotificationsPage.tsx` | SMTP settings are frontend-only simulation |
| UI-17-02 | 🟡 MEDIUM | Error Boundary | `router.tsx` | No `errorComponent` on any route |
| UI-17-03 | 🟡 MEDIUM | Error Boundary | `DnsPage.tsx` | RawZoneModal close uses `window.location.reload()` |
| UI-18-03 | 🟡 MEDIUM | Progress UI | `SslPage.tsx` | SSL progress is simulated, not real WebSocket |
| UI-18-04 | 🟡 MEDIUM | Progress UI | `SslPage.tsx` | No cancel option during SSL issuance |
| UI-18-05 | 🟡 MEDIUM | Progress UI | `BackupsPage.tsx` | No cancel option during backup creation |
| UI-19-01 | 🟡 MEDIUM | Clipboard | Multiple files | No HTTP fallback for `navigator.clipboard` |
| UI-20-01 | 🟡 MEDIUM | Empty State | `DashboardPage.tsx` | No getting-started card for first-run |
| UI-16-05 | 🔵 LOW | State Consistency | `NotificationsPage.tsx` | `markAllRead` not optimistic |
| UI-16-06 | 🔵 LOW | State Consistency | Multiple files | Render-time side effects for form init |
| UI-17-04 | 🔵 LOW | Error Boundary | Multiple files | Invalid date handling — "Invalid Date" shown |
| UI-18-06 | 🔵 LOW | Progress UI | `BackupsPage.tsx` | Backup progress is simulated |
| UI-18-07 | 🔵 LOW | Progress UI | `CronPage.tsx` | No loading indicator during job execution |
| UI-19-02 | 🔵 LOW | Clipboard | `DatabasesPage.tsx` | Copy results has no visual feedback |
| UI-20-02 | 🔵 LOW | Empty State | `BackupsPage.tsx` | No empty state for empty backup list |
