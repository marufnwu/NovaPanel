# NovaPanel UI Structure Map

**Generated from:** Actual file reads (not assumption)
**Date:** 2026-05-09
**Source Files:** All page components, router, layout components

---

## 1. Navigation Structure

### 1.1 Sidebar Navigation (7 Groups)

**Source:** [`apps/web/src/components/layout/Sidebar.tsx`](apps/web/src/components/layout/Sidebar.tsx)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo]                                           [−][□][×]      │
├─────────────────────────────────────────────────────────────────┤
│ OVERVIEW                                                         │
│   🏠 Dashboard                                                   │
├─────────────────────────────────────────────────────────────────┤
│ WEB                                                              │
│   🌐 Domains                                                     │
│   📁 Websites                                                    │
│   🌐 Web Server                                                  │
│   🐘 PHP                                                         │
│   🔒 SSL                                                         │
├─────────────────────────────────────────────────────────────────┤
│ SERVICES                                                         │
│   📝 DNS                                                         │
│   📧 Mail                                                        │
│   💾 Databases                                                   │
│   📂 FTP                                                         │
├─────────────────────────────────────────────────────────────────┤
│ NETWORK                                                          │
│   ☁️ Cloudflare                                                 │
├─────────────────────────────────────────────────────────────────┤
│ SYSTEM                                                           │
│   📄 Files                                                       │
│   💻 Terminal                                                   │
│   ⏰ Cron                                                        │
│   🛡️ Firewall                                                   │
│   📊 Logs                                                       │
│   📈 Monitoring                                                 │
├─────────────────────────────────────────────────────────────────┤
│ TOOLS                                                            │
│   💿 Backups                                                     │
│   📦 Installer                                                  │
│   🔔 Notifications                                              │
│   📋 Audit Log                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ACCOUNT                                                          │
│   👤 Profile                                                    │
│   ⚙️ Server Settings                                            │
│   🔑 API Tokens                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Collapse Behavior:** Sidebar is collapsible. State persisted in localStorage.

### 1.2 Top Bar

**Source:** [`apps/web/src/components/layout/TopBar.tsx`](apps/web/src/components/layout/TopBar.tsx:1-100)

| Element | Position | Function |
|---------|----------|----------|
| Notification Bell | Left | Shows unread count badge, opens notification dropdown |
| Theme Toggle | Right | Switch light/dark mode |
| User Avatar | Right | Shows display name, 2FA shield icon if enabled |
| Settings Link | Right | Links to `/settings` |
| Logout Button | Right | Signs out user |

### 1.3 Breadcrumb Bar

**Source:** [`apps/web/src/components/layout/AppLayout.tsx`](apps/web/src/components/layout/AppLayout.tsx:1-50)

Auto-generates from pathname using `PATH_LABELS` map.

---

## 2. Route Map

**Source:** [`apps/web/src/router.tsx`](apps/web/src/router.tsx)

| Route | Component | Protected |
|-------|-----------|-----------|
| `/login` | `LoginPage` | No |
| `/` | `DashboardPage` | Yes |
| `/domains` | `DomainsPage` | Yes |
| `/domains/:id` | `DomainDetailPage` | Yes |
| `/websites` | `WebsitesPage` | Yes |
| `/websites/:id` | `WebsiteDetailPage` | Yes |
| `/websites/:id/ssl` | `SslPage` | Yes |
| `/ssl` | `SslPage` | Yes |
| `/databases` | `DatabasesPage` | Yes |
| `/databases/:id` | `DatabaseDetailPage` | Yes |
| `/files` | `FilesPage` | Yes |
| `/dns` | `DnsPage` | Yes |
| `/mail` | `MailPage` | Yes |
| `/ftp` | `FtpPage` | Yes |
| `/cron` | `CronPage` | Yes |
| `/firewall` | `FirewallPage` | Yes |
| `/logs` | `LogsPage` | Yes |
| `/backups` | `BackupsPage` | Yes |
| `/audit` | `AuditPage` | Yes |
| `/php` | `PhpPage` | Yes |
| `/terminal` | `TerminalPage` | Yes |
| `/monitoring` | `MonitoringPage` | Yes |
| `/webserver` | `WebserverPage` | Yes |
| `/cloudflare` | `CloudflarePage` | Yes |
| `/tunnels` | `TunnelsPage` | Yes |
| `/settings` | `ServerSettingsPage` | Yes |
| `/settings/profile` | `ProfilePage` | Yes |
| `/settings/api-tokens` | `ApiTokensPage` | Yes |
| `/notifications` | `NotificationsPage` | Yes |
| `/installer` | `InstallerPage` | Yes |

---

## 3. Page-by-Page Template

### 3.1 Dashboard Page
**File:** `apps/web/src/pages/dashboard/DashboardPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Overview of server health and quick access to recent activity |
| **Data Hooks** | `useStats()`, `useDomains()`, `useWebsites()`, `useBackups()`, `useNotifications()` |
| **Tabs** | None |
| **Layout** | Grid of stat cards + recent activity list + quick actions |
| **Interactive Elements** | Stat cards with progress bars, recent activity list, quick action buttons |
| **Modals** | None in page itself |
| **States** | Loading, Error, Empty |

---

### 3.2 Domains Page
**File:** `apps/web/src/pages/domains/DomainsPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | List and manage all domains |
| **Data Hooks** | `useDomains()` |
| **Tabs** | None |
| **Layout** | Table with domain list + Create Domain button |
| **Interactive Elements** | Domain table (sortable), Create button, Search filter |
| **Modals** | `CreateDomainModal` |
| **States** | Loading, Error, Empty |

**Modals:**
- `CreateDomainModal`: Domain name input, auto-soa template selection

---

### 3.3 Domain Detail Page
**File:** `apps/web/src/pages/domains/DomainDetailPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Manage single domain settings, SSL, DNS records |
| **Data Hooks** | `useDomain(id)`, `useDnsRecords(domainId)` |
| **Tabs** | Overview, DNS Records, SSL, Cloudflare (conditional) |
| **Layout** | Tabbed interface with domain info header |
| **Interactive Elements** | DNS record table (add/edit/delete), SSL toggle, Cloudflare panel |
| **Modals** | `CreateRecordModal`, `EditRecordModal`, `DeleteConfirmModal` |
| **States** | Loading, Error |

**Conditional Tab:** Cloudflare tab only shows when Cloudflare is configured.

---

### 3.4 Websites Page
**File:** `apps/web/src/pages/websites/WebsitesPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | List all hosted websites |
| **Data Hooks** | `useWebsites()`, `useDomains()` |
| **Tabs** | None |
| **Layout** | Card grid with website info |
| **Interactive Elements** | Website cards (click → placeholder "Phase 8"), Create button |
| **Modals** | `CreateWebsiteModal` |
| **States** | Loading, Error, Empty |

**⚠️ GAP:** Row clicks have placeholder comments ("Navigation will be wired in Phase 8")

---

### 3.5 Website Detail Page
**File:** `apps/web/src/pages/websites/WebsiteDetailPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Manage website configuration, files, SSL |
| **Data Hooks** | `useWebsite(id)`, `useDomain(id)` |
| **Tabs** | Overview, Config, SSL, Files (placeholder), Cron, Logs |
| **Layout** | Tabbed interface with website header |
| **Interactive Elements** | Website config forms, SSL management, tab navigation |
| **Modals** | Various config modals |
| **States** | Loading, Error |

**⚠️ GAP:** FilesTab is a placeholder linking to `/files`

---

### 3.6 SSL Page
**File:** `apps/web/src/pages/ssl/SslPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Manage SSL certificates for all domains |
| **Data Hooks** | `useSslCertificates()`, `useDomains()` |
| **Tabs** | Let's Encrypt, Custom Certificate, Self-Signed |
| **Layout** | Tabbed certificate management |
| **Interactive Elements** | Certificate tables, issue/renew/revoke buttons, domain selector |
| **Modals** | `IssueCertificateModal`, `UploadCertificateModal`, `ConfirmDialog` |
| **States** | Loading, Error, Empty per tab |

---

### 3.7 Databases Page
**File:** `apps/web/src/pages/databases/DatabasesPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Manage MariaDB and PostgreSQL databases |
| **Data Hooks** | `useDatabases()` |
| **Tabs** | None (list view) |
| **Layout** | Table with database list + create button |
| **Interactive Elements** | Database table, create button, search filter |
| **Modals** | `CreateDatabaseModal`, `CreateUserModal` |
| **States** | Loading, Error, Empty |

---

### 3.8 Database Detail Page
**File:** `apps/web/src/pages/databases/DatabaseDetailPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Manage single database, users, privileges |
| **Data Hooks** | `useDatabase(id)`, `useDatabaseUsers(databaseId)` |
| **Tabs** | Overview, Users, Privileges |
| **Layout** | Tabbed interface |
| **Interactive Elements** | User table, privilege editor, phpmyadmin link |
| **Modals** | `CreateUserModal`, `DeleteConfirmModal` |
| **States** | Loading, Error |

---

### 3.9 Files Page
**File:** `apps/web/src/pages/files/FilesPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Web-based file manager |
| **Data Hooks** | `useFiles(path)`, `useDomains()` |
| **Tabs** | File browser + domain selector |
| **Layout** | Split: folder tree (left) + file list (right) |
| **Interactive Elements** | Tree navigation, file grid/list toggle, upload, new folder, context menus |
| **Modals** | `NewFolderModal`, `RenameModal`, `DeleteConfirmModal`, `MoveModal`, `CopyModal`, `FilePreviewModal`, `CodeEditor` |
| **States** | Loading, Error, Empty, Selected |

**Features:**
- Tree view with expand/collapse
- Drag-and-drop for move/copy
- Batch selection and operations
- Code editor for text files
- File preview modal
- Upload with progress

---

### 3.10 DNS Page
**File:** `apps/web/src/pages/dns/DnsPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | DNS zone management with BIND format |
| **Data Hooks** | `useDnsZones()`, `useNameserverSettings()` |
| **Tabs** | Zones, Records, Nameservers |
| **Layout** | Tabbed DNS management |
| **Interactive Elements** | Zone table, record editor (A, MX, TXT, CNAME, etc.), nameserver config |
| **Modals** | `CreateZoneModal`, `CreateRecordModal`, `EditZoneModal`, `DeleteConfirmModal` |
| **States** | Loading, Error, Empty |

---

### 3.11 Mail Page
**File:** `apps/web/src/pages/mail/MailPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Email server management |
| **Data Hooks** | `useMailConfig(domainId)`, `useMailboxes(domainId)` |
| **Tabs** | Mailboxes, Aliases, Settings, Security, Queue |
| **Layout** | Tabbed email management |
| **Interactive Elements** | Mailbox table, alias table, DKIM/SPF/DMARC toggles, queue viewer |
| **Modals** | `MailboxFormModal`, `AliasFormModal`, `DeleteConfirmModal` |
| **States** | Loading, Error, Disabled (no public IP) |

---

### 3.12 FTP Page
**File:** `apps/web/src/pages/ftp/FtpPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | FTP account management |
| **Data Hooks** | `useFtpAccounts(domainId)`, `useFtpSettings()` |
| **Tabs** | None (list + settings) |
| **Layout** | Account table + global settings |
| **Interactive Elements** | Account table, domain selector, settings form |
| **Modals** | `CreateAccountModal`, `EditAccountModal`, `ChangePasswordModal`, `ConnectionInfo` |
| **States** | Loading, Error, Empty |

---

### 3.13 Cron Page
**File:** `apps/web/src/pages/cron/CronPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Cron job scheduling and history |
| **Data Hooks** | `useCronJobs()` |
| **Tabs** | None |
| **Layout** | Job table + create button |
| **Interactive Elements** | Job table (enable/disable toggle), run button, history expand |
| **Modals** | `CreateJobModal`, `EditJobModal`, `RunResultModal` |
| **States** | Loading, Error, Empty |

**Sub-component:** `CronJobHistory(jobId)` - Expandable history per job

---

### 3.14 Firewall Page
**File:** `apps/web/src/pages/firewall/FirewallPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | UFW and Fail2Ban management |
| **Data Hooks** | `useFirewallRules()`, `useFail2BanJails()` |
| **Tabs** | Rules, Fail2Ban, Login Activity, SSH Settings |
| **Layout** | Tabbed firewall management |
| **Interactive Elements** | Rules table (toggle enable), jail management, login log table |
| **Modals** | `AddRuleModal`, `UnbanIpModal`, `BanIpModal`, `ResetConfirmModal`, `ConfirmModal` |
| **States** | Loading, Error |

---

### 3.15 Logs Page
**File:** `apps/web/src/pages/logs/LogsPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | System log viewer |
| **Data Hooks** | None |
| **Tabs** | None |
| **Layout** | Empty |
| **Interactive Elements** | None |
| **Modals** | None |
| **States** | Placeholder |

**⚠️ GAP:** Page is EMPTY - displays "Log viewer coming soon."

---

### 3.16 Backups Page
**File:** `apps/web/src/pages/backups/BackupsPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Backup management and scheduling |
| **Data Hooks** | `useBackups()`, `useBackupSchedules()`, `useBackupSettings()` |
| **Tabs** | Backups, Schedules, Storage |
| **Layout** | Tabbed backup management |
| **Interactive Elements** | Backup table (verify/restore/delete), schedule table, storage settings |
| **Modals** | `BackupProgressModal`, `CreateBackupModal`, `RestoreModal`, `CreateScheduleModal`, `ConfirmDialog` |
| **States** | Loading, Error, Empty, In Progress |

---

### 3.17 Audit Page
**File:** `apps/web/src/pages/audit/AuditPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Audit log viewer with filtering |
| **Data Hooks** | `useAuditLog(filters)` |
| **Tabs** | None |
| **Layout** | Filter bar + log table |
| **Interactive Elements** | Category filter, user filter, date range, search, CSV export |
| **Modals** | `EntryDetailModal` |
| **States** | Loading, Error, Empty, Filtered |

---

### 3.18 PHP Page
**File:** `apps/web/src/pages/php/PhpPage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | PHP-FPM configuration per domain |
| **Data Hooks** | `usePhpConfig(domainId)`, `usePhpVersions()` |
| **Tabs** | None (domain selector + config) |
| **Layout** | Domain selector + config sections |
| **Interactive Elements** | Version selector, pool settings, directives editor, PHP info modal |
| **Modals** | `PhpInfoModal` |
| **States** | Loading, Error, Empty domain selected |

---

### 3.19 Terminal Page
**File:** `apps/web/src/pages/terminal/TerminalPage.tsx` (732 lines)

| Field | Value |
|-------|-------|
| **Purpose** | WebSocket-based terminal emulator |
| **Data Hooks** | Direct WebSocket connection |
| **Tabs** | Multi-tab support |
| **Layout** | Tab bar + xterm.js terminal area |
| **Interactive Elements** | Tab management (add/close), font size controls, paste button, download log, fullscreen |
| **Modals** | None (inline UI) |
| **States** | Connecting, Connected, Reconnecting, Disconnected, Session Timeout |

**Features:**
- Multi-tab terminal sessions
- Font size control (10-24px) with localStorage persistence
- Session timeout with warning and extend option
- Auto-reconnect with exponential backoff (1s-30s, max 10 attempts)
- Scrollback buffer (50K lines)
- Paste from clipboard
- Download terminal log with ANSI stripping
- Connection status indicator per tab
- Keyboard shortcuts help

---

### 3.20 Monitoring Page
**File:** `apps/web/src/pages/monitoring/MonitoringPage.tsx` (1137 lines)

| Field | Value |
|-------|-------|
| **Purpose** | Server stats, graphs, service health |
| **Data Hooks** | `useStats()`, `useHistoricalStats(range)`, `useServiceStatus()` |
| **Tabs** | None (single page dashboard) |
| **Layout** | 4 stat cards + 4 graphs + service table + process table + domain stats |
| **Interactive Elements** | Time range selector (1h, 6h, 24h, 7d, 30d), alert threshold config, service restart buttons |
| **Modals** | None |
| **States** | Loading, Error |

**Components:**
- `StatCard`: CPU, RAM, Disk, Uptime with progress bars
- `AreaChart`: CPU history, RAM history
- `DualLineChart`: Network I/O, Disk I/O
- `ServiceRow`: Service status with restart
- `ProcessRow`: Top processes (sortable)
- `DomainDiskRow`: Per-domain disk usage
- `DomainBandwidthRow`: Per-domain bandwidth
- `AlertThresholdPanel`: Alert configuration

---

### 3.21 Webserver Page
**File:** `apps/web/src/pages/webserver/WebserverPage.tsx` (642 lines)

| Field | Value |
|-------|-------|
| **Purpose** | Nginx/Apache configuration per domain |
| **Data Hooks** | `useWebserverConfig(domain)`, `useDomains()` |
| **Tabs** | None (domain selector + config) |
| **Layout** | Server status cards + domain selector + config sections |
| **Interactive Elements** | Domain selector, server mode toggle, performance settings, security settings, custom directives |
| **Modals** | Config preview modal |
| **States** | Loading, Error, Empty domain selected |

---

### 3.22 Cloudflare Page
**File:** `apps/web/src/pages/cloudflare/CloudflarePage.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Cloudflare DNS and SSL integration |
| **Data Hooks** | `useCloudflareZones()`, `useTunnelStatus()` |
| **Tabs** | DNS, Tunnels, SSL |
| **Layout** | Tabbed Cloudflare management |
| **Interactive Elements** | Zone list, tunnel management, SSL configuration |
| **Modals** | Various (from TunnelsPage sub-components) |
| **States** | Loading, Error, Not Configured |

---

### 3.23 Tunnels Page
**File:** `apps/web/src/pages/tunnels/TunnelsPage.tsx` (898 lines)

| Field | Value |
|-------|-------|
| **Purpose** | Cloudflare Tunnel connections management |
| **Data Hooks** | `useTunnels()`, `useDomains()`, `useTunnelStatus()` |
| **Tabs** | None (main tunnels page) |
| **Layout** | Tunnel cards + Quick Expose section |
| **Interactive Elements** | Tunnel cards (start/stop/delete), route management, sync button |
| **Modals** | `SetupModal`, `AddRouteModal`, `EditRouteModal`, `ConfigPreviewModal`, `DeleteTunnelModal`, `ExposePanelModal` |
| **States** | Loading, Error, Empty |

---

### 3.24 Server Settings Page
**File:** `apps/web/src/pages/settings/ServerSettingsPage.tsx` (1859 lines)

| Field | Value |
|-------|-------|
| **Purpose** | Comprehensive server configuration |
| **Data Hooks** | `useServerInfo()`, `useSettings()` |
| **Tabs** | None (single page with sections) |
| **Layout** | Scrollable section list |
| **Interactive Elements** | Settings forms, toggles, save buttons |
| **Modals** | `ConfirmModal` (inline for reboot/shutdown) |
| **States** | Loading, Error, Saved |

**Sections:**
1. `PanelSettingsSection`: Server identity, panel URL, admin email
2. `PanelPortSection`: Panel port with restart warning
3. `DefaultWebServerSection`: nginx/apache/nginx+apache
4. `SslEmailSection`: Default SSL contact email
5. `PhpSettingsSection`: PHP version management
6. `NameserverSettingsSection`: NS1/NS2 with domain verification
7. `TimezoneSettingsSection`: Server timezone
8. `SessionPasswordSettingsSection`: Session timeout, password policy
9. `BackupSettingsSection`: Path, retention, schedule
10. `DataRetentionSection`: Audit/log/backup retention
11. `SecuritySettingsSection`: SSH port, password auth, root login, fail2ban, UFW
12. `MaintenanceModeSection`: Toggle maintenance page
13. `PanelBackupRestoreSection`: JSON export/import
14. `SystemInfoSection`: OS, kernel, CPU, RAM, disk
15. `SystemUpdatesSection`: Updates available
16. `ServerPowerSection`: Reboot/shutdown

---

### 3.25 Profile Page
**File:** `apps/web/src/pages/settings/ProfilePage.tsx` (715 lines)

| Field | Value |
|-------|-------|
| **Purpose** | User profile management |
| **Data Hooks** | `useUser()`, `useSessions()`, `use2FAStatus()` |
| **Tabs** | None (single page with sections) |
| **Layout** | Profile section + password + 2FA + sessions + API token |
| **Interactive Elements** | Avatar, profile form, password form, 2FA toggle, session revoke |
| **Modals** | None |
| **States** | Loading, Error, Saved |

**Sections:**
1. `ProfileSection`: Avatar, display name, username (readonly), email change
2. `PasswordSection`: Current/new/confirm with validation
3. `TwoFactorSection`: Enable/disable with QR code, backup codes
4. `SessionsSection`: Active sessions with revoke
5. `ApiTokenSection`: Generate read-only tokens

---

### 3.26 API Tokens Page
**File:** `apps/web/src/pages/settings/ApiTokensPage.tsx` (682 lines)

| Field | Value |
|-------|-------|
| **Purpose** | Full API token management |
| **Data Hooks** | `useApiTokens()` |
| **Tabs** | None |
| **Layout** | Token list + usage panel + create button |
| **Interactive Elements** | Token table (expandable rows), create button, revoke button |
| **Modals** | `CreateTokenModal`, `TokenCreatedModal`, `RevokeConfirmDialog` |
| **States** | Loading, Error, Empty, Token Created |

**Features:**
- 10 permission categories: domains, databases, files, ssl, backups, dns, mail, ftp, settings
- Expiration options: 30d, 90d, 1y, never
- Token usage tracking table

---

### 3.27 Notifications Page
**File:** `apps/web/src/pages/notifications/NotificationsPage.tsx` (966 lines)

| Field | Value |
|-------|-------|
| **Purpose** | Notification history and configuration |
| **Data Hooks** | `useNotifications()`, `useSmtpSettings()`, `useNotificationPreferences()` |
| **Tabs** | History, SMTP, Preferences, Alert Rules |
| **Layout** | Tabbed notification management |
| **Interactive Elements** | Notification list (filter, mark read/delete), SMTP form, preferences toggles, alert rule builder |
| **Modals** | `ConfirmDialog` (delete) |
| **States** | Loading, Error, Toast (new notification popup) |

**Features:**
- Auto-refresh every 5 seconds
- Notification toast popup (auto-dismiss 5s)
- Quiet hours configuration
- Alert rule builder with metric/operator/threshold

---

### 3.28 Installer Page
**File:** `apps/web/src/pages/installer/InstallerPage.tsx` (797 lines)

| Field | Value |
|-------|-------|
| **Purpose** | One-click application installer |
| **Data Hooks** | `useInstalledApps()`, `useAvailableApps()`, `useDatabases()` |
| **Tabs** | None (grid layout) |
| **Layout** | Installed apps grid + available apps grid |
| **Interactive Elements** | App cards (install/update/uninstall/config/logs), category filter, search |
| **Modals** | `InstallModal`, `LogsModal`, `ConfigModal`, `PostInstallChecklist`, `WordPressFeatures` |
| **States** | Loading, Error, Empty |

**Features:**
- App status badges
- Post-install checklist
- WordPress-specific features (WP-CLI, plugins, themes)
- Database selection (auto-create or existing)

---

### 3.29 Login Page
**File:** `apps/web/src/pages/login/LoginPage.tsx` (72 lines)

| Field | Value |
|-------|-------|
| **Purpose** | User authentication |
| **Data Hooks** | `useLogin()`, `useVerify2FA()` |
| **Tabs** | None |
| **Layout** | Login form + 2FA form |
| **Interactive Elements** | Username/password fields, remember me, 2FA code input |
| **Modals** | None |
| **States** | Idle, Loading, Error (with remaining attempts), 2FA Required, Locked |

---

## 4. Modal/Drawer Inventory

**Source:** All page files

| Modal | Page | Purpose |
|-------|------|---------|
| `CreateDomainModal` | DomainsPage | Create new domain |
| `CreateRecordModal` | DomainDetailPage | Add DNS record |
| `EditRecordModal` | DomainDetailPage | Edit DNS record |
| `CreateWebsiteModal` | WebsitesPage | Create new website |
| `IssueCertificateModal` | SslPage | Issue Let's Encrypt cert |
| `UploadCertificateModal` | SslPage | Upload custom cert |
| `CreateDatabaseModal` | DatabasesPage | Create database |
| `CreateUserModal` | DatabaseDetailPage | Create DB user |
| `NewFolderModal` | FilesPage | Create folder |
| `RenameModal` | FilesPage | Rename file/folder |
| `DeleteConfirmModal` | FilesPage | Delete confirmation |
| `MoveModal` | FilesPage | Move file/folder |
| `CopyModal` | FilesPage | Copy file/folder |
| `FilePreviewModal` | FilesPage | Preview files |
| `CreateZoneModal` | DnsPage | Create DNS zone |
| `CreateRecordModal` | DnsPage | Create DNS record |
| `MailboxFormModal` | MailPage | Create/edit mailbox |
| `AliasFormModal` | MailPage | Create/edit alias |
| `CreateAccountModal` | FtpPage | Create FTP account |
| `EditAccountModal` | FtpPage | Edit FTP account |
| `ChangePasswordModal` | FtpPage | Change FTP password |
| `CreateJobModal` | CronPage | Create cron job |
| `EditJobModal` | CronPage | Edit cron job |
| `RunResultModal` | CronPage | Show job output |
| `AddRuleModal` | FirewallPage | Add firewall rule |
| `UnbanIpModal` | FirewallPage | Unban IP |
| `BanIpModal` | FirewallPage | Ban IP |
| `BackupProgressModal` | BackupsPage | Show backup progress |
| `CreateBackupModal` | BackupsPage | Create backup |
| `RestoreModal` | BackupsPage | Restore backup |
| `CreateScheduleModal` | BackupsPage | Create schedule |
| `EntryDetailModal` | AuditPage | Show audit entry details |
| `PhpInfoModal` | PhpPage | Show PHP info |
| `SetupModal` | TunnelsPage | Setup new tunnel |
| `AddRouteModal` | TunnelsPage | Add tunnel route |
| `EditRouteModal` | TunnelsPage | Edit tunnel route |
| `ConfigPreviewModal` | TunnelsPage | Show tunnel config YAML |
| `DeleteTunnelModal` | TunnelsPage | Delete tunnel |
| `ExposePanelModal` | TunnelsPage | Expose NovaPanel |
| `ConfirmModal` | ServerSettingsPage | Reboot/shutdown confirm |
| `CreateTokenModal` | ApiTokensPage | Create API token |
| `TokenCreatedModal` | ApiTokensPage | Show created token |
| `RevokeConfirmDialog` | ApiTokensPage | Revoke token |
| `InstallModal` | InstallerPage | Install app |
| `LogsModal` | InstallerPage | Show install logs |
| `ConfigModal` | InstallerPage | Edit app config |
| `PostInstallChecklist` | InstallerPage | Post-install steps |

---

## 5. Navigation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        LOGIN /auth                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DASHBOARD (/)                                │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Domains ─┼─ DomainDetail ── DNS/SSL/Cloudflare                  │
│  │Websites ┼─ WebsiteDetail ── Config/SSL/Files/Cron              │
│  └─────────┴─────────┴──────────┴──────────┘                     │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Databases┼─DatabaseDetail                                              │
│  │SSL ─────┼─ Cert management                                               │
│  └─────────┴─────────┴──────────┴──────────┘                     │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Files ───┼─ File manager with tree/editor                       │
│  │DNS ─────┼─ Zone/Record management                             │
│  │Mail ────┼─ Mailbox/Alias management                           │
│  │FTP ─────┼─ Account management                                  │
│  └─────────┴─────────┴──────────┴──────────┘                     │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Cron ────┼─ Job management with history                         │
│  │Firewall─┼─ UFW/Fail2Ban management                           │
│  │Logs ────│ EMPTY PLACEHOLDER                                   │
│  │Backups ─┼─ Backup/Schedule management                         │
│  └─────────┴─────────┴──────────┴──────────┘                     │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Audit ───┼─ Audit log viewer                                   │
│  │PHP ─────┼─ PHP-FPM config                                     │
│  │Webserver┼─ Nginx/Apache config                               │
│  │Terminal─┼─ Multi-tab terminal                                 │
│  │Monitoring┼─ Stats/Graphs/Processes                            │
│  └─────────┴─────────┴──────────┴──────────┘                     │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Cloudflare┼─ DNS/Tunnels/SSL                                   │
│  │Tunnels ─┼─ Tunnel management                                  │
│  │Installer┼─ App installer                                     │
│  │Notifications┼─ Alert/History                                  │
│  └─────────┴─────────┴──────────┴──────────┘                     │
│  ┌─────────┬─────────┬──────────┬──────────┐                     │
│  │Profile ──┼─ User profile/2FA                                 │
│  │ServerSettings─┼─ Server configuration                        │
│  │ApiTokens──┼─ Token management                                  │
│  └─────────┴─────────┴──────────┴──────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Domain Detail Experience

**Source:** [`apps/web/src/pages/domains/DomainDetailPage.tsx`](apps/web/src/pages/domains/DomainDetailPage.tsx)

```
DomainDetailPage
├── Header: Domain name, status badge, action buttons
├── Tab: Overview
│   └── Domain info card: registration date, expiration, nameservers
├── Tab: DNS Records
│   ├── Record type filters (A, MX, TXT, CNAME, etc.)
│   ├── Records table
│   └── Add Record → CreateRecordModal
├── Tab: SSL
│   └── SSL certificate management
└── Tab: Cloudflare (CONDITIONAL - only if Cloudflare configured)
    └── Cloudflare DNS integration
```

---

## 7. Cloudflare UI

**Source:** [`apps/web/src/pages/cloudflare/CloudflarePage.tsx`](apps/web/src/pages/cloudflare/CloudflarePage.tsx), [`apps/web/src/pages/tunnels/TunnelsPage.tsx`](apps/web/src/pages/tunnels/TunnelsPage.tsx)

### CloudflarePage (Tabbed)
- **DNS Tab:** Cloudflare zone list, proxied DNS records
- **Tunnels Tab:** Links to `/tunnels`
- **SSL Tab:** Cloudflare origin certificate management

### TunnelsPage (Separate)
- **TunnelCard:** Status indicator, connections count, start/stop/delete
- **Route Management:** Add/Edit/Delete routes
- **Quick Expose:** Bulk domain exposure
- **Live Logs:** Per-tunnel log viewer

---

## 8. Gaps and Inconsistencies

### 8.1 Empty/Placeholder Pages

| Page | Issue | Severity |
|------|-------|----------|
| `LogsPage.tsx` | EMPTY - shows "Log viewer coming soon." | HIGH |

### 8.2 Broken Navigation

| Location | Issue | Severity |
|----------|-------|----------|
| `WebsitesPage` | Row clicks are placeholders ("Phase 8") | HIGH |
| `WebsiteDetailPage` | FilesTab is placeholder linking to `/files` | LOW |

### 8.3 Missing States

| Page | Missing State |
|------|--------------|
| Multiple pages | "No permission" state when user lacks access |
| Terminal | "Session expired" state with re-login option |
| Backups | "Backup in progress" state shown via modal only |

### 8.4 Incomplete Modals

| Modal | Issue |
|-------|-------|
| `CreateWebsiteModal` | May need additional fields |
| File operations | No batch progress indicator |

### 8.5 Orphaned Components

| Component | Status |
|-----------|--------|
| `FilesTab` in WebsiteDetailPage | Placeholder, links to `/files` |
| `WordPressFeatures` | Only shows after successful install |

### 8.6 Inconsistencies

| Issue | Description |
|-------|-------------|
| Tab naming | Some pages use tabs, others use domain selector |
| Settings location | Profile settings split between ProfilePage and ServerSettingsPage |
| API token location | Token generation available in both ProfilePage and ApiTokensPage |
| SSL page | Accessed via `/ssl` AND `/websites/:id/ssl` |
| Cloudflare | Two pages: CloudflarePage and TunnelsPage with overlapping functionality |

### 8.7 Dead Ends

| Route | Issue |
|-------|-------|
| `/logs` | Empty page, no real functionality |
| `/websites/:id` row click | Not wired yet |

### 8.8 Missing Features

| Feature | Status |
|---------|--------|
| Log viewer | Not implemented |
| Website click navigation | Not wired |
| File manager drag-drop | UI exists but may not be fully wired |
| Terminal session timeout | Warning shown but session doesn't auto-reconnect |
| Batch file operations progress | No progress indicator |

---

## 9. UI Component Patterns

### 9.1 Common Patterns

**Page Structure:**
```tsx
export function PageName() {
  return (
    <>
      <PageHeader title="..." description="..." actions={...} />
      <div>
        {/* Page content */}
      </div>
    </>
  );
}
```

**Modal Pattern:**
```tsx
function SomeModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const handleSubmit = () => {
    mutation.mutate(data, {
      onSuccess: () => onClose(),
      onError: (err) => { /* handle error */ }
    });
  };
  // render modal JSX
}
```

**Tab Pattern:**
```tsx
const TABS = ['tab1', 'tab2'] as const;
const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('tab1');
// render tabs with map
```

### 9.2 API Hook Pattern

```tsx
// Hook returns mutation with onSuccess/onError callbacks
const mutation = useMutation({
  mutationFn: api.createItem,
  onSuccess: () => { /* invalidate queries */ }
});
```

---

## 10. Summary Statistics

| Metric | Count |
|--------|-------|
| Total Routes | 30 |
| Protected Routes | 29 |
| Pages | 28 |
| Empty/Placeholder Pages | 1 (Logs) |
| Modal Types | ~50 |
| Sidebar Groups | 7 |
| Sidebar Items | 20 |

---

**End of UI Structure Map**
