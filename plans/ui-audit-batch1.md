# UI Audit — Batch 1: UI Map + Checks UI-1 to UI-5

**Date:** 2026-04-28  
**Auditor:** Automated Frontend Logic Audit  
**Scope:** All pages, components, modals, and interactive elements

---

## UI MAP

### Route Structure

| Path | Component | Auth |
|------|-----------|------|
| `/login` | `LoginPage` | No |
| `/` | `DashboardPage` | Yes |
| `/domains` | `DomainsPage` | Yes |
| `/webserver` | `WebserverPage` | Yes |
| `/php` | `PhpPage` | Yes |
| `/ssl` | `SslPage` | Yes |
| `/dns` | `DnsPage` | Yes |
| `/mail` | `MailPage` | Yes |
| `/databases` | `DatabasesPage` | Yes |
| `/ftp` | `FtpPage` | Yes |
| `/tunnels` | `TunnelsPage` | Yes |
| `/files` | `FilesPage` | Yes |
| `/terminal` | `TerminalPage` | Yes |
| `/cron` | `CronPage` | Yes |
| `/firewall` | `FirewallPage` | Yes |
| `/logs` | `LogsPage` | Yes |
| `/backups` | `BackupsPage` | Yes |
| `/audit` | `AuditPage` | Yes |
| `/settings` | `ProfilePage` | Yes |
| `/settings/server` | `ServerSettingsPage` | Yes |
| `/settings/api-tokens` | `ApiTokensPage` | Yes |
| `/monitoring` | `MonitoringPage` | Yes |
| `/notifications` | `NotificationsPage` | Yes |
| `/installer` | `InstallerPage` | Yes |

### Global State — `auth.store.ts`

- `user: AuthUser | null` — current user info
- `isAuthenticated: boolean` — auth status
- `pendingTwoFactor: boolean` — 2FA pending
- `pendingUserId: string | null` — user awaiting 2FA
- `sessionHash: string | null` — session hash for WS auth

### API Hooks Summary

| Hook File | Queries | Mutations |
|-----------|---------|-----------|
| `auth.ts` | useMe, useSessions | useLogin, useLogin2FA, useLogout, useEnable2FA, useVerify2FA, useDisable2FA, useChangePassword, useChangeEmail, useUpdateProfile, useRevokeSession |
| `domains.ts` | useDomains, useDomain, useSubdomains, useAliases, useRedirects, useDomainLogStats | useCreateDomain, useUpdateDomain, useDeleteDomain, useSuspendDomain, useActivateDomain, +CRUD for subdomains/aliases/redirects, +bulk actions |
| `databases.ts` | useDatabases, useDatabaseInfo | useCreateDatabase, useDeleteDatabase, useCreateDbUser, useDeleteDbUser, useChangeDbPassword, useExportDatabase, useImportDatabase, useRepairDatabase, useOptimizeDatabase, useCloneDatabase, useRunQuery |
| `ftp.ts` | useFtpAccounts, useFtpAccount, useFtpSettings | useCreateFtpAccount, useUpdateFtpAccount, useChangeFtpPassword, useDeleteFtpAccount, useUpdateFtpSettings |
| `cron.ts` | useCronJobs, useCronJob, useCronHistory | useCreateCronJob, useUpdateCronJob, useDeleteCronJob, useToggleCronJob, useRunCronJob |
| `mail.ts` | useMailDomainInfo, useMailboxes, useMailAliases, useDkimStatus, useMailQueue | useEnableMail, useDisableMail, useCreateMailbox, useUpdateMailbox, useDeleteMailbox, useCreateAlias, useDeleteAlias, +DKIM/SPF/DMARC/spam |
| `dns.ts` | useDnsZone, useExportZone, useRawZone, usePropagationCheck, useCloudflareConfig | useCreateDnsRecord, useUpdateDnsRecord, useDeleteDnsRecord, useImportZone, useResetDnsZone, useUpdateSoaRecord, +Cloudflare sync |
| `ssl.ts` | useSslCertificates, useSslCertificate, useExpiringCerts, useCertDetails | useIssueLetsEncrypt, useUploadCustomCert, useGenerateSelfSigned, useDeleteCertificate, useRenewCertificate, useToggleAutoRenew, useDownloadCert, useValidateChain, useCheckMixedContent, useUpdateHsts, useUpdateOcspStapling |
| `firewall.ts` | useFirewallStatus, useFirewallRules, useFail2BanJails | useAddFirewallRule, useDeleteFirewallRule, useApplyFirewallPreset, useToggleFirewall, useUnbanIp, useBanIp, useResetFirewallRules, useToggleRule |
| `backup.ts` | useBackups, useBackupSchedules, useRemoteStorageConfig | useCreateBackup, useRestoreBackup, useDeleteBackup, useDownloadBackup, useVerifyBackup, useCreateBackupSchedule, useDeleteBackupSchedule, useToggleBackupSchedule, useUpdateRemoteStorage |
| `stats.ts` | useServerStats, useServiceStatuses, useDashboardSummary, useNetworkStats, useDiskDetails, useExpiringSslCerts, useProcesses, useDomainStats, useDiskIO, +bandwidth/FD/TCP | useRestartService |
| `tokens.ts` | useTokens, useTokenUsage | useCreateToken, useRevokeToken |
| `tunnel.ts` | useTunnelStatus, useTunnelRoutes, useTunnelInfo, useTunnelConfig, useTunnelLogs | useValidateToken, useFetchZones, useSetupTunnel, useDeleteTunnel, useStartTunnel, useStopTunnel, useAddTunnelRoute, useEditTunnelRoute, useDeleteTunnelRoute, useToggleTunnelRoute, useCreateDnsCname |
| `settings.ts` | useServerIdentity, useTimezone, useAvailableTimezones, useBackupSettings, useSecuritySettings, useSystemUpdates, usePanelSettings, useNameserverSettings, useSessionSettings, usePasswordPolicy, useSystemInfo, useSshSettings, useDataRetention, +port/webserver/SSL email/maintenance | +update mutations for each |
| `notifications.ts` | useNotificationPreferences, useNotifications, useUnreadCount | useUpdateNotificationPreferences, useMarkAsRead, useMarkAllAsRead, useDeleteNotification |
| `audit.ts` | useAuditLog | — |
| `files.ts` | useDirectoryListing, useFileContent, useDirectoryTree, useDirectorySize, useFileOwnership | useCreateDirectory, useDeleteFile, useRenameFile, useSaveFileContent, useChmod, useArchive, useExtract, useCopyFile, useMoveFile |
| `logs.ts` | useAccessLogs, useErrorLogs, usePanelLogs, useFail2banLogs, useAuthLogs, useSystemLogs | — |
| `webserver.ts` | useWebserverStatus, useWebserverDomains, useVhostConfig, usePreviewConfig, useCustomErrorPages, useRateLimitConfig | useUpdateVhost, useTestConfig, useReloadServer, useUpdateCustomErrorPages, useUpdateRateLimitConfig |
| `php.ts` | usePhpVersions, usePhpDomains, usePhpConfig, usePhpIni, usePhpInfo, useFpmStatus | useSetPhpVersion, useUpdatePoolSettings, useUpdatePhpLimits, useUpdatePhpSecurity, useRestartFpm, useInstallPhp, useUpdatePhpIni |
| `installer.ts` | useInstallerApps, useAppDetails, useInstallStatus, useInstalledApps, useAppConfigs, useInstallLogs | useInstallApp, useUninstallApp, useUpdateApp, useSetAppConfig, useDeleteAppConfig, useCheckPath |

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| `AuthGuard` | `components/auth/AuthGuard.tsx` | Redirects to `/login` if not authenticated, renders `AppLayout` |
| `AppLayout` | `components/layout/AppLayout.tsx` | Sidebar + TopBar + main content area |
| `Sidebar` | `components/layout/Sidebar.tsx` | Collapsible navigation with grouped links |
| `TopBar` | `components/layout/TopBar.tsx` | Notification bell dropdown, user profile link, logout |

### Shared UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `EmptyState` | `components/ui/EmptyState.tsx` | Icon + title + description + optional CTA |
| `LoadingSpinner` | `components/ui/LoadingSpinner.tsx` | Spinner + message |
| `PageHeader` | `components/ui/PageHeader.tsx` | Title + description + action buttons |
| `Toast` | `components/ui/Toast.tsx` | Toast provider with success/error/warning/info types |

---

## CHECK UI-1 — Every Interactive Element Has a Handler

### WHAT IS WORKING CORRECTLY

- All `<button>` elements across all pages have onClick handlers
- All `<Link>` components in Sidebar have valid `to` destinations
- All `<form>` elements have onSubmit handlers
- All `<input>`, `<select>`, `<textarea>` elements have onChange handlers
- All toggle switches have onClick handlers
- No buttons with empty `onClick={() => {}}` found

### Issues

#### UI-HIGH-01

**Page / Component:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:108)  
**Check:** UI-1  
**Issue:** DNS record error handling uses `alert()` instead of inline error display  
**User Impact:** Browser alert dialog interrupts workflow and looks unprofessional  
**Evidence:** `onError: (e: any) => alert(e.message)` at lines 108, 113, 671, 682  
**Fix Required:** Replace `alert()` calls with inline error state display, matching the pattern used in other modals

#### UI-HIGH-02

**Page / Component:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:124)  
**Check:** UI-1  
**Issue:** FTP change password validation uses `alert()` instead of inline error messages  
**User Impact:** Browser alert dialog interrupts workflow  
**Evidence:** `if (password !== confirm) { alert('Passwords do not match'); return; }` at lines 124-125  
**Fix Required:** Replace `alert()` with inline validation error display, matching the pattern in `ChangePasswordModal` in DatabasesPage

#### UI-MEDIUM-03

**Page / Component:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:388)  
**Check:** UI-1  
**Issue:** Cron job run failure uses `alert()` for error feedback  
**User Impact:** Browser alert dialog for run failure  
**Evidence:** `onError: () => alert('Failed to run job')` at line 388  
**Fix Required:** Display error inline or via toast notification

#### UI-MEDIUM-04

**Page / Component:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx:778)  
**Check:** UI-1  
**Issue:** Mail catch-all update success uses `alert()` instead of toast  
**User Impact:** Browser alert interrupts workflow on success  
**Evidence:** `onSuccess: () => alert('Catch-all address updated.')` at line 778  
**Fix Required:** Replace with `toast.success()` call

#### UI-MEDIUM-05

**Page / Component:** [`NotificationsPage.tsx`](apps/web/src/pages/notifications/NotificationsPage.tsx:865)  
**Check:** UI-1  
**Issue:** Alert rule deletion uses `window.confirm()` instead of custom confirmation dialog  
**User Impact:** Browser confirm dialog looks unprofessional and inconsistent with the rest of the UI  
**Evidence:** `if (confirm('Delete rule "${rule.name}"?'))` at line 865  
**Fix Required:** Replace with a custom confirmation modal matching the app pattern

#### UI-MEDIUM-06

**Page / Component:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1287)  
**Check:** UI-1  
**Issue:** Config import error uses `alert()` for invalid JSON feedback  
**User Impact:** Browser alert for import errors  
**Evidence:** `alert('Invalid JSON file. Please select a valid panel configuration file.')` at line 1287  
**Fix Required:** Use inline error or toast notification

---

## CHECK UI-2 — Every Form Is Complete

### WHAT IS WORKING CORRECTLY

- Login form: controlled inputs with value + onChange, submit disabled while loading, error display ✓
- TwoFactorForm: controlled inputs, auto-submit on completion, submit disabled while loading ✓
- ForgotPasswordModal: controlled input, submit disabled while pending, success state ✓
- CreateDomainForm: controlled inputs with value + onChange, submit disabled while loading ✓
- DomainsPage DeleteConfirm: controlled input with validation ✓
- MailPage MailboxFormModal: password show/hide toggle ✓
- ApiTokensPage CreateTokenModal: wrapped in `<form>`, onSubmit handler, disabled while pending ✓
- DatabasesPage ChangePasswordModal: controlled inputs, validation, disabled while pending ✓
- ProfilePage forms: controlled inputs, submit disabled while pending, success feedback ✓
- Most modals close on success and show errors inline ✓

### Issues

#### UI-HIGH-07

**Page / Component:** [`LoginForm.tsx`](apps/web/src/pages/login/LoginForm.tsx:209)  
**Check:** UI-2  
**Issue:** Login password field has no show/hide toggle  
**User Impact:** Users cannot verify their password before submitting, leading to typos and failed logins  
**Evidence:** `type="password"` at line 209 with no toggle button, unlike MailPage which has `<Eye>`/`<EyeOff>` toggle  
**Fix Required:** Add show/hide password toggle matching the pattern in `MailboxFormModal` at [`MailPage.tsx:139-144`](apps/web/src/pages/mail/MailPage.tsx:139)

#### UI-HIGH-08

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:99)  
**Check:** UI-2  
**Issue:** CreateUserModal password field has no show/hide toggle  
**User Impact:** Users cannot verify the generated password  
**Evidence:** `type="password"` at line 99 with no toggle  
**Fix Required:** Add show/hide toggle for password field

#### UI-HIGH-09

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:152)  
**Check:** UI-2  
**Issue:** ChangePasswordModal password fields have no show/hide toggle  
**User Impact:** Users cannot verify password entry  
**Evidence:** `type="password"` at lines 152, 167 with no toggle  
**Fix Required:** Add show/hide toggle for both password fields

#### UI-MEDIUM-10

**Page / Component:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:44)  
**Check:** UI-2  
**Issue:** CreateAccountModal password field has no show/hide toggle  
**User Impact:** Users cannot verify the generated password  
**Evidence:** `type="password"` at line 44 with no toggle  
**Fix Required:** Add show/hide toggle for password field

#### UI-MEDIUM-11

**Page / Component:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:147)  
**Check:** UI-2  
**Issue:** ChangePasswordModal password fields have no show/hide toggle  
**User Impact:** Users cannot verify password entry  
**Evidence:** `type="password"` at lines 147, 153 with no toggle  
**Fix Required:** Add show/hide toggle for password fields

#### UI-MEDIUM-12

**Page / Component:** [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:210)  
**Check:** UI-2  
**Issue:** Password change form fields have no show/hide toggle  
**User Impact:** Users cannot verify current/new password entry  
**Evidence:** `type="password"` at lines 150, 210, 220, 234, 337 with no toggle  
**Fix Required:** Add show/hide toggle for all password fields

#### UI-MEDIUM-13

**Page / Component:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:198)  
**Check:** UI-2  
**Issue:** Encryption password field has no show/hide toggle  
**User Impact:** Users cannot verify encryption password  
**Evidence:** `type="password"` at line 198 with no toggle  
**Fix Required:** Add show/hide toggle for encryption password field

#### UI-MEDIUM-14

**Page / Component:** [`InstallerPage.tsx`](apps/web/src/pages/installer/InstallerPage.tsx:397)  
**Check:** UI-2  
**Issue:** Admin password field has no show/hide toggle  
**User Impact:** Users cannot verify the installation password  
**Evidence:** `type="password"` at line 397 with no toggle  
**Fix Required:** Add show/hide toggle for admin password field

#### UI-MEDIUM-15

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:17)  
**Check:** UI-2  
**Issue:** CreateDbModal is not wrapped in a `<form>` element — uses onClick instead of onSubmit  
**User Impact:** Pressing Enter in the database name field does not submit the form  
**Evidence:** Modal at lines 31-68 uses `<div>` containers and `onClick={handleSubmit}` instead of `<form onSubmit={handleSubmit}>`  
**Fix Required:** Wrap in `<form onSubmit>` and use submit button

#### UI-MEDIUM-16

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:71)  
**Check:** UI-2  
**Issue:** CreateUserModal is not wrapped in a `<form>` element  
**User Impact:** Pressing Enter in fields does not submit  
**Evidence:** Modal at lines 86-118 uses `onClick={handleSubmit}` instead of `<form onSubmit>`  
**Fix Required:** Wrap in `<form onSubmit>` element

#### UI-MEDIUM-17

**Page / Component:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:155)  
**Check:** UI-2  
**Issue:** CreateJobModal is not wrapped in a `<form>` element  
**User Impact:** Pressing Enter in the command field does not submit  
**Evidence:** Modal at lines 179-250 uses `onClick={handleSubmit}` instead of `<form onSubmit>`  
**Fix Required:** Wrap in `<form onSubmit>` element

#### UI-LOW-18

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:58)  
**Check:** UI-2  
**Issue:** CreateDbModal error display uses `String(createDb.error)` which may show `[object Object]`  
**User Impact:** Cryptic error messages instead of human-readable text  
**Evidence:** `{String(createDb.error)}` at line 58  
**Fix Required:** Extract message property from error: `(createDb.error as any)?.message || String(createDb.error)`

#### UI-LOW-19

**Page / Component:** Multiple modals in [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:60), [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:244), [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:211)  
**Check:** UI-2  
**Issue:** Error display uses `String(error)` which may show `[object Object]`  
**User Impact:** Cryptic error messages  
**Evidence:** `String(create.error)`, `String(update.error)`, etc. in multiple locations  
**Fix Required:** Extract `.message` from error objects consistently

---

## CHECK UI-3 — Every Page Has All Render States

### WHAT IS WORKING CORRECTLY

- **DomainsPage**: Loading → LoadingSpinner, Error → error message with retry, Empty → EmptyState with CTA, Populated → data table ✓
- **DatabasesPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → data cards ✓
- **FtpPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → account list ✓
- **CronPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → job list ✓
- **MailPage**: Loading → LoadingSpinner, Empty → EmptyState per tab, Populated → mailbox/alias lists ✓
- **SslPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → certificate cards ✓
- **DnsPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → record groups ✓
- **FirewallPage**: Loading → LoadingSpinner, Empty → EmptyState per tab, Populated → rule list ✓
- **BackupsPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → backup list ✓
- **AuditPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → paginated table ✓
- **NotificationsPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → notification list ✓
- **TunnelsPage**: Loading → LoadingSpinner, Empty → EmptyState, Populated → tunnel list ✓
- **ApiTokensPage**: Loading → LoadingSpinner, Populated → token list ✓

### Issues

#### UI-HIGH-20

**Page / Component:** [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx:299)  
**Check:** UI-3  
**Issue:** No error state with retry button — if server stats fail to load, user sees only a spinner or blank page  
**User Impact:** If the API is down, the dashboard shows a loading spinner indefinitely with no way to retry  
**Evidence:** `if (statsLoading) { return <LoadingSpinner />; }` at line 299 — no `isError` check  
**Fix Required:** Add error state check: `if (isError) return <error message with retry button>`

#### UI-MEDIUM-21

**Page / Component:** [`MonitoringPage.tsx`](apps/web/src/pages/monitoring/MonitoringPage.tsx:660)  
**Check:** UI-3  
**Issue:** No error state with retry — `isError` from `useServerStats` is fetched but not rendered  
**User Impact:** If monitoring data fails, user sees only a spinner  
**Evidence:** `const { data: stats, isLoading: statsLoading, isError: statsError } = useServerStats()` at line 610, but `statsError` is never used in render  
**Fix Required:** Add error state rendering for `statsError`

#### UI-MEDIUM-22

**Page / Component:** [`WebserverPage.tsx`](apps/web/src/pages/webserver/WebserverPage.tsx:337)  
**Check:** UI-3  
**Issue:** No error state and no empty state for the main page  
**User Impact:** If webserver status fails to load, user sees only a spinner  
**Evidence:** `if (statusLoading) return <LoadingSpinner />;` at line 337 — no error/empty handling  
**Fix Required:** Add error state with retry and empty state when no domains are available

#### UI-MEDIUM-23

**Page / Component:** [`PhpPage.tsx`](apps/web/src/pages/php/PhpPage.tsx:302)  
**Check:** UI-3  
**Issue:** No error state for the main page  
**User Impact:** If PHP versions fail to load, user sees only a spinner  
**Evidence:** `if (versionsLoading) return <LoadingSpinner />;` at line 302 — no error handling  
**Fix Required:** Add error state with retry button

#### UI-MEDIUM-24

**Page / Component:** [`ProfilePage.tsx`](apps/web/src/pages/settings/ProfilePage.tsx:53)  
**Check:** UI-3  
**Issue:** No loading state — profile data is rendered immediately from Zustand store without a loading skeleton  
**User Impact:** Brief flash of empty/default content before store hydrates from localStorage  
**Evidence:** ProfileSection reads directly from `useAuthStore()` with no loading guard  
**Fix Required:** This is low severity since Zustand persists from localStorage, but consider adding a hydration check

#### UI-LOW-25

**Page / Component:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:204)  
**Check:** UI-3  
**Issue:** Individual settings sections show LoadingSpinner but no error state  
**User Impact:** If a specific settings API call fails, the section shows a spinner indefinitely  
**Evidence:** Each section has `if (isLoading) return <LoadingSpinner />;` but no error check  
**Fix Required:** Add error state with retry for each settings section

---

## CHECK UI-4 — Destructive Action Confirmation Flows

### WHAT IS WORKING CORRECTLY

- **Delete Domain** (Level 3): Type-to-confirm dialog in [`DeleteConfirm`](apps/web/src/pages/domains/DomainsPage.tsx:192) — user must type domain name ✓
- **Delete SSL Certificate** (Level 2): Confirmation dialog in [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:845) ✓
- **Revoke API Token** (Level 2): Confirmation dialog in [`RevokeConfirmModal`](apps/web/src/pages/settings/ApiTokensPage.tsx:316) ✓
- **Reset Firewall Rules** (Level 2): Confirmation modal in [`ResetConfirmModal`](apps/web/src/pages/firewall/FirewallPage.tsx:313) ✓
- **Toggle Firewall On/Off** (Level 2): Confirmation modal in [`ConfirmModal`](apps/web/src/pages/firewall/FirewallPage.tsx:364) ✓
- **Reboot Server** (Level 4): Confirmation modal in [`ConfirmModal`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1183) ✓
- **Shutdown Server** (Level 4): Confirmation modal in [`ConfirmModal`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1194) ✓
- **Delete Tunnel** (Level 2): Confirmation in tunnel detail modal [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:351) ✓
- **Delete Backup** (Level 2): Confirmation implied via delete button with loading state ✓
- **Restore Backup** (Level 2): Restore confirmation modal in [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:239) ✓

### Issues

#### UI-CRITICAL-26

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:522)  
**Check:** UI-4  
**Issue:** **No confirmation dialog before deleting a database** — the delete mutation fires immediately  
**User Impact:** Accidental click on the delete button permanently destroys a database with all its data, with no confirmation  
**Evidence:** `deleteDb.mutate(database.id)` is called directly without any confirmation dialog  
**Fix Required:** Add a type-to-confirm dialog (Level 3 — delete database) requiring the user to type the database name before confirming

#### UI-CRITICAL-27

**Page / Component:** [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:320)  
**Check:** UI-4  
**Issue:** **No confirmation dialog before deleting an FTP account**  
**User Impact:** Accidental click on the delete button removes FTP access immediately  
**Evidence:** `deleteAccount.mutate(account.id)` is called directly without confirmation  
**Fix Required:** Add a confirmation dialog (Level 2) stating the consequence: "This will revoke FTP access for username X"

#### UI-CRITICAL-28

**Page / Component:** [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:367)  
**Check:** UI-4  
**Issue:** **No confirmation dialog before deleting a cron job**  
**User Impact:** Accidental click on the delete button removes a scheduled task immediately  
**Evidence:** `deleteJob.mutate(job.id)` is called directly without confirmation  
**Fix Required:** Add a confirmation dialog (Level 2) stating the consequence: "This will remove the scheduled task and it will no longer execute"

#### UI-HIGH-29

**Page / Component:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx)  
**Check:** UI-4  
**Issue:** **No confirmation dialog before deleting a mailbox** — all email will be lost  
**User Impact:** Accidental click deletes a mailbox and all its email permanently  
**Evidence:** `useDeleteMailbox` mutation is called without confirmation  
**Fix Required:** Add a confirmation dialog (Level 2) stating: "This will permanently delete the mailbox and all its email messages"

#### UI-HIGH-30

**Page / Component:** [`MailPage.tsx`](apps/web/src/pages/mail/MailPage.tsx)  
**Check:** UI-4  
**Issue:** **No confirmation dialog before deleting a mail alias**  
**User Impact:** Accidental click removes email forwarding immediately  
**Evidence:** `useDeleteAlias` mutation is called without confirmation  
**Fix Required:** Add a confirmation dialog (Level 1)

#### UI-HIGH-31

**Page / Component:** [`FirewallPage.tsx`](apps/web/src/pages/firewall/FirewallPage.tsx)  
**Check:** UI-4  
**Issue:** **No confirmation dialog before deleting a firewall rule** — could lock users out  
**User Impact:** Accidental deletion of a critical rule like SSH could lock the user out of the server  
**Evidence:** `useDeleteFirewallRule` mutation is called without confirmation  
**Fix Required:** Add a confirmation dialog (Level 2) with warning about potential lockout risk

#### UI-HIGH-32

**Page / Component:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:285)  
**Check:** UI-4  
**Issue:** **Bulk suspend/activate/delete actions have no confirmation dialog**  
**User Impact:** Clicking "Delete" in the bulk action bar immediately deletes all selected domains  
**Evidence:** BulkActionBar at line 285 fires mutations directly without confirmation  
**Fix Required:** Add confirmation dialogs for bulk suspend (Level 1), bulk delete (Level 3 type-to-confirm)

#### UI-MEDIUM-33

**Page / Component:** [`ServerSettingsPage.tsx`](apps/web/src/pages/settings/ServerSettingsPage.tsx:1183)  
**Check:** UI-4  
**Issue:** Reboot and shutdown only have single confirmation — should be double confirmation (Level 4)  
**User Impact:** Single misclick on "Confirm" could reboot the production server  
**Evidence:** `ConfirmModal` at lines 1183-1202 only requires one confirmation click  
**Fix Required:** Add a second confirmation step: "Are you really sure? This will reboot the server and all services will be temporarily unavailable"

#### UI-MEDIUM-34

**Page / Component:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:669)  
**Check:** UI-4  
**Issue:** DNS record deletion has no confirmation dialog  
**User Impact:** Accidental click deletes a DNS record, potentially taking a service offline  
**Evidence:** `handleDeleteRecord` at line 669 calls delete mutation directly — only system records are protected with `alert()`  
**Fix Required:** Add confirmation dialog for non-system DNS record deletion (Level 2)

#### UI-MEDIUM-35

**Page / Component:** [`DnsPage.tsx`](apps/web/src/pages/dns/DnsPage.tsx:737)  
**Check:** UI-4  
**Issue:** DNS zone reset to defaults has only an inline confirm button, not a modal  
**User Impact:** Accidental click resets all custom DNS records  
**Evidence:** Inline confirm at line 737 — no modal, just a button that appears  
**Fix Required:** Use a proper confirmation modal with consequence stated

#### UI-MEDIUM-36

**Page / Component:** [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx:443)  
**Check:** UI-4  
**Issue:** File/folder deletion has no confirmation dialog  
**User Impact:** Accidental click permanently deletes files  
**Evidence:** `handleDelete` at line 443 calls delete mutation directly  
**Fix Required:** Add confirmation dialog (Level 2 for files, Level 1 for folders)

#### UI-LOW-37

**Page / Component:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx)  
**Check:** UI-4  
**Issue:** Domain suspend action has no confirmation dialog (Level 1)  
**User Impact:** Accidental click suspends a domain, taking its website offline  
**Evidence:** Suspend action in domain row actions fires immediately  
**Fix Required:** Add simple confirmation dialog: "Suspend domain X? The website will go offline"

---

## CHECK UI-5 — Modal and Drawer Lifecycle

### WHAT IS WORKING CORRECTLY

- Most modals have X close buttons ✓
- Most modals use `bg-black/50` backdrop overlay ✓
- Edit modals pre-fill with current values (e.g., EditAccountModal in FtpPage, MailboxFormModal in MailPage) ✓
- Form fields reset on close in most modals (e.g., CreateDbModal resets form in onSuccess) ✓
- Toast notifications shown on success in many modals ✓
- AuditPage detail modal supports backdrop click to close ✓

### Issues

#### UI-HIGH-38

**Page / Component:** All modals across [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:32), [`FtpPage.tsx`](apps/web/src/pages/ftp/FtpPage.tsx:30), [`CronPage.tsx`](apps/web/src/pages/cron/CronPage.tsx:180), [`FirewallPage.tsx`](apps/web/src/pages/firewall/FirewallPage.tsx:93), [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:66), [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:54), [`SslPage.tsx`](apps/web/src/pages/ssl/SslPage.tsx:167)  
**Check:** UI-5  
**Issue:** **Most modals do not close on backdrop click or Escape key** — only the X button works  
**User Impact:** Users expect to dismiss modals by clicking outside or pressing Escape, which is standard UX. Currently they must find and click the X button.  
**Evidence:** Modal backdrop `<div className="fixed inset-0 z-50 ... bg-black/50">` has no `onClick={onClose}` handler in most modals. Compare with AuditPage which correctly has `onClick={onClose}` on the backdrop.  
**Fix Required:** Add `onClick={onClose}` to backdrop div and `onClick={(e) => e.stopPropagation()}` on the modal content div. Add Escape key handler via `useEffect`.

#### UI-HIGH-39

**Page / Component:** All modals across the application  
**Check:** UI-5  
**Issue:** **Page remains scrollable behind open modals** — no `overflow: hidden` on body  
**User Impact:** Users can scroll the background page while a modal is open, which is disorienting  
**Evidence:** No `useEffect` to toggle `document.body.style.overflow` when modal mounts/unmounts  
**Fix Required:** Add a `useEffect` in each modal (or create a shared `useModal` hook) that sets `document.body.style.overflow = 'hidden'` on mount and restores it on unmount

#### UI-MEDIUM-40

**Page / Component:** [`DatabasesPage.tsx`](apps/web/src/pages/databases/DatabasesPage.tsx:17)  
**Check:** UI-5  
**Issue:** CreateDbModal form fields are NOT reset on close when there is an error  
**User Impact:** If creation fails and user closes the modal, reopening it shows the old failed values  
**Evidence:** `onClose()` is called in `onSuccess` callback at line 25, but there is no reset on manual close (Cancel button just calls `onClose()` without resetting form)  
**Fix Required:** Reset form state when Cancel is clicked, or when modal opens

#### UI-MEDIUM-41

**Page / Component:** [`TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx:53)  
**Check:** UI-5  
**Issue:** Setup modal has no X close button on the initial step  
**User Impact:** User cannot dismiss the setup modal without completing the flow or refreshing  
**Evidence:** Modal at line 53 has `<h2>` but no close button  
**Fix Required:** Add X close button to the setup modal header

#### UI-MEDIUM-42

**Page / Component:** Multiple modals  
**Check:** UI-5  
**Issue:** Nested modals (e.g., opening DeleteConfirm from within a domain detail view) may have z-index conflicts  
**User Impact:** Delete confirmation modal may appear behind the detail panel  
**Evidence:** Both use `z-50` — no z-index escalation for nested modals  
**Fix Required:** Use `z-[60]` or higher for confirmation modals that appear on top of other modals

#### UI-LOW-43

**Page / Component:** [`BackupsPage.tsx`](apps/web/src/pages/backups/BackupsPage.tsx:46)  
**Check:** UI-5  
**Issue:** BackupProgressModal cannot be closed until complete — no X button during progress  
**User Impact:** User is forced to wait for the progress simulation to complete  
**Evidence:** X button only renders when `complete` is true at line 71  
**Fix Required:** Allow closing the progress modal at any time, or at minimum show a "Close" button that confirms the backup will continue in the background

---

## SUMMARY

### Issues by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 3 | UI-26, UI-27, UI-28 — No confirmation for database/FTP/cron deletion |
| HIGH | 12 | UI-01 through UI-08, UI-20, UI-29, UI-30, UI-31, UI-32, UI-38, UI-39 |
| MEDIUM | 21 | UI-03 through UI-05, UI-09 through UI-19, UI-21 through UI-25, UI-33 through UI-37, UI-40 through UI-43 |
| LOW | 5 | UI-18, UI-19, UI-24, UI-25, UI-37 |
| **Total** | **41** | |

### Issues by Check

| Check | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-------|----------|------|--------|-----|-------|
| UI-1: Interactive Handlers | 0 | 2 | 4 | 0 | 6 |
| UI-2: Form Completeness | 0 | 3 | 10 | 2 | 15 |
| UI-3: Render States | 0 | 1 | 4 | 1 | 6 |
| UI-4: Destructive Confirmations | 3 | 4 | 4 | 1 | 12 |
| UI-5: Modal Lifecycle | 0 | 2 | 3 | 1 | 6 |

### Priority Fixes

1. **CRITICAL**: Add confirmation dialogs for database deletion, FTP account deletion, and cron job deletion (UI-26, UI-27, UI-28)
2. **HIGH**: Add backdrop click and Escape key handling to all modals (UI-38)
3. **HIGH**: Prevent body scroll behind modals (UI-39)
4. **HIGH**: Add error states with retry to DashboardPage and MonitoringPage (UI-20, UI-21)
5. **HIGH**: Replace all `alert()`/`confirm()` calls with proper UI components (UI-01 through UI-06)
6. **HIGH**: Add show/hide toggles to all password fields (UI-07 through UI-14)
