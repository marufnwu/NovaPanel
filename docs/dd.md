# NovaPanel — Domain & Website Architecture Plan (v3 Final)

> **All decisions locked in:**
> - Subdomains: **fully independent** (own docroot, PHP, logs)
> - Website ↔ Domain: **many-to-1** — multiple domains per website container
> - Website with no domain: **exists silently**, no nginx conf written
> - Domain types: **Primary + Addon + Parked** (plus subdomain, redirect, mail-only)
> - Nginx config: **Website-scoped** — one conf file per website, all domains inside
> - Primary designation: **Yes** — one designated primary per website
> - Subdomain ownership: **Always belongs to a specific parent domain**
> - Single domain suspend: **Addon gets its own 503 block inside the website conf**
> - Parked SSL: **Always shares primary's SSL** (same cert, same server block)

---

## 1. Core Concepts

### 1.1 Website (Hosting Container)

A **Website** is the OS-level container. It owns:

| Resource | Value |
|----------|-------|
| System user | `sf_{nanoid}` |
| Home directory | `/var/www/sites/{websiteId}/` |
| Default PHP version | set at website level, inherited by domains |
| Default PHP handler | set at website level |
| Default web server | set at website level |
| Disk / bandwidth tracking | per website |
| Nginx conf | `/etc/nginx/sites-available/website-{websiteId}.conf` |

A website can exist with **zero domains**. In that state:
- OS user and directory structure are fully created
- **No nginx conf is written** — the website is unreachable from the web
- It appears in the panel with a "No domain attached" indicator
- Adding any domain triggers the first conf write

A website is **never automatically deleted** when a domain is removed. The container always persists independently.

### 1.2 Domain Types

| Type | Description | Own Docroot | Own PHP | Own Logs | Requires Website |
|------|-------------|-------------|---------|----------|-----------------|
| `primary` | Main/first domain, one per website | Yes | Yes (inherits or overrides) | Yes | Yes |
| `addon` | Independent site sharing same OS user and conf | Yes (own subdir) | Yes (inherits or overrides) | Yes | Yes |
| `parked` | Alias — same server block + cert as primary | No | No | No | Yes |
| `subdomain` | Child of a specific domain, fully independent | Yes | Yes (inherits or overrides) | Yes | Yes |
| `redirect` | HTTP 301/302 redirect to another URL | No | No | No | No |
| `mail-only` | DNS/mail only, no web hosting | No | No | No | No |

### 1.3 Primary Domain

Each website has **at most one primary domain**:
- First domain attached automatically becomes primary
- Can be reassigned — old primary is demoted to addon
- Primary domain's SSL cert is **shared by all parked domains** on the website
- The primary label is structural in SSL and nginx `server_name` grouping

### 1.4 Subdomain Ownership

A subdomain **always belongs to a specific parent domain**, not directly to the website:

```
Website: ws_abc123
  Nginx conf: website-ws_abc123.conf
  │
  ├── example.com          (primary)          server_name example.com;
  │   ├── blog.example.com     (subdomain)    server_name blog.example.com;
  │   └── api.example.com      (subdomain)    server_name api.example.com;
  │
  ├── shop.com             (addon)            server_name shop.com;
  │   └── admin.shop.com       (subdomain)    server_name admin.shop.com;
  │
  └── example.net          (parked)           → merged into primary's server block
```

Subdomains inherit `websiteId` from their parent domain. They cannot move to a different website independently — they always follow their parent domain.

### 1.5 Website-Scoped Nginx — How Multiple Domain Types Coexist

Because all domains for a website live in **one conf file**, the structure inside that file is:

```
website-{websiteId}.conf
├── server block: parked domains + primary  (port 80)
├── server block: parked domains + primary  (port 443, if SSL)
├── server block: addon domain A            (port 80)
├── server block: addon domain A            (port 443, if SSL)
├── server block: subdomain of primary      (port 80)
├── server block: subdomain of primary      (port 443, if SSL)
└── server block: subdomain of addon        (port 80)
    ...
```

Parked domains are merged into the primary's `server_name` line — they share the same server block, docroot, and SSL cert. Addons and subdomains each get their own server block inside the same conf file.

### 1.6 Single Domain Suspension Strategy

Since all domains live in one conf file, suspending a single addon domain without affecting others works like this:

- The addon domain's server block is **replaced in-place** within the website conf with a 503 block
- All other server blocks in the same conf are untouched
- The original server block content is stored in the database (`suspendedConfig` column on the domain row), not as a file backup
- On activate, the stored block is reinserted and the conf is regenerated

This is cleaner than file-level backups because the website conf is always regenerated from the database state — suspended domains emit a 503 server block, active domains emit their normal block.

---

## 2. Database Schema

### 2.1 `websites` Table

```sql
CREATE TABLE websites (
  id              TEXT PRIMARY KEY,            -- nanoid, e.g. ws_abc123
  name            TEXT NOT NULL,
  systemUser      TEXT NOT NULL UNIQUE,        -- sf_{nanoid}
  homeDir         TEXT NOT NULL,               -- /var/www/sites/{id}
  phpVersion      TEXT NOT NULL DEFAULT '8.2',
  phpHandler      TEXT NOT NULL DEFAULT 'php-fpm',  -- php-fpm | cgi | disabled
  webServer       TEXT NOT NULL DEFAULT 'nginx+apache', -- nginx | apache | nginx+apache
  status          TEXT NOT NULL DEFAULT 'active',   -- active | suspended
  diskUsedMb      INTEGER NOT NULL DEFAULT 0,
  bandwidthUsedMb INTEGER NOT NULL DEFAULT 0,
  createdAt       INTEGER NOT NULL DEFAULT (unixepoch())
);
```

No `primaryDomainId` on the website — primary is tracked with `isPrimary` on the domain row to avoid a circular FK.

### 2.2 `domains` Table

All domain types — primary, addon, parked, subdomain, redirect, mail-only — live in **one unified table**:

```sql
CREATE TABLE domains (
  id                  TEXT PRIMARY KEY,         -- nanoid
  name                TEXT NOT NULL UNIQUE,     -- FQDN: example.com, blog.example.com
  type                TEXT NOT NULL DEFAULT 'primary',
                      -- primary | addon | parked | subdomain | redirect | mail-only

  -- Relationships
  websiteId           TEXT REFERENCES websites(id) ON DELETE SET NULL,
  parentDomainId      TEXT REFERENCES domains(id) ON DELETE CASCADE,
                      -- subdomain → its parent domain (blog.example.com → example.com)
                      -- parked   → the domain it mirrors (example.net → example.com)
                      -- addon    → NULL (it is a root domain)
                      -- primary  → NULL

  -- Primary flag (at most one per website, enforced by partial unique index below)
  isPrimary           INTEGER NOT NULL DEFAULT 0,

  -- Hosting config (NULL = inherit from website)
  -- NULL for parked, redirect, mail-only
  documentRoot        TEXT,                     -- full path, auto-generated
  phpVersion          TEXT,                     -- NULL = use website.phpVersion
  phpHandler          TEXT,                     -- NULL = use website.phpHandler
  webServer           TEXT,                     -- NULL = use website.webServer

  -- SSL (primary and addon only; parked inherits primary's cert)
  sslEnabled          INTEGER NOT NULL DEFAULT 0,
  sslCertId           TEXT,
  redirectHttpToHttps INTEGER NOT NULL DEFAULT 0,
  hsts                INTEGER NOT NULL DEFAULT 0,

  -- Redirect config (type = redirect only)
  redirectTarget      TEXT,
  redirectType        TEXT DEFAULT '301',        -- 301 | 302

  -- Suspension storage
  -- When a single domain is suspended inside a website conf, its
  -- normal server block content is stored here so it can be restored
  -- without needing a file-level backup.
  suspendedConfig     TEXT,                     -- serialised server block (JSON or raw nginx)

  -- Status
  status              TEXT NOT NULL DEFAULT 'active', -- active | suspended | pending

  createdAt           INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Enforce at most one primary per website at the DB level
CREATE UNIQUE INDEX idx_domains_one_primary_per_website
  ON domains (websiteId)
  WHERE isPrimary = 1 AND websiteId IS NOT NULL;
```

### 2.3 Old Tables → Unified `domains`

| Old table | Becomes |
|-----------|---------|
| `subdomains` | `domains` rows with `type = 'subdomain'`, `parentDomainId` = parent domain id |
| `domainAliases` | `domains` rows with `type = 'parked'`, `parentDomainId` = mirrored domain id |
| `domainRedirects` (path-level) | **Kept as-is** — these are URL-path redirects, not domain-level entities |

### 2.4 `domainRedirects` Table (unchanged)

```sql
CREATE TABLE domainRedirects (
  id          TEXT PRIMARY KEY,
  domainId    TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  sourcePath  TEXT NOT NULL,    -- e.g. /old-page
  targetUrl   TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT '301',
  createdAt   INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 2.5 Full ERD

```
┌──────────────────────────┐
│         websites         │
├──────────────────────────┤
│ id (PK)                  │◄─────────────────────────────────┐
│ name                     │                                  │
│ systemUser               │                                  │
│ homeDir                  │                                  │
│ phpVersion               │                                  │
│ phpHandler               │                                  │
│ webServer                │                                  │ websiteId FK
│ status                   │                                  │
│ diskUsedMb               │          ┌───────────────────────┴──────────────────────────┐
│ bandwidthUsedMb          │          │                      domains                     │
│ createdAt                │          ├──────────────────────────────────────────────────┤
└──────────────────────────┘          │ id (PK)                                          │
           ▲                          │ name (UNIQUE FQDN)                               │
           │                          │ type  primary|addon|parked|subdomain|...         │
           │                          │ websiteId → websites.id                          │
           │                          │ parentDomainId → domains.id ◄──┐                │
           │                          │ isPrimary (0|1, unique per wId)│  self-ref       │
           │                          │ documentRoot                   │  (subdomain,   │
           │                          │ phpVersion (nullable)          │   parked)      │
           │                          │ phpHandler (nullable)          │                │
           │                          │ webServer  (nullable)          │                │
           │                          │ sslEnabled                     │                │
           │                          │ sslCertId                      │                │
           │                          │ redirectHttpToHttps            │                │
           │                          │ hsts                           │                │
           │                          │ redirectTarget                 │                │
           │                          │ redirectType                   │                │
           │                          │ suspendedConfig                │                │
           │                          │ status                         │                │
           │                          │ createdAt                      │                │
           │                          └──────────────────┬─────────────┘                │
           │                                             │                              │
           └─────────────────────────────────────────────┘                              │
                                                         │ domainId FK                  │
                                                         ▼                              │
                                         ┌──────────────────────────┐                  │
                                         │     domainRedirects      │                  │
                                         │  (path-level redirects)  │                  │
                                         └──────────────────────────┘                  │
                                                                                        │
                              ┌─────────────────────────┐   ┌────────────────────────┐ │
                              │    cloudflareZones      │   │     tunnelRoutes       │ │
                              ├─────────────────────────┤   ├────────────────────────┤ │
                              │ domainId FK ────────────┼───┼── domainId FK ─────────┼─┘
                              │ (unchanged schema)      │   │ (unchanged schema)     │
                              └─────────────────────────┘   └────────────────────────┘
```

### 2.6 PHP Resolution Logic

When generating a server block for any domain or subdomain:

```typescript
function resolve(domain: Domain, website: Website) {
  return {
    phpVersion: domain.phpVersion ?? website.phpVersion,
    phpHandler: domain.phpHandler ?? website.phpHandler,
    webServer:  domain.webServer  ?? website.webServer,
  };
}
```

`NULL` in any column means "use the website default." This is resolved at conf-generation time — the database stores intent, not resolved values.

---

## 3. Directory Structure

### 3.1 Website Home Directory

```
/var/www/sites/{websiteId}/
│
├── httpdocs/                         ← primary domain's document root
│
├── addons/
│   ├── {addonDomainId}/
│   │   ├── httpdocs/                 ← addon domain's document root
│   │   └── logs/
│   │       ├── access.log
│   │       └── error.log
│   └── {anotherAddonId}/
│       ├── httpdocs/
│       └── logs/
│
├── subdomains/
│   ├── {subdomainDomainId}/          ← named by domain.id (not the prefix string)
│   │   ├── httpdocs/                 ← subdomain's document root
│   │   └── logs/
│   │       ├── access.log
│   │       └── error.log
│   └── {anotherSubdomainId}/
│       ├── httpdocs/
│       └── logs/
│
├── private/                          ← not web-accessible
├── logs/                             ← primary domain logs
│   ├── access.log
│   └── error.log
├── tmp/
├── ssl/
└── backup/
```

### 3.2 Document Root Assignment Rules

| Domain Type | `documentRoot` | Directory Created? |
|-------------|----------------|--------------------|
| `primary` | `/var/www/sites/{websiteId}/httpdocs` | Yes, at website creation |
| `addon` | `/var/www/sites/{websiteId}/addons/{domainId}/httpdocs` | Yes, at addon creation |
| `parked` | `NULL` — uses primary's docroot in nginx | No |
| `subdomain` | `/var/www/sites/{websiteId}/subdomains/{domainId}/httpdocs` | Yes, at subdomain creation |
| `redirect` | `NULL` | No |
| `mail-only` | `NULL` | No |

### 3.3 Ownership

All directories: `sf_{websiteId}:www-data`, permissions `755` dirs / `644` files.

---

## 4. Nginx Configuration (Website-Scoped)

### 4.1 Single Conf File Layout

```
/etc/nginx/sites-available/website-{websiteId}.conf
/etc/nginx/sites-enabled/website-{websiteId}.conf   ← symlink
```

The conf file is **fully regenerated** from the database whenever any domain in the website changes (attach, detach, suspend, activate, SSL change). This is safe because the database is always the source of truth.

### 4.2 Conf File Internal Structure

```nginx
# ─────────────────────────────────────────────
# website-ws_abc123.conf  |  Generated: <timestamp>
# Website: Main Site  |  System user: sf_abc123
# ─────────────────────────────────────────────

# ── Primary + Parked domains (port 80) ───────
server {
    listen 80;
    # primary + all parked domains share this server block
    server_name example.com example.net example.org;
    root /var/www/sites/ws_abc123/httpdocs;

    access_log /var/www/sites/ws_abc123/logs/access.log;
    error_log  /var/www/sites/ws_abc123/logs/error.log;

    index index.php index.html;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm-ws_abc123.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    location / { try_files $uri $uri/ =404; }
}

# ── Primary + Parked domains (port 443, SSL) ─
server {
    listen 443 ssl http2;
    server_name example.com example.net example.org;
    root /var/www/sites/ws_abc123/httpdocs;

    ssl_certificate     /var/www/sites/ws_abc123/ssl/fullchain.pem;
    ssl_certificate_key /var/www/sites/ws_abc123/ssl/privkey.pem;

    # ... same PHP and location blocks
}

# ── Addon domain: shop.com (port 80) ─────────
server {
    listen 80;
    server_name shop.com;
    root /var/www/sites/ws_abc123/addons/dm_xyz789/httpdocs;

    access_log /var/www/sites/ws_abc123/addons/dm_xyz789/logs/access.log;
    error_log  /var/www/sites/ws_abc123/addons/dm_xyz789/logs/error.log;

    location ~ \.php$ {
        # shop.com overrides PHP to 8.3 → own pool
        fastcgi_pass unix:/run/php/php8.3-fpm-dm_xyz789.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    location / { try_files $uri $uri/ =404; }
}

# ── Subdomain: blog.example.com (port 80) ────
server {
    listen 80;
    server_name blog.example.com;
    root /var/www/sites/ws_abc123/subdomains/dm_blog01/httpdocs;

    access_log /var/www/sites/ws_abc123/subdomains/dm_blog01/logs/access.log;
    error_log  /var/www/sites/ws_abc123/subdomains/dm_blog01/logs/error.log;

    location ~ \.php$ {
        # inherits PHP 8.2 from website → shares website pool
        fastcgi_pass unix:/run/php/php8.2-fpm-ws_abc123.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    location / { try_files $uri $uri/ =404; }
}

# ── SUSPENDED addon: old.com ──────────────────
server {
    listen 80;
    server_name old.com;
    return 503;
    add_header Retry-After "3600";
}
```

### 4.3 Parked Domain SSL Sharing

Parked domains are merged into the primary's `server_name` line:

```nginx
server_name example.com example.net example.org;
#           ^^primary^^  ^^parked^^  ^^parked^^
```

They share the same `ssl_certificate`. This means:
- The SSL cert for the primary domain must be a **multi-SAN cert** (or wildcard) that covers the parked names, OR
- Certbot is run with all parked names included: `certbot --domains example.com,example.net,example.org`
- When a new parked domain is added, the cert must be **renewed/expanded** and the conf regenerated

### 4.4 Per-Domain PHP-FPM Pool Strategy

| Scenario | Pool socket |
|----------|-------------|
| Domain uses website default PHP version | Shared: `/run/php/php{ver}-fpm-{websiteId}.sock` |
| Domain overrides PHP version | Dedicated: `/run/php/php{ver}-fpm-{domainId}.sock` |

Pool config file: `/etc/php/{ver}/fpm/pool.d/{poolName}.conf`

When a domain is deleted, its dedicated pool (if any) is also removed.

### 4.5 Conf Regeneration Triggers

The website conf is regenerated whenever:

| Event | Regeneration needed |
|-------|---------------------|
| Domain attached to website | Yes |
| Domain detached / deleted | Yes |
| Domain suspended / activated | Yes (503 block inserted/removed) |
| Domain PHP version changed | Yes |
| Domain SSL enabled / cert renewed | Yes |
| Parked domain added / removed | Yes (primary server_name changes) |
| Subdomain created / deleted | Yes |
| Website PHP version changed | Yes (all inheriting domains affected) |

### 4.6 Suspended Website Conf

When a whole website is suspended, all server blocks are replaced with 503:

```nginx
# website-ws_abc123.conf (SUSPENDED)
server {
    listen 80;
    server_name example.com example.net;
    return 503;
    add_header Retry-After "3600";
}
server {
    listen 80;
    server_name shop.com;
    return 503;
    add_header Retry-After "3600";
}
# ... one block per domain/subdomain
```

The original conf is backed up as `website-{id}.conf.active` at the file level (since the whole conf is replaced here, not individual blocks).

---

## 5. API Endpoints

### 5.1 Websites API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/websites` | List all websites |
| `POST` | `/api/v1/websites` | Create website (no domain required) |
| `GET` | `/api/v1/websites/:id` | Get website with all attached domains grouped |
| `PUT` | `/api/v1/websites/:id` | Update defaults (name, PHP, web server) |
| `DELETE` | `/api/v1/websites/:id` | Delete website + all domains cascade |
| `POST` | `/api/v1/websites/:id/suspend` | Suspend — replace entire conf with 503 blocks |
| `POST` | `/api/v1/websites/:id/activate` | Restore conf from backup or regenerate |

### 5.2 Domains API

#### Root-level domains

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains` | List all domains (`?type`, `?websiteId`, `?status`, `?search`) |
| `POST` | `/api/v1/domains` | Create domain (primary, addon, parked, redirect, mail-only) |
| `GET` | `/api/v1/domains/verify-dns` | DNS check (`?domain=example.com`) |
| `GET` | `/api/v1/domains/:id` | Get domain detail |
| `PUT` | `/api/v1/domains/:id` | Update (PHP, handler, web server, SSL, HTTPS, HSTS) |
| `DELETE` | `/api/v1/domains/:id` | Delete domain + subdomains cascade + conf regenerate |
| `POST` | `/api/v1/domains/:id/suspend` | Suspend single domain (503 block in conf) |
| `POST` | `/api/v1/domains/:id/activate` | Restore single domain in conf |
| `POST` | `/api/v1/domains/:id/make-primary` | Promote to primary (demotes current primary to addon) |

#### Subdomains

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/subdomains` | List subdomains of this domain |
| `POST` | `/api/v1/domains/:id/subdomains` | Create subdomain |
| `GET` | `/api/v1/domains/:id/subdomains/:subId` | Subdomain detail |
| `PUT` | `/api/v1/domains/:id/subdomains/:subId` | Update subdomain (PHP, docroot) |
| `DELETE` | `/api/v1/domains/:id/subdomains/:subId` | Delete subdomain + conf regenerate |
| `POST` | `/api/v1/domains/:id/subdomains/:subId/suspend` | Suspend subdomain (503 block) |
| `POST` | `/api/v1/domains/:id/subdomains/:subId/activate` | Activate subdomain |

#### Path-level redirects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/redirects` | List path redirects |
| `POST` | `/api/v1/domains/:id/redirects` | Create path redirect |
| `DELETE` | `/api/v1/domains/:id/redirects/:rId` | Delete redirect |

#### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/logs/access` | Access log (`?lines=100`) |
| `GET` | `/api/v1/domains/:id/logs/error` | Error log (`?lines=100`) |
| `GET` | `/api/v1/domains/:id/logs/stats` | Log stats |

#### Cloudflare (unchanged from current)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/domains/:id/cloudflare-zone` | Get linked zone |
| `GET/POST/DELETE` | `/api/v1/domains/:id/cloudflare/dns` | DNS records |
| `GET/PUT` | `/api/v1/domains/:id/cloudflare/ssl` | SSL settings |
| `GET/POST/DELETE` | `/api/v1/domains/:id/cloudflare/firewall` | Firewall rules |
| `GET/POST/DELETE` | `/api/v1/domains/:id/cloudflare/redirects` | Redirect rules |
| `POST/DELETE` | `/api/v1/domains/:id/cloudflare/route` | Tunnel route |
| `POST` | `/api/v1/domains/:id/make-public` | Auto tunnel + CNAME + SSL |

### 5.3 Request Schemas

```typescript
// POST /api/v1/websites
{
  name: string;
  phpVersion?: string;                          // default: '8.2'
  phpHandler?: 'php-fpm' | 'cgi' | 'disabled';
  webServer?: 'nginx' | 'apache' | 'nginx+apache';
}

// POST /api/v1/domains  (primary, addon, parked, redirect, mail-only)
{
  name: string;                                 // FQDN
  type: 'primary' | 'addon' | 'parked' | 'redirect' | 'mail-only';
  websiteId: string;                            // required for primary, addon, parked

  // parked only
  parentDomainId?: string;                      // domain being mirrored

  // redirect only
  redirectTarget?: string;
  redirectType?: '301' | '302';

  // hosting config — null = inherit from website
  documentRoot?: string;                        // auto-generated if omitted
  phpVersion?: string;
  phpHandler?: 'php-fpm' | 'cgi' | 'disabled';
  webServer?: 'nginx' | 'apache' | 'nginx+apache';

  // DNS
  createDns?: boolean;                          // default: true
  skipDnsVerification?: boolean;

  // Cloudflare
  makePublic?: boolean;
  tunnelId?: string;
}

// POST /api/v1/domains/:id/subdomains
{
  prefix: string;           // e.g. "blog" → blog.example.com (FQDN auto-assembled)
  documentRoot?: string;    // auto-generated if omitted
  phpVersion?: string;      // null = inherit from website
  phpHandler?: 'php-fpm' | 'cgi' | 'disabled';
  webServer?: 'nginx' | 'apache' | 'nginx+apache';
  createDns?: boolean;      // default: true
  makePublic?: boolean;
}
```

---

## 6. User Flows

### 6.1 Create Website (No Domain)

```
User → "Create Website"
Fill: Name, PHP Version, PHP Handler, Web Server
Submit → POST /api/v1/websites

Backend:
  1. Generate id: ws_abc123
  2. Create system user: sf_abc123
  3. Create directory tree:
       /var/www/sites/ws_abc123/
       ├── httpdocs/
       ├── addons/
       ├── subdomains/
       ├── private/  logs/  tmp/  ssl/  backup/
  4. Set ownership: sf_abc123:www-data
  5. Create default PHP-FPM pool: php8.2-fpm-ws_abc123
  6. Insert websites row
  7. *** NO nginx conf written ***

UI result:
  Website listed with status "No domain attached"
  Website detail shows "Attach a domain to make this website accessible"
```

### 6.2 Add Primary Domain

```
Website Detail → Domains tab → "Add Domain"
Select type: Primary
Fill: domain name (e.g. example.com)

→ GET /api/v1/domains/verify-dns?domain=example.com
  Green: DNS A record points to server IP
  Red: instructions shown (can skip)

Submit → POST /api/v1/domains
  { type: 'primary', websiteId: 'ws_abc123', name: 'example.com' }

Backend:
  1. Insert domains row
     { type: 'primary', isPrimary: 1, documentRoot: '.../httpdocs' }
  2. Create DNS A record (if DNS zone managed here)
  3. Regenerate website-ws_abc123.conf
     → writes first server block: server_name example.com;
  4. nginx -t  →  nginx -s reload
  5. On failure → delete domain row, DNS record, conf if new

UI result:
  example.com shown as PRIMARY in Domains tab
  Website status indicator: "Active"
```

### 6.3 Add Parked Domain

```
Website Detail → Domains tab → "Add Parked Domain"
Fill: domain name (e.g. example.net)
(automatically mirrors the primary domain)

Submit → POST /api/v1/domains
  { type: 'parked', websiteId: 'ws_abc123', name: 'example.net',
    parentDomainId: '{primaryDomainId}' }

Backend:
  1. Insert domains row
     { type: 'parked', isPrimary: 0, documentRoot: NULL,
       parentDomainId: '{primaryId}' }
  2. Create DNS A record
  3. Regenerate website-ws_abc123.conf
     → primary server block becomes:
        server_name example.com example.net;
  4. If primary has SSL:
     → Expand cert to include example.net
        (certbot certonly --expand -d example.com -d example.net)
     → Regenerate conf with same ssl_certificate path
  5. nginx -t → reload

UI result:
  example.net listed as PARKED → example.com
  No separate docroot shown (shares primary)
  SSL badge inherited from primary
```

### 6.4 Add Addon Domain

```
Website Detail → Domains tab → "Add Addon Domain"
Fill: domain name (e.g. shop.com)
Optional: PHP version override (e.g. 8.3)

Submit → POST /api/v1/domains
  { type: 'addon', websiteId: 'ws_abc123', name: 'shop.com',
    phpVersion: '8.3' }

Backend:
  1. Insert domains row
     { type: 'addon', documentRoot: '.../addons/{id}/httpdocs', phpVersion: '8.3' }
  2. Create directories:
       addons/{domainId}/httpdocs/
       addons/{domainId}/logs/
  3. Set ownership
  4. Create dedicated PHP-FPM pool: php8.3-fpm-{domainId}
     (because phpVersion differs from website default 8.2)
  5. Regenerate website-ws_abc123.conf
     → new server block appended:
        server { server_name shop.com; root .../addons/{id}/httpdocs; ... }
  6. nginx -t → reload
  7. On failure → rollback dirs, pool, DNS, conf, DB row

UI result:
  shop.com listed as ADDON with own docroot path and PHP 8.3 badge
```

### 6.5 Add Subdomain

```
Domain Detail (example.com) → Subdomains tab → "Add Subdomain"
Fill prefix: "blog" → blog.example.com
Optional: PHP version override

Submit → POST /api/v1/domains/example.com-id/subdomains
  { prefix: 'blog', phpVersion: null }

Backend:
  1. Assemble FQDN: blog.example.com
  2. Validate:
     - Format: alphanumeric + hyphens, 1–63 chars
     - Reserved names: www, mail, ftp, admin, root, smtp, imap, pop, ns1, ns2
     - Uniqueness in domains table
  3. Insert domains row
     { type: 'subdomain', name: 'blog.example.com',
       parentDomainId: example.com-id,
       websiteId: ws_abc123,
       documentRoot: '.../subdomains/{id}/httpdocs',
       phpVersion: NULL  ← inherits 8.2 from website }
  4. Create directories:
       subdomains/{domainId}/httpdocs/
       subdomains/{domainId}/logs/
  5. (No new PHP pool — inherits website shared pool php8.2-fpm-ws_abc123)
  6. Auto-create DNS A record
  7. Regenerate website-ws_abc123.conf
     → new server block appended for blog.example.com
  8. nginx -t → reload
  9. On ANY failure → full rollback:
       delete DB row, dirs, DNS record

UI result:
  blog.example.com listed under example.com's Subdomains
  Docroot: /var/www/sites/ws_abc123/subdomains/{id}/httpdocs
  PHP: 8.2 (inherited)
```

### 6.6 Suspend Single Addon Domain

```
Domains list or Website Detail → Action menu on shop.com → "Suspend"

Submit → POST /api/v1/domains/{addonId}/suspend

Backend:
  1. SET domain.status = 'suspended'
  2. Regenerate website-ws_abc123.conf
     → shop.com's server block is replaced with:
        server { listen 80; server_name shop.com; return 503;
                 add_header Retry-After "3600"; }
     → All other server blocks (example.com, blog.example.com) unchanged
  3. nginx -t → reload

UI result:
  shop.com shows SUSPENDED badge
  example.com remains Active, unaffected
  shop.com returns HTTP 503 to visitors
```

### 6.7 Promote Addon to Primary

```
Website Detail → Domains tab → Action on shop.com → "Make Primary"

Submit → POST /api/v1/domains/{shopComId}/make-primary

Backend:
  1. BEGIN TRANSACTION
  2. SET old primary (example.com): isPrimary = 0, type = 'addon'
  3. SET shop.com: isPrimary = 1, type = 'primary'
  4. Find any parked domains (parentDomainId = old primary id)
     → Update parentDomainId to shop.com id
     → These parked domains now mirror shop.com's docroot
  5. COMMIT
  6. Regenerate website-ws_abc123.conf:
     → shop.com server block gains the parked names
     → example.com becomes an addon block
  7. nginx -t → reload
  8. SSL note: if parked domains existed on old primary cert,
     cert needs expanding to include shop.com + parked names

UI result:
  shop.com → PRIMARY badge
  example.com → ADDON badge
  Parked domains now mirror shop.com
```

### 6.8 Delete Domain with Subdomains

```
Domains list → Action on example.com → "Delete"
Confirm dialog: type "example.com" to confirm

Submit → DELETE /api/v1/domains/{id}

Backend:
  1. Fetch all subdomains (type=subdomain, parentDomainId={id})
  2. For each subdomain:
       a. Delete DNS A record
       b. Delete subdomains/{subId}/ directory
       c. Remove dedicated PHP-FPM pool (if override existed)
       d. Remove Cloudflare tunnel route (if exists)
       e. DELETE domains row (cascade from domainRedirects)
  3. For example.com itself:
       a. Delete DNS A record
       b. (no addon dir to delete — primary uses httpdocs/)
       c. Remove from SSL cert (certbot --expand minus this domain)
       d. DELETE domains row
  4. If deleted domain was primary AND other domains remain:
       → Promote lowest createdAt addon domain to primary automatically
       → If no addons remain, website has no primary (shows "no domain" state)
  5. Regenerate website-ws_abc123.conf (or delete conf if no domains left)
  6. nginx -t → reload (or nginx remove symlink if no conf)

UI result:
  example.com and all its subdomains gone
  shop.com auto-promoted to primary (if it was the only addon)
  Website container intact
```

---

## 7. UI Structure

### 7.1 Sidebar Navigation (unchanged from current)

```
├── Dashboard
├── Websites                          /websites
│   └── Website Detail                /websites/:id
├── Domains                           /domains
│   └── Domain Detail (inline panel)
├── DNS / SSL / Databases / FTP / ...
└── Settings
```

### 7.2 WebsitesPage — Table Columns

| Name | Primary Domain | Total Domains | PHP | Status | Disk | Actions |
|------|---------------|--------------|-----|--------|------|---------|
| Main Site | example.com | 5 | 8.2 | Active | 142 MB | ··· |
| Shop | shop.com | 2 | 8.3 | Active | 88 MB | ··· |
| Dev Server | *(no domain)* | 0 | 8.2 | Active | 0 MB | ··· |

"No domain" shown in muted italic when website has zero attached domains.

### 7.3 Create Website Modal

```
┌──────────────────────────────────────────┐
│  Create Website                          │
├──────────────────────────────────────────┤
│  Label *                                 │
│  [                                    ]  │
│                                          │
│  PHP Version          PHP Handler        │
│  [ 8.2          ▼]   [ php-fpm     ▼]   │
│                                          │
│  Web Server                              │
│  [ nginx+apache ▼]                       │
│                                          │
│  ℹ️  No domain needed at creation.        │
│     Attach a domain after to make        │
│     this website publicly accessible.    │
│                                          │
│                       [Cancel]  [Create] │
└──────────────────────────────────────────┘
```

### 7.4 Website Detail — Domains Tab

```
Domains                                              [+ Add Domain ▾]
                                                      ├ Primary Domain
                                                      ├ Addon Domain
                                                      ├ Parked Domain
                                                      └ Redirect

────────────────────────────────────────────────────────────────────
PRIMARY DOMAIN
┌───────────────────────────────────────────────────────────────────┐
│  🌐 example.com                        [SSL ✓]  [Active ●]       │
│  /var/www/sites/ws_abc/httpdocs  │  PHP 8.2 (website default)    │
│  Parked: example.net, example.org                                 │
│                                    [Subdomains ▾] [Manage] [···] │
└───────────────────────────────────────────────────────────────────┘

ADDON DOMAINS
┌───────────────────────────────────────────────────────────────────┐
│  🌐 shop.com                           [SSL ✗]  [Suspended ●]    │
│  /var/www/sites/ws_abc/addons/{id}/httpdocs  │  PHP 8.3          │
│                           [Make Primary]  [Activate]  [···]      │
└───────────────────────────────────────────────────────────────────┘

PARKED DOMAINS
┌───────────────────────────────────────────────────────────────────┐
│  🔗 example.net  →  mirrors example.com   [SSL ✓ (shared)]       │
│  🔗 example.org  →  mirrors example.com   [SSL ✓ (shared)]       │
└───────────────────────────────────────────────────────────────────┘

SUBDOMAINS
┌───────────────────────────────────────────────────────────────────┐
│  blog.example.com     under: example.com   PHP 8.2 (inherited)   │
│  api.example.com      under: example.com   PHP 8.3 (override)    │
│  admin.shop.com       under: shop.com      PHP 8.3 (inherited)   │
└───────────────────────────────────────────────────────────────────┘
```

### 7.5 DomainsPage — Flat List with Type Badges

| Domain | Type | Website | PHP | Status | Actions |
|--------|------|---------|-----|--------|---------|
| example.com | 🔵 Primary | Main Site | 8.2 | Active | ··· |
| example.net | ⚫ Parked | Main Site | — | Active | ··· |
| shop.com | 🟦 Addon | Main Site | 8.3 | Suspended | ··· |
| blog.example.com | 🟣 Subdomain | Main Site | 8.2 | Active | ··· |
| api.example.com | 🟣 Subdomain | Main Site | 8.3 | Active | ··· |
| old.com | 🟠 Redirect | — | — | Active | ··· |

### 7.6 Domain Detail Panel — Tabs by Type

| Tab | Primary | Addon | Parked | Subdomain |
|-----|---------|-------|--------|-----------|
| Overview | ✓ | ✓ | ✓ | ✓ |
| Subdomains | ✓ | ✓ | ✗ | ✗ |
| Redirects (path) | ✓ | ✓ | ✗ | ✓ |
| Cloudflare | ✓ (if linked) | ✓ | ✗ | ✓ |

---

## 8. Service Layer

### 8.1 DomainsService

| Method | Description |
|--------|-------------|
| `create(data)` | Routes to type-specific method based on `data.type` |
| `createPrimary(data)` | Insert row, regenerate website conf |
| `createAddon(data)` | Insert row, create dirs, optional pool, regenerate conf |
| `createParked(data)` | Insert row, expand SSL cert if primary has SSL, regenerate conf |
| `createSubdomain(parentDomainId, data)` | Insert row, create dirs, optional pool, regenerate conf |
| `delete(id)` | Cascade subdomains, delete dirs/pool/DNS, regenerate conf |
| `suspend(id)` | SET status=suspended, regenerate conf (503 block for this domain) |
| `activate(id)` | SET status=active, regenerate conf (restore normal block) |
| `makePrimary(id)` | Swap isPrimary + type flags, re-parent parked domains, regenerate conf |
| `resolveEffectiveConfig(domain, website)` | Merge domain nullable fields with website defaults |

### 8.2 NginxService

| Method | Description |
|--------|-------------|
| `regenerateWebsiteConf(websiteId)` | Full conf rebuild from DB: query all domains, build all server blocks, write file, test, reload |
| `buildPrimaryBlock(domain, parkedDomains, website)` | Returns nginx server block string for primary + parked |
| `buildAddonBlock(domain, website)` | Returns nginx server block string for addon |
| `buildSubdomainBlock(domain, website)` | Returns nginx server block string for subdomain |
| `buildSuspendedBlock(domain)` | Returns 503 server block string |
| `buildSuspendedWebsiteConf(websiteId)` | All blocks → 503 (for whole-website suspend) |
| `testAndReload()` | `nginx -t && nginx -s reload` |
| `removeWebsiteConf(websiteId)` | Delete conf + symlink (when last domain removed) |

**Key invariant:** `regenerateWebsiteConf` is the **only** function that writes the conf file. It always reads from the database and overwrites completely. This means:

- No partial updates, no diffs, no risk of stale blocks
- Suspended domains emit a 503 block (status = 'suspended' in DB)
- Active domains emit their normal block
- The database is always the source of truth

### 8.3 WebsitesService

| Method | Description |
|--------|-------------|
| `create(data)` | System user, dirs, PHP pool, DB row — no nginx conf written |
| `delete(id)` | Delete all domains, dirs, PHP pool, system user, DB row |
| `suspend(id)` | SET status=suspended, write suspended-whole-website conf, reload |
| `activate(id)` | SET status=active, regenerate conf from DB, reload |
| `getWithDomains(id)` | Fetch website + domains grouped by type |

---

## 9. Migration from Current Schema

| Step | Action |
|------|--------|
| 1 | Add columns to `domains`: `type`, `isPrimary`, `parentDomainId`, `suspendedConfig` |
| 2 | SET all existing rows: `type = 'primary'`, `isPrimary = 1` |
| 3 | Migrate `subdomains` rows → `domains` with `type = 'subdomain'` |
| 4 | Migrate `domainAliases` rows → `domains` with `type = 'parked'` |
| 5 | Create `addons/` and `subdomains/` directories under each website home |
| 6 | Move subdomain files from old paths to `subdomains/{domainId}/` |
| 7 | Switch nginx from website-scoped conf generation to regenerate-from-DB approach |
| 8 | Drop `subdomains` and `domainAliases` tables |
| 9 | `nginx -t && nginx -s reload` |

---

## 10. Decision Summary

| Topic | Decision |
|-------|----------|
| Schema | Unified `domains` table — no separate subdomains/aliases tables |
| Website ↔ Domain | Many-to-1; website can have zero domains (no conf until first domain) |
| Subdomain owner | Always the parent domain, not the website directly |
| PHP inheritance | NULL columns on domain → inherit from website at conf generation time |
| Nginx strategy | Website-scoped: one conf, all server blocks inside, fully regenerated from DB |
| Single domain suspend | 503 block inserted for that domain only; rest of conf unchanged |
| Whole website suspend | All blocks → 503; conf backed up at file level |
| Parked SSL | Always shares primary cert; certbot expanded to include parked names |
| Primary | One per website (partial unique index); first attached domain auto-promoted |
| Domainless website | Exists silently; no nginx conf; OS resources fully allocated |
