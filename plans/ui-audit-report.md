# NOVAPANEL UI LOGIC AUDIT REPORT
Generated: 2026-04-28

## EXECUTIVE SUMMARY

Total UI Issues Found: 122
  Critical  (user is blocked / cannot complete a key task): 4
  High      (task can complete but behavior is wrong or confusing): 35
  Medium    (missing feedback / incomplete state handling): 54
  Low       (polish / minor inconsistency): 29

### Issues by Audit Check

| Check | Area | Critical | High | Medium | Low | Total |
|-------|------|----------|------|--------|-----|-------|
| UI-1 | Interactive Element Handlers | 0 | 2 | 4 | 0 | 6 |
| UI-2 | Form Completeness | 0 | 3 | 8 | 2 | 13 |
| UI-3 | Render States | 0 | 1 | 4 | 1 | 6 |
| UI-4 | Destructive Action Confirmations | 3 | 4 | 4 | 1 | 12 |
| UI-5 | Modal and Drawer Lifecycle | 0 | 2 | 3 | 1 | 6 |
| UI-6 | Tab and Multi-Panel Navigation | 0 | 3 | 3 | 2 | 8 |
| UI-7 | Real-Time UI (WebSocket) | 0 | 3 | 2 | 0 | 5 |
| UI-8 | Sidebar and Navigation | 0 | 2 | 0 | 1 | 3 |
| UI-9 | Notification and Toast System | 0 | 3 | 2 | 1 | 6 |
| UI-10 | Data Tables and Lists | 0 | 0 | 6 | 2 | 8 |
| UI-11 | Multi-Step Flows and Wizards | 0 | 2 | 2 | 1 | 5 |
| UI-12 | File Manager UI Logic | 0 | 3 | 6 | 2 | 11 |
| UI-13 | Forms with Dynamic Fields | 0 | 0 | 2 | 3 | 5 |
| UI-14 | Settings Pages Logic | 0 | 1 | 3 | 2 | 6 |
| UI-15 | Theme, Responsiveness, Accessibility | 0 | 1 | 5 | 3 | 9 |
| UI-16 | Global State Consistency | 0 | 1 | 2 | 2 | 5 |
| UI-17 | Error Boundary / Crash Prevention | 1 | 1 | 1 | 1 | 4 |
| UI-18 | Progress / Long Operation UI | 0 | 2 | 2 | 2 | 6 |
| UI-19 | Copy-to-Clipboard | 0 | 0 | 1 | 1 | 2 |
| UI-20 | Empty / First-Run Experience | 0 | 0 | 1 | 1 | 2 |

---

## CRITICAL UI ISSUES

### C-01 — No React Error Boundary — Any Crash = Blank White Screen
**Check:** UI-17 · **File:** [`App.tsx`](apps/web/src/App.tsx:16)
The entire app is `QueryClientProvider > ToastProvider > RouterProvider` with no React error boundary. Any unhandled exception in any component crashes the entire app to a blank white screen with no recovery option.

### C-02 — No Confirmation Dialog Before Deleting a Database
**Check:** UI-4 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:522)
`deleteDb.mutate(database.id)` is called directly without any confirmation dialog. Accidental click on the delete button permanently destroys a database with all its data.

### C-03 — No Confirmation Dialog Before Deleting an FTP Account
**Check:** UI-4 · **File:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:320)
`deleteAccount.mutate(account.id)` is called directly without confirmation. Accidental click removes FTP access immediately.

### C-04 — No Confirmation Dialog Before Deleting a Cron Job
**Check:** UI-4 · **File:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:367)
`deleteJob.mutate(job.id)` is called directly without confirmation. Accidental click removes a scheduled task immediately.

---

## HIGH UI ISSUES

### H-01 — DNS Record Error Handling Uses `alert()` Instead of Inline Error Display
**Check:** UI-1 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:108)
`onError: (e: any) => alert(e.message)` at lines 108, 113, 671, 682. Browser alert dialog interrupts workflow and looks unprofessional.

### H-02 — FTP Change Password Validation Uses `alert()`
**Check:** UI-1 · **File:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:124)
`if (password !== confirm) { alert('Passwords do not match'); return; }` at lines 124-125.

### H-03 — Login Password Field Has No Show/Hide Toggle
**Check:** UI-2 · **File:** [`LoginForm.tsx`](apps/web/src/pages/login/LoginForm.tsx:209)
`type="password"` at line 209 with no toggle button, unlike MailPage which has `<Eye>`/`<EyeOff>` toggle.

### H-04 — CreateUserModal Password Field Has No Show/Hide Toggle
**Check:** UI-2 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:99)
`type="password"` at line 99 with no toggle.

### H-05 — ChangePasswordModal Password Fields Have No Show/Hide Toggle
**Check:** UI-2 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:152)
`type="password"` at lines 152, 167 with no toggle.

### H-06 — DashboardPage Has No Error State with Retry
**Check:** UI-3 · **File:** [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:299)
`if (statsLoading) { return <LoadingSpinner />; }` at line 299 — no `isError` check. If the API is down, the dashboard shows a loading spinner indefinitely.

### H-07 — No Confirmation Before Deleting a Mailbox
**Check:** UI-4 · **File:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx)
`useDeleteMailbox` mutation is called without confirmation. All email will be lost.

### H-08 — No Confirmation Before Deleting a Mail Alias
**Check:** UI-4 · **File:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx)
`useDeleteAlias` mutation is called without confirmation.

### H-09 — No Confirmation Before Deleting a Firewall Rule
**Check:** UI-4 · **File:** [`FirewallPage.tsx`](apps/web/src/pages/firewall/FirewallPage.tsx)
`useDeleteFirewallRule` mutation is called without confirmation. Could lock users out.

### H-10 — Bulk Domain Actions Have No Confirmation Dialog
**Check:** UI-4 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:285)
BulkActionBar at line 285 fires mutations directly without confirmation for suspend/activate/delete.

### H-11 — Most Modals Do Not Close on Backdrop Click or Escape Key
**Check:** UI-5 · **File:** All modals across [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:32), [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:30), [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:180), [`FirewallPage.tsx`](apps/web/src/pages/firewall/FirewallPage.tsx:93), [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:66), [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:54), [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:167)
Modal backdrop `<div className="fixed inset-0 z-50 ... bg-black/50">` has no `onClick={onClose}` handler. Only the X button works.

### H-12 — Page Remains Scrollable Behind Open Modals
**Check:** UI-5 · **File:** All modals across the application
No `useEffect` to toggle `document.body.style.overflow` when modal mounts/unmounts. Users can scroll the background page while a modal is open.

### H-13 — Domain Detail Tabs Fetch All Data Eagerly
**Check:** UI-6 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:329)
Lines 329-338 — `useSubdomains`, `useAliases`, `useRedirects`, `useDomainLogStats` all called unconditionally regardless of which tab is active.

### H-14 — Mail Page Tabs Fetch All Data Eagerly
**Check:** UI-6 · **File:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:409)
Lines 409-411 — `useMailDomainInfo`, `useDkimStatus`, `useMailQueue` all called unconditionally.

### H-15 — Logs Page Instantiates All 6 Log Type Queries Simultaneously
**Check:** UI-6 · **File:** [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:315)
Lines 315-320 — `useAccessLogs`, `useErrorLogs`, `usePanelLogs`, `useFail2banLogs`, `useAuthLogs`, `useSystemLogs` all called unconditionally.

### H-16 — Terminal Auto-Reconnect Uses Fixed 3-Second Delay
**Check:** UI-7 · **File:** [`TerminalPage.tsx`](apps/web/src/pages/terminal/TerminalPage.tsx:32)
Line 32 `RECONNECT_DELAY_MS = 3000` — always 3s, no exponential backoff.

### H-17 — Log WebSocket Has No Auto-Reconnect Logic
**Check:** UI-7 · **File:** [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:395)
Lines 395-401 — `ws.onclose` and `ws.onerror` only set `setWsConnected(false)`. No reconnect attempt.

### H-18 — No Pause Button for Auto-Scroll in Live Log Mode
**Check:** UI-7 · **File:** [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:365)
Lines 365-369 — `useEffect` always scrolls to bottom. User cannot inspect specific lines while streaming.

### H-19 — Sidebar Collapse State Does Not Persist in localStorage
**Check:** UI-8 · **File:** [`Sidebar.tsx`](apps/web/src/components/layout/Sidebar.tsx:97)
Line 97 `const [collapsed, setCollapsed] = useState(false)` — no localStorage read/write.

### H-20 — No Breadcrumb Component Exists
**Check:** UI-8 · **File:** App-wide
No breadcrumb component found in `components/` directory. Users lose context in deep views like domain details, SSL cert details, or database details.

### H-21 — Error Toasts Auto-Dismiss After 5 Seconds
**Check:** UI-9 · **File:** [`Toast.tsx`](apps/web/src/components/ui/Toast.tsx:73)
Line 73 `const duration = toast.duration ?? 5000` — same default for all types including error. Critical error messages may disappear before the user reads them.

### H-22 — Hovering Over a Toast Does Not Pause Auto-Dismiss
**Check:** UI-9 · **File:** [`Toast.tsx`](apps/web/src/components/ui/Toast.tsx:72)
Lines 72-76 — `useEffect` sets a timeout with no pause-on-hover logic.

### H-23 — No Maximum Toast Limit
**Check:** UI-9 · **File:** [`Toast.tsx`](apps/web/src/components/ui/Toast.tsx:107)
Line 107 `setToasts((prev) => [...prev, { ...toast, id }])` — no slice or limit. Unlimited toasts can fill the screen.

### H-24 — Tunnel Setup Step Indicator Not Differentiated
**Check:** UI-11 · **File:** [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:61)
All non-current dots use `bg-primary` — completed, current, and future steps look identical. No checkmark icon for completed steps.

### H-25 — Tunnel Setup Has No Step X of Y Label
**Check:** UI-11 · **File:** [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:59)
Lines 59-74 — Only ambiguous dots shown with no numeric context.

### H-26 — Backup Progress Is Simulated Client-Side, Not Real
**Check:** UI-11 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:46)
Lines 46-63 — Progress steps simulated with `setInterval`. Progress reaches 100% even if server backup is still running or has failed. User sees "Backup created successfully!" when the real backup may not be done.

### H-27 — SSL Issuance Progress Is Simulated Before API Call
**Check:** UI-11 · **File:** [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:134)
Lines 134-148 — `simulateProgress()` resolves first, then `issueLE.mutate` is called. If API fails after simulation completes, UI already shows "Complete!".

### H-28 — File Editor Uses Plain Textarea Instead of CodeEditor Component
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:115)
Lines 115-119 — Built-in `FileEditor` uses a plain `<textarea>` with no syntax highlighting. The separate `CodeEditor` component in `components/files/CodeEditor.tsx` has CodeMirror but is never used.

### H-29 — File Editor Has No Unsaved Changes Warning
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:105)
Line 105 — Clicking the back arrow immediately exits the editor without checking if content has been modified.

### H-30 — No Double-Click to Open Folders in File Manager
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:666)
Lines 666-667 — Single-clicking toggles selection. Folders can only be opened via a small chevron button. Double-click does nothing different.

### H-31 — Server Settings Form State Not Initialized from Server Data
**Check:** UI-14 · **File:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:225)
Pattern `value={hostname || identityData?.hostname || ''}` at lines 225, 253, 269, 399, 409, 513, 541, 676-699. If user clears a field to empty string, it falls back to server data and appears uneditable. Actual state starts as `''` and is never initialized from API data.

### H-32 — No Dark/Light Theme Toggle
**Check:** UI-15 · **File:** [`App.tsx`](apps/web/src/App.tsx) + layout
CSS variables for dark mode are defined in `index.css` (lines 25-43) and Tailwind is configured with `darkMode: 'class'`, but there is no UI to activate dark mode and no localStorage persistence.

### H-33 — Alert Rules Stored Only in React State, Lost on Navigation
**Check:** UI-16 · **File:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:747)
`AlertRulesSection` stores rules in `useState` with no API persistence. Rules are lost when user navigates away.

### H-34 — No `errorComponent` on Any Route
**Check:** UI-17 · **File:** [`router.tsx`](apps/web/src/router.tsx:33)
TanStack Router supports per-route `errorComponent` for route-level error boundaries, but none are configured.

### H-35 — `setInterval` in `useState` Initializer Causes Memory Leak
**Check:** UI-18 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:51)
`BackupProgressModal` starts `setInterval` inside `useState` initializer. The interval is never cleaned up on unmount.

### H-36 — No Progress UI During App Installation
**Check:** UI-18 · **File:** [`InstallerPage.tsx`](apps/web/src/pages/installer/InstallerPage.tsx:619)
`handleInstall` closes the modal immediately after the install mutation starts. User has no indication that installation is in progress.

---

## MEDIUM UI ISSUES

### M-01 — Cron Job Run Failure Uses `alert()` for Error Feedback
**Check:** UI-1 · **File:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:388)
`onError: () => alert('Failed to run job')` at line 388.

### M-02 — Mail Catch-All Update Uses `alert()` for Success
**Check:** UI-1 · **File:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:778)
`onSuccess: () => alert('Catch-all address updated.')` at line 778.

### M-03 — Alert Rule Deletion Uses `window.confirm()`
**Check:** UI-1 · **File:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:865)
`if (confirm('Delete rule "${rule.name}"?'))` at line 865.

### M-04 — Config Import Error Uses `alert()`
**Check:** UI-1 · **File:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1287)
`alert('Invalid JSON file. Please select a valid panel configuration file.')` at line 1287.

### M-05 — FTP CreateAccountModal Password Has No Show/Hide Toggle
**Check:** UI-2 · **File:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:44)
`type="password"` at line 44 with no toggle.

### M-06 — FTP ChangePasswordModal Password Fields Have No Show/Hide Toggle
**Check:** UI-2 · **File:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:147)
`type="password"` at lines 147, 153 with no toggle.

### M-07 — ProfilePage Password Change Fields Have No Show/Hide Toggle
**Check:** UI-2 · **File:** [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:210)
`type="password"` at lines 150, 210, 220, 234, 337 with no toggle.

### M-08 — BackupsPage Encryption Password Has No Show/Hide Toggle
**Check:** UI-2 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:198)
`type="password"` at line 198 with no toggle.

### M-09 — InstallerPage Admin Password Has No Show/Hide Toggle
**Check:** UI-2 · **File:** [`InstallerPage.tsx`](apps/web/src/pages/installer/InstallerPage.tsx:397)
`type="password"` at line 397 with no toggle.

### M-10 — CreateDbModal Not Wrapped in `<form>` Element
**Check:** UI-2 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:17)
Modal at lines 31-68 uses `<div>` containers and `onClick={handleSubmit}` instead of `<form onSubmit={handleSubmit}>`. Pressing Enter does not submit.

### M-11 — CreateUserModal Not Wrapped in `<form>` Element
**Check:** UI-2 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:71)
Modal at lines 86-118 uses `onClick={handleSubmit}` instead of `<form onSubmit>`.

### M-12 — CreateJobModal Not Wrapped in `<form>` Element
**Check:** UI-2 · **File:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:155)
Modal at lines 179-250 uses `onClick={handleSubmit}` instead of `<form onSubmit>`.

### M-13 — MonitoringPage Has No Error State Rendered
**Check:** UI-3 · **File:** [`MonitoringPage.tsx`](apps/web/src/pages/monitoring/MonitoringPage.tsx:660)
`isError` from `useServerStats` is fetched but never rendered (line 610).

### M-14 — WebserverPage Has No Error State or Empty State
**Check:** UI-3 · **File:** [`WebserverPage.tsx`](apps/web/src/pages/webserver/WebserverPage.tsx:337)
`if (statusLoading) return <LoadingSpinner />;` at line 337 — no error/empty handling.

### M-15 — PhpPage Has No Error State
**Check:** UI-3 · **File:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:302)
`if (versionsLoading) return <LoadingSpinner />;` at line 302 — no error handling.

### M-16 — ProfilePage Has No Loading State
**Check:** UI-3 · **File:** [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:53)
ProfileSection reads directly from `useAuthStore()` with no loading guard. Brief flash of empty content before store hydrates.

### M-17 — Reboot/Shutdown Only Single Confirmation
**Check:** UI-4 · **File:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1183)
`ConfirmModal` at lines 1183-1202 only requires one confirmation click. Should be double confirmation for server-level operations.

### M-18 — DNS Record Deletion Has No Confirmation Dialog
**Check:** UI-4 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:669)
`handleDeleteRecord` at line 669 calls delete mutation directly.

### M-19 — DNS Zone Reset Uses Inline Confirm, Not Modal
**Check:** UI-4 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:737)
Inline confirm at line 737 — no modal, just a button that appears.

### M-20 — File/Folder Deletion Has No Confirmation Dialog
**Check:** UI-4 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:443)
`handleDelete` at line 443 calls delete mutation directly.

### M-21 — CreateDbModal Form Fields Not Reset on Error Close
**Check:** UI-5 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:17)
`onClose()` is called in `onSuccess` but there is no reset on manual close. Reopening shows old failed values.

### M-22 — TunnelsPage Setup Modal Has No X Close Button on Initial Step
**Check:** UI-5 · **File:** [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:53)
Modal at line 53 has `<h2>` but no close button.

### M-23 — Nested Modals Have z-Index Conflicts
**Check:** UI-5 · **File:** Multiple modals
Both nested modals use `z-50` — no z-index escalation for confirmation modals on top of other modals.

### M-24 — Tab Navigation Has No Keyboard Support or ARIA Roles
**Check:** UI-6 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:378)
Lines 378-390 — tabs are plain `<button>` elements with no `role="tablist"`, `role="tab"`, `role="tabpanel"`, or `onKeyDown` handler.

### M-25 — Tab Navigation Has No Count Badges
**Check:** UI-6 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:378)
Lines 379-389 — tab labels are plain text with no count indicators.

### M-26 — Mail Page Tab Navigation Has No Keyboard Support
**Check:** UI-6 · **File:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:526)
Lines 526-538 — plain buttons with no ARIA attributes or keyboard handlers.

### M-27 — Dashboard Has No WebSocket Disconnect Indicator
**Check:** UI-7 · **File:** [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:269)
Lines 269-276 — polling hooks with no error/disconnect state shown. Stale data displayed silently.

### M-28 — CPU Sparkline Has No Error Handling for Stale Data
**Check:** UI-7 · **File:** [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:158)
Lines 164-187 — `setInterval` collects data every 5s but has no error handling for stale values.

### M-29 — Notification Dropdown Does Not Close on Escape Key
**Check:** UI-9 · **File:** [`TopBar.tsx`](apps/web/src/components/layout/TopBar.tsx:89)
Lines 89-101 — only `mousedown` event listener for outside click. No `keydown` listener for Escape.

### M-30 — Mark All Read Is Not Optimistic
**Check:** UI-9 · **File:** [`TopBar.tsx`](apps/web/src/components/layout/TopBar.tsx:131)
Line 131 `markAllRead.mutate()` — standard mutation, no `onMutate` optimistic update.

### M-31 — Domain Search Input Has No Debounce
**Check:** UI-10 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:825)
Line 827 `onChange={(e) => setSearch(e.target.value)}` — direct state update, no debounce.

### M-32 — Domain Search Input Has No Clear Button
**Check:** UI-10 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:825)
Lines 823-830 — search input has no clear/reset button.

### M-33 — Domain Table Columns Are Not Sortable
**Check:** UI-10 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:844)
Lines 846-862 — table headers are plain `<th>` elements with no click handlers or sort state.

### M-34 — Domain List Has No Pagination
**Check:** UI-10 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:844)
Lines 864-963 — `filtered.map()` renders all results with no pagination.

### M-35 — Database Table Has No Search, Sorting, or Pagination
**Check:** UI-10 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:566)
Lines 566-599 — plain table with no interactive features.

### M-36 — SSL Certificate Search Has No Debounce or Clear Button
**Check:** UI-10 · **File:** [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:910)
Line 913 `onChange={e => setSearch(e.target.value)}` — direct state update.

### M-37 — Tunnel Setup Has No Retry Button on Failure
**Check:** UI-11 · **File:** [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:89)
Lines 89-94 — error is displayed but no dedicated "Retry" button.

### M-38 — Tunnel Setup Has No Completion Summary
**Check:** UI-11 · **File:** [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:50)
Line 50 — modal closes via `onClose` on success. No confirmation message or summary.

### M-39 — File Editor Save Button Not Disabled When Unchanged
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:110)
Line 110 — Save only disabled during saving (`disabled={isSaving}`), not when content is unchanged.

### M-40 — File Manager Has No Ctrl+Click or Shift+Click Multi-Select
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:520)
Lines 520-529 — `toggleSelectItem` always toggles single items without checking modifier keys.

### M-41 — No Click Empty Area to Deselect in File Manager
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:643)
Lines 643-716 — no handler on table/container for clicking empty space.

### M-42 — Upload Shows Overall Progress, Not Per-File
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:205)
Line 205 `((i + 1) / files.length) * 100` — overall percentage, not per-file.

### M-43 — No Cancel Button During File Upload
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:196)
Lines 196-221 — no abort mechanism once upload starts.

### M-44 — No Overwrite Detection or Prompt During Upload
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:196)
Lines 196-206 — files with same name are silently overwritten.

### M-45 — Permissions Editor Has No Checkbox UI
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:129)
Lines 129-154 — only preset buttons and octal input. No read/write/execute checkboxes per owner/group/others.

### M-46 — PhpIniEditor Has No Minimum Row Enforcement
**Check:** UI-13 · **File:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:59)
Lines 59-61 — all directives can be removed, leaving zero rows.

### M-47 — PhpIniEditor Has No Per-Row Validation
**Check:** UI-13 · **File:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:90)
Lines 90-115 — empty keys and duplicate keys are not detected.

### M-48 — Server Settings Save Buttons Always Enabled
**Check:** UI-14 · **File:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:237)
Lines 237, 422, 465, 524, 631, 705 — most Save buttons don't check if values actually changed.

### M-49 — ProfilePage Save Profile Always Enabled
**Check:** UI-14 · **File:** [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:123)
Lines 123-129 — always enabled (only disabled during pending). No change detection.

### M-50 — InstallerPage Uses Hardcoded Light-Mode Colors
**Check:** UI-15 · **File:** [`InstallerPage.tsx`](apps/web/src/pages/installer/InstallerPage.tsx:37)
Lines 37-56, 116-117, 127-131, 149-153 — `CATEGORY_COLORS` and status badges use hardcoded `bg-purple-100 text-purple-700` etc.

### M-51 — ProfilePage Uses Hardcoded Light-Mode Colors
**Check:** UI-15 · **File:** [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:321)
Lines 321, 459, 603-624 — 2FA badges and API token box use `bg-green-100 text-green-800` etc.

### M-52 — PhpPage Uses Hardcoded Light-Mode Colors
**Check:** UI-15 · **File:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:543)
Lines 543-545 — security function buttons use `border-red-300 bg-red-50 text-red-600`.

### M-53 — WebserverPage Uses Hardcoded Light-Mode Colors
**Check:** UI-15 · **File:** [`WebserverPage.tsx`](apps/web/src/pages/webserver/WebserverPage.tsx:375)
Line 375 — config test result uses `bg-green-50 text-green-700` and `bg-red-50 text-red-700`.

### M-54 — CodeMirror Always Uses Dark Theme Regardless of App Theme
**Check:** UI-15 · **File:** [`CodeEditor.tsx`](apps/web/src/components/files/CodeEditor.tsx:175)
Line 175 `theme={oneDark}` — always dark, jarring in light mode.

### M-55 — File Manager Sidebar Has Fixed Width, Not Responsive
**Check:** UI-15 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:605)
Line 605 — `w-64` (256px) fixed width with no collapse mechanism. Unusable on mobile.

### M-56 — Tables Lack Horizontal Scroll Wrappers
**Check:** UI-15 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:825), [`FirewallPage.tsx`](apps/web/src/pages/firewall/FirewallPage.tsx:551)
Tables overflow viewport on small screens instead of scrolling horizontally.

### M-57 — LoginPage Uses `window.location.href` Instead of Router Navigation
**Check:** UI-16 · **File:** [`LoginPage.tsx`](apps/web/src/pages/login/LoginPage.tsx:19)
Bypasses TanStack Router, causes full page reload.

### M-58 — No Redirect When Domain Deleted While Viewing Detail
**Check:** UI-16 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:328)
`DomainDetail` has no mechanism to detect that its domain was deleted.

### M-59 — SMTP Settings Are Frontend-Only Simulation
**Check:** UI-16 · **File:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:316)
`SmtpSettingsSection` uses `setTimeout` to simulate API calls. Config saved to localStorage, not backend.

### M-60 — RawZoneModal Close Uses `window.location.reload()`
**Check:** UI-17 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:286)
Close button calls `window.location.reload()` instead of `onClose` callback.

### M-61 — SSL Issuance Progress Is Simulated, Not Connected to Server
**Check:** UI-18 · **File:** [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:111)
`simulateProgress()` uses `setInterval` to fake progress from 0→100%.

### M-62 — No Cancel Option During SSL Certificate Issuance
**Check:** UI-18 · **File:** [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:84)
Once SSL issuance starts, user cannot cancel it.

### M-63 — No Cancel Option During Backup Creation
**Check:** UI-18 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:46)
`BackupProgressModal` has no cancel button.

### M-64 — No HTTPS Fallback for `navigator.clipboard`
**Check:** UI-19 · **File:** Multiple files — `ApiTokensPage.tsx`, `ProfilePage.tsx`, `InstallerPage.tsx`, `FtpPage.tsx`, `MailPage.tsx`, `DatabasesPage.tsx`
All clipboard operations use `navigator.clipboard.writeText()` which fails silently over HTTP.

### M-65 — No Getting-Started Card for First-Run Experience
**Check:** UI-20 · **File:** [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:268)
Dashboard immediately shows server stats with no guidance for new users.

---

## LOW UI ISSUES

### L-01 — CreateDbModal Error Display May Show `[object Object]`
**Check:** UI-2 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:58)
`{String(createDb.error)}` at line 58 — may show cryptic error messages.

### L-02 — Multiple Modals Error Display Uses `String(error)`
**Check:** UI-2 · **File:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:60), [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:244), [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:211)
`String(create.error)`, `String(update.error)`, etc. may show `[object Object]`.

### L-03 — ServerSettingsPage Sections Show No Error State
**Check:** UI-3 · **File:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:204)
Each section has `if (isLoading) return <LoadingSpinner />;` but no error check.

### L-04 — Domain Suspend Action Has No Confirmation
**Check:** UI-4 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx)
Suspend action in domain row actions fires immediately.

### L-05 — BackupProgressModal Cannot Be Closed Until Complete
**Check:** UI-5 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:46)
X button only renders when `complete` is true at line 71.

### L-06 — Tab State Not Synced to URL
**Check:** UI-6 · **File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:340)
Line 340 `const [tab, setTab] = useState<...>('overview')` — local state only. Refreshing loses tab selection.

### L-07 — WebSocket Reconnect Effect Has Missing Dependencies
**Check:** UI-6 · **File:** [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:447)
Lines 443-447 — `useEffect` depends on `activeTab` and `selectedDomainId` but not on `connectWs`/`disconnectWs`.

### L-08 — Sidebar Nav Items Have No `aria-current` Attribute
**Check:** UI-8 · **File:** [`Sidebar.tsx`](apps/web/src/components/layout/Sidebar.tsx:135)
Lines 135-149 — active state is visual only (CSS classes), no ARIA attributes.

### L-09 — NotificationPage Toasts Have Fixed 5s Auto-Dismiss, No Hover Pause
**Check:** UI-9 · **File:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:898)
Lines 19-22 — `setTimeout(onClose, 5000)` with no pause-on-hover.

### L-10 — Notification History Has Fixed Page Size of 10
**Check:** UI-10 · **File:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:72)
Line 72 `const PAGE_SIZE = 10` — hardcoded.

### L-11 — Mailbox and Alias Tables Have No Sorting, Search, or Pagination
**Check:** UI-10 · **File:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:555)
Lines 555-654 — plain table rendering with no interactive features.

### L-12 — SSL Issuance Progress Shows No Step X of Y Label
**Check:** UI-11 · **File:** [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:40)
Lines 40-77 — step numbers shown but no "Step X of Y" text or percentage.

### L-13 — File Manager Has No Up-One-Level Button
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:624)
Lines 624-635 — breadcrumb works but no dedicated up-arrow button.

### L-14 — File Manager Has No Internal Drag-and-Drop Move
**Check:** UI-12 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx)
No drag handlers on file rows for internal move operations.

### L-15 — PhpIniEditor New Row Does Not Auto-Focus
**Check:** UI-13 · **File:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:52)
Lines 52-56 — new directive row does not receive focus.

### L-16 — PhpIniEditor Has No Drag-to-Reorder
**Check:** UI-13 · **File:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:79)
Lines 79-118 — order matters in php.ini but no reordering capability.

### L-17 — DNS Records Edited One at a Time, No Inline Multi-Edit
**Check:** UI-13 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:787)
Lines 787-796 — editing multiple records requires opening/closing form for each.

### L-18 — No Keep Current Option for Sensitive Fields
**Check:** UI-14 · **File:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:594), [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1088)
Cloudflare API token and SSL email fields start empty with no indication that blank = keep current.

### L-19 — No SMTP or Storage Connection Test Buttons
**Check:** UI-14 · **File:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx)
No test buttons in any settings section.

### L-20 — Many Input Fields and Buttons Lack Visible Focus Indicators
**Check:** UI-15 · **File:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:118), [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:130)
Most inputs have `focus:outline-none` without a replacement ring. Buttons have no `focus-visible` styling.

### L-21 — No Focus Trap in Modals
**Check:** UI-15 · **File:** All modals
Tab key can move focus to elements behind the modal overlay.

### L-22 — No Skip-to-Content Link
**Check:** UI-15 · **File:** [`AppLayout.tsx`](apps/web/src/components/layout/AppLayout.tsx)
No mechanism to jump past sidebar navigation to main content.

### L-23 — Render-Time Side Effects for Form Initialization
**Check:** UI-16 · **File:** Multiple files — `ServerSettingsPage.tsx`, `FtpPage.tsx`, `MailPage.tsx`, `DnsPage.tsx`, `FirewallPage.tsx`
Patterns like `if (!initialized && data) { setForm(...); setInitialized(true); }` during render should use `useEffect`.

### L-24 — Invalid Date Handling — `new Date()` with Malformed Input
**Check:** UI-17 · **File:** Multiple — `DashboardPage.tsx`, `CronPage.tsx`, `FirewallPage.tsx`, `AuditPage.tsx`, `TopBar.tsx`
Many places call `new Date(timestamp).toLocaleString()` without validation, rendering "Invalid Date".

### L-25 — Backup Progress Is Simulated, Not Real
**Check:** UI-18 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:51)
Progress bar advances on timer, not connected to actual backup progress.

### L-26 — No Progress Indicator During Cron Job Execution
**Check:** UI-18 · **File:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:385)
`handleRun` calls `run.mutate()` with no loading indicator.

### L-27 — Database Copy Results Has No Visual Feedback
**Check:** UI-19 · **File:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:258)
`handleCopyResults` calls `navigator.clipboard.writeText` but provides no "Copied!" feedback.

### L-28 — No Explicit Empty State for Empty Backup List
**Check:** UI-20 · **File:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:531)
Backups tab iterates over `backups.map(...)` but shows nothing if list is empty.

### L-29 — `markAllRead` Is Not Optimistic
**Check:** UI-16 · **File:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:890)
Mutation waits for server response before updating unread count.

---

## WHAT IS WORKING CORRECTLY

### Interactive Elements (UI-1)
- All `<button>` elements across all pages have onClick handlers
- All `<Link>` components in Sidebar have valid `to` destinations
- All `<form>` elements have onSubmit handlers
- All `<input>`, `<select>`, `<textarea>` elements have onChange handlers
- All toggle switches have onClick handlers
- No buttons with empty `onClick={() => {}}` found

### Form Completeness (UI-2)
- Login form: controlled inputs, submit disabled while loading, error display
- TwoFactorForm: auto-submit on completion, submit disabled while loading
- CreateDomainForm: controlled inputs, submit disabled while loading
- DomainsPage DeleteConfirm: controlled input with validation
- MailPage MailboxFormModal: password show/hide toggle
- ApiTokensPage CreateTokenModal: wrapped in `<form>`, onSubmit handler, disabled while pending
- DatabasesPage ChangePasswordModal: controlled inputs, validation, disabled while pending
- ProfilePage forms: controlled inputs, submit disabled while pending, success feedback
- Most modals close on success and show errors inline

### Render States (UI-3)
- DomainsPage, DatabasesPage, FtpPage, CronPage, MailPage, SslPage, DnsPage, FirewallPage, BackupsPage, AuditPage, NotificationsPage, TunnelsPage, ApiTokensPage — all have LoadingSpinner, EmptyState, and populated data views

### Destructive Action Confirmations (UI-4)
- Delete Domain: Level 3 type-to-confirm dialog
- Delete SSL Certificate: Level 2 confirmation dialog
- Revoke API Token: Level 2 confirmation dialog
- Reset Firewall Rules: Level 2 confirmation modal
- Toggle Firewall On/Off: Level 2 confirmation modal
- Reboot/Shutdown Server: Level 4 confirmation modal
- Delete Tunnel: Level 2 confirmation
- Restore Backup: Level 2 confirmation modal

### Modal Lifecycle (UI-5)
- Most modals have X close buttons
- Most modals use `bg-black/50` backdrop overlay
- Edit modals pre-fill with current values
- Form fields reset on close in most modals
- Toast notifications shown on success in many modals
- AuditPage detail modal supports backdrop click to close

### Tab Navigation (UI-6)
- Tab visual distinction with primary color styling
- Back navigation in detail views
- External links use `target="_blank" rel="noopener noreferrer"`

### Real-Time UI (UI-7)
- Terminal WebSocket connection states with visual indicators
- Terminal cursor blink and resize handling
- Terminal paste from clipboard
- Dashboard CPU sparkline with time range selector
- Tunnels live logs with WebSocket streaming
- Terminal multi-tab support with independent connections
- Terminal session timeout with warning banner

### Sidebar and Navigation (UI-8)
- Sidebar active state from URL via TanStack Router `matchRoute`

### Notifications and Toasts (UI-9)
- Notification bell badge with 99+ cap
- Notification dropdown outside click close
- Toast stacking in bottom-right corner with proper z-index
- LogsPage search debounce (300ms) with clear button
- LogsPage live mode with WebSocket streaming
- LogsPage date range filters
- NotificationsPage pagination and type filter
- Domain bulk actions with checkbox selection
- Dangerous action styling consistent across pages

### Multi-Step Flows (UI-11)
- TunnelsPage SetupModal: Next button disabled until valid, Back preserves data
- SslPage IssuanceProgress: Completed steps show checkmarks, active step shows spinner
- BackupsPage BackupProgressModal: Progress bar with percentage, step indicators
- InstallerPage PostInstallChecklist: Comprehensive checklist with copy functionality

### File Manager (UI-12)
- Breadcrumb navigation with clickable segments
- Right-click context menu with full options
- Clipboard operations (copy/cut/paste) with visual indicator
- Bulk selection with select-all toggle
- File preview modals (image, video, PDF, archive)
- Directory tree sidebar with expand/collapse
- Preferences persistence in localStorage
- Upload drag-and-drop zone
- Auto-extract archives on upload

### Dynamic Fields (UI-13)
- PhpIniEditor add/remove rows work correctly
- DnsPage RecordForm type-dependent validation
- Priority field shown only for MX/SRV records

### Settings Logic (UI-14)
- PanelPortSection: correct `initialized` pattern, save disabled when unchanged
- DefaultWebServerSection: correct change detection
- DataRetentionSection: proper initialization from server data
- ProfilePage PasswordSection: match and length validation
- ProfilePage 2FA: full setup flow with QR code, verification, backup codes
- WebserverPage: dependent fields show/hide correctly
- SslPage IssueModal: wildcard toggle shows DNS provider selection
- BackupsPage CreateBackupModal: encryption toggle shows password field

### Theme and CSS Architecture (UI-15)
- Complete light and dark CSS variable sets defined
- Tailwind configured with `darkMode: 'class'` and semantic color tokens
- Most components use semantic classes (`bg-primary`, `text-muted-foreground`, etc.)
- Responsive grids used in ServerSettingsPage, ProfilePage, PhpPage
- TopBar hides user details on small screens

### Global State (UI-16)
- Auth store logout properly clears all state fields
- AuthGuard correctly redirects to `/login` via `<Navigate>`
- Extensive null safety with optional chaining throughout
- Division-by-zero guard in DashboardPage ProgressBar
- Most mutations show errors via inline display or `toast.error()`

### Error Handling (UI-17)
- Mutation loading states correctly disable buttons and show pending text

### Progress UI (UI-18)
- TunnelsPage setup wizard has proper creating step with spinner
- TunnelsPage live logs use WebSocket for real-time streaming
- Mutation loading states show "Saving...", "Creating...", etc.

### Copy-to-Clipboard (UI-19)
- Consistent copy pattern with 2-second "Copied" revert across ApiTokensPage, ProfilePage, InstallerPage, FtpPage, MailPage
- One-time warning for sensitive data in TokenCreatedModal

### Empty States (UI-20)
- Comprehensive `<EmptyState>` usage in DomainsPage, DatabasesPage, CronPage, FtpPage, MailPage, DnsPage, FirewallPage, TunnelsPage, SslPage, AuditPage, ApiTokensPage, NotificationsPage

---

## IMPOSSIBLE UI STATES FOUND

These are states that can be reached but shouldn't be possible:

1. **Backup "Created Successfully" when backup failed** — [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:109) — simulated progress continues to completion regardless of actual server state. User sees success message for a failed backup.

2. **SSL "Complete!" when certificate was not issued** — [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:134) — `simulateProgress()` resolves before the API call. If API fails, UI already shows completion.

3. **Progress bar at 100% while server operation still running** — Both backup and SSL progress modals show 100% completion based on client-side timers, not actual server progress.

4. **Settings form appears editable but changes are discarded** — [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:225) — `value={hostname || identityData?.hostname || ''}` pattern makes fields appear pre-filled but state is empty. Submitting without touching fields sends empty values.

5. **Dashboard shows stale data with no warning** — [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:269) — polling failures are silent. User sees old stats believing they are current.

6. **Domain detail view shows deleted domain** — [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:328) — no mechanism to redirect when the domain being viewed is deleted.

7. **Alert rules exist in UI but are never persisted** — [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:747) — rules appear saved but vanish on navigation.

8. **SMTP settings appear saved but are client-side only** — [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:316) — simulated save gives false confidence.

---

## DEAD UI ELEMENTS FOUND

These are buttons, links, or forms that exist but do nothing or are never used:

1. **CodeEditor component is never used** — [`CodeEditor.tsx`](apps/web/src/components/files/CodeEditor.tsx) — Full CodeMirror editor with syntax highlighting exists but `FilesPage` uses a plain `<textarea>` instead.

2. **Dark mode CSS variables are defined but unreachable** — [`index.css`](apps/web/src/index.css:25) — Complete dark mode variable set exists but no toggle mechanism activates the `dark` class.

3. **SSL progress steps have no real server connection** — [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:111) — `simulateProgress()` is purely cosmetic. The actual progress steps don't reflect server state.

4. **Backup progress steps have no real server connection** — [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:51) — Same as SSL, purely simulated.

---

## MISSING UI STATES

These are states that should exist but don't:

1. **Error recovery state on Dashboard** — No retry button when stats fail to load
2. **Error recovery state on MonitoringPage** — `isError` fetched but not rendered
3. **Error recovery state on WebserverPage** — No error or empty state
4. **Error recovery state on PhpPage** — No error state
5. **Global error boundary fallback** — No recovery UI when the app crashes
6. **Route-level error boundaries** — No per-route error components
7. **First-run getting-started experience** — Dashboard shows raw stats with no guidance
8. **Backup list empty state** — Missing `<EmptyState>` component
9. **Loading indicator during cron job execution** — No feedback while job runs
10. **Loading indicator during app installation** — Modal closes with no progress shown
11. **Cancel state during SSL issuance** — No way to abort
12. **Cancel state during backup creation** — No way to abort
13. **Cancel state during file upload** — No abort mechanism
14. **Overwrite confirmation during file upload** — Silent overwrite
15. **Disconnect warning on dashboard** — Stale data shown silently
16. **Theme toggle state** — No way to switch between light and dark mode

---

## INCONSISTENCIES ACROSS THE APP

### Password Show/Hide Toggle
- **Has toggle:** MailPage MailboxFormModal (lines 139-144)
- **Missing toggle:** LoginForm, DatabasesPage (2 modals), FtpPage (2 modals), ProfilePage, BackupsPage, InstallerPage — **8 password fields without toggle**

### Modal Close Behavior
- **Closes on backdrop click:** AuditPage detail modal
- **Does not close on backdrop click:** All modals in DatabasesPage, FtpPage, CronPage, FirewallPage, BackupsPage, TunnelsPage, SslPage

### Error Feedback Method
- **Inline error display:** Most forms
- **`alert()` calls:** DnsPage (4 instances), FtpPage (1), CronPage (1), MailPage (1), ServerSettingsPage (1)
- **`window.confirm()`:** NotificationsPage (1)

### Confirmation Dialog Pattern
- **Level 3 type-to-confirm:** Domain deletion
- **Level 2 confirmation modal:** SSL delete, token revoke, firewall reset, tunnel delete, backup restore
- **No confirmation at all:** Database delete, FTP delete, cron delete, mailbox delete, alias delete, firewall rule delete, DNS record delete, file delete, bulk domain actions

### Form Submission Pattern
- **`<form onSubmit>`:** LoginForm, TwoFactorForm, ApiTokensPage CreateTokenModal
- **`onClick` on button (no form):** DatabasesPage CreateDbModal, CreateUserModal, CronPage CreateJobModal

### Error Display Format
- **Extracts `.message`:** Some modals
- **`String(error)` — may show `[object Object]`:** DatabasesPage, FtpPage, CronPage, BackupsPage

### Search Input Pattern
- **Has debounce + clear button:** LogsPage
- **No debounce, no clear button:** DomainsPage, SslPage

### Table Features
- **Has pagination:** NotificationsPage, AuditPage
- **No pagination:** DomainsPage, DatabasesPage, MailPage mailbox/alias tables

### Settings Change Detection
- **Tracks original values, disables Save when unchanged:** PanelPortSection, DefaultWebServerSection
- **Save always enabled:** PanelSettingsSection, BackupSettingsSection, SessionPasswordSettingsSection, ProfileSection

### Color System
- **Uses semantic CSS variables:** Most components
- **Uses hardcoded light-mode colors:** InstallerPage, ProfilePage (badges), PhpPage, WebserverPage

### State Persistence
- **Persisted to localStorage:** File manager preferences, auth store
- **Not persisted:** Sidebar collapse state, alert rules, SMTP settings, tab selection

---

## RECOMMENDED FIX ORDER

### Tier 1 — Critical Safety (fix immediately)

| # | Issue | ID | Files |
|---|-------|----|-------|
| 1 | Add React error boundary with recovery UI | C-01 | `App.tsx` |
| 2 | Add confirmation dialog for database deletion | C-02 | `DatabasesPage.tsx` |
| 3 | Add confirmation dialog for FTP account deletion | C-03 | `FtpPage.tsx` |
| 4 | Add confirmation dialog for cron job deletion | C-04 | `CronPage.tsx` |

### Tier 2 — High-Impact UX (fix next)

| # | Issue | ID | Files |
|---|-------|----|-------|
| 5 | Add backdrop click + Escape close to all modals | H-11 | All modal files |
| 6 | Prevent body scroll behind open modals | H-12 | All modal files |
| 7 | Fix error toast persistence — do not auto-dismiss errors | H-21 | `Toast.tsx` |
| 8 | Add hover-pause to toast auto-dismiss | H-22 | `Toast.tsx` |
| 9 | Enforce max 5 visible toasts | H-23 | `Toast.tsx` |
| 10 | Add error state with retry to DashboardPage | H-06 | `DashboardPage.tsx` |
| 11 | Add route-level error components | H-34 | `router.tsx` |
| 12 | Replace all `alert()`/`confirm()` with proper UI | H-01, H-02 | `DnsPage.tsx`, `FtpPage.tsx` + 4 more |

### Tier 3 — Data Integrity (fix soon)

| # | Issue | ID | Files |
|---|-------|----|-------|
| 13 | Fix backup progress simulation — connect to real server state | H-26 | `BackupsPage.tsx` |
| 14 | Fix SSL progress simulation — drive from API response | H-27 | `SslPage.tsx` |
| 15 | Fix settings form initialization from server data | H-31 | `ServerSettingsPage.tsx` |
| 16 | Add confirmation for mailbox, alias, firewall rule deletion | H-07, H-08, H-09 | `MailPage.tsx`, `FirewallPage.tsx` |
| 17 | Add confirmation for bulk domain actions | H-10 | `DomainsPage.tsx` |
| 18 | Persist alert rules to backend API | H-33 | `NotificationsPage.tsx` |
| 19 | Fix setInterval memory leak in BackupProgressModal | H-35 | `BackupsPage.tsx` |
| 20 | Add unsaved changes warning to file editor | H-29 | `FilesPage.tsx` |
