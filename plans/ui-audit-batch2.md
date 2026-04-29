# UI Audit — Batch 2: Checks UI-6 to UI-10

**Date:** 2026-04-28  
**Auditor:** Architect Mode  
**Scope:** Tab navigation, real-time UI, sidebar/nav, notifications/toasts, data tables

---

## WHAT IS WORKING CORRECTLY

1. **Tab visual distinction** — All tab implementations (DomainsPage, MailPage, LogsPage, NotificationsPage, TerminalPage) clearly highlight the active tab with primary color styling and visual indicators.

2. **Terminal WebSocket connection states** — TerminalPage shows Connected/Disconnected/Reconnecting overlays with visual indicators (green pulse, red dot, yellow pulse) and attempt counters.

3. **Terminal cursor and resize** — xterm.js configured with `cursorBlink: true`, `cursorStyle: 'block'` (line 222). Resize handled via FitAddon + ResizeObserver (lines 323-347). Paste from clipboard implemented (lines 380-389).

4. **Sidebar active state from URL** — Uses TanStack Router `matchRoute` with fuzzy matching for sub-pages (Sidebar.tsx:133). Root path uses exact match.

5. **Back navigation** — DomainDetail, CertDetail, and DbDetailModal all have back buttons that correctly restore the previous view.

6. **External links** — Domain external links and webmail links correctly use `target="_blank" rel="noopener noreferrer"`.

7. **Notification bell badge** — TopBar accurately shows unread count with 99+ cap (TopBar.tsx:115-118). Polls via `useUnreadCount`.

8. **Notification dropdown outside click** — TopBar correctly closes dropdown on outside mousedown (TopBar.tsx:89-101).

9. **Toast stacking** — Toasts stack vertically in bottom-right corner with proper z-index (Toast.tsx:123).

10. **LogsPage search debounce** — 300ms debounce on search input (LogsPage.tsx:354-362) with clear button (lines 715-725).

11. **LogsPage live mode** — "Live" badge with green pulse indicator, WebSocket streaming, search/filter while streaming all work.

12. **LogsPage date range filters** — Client-side date filtering with multiple log format support (ISO, Apache, syslog).

13. **NotificationsPage pagination** — Prev/Next pagination with page indicator (NotificationsPage.tsx:286-309).

14. **NotificationsPage type filter** — Filter by notification type with pill-style buttons (lines 199-219).

15. **Domain bulk actions** — Checkbox selection with select-all, bulk suspend/activate/delete bar (DomainsPage.tsx:696-990).

16. **Dangerous action styling** — Delete buttons consistently use `hover:bg-destructive/10 hover:text-destructive` pattern across all pages.

17. **Terminal multi-tab support** — Multiple terminal sessions with independent WebSocket connections, tab status indicators, and close/switch behavior.

18. **Terminal session timeout** — Configurable timeout with warning banner and extend button (TerminalPage.tsx:349-414).

19. **Dashboard CPU sparkline** — SVG-based sparkline graph with time range selector (1h/6h/24h) and data point collection (DashboardPage.tsx:158-263).

20. **Tunnels live logs** — WebSocket-driven log streaming with auto-scroll and connection status indicator (TunnelsPage.tsx:393-563).

---

## ISSUES

### UI-HIGH-6-01
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:329)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: All tab data (subdomains, aliases, redirects, logStats) is fetched eagerly when DomainDetail mounts, regardless of which tab is active. No lazy loading.
User Impact: Unnecessary API calls and network traffic when user only views the overview tab. Slower initial load of detail view.
Evidence: Lines 329-338 — `useSubdomains(domain.id)`, `useAliases(domain.id)`, `useRedirects(domain.id)`, `useDomainLogStats(domain.id)` all called unconditionally.
Fix Required: Only fetch data for the active tab. Use conditional hook calls or move fetch into tab-specific components that mount on demand.

### UI-HIGH-6-02
Page / Component: [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:409)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: All tab data (mailboxes, aliases, DKIM status, mail queue) is fetched eagerly when the page loads, regardless of which tab is active.
User Impact: Wasted API calls for data the user may never view. Slower page load.
Evidence: Lines 409-411 — `useMailDomainInfo(domainId)`, `useDkimStatus(domainId)`, `useMailQueue(domainId)` all called unconditionally.
Fix Required: Split data fetching per tab. Only fetch mailboxes for mailboxes tab, DKIM for security tab, queue for queue tab.

### UI-HIGH-6-03
Page / Component: [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:315)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: All log type queries (access, error, panel, fail2ban, auth, system) are instantiated simultaneously regardless of which log tab is active.
User Impact: Up to 6 concurrent API requests when only 1 log type is being viewed. Wastes bandwidth and server resources.
Evidence: Lines 315-320 — `useAccessLogs`, `useErrorLogs`, `usePanelLogs`, `useFail2banLogs`, `useAuthLogs`, `useSystemLogs` all called unconditionally.
Fix Required: Only instantiate the query for the active tab. Use a switch/case to conditionally call the appropriate hook.

### UI-HIGH-7-01
Page / Component: [`TerminalPage.tsx`](apps/web/src/pages/terminal/TerminalPage.tsx:32)
Check: UI-7 — Real-Time UI
Issue: Terminal auto-reconnect uses a fixed 3-second delay, not exponential backoff. After max attempts (5), user must manually click Reconnect.
User Impact: Under poor network conditions, fixed-delay reconnection is less efficient and may overwhelm the server. User may not notice they need to manually reconnect after 5 failed attempts.
Evidence: Line 32 `RECONNECT_DELAY_MS = 3000`, line 200 `setTimeout(() => { ... connect(); }, RECONNECT_DELAY_MS)` — always 3s.
Fix Required: Implement exponential backoff: `delay = base * 2^attempt` with jitter. E.g., 1s, 2s, 4s, 8s, 16s.

### UI-HIGH-7-02
Page / Component: [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:395)
Check: UI-7 — Real-Time UI
Issue: Log WebSocket has no auto-reconnect logic. When the connection drops, it stays disconnected until the user manually toggles Live mode off and on.
User Impact: User loses real-time log streaming silently. No indication that reconnection is being attempted.
Evidence: Lines 395-401 — `ws.onclose` and `ws.onerror` only set `setWsConnected(false)`. No reconnect attempt.
Fix Required: Add auto-reconnect with exponential backoff similar to terminal. Show reconnecting status in the UI.

### UI-HIGH-7-03
Page / Component: [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:365)
Check: UI-7 — Real-Time UI
Issue: No pause button for auto-scroll in live log mode. The log view always scrolls to the bottom on new entries, making it impossible to examine specific lines while streaming.
User Impact: User cannot inspect a specific log line while live mode is active because the view keeps jumping to the bottom.
Evidence: Lines 365-369 — `useEffect` always scrolls to bottom on data change. No pause state or user scroll detection.
Fix Required: Detect when user scrolls up and pause auto-scroll. Add a "Resume auto-scroll" button that appears when paused. Resume on scroll-to-bottom.

### UI-HIGH-8-01
Page / Component: [`Sidebar.tsx`](apps/web/src/components/layout/Sidebar.tsx:97)
Check: UI-8 — Sidebar and Navigation Logic
Issue: Sidebar collapse state does not persist in localStorage. It resets to expanded on every page reload/navigation.
User Impact: User preference for collapsed sidebar is lost on refresh, causing annoyance for users who prefer the compact view.
Evidence: Line 97 `const [collapsed, setCollapsed] = useState(false)` — no localStorage read/write.
Fix Required: Use `localStorage.getItem('sidebar-collapsed')` for initial state and `localStorage.setItem` on toggle.

### UI-HIGH-8-02
Page / Component: App-wide
Check: UI-8 — Sidebar and Navigation Logic
Issue: No breadcrumb component exists in the codebase. Users have no way to see their current location hierarchy or navigate to parent pages from deep views.
User Impact: When viewing domain details, SSL cert details, or database details, users lose context of where they are in the navigation hierarchy.
Evidence: No breadcrumb component found in `components/` directory. No breadcrumbs in `AppLayout.tsx`, `TopBar.tsx`, or `PageHeader.tsx`.
Fix Required: Implement a breadcrumb component in TopBar or PageHeader. Use TanStack Router's route matching to generate breadcrumb segments. For dynamic routes, use resource names (e.g., "Domains > example.com > Subdomains").

### UI-HIGH-9-01
Page / Component: [`Toast.tsx`](apps/web/src/components/ui/Toast.tsx:73)
Check: UI-9 — Notification and Toast System
Issue: Error toasts auto-dismiss after 5 seconds like all other toast types. They do not stay visible until the user explicitly dismisses them.
User Impact: Critical error messages may disappear before the user reads them, leading to missed error notifications.
Evidence: Line 73 `const duration = toast.duration ?? 5000` — same default for all types including error.
Fix Required: Set error toast duration to `Infinity` or a very long value (e.g., 30000ms). Only auto-dismiss success/info/warning toasts.

### UI-HIGH-9-02
Page / Component: [`Toast.tsx`](apps/web/src/components/ui/Toast.tsx:72)
Check: UI-9 — Notification and Toast System
Issue: Hovering over a toast does not pause the auto-dismiss timer. The toast disappears even while the user is reading it.
User Impact: Toast vanishes while user is actively reading the message, causing frustration.
Evidence: Lines 72-76 — `useEffect` sets a timeout with no pause-on-hover logic. No mouse event handlers on the toast element.
Fix Required: Add `onMouseEnter` to clear the timeout and `onMouseLeave` to restart it. Store the remaining time to resume correctly.

### UI-HIGH-9-03
Page / Component: [`Toast.tsx`](apps/web/src/components/ui/Toast.tsx:107)
Check: UI-9 — Notification and Toast System
Issue: No maximum toast limit. Unlimited toasts can stack, potentially filling the screen.
User Impact: A burst of notifications (e.g., bulk operations) could create an overwhelming wall of toasts.
Evidence: Line 107 `setToasts((prev) => [...prev, { ...toast, id }])` — no slice or limit.
Fix Required: Enforce max 5 visible toasts. When adding a new toast beyond the limit, remove the oldest one.

### UI-MED-6-01
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:378)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: Tab navigation has no keyboard support. Users cannot switch tabs with arrow keys. No `role="tablist"`, `role="tab"`, or `role="tabpanel"` ARIA attributes.
User Impact: Keyboard-only users and screen reader users cannot navigate between tabs.
Evidence: Lines 378-390 — tabs are plain `<button>` elements with no ARIA roles or keyboard handlers.
Fix Required: Add `role="tablist"` to container, `role="tab"` + `aria-selected` to buttons, `role="tabpanel"` to content panels. Add `onKeyDown` handler for arrow key navigation.

### UI-MED-6-02
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:378)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: No tab counts/badges. The subdomains, aliases, and redirects tabs don't show item counts, so users can't see at a glance how many items each tab contains.
User Impact: User must click each tab to see if there are any items. No visual summary.
Evidence: Lines 379-389 — tab labels are plain text with no count indicators.
Fix Required: Add count badges like `Subdomains (3)` or a small pill badge with the count.

### UI-MED-6-03
Page / Component: [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:526)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: Tab navigation has no keyboard support and no ARIA tab roles.
User Impact: Inaccessible to keyboard and screen reader users.
Evidence: Lines 526-538 — plain buttons with no ARIA attributes or keyboard handlers.
Fix Required: Same as UI-MED-6-01 — add tablist/tab/tabpanel ARIA roles and arrow key navigation.

### UI-MED-7-01
Page / Component: [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:269)
Check: UI-7 — Real-Time UI
Issue: Dashboard stats have no WebSocket disconnect indicator. If the polling fails or server is unreachable, the dashboard silently shows stale data with no warning.
User Impact: User may make decisions based on outdated resource information without knowing the data is stale.
Evidence: Lines 269-276 — `useServerStats`, `useServiceStatuses` etc. are polling hooks with no error/disconnect state shown.
Fix Required: Show a "Data may be outdated" banner when polling fails or returns errors. Add a "Last updated" timestamp.

### UI-MED-7-02
Page / Component: [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:158)
Check: UI-7 — Real-Time UI
Issue: CPU sparkline graph uses client-side data collection with a 5-second interval. If the stats polling fails, the graph silently stops updating and shows stale data.
User Impact: Graph appears frozen without any indication that data collection has stopped.
Evidence: Lines 164-187 — `setInterval` collects data every 5s from `prevValueRef.current` but has no error handling for stale values.
Fix Required: Detect when stats polling fails and show a warning overlay on the graph. Consider showing a "No data" state.

### UI-MED-9-01
Page / Component: [`TopBar.tsx`](apps/web/src/components/layout/TopBar.tsx:89)
Check: UI-9 — Notification and Toast System
Issue: Notification dropdown does not close on Escape key press. Only outside click closes it.
User Impact: Keyboard users cannot dismiss the dropdown with Escape, which is the standard interaction pattern.
Evidence: Lines 89-101 — only `mousedown` event listener for outside click. No `keydown` listener for Escape.
Fix Required: Add a `keydown` event listener that calls `setShowNotifications(false)` when Escape is pressed.

### UI-MED-9-02
Page / Component: [`TopBar.tsx`](apps/web/src/components/layout/TopBar.tsx:131)
Check: UI-9 — Notification and Toast System
Issue: "Mark all read" is not optimistic. The UI waits for the server response before updating the notification states.
User Impact: Noticeable delay between clicking "Mark all read" and seeing the UI update, especially on slow connections.
Evidence: Line 131 `markAllRead.mutate()` — standard mutation, no `onMutate` optimistic update.
Fix Required: Use TanStack Query optimistic updates: clear unread state in `onMutate`, rollback in `onError`.

### UI-MED-9-03
Page / Component: [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:336)
Check: UI-9 — Notification and Toast System
Issue: SMTP settings are saved to localStorage only, not to the backend API. The simulated save gives false confidence that settings are persisted server-side.
User Impact: SMTP settings are lost when the user clears browser data or switches browsers. The UI shows "saved successfully" but data is client-side only.
Evidence: Lines 335-339 — `localStorage.setItem('novapanel-smtp-config', JSON.stringify(form))` with simulated delay.
Fix Required: Implement a backend SMTP configuration endpoint and save settings via API call.

### UI-MED-10-01
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:825)
Check: UI-10 — Data Tables and Lists
Issue: Domain search input has no debounce. Every keystroke triggers an immediate client-side filter re-computation.
User Impact: With large domain lists, typing in search feels laggy due to re-filtering on every keystroke.
Evidence: Line 827 `onChange={(e) => setSearch(e.target.value)}` — direct state update, no debounce.
Fix Required: Add debounce (300ms) to the search input, similar to LogsPage's implementation.

### UI-MED-10-02
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:825)
Check: UI-10 — Data Tables and Lists
Issue: Domain search input has no clear button. User must manually select all text and delete to clear the search.
User Impact: Minor UX friction when clearing search.
Evidence: Lines 823-830 — search input has no clear/reset button.
Fix Required: Add an X button inside the search input that clears the search value, similar to LogsPage's implementation.

### UI-MED-10-03
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:844)
Check: UI-10 — Data Tables and Lists
Issue: Domain table columns are not sortable. No sort indicators or click handlers on column headers.
User Impact: User cannot sort domains by name, status, PHP version, etc. to find what they need.
Evidence: Lines 846-862 — table headers are plain `<th>` elements with no click handlers or sort state.
Fix Required: Add sortable column headers with ascending/descending indicators. Track sort state and sort the filtered array.

### UI-MED-10-04
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:844)
Check: UI-10 — Data Tables and Lists
Issue: No pagination for domain list. All domains are rendered at once.
User Impact: With many domains (100+), the page becomes very long and slow to render.
Evidence: Lines 864-963 — `filtered.map()` renders all results with no pagination.
Fix Required: Add pagination with configurable page size (10/25/50/100).

### UI-MED-10-05
Page / Component: [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:566)
Check: UI-10 — Data Tables and Lists
Issue: Database table has no search, no sorting, no pagination, and no row selection.
User Impact: With many databases, user cannot find specific ones or perform bulk operations.
Evidence: Lines 566-599 — plain table with no interactive features beyond click-to-detail.
Fix Required: Add search input, sortable columns, and pagination.

### UI-MED-10-06
Page / Component: [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:910)
Check: UI-10 — Data Tables and Lists
Issue: SSL certificate search has no debounce and no clear button.
User Impact: Same as UI-MED-10-01 and UI-MED-10-02.
Evidence: Line 913 `onChange={e => setSearch(e.target.value)}` — direct state update.
Fix Required: Add debounce and clear button.

### UI-LOW-6-01
Page / Component: [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:340)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: Tab state is not synced to URL. When user navigates to a domain detail and selects the "subdomains" tab, refreshing the page loses the tab selection.
User Impact: User cannot bookmark or share a link to a specific tab within domain details.
Evidence: Line 340 `const [tab, setTab] = useState<'overview' | 'subdomains' | 'aliases' | 'redirects'>('overview')` — local state only.
Fix Required: Use URL search params (e.g., `?tab=subdomains`) to persist and restore tab selection.

### UI-LOW-6-02
Page / Component: [`LogsPage.tsx`](apps/web/src/pages/logs/LogsPage.tsx:447)
Check: UI-6 — Tab and Multi-Panel Navigation
Issue: WebSocket reconnect effect has missing dependency on `connectWs` and `disconnectWs`, which could cause stale closures.
User Impact: Potential for WebSocket not reconnecting properly after tab/domain changes in edge cases.
Evidence: Lines 443-447 — `useEffect` depends on `activeTab` and `selectedDomainId` but not on `connectWs`/`disconnectWs`.
Fix Required: Add `connectWs` and `disconnectWs` to the dependency array, or use a ref to avoid stale closure issues.

### UI-LOW-8-01
Page / Component: [`Sidebar.tsx`](apps/web/src/components/layout/Sidebar.tsx:97)
Check: UI-8 — Sidebar and Navigation Logic
Issue: Sidebar navigation items have no `aria-current="page"` attribute for screen readers.
User Impact: Screen reader users cannot identify which page is currently active through ARIA attributes.
Evidence: Lines 135-149 — active state is visual only (CSS classes), no ARIA attributes.
Fix Required: Add `aria-current="page"` to the active navigation link.

### UI-LOW-9-01
Page / Component: [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:898)
Check: UI-9 — Notification and Toast System
Issue: Notification toasts in NotificationsPage have a fixed 5-second auto-dismiss with no hover-pause behavior.
User Impact: Toast disappears while user is reading it.
Evidence: Lines 19-22 — `setTimeout(onClose, 5000)` with no pause-on-hover.
Fix Required: Add mouse enter/leave handlers to pause/resume the dismiss timer.

### UI-LOW-10-01
Page / Component: [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:72)
Check: UI-10 — Data Tables and Lists
Issue: Notification history has a fixed page size of 10 with no page size selector.
User Impact: User cannot adjust how many notifications to see per page.
Evidence: Line 72 `const PAGE_SIZE = 10` — hardcoded.
Fix Required: Add a page size selector (10/25/50).

### UI-LOW-10-02
Page / Component: [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:555)
Check: UI-10 — Data Tables and Lists
Issue: Mailbox and alias tables have no sorting, search, or pagination.
User Impact: With many mailboxes, the list becomes hard to navigate.
Evidence: Lines 555-654 — plain table rendering with no interactive table features.
Fix Required: Add search, sorting, and pagination to mailbox and alias tables.

---

## SUMMARY

| Severity | Count |
|----------|-------|
| HIGH     | 10    |
| MEDIUM   | 12    |
| LOW      | 6     |
| **Total**| **28**|

### By Check Area

| Check | Area | Issues |
|-------|------|--------|
| UI-6  | Tab/Multi-Panel Navigation | 7 |
| UI-7  | Real-Time UI (WebSocket) | 5 |
| UI-8  | Sidebar & Navigation | 3 |
| UI-9  | Notification & Toast | 5 |
| UI-10 | Data Tables & Lists | 8 |

### Top Priority Fixes

1. **Toast error persistence** (UI-HIGH-9-01) — Error toasts must stay until dismissed
2. **Toast hover pause** (UI-HIGH-9-02) — Hovering must pause auto-dismiss
3. **Toast max limit** (UI-HIGH-9-03) — Cap at 5 toasts
4. **Log WS reconnect** (UI-HIGH-7-02) — Add auto-reconnect for log WebSocket
5. **Log scroll pause** (UI-HIGH-7-03) — Add pause/resume for auto-scroll
6. **Sidebar persistence** (UI-HIGH-8-01) — Save collapse state to localStorage
7. **Breadcrumb navigation** (UI-HIGH-8-02) — Implement breadcrumb component
8. **Lazy tab loading** (UI-HIGH-6-01/02/03) — Fetch data only for active tabs
9. **Terminal exponential backoff** (UI-HIGH-7-01) — Replace fixed reconnect delay
10. **Notification dropdown Escape** (UI-MED-9-01) — Close on Escape key
