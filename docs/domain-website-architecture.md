# Domain & Website Architecture

NovaPanel's domain/website architecture separates infrastructure concerns into two distinct resources: **Websites** (containers for hosting resources) and **Domains** (DNS entries that can be attached to websites). This separation allows a single website to serve multiple domains and provides flexibility for complex hosting scenarios.

---

## Architecture Overview

### Domain/Website Separation

The architecture is built on a **one-to-many** relationship:

- **Website**: The hosting container. A website owns system resources:
  - OS system user (`sf_{websiteId}`)
  - Document root directory (`/var/www/sites/{websiteId}/httpdocs`)
  - PHP version and handler configuration
  - Web server type (nginx, apache, nginx+apache)
  - Disk and bandwidth usage tracking

- **Domain**: A DNS name that can be attached to a website. A domain can be:
  - **Primary**: The main domain for a website, often with SSL enabled
  - **Subdomain**: A child domain under a primary domain (e.g., `blog.example.com`)
  - **Alias**: An additional domain serving the same website content (e.g., `www.example.com`)
  - **Redirect**: A domain that redirects to another URL with 301/302 status

### How Websites Are Containers

When you create a website, NovaPanel:

1. Creates an OS system user (`sf_{nanoid}`)
2. Creates the directory structure:
   ```
   /var/www/sites/{websiteId}/
   ├── httpdocs/     # Document root (served by nginx/apache)
   ├── private/       # Private files (not web-accessible)
   ├── logs/          # Access and error logs
   ├── tmp/           # Temporary files
   ├── ssl/           # SSL certificates
   └── backup/       # Backups
   ```
3. Sets ownership: `sf_{websiteId}:www-data`
4. Generates nginx configuration including all attached domains
5. Creates PHP-FPM pool for the website

### How Domains Attach to Websites

Domains are linked to websites via the `websiteId` foreign key in the `domains` table. This relationship:

- Allows multiple domains to serve the same website content
- Enables the nginx configuration to be regenerated whenever domains change
- Supports the "alias" and "redirect" domain types that share the infrastructure

**Domain types explained:**

| Type | Description | nginx `server_name` | SSL | Website Required |
|------|-------------|---------------------|-----|------------------|
| `primary` | Main domain for a website | Primary domain | Yes (typically) | Yes |
| `subdomain` | Child domain | Full subdomain FQDN | Inherited | Optional |
| `alias` | Additional domain pointing to same site | Alias domain | Shared | Yes |
| `redirect` | Redirects to another URL | Source domain | Optional | No |
| `parked` | Domain not in active use | — | — | No |
| `mail-only` | DNS/mail only, no website | — | — | No |

---

## Database Schema

### Entity Relationship Diagram (ERD)

```
┌─────────────────────┐         ┌─────────────────────┐
│      websites       │         │       domains       │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │◄────────│ websiteId (FK)      │
│ name                │         │ id (PK)             │
│ systemUser          │         │ name                │
│ documentRoot        │         │ documentRoot        │
│ phpVersion          │         │ type                │
│ phpHandler          │         │ parentDomainId (FK) │
│ webServer           │         │ redirectTarget      │
│ status              │         │ sslEnabled          │
│ diskUsedMb          │         │ sslCertId           │
│ bandwidthUsedMb     │         │ status              │
│ createdAt           │         │ createdAt           │
└─────────────────────┘         └─────────┬───────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
           ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
           │    subdomains   │  │  domainAliases  │  │ domainRedirects │
           ├─────────────────┤  ├─────────────────┤  ├─────────────────┤
           │ id (PK)         │  │ id (PK)         │  │ id (PK)         │
           │ domainId (FK)───┼──│ domainId (FK)───┼──│ domainId (FK)───┤
           │ name            │  │ alias           │  │ sourcePath      │
           │ documentRoot    │  │ createdAt       │  │ targetUrl       │
           │ phpVersion      │  └─────────────────┘  │ type            │
           │ websiteId (FK)  │                      │ createdAt       │
           │ createdAt       │                      └─────────────────┘
           └─────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│  cloudflareZones    │         │    tunnelRoutes     │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)             │
│ domainId (FK)        │         │ tunnelId (FK)       │
│ zoneId              │         │ hostname            │
│ zoneName            │         │ service             │
│ accountId           │         │ domainId (FK)       │
│ apiToken            │         │ isActive            │
│ plan                │         │ createdAt           │
│ status              │         └─────────────────────┘
│ sslMode             │
│ isPaused            │
│ nameservers         │
│ lastSyncAt          │
│ createdAt           │
└─────────────────────┘
```

### websites Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier, e.g., `ws_abc123` |
| `name` | `text` | — | Human-readable label, e.g., "Main Site" |
| `systemUser` | `text` | — | OS user, e.g., `sf_abc123`, unique |
| `documentRoot` | `text` | — | Full path, e.g., `/var/www/sites/ws_abc123/httpdocs` |
| `phpVersion` | `text` | `'8.2'` | PHP version number |
| `phpHandler` | `enum` | `'php-fpm'` | `php-fpm`, `cgi`, or `disabled` |
| `webServer` | `enum` | `'nginx+apache'` | `nginx`, `apache`, or `nginx+apache` |
| `status` | `enum` | `'active'` | `active` or `suspended` |
| `diskUsedMb` | `integer` | `0` | Disk usage in megabytes |
| `bandwidthUsedMb` | `integer` | `0` | Bandwidth usage in megabytes |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

### domains Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier |
| `name` | `text` | — | FQDN, e.g., `example.com`, unique |
| `documentRoot` | `text` | — | Path to public files |
| `systemUser` | `text` | — | OS user for this domain (legacy) |
| `phpVersion` | `text` | `'8.2'` | PHP version |
| `phpHandler` | `enum` | `'php-fpm'` | PHP handler |
| `webServer` | `enum` | `'nginx+apache'` | Web server type |
| `sslEnabled` | `boolean` | `false` | Whether SSL is enabled |
| `sslCertId` | `text` | — | Reference to SSL certificate |
| `redirectHttpToHttps` | `boolean` | `false` | Force HTTPS redirect |
| `hsts` | `boolean` | `false` | Send HSTS header |
| `diskUsedMb` | `integer` | `0` | Disk usage |
| `bandwidthUsedMb` | `integer` | `0` | Bandwidth usage |
| `status` | `enum` | `'active'` | `active`, `suspended`, `pending` |
| `type` | `enum` | `'primary'` | `primary`, `subdomain`, `alias`, `redirect`, `parked`, `mail-only` |
| `websiteId` | `text` (FK) | — | Reference to parent website |
| `redirectTarget` | `text` | — | Target URL for redirect type |
| `parentDomainId` | `text` (FK) | — | For subdomains, reference to parent domain |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

### subdomains Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier |
| `domainId` | `text` (FK) | — | Parent domain reference, cascade delete |
| `name` | `text` | — | Subdomain prefix only, e.g., `blog` (not FQDN) |
| `documentRoot` | `text` | — | Full path to subdomain content |
| `phpVersion` | `text` | — | Override PHP version (optional) |
| `websiteId` | `text` (FK) | — | Optional: attach to different website |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

### domainAliases Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier |
| `domainId` | `text` (FK) | — | Parent domain, cascade delete |
| `alias` | `text` | — | Alias domain name, unique |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

### domainRedirects Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier |
| `domainId` | `text` (FK) | — | Parent domain, cascade delete |
| `sourcePath` | `text` | — | Path to redirect from, e.g., `/old-page` |
| `targetUrl` | `text` | — | Destination URL |
| `type` | `enum` | `'301'` | `301` (permanent) or `302` (temporary) |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

### cloudflareZones Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier |
| `domainId` | `text` (FK) | — | Linked NovaPanel domain |
| `zoneId` | `text` | — | Cloudflare zone UUID |
| `zoneName` | `text` | — | Domain name in Cloudflare |
| `accountId` | `text` | — | Cloudflare account ID |
| `apiToken` | `text` | — | Encrypted Cloudflare API token |
| `plan` | `text` | — | Cloudflare plan (Free, Pro, Business) |
| `status` | `text` | `'active'` | `active`, `pending`, `paused` |
| `sslMode` | `text` | `'flexible'` | `off`, `flexible`, `full`, `strict` |
| `isPaused` | `boolean` | `false` | Whether Cloudflare proxy is paused |
| `nameservers` | `text` | — | JSON array of Cloudflare nameservers |
| `lastSyncAt` | `timestamp` | — | Last sync with Cloudflare API |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

### cloudflareRedirectRules Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `text` (PK) | nanoid | Unique identifier |
| `zoneId` | `text` (FK) | — | Cloudflare zone, cascade delete |
| `ruleId` | `text` | — | Cloudflare ruleset rule ID |
| `sourcePattern` | `text` | — | Source pattern, e.g., `www.example.com/*` |
| `destinationUrl` | `text` | — | Destination URL, e.g., `https://example.com/$1` |
| `redirectType` | `enum` | `'301'` | `301` or `302` |
| `isActive` | `boolean` | `true` | Whether rule is active |
| `createdAt` | `timestamp` | `unixepoch()` | Creation timestamp |

---

## API Endpoints

### Domains API (`/api/v1/domains`)

#### Domain CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains` | List all domains (supports `?page`, `?perPage`, `?search`, `?status`) |
| `POST` | `/api/v1/domains` | Create a new domain |
| `GET` | `/api/v1/domains/verify-dns` | Verify domain DNS points to server (`?domain=example.com`) |
| `GET` | `/api/v1/domains/:id` | Get domain detail |
| `PUT` | `/api/v1/domains/:id` | Update domain (PHP, handler, web server, HTTPS, HSTS) |
| `DELETE` | `/api/v1/domains/:id` | Delete domain (`{ deleteWebsite?: boolean }`) |
| `POST` | `/api/v1/domains/:id/suspend` | Suspend domain (returns 503) |
| `POST` | `/api/v1/domains/:id/activate` | Activate suspended domain |

#### Subdomain Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/subdomains` | List subdomains for a domain |
| `POST` | `/api/v1/domains/:id/subdomains` | Create subdomain |
| `DELETE` | `/api/v1/domains/:id/subdomains/:subId` | Delete subdomain |

#### Alias Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/aliases` | List aliases for a domain |
| `POST` | `/api/v1/domains/:id/aliases` | Create alias (`{ alias: string }`) |
| `DELETE` | `/api/v1/domains/:id/aliases/:aliasId` | Delete alias |

#### Redirect Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/redirects` | List redirects for a domain |
| `POST` | `/api/v1/domains/:id/redirects` | Create redirect (`{ sourcePath, targetUrl, type }`) |
| `DELETE` | `/api/v1/domains/:id/redirects/:redirectId` | Delete redirect |

#### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/logs/stats` | Get access log statistics |
| `GET` | `/api/v1/domains/:id/logs/access` | Get access log (`?lines=100`) |
| `GET` | `/api/v1/domains/:id/logs/error` | Get error log (`?lines=100`) |

#### Cloudflare Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/cloudflare-status` | Get Cloudflare tunnel/SSL status |
| `GET` | `/api/v1/domains/:id/cloudflare-zone` | Get linked Cloudflare zone |
| `GET` | `/api/v1/domains/:id/cloudflare/dns` | List Cloudflare DNS records |
| `POST` | `/api/v1/domains/:id/cloudflare/dns` | Create Cloudflare DNS record |
| `DELETE` | `/api/v1/domains/:id/cloudflare/dns/:recordId` | Delete Cloudflare DNS record |
| `GET` | `/api/v1/domains/:id/cloudflare/ssl` | Get Cloudflare SSL settings |
| `PUT` | `/api/v1/domains/:id/cloudflare/ssl` | Update Cloudflare SSL settings |
| `GET` | `/api/v1/domains/:id/cloudflare/firewall` | List Cloudflare firewall rules |
| `POST` | `/api/v1/domains/:id/cloudflare/firewall` | Create firewall rule |
| `DELETE` | `/api/v1/domains/:id/cloudflare/firewall/:ruleId` | Delete firewall rule |
| `GET` | `/api/v1/domains/:id/cloudflare/redirects` | List Cloudflare redirect rules |
| `POST` | `/api/v1/domains/:id/cloudflare/redirects` | Create redirect rule |
| `DELETE` | `/api/v1/domains/:id/cloudflare/redirects/:ruleId` | Delete redirect rule |
| `POST` | `/api/v1/domains/:id/cloudflare/route` | Create Cloudflare tunnel route |
| `DELETE` | `/api/v1/domains/:id/cloudflare/route` | Delete tunnel route (Make Private) |
| `POST` | `/api/v1/domains/:id/make-public` | Auto-create tunnel route + CNAME + SSL |

#### Domain Creation Schema

```typescript
{
  name: string;                      // Domain name (required)
  type?: 'primary' | 'subdomain' | 'alias' | 'redirect';  // Default: 'primary'
  parentDomainId?: string;           // For subdomain type
  redirectTarget?: string;           // For redirect type
  websiteMode?: 'none' | 'create' | 'existing';  // Default: 'create'
  websiteId?: string;                // Required if websiteMode='existing'
  websiteName?: string;              // For auto-created website
  documentRoot?: string;             // Custom document root
  phpVersion?: string;               // e.g., '8.2'
  phpHandler?: 'php-fpm' | 'cgi' | 'disabled';
  webServer?: 'nginx' | 'apache' | 'nginx+apache';
  createDns?: boolean;               // Default: true
  createMail?: boolean;              // Default: false
  makePublic?: boolean;              // Auto-create Cloudflare tunnel route
  tunnelId?: string;                 // Preferred tunnel for makePublic
  skipDnsVerification?: boolean;     // Skip DNS verification check
}
```

### Websites API (`/api/v1/websites`)

#### Website CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/websites` | List all websites |
| `POST` | `/api/v1/websites` | Create a new website |
| `GET` | `/api/v1/websites/:id` | Get website with attached domains |
| `PUT` | `/api/v1/websites/:id` | Update website |
| `DELETE` | `/api/v1/websites/:id` | Delete website (cascades) |
| `POST` | `/api/v1/websites/:id/suspend` | Suspend website |
| `POST` | `/api/v1/websites/:id/activate` | Activate website |

#### Domain Attachment

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/websites/:id/domains/attach` | Attach domain to website (`{ domainId }`) |
| `POST` | `/api/v1/websites/:id/domains/detach` | Detach domain (`{ domainId, action }`) |

The `detach` action can be `'redirect'`, `'parked'`, or `'delete'`.

#### Website-Scoped Child Resources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/websites/:websiteId/ftp` | List FTP accounts |
| `GET` | `/api/v1/websites/:websiteId/cron` | List cron jobs |
| `GET` | `/api/v1/websites/:websiteId/backups` | List backups |
| `GET` | `/api/v1/websites/:websiteId/databases` | List databases |
| `GET` | `/api/v1/websites/:websiteId/apps` | List installed apps |

---

## UI Flow & Navigation

### Sidebar Navigation Structure

```
├── Dashboard
├── Websites                    ← /websites
│   └── Website Detail         ← /websites/:id
├── Domains                    ← /domains
│   └── Domain Detail Panel     ← inline expand in DomainsPage
├── DNS                        ← /dns
├── SSL / Certificates          ← /ssl
├── Databases                  ← /databases
├── FTP Accounts                ← /ftp
├── Cron Jobs                   ← /cron
├── Backups                     ← /backups
├── File Manager                ← /files
├── Apps / Marketplace           ← /apps
├── Mail                        ← /mail
├── Cloudflare                  ← /cloudflare
│   └── Tunnel Routes
├── Tunnels                     ← /tunnels
├── Firewall                    ← /firewall
├── Logs                        ← /logs
├── Monitoring                  ← /monitoring
├── Terminal                    ← /terminal
└── Settings
    ├── Server Settings         ← /settings/server
    ├── PHP Settings            ← /php
    └── API Tokens              ← /settings/tokens
```

### WebsitesPage (`/websites`)

**Purpose**: List all websites with create/delete/suspend/activate actions.

**Components**:
- `PageHeader` with "Create Website" button
- `ResponsiveTable` with columns: Name, PHP Version, Web Server, Status, Disk Usage, Actions
- `CreateWebsiteModal` inline modal with form:
  - Website Name (required)
  - Document Root (optional, auto-generated)
  - PHP Version dropdown
  - Web Server dropdown
- `ActionDropdown` with Edit, Suspend/Activate, Delete options
- `ConfirmDialog` for destructive actions

**State**:
- `showCreate`: boolean for create modal
- `deleteTarget`: selected website for deletion
- `suspendTarget`: selected website for suspension
- `activateTarget`: selected website for activation

### WebsiteDetailPage (`/websites/:id`)

**Purpose**: Comprehensive management of a single website with 9 tabs.

**Tabs (9 total)**:

| Tab | Icon | Description |
|-----|------|-------------|
| Overview | Server | Website info cards, quick actions, PHP settings link |
| Domains | Globe | Attached domains list, "Attach Domain" button |
| Subdomains | Globe | Subdomains across all attached domains |
| Files | FolderOpen | File manager placeholder with "Open File Manager" button |
| FTP | Users | FTP accounts table |
| Cron | Clock | Cron jobs table |
| Databases | Database | Databases table |
| Backups | Archive | Backup schedules table |
| Apps | AppWindow | Installed applications table |

**Breadcrumb**: `Websites > {websiteName}`

**Modals**:
- `EditWebsiteModal`: Edit name, document root, PHP version, web server
- `AttachDomainModal`: Select from available unattached domains

**Domain Detail Page (`/domains`)**

When a domain row is clicked, a detail panel expands inline showing:

**Tabs (5 total)**:

| Tab | Description |
|-----|-------------|
| Overview | Linked website section, Cloudflare integration status, SSL info cards, domain services links, access log stats |
| Subdomains | Create subdomain form + list of subdomains |
| Aliases | Create alias form + list of aliases |
| Redirects | Create redirect form + list of path redirects |
| Cloudflare | Only shown if Cloudflare zone is linked |

**Cloudflare Sub-tabs (4 total)**:

| Sub-tab | Description |
|---------|-------------|
| DNS Records | Cloudflare DNS management with add/delete |
| SSL/TLS | SSL mode selection (off/flexible/full/strict), HTTPS toggles, TLS version |
| Firewall | Firewall rules with action/expression/description |
| Redirects | Cloudflare-level redirect rules |

**Breadcrumb**: `Domains > {domainName}`

---

## UI Components

### Modals

| Component | Purpose | Location |
|-----------|---------|----------|
| `CreateWebsiteModal` | Create new website with name, PHP, web server | WebsitesPage |
| `EditWebsiteModal` | Edit website settings | WebsiteDetailPage |
| `AttachDomainModal` | Attach existing domain to website | WebsiteDetailPage.DomainsTab |
| `DeleteConfirm` | Confirm domain deletion with typed confirmation | DomainsPage |
| `LinkWebsiteModal` | Link domain to existing website | DomainsPage |
| `RenameDomainModal` | Rename a domain | DomainsPage |
| `DomainCfDnsTab.createForm` | Add Cloudflare DNS record | DomainsPage |
| `DomainCfFirewallTab.createForm` | Add firewall rule | DomainsPage |
| `DomainCfRedirectsTab.createForm` | Add redirect rule | DomainsPage |

### Reusable UI Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `PageHeader` | Page title with optional description and action buttons | `title`, `description`, `actions` |
| `EmptyState` | Placeholder when no data exists | `icon`, `title`, `description`, `action` |
| `ConfirmDialog` | Destructive action confirmation | `open`, `title`, `message`, `variant`, `requireTyping`, `onConfirm`, `onCancel` |
| `Modal` | Generic modal wrapper | `open`, `onClose`, `title`, `size`, `children` |
| `ResponsiveTable` | Wrapper for `<table>` with responsive scrolling | `children` |
| `Breadcrumb` | Navigation breadcrumb trail | `items: { label, href? }[]` |
| `LoadingSpinner` | Loading state indicator | — |
| `StatusBadge` | Colored badge for status (active/suspended) | `status` |

### DomainStatusBadge Component

Renders a colored badge for domain status:
- `active`: green background
- `suspended`: orange/red background
- `pending`: yellow background

Also displays Cloudflare tunnel status if applicable.

---

## Complete User Flows

### 1. Create Domain Flow

```
User fills domain name
        ↓
Blur / click verify → API call to /api/v1/domains/verify-dns
        ↓
DNS verification result:
  • Points to server → Green checkmark, domain ready
  • Does not point → Red X, show DNS setup instructions
        ↓
User can optionally skip DNS verification
        ↓
Select Website Configuration:
  • Create new website (default) → sets websiteMode='create'
  • Link to existing website → websiteMode='existing', select from dropdown
  • No website (DNS only) → websiteMode='none'
        ↓
[If create new website]
  Optional: customize document root, PHP version, PHP handler, web server
        ↓
Checkboxes: Create DNS zone (default on), Enable mail
        ↓
[If Cloudflare configured + active tunnel]
  Show "Internet Access" section with "Make Public" checkbox
  If checked: auto-create tunnel route + CNAME + SSL on submit
        ↓
Submit → POST /api/v1/domains
  • DNS verification (unless skipped)
  • If websiteMode='create': auto-create website + attach domain
  • If websiteMode='existing': attach to selected website
  • Nginx config regenerated for website
  • If makePublic: auto-create Cloudflare tunnel route
        ↓
Success → Domain appears in list with status badge
```

### 2. Create Subdomain Flow

```
User opens Domain Detail → Subdomains tab
        ↓
Enter subdomain prefix (e.g., "api")
        ↓
Validation:
  • Format: alphanumeric, hyphens allowed, 1-63 chars
  • Reserved names check: www, mail, ftp, admin, root, etc.
  • Duplicate check against existing subdomains
        ↓
[Optional] Customize document root
        ↓
Click "Add" → POST /api/v1/domains/:id/subdomains
        ↓
Backend:
  1. Validate subdomain name format
  2. Check for reserved names
  3. Check for conflicts
  4. Create directory with ownership
  5. Insert subdomain DB record
  6. Auto-create DNS A record (if DNS zone exists)
  7. Auto-create Cloudflare tunnel route (if zone linked)
  8. Regenerate nginx config for parent website
        ↓
On nginx failure → Full rollback (directory, DNS, DB record)
        ↓
Success → Subdomain appears in list with DNS status indicator
```

### 3. Attach Domain to Website Flow

```
Option A: From WebsiteDetailPage → Domains tab
  Click "Attach Domain" → AttachDomainModal
  Select from available (unattached) domains
  Submit → POST /api/v1/websites/:id/domains/attach

Option B: From DomainsPage → Domain Detail → Overview tab
  Click "Link to Website" → LinkWebsiteModal
  Select from existing websites
  Submit → POST /api/v1/websites/:id/domains/attach
        ↓
Backend (attachDomain in WebsitesService):
  1. Validate domain exists and isn't attached elsewhere
  2. Update domain.websiteId in DB
  3. Regenerate website nginx config (adds server_name)
        ↓
Idempotent: if already attached to same website, returns success
        ↓
Nginx config regenerated to include the domain
```

### 4. Manage SSL (Local vs Cloudflare)

**Local SSL (certbot)**:
```
User goes to /ssl
        ↓
Select domain → Request Let's Encrypt certificate
        ↓
Backend:
  1. Run certbot for domain
  2. Store certificate info in sslCertId
  3. Update domain.sslEnabled = true
  4. Reload nginx
```

**Cloudflare SSL**:
```
User opens Domain Detail → Cloudflare tab → SSL/TLS sub-tab
        ↓
Select SSL mode:
  • Off: No encryption
  • Flexible: HTTP to origin (origin can be HTTP)
  • Full: HTTPS to origin, self-signed OK
  • Strict: HTTPS to origin, valid certificate required
        ↓
Additional toggles:
  • Always Use HTTPS
  • Automatic HTTPS Rewrites
  • HTTP/2
  • HTTP/3 (QUIC)
  • Minimum TLS Version
        ↓
Submit → PUT /api/v1/domains/:id/cloudflare/ssl
        ↓
Backend calls Cloudflare API to update zone settings
```

### 5. Make Domain Public/Private via Cloudflare Tunnel

**Make Public**:
```
Option A: During domain creation
  Check "Make this domain publicly accessible via Cloudflare Tunnel"
  Optionally select specific tunnel
  Submit → Domain created + tunnel route auto-created

Option B: Domain Detail → Cloudflare tab
  Click "Make Public" button
  → POST /api/v1/domains/:id/cloudflare/route
        ↓
Backend (autoCreateTunnelRoute):
  1. Find linked Cloudflare zone for domain
  2. Find active tunnel (or use specified tunnelId)
  3. Create tunnel route: hostname → http://localhost:80
  4. Create CNAME DNS record in Cloudflare
  5. Set SSL mode to "full"
  6. Log audit event
        ↓
Result: Domain accessible via Cloudflare Tunnel
```

**Make Private**:
```
Domain Detail → Cloudflare tab
  Click "Make Private" button (replaces "Make Public")
  → DELETE /api/v1/domains/:id/cloudflare/route
        ↓
Backend (autoRemoveTunnelRoutes):
  1. Find tunnel routes for this domain
  2. Delete each route (removes CNAME + route config)
  3. Log audit event
        ↓
Result: Domain no longer publicly accessible via tunnel
```

---

## Nginx Configuration

### Website-Scoped Config Approach

NovaPanel uses **website-scoped nginx configuration** rather than per-domain configuration. Each website gets a single nginx config file that includes all attached domains.

**Config file location**: `/etc/nginx/sites-available/website-{websiteId}.conf`

**Example generated config**:
```nginx
# Website: ws_abc123
# Generated: 2024-01-15

server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/sites/ws_abc123/httpdocs;
    
    index index.php index.html;
    
    # Logs
    access_log /var/www/sites/ws_abc123/logs/access.log;
    error_log /var/www/sites/ws_abc123/logs/error.log;
    
    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # Static files
    location / {
        try_files $uri $uri/ =404;
    }
}

# HTTPS (if SSL enabled)
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;
    root /var/www/sites/ws_abc123/httpdocs;
    
    ssl_certificate /var/www/sites/ws_abc123/ssl/fullchain.pem;
    ssl_certificate_key /var/www/sites/ws_abc123/ssl/privkey.pem;
    
    # ... same config as port 80
}
```

### Config Generation and Rollback

**Generation flow**:
1. `nginxService.generateWebsiteConfig(websiteId)` is called
2. Service queries all domains attached to the website
3. Generates nginx config with all `server_name` entries
4. Writes config to `/etc/nginx/sites-available/website-{id}.conf`
5. Creates symlink in `/etc/nginx/sites-enabled/`
6. Tests config with `nginx -t`
7. Reloads nginx with `nginx -s reload`

**Rollback on failure**:
- If nginx config test fails, the original config is preserved
- For domain creation, if nginx fails, the domain record and any created website are deleted (rollback)
- For subdomain creation, if nginx fails, directory, DNS record, and DB record are all deleted

### Suspended Website Config

When a website is suspended:
1. Original config backed up to `website-{id}.conf.active`
2. New config written with `return 503` for all requests
3. Nginx reloaded

When activated:
1. Original config restored from backup
2. Or regenerated from database if backup unavailable
3. Nginx reloaded

**Suspended config example**:
```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 503;
    add_header Retry-After "3600";
}
```

---

## Appendix: Key Service Classes

### NginxService

Responsible for:
- Generating website configs (`generateWebsiteConfig`)
- Generating subdomain configs (`generateSubdomainConfig`)
- Generating suspended configs (`generateSuspendedConfig`)
- Adding/removing vhosts
- Reloading nginx

### WebServerService

Orchestrates website configuration:
- `applyWebsiteConfig(websiteId)`: Generates nginx + PHP-FPM pool
- `removeWebsiteConfig(websiteId)`: Removes nginx + PHP-FPM pool

### DomainsService

Core domain operations:
- `create()`: Domain with website creation/attachment options
- `delete()`: Full cascade cleanup
- `suspend()`: 503 config with backup
- `activate()`: Restore from backup or regenerate
- `createSubdomain()`: With DNS auto-creation and nginx registration
- `autoCreateTunnelRoute()`: Cloudflare tunnel route creation
- Cloudflare-specific methods for DNS, SSL, firewall, redirects

### WebsitesService

Core website operations:
- `create()`: System user, directory structure, DB record, config
- `delete()`: FTP, cron, backups, config, files, user, detach domains
- `attachDomain()`: Link domain, regenerate nginx
- `detachDomain()`: Unlink domain, regenerate nginx