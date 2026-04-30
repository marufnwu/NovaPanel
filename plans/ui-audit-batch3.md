# UI Audit — Batch 3: Checks UI-11 to UI-15

**Date:** 2026-04-28  
**Scope:** Multi-step flows, file manager, dynamic fields, settings logic, theme/responsiveness/a11y  
**Files Audited:** 13 page/component files + CSS/Tailwind config

---

## CHECK UI-11 — Multi-Step Flows and Wizards

### UI-H-41
Page / Component: `apps/web/src/pages/tunnels/TunnelsPage.tsx` — SetupModal
Check: UI-11 — Step indicator
Issue: Completed steps are not visually differentiated from current/future steps. All non-current dots use `bg-primary` (line 61: `${step === 'token' ? 'bg-primary' : step === 'creating' ? 'bg-primary' : 'bg-primary'}`), making it impossible to tell which steps are done. No checkmark icon is shown for completed steps.
User Impact: User cannot see their progress through the wizard — all dots look the same regardless of completion status.
Evidence: `TunnelsPage.tsx:61`
Fix Required: Use distinct styles for completed (green + checkmark), current (primary + pulse), and upcoming (muted) steps. Add a `✓` icon for completed steps.

### UI-H-42
Page / Component: `apps/web/src/pages/tunnels/TunnelsPage.tsx` — SetupModal
Check: UI-11 — Step indicator current/total
Issue: No "Step X of Y" text label. Only ambiguous dots are shown with no numeric context.
User Impact: User does not know how many total steps remain.
Evidence: `TunnelsPage.tsx:59-74`
Fix Required: Add text like "Step 1 of 3" or "Token — Step 1" above or beside the dots.

### UI-M-43
Page / Component: `apps/web/src/pages/tunnels/TunnelsPage.tsx` — SetupModal
Check: UI-11 — Failure retry
Issue: On token validation failure, the error is displayed but there is no dedicated "Retry" button. User must manually click "Next" again, which is not obvious.
User Impact: User may think the flow is stuck after an error.
Evidence: `TunnelsPage.tsx:89-94`
Fix Required: Add a "Retry" button that re-triggers `handleValidateToken` when an error is shown.

### UI-M-44
Page / Component: `apps/web/src/pages/tunnels/TunnelsPage.tsx` — SetupModal
Check: UI-11 — Completion summary
Issue: On successful tunnel creation, the modal simply closes via `onClose` (line 50). No success message, summary of what was created, or next-step guidance is shown.
User Impact: User gets no confirmation that the tunnel was created successfully.
Evidence: `TunnelsPage.tsx:50`
Fix Required: Show a success state with tunnel name, zone, and a "Done" button before closing.

### UI-H-45
Page / Component: `apps/web/src/pages/backups/BackupsPage.tsx` — BackupProgressModal
Check: UI-11 — Async step progress
Issue: Progress steps are simulated client-side with `setInterval` (lines 51-63), not driven by actual server progress. The modal shows "Creating Backup" with fake progress regardless of real server state. The actual backup creation happens in `CreateBackupModal.handleSubmit` which calls `create.mutate` and on success switches to this simulated progress modal.
User Impact: Progress bar reaches 100% even if the server backup is still running or has failed. User sees "Backup created successfully!" when the real backup may not be done.
Evidence: `BackupsPage.tsx:46-63`
Fix Required: Either poll the server for real backup status or show an indeterminate spinner until the server confirms completion. Do not simulate steps.

### UI-M-46
Page / Component: `apps/web/src/pages/backups/BackupsPage.tsx` — BackupProgressModal
Check: UI-11 — Failure handling
Issue: No error state or retry mechanism. If the backup fails, the simulated progress continues to completion and shows "Backup created successfully!" regardless.
User Impact: User is falsely told the backup succeeded when it may have failed.
Evidence: `BackupsPage.tsx:109-113`
Fix Required: Handle backup creation errors, show error state, and provide a retry button.

### UI-H-47
Page / Component: `apps/web/src/pages/ssl/SslPage.tsx` — IssueModal
Check: UI-11 — Async step progress
Issue: The `simulateProgress` function (lines 111-123) runs a client-side timer that advances through `ISSUANCE_STEPS` before the actual API call completes. The `await simulateProgress()` resolves first, then `issueLE.mutate` is called. If the API call fails after the simulation completes, the UI has already shown "Complete!".
User Impact: User sees "Complete!" step but the certificate was not actually issued.
Evidence: `SslPage.tsx:134-148`
Fix Required: Drive progress from the actual API response. Either use server-sent events for real progress or show the progress animation only after the API call starts, and handle errors by resetting the progress display.

### UI-L-48
Page / Component: `apps/web/src/pages/ssl/SslPage.tsx` — IssuanceProgress
Check: UI-11 — Progress step numbering
Issue: The progress component shows step numbers (1-5) but no "Step X of Y" label or percentage indicator.
User Impact: Minor — user can count steps but has no at-a-glance summary.
Evidence: `SslPage.tsx:40-77`
Fix Required: Add "Step {n} of {total}" text or a percentage indicator.

---

## CHECK UI-12 — File Manager UI Logic

### UI-H-49
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — FileEditor
Check: UI-12 — Syntax highlighting
Issue: The built-in `FileEditor` component (lines 82-123) uses a plain `<textarea>` with no syntax highlighting. The separate `CodeEditor` component in `components/files/CodeEditor.tsx` has CodeMirror with syntax highlighting but is never used by `FilesPage`.
User Impact: Users editing code files see plain text with no language-aware coloring, making code difficult to read and edit.
Evidence: `FilesPage.tsx:115-119`
Fix Required: Integrate the `CodeEditor` component into `FilesPage` instead of the plain textarea `FileEditor`, or add CodeMirror to the inline editor.

### UI-H-50
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — FileEditor
Check: UI-12 — Unsaved changes warning
Issue: No dirty state tracking or unsaved changes warning. Clicking the back arrow (line 105) immediately exits the editor without checking if content has been modified. The `saved` state tracks whether a save happened but is not used to warn about unsaved changes.
User Impact: User can lose unsaved edits by accidentally clicking the back button.
Evidence: `FilesPage.tsx:105`
Fix Required: Track dirty state by comparing `content` against `data?.content`. Show a confirmation dialog before navigating away when there are unsaved changes.

### UI-M-51
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — FileEditor
Check: UI-12 — Save disabled until changed
Issue: The Save button is only disabled during saving (`disabled={isSaving}`, line 110), not when content is unchanged. User can save identical content, triggering an unnecessary API call.
User Impact: Unnecessary server load; no visual feedback that nothing changed.
Evidence: `FilesPage.tsx:110`
Fix Required: Track dirty state and disable Save when content matches the original.

### UI-H-52
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — File table
Check: UI-12 — Double-click folder navigation
Issue: Single-clicking a file/folder row toggles selection (line 666: `onClick={() => toggleSelectItem(entry)}`), not navigation. Folders can only be opened via the small chevron button (line 697). Double-click does nothing different from single-click.
User Impact: Users expect double-click to open folders, which is standard file manager behavior. The current behavior makes folder navigation require precise clicking on a small button.
Evidence: `FilesPage.tsx:666-667`
Fix Required: Add `onDoubleClick` handler for directories that navigates into them. Change single-click to only select (not toggle).

### UI-M-53
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — File table
Check: UI-12 — Multi-select keyboard modifiers
Issue: No Ctrl+Click (toggle individual items) or Shift+Click (range select) support. The `toggleSelectItem` function (lines 520-529) always toggles single items without checking for modifier keys.
User Impact: Users cannot efficiently select multiple non-adjacent or range of files.
Evidence: `FilesPage.tsx:520-529, 666`
Fix Required: Check `e.ctrlKey`/`e.metaKey` and `e.shiftKey` in click handlers. Implement Ctrl+Click for toggle and Shift+Click for range selection.

### UI-L-54
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — Breadcrumb
Check: UI-12 — Up button
Issue: No dedicated "go up one level" button. Users must use the breadcrumb to navigate up.
User Impact: Minor inconvenience — breadcrumb works but an up button is standard in file managers.
Evidence: `FilesPage.tsx:624-635`
Fix Required: Add an up-arrow button next to the breadcrumb that navigates to the parent directory.

### UI-M-55
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — File table
Check: UI-12 — Click empty area to deselect
Issue: Clicking the empty area of the file list does not deselect items. There is no handler on the table or container for clicking empty space.
User Impact: Selected items remain selected with no easy way to deselect all.
Evidence: `FilesPage.tsx:643-716`
Fix Required: Add an onClick handler on the table/container that clears `selectedItems` when the click target is not a file row.

### UI-M-56
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — UploadModal
Check: UI-12 — Upload progress per file
Issue: Upload progress shows an overall percentage across all files (line 205: `((i + 1) / files.length) * 100`), not per-file progress. Individual file upload status is not displayed.
User Impact: User cannot see which files have uploaded and which are pending.
Evidence: `FilesPage.tsx:196-221, 246`
Fix Required: Show per-file progress with file name, size, and individual progress bars.

### UI-M-57
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — UploadModal
Check: UI-12 — Upload cancel
Issue: No cancel button during upload. Once upload starts, the user must wait for all files to finish. The `uploading` state disables closing but there is no abort mechanism.
User Impact: User cannot cancel a large or mistaken upload.
Evidence: `FilesPage.tsx:196-221`
Fix Required: Add a "Cancel" button that aborts the fetch requests and closes the modal. Use `AbortController` for cancellation.

### UI-M-58
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — UploadModal
Check: UI-12 — Overwrite prompt
Issue: No overwrite detection or prompt. If a file with the same name exists, it is silently overwritten by the upload.
User Impact: User may unintentionally overwrite existing files.
Evidence: `FilesPage.tsx:196-206`
Fix Required: Before uploading, check if files with the same names exist and show an overwrite confirmation dialog.

### UI-M-59
Page / Component: `apps/web/src/pages/files/FilesPage.tsx` — PermissionsModal
Check: UI-12 — Permissions checkboxes
Issue: Permissions editor only offers preset buttons and an octal input (lines 129-154). No checkbox-based UI for read/write/execute per owner/group/others, which is the standard two-way bound interface.
User Impact: Users who are not familiar with octal notation struggle to set precise permissions.
Evidence: `FilesPage.tsx:125-163`
Fix Required: Add a 3x3 checkbox grid (owner/group/other × read/write/execute) that two-way binds with the octal input.

### UI-L-60
Page / Component: `apps/web/src/pages/files/FilesPage.tsx`
Check: UI-12 — Drag and drop
Issue: No drag-and-drop support for moving files within the file list. The upload modal supports drag for uploading, but there is no internal drag-to-move functionality.
User Impact: Files must be moved via copy/cut/paste toolbar buttons.
Evidence: `FilesPage.tsx` — no drag handlers on file rows
Fix Required: Add drag handlers on file rows for internal move operations, with drop zone highlighting.

---

## CHECK UI-13 — Forms with Dynamic Fields

### UI-M-61
Page / Component: `apps/web/src/pages/php/PhpPage.tsx` — PhpIniEditor
Check: UI-13 — Minimum row enforcement
Issue: All directives can be removed via `removeDirective` (line 59-61), leaving zero rows. There is no minimum row enforcement.
User Impact: User can accidentally remove all directives, including potentially important ones.
Evidence: `PhpPage.tsx:59-61`
Fix Required: Either enforce a minimum of 0 rows (allow empty, which is valid for php.ini overrides) or add a confirmation when removing the last directive. At minimum, the "Save" button should warn when saving an empty directive list.

### UI-M-62
Page / Component: `apps/web/src/pages/php/PhpPage.tsx` — PhpIniEditor
Check: UI-13 — Per-row validation
Issue: No per-row validation. Empty keys are only prevented on add (`!newKey.trim()` check on line 137), but existing rows can have their keys cleared via the inline input (line 95-96) with no validation. Duplicate keys are also not detected.
User Impact: Invalid directives (empty key, duplicate keys) can be saved, potentially causing PHP errors.
Evidence: `PhpPage.tsx:90-115`
Fix Required: Validate each row for non-empty key, no duplicate keys, and valid directive syntax. Highlight invalid rows with error styling.

### UI-L-63
Page / Component: `apps/web/src/pages/php/PhpPage.tsx` — PhpIniEditor
Check: UI-13 — Auto-focus new row
Issue: When adding a new directive via `addDirective` (line 52-56), the new row does not receive focus. The user must manually click into the new row's key input.
User Impact: Minor friction — user must click to start typing in the newly added row.
Evidence: `PhpPage.tsx:52-56`
Fix Required: Use a ref or auto-focus mechanism to focus the key input of the newly added directive.

### UI-L-64
Page / Component: `apps/web/src/pages/php/PhpPage.tsx` — PhpIniEditor
Check: UI-13 — Row ordering
Issue: No drag-to-reorder functionality for directives. Order matters in php.ini as later directives override earlier ones.
User Impact: User cannot reorder directives without removing and re-adding them.
Evidence: `PhpPage.tsx:79-118`
Fix Required: Add drag-to-reorder handles to each directive row.

### UI-L-65
Page / Component: `apps/web/src/pages/dns/DnsPage.tsx` — RecordForm
Check: UI-13 — Inline multi-row editing
Issue: DNS records are edited one at a time via a form that appears above the record list (lines 787-796). There is no inline editing capability for multiple records simultaneously.
User Impact: Editing multiple records requires opening and closing the form for each one.
Evidence: `DnsPage.tsx:787-796`
Fix Required: Consider adding inline editing for DNS records, or at minimum allow the edit form to stay open while navigating between records.

---

## CHECK UI-14 — Settings Pages Logic

### UI-H-66
Page / Component: `apps/web/src/pages/settings/ServerSettingsPage.tsx` — PanelSettingsSection
Check: UI-14 — Pre-filling current values
Issue: Server data is not properly loaded into form state. The pattern `value={hostname || identityData?.hostname || ''}` (line 225) uses the JavaScript `||` fallback in the render, which means: (a) if user clears the field to empty string, it falls back to server data and appears uneditable; (b) the actual state `hostname` starts as `''` and is never initialized from `identityData`. Similar issues in NameserverSettingsSection (line 399), BackupSettingsSection (line 676-699), and SessionPasswordSettingsSection (lines 509-543).
User Impact: Fields appear pre-filled but the state is actually empty. If the user submits without touching the field, an empty string may be sent to the server instead of the current value.
Evidence: `ServerSettingsPage.tsx:225, 253, 269, 399, 409, 513, 541, 676-699`
Fix Required: Use `useEffect` to initialize state from server data when it loads (like `PanelPortSection` does at lines 996-999), or use the `initialized` pattern from `DataRetentionSection` (lines 1366-1373).

### UI-M-67
Page / Component: `apps/web/src/pages/settings/ServerSettingsPage.tsx` — Multiple sections
Check: UI-14 — Change detection
Issue: Most Save buttons are always enabled. `PanelSettingsSection` disables save only when `!hostname` (line 237), meaning if the user hasn't changed the hostname but it appears pre-filled via the `||` fallback, the button appears enabled. `BackupSettingsSection` always allows saving (line 705). `SessionPasswordSettingsSection` requires a non-zero timeout (line 524) but doesn't check if the value actually changed.
User Impact: User can save unchanged settings, causing unnecessary server requests and confusion about what was modified.
Evidence: `ServerSettingsPage.tsx:237, 422, 465, 524, 631, 705`
Fix Required: Track original values and disable Save when no fields have changed. The `PanelPortSection` (line 1031) and `DefaultWebServerSection` (line 1079) demonstrate the correct pattern.

### UI-M-68
Page / Component: `apps/web/src/pages/settings/ProfilePage.tsx` — PasswordSection
Check: UI-14 — Sensitive fields show toggle
Issue: Password fields use `type="password"` but there is no eye icon to toggle visibility. Users cannot verify what they typed for current password, new password, or confirm password.
User Impact: Users may make typos in passwords without being able to verify, leading to failed password changes.
Evidence: `ProfilePage.tsx:209-239`
Fix Required: Add a show/hide toggle button next to each password field.

### UI-M-69
Page / Component: `apps/web/src/pages/settings/ProfilePage.tsx` — ProfileSection
Check: UI-14 — Change detection
Issue: The "Save Profile" button (line 123-129) is always enabled (only disabled during pending). There is no check whether the display name has actually changed from the current value.
User Impact: Unnecessary API calls when saving unchanged profile data.
Evidence: `ProfilePage.tsx:123-129`
Fix Required: Disable Save when `displayName === user?.displayName`.

### UI-L-70
Page / Component: `apps/web/src/pages/settings/ServerSettingsPage.tsx` — SslEmailSection
Check: UI-14 — Sensitive fields "Keep current" option
Issue: No "Keep current" option for sensitive fields. The Cloudflare API token in `DnsPage.tsx` ExternalDnsSection (line 596) uses `type="password"` but when editing, the field starts empty — there is no indication that the current token is preserved if left blank.
User Impact: User may think they need to re-enter the API token every time they open settings.
Evidence: `DnsPage.tsx:594-604`, `ServerSettingsPage.tsx:1088-1133`
Fix Required: Add a "Keep current" placeholder or checkbox for sensitive fields, indicating that leaving the field blank preserves the existing value.

### UI-L-71
Page / Component: `apps/web/src/pages/settings/ServerSettingsPage.tsx`
Check: UI-14 — Test buttons
Issue: No SMTP test or storage connection test buttons. The webserver page has a "Test Config" button (WebserverPage.tsx:361), but email/storage settings lack equivalent test functionality.
User Impact: User cannot verify SMTP or storage credentials before saving.
Evidence: `ServerSettingsPage.tsx` — no test buttons in any section
Fix Required: Add "Test Connection" buttons for SMTP settings and storage configuration with loading/success/failure states.

---

## CHECK UI-15 — Theme, Responsiveness, and Accessibility

### UI-H-72
Page / Component: `apps/web/src/App.tsx` + layout
Check: UI-15 — Dark/light theme toggle
Issue: No theme toggle exists anywhere in the application. `App.tsx` has no theme logic. The `TopBar.tsx` has no theme switcher. The `Sidebar.tsx` has no theme option. CSS variables for dark mode are defined in `index.css` (lines 25-43) and Tailwind is configured with `darkMode: 'class'` (`tailwind.config.js:3`), but there is no UI to activate dark mode and no localStorage persistence.
User Impact: Dark mode is completely unusable — users are locked into light mode.
Evidence: `App.tsx:1-24`, `index.css:25-43`, `tailwind.config.js:3`
Fix Required: Add a theme toggle button to the TopBar or Sidebar. Implement theme persistence in localStorage. Apply/remove the `dark` class on `<html>` or `<body>`.

### UI-M-73
Page / Component: `apps/web/src/pages/installer/InstallerPage.tsx`
Check: UI-15 — Hardcoded colors breaking dark mode
Issue: `CATEGORY_COLORS` (lines 37-44) uses hardcoded light-mode colors like `'bg-purple-100 text-purple-700 border-purple-200'`. `getStatusBadge` (lines 51-56) uses `'bg-yellow-100 text-yellow-700'`, `'bg-green-100 text-green-700'`, etc. `PostInstallChecklist` uses `'border-green-200 bg-green-50'` (lines 116-117). These all have white/light backgrounds that would be invisible or jarring in dark mode.
User Impact: If dark mode were enabled, these elements would have bright white/light backgrounds that clash with the dark theme.
Evidence: `InstallerPage.tsx:37-56, 116-117, 127-131, 149-153, 185-189, 205-209`
Fix Required: Replace hardcoded colors with semantic CSS variable-based classes (e.g., `bg-primary/10 text-primary`) or use `dark:` variants.

### UI-M-74
Page / Component: `apps/web/src/pages/settings/ProfilePage.tsx`
Check: UI-15 — Hardcoded colors breaking dark mode
Issue: 2FA status badges use `'bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'` (line 321) and `'bg-yellow-100 ... text-yellow-800'` (line 459). API token success box uses `'bg-green-50 border border-green-200 ... text-green-800'` (line 603). These hardcoded light colors would break in dark mode.
User Impact: Text becomes unreadable against light backgrounds in dark mode.
Evidence: `ProfilePage.tsx:321, 459, 603-624`
Fix Required: Use semantic color classes with dark mode variants.

### UI-M-75
Page / Component: `apps/web/src/pages/php/PhpPage.tsx`
Check: UI-15 — Hardcoded colors breaking dark mode
Issue: Security function buttons use `'border-red-300 bg-red-50 text-red-600'` for disabled state (lines 543-545). These hardcoded light backgrounds break in dark mode.
User Impact: Buttons would have bright red/pink backgrounds in dark mode.
Evidence: `PhpPage.tsx:543-545`
Fix Required: Use semantic classes like `bg-red-500/10 text-red-500 border-red-500/30`.

### UI-M-76
Page / Component: `apps/web/src/pages/webserver/WebserverPage.tsx`
Check: UI-15 — Hardcoded colors breaking dark mode
Issue: Config test result uses `'bg-green-50 text-green-700'` and `'bg-red-50 text-red-700'` (line 375). These hardcoded light backgrounds break in dark mode.
User Impact: Test result box would have white background in dark mode.
Evidence: `WebserverPage.tsx:375`
Fix Required: Use semantic classes like `bg-green-500/10 text-green-500`.

### UI-M-77
Page / Component: `apps/web/src/components/files/CodeEditor.tsx`
Check: UI-15 — Theme-aware editor
Issue: CodeMirror always uses `oneDark` theme (line 175: `theme={oneDark}`) regardless of the application theme. In light mode, the editor has a dark background while the rest of the app is light.
User Impact: Jarring visual inconsistency — dark editor embedded in light-themed page.
Evidence: `CodeEditor.tsx:175`
Fix Required: Detect the current theme and switch between `oneDark` and a light theme (or default theme).

### UI-M-78
Page / Component: `apps/web/src/pages/files/FilesPage.tsx`
Check: UI-15 — Responsive sidebar
Issue: The directory tree sidebar has a fixed width of `w-64` (256px, line 605) with no collapse mechanism. On tablets (768px) and mobile (375px), this consumes too much screen space, leaving insufficient room for the file list.
User Impact: File manager is unusable on mobile devices — the sidebar takes up most of the screen.
Evidence: `FilesPage.tsx:603-619`
Fix Required: Make the sidebar collapsible on smaller screens. Hide it by default on mobile and show a toggle button. Use responsive classes like `hidden md:block`.

### UI-M-79
Page / Component: Multiple pages — DnsPage, FirewallPage, LoginActivityTab
Check: UI-15 — Tables horizontal scroll
Issue: Tables in `DnsPage.tsx` (lines 825-876), `FirewallPage.tsx` (lines 551-607, 746-791), and other pages lack `overflow-x-auto` wrappers. On small screens, table content overflows the viewport.
User Impact: Table content is clipped or causes horizontal page scroll on mobile devices.
Evidence: `DnsPage.tsx:825`, `FirewallPage.tsx:551, 746`
Fix Required: Wrap all `<table>` elements in a `<div className="overflow-x-auto">` container.

### UI-L-80
Page / Component: Multiple pages
Check: UI-15 — Focus ring visibility
Issue: Many input fields and buttons lack visible focus indicators. While some ProfilePage inputs have `focus:ring-1 focus:ring-primary` (line 118), most inputs across the app only have `focus:outline-none` without a replacement ring (e.g., `FilesPage.tsx:118`, `DnsPage.tsx:130-174`). Buttons have no `focus-visible` styling.
User Impact: Keyboard users cannot see which element is focused, making keyboard navigation difficult.
Evidence: `FilesPage.tsx:118`, `DnsPage.tsx:130-174`, `FirewallPage.tsx:116-151`
Fix Required: Add `focus:ring-2 focus:ring-primary/50 focus:outline-none` to all interactive elements. Add `focus-visible:ring-2` to buttons.

### UI-L-81
Page / Component: All modals
Check: UI-15 — Focus trap in modals
Issue: No modal implements focus trapping. When a modal is open, Tab key can move focus to elements behind the modal overlay.
User Impact: Keyboard users can tab to hidden elements behind the modal, causing confusion.
Evidence: All modal components across the audited files
Fix Required: Implement focus trapping in modals (either via a library or manual `keydown` handler for Tab/Shift+Tab).

### UI-L-82
Page / Component: `apps/web/src/components/layout/AppLayout.tsx`
Check: UI-15 — Skip-to-content link
Issue: No skip-to-content link for keyboard users. The page has no mechanism to jump past the sidebar navigation to the main content area.
User Impact: Screen reader and keyboard users must tab through all navigation items on every page load.
Evidence: AppLayout.tsx — no skip link
Fix Required: Add a visually hidden "Skip to main content" link at the top of the page that becomes visible on focus.

---

## WHAT IS WORKING CORRECTLY

### Multi-Step Flows (UI-11)
- **TunnelsPage SetupModal**: "Next" button correctly disabled until current step is valid (line 105: `disabled={!form.apiToken || validateToken.isPending}`). Back button preserves form data (lines 135, 153). Navigation is disabled during async operations.
- **SslPage IssuanceProgress**: Completed steps show checkmarks (line 56: `isDone ? '✓' : idx + 1`). Active step shows spinner animation (line 63). Error display is clear (lines 70-74).
- **BackupsPage BackupProgressModal**: Progress bar with percentage (lines 78-85). Step completion indicators work (lines 88-106). "Done" button appears on completion (lines 115-121).
- **InstallerPage PostInstallChecklist**: Comprehensive post-install checklist with interactive items (lines 80-230). Admin URL with copy functionality. Clear "Done" button.

### File Manager (UI-12)
- **Breadcrumb navigation**: Working correctly with clickable path segments (lines 624-635).
- **Context menu**: Right-click context menu with full options (lines 298-323).
- **Clipboard operations**: Copy/cut/paste with visual indicator for paste button (lines 462-482, 590-593).
- **Bulk selection**: Select all toggle works (lines 512-518). Bulk delete with confirmation (lines 451-460).
- **File preview modals**: Image, video, PDF, and archive preview modals all implemented (FilePreviewModal.tsx).
- **Directory tree**: Collapsible tree sidebar with expand/collapse (lines 325-374).
- **Preferences persistence**: Show hidden files, sort by, and sort order saved to localStorage (lines 397-411).
- **Upload drag-and-drop**: Drop zone in upload modal works (lines 230-234).
- **Auto-extract archives**: Upload modal has auto-extract option for zip/tar.gz files (lines 194, 209-216).

### Dynamic Fields (UI-13)
- **PhpPage PhpIniEditor**: Add/remove directive rows work correctly (lines 52-61). Inline editing of key/value pairs (lines 90-115). Save with success indicator (lines 151-155).
- **DnsPage RecordForm**: Type-dependent validation (lines 81-90). Priority field shown only for MX/SRV (line 77). Cancel clears form state (line 179).

### Settings Logic (UI-14)
- **PanelPortSection**: Correctly uses `initialized` pattern to load server data (lines 994-999). Save disabled when value unchanged (line 1031).
- **DefaultWebServerSection**: Correct change detection — disabled when mode unchanged (line 1079).
- **DataRetentionSection**: Proper initialization from server data (lines 1366-1373).
- **ProfilePage PasswordSection**: Password match validation (line 197). Length validation (line 198). Submit disabled when invalid (line 251).
- **ProfilePage 2FA**: Full 2FA setup flow with QR code, verification, backup codes, and disable functionality.
- **WebserverPage**: Dependent fields correctly show/hide (hotlink protection → allowed domains, reverse proxy → target URL).
- **SslPage IssueModal**: Wildcard toggle correctly shows DNS provider selection (lines 258-300).
- **BackupsPage CreateBackupModal**: Encryption toggle shows password field only when enabled (lines 194-208). Submit disabled when encrypted but no password (line 217).

### Theme and CSS Architecture (UI-15)
- **CSS variable system**: Complete light and dark variable sets defined in `index.css` (lines 5-43).
- **Tailwind config**: Properly configured with `darkMode: 'class'` and semantic color tokens (`tailwind.config.js`).
- **Semantic color usage**: Most components correctly use `bg-primary`, `text-muted-foreground`, `bg-card`, `border-border`, etc.
- **Responsive grids**: ServerSettingsPage uses `md:grid-cols-2` (line 395), ProfilePage uses `lg:grid-cols-2` (line 669), PhpPage uses `sm:grid-cols-2 lg:grid-cols-3` (line 474).
- **Responsive visibility**: TopBar hides user details on small screens (`hidden sm:block`, line 194).

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 8     |
| MEDIUM   | 16    |
| LOW      | 8     |
| **Total** | **32** |

### By Check Area

| Check | HIGH | MEDIUM | LOW | Total |
|-------|------|--------|-----|-------|
| UI-11 Multi-Step Flows | 3 | 2 | 1 | 6 |
| UI-12 File Manager | 3 | 6 | 2 | 11 |
| UI-13 Dynamic Fields | 0 | 2 | 3 | 5 |
| UI-14 Settings Logic | 1 | 3 | 2 | 6 |
| UI-15 Theme/Resp/A11y | 1 | 3 | 0 | 4 |

### Cumulative Audit Totals

| Batch | Issues |
|-------|--------|
| Batch 1 (UI-1 to UI-5) | 41 |
| Batch 2 (UI-6 to UI-10) | 28 |
| Batch 3 (UI-11 to UI-15) | 32 |
| **Total so far** | **101** |
