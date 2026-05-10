# NovaPanel UI Implementation Documentation

Complete documentation of the NovaPanel UI structure, features, and organization.

## Table of Contents

1. [Route Structure](#route-structure)
2. [Sidebar Navigation](#sidebar-navigation)
3. [Layout Structure](#layout-structure)
4. [Feature Organization by Module](#feature-organization-by-module)
5. [Feature Flow & Relationships](#feature-flow--relationships)
6. [Page Directory Structure](#page-directory-structure)
7. [Key UI Components](#key-ui-components)
8. [Technology Stack](#technology-stack)

---

## Route Structure

The application uses **TanStack Router** with code-based routing. All routes are defined in [`router.tsx`](apps/web/src/router.tsx).

### Route Hierarchy

```
rootRoute (/)
├── loginRoute (/login)
└── protectedRoute (id: 'protected')
    ├── indexRoute (/)
    ├── domainsRoute (/domains)
    ├── websitesRoute (/websites)
    ├── websiteDetailRoute (/websites/$id)
    ├── webserverRoute (/webserver)
    ├── phpRoute (/php)
    ├── sslRoute (/ssl)
    ├── dnsRoute (/dns)
    ├── mailRoute (/mail)
    ├── databasesRoute (/databases)
    ├── ftpRoute (/ftp)
    ├── cloudflareRoute (/cloudflare)
    ├── filesRoute (/files)
    ├── terminalRoute (/terminal)
    ├── cronRoute (/cron)
    ├── firewallRoute (/firewall)
    ├── logsRoute (/logs)
    ├── backupsRoute (/backups)
    ├── auditRoute (/audit)
    ├── settingsRoute (/settings)
    ├── apiTokensRoute (/settings/api-tokens)
    ├── serverSettingsRoute (/settings/server)
    ├── monitoringRoute (/monitoring)
    ├── notificationsRoute (/notifications)
    └── installerRoute (/installer)
```

### Route Details

| Route | Path | Component | Purpose |
|-------|------|-----------|---------|
| [`loginRoute`](apps/web/src/router.tsx:40) | `/login` | `LoginPage` | Authentication page |
| [`indexRoute`](apps/web/src/router.tsx:53) | `/` | `DashboardPage` | Main dashboard overview |
| [`domainsRoute`](apps/web/src/router.tsx:59) | `/domains` | `DomainsPage` | Domain management |
| [`websitesRoute`](apps/web/src/router.tsx:65) | `/websites` | `WebsitesPage` | Website listing |
| [`websiteDetailRoute`](apps/web/src/router.tsx:71) | `/websites/$id` | `WebsiteDetailWrapper` | Individual website details |
| [`webserverRoute`](apps/web/src/router.tsx:80) | `/webserver` | `WebserverPage` | Web server configuration |
| [`phpRoute`](apps/web/src/router.tsx:86) | `/php` | `PhpPage` | PHP version management |
| [`sslRoute`](apps/web/src/router.tsx:92) | `/ssl` | `SslPage` | SSL certificate management |
| [`dnsRoute`](apps/web/src/router.tsx:98) | `/dns` | `DnsPage` | DNS zone management |
| [`mailRoute`](apps/web/src/router.tsx:104) | `/mail` | `MailPage` | Mail server management |
| [`databasesRoute`](apps/web/src/router.tsx:110) | `/databases` | `DatabasesPage` | Database management |
| [`ftpRoute`](apps/web/src/router.tsx:116) | `/ftp` | `FtpPage` | FTP account management |
| [`cloudflareRoute`](apps/web/src/router.tsx:200) | `/cloudflare` | `CloudflarePage` | Cloudflare integration |
| [`filesRoute`](apps/web/src/router.tsx:122) | `/files` | `FilesPage` | File manager |
| [`terminalRoute`](apps/web/src/router.tsx:128) | `/terminal` | `TerminalPage` | Browser terminal |
| [`cronRoute`](apps/web/src/router.tsx:134) | `/cron` | `CronPage` | Cron job management |
| [`firewallRoute`](apps/web/src/router.tsx:140) | `/firewall` | `FirewallPage` | Firewall rules |
| [`logsRoute`](apps/web/src/router.tsx:146) | `/logs` | `LogsPage` | System logs viewer |
| [`backupsRoute`](apps/web/src/router.tsx:152) | `/backups` | `BackupsPage` | Backup management |
| [`auditRoute`](apps/web/src/router.tsx:158) | `/audit` | `AuditPage` | Audit log viewer |
| [`settingsRoute`](apps/web/src/router.tsx:164) | `/settings` | `ProfilePage` | User profile settings |
| [`apiTokensRoute`](apps/web/src/router.tsx:170) | `/settings/api-tokens` | `ApiTokensPage` | API token management |
| [`serverSettingsRoute`](apps/web/src/router.tsx:176) | `/settings/server` | `ServerSettingsPage` | Server configuration |
| [`monitoringRoute`](apps/web/src/router.tsx:182) | `/monitoring` | `MonitoringPage` | System monitoring |
| [`notificationsRoute`](apps/web/src/router.tsx:188) | `/notifications` | `NotificationsPage` | Notifications center |
| [`installerRoute`](apps/web/src/router.tsx:194) | `/installer` | `InstallerPage` | App installer |

### Authentication Guard

The [`AuthGuard`](apps/web/src/components/auth/AuthGuard.tsx:5) component wraps all protected routes and redirects to `/login` if not authenticated.

---

## Sidebar Navigation

The sidebar is defined in [`Sidebar.tsx`](apps/web/src/components/layout/Sidebar.tsx:110) with 7 navigation groups:

### Navigation Groups

```typescript
const navGroups: { title: string; items: NavItem[] }[] = [
  // Overview
  { title: 'Overview', items: [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard }
  ]},
  
  // Web
  { title: 'Web', items: [
    { label: 'Domains', path: '/domains', icon: Globe },
    { label: 'Websites', path: '/websites', icon: Layers },
    { label: 'Web Server', path: '/webserver', icon: Server },
    { label: 'PHP', path: '/php', icon: Code2 },
    { label: 'SSL', path: '/ssl', icon: ShieldCheck }
  ]},
  
  // Services
  { title: 'Services', items: [
    { label: 'DNS', path: '/dns', icon: Network },
    { label: 'Mail', path: '/mail', icon: Mail },
    { label: 'Databases', path: '/databases', icon: Database },
    { label: 'FTP', path: '/ftp', icon: FolderUp }
  ]},
  
  // Network
  { title: 'Network', items: [
    { label: 'Cloudflare', path: '/cloudflare', icon: Cloud }
  ]},
  
  // System
  { title: 'System', items: [
    { label: 'Files', path: '/files', icon: FolderOpen },
    { label: 'Terminal', path: '/terminal', icon: Terminal },
    { label: 'Cron', path: '/cron', icon: Clock },
    { label: 'Firewall', path: '/firewall', icon: Flame },
    { label: 'Logs', path: '/logs', icon: ScrollText },
    { label: 'Monitoring', path: '/monitoring', icon: Activity }
  ]},
  
  // Tools
  { title: 'Tools', items: [
    { label: 'Backups', path: '/backups', icon: Archive },
    { label: 'Installer', path: '/installer', icon: Package },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Audit Log', path: '/audit', icon: ScrollText }
  ]},
  
  // Account
  { title: 'Account', items: [
    { label: 'Profile', path: '/settings', icon: Settings },
    { label: 'Server Settings', path: '/settings/server', icon: Wrench }
  ]}
];
```

### Sidebar Features

- **Collapsible**: Toggles between `w-56` (expanded) and `w-16` (collapsed)
- **State Persistence**: Uses `localStorage` key `sidebarCollapsed`
- **Active Route Highlighting**: Uses `matchRoute()` from TanStack Router
- **Icons**: Uses `lucide-react` icons for all navigation items

---

## Layout Structure

### AppLayout Component

Located at [`AppLayout.tsx`](apps/web/src/components/layout/AppLayout.tsx:60), the main layout structure:

```
<AppLayout>
├── <Sidebar />
└── <div class="flex flex-1 flex-col overflow-hidden">
    ├── <TopBar />
    ├── <Breadcrumb />
    └── <main class="overflow-y-auto p-6">
        <Outlet />
    </main>
</div>
```

### TopBar

Located at [`TopBar.tsx`](apps/web/src/components/layout/TopBar.tsx:76):
- User avatar and dropdown menu
- Theme toggle button
- Logout functionality
- Uses Zustand auth store for user data

### Breadcrumb

Located at [`Breadcrumb.tsx`](apps/web/src/components/ui/Breadcrumb.tsx:13):

Breadcrumb path labels defined in [`AppLayout.tsx:8-32`](apps/web/src/components/layout/AppLayout.tsx:8):
```typescript
const PATH_LABELS: Record<string, string> = {
  '': 'Home',
  domains: 'Domains',
  webserver: 'Web Server',
  php: 'PHP',
  ssl: 'SSL',
  dns: 'DNS',
  mail: 'Mail',
  databases: 'Databases',
  ftp: 'FTP',
  tunnels: 'Tunnels',
  files: 'Files',
  terminal: 'Terminal',
  cron: 'Cron',
  firewall: 'Firewall',
  logs: 'Logs',
  backups: 'Backups',
  audit: 'Audit Log',
  settings: 'Settings',
  server: 'Server Settings',
  'api-tokens': 'API Tokens',
  monitoring: 'Monitoring',
  notifications: 'Notifications',
  installer: 'Installer',
};
```

---

## Feature Organization by Module

### Web Module

| Feature | Page | Route | Description |
|---------|------|-------|-------------|
| **Domains** | [`DomainsPage`](apps/web/src/pages/domains/DomainsPage.tsx) | `/domains` | Domain registration, DNS configuration, SSL status |
| **Websites** | [`WebsitesPage`](apps/web/src/pages/websites/WebsitesPage.tsx) | `/websites` | Website listing and management |
| **Website Detail** | [`WebsiteDetailPage`](apps/web/src/pages/websites/WebsiteDetailPage.tsx) | `/websites/$id` | Individual website config, SSL, PHP settings |
| **Web Server** | [`WebserverPage`](apps/web/src/pages/webserver/WebserverPage.tsx) | `/webserver` | Nginx/Apache configuration |
| **PHP** | [`PhpPage`](apps/web/src/pages/php/PhpPage.tsx) | `/php` | PHP version switching, extensions |
| **SSL** | [`SslPage`](apps/web/src/pages/ssl/SslPage.tsx) | `/ssl` | SSL certificate management, Let's Encrypt |

### Services Module

| Feature | Page | Route | Description |
|---------|------|-------|-------------|
| **DNS** | [`DnsPage`](apps/web/src/pages/dns/DnsPage.tsx) | `/dns` | DNS zone management via BIND |
| **Mail** | [`MailPage`](apps/web/src/pages/mail/MailPage.tsx) | `/mail` | Mail server configuration |
| **Databases** | [`DatabasesPage`](apps/web/src/pages/databases/DatabasesPage.tsx) | `/databases` | MySQL/MariaDB/PostgreSQL management |
| **FTP** | [`FtpPage`](apps/web/src/pages/ftp/FtpPage.tsx) | `/ftp` | FTP account management |

### Network Module

| Feature | Page | Route | Description |
|---------|------|-------|-------------|
| **Cloudflare** | [`CloudflarePage`](apps/web/src/pages/cloudflare/CloudflarePage.tsx) | `/cloudflare` | Cloudflare integration, DNS sync, proxy status |

### System Module

| Feature | Page | Route | Description |
|---------|------|-------|-------------|
| **Files** | [`FilesPage`](apps/web/src/pages/files/FilesPage.tsx) | `/files` | File manager with code editor |
| **Terminal** | [`TerminalPage`](apps/web/src/pages/terminal/TerminalPage.tsx) | `/terminal` | Browser-based terminal (xterm.js) |
| **Cron** | [`CronPage`](apps/web/src/pages/cron/CronPage.tsx) | `/cron` | Cron job scheduling |
| **Firewall** | [`FirewallPage`](apps/web/src/pages/firewall/FirewallPage.tsx) | `/firewall` | UFW/firewalld rules management |
| **Logs** | [`LogsPage`](apps/web/src/pages/logs/LogsPage.tsx) | `/logs` | System and service logs |
| **Monitoring** | [`MonitoringPage`](apps/web/src/pages/monitoring/MonitoringPage.tsx) | `/monitoring` | System stats, CPU, memory, disk |

### Tools Module

| Feature | Page | Route | Description |
|---------|------|-------|-------------|
| **Backups** | [`BackupsPage`](apps/web/src/pages/backups/BackupsPage.tsx) | `/backups` | Backup creation, restoration |
| **Installer** | [`InstallerPage`](apps/web/src/pages/installer/InstallerPage.tsx) | `/installer` | One-click app installer |
| **Notifications** | [`NotificationsPage`](apps/web/src/pages/notifications/NotificationsPage.tsx) | `/notifications` | System notifications center |
| **Audit Log** | [`AuditPage`](apps/web/src/pages/audit/AuditPage.tsx) | `/audit` | Action audit trail |

### Account Module

| Feature | Page | Route | Description |
|---------|------|-------|-------------|
| **Profile** | [`ProfilePage`](apps/web/src/pages/settings/ProfilePage.tsx) | `/settings` | User profile, password change |
| **API Tokens** | [`ApiTokensPage`](apps/web/src/pages/settings/ApiTokensPage.tsx) | `/settings/api-tokens` | API token CRUD |
| **Server Settings** | [`ServerSettingsPage`](apps/web/src/pages/settings/ServerSettingsPage.tsx) | `/settings/server` | Server-wide configuration |

---

## Feature Flow & Relationships

### Website Creation Flow

```
Domains (/domains)
    │
    ├── Add Domain → Creates domain record
    │
    ▼
Websites (/websites)
    │
    ├── Create Website → Links to domain
    │
    ▼
Website Detail (/websites/$id)
    │
    ├── Configure SSL → SSL certificates
    ├── Set PHP Version → PHP settings
    ├── Setup FTP → FTP accounts
    └── File Management → Files (/files)
```

### Domain/SSL Flow

```
Domains (/domains)
    │
    ├── Add Domain → Creates DNS record
    │
    ▼
SSL (/ssl)
    │
    ├── Let's Encrypt → Auto-provision SSL
    │
    ▼
Website Detail
    │
    └── Enable HTTPS → Proxy through Nginx
```

### Cloudflare Integration Flow

```
Cloudflare (/cloudflare)
    │
    ├── Connect Account → API key setup
    │
    ▼
DNS Sync
    │
    ├── Zone Selection → Choose domain
    ├── Records Sync → Bi-directional
    └── Proxy Status → Toggle Cloudflare proxy
```

### Database Flow

```
Databases (/databases)
    │
    ├── Create Database → Database + user
    │
    ├── Create User → Link to database
    │
    └── Privileges → Grant permissions
```

---

## Page Directory Structure

Full tree of pages in [`apps/web/src/pages/`](apps/web/src/pages):

```
pages/
├── audit/
│   └── AuditPage.tsx
├── backups/
│   └── BackupsPage.tsx
├── cloudflare/
│   └── CloudflarePage.tsx
├── cron/
│   └── CronPage.tsx
├── dashboard/
│   └── DashboardPage.tsx
├── databases/
│   └── DatabasesPage.tsx
├── dns/
│   └── DnsPage.tsx
├── domains/
│   ├── DomainsPage.tsx
│   └── components/
│       └── DomainStatusBadge.tsx
├── files/
│   └── FilesPage.tsx
├── firewall/
│   └── FirewallPage.tsx
├── ftp/
│   └── FtpPage.tsx
├── installer/
│   └── InstallerPage.tsx
├── login/
│   ├── LoginForm.tsx
│   ├── LoginPage.tsx
│   └── TwoFactorForm.tsx
├── logs/
│   └── LogsPage.tsx
├── mail/
│   └── MailPage.tsx
├── monitoring/
│   └── MonitoringPage.tsx
├── notifications/
│   └── NotificationsPage.tsx
├── php/
│   └── PhpPage.tsx
├── settings/
│   ├── ApiTokensPage.tsx
│   ├── ProfilePage.tsx
│   └── ServerSettingsPage.tsx
├── ssl/
│   └── SslPage.tsx
├── terminal/
│   └── TerminalPage.tsx
├── tunnels/
│   └── TunnelsPage.tsx
├── webserver/
│   └── WebserverPage.tsx
└── websites/
    ├── WebsiteDetailPage.tsx
    └── WebsitesPage.tsx
```

---

## Key UI Components

### Layout Components

| Component | File | Purpose |
|----------|------|---------|
| [`AppLayout`](apps/web/src/components/layout/AppLayout.tsx:60) | `components/layout/AppLayout.tsx` | Main application layout wrapper |
| [`Sidebar`](apps/web/src/components/layout/Sidebar.tsx:110) | `components/layout/Sidebar.tsx` | Navigation sidebar with collapse |
| [`TopBar`](apps/web/src/components/layout/TopBar.tsx:76) | `components/layout/TopBar.tsx` | Header bar with user menu |

### UI Components

| Component | File | Purpose |
|----------|------|---------|
| [`Breadcrumb`](apps/web/src/components/ui/Breadcrumb.tsx:13) | `components/ui/Breadcrumb.tsx` | Navigation breadcrumb trail |
| [`PageHeader`](apps/web/src/components/ui/PageHeader.tsx:7) | `components/ui/PageHeader.tsx` | Page title, description, actions |
| [`Modal`](apps/web/src/components/ui/Modal.tsx:21) | `components/ui/Modal.tsx` | Reusable modal dialog |
| [`EmptyState`](apps/web/src/components/ui/EmptyState.tsx:8) | `components/ui/EmptyState.tsx` | Empty state placeholder |
| [`ConfirmDialog`](apps/web/src/components/ui/ConfirmDialog.tsx:37) | `components/ui/ConfirmDialog.tsx` | Confirmation dialog |
| [`ResponsiveTable`](apps/web/src/components/ui/ResponsiveTable.tsx:7) | `components/ui/ResponsiveTable.tsx` | Responsive data table |
| [`LoadingSpinner`](apps/web/src/components/ui/LoadingSpinner.tsx:1) | `components/ui/LoadingSpinner.tsx` | Loading indicator |
| [`ThemeToggle`](apps/web/src/components/ui/ThemeToggle.tsx:30) | `components/ui/ThemeToggle.tsx` | Dark/light mode toggle |
| [`Toast`](apps/web/src/components/ui/Toast.tsx:154) | `components/ui/Toast.tsx` | Toast notification system |

### File Components

| Component | File | Purpose |
|----------|------|---------|
| [`CodeEditor`](apps/web/src/components/files/CodeEditor.tsx:21) | `components/files/CodeEditor.tsx` | CodeMirror-based editor |
| [`ImagePreviewModal`](apps/web/src/components/files/FilePreviewModal.tsx:13) | `components/files/FilePreviewModal.tsx` | Image preview |
| [`VideoPreviewModal`](apps/web/src/components/files/FilePreviewModal.tsx:70) | `components/files/FilePreviewModal.tsx` | Video preview |
| [`PDFPreviewModal`](apps/web/src/components/files/FilePreviewModal.tsx:131) | `components/files/FilePreviewModal.tsx` | PDF preview |
| [`ArchiveBrowserModal`](apps/web/src/components/files/FilePreviewModal.tsx:220) | `components/files/FilePreviewModal.tsx` | ZIP/TAR archive browser |

### Auth Components

| Component | File | Purpose |
|----------|------|---------|
| [`AuthGuard`](apps/web/src/components/auth/AuthGuard.tsx:5) | `components/auth/AuthGuard.tsx` | Route protection wrapper |

---

## Technology Stack

### Routing

- **Library**: `@tanstack/react-router` v1.95.0
- **Pattern**: Code-based routing (not file-based)
- **Type Safety**: Full type inference via router declaration

### Styling

- **Framework**: Tailwind CSS v3.4
- **Components**: Radix UI primitives
- **Icons**: Lucide React v0.469
- **Themes**: CSS custom properties with dark/light mode support

### State Management

| Library | Version | Purpose |
|---------|---------|---------|
| `zustand` | 5.0.0 | Global state (auth store) |
| `@tanstack/react-query` | 5.62.0 | Server state, caching |

### Form Handling

- **Library**: `react-hook-form` v7.54
- **Validation**: `zod` v3.24

### Terminal

- **Library**: `@xterm/xterm` v6.0
- **Addons**: `@xterm/addon-fit`, `@xterm/addon-web-links`

### Code Editor

- **Library**: `@uiw/react-codemirror` v4.25
- **Languages**: CSS, HTML, JavaScript, JSON, PHP, XML, YAML
- **Themes**: `@codemirror/theme-one-dark`

### Charts

- **Library**: `recharts` v2.15

### UI Primitives

```json
{
  "@radix-ui/react-accordion": "^1.2.0",
  "@radix-ui/react-avatar": "^1.1.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "@radix-ui/react-dropdown-menu": "^2.1.0",
  "@radix-ui/react-label": "^2.1.0",
  "@radix-ui/react-progress": "^1.1.0",
  "@radix-ui/react-scroll-area": "^1.2.0",
  "@radix-ui/react-select": "^2.1.0",
  "@radix-ui/react-separator": "^1.1.0",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-switch": "^1.1.0",
  "@radix-ui/react-tabs": "^1.1.0",
  "@radix-ui/react-toast": "^1.2.0",
  "@radix-ui/react-tooltip": "^1.1.0"
}
```

### Build Tools

| Tool | Purpose |
|------|---------|
| Vite | Build tool and dev server |
| TypeScript | Type safety |
| PostCSS + Autoprefixer | CSS processing |

---

## API Integration

### API Client

Located at [`apps/web/src/api/client.ts`](apps/web/src/api/client.ts):
- Base URL: Port 8732
- Response wrapper: `{ success, data?, error? }`
- All routes under `/api/v1/`

### API Hooks

API hooks are organized in [`apps/web/src/api/hooks/`](apps/web/src/api/hooks):

| Hook | Purpose |
|------|---------|
| `audit.ts` | Audit log queries |
| `auth.ts` | Authentication |
| `backup.ts` | Backup operations |
| `cron.ts` | Cron job management |
| `databases.ts` | Database operations |
| `dns.ts` | DNS zone management |
| `domains.ts` | Domain management |
| `files.ts` | File operations |
| `firewall.ts` | Firewall rules |
| `ftp.ts` | FTP account management |
| `installer.ts` | App installer |
| `logs.ts` | Log retrieval |
| `mail.ts` | Mail server |
| `notifications.ts` | Notifications |
| `php.ts` | PHP configuration |
| `settings.ts` | Server settings |
| `ssl.ts` | SSL certificates |
| `stats.ts` | System statistics |
| `tokens.ts` | API tokens |
| `tunnel.ts` | Cloudflare tunnels |
| `webserver.ts` | Web server config |
| `websites.ts` | Website management |

---

## Database Schema (Reference)

The API uses Drizzle ORM with schemas in [`apps/api/src/db/schema/`](apps/api/src/db/schema):

| Schema | Purpose |
|--------|---------|
| `api-tokens.ts` | API authentication tokens |
| `audit.ts` | Audit log entries |
| `backups.ts` | Backup records |
| `cloudflare.ts` | Cloudflare integration |
| `cron.ts` | Scheduled jobs |
| `databases.ts` | Database instances |
| `dns.ts` | DNS zones/records |
| `domains.ts` | Domain names |
| `email.ts` | Email accounts |
| `ftp.ts` | FTP accounts |
| `installed-apps.ts` | Installed applications |
| `notifications.ts` | User notifications |
| `ssl.ts` | SSL certificates |
| `stats.ts` | System statistics |
| `subscriptions.ts` | Service subscriptions |
| `tunnels.ts` | Cloudflare tunnels |
| `users.ts` | User accounts |
| `websites.ts` | Website configurations |
