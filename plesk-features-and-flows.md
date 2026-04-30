# ServerForge — Complete Feature & Function Specification
## Super Admin Single-User Server Panel

> No multi-tenant. No reseller. No customer.
> One admin. Full server control.
> Every feature → every screen → every backend action.

---

## Table of Contents

1. [Authentication & Profile](#1-authentication--profile)
2. [Dashboard & Server Overview](#2-dashboard--server-overview)
3. [Domain Management](#3-domain-management)
4. [Web Server Configuration](#4-web-server-configuration)
5. [PHP Management](#5-php-management)
6. [SSL / TLS Certificates](#6-ssl--tls-certificates)
7. [DNS Management](#7-dns-management)
8. [Mail Management](#8-mail-management)
9. [Database Management](#9-database-management)
10. [FTP Management](#10-ftp-management)
11. [File Manager](#11-file-manager)
12. [Scheduled Tasks (Cron)](#12-scheduled-tasks-cron)
13. [Backup & Restore](#13-backup--restore)
14. [Firewall & Security](#14-firewall--security)
15. [Cloudflare Tunnel](#15-cloudflare-tunnel)
16. [Web Terminal](#16-web-terminal)
17. [Log Viewer](#17-log-viewer)
18. [Server Monitoring & Stats](#18-server-monitoring--stats)
19. [Application Installer](#19-application-installer)
20. [Notifications & Alerts](#20-notifications--alerts)
21. [API Token Management](#21-api-token-management)
22. [Server Settings](#22-server-settings)
23. [Audit Log](#23-audit-log)
24. [Master Function Index](#24-master-function-index)

---

## 1. Authentication & Profile

### Feature List
```
Login with username + password
Remember me (30-day persistent session)
TOTP Two-Factor Authentication (Google Authenticator / Authy)
2FA backup codes — 8 single-use emergency codes
Brute-force protection — lock after 5 failed attempts for 15 minutes
Idle session timeout — auto logout after configurable idle time
Active session list — see all logged-in sessions
Remote session kill — revoke any active session
Change password
Change email address
Change display name
Profile avatar — initials-based auto avatar
Forced password change on first boot
Forgot password via email reset link
```

---

### LOGIN — User Flow
```
Admin visits panel URL
    │
    ▼
Login page loads
    ├── Fields: Username, Password, [Remember Me checkbox]
    │
    ▼
Admin submits form
    │
    ├── Server validates credentials
    │       ├── WRONG (1–4 attempts) ──► Show "Invalid credentials" + attempt count remaining
    │       ├── WRONG (5th attempt)  ──► Show lockout message + countdown timer (15 min)
    │       └── CORRECT
    │               │
    │               ▼
    │           Is 2FA enabled?
    │               ├── YES ──► Redirect to 2FA screen
    │               │             ├── Enter 6-digit TOTP code
    │               │             │       ├── VALID   ──► Login success → Dashboard
    │               │             │       └── INVALID ──► Error (max 3 tries → lockout)
    │               │             └── Click "Use backup code"
    │               │                     ├── Enter backup code
    │               │                     ├── VALID (unused) ──► Login success → Dashboard
    │               │                     │                       Code marked as used
    │               │                     └── INVALID / USED  ──► Error shown
    │               └── NO  ──► Login success → Dashboard
    │
    └── "Forgot password?" link
            ├── Enter registered email
            ├── System sends reset link (expires 1 hour)
            ├── Admin clicks email link
            ├── Enter new password + confirm
            └── Password changed → Redirect to login
```

### LOGIN — Function Flow
```
Admin submits login form
    │
    ├── Validate input schema (username, password not empty)
    ├── Look up user record by username
    │       └── Not found → return generic "Invalid credentials"
    ├── Check if account is locked
    │       └── Locked → return lockout message with remaining time
    ├── Verify password hash (argon2id)
    │       └── Mismatch → increment failed attempt counter → save to DB → return error
    ├── Reset failed attempt counter
    ├── Check if 2FA is enabled on account
    │       └── YES → sign a short-lived temp token (5 min)
    │               → return { requiresTwoFactor: true, tempToken }
    │               → frontend redirects to 2FA screen
    ├── Create session record in DB
    │       → generate session ID (32-byte random)
    │       → store { sessionId, userId, ip, userAgent, expiresAt }
    │       → if rememberMe → expiresAt = now + 30 days
    │       → else          → expiresAt = now + 2 hours idle
    ├── Set secure HTTP-only session cookie on response
    ├── Write audit log entry: auth.login { ip, userAgent, timestamp }
    └── Return user profile data to frontend
```

### 2FA SETUP — User Flow
```
Admin → Profile → Security → "Enable Two-Factor Auth"
    │
    ▼
Step 1: Confirm current password
    │
    ▼
Step 2: QR Code screen
    ├── Show QR code to scan with Authenticator app
    ├── Show manual entry code (for apps that can't scan)
    └── "Next" button
    │
    ▼
Step 3: Verify setup
    ├── Enter 6-digit code from app
    ├── VALID   ──► 2FA enabled
    │               Show backup codes (ONE TIME, must copy/download)
    │               ── 8 codes shown, download button, copy button
    └── INVALID ──► Error, retry
```

### 2FA SETUP — Function Flow
```
Admin initiates 2FA setup
    │
    ├── Generate 20-byte random TOTP secret (base32 encoded)
    ├── Build OTP auth URI:
    │       otpauth://totp/ServerForge:{username}?secret={secret}&issuer=ServerForge
    ├── Generate QR code PNG as base64 data URL
    ├── Store secret temporarily in DB (pending, not yet active)
    └── Return { secret, qrCodeDataUrl } to frontend

Admin submits verification code
    │
    ├── Re-verify admin's current password
    ├── Verify submitted TOTP code against pending secret
    │       └── Invalid → return error
    ├── Generate 8 backup codes
    │       → each code = 10-char alphanumeric random
    │       → hash each code (argon2id)
    │       → store hashed codes array in DB
    ├── Activate 2FA: move pending secret → active secret field
    ├── Write audit log: auth.2fa.enabled
    └── Return plaintext backup codes to frontend (shown ONCE, never stored plain)
```

### SESSIONS — User Flow
```
Admin → Profile → Active Sessions
    │
    ├── Table shows:
    │       Device / Browser | IP Address | Last Active | Current badge
    │
    ├── "Revoke" button on each non-current session
    │       └── Confirm dialog → session deleted → row removed
    │
    └── "Revoke all other sessions" button
            └── Confirm dialog → all sessions except current deleted
```

### SESSIONS — Function Flow
```
Admin requests session list
    │
    ├── Query DB: all sessions WHERE userId = admin.id
    ├── For each session: parse userAgent → extract browser + OS
    └── Return session list

Admin revokes a session
    │
    ├── Verify target session belongs to admin (ownership check)
    ├── Delete session record from DB
    ├── Write audit log: auth.session.revoked { targetSessionId }
    └── Return success
```

---

## 2. Dashboard & Server Overview

### Feature List
```
Real-time server health tiles (CPU %, RAM %, Disk %, Load average)
CPU usage graph (last 1h / 6h / 24h switchable)
RAM usage breakdown (used / cached / free)
Disk usage per mount point
Network I/O graph (in/out bytes per second)
Running services status grid (green/red per service)
Restart any service from dashboard with one click
Server uptime counter
Quick summary counts: Domains, Mailboxes, Databases, SSL certs, Active tunnels
Expiring SSL certificates warning list (< 30 days)
Recent failed login attempts count
Recent audit log entries (last 10 actions)
Quick action buttons: Add Domain, New Database, Issue SSL, Open Terminal
System information: OS, kernel version, hostname, server IP(s)
Cloudflare tunnel connection status widget
```

---

### DASHBOARD — User Flow
```
Admin logs in → Dashboard
    │
    ├── Top row: 4 stat tiles (CPU / RAM / Disk / Uptime)
    │       └── Each tile shows sparkline mini-graph
    │
    ├── Charts row:
    │       ├── CPU + RAM graph (time range toggle: 1h / 6h / 24h)
    │       └── Network I/O graph (same time ranges)
    │
    ├── Services row:
    │       ├── Grid: Nginx | Apache | PHP-FPM | MariaDB | PostgreSQL |
    │       │         Postfix | Dovecot | BIND9 | ProFTPd | Fail2Ban | cloudflared
    │       ├── Each shows: status dot + service name + uptime
    │       └── Click status dot → dropdown: Start / Stop / Restart / View Logs
    │
    ├── Warnings panel (conditional):
    │       ├── SSL certs expiring in < 30 days → list with "Renew" button each
    │       ├── Disk usage > 80% → warning banner
    │       └── Services that are DOWN → alert with restart button
    │
    ├── Summary cards row:
    │       Total Domains | Mailboxes | Databases | FTP Accounts | Active Cron Jobs
    │
    ├── Recent activity feed (last 10 audit events)
    │       └── Each entry: action icon + description + timestamp
    │
    └── Quick actions bar:
            [+ Add Domain] [+ Database] [+ Mailbox] [Issue SSL] [Open Terminal]
```

### DASHBOARD — Function Flow
```
Dashboard page loads
    │
    ├── Parallel data fetch:
    │       ├── getSystemStats()
    │       │       → read /proc/stat       → CPU usage %
    │       │       → read /proc/meminfo    → RAM breakdown
    │       │       → df -h                 → disk usage per mount
    │       │       → cat /proc/loadavg     → 1/5/15 min load average
    │       │       → uptime -s             → boot time
    │       │       → hostname -I           → server IPs
    │       │
    │       ├── getServicesStatus()
    │       │       → for each service: systemctl is-active {service}
    │       │       → return map: { nginx: 'active', postfix: 'inactive', ... }
    │       │
    │       ├── getNetworkStats()
    │       │       → read /proc/net/dev    → bytes in/out per interface
    │       │       → calculate delta from last poll (stored in memory)
    │       │
    │       ├── getEntityCounts()
    │       │       → db.count(domains)
    │       │       → db.count(mailboxes)
    │       │       → db.count(databases)
    │       │       → db.count(ftpAccounts)
    │       │       → db.count(cronJobs WHERE active = true)
    │       │
    │       ├── getExpiringSslCerts()
    │       │       → query sslCertificates WHERE expiresAt < now + 30days
    │       │
    │       └── getRecentAuditLogs(limit: 10)
    │
    └── WebSocket connection opened for real-time stat updates (every 5s)
            → push updated CPU, RAM, network delta, service statuses

Admin clicks "Restart" on a service
    │
    ├── Validate service name against allowlist:
    │       [nginx, apache2, mariadb, postgresql, postfix, dovecot,
    │        bind9, proftpd, fail2ban, cloudflared, php8.x-fpm, valkey]
    ├── Run: systemctl restart {service}
    ├── Wait up to 10s for service to become active
    ├── Check: systemctl is-active {service}
    │       ├── active   → return { success: true }
    │       └── inactive → return { success: false, log: last 20 journal lines }
    ├── Write audit log: service.restart { service, result }
    └── Push updated status via WebSocket to dashboard
```

---

## 3. Domain Management

### Feature List
```
Add new domain
Add subdomain (linked to parent domain)
Add domain alias (parked domain pointing to another)
Add domain redirect (URL redirect, 301 or 302)
Delete domain (with full cleanup)
Suspend domain (disable web access, keep files)
Activate suspended domain
Rename domain
View domain overview: PHP version, web server, SSL status, disk usage
Set document root path
Open domain in browser (quick link)
Clone domain (copy config to a new domain)
Bulk suspend / delete / activate
Domain search and filter
Domain list with sortable columns
Per-domain quick settings panel (slide-over)
Domain-level access logs stats (visits, bandwidth)
```

---

### ADD DOMAIN — User Flow
```
Admin → Domains → "Add Domain" button
    │
    ▼
Slide-over / modal opens:
    ├── Domain name input (e.g., example.com)
    ├── Document root (auto-filled: /var/www/vhosts/example.com/httpdocs)
    │       └── Admin can override
    ├── PHP version selector (8.1 / 8.2 / 8.3 / 8.4)
    ├── PHP handler (PHP-FPM / CGI / Disabled)
    ├── Web server toggle (Nginx only / Apache only / Nginx + Apache)
    ├── "Create DNS zone" checkbox (default ON)
    ├── "Create mail domain" checkbox (default ON)
    └── [Create Domain] button
            │
            ├── Validation errors shown inline if any
            └── Success → domain appears in list → toast "Domain created"
                        → Redirect to Domain Detail page
```

### ADD DOMAIN — Function Flow
```
Admin submits Add Domain form
    │
    ├── Validate input
    │       ├── Domain name: valid FQDN format regex
    │       ├── Domain name: not already in DB
    │       ├── Document root: path starts with /var/www/vhosts/
    │       └── PHP version: one of allowed installed versions
    │
    ├── Generate system username from domain
    │       (example.com → examplecom, max 32 chars)
    │       └── Check collision → suffix _2, _3 if needed
    │
    ├── Create OS system user
    │       → useradd --system --no-create-home --shell /usr/sbin/nologin {systemUser}
    │
    ├── Create directory structure
    │       → mkdir -p /var/www/vhosts/{domain}/httpdocs
    │       → mkdir -p /var/www/vhosts/{domain}/private
    │       → mkdir -p /var/www/vhosts/{domain}/logs
    │       → mkdir -p /var/www/vhosts/{domain}/tmp
    │       → mkdir -p /var/www/vhosts/{domain}/ssl
    │       → mkdir -p /var/www/vhosts/{domain}/backup
    │       → chown -R {systemUser}:www-data /var/www/vhosts/{domain}
    │       → chmod 755 /var/www/vhosts/{domain}
    │       → Place default index.html in httpdocs
    │
    ├── Write PHP-FPM pool config
    │       → render template → /etc/php/{version}/fpm/pool.d/{domain}.conf
    │       → systemctl reload php{version}-fpm
    │
    ├── Write Nginx vhost config
    │       → render template → /etc/nginx/sites-available/{domain}.conf
    │       → symlink → /etc/nginx/sites-enabled/{domain}.conf
    │       → nginx -t (validate) → if fail: rollback + throw error
    │       → systemctl reload nginx
    │
    ├── Write Apache vhost config (if apache or nginx+apache mode)
    │       → render template → /etc/apache2/sites-available/{domain}.conf
    │       → a2ensite {domain}
    │       → apache2ctl configtest → if fail: rollback + throw error
    │       → systemctl reload apache2
    │
    ├── Create BIND9 DNS zone (if checked)
    │       → render zone template → /etc/bind/zones/db.{domain}
    │       → add zone entry to /etc/bind/named.conf.local
    │       → rndc reload
    │
    ├── Create mail domain (if checked)
    │       → generate DKIM key pair
    │       → inject DKIM TXT record into DNS zone
    │       → write Postfix virtual domain entry
    │       → systemctl reload postfix
    │
    ├── Save domain record to DB
    ├── Write audit log: domain.create { domainName }
    └── Return domain record

    ON ANY STEP FAILURE → full rollback:
        delete system user, delete directories,
        remove vhost configs, remove zone file,
        reload affected services, throw descriptive error
```

### SUSPEND DOMAIN — User Flow
```
Admin → Domains list → "..." menu on domain → Suspend
    │
    ├── Confirm dialog: "Suspend example.com? Visitors will see 503."
    └── Confirm → domain row shows "Suspended" badge → toast shown
```

### SUSPEND DOMAIN — Function Flow
```
Admin suspends domain
    │
    ├── Load domain record from DB
    ├── Modify Nginx vhost: replace content with return 503 block
    │       → test config → reload nginx
    ├── Modify Apache vhost: add "Deny from all" → reload apache2
    ├── Update DB: domain.status = 'suspended'
    ├── Write audit log: domain.suspend { domainName }
    └── Return updated domain record
```

### DELETE DOMAIN — Function Flow
```
Admin confirms domain deletion (types domain name to confirm)
    │
    ├── Delete all mailboxes → remove Dovecot users
    ├── Delete mail domain → remove Postfix virtual entries
    ├── Delete all databases → drop DB + users in MariaDB/PG
    ├── Delete all FTP accounts → remove ProFTPd entries
    ├── Delete all cron jobs → remove from system crontab
    ├── Remove SSL cert (certbot revoke or remove nginx SSL block)
    ├── Delete DNS zone → remove zone file + named.conf.local entry → rndc reload
    ├── Remove PHP-FPM pool → delete pool config → reload php-fpm
    ├── Remove Nginx vhost → unlink + delete config → reload nginx
    ├── Remove Apache vhost → a2dissite → delete config → reload apache2
    ├── Delete domain directory tree: rm -rf /var/www/vhosts/{domain}
    ├── Delete system user: userdel {systemUser}
    ├── Delete domain record from DB (cascades to all children)
    ├── Write audit log: domain.delete { domainName }
    └── Return success
```

### SUBDOMAIN — User Flow
```
Admin → Domain Detail → Subdomains tab → "Add Subdomain"
    │
    ├── Fields:
    │       ├── Subdomain prefix (e.g., "api" → api.example.com)
    │       ├── Document root (auto-filled)
    │       └── PHP version (inherits parent, overridable)
    └── Submit → subdomain appears in list
```

### SUBDOMAIN — Function Flow
```
Admin submits subdomain form
    │
    ├── Validate prefix: valid hostname label
    ├── Validate: subdomain.domain not already taken
    ├── Create directory: /var/www/vhosts/{domain}/{sub}.{domain}/httpdocs
    ├── Add server_name block to Nginx vhost (or separate vhost)
    ├── Add PHP-FPM sub-pool if different PHP version
    ├── Add DNS A record for subdomain → rndc reload
    ├── Save subdomain record to DB
    ├── Reload nginx
    ├── Write audit log: subdomain.create { fqdn }
    └── Return subdomain record
```

### DOMAIN ALIAS — Function Flow
```
Admin adds alias (parked domain)
    │
    ├── Validate alias domain format
    ├── Check alias not already registered
    ├── Add alias as additional server_name in Nginx vhost
    ├── Add A record for alias domain in DNS
    ├── Save alias record to DB
    ├── Reload nginx → rndc reload
    ├── Write audit log: alias.create { alias, targetDomain }
    └── Return alias record
```

### DOMAIN REDIRECT — Function Flow
```
Admin adds redirect rule
    │
    ├── Validate source path (must start with /)
    ├── Validate target URL (valid URL format)
    ├── Add redirect rule to Nginx vhost:
    │       → 301: rewrite ^/source(.*)$ https://target.com$1 permanent;
    │       → 302: rewrite ^/source(.*)$ https://target.com$1 redirect;
    ├── Test nginx config → reload nginx
    ├── Save redirect record to DB
    ├── Write audit log: redirect.create { source, target, type }
    └── Return redirect record
```

---

## 4. Web Server Configuration

### Feature List
```
Toggle web server mode per domain: Nginx only / Apache only / Nginx + Apache
Custom Nginx directives input (with syntax validation)
Custom Apache directives / .htaccess toggle
Static file serving via Nginx (bypass PHP)
Hotlink protection (deny image hotlinking from other domains)
IP-based access restriction (whitelist/blacklist IPs per domain)
Gzip compression toggle per domain
Browser caching headers control per domain
Custom error pages (404, 500, 503, etc.) per domain
Directory browsing toggle
Proxy pass configuration (reverse proxy a domain to another port/app)
Request rate limiting per domain
Max upload file size setting
Preview generated Nginx/Apache config before applying
Test config validity before save
Force reload / restart web server
```

---

### WEB SERVER CONFIG — User Flow
```
Admin → Domain Detail → Web Server tab
    │
    ├── Section: Server Mode
    │       └── Radio: [Nginx only] [Apache only] [Nginx + Apache]
    │
    ├── Section: Performance
    │       ├── Gzip compression [ON/OFF toggle]
    │       ├── Browser caching [ON/OFF toggle]
    │       └── Static file expiry (days input)
    │
    ├── Section: Security
    │       ├── Hotlink protection [ON/OFF]
    │       │       └── ON → Allowed domains input (comma-separated)
    │       ├── IP Access Restrictions
    │       │       ├── Mode: [Allow all] [Whitelist] [Blacklist]
    │       │       └── IP list input (CIDR supported)
    │       └── Directory browsing [ON/OFF] (default OFF)
    │
    ├── Section: Reverse Proxy
    │       ├── Enable reverse proxy [ON/OFF]
    │       └── ON → Proxy target URL (e.g., http://localhost:3000)
    │
    ├── Section: Custom Error Pages
    │       └── Per code (404 / 403 / 500 / 502 / 503):
    │               Custom file path or inline HTML editor
    │
    ├── Section: Custom Directives
    │       ├── Nginx directives textarea (raw Nginx config)
    │       └── Apache directives textarea (raw Apache config)
    │
    ├── [Preview Config] button → shows full generated config in modal (read-only)
    ├── [Test Config]   button → runs nginx -t / apache2ctl configtest → shows result
    └── [Save Changes]  button
```

### WEB SERVER CONFIG — Function Flow
```
Admin saves web server settings
    │
    ├── Validate all fields
    ├── Build Nginx vhost config from template + settings:
    │       ├── Insert gzip block if enabled
    │       ├── Insert expires headers if caching enabled
    │       ├── Insert valid_referers block if hotlink protection enabled
    │       ├── Insert allow/deny rules if IP restriction set
    │       ├── Replace fastcgi_pass with proxy_pass if reverse proxy enabled
    │       ├── Insert error_page directives for custom error pages
    │       └── Append custom directives at end of server block
    │
    ├── Write rendered config to /etc/nginx/sites-available/{domain}.conf
    ├── Run nginx -t
    │       └── FAIL → restore old config → return validation error with output
    ├── Run systemctl reload nginx
    ├── Rebuild Apache vhost similarly if Apache mode active
    │       → apache2ctl configtest → reload apache2
    ├── Update domain record in DB with new settings
    ├── Write audit log: webserver.config.update { domain, changes }
    └── Return { success: true, config: renderedConfig }
```

---

## 5. PHP Management

### Feature List
```
List all installed PHP versions on server
Set PHP version per domain (switch between versions)
Set PHP handler per domain: PHP-FPM / CGI / Disabled
PHP-FPM pool settings per domain:
    - memory_limit
    - max_execution_time
    - max_input_time
    - post_max_size
    - upload_max_filesize
    - max_file_uploads
    - pm (dynamic / static / ondemand)
    - pm.max_children
    - pm.start_servers
    - pm.min_spare_servers
    - pm.max_spare_servers
    - request_terminate_timeout
Custom php.ini values per domain (key=value pairs)
open_basedir restriction toggle (security jail to doc root)
Disable dangerous PHP functions per domain (exec, system, passthru, etc.)
View PHP info (phpinfo() output in panel)
Restart PHP-FPM pool for domain
Check PHP-FPM pool status (active workers, idle workers, requests served)
Global PHP settings (fallback defaults for all domains)
```

---

### PHP SETTINGS — User Flow
```
Admin → Domain Detail → PHP tab
    │
    ├── Section: PHP Version & Handler
    │       ├── Version selector: [8.1] [8.2] [8.3] [8.4] (only shows installed)
    │       └── Handler: [PHP-FPM] [CGI] [Disabled]
    │
    ├── Section: PHP-FPM Process Manager
    │       ├── pm mode: [dynamic] [static] [ondemand]
    │       ├── Max children (number input)
    │       ├── Start servers, Min spare servers, Max spare servers
    │       └── Request terminate timeout
    │
    ├── Section: PHP Limits
    │       ├── Memory limit (256M)
    │       ├── Max execution time (300)
    │       ├── Max input time (300)
    │       ├── Upload max filesize (64M)
    │       ├── Post max size (64M)
    │       └── Max file uploads (20)
    │
    ├── Section: Security
    │       ├── open_basedir restriction [ON/OFF]
    │       └── Disabled functions checklist:
    │               [exec] [system] [passthru] [popen] [proc_open]
    │               [shell_exec] [eval] [base64_decode]
    │
    ├── Section: Custom php.ini Values
    │       └── Key-value pair editor (add/remove rows)
    │
    ├── [View PHP Info] button → opens phpinfo() in modal iframe
    ├── [Restart FPM Pool] button → immediate restart of this domain's pool
    └── [Save Changes] button
```

### PHP SETTINGS — Function Flow
```
Admin saves PHP settings
    │
    ├── Validate all values
    │       ├── memory_limit: valid PHP size string (256M, 1G)
    │       ├── pm values: integers, min_spare < max_spare < max_children
    │       └── custom ini keys: safe allowlist only
    │
    ├── Render PHP-FPM pool config from template
    │       → write to /etc/php/{version}/fpm/pool.d/{domain}.conf
    │
    ├── Render php.ini overrides
    │       → write to /etc/php/{version}/fpm/conf.d/99-{domain}.ini
    │
    ├── If version changed:
    │       ├── Remove old pool config from old version's pool.d
    │       ├── Update Nginx vhost fastcgi_pass to new socket path
    │       │       → test nginx config → reload nginx
    │       └── Reload new PHP version FPM
    │
    ├── Run: systemctl reload php{version}-fpm
    ├── Update domain record in DB: { phpVersion, phpHandler, phpSettings }
    ├── Write audit log: php.config.update { domain, version, changes }
    └── Return { success: true, poolStatus: 'active' }

Admin views PHP info
    │
    ├── Create temp file: {httpdocs}/.sf_phpinfo_{random}.php → <?php phpinfo(); ?>
    ├── Internal HTTP request to http://localhost with Host: {domain}
    ├── Capture response HTML
    ├── Delete temp file immediately
    └── Return HTML to frontend (shown in sandboxed iframe)
```

---

## 6. SSL / TLS Certificates

### Feature List
```
Issue free Let's Encrypt certificate (HTTP-01 challenge)
Issue Let's Encrypt wildcard certificate (DNS-01 via Cloudflare API)
Upload custom certificate (paste PEM / upload files)
Generate self-signed certificate
View certificate details: issuer, validity, SANs, fingerprint
Enable SSL / redirect HTTP to HTTPS toggle
Enable HSTS (Strict Transport Security)
HSTS preload option
OCSP stapling toggle
Certificate expiry warnings (dashboard + email)
Auto-renew Let's Encrypt certificates (background job)
Manual renew button
Revoke / remove certificate
Certificate chain validator
Multi-domain SAN certificates
Mixed-content checker (scan for HTTP resources in HTTPS domain)
Download certificate files (cert.pem, key.pem, chain.pem)
```

---

### ISSUE LET'S ENCRYPT — User Flow
```
Admin → Domain Detail → SSL tab
    │
    ├── SSL Status: "Not secured" badge
    └── [Issue SSL Certificate] button
            │
            ▼
    SSL issuance modal:
        ├── Certificate type: [Let's Encrypt Free] [Custom/Upload] [Self-Signed]
        │
        ├── Let's Encrypt selected:
        │       ├── Domains to include:
        │       │       ├── ✅ example.com (primary, locked)
        │       │       ├── ✅ www.example.com (default checked)
        │       │       └── [ ] sub.example.com (optional subdomains listed)
        │       ├── Contact email (pre-filled from server settings)
        │       └── [Issue Certificate] button
        │
        ▼
    Progress modal (real-time via WebSocket):
        ├── "Verifying domain is reachable..."
        ├── "Creating HTTP challenge file..."
        ├── "Requesting certificate from Let's Encrypt..."
        ├── "Certificate issued! Configuring web server..."
        └── "Done!" ← modal closes, SSL tab updates

    Error states:
        ├── Domain not reachable → "Port 80 must be accessible"
        ├── Rate limit hit → "Too many certificates issued. Try again in X hours."
        └── Challenge failed → "Let's Encrypt could not verify domain ownership."
```

### ISSUE LET'S ENCRYPT — Function Flow
```
Admin requests Let's Encrypt certificate
    │
    ├── Pre-checks:
    │       ├── Verify domain status is 'active'
    │       ├── Check HTTP port 80 is accessible (internal curl check)
    │       └── Check LE rate limits in DB history (5 certs/week per domain)
    │
    ├── Emit progress event: "verifying_domain"
    │
    ├── Run certbot:
    │       certbot certonly --webroot
    │           -w /var/www/vhosts/{domain}/httpdocs
    │           -d {domain} -d www.{domain} {additional SANs}
    │           --email {contactEmail}
    │           --agree-tos --non-interactive --cert-name {domain}
    │       Stream certbot output to frontend via WebSocket
    │
    ├── Certbot success:
    │       ├── Certificate paths:
    │       │       cert:  /etc/letsencrypt/live/{domain}/fullchain.pem
    │       │       key:   /etc/letsencrypt/live/{domain}/privkey.pem
    │       │       chain: /etc/letsencrypt/live/{domain}/chain.pem
    │       │
    │       ├── Parse expiry date:
    │       │       openssl x509 -noout -enddate -in {certPath}
    │       │
    │       ├── Write SSL Nginx vhost config:
    │       │       → add listen 443 ssl http2 block
    │       │       → ssl_certificate / ssl_certificate_key directives
    │       │       → add redirect: listen 80 → return 301 https://$host$request_uri
    │       │       → test nginx → reload nginx
    │       │
    │       ├── Save cert record to DB:
    │       │       { domainId, type: 'letsencrypt', expiresAt, autoRenew: true }
    │       │
    │       ├── Update domain: { sslEnabled: true, sslCertId }
    │       ├── Write audit log: ssl.issue { domain, type: 'letsencrypt', expiresAt }
    │       └── Emit progress event: "done"
    │
    └── Certbot failure:
            → parse certbot error output into human-readable message
            → emit progress event: "error"
            → no DB changes

AUTO-RENEW (background job — daily at 3:00 AM)
    │
    ├── Query DB: all LE certs WHERE autoRenew = true AND expiresAt < now + 30 days
    ├── For each expiring cert:
    │       ├── Run: certbot renew --cert-name {domain} --non-interactive
    │       ├── SUCCESS:
    │       │       ├── Update DB: expiresAt = new expiry, lastRenewedAt = now
    │       │       ├── Reload nginx
    │       │       └── Send notification: "SSL renewed for {domain}"
    │       └── FAILURE:
    │               ├── Increment renewalFailCount in DB
    │               └── Send alert notification
    └── If cert expires in < 7 days and renewal failed → send urgent alert
```

### CUSTOM CERTIFICATE — Function Flow
```
Admin uploads custom certificate
    │
    ├── Accept: certificate PEM, private key PEM, CA chain PEM (optional)
    ├── Validate certificate:
    │       ├── openssl x509 -noout -text → parse cert info
    │       ├── Verify private key matches cert: compare modulus hashes
    │       ├── Verify cert covers domain (check CN and SANs)
    │       └── Check cert is not expired
    │
    ├── Copy cert files to /var/www/vhosts/{domain}/ssl/
    │       → chmod 600 key file, chown root:root
    │
    ├── Write SSL Nginx vhost block pointing to these files
    ├── Test nginx → reload nginx
    ├── Save cert record to DB: { type: 'custom', expiresAt, autoRenew: false }
    ├── Write audit log: ssl.custom.upload { domain, expiresAt }
    └── Return cert details
```

---

## 7. DNS Management

### Feature List
```
Full DNS zone per domain (BIND9)
Record types: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR
Auto-generated default records on domain creation:
    - A record: @ → server IP
    - A record: www → server IP
    - MX record: @ → mail.domain.com (priority 10)
    - A record: mail → server IP
    - TXT record: SPF
    - TXT record: DKIM (when mail enabled)
    - TXT record: DMARC
    - NS records (primary + secondary)
Add / edit / delete any record
Set TTL per record
Zone serial auto-increment on every change
Import zone from BIND zone file text
Export zone as BIND zone file
Reset zone to defaults
DNS propagation checker (query external resolvers: 8.8.8.8, 1.1.1.1)
View raw zone file
External DNS mode: disable local BIND, manage via Cloudflare API
SOA record management
```

---

### DNS MANAGEMENT — User Flow
```
Admin → Domain Detail → DNS tab
    │
    ├── Zone info bar: Primary NS | Serial | Status (active/inactive)
    │
    ├── Record table columns:
    │       Type | Name | Value | TTL | Priority | Actions
    │
    ├── Records grouped by type (A first, then MX, TXT, etc.)
    │
    ├── Inline "Add Record" form at bottom:
    │       ├── Type selector (A / AAAA / CNAME / MX / TXT / NS / SRV / CAA)
    │       ├── Name field (e.g., @ or www or subdomain)
    │       ├── Value field (IP / hostname / text)
    │       ├── TTL (default 3600)
    │       └── Priority (shown only for MX / SRV)
    │
    ├── Each existing record row:
    │       ├── [Edit] → row turns into inline edit form
    │       └── [Delete] → confirm dialog → record removed
    │
    ├── Toolbar:
    │       ├── [Import Zone] → textarea/file upload for BIND zone text
    │       ├── [Export Zone] → download .zone file
    │       ├── [Reset to Defaults] → confirm → regenerate default records
    │       ├── [View Raw Zone File] → modal with raw text
    │       └── [Check Propagation] → query 8.8.8.8, 1.1.1.1, 9.9.9.9 → show results
    │
    └── SOA section (expandable):
            Primary nameserver, Admin email, Refresh/Retry/Expire/Minimum TTL
```

### DNS RECORD CRUD — Function Flow
```
Admin adds DNS record
    │
    ├── Validate type-specific rules:
    │       A:     valid IPv4 address
    │       AAAA:  valid IPv6 address
    │       CNAME: valid hostname (cannot coexist with other records on same name)
    │       MX:    valid hostname, priority integer 0-65535
    │       TXT:   max 255 chars per string, properly quoted
    │       SRV:   _service._proto format, priority/weight/port/target
    │       CAA:   flags tag value format
    │       TTL:   integer, minimum 60
    │
    ├── Save record to DB
    ├── Regenerate zone file:
    │       → query all records for zone from DB
    │       → render BIND zone template with all records
    │       → auto-increment serial (YYYYMMDDnn format)
    │       → write to /etc/bind/zones/db.{domain}
    │
    ├── Run: rndc reload {domain}
    │       └── FAIL → restore previous zone file → throw error
    │
    ├── Write audit log: dns.record.add { domain, type, name, value }
    └── Return updated record list

DNS PROPAGATION CHECK
    │
    ├── For each public resolver: [8.8.8.8, 1.1.1.1, 9.9.9.9, 208.67.222.222]
    │       ├── Query A record for domain via dns.resolve4()
    │       ├── Query MX record
    │       └── Record result: { resolver, ip, matches: boolean, latencyMs }
    └── Return results array → frontend shows table with ✅/❌ per resolver
```

---

## 8. Mail Management

### Feature List
```
Enable / disable mail for a domain
Create mailbox (user@domain.com)
Set mailbox password
Set per-mailbox storage quota (MB / GB)
View mailbox disk usage
Delete mailbox
Create email alias (alias@domain.com → destination)
Create email forwarder (copies or redirects)
Create catch-all address
Auto-responder per mailbox (vacation/out-of-office message)
Mailbox suspension (block login without deleting)
DKIM key generation (2048-bit RSA)
DKIM DNS record auto-injection
SPF record helper (one-click recommended SPF setup)
DMARC record helper (policy: none / quarantine / reject)
View DKIM / SPF / DMARC status (valid / invalid)
SpamAssassin toggle per domain
SpamAssassin score threshold setting
Webmail access link (Roundcube integration)
SMTP / IMAP / POP3 connection settings display
Mail queue viewer (show stuck/queued messages)
Flush mail queue button
Delete message from mail queue
Mail logs viewer per domain
```

---

### MAIL MANAGEMENT — User Flow
```
Admin → Domain Detail → Mail tab
    │
    ├── Mail Domain Status: [Enabled / Disabled toggle]
    │
    ├── Sub-tabs: [Mailboxes] [Aliases] [Settings] [Security] [Logs]
    │
    ├── MAILBOXES tab:
    │       ├── Table: Address | Quota | Used | Status | Actions
    │       ├── [Add Mailbox] button → modal:
    │       │       ├── Username (prefix before @domain.com)
    │       │       ├── Password (with strength meter + generate button)
    │       │       ├── Quota (MB, 0 = unlimited)
    │       │       ├── Auto-responder [ON/OFF]
    │       │       │       └── ON → Subject + Message textarea
    │       │       └── [Create] button
    │       │
    │       └── Per-mailbox actions:
    │               Change password | Change quota | Toggle auto-responder
    │               Suspend / Activate | View usage | Delete
    │
    ├── ALIASES tab:
    │       ├── Table: Alias | Destination | Type | Actions
    │       └── [Add Alias] → Alias address, Destination, Type (alias/forward+copy/forward only)
    │
    ├── SETTINGS tab:
    │       ├── Catch-all address [ON/OFF] → destination input
    │       ├── SpamAssassin [ON/OFF] → score threshold slider
    │       ├── Spam folder auto-create [ON/OFF]
    │       └── Connection info (read-only):
    │               IMAP: mail.domain.com:993 (SSL)
    │               POP3: mail.domain.com:995 (SSL)
    │               SMTP: mail.domain.com:587 (STARTTLS)
    │
    └── SECURITY tab:
            ├── DKIM: Status badge | [Generate Key] | [Rotate Key]
            │         DNS TXT record preview (auto-added to DNS)
            ├── SPF: Current record display | [Apply Recommended] | Manual editor
            └── DMARC: Policy selector [none/quarantine/reject] | Report email | [Apply]
```

### CREATE MAILBOX — Function Flow
```
Admin creates mailbox
    │
    ├── Validate:
    │       ├── Username: valid local-part (RFC 5321)
    │       ├── Address: username@domain not already registered
    │       ├── Password: minimum 8 chars
    │       └── Quota: non-negative integer
    │
    ├── Hash password: dovecot pw -s SHA512-CRYPT
    │
    ├── Write to Postfix virtual mailbox file:
    │       /etc/postfix/vmailbox → append: {user}@{domain}  {domain}/{user}/
    │       → run: postmap /etc/postfix/vmailbox
    │
    ├── Write to Dovecot user DB:
    │       /etc/dovecot/users → append: {user}@{domain}:{hashedPw}
    │
    ├── Create mailbox directory:
    │       → mkdir -p /var/mail/vhosts/{domain}/{user}
    │       → chown -R vmail:vmail /var/mail/vhosts/{domain}/{user}
    │
    ├── Set quota (if dovecot-quota plugin used)
    │
    ├── If auto-responder enabled:
    │       → write Sieve rule file: /var/mail/sieve/{domain}/{user}.sieve
    │       → sievec (compile sieve script)
    │
    ├── Reload postfix + dovecot
    ├── Save mailbox record to DB
    ├── Write audit log: mail.mailbox.create { address }
    └── Return mailbox record
```

### DKIM GENERATION — Function Flow
```
Admin clicks "Generate DKIM Key"
    │
    ├── Generate RSA 2048-bit key pair (Node.js crypto.generateKeyPair)
    ├── Format public key for DNS TXT record:
    │       → build TXT value: "v=DKIM1; k=rsa; p={publicKey}"
    │
    ├── Store private key (AES-256-GCM encrypted) in DB
    │
    ├── Write OpenDKIM key files:
    │       → /etc/opendkim/keys/{domain}/mail.private (chmod 600)
    │       → /etc/opendkim/keys/{domain}/mail.txt
    │
    ├── Update OpenDKIM config:
    │       → /etc/opendkim/KeyTable: add {domain} entry
    │       → /etc/opendkim/SigningTable: add @{domain} entry
    │
    ├── Reload OpenDKIM: systemctl reload opendkim
    │
    ├── Auto-inject DKIM DNS TXT record:
    │       → add: mail._domainkey.{domain} TXT "v=DKIM1; k=rsa; p=..."
    │       → regenerate zone file → rndc reload
    │
    ├── Write audit log: mail.dkim.generate { domain }
    └── Return { publicKey, dnsRecord, status: 'active' }
```

---

## 9. Database Management

### Feature List
```
Create MariaDB database
Create PostgreSQL database
Create database user
Assign user to database with specific privileges
Change database user password
Revoke user from database
Delete database user
Delete database
View database size
phpMyAdmin access (single sign-on link)
phpPgAdmin access (single sign-on link)
Export database (mysqldump / pg_dump to .sql.gz)
Import database from SQL file (upload)
Clone database (copy schema + data to new DB)
Repair database tables (MariaDB: mysqlcheck)
Optimize database tables (MariaDB: mysqlcheck --optimize)
Database character set and collation selection
Remote access toggle (allow connections from %)
View database tables list
In-panel SQL query editor
```

---

### DATABASE MANAGEMENT — User Flow
```
Admin → Databases page
    │
    ├── Database list table:
    │       Name | Engine | Size | Domain | Users | Actions
    │
    ├── [Add Database] button → modal:
    │       ├── Engine: [MariaDB] [PostgreSQL]
    │       ├── Database name (prefix auto-added: sf_{name})
    │       ├── Character set (utf8mb4 default)
    │       ├── Collation (auto-set from charset)
    │       ├── Create user with same name [checkbox default ON]
    │       │       └── ON → password field (auto-generate option)
    │       └── [Create] button
    │
    ├── Per-database actions menu:
    │       ├── [Manage Users] → users list + add user
    │       ├── [phpMyAdmin / phpPgAdmin] → opens in new tab with SSO
    │       ├── [Export] → download .sql.gz with progress
    │       ├── [Import] → file upload modal → progress bar
    │       ├── [Clone] → enter new name → duplicate
    │       ├── [Repair] (MariaDB only)
    │       ├── [Optimize] (MariaDB only)
    │       └── [Delete] → confirm by typing DB name
    │
    └── Inline Query Editor (per database):
            SQL textarea → [Execute] → Results table (paginated)
```

### CREATE DATABASE — Function Flow
```
Admin creates database
    │
    ├── Validate:
    │       ├── Name: alphanumeric + underscore only, max 64 chars
    │       ├── Name: not already in DB engine
    │       └── Engine: 'mariadb' or 'postgresql'
    │
    ├── MariaDB:
    │       → mysql -u root -e "CREATE DATABASE \`{name}\`
    │           CHARACTER SET {charset} COLLATE {collation};"
    │
    ├── PostgreSQL:
    │       → psql -U postgres -c "CREATE DATABASE \"{name}\"
    │           ENCODING '{encoding}';"
    │
    ├── If create user checked:
    │       → CREATE USER '{user}'@'localhost' IDENTIFIED BY '{password}';
    │       → GRANT ALL PRIVILEGES ON {name}.* TO '{user}'@'localhost';
    │       → FLUSH PRIVILEGES;
    │
    ├── Save database record to DB
    ├── Write audit log: database.create { name, engine }
    └── Return database record
```

### DATABASE EXPORT — Function Flow
```
Admin exports database
    │
    ├── Generate unique export filename: {db}_{timestamp}.sql.gz
    ├── Run dump:
    │       MariaDB:    mysqldump -u root {dbName} | gzip > /tmp/{filename}
    │       PostgreSQL: pg_dump -U postgres {dbName} | gzip > /tmp/{filename}
    │
    ├── Stream progress via WebSocket
    ├── On completion: serve file as download, delete temp file after
    ├── Write audit log: database.export { name }
    └── Return file stream
```

---

## 10. FTP Management

### Feature List
```
Create FTP account per domain
Set FTP account password
Set FTP account home directory (default: httpdocs)
Set FTP account as read-only
Suspend FTP account
Delete FTP account
List all FTP accounts per domain
Change FTP password
View last FTP login (IP, timestamp)
Show FTP connection info (host, port, credentials)
FTPS (FTP over TLS) support
ProFTPd global settings (passive port range, max connections)
```

---

### FTP MANAGEMENT — User Flow
```
Admin → Domain Detail → FTP tab
    │
    ├── FTP account list: Username | Home Dir | Mode | Status | Last Login | Actions
    │
    ├── [Add FTP Account] button → modal:
    │       ├── Username (prefix format: domain_user)
    │       ├── Password (+ generate button)
    │       ├── Home directory (selector: httpdocs / private / custom path)
    │       ├── Access mode: [Read + Write] [Read only]
    │       └── [Create] button
    │
    ├── Per-account actions:
    │       Change password | Change directory | Toggle read-only | Suspend | Delete
    │
    └── Connection info card (per account):
            Host: {server-ip or tunnel domain}
            Port: 21 (FTP) / 990 (FTPS)
            Username: {username}
```

### CREATE FTP ACCOUNT — Function Flow
```
Admin creates FTP account
    │
    ├── Validate:
    │       ├── Username unique across all FTP accounts
    │       ├── Home directory within /var/www/vhosts/{domain}/
    │       └── Password meets minimum requirements
    │
    ├── Create system user (restricted):
    │       → useradd --no-create-home --shell /bin/false
    │               --home-dir {homeDir} {ftpUsername}
    │       → echo "{user}:{pass}" | chpasswd
    │
    ├── Configure ProFTPd jail:
    │       → write entry to /etc/proftpd/vhosts/{domain}.conf
    │       → if read-only: add <Limit WRITE> DenyAll </Limit>
    │
    ├── Reload ProFTPd: systemctl reload proftpd
    ├── Save FTP account to DB
    ├── Write audit log: ftp.account.create { username, domain }
    └── Return FTP account record
```

---

## 11. File Manager

### Feature List
```
Browse directory tree (left panel) + file list (right panel)
Navigate by clicking folders
Breadcrumb path bar
File / folder search within current directory
Create new folder
Create new file (opens inline editor)
Upload files (drag-and-drop + click to select)
Multi-file upload with progress bar
Upload zip and auto-extract
Download file
Download folder as zip
Rename file or folder
Move files / folders (drag or cut+paste)
Copy files / folders
Delete file / folder (single + multi-select)
Select all / deselect all
File permissions editor (chmod: owner/group/other, r/w/x checkboxes + octal input)
Ownership display (user:group)
File size and last modified timestamp
Sort by name / size / date
Code editor (CodeMirror) for text files with syntax highlighting
Image preview (.jpg .png .gif .webp .svg)
Video preview (.mp4 .webm)
PDF preview
Archive browser (peek inside .zip)
Extract archive (.zip, .tar.gz, .tar.bz2)
Compress selected files to .zip or .tar.gz
Disk usage view per folder
Hidden files toggle (show/hide dotfiles)
```

---

### FILE MANAGER — User Flow
```
Admin → Domain Detail → File Manager
    │
    ├── Layout: Left tree | Right file list | Top toolbar
    │
    ├── Left tree:
    │       Domain root → httpdocs / private / logs / tmp / ssl / backup
    │
    ├── Top toolbar:
    │       [⬆ Upload] [📁 New Folder] [📄 New File] [⬇ Download]
    │       [📦 Archive] [✂️ Cut] [📋 Paste] [🗑 Delete] [🔍 Search]
    │
    ├── File list columns:
    │       ☐ | Icon | Name | Size | Modified | Permissions
    │
    ├── Double-click folder → navigate into it
    ├── Double-click text file → open code editor modal
    ├── Double-click image → open image preview modal
    ├── Right-click any item → context menu:
    │       Open / Edit | Download | Rename | Copy | Cut | Permissions | Delete
    │
    ├── Upload interaction:
    │       → drag files onto file list area
    │       → progress bar appears per file
    │       → files appear in list on completion
    │
    └── Permissions modal:
            ├── Visual checkbox grid: Owner [r][w][x] | Group [r][w][x] | Other [r][w][x]
            ├── Octal value auto-calculates and is editable directly
            ├── "Apply to all children" checkbox (for directories)
            └── [Save] button
```

### FILE MANAGER — Function Flow
```
Browse directory
    │
    ├── Resolve absolute path: path.resolve(domainRoot, requestedPath)
    ├── SECURITY CHECK: ensure resolved path starts with domainRoot
    │       → if not → throw 403 "Path traversal detected"
    ├── Read directory: fs.readdir with withFileTypes
    ├── For each entry: stat → size, mtime, mode, uid, gid
    └── Return sorted list: folders first, then files

Upload file
    │
    ├── Validate target directory (path traversal check)
    ├── Validate file: max size check (default 512MB)
    ├── Stream file to temp path: /tmp/sf_upload_{random}
    ├── Move temp file to target path
    ├── Set ownership: chown {systemUser}:{systemUser} {file}
    ├── Set permissions: chmod 644 {file}
    ├── Write audit log: files.upload { path, size }
    └── Return { name, size, path }

Edit and save file
    │
    ├── Validate path (traversal check)
    ├── Check file is text (mime type check)
    ├── Check file size < 5MB (refuse binary/huge files)
    ├── Write content: fs.writeFile(resolvedPath, content, 'utf-8')
    ├── Write audit log: files.edit { path }
    └── Return success

Change permissions
    │
    ├── Validate path (traversal check)
    ├── Validate octal mode (0000-0777 range)
    ├── Run: chmod {mode} {path}
    ├── If applyToChildren and is directory:
    │       → find {path} -exec chmod {mode} {} \;
    ├── Write audit log: files.chmod { path, mode }
    └── Return updated permissions
```

---

## 12. Scheduled Tasks (Cron)

### Feature List
```
View all cron jobs on server
Add new cron job
Visual schedule builder + raw cron expression input
Set command to run
Set which user runs the cron (root or domain system user)
Enable / disable cron job without deleting
Delete cron job
View last run status (success / failed)
View last run output (stdout + stderr)
View next scheduled run time
Run cron job immediately (manual trigger)
Email on cron failure notification toggle per job
Common schedule presets: every minute / hourly / daily / weekly / monthly
Cron expression validator and human-readable description
Cron job run history (last 20 executions)
```

---

### CRON MANAGEMENT — User Flow
```
Admin → Cron Jobs
    │
    ├── Job list table:
    │       Schedule | Command | User | Status | Last Run | Next Run | Actions
    │
    ├── [Add Cron Job] button → modal:
    │       ├── Schedule builder:
    │       │       ├── Presets: [Every minute] [Hourly] [Daily] [Weekly] [Monthly]
    │       │       └── Custom: 5 input fields (min | hour | day | month | weekday)
    │       │               + real-time human readable: "Runs every day at 3:00 AM"
    │       ├── Command input: full shell command
    │       │       e.g., /usr/bin/php /var/www/vhosts/example.com/httpdocs/cron.php
    │       ├── Run as: selector (root / domain system user)
    │       ├── Email on failure: [ON/OFF]
    │       └── [Add Job] button
    │
    └── Per-job actions:
            [Run Now] → triggers immediately, shows output in modal
            [View History] → last 20 run results (time, exit code, output)
            [Enable/Disable] toggle
            [Edit] → same form as add
            [Delete] → confirm → removes from crontab
```

### CRON JOB — Function Flow
```
Admin adds cron job
    │
    ├── Validate cron expression:
    │       → parse with cron-parser library
    │       → return next 5 run times to frontend for confirmation
    │
    ├── Sanitize command:
    │       → no unintended shell injection characters
    │       → must start with absolute path or known interpreter
    │
    ├── Write to system crontab:
    │       → crontab -u {runAsUser} -l → read existing lines
    │       → append: {cronExpression} {command} # sf:{jobId}
    │       → pipe back to: crontab -u {runAsUser} -
    │
    ├── Save job record to DB: { schedule, command, runAsUser, isActive }
    ├── Write audit log: cron.job.create { schedule, command }
    └── Return job record with next run time

Admin runs job immediately
    │
    ├── Execute command: exec as {runAsUser}, capture stdout, stderr, exit code
    ├── Store in job_runs table: { jobId, startedAt, finishedAt, exitCode, output }
    └── Return { exitCode, output } to frontend

Cron job executes on schedule
    │
    ├── Wrapper captures output + exit code
    ├── Write to job_runs table
    ├── Update job: lastRunAt, lastRunStatus
    └── If failed and emailOnFailure: send alert email
```

---

## 13. Backup & Restore

### Feature List
```
Manual backup trigger (full or selective)
Scheduled automatic backups (daily / weekly / monthly)
Backup scope per run:
    - Website files (httpdocs + all subdirectories)
    - Databases (all or selected)
    - DNS zone files
    - Mail data (mailboxes + configuration)
    - FTP configuration
    - Panel configuration
Backup storage options:
    - Local storage (/var/backups/serverforge/)
    - Remote SFTP server
    - S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO)
Backup list with: domain, date, size, type, location
Download backup archive
Restore full backup
Restore partial (files only, or DB only, or mail only)
Delete backup
Retention policy: keep last N backups per domain (auto-purge old)
Backup encryption (AES-256 password-protected archive)
Backup integrity check (hash verification)
Backup notification on success / failure
Backup progress (real-time via WebSocket)
```

---

### BACKUP — User Flow
```
Admin → Backups page
    │
    ├── Sub-tabs: [Backups List] [Schedule] [Storage Settings]
    │
    ├── BACKUPS LIST tab:
    │       ├── Backup table:
    │       │       Domain | Date | Size | Type | Storage | Status | Actions
    │       │
    │       └── [Create Backup] button → modal:
    │               ├── Scope: [Full] [Custom]
    │               │       Custom: ☐ Files ☐ Databases ☐ Mail ☐ DNS ☐ Config
    │               ├── Domain: [All domains] or specific domain selector
    │               ├── Encrypt backup: [ON/OFF] → password field if ON
    │               └── [Start Backup] → real-time progress modal:
    │                       "Dumping databases..." → "Archiving files..."
    │                       → "Compressing..." → "Uploading to remote..." → "Complete!"
    │
    ├── SCHEDULE tab:
    │       ├── Enable scheduled backups [ON/OFF]
    │       ├── Frequency: [Daily] [Weekly] [Monthly]
    │       ├── Time: time picker
    │       ├── Scope: same checkboxes as manual
    │       ├── Retention: "Keep last __ backups" number input
    │       └── [Save Schedule] button
    │
    └── STORAGE SETTINGS tab:
            ├── Primary storage: [Local] [SFTP] [S3-compatible]
            ├── Local path config
            ├── SFTP config: host, port, user, password/key, remote path
            ├── S3 config: endpoint, bucket, access key, secret key, region
            └── [Test Connection] button
```

### BACKUP — Function Flow
```
Admin triggers backup
    │
    ├── Create backup session record in DB: { status: 'running', startedAt }
    │
    ├── Step 1: Dump databases
    │       MariaDB:    mysqldump -u root --single-transaction {db} > /tmp/sf_bk/{db}.sql
    │       PostgreSQL: pg_dump -U postgres {db} > /tmp/sf_bk/{db}.sql
    │       Emit progress event: { step: 'databases', percent: X }
    │
    ├── Step 2: Archive files
    │       tar -czf /tmp/sf_bk/files.tar.gz
    │           --exclude=.../logs --exclude=.../tmp
    │           /var/www/vhosts/{domain}/
    │       Emit progress event: { step: 'files', percent: X }
    │
    ├── Step 3: Export DNS zones
    │       Copy /etc/bind/zones/db.{domain} → /tmp/sf_bk/dns/
    │
    ├── Step 4: Export mail config + data
    │       Copy Dovecot users file, Postfix virtual files
    │       Optionally: tar mailbox directories
    │
    ├── Step 5: Export panel config
    │       DB record exports as JSON, redacted .env copy
    │
    ├── Step 6: Bundle all into single archive
    │       tar -czf /tmp/sf_{domain}_{timestamp}.sfbk /tmp/sf_bk/
    │       Write manifest.json: { version, date, scope, domains, sizes }
    │
    ├── Step 7: Encrypt (if enabled)
    │       openssl enc -aes-256-cbc -pbkdf2 -in {archive} -out {archive}.enc
    │
    ├── Step 8: Calculate checksum (sha256sum)
    │
    ├── Step 9: Upload to remote (if configured)
    │       SFTP: sftp connection → put file → verify size
    │       S3:   SDK putObject with multipart for large files
    │
    ├── Cleanup temp files
    ├── Update backup record in DB: { status: 'complete', size, checksum, storagePath }
    ├── Apply retention policy: auto-delete oldest beyond keepN
    ├── Send notification: "Backup complete: {domain}, size: {size}"
    └── Emit final event: { step: 'done', backupId }

Admin restores backup
    │
    ├── Confirm dialog: "This will OVERWRITE current files and databases."
    ├── Download archive from storage to /tmp/
    ├── Verify checksum against stored hash
    │       └── MISMATCH → abort: "Backup file is corrupted"
    │
    ├── Extract archive to /tmp/sf_restore_{random}/
    ├── Restore files: rsync -av /tmp/sf_restore/files/ /var/www/vhosts/{domain}/
    ├── Fix ownership: chown -R {systemUser}:www-data
    ├── Restore databases:
    │       MariaDB:    mysql -u root {db} < /tmp/sf_restore/db/{db}.sql
    │       PostgreSQL: psql -U postgres {db} < /tmp/sf_restore/db/{db}.sql
    ├── Restore DNS zones: copy zone files back → rndc reload
    ├── Cleanup temp files
    ├── Write audit log: backup.restore { backupId, domain, scope }
    └── Return { success: true }
```

---

## 14. Firewall & Security

### Feature List
```
View all UFW rules (allow/deny/reject)
Add firewall rule: port / protocol / source IP / action
Delete firewall rule
Enable / disable UFW
Toggle UFW rule (enable without deleting)
Preset rule buttons: Allow SSH, HTTP, HTTPS, FTP, SMTP, IMAP, POP3, MySQL
Reset to default rules
View UFW status
Fail2Ban jail list
View currently banned IPs per jail
Manually unban IP from jail
Manually ban IP in jail
View Fail2Ban log
Fail2Ban settings per jail: maxRetry, findTime, banTime
View recent login failures (from auth.log)
View recent successful logins
Port scanner (scan own server for open ports)
SSH settings management (port, password auth toggle, root login toggle)
Automatic security updates toggle (unattended-upgrades)
Panel login attempt log
```

---

### FIREWALL — User Flow
```
Admin → Firewall & Security page
    │
    ├── Sub-tabs: [UFW Rules] [Fail2Ban] [Login Activity] [SSH Settings]
    │
    ├── UFW RULES tab:
    │       ├── Status banner: UFW Active / Inactive [Toggle button]
    │       ├── Default policies row: Incoming: Deny | Outgoing: Allow
    │       ├── Rules table: # | Action | From | Port | Protocol | Comment | Actions
    │       │
    │       ├── Quick presets bar:
    │       │       [+ SSH] [+ HTTP] [+ HTTPS] [+ FTP] [+ MySQL] [+ SMTP] [+ IMAP]
    │       │
    │       └── [Add Custom Rule] button → modal:
    │               Action: [Allow/Deny/Reject]
    │               Direction: [In/Out]
    │               Protocol: [TCP/UDP/Any]
    │               Port: single (80) / range (8000:9000) / service name (http)
    │               Source IP: CIDR or blank (any)
    │               Comment: optional label
    │
    ├── FAIL2BAN tab:
    │       ├── Jails list: Name | Status | Currently Banned | Max Retry | Ban Time | Actions
    │       ├── Per-jail: [Enable/Disable] [Configure] [View Banned IPs]
    │       ├── Banned IPs modal: IP Address | Banned At | Ban Expires | [Unban]
    │       └── [Ban IP manually] button → IP input + jail selector
    │
    ├── LOGIN ACTIVITY tab:
    │       Panel login attempts (last 50): IP | Time | Success/Failed | User-Agent
    │       SSH login attempts from auth.log: IP | Time | Result | Username
    │
    └── SSH SETTINGS tab:
            SSH Port (default 22)
            Root login: [Prohibited] [Allowed] [Keys Only]
            Password authentication: [Enabled] [Disabled]
            Max auth tries: number input
            [Save SSH Config] button
```

### FIREWALL — Function Flow
```
Admin adds UFW rule
    │
    ├── Validate port (integer 1-65535 or range or service name)
    ├── Validate protocol (tcp / udp / any)
    ├── Validate source IP (valid CIDR or empty)
    │
    ├── Build UFW command:
    │       ufw {allow|deny|reject} from {ip|any} to any port {port} proto {tcp|udp}
    │
    ├── Run UFW command
    ├── Save rule to DB (mirror of UFW state for display)
    ├── Write audit log: firewall.rule.add { action, port, source }
    └── Return updated rules list

Admin unbans IP in Fail2Ban
    │
    ├── Validate IP address format
    ├── Run: fail2ban-client set {jail} unbanip {ip}
    ├── Write audit log: fail2ban.unban { ip, jail }
    └── Return { success: true }

Admin saves SSH settings
    │
    ├── Read current /etc/ssh/sshd_config
    ├── Update specific directives (Port, PermitRootLogin, PasswordAuthentication, MaxAuthTries)
    ├── Write updated sshd_config
    ├── Run: sshd -t (config test)
    │       └── FAIL → restore original config → throw error
    ├── Run: systemctl restart sshd
    ├── Write audit log: ssh.settings.update
    └── Return { success: true, warning: "Ensure you can still connect before closing this session" }
```

---

## 15. Cloudflare Tunnel

### Feature List
```
Setup wizard (first-time guided flow)
Enter Cloudflare API token
Select Cloudflare account and zone
Create named tunnel (cloudflared tunnel create)
View all tunnels (list)
Delete tunnel
Add ingress route: hostname → local service
Edit ingress route
Delete ingress route
Enable / disable individual routes
Tunnel status: active / inactive / error
View cloudflared live logs (WebSocket tail)
Start / stop / restart cloudflared daemon
View tunnel metrics
Auto-create CNAME DNS record in Cloudflare for each route
One-click expose panel itself via tunnel
One-click expose a domain via tunnel
Tunnel config file preview
```

---

### CLOUDFLARE TUNNEL — User Flow
```
Admin → Cloudflare Tunnel page
    │
    ├── First time: Setup Wizard
    │       ├── Step 1: Enter Cloudflare API Token
    │       │       └── [Validate Token] → shows account name if valid
    │       ├── Step 2: Select Zone (domain in Cloudflare)
    │       │       └── Dropdown populated from CF API: list of zones
    │       ├── Step 3: Tunnel Name input (e.g., "my-home-server")
    │       ├── Step 4: [Create Tunnel]
    │       │       → "Creating tunnel..." → "Installing service..." → "Done!"
    │       └── Step 5: Add first route
    │               Hostname (panel.yourdomain.com) + Service (https://localhost:8443)
    │               [Add Route + Create DNS] button
    │
    └── Configured state: Tunnel Dashboard
            ├── Status card:
            │       Animated green pulse (connected) | Tunnel ID | Connections count
            │       [Stop] / [Restart] buttons
            │
            ├── Ingress Routes table:
            │       Hostname | Service | Status | CNAME | Actions
            │       [Add Route] button → hostname + service URL + auto-DNS toggle
            │       Per-route: [Enable/Disable] [Edit] [Delete]
            │
            ├── Config Preview card:
            │       [View config.yml] → modal with raw YAML
            │
            └── Live Logs card:
                    Scrolling log output from cloudflared (via WebSocket)
```

### CLOUDFLARE TUNNEL — Function Flow
```
Admin completes setup wizard
    │
    ├── Validate API token:
    │       GET https://api.cloudflare.com/client/v4/user/tokens/verify
    │       Check permissions include tunnel + DNS edit
    │
    ├── Fetch zones:
    │       GET https://api.cloudflare.com/client/v4/zones
    │
    ├── Create tunnel:
    │       → cloudflared tunnel create {tunnelName}
    │       → parse tunnel ID from output
    │       → read credentials JSON: ~/.cloudflared/{uuid}.json
    │       → move to /etc/cloudflared/{uuid}.json (chmod 600)
    │
    ├── Write initial config to /etc/cloudflared/config.yml:
    │       tunnel: {uuid}
    │       credentials-file: /etc/cloudflared/{uuid}.json
    │       ingress:
    │         - service: http_status:404
    │
    ├── Install systemd service:
    │       → cloudflared service install
    │       → systemctl enable cloudflared
    │
    ├── Save to DB: { tunnelId, name, accountId, apiToken (encrypted) }
    └── Return setup complete

Admin adds tunnel route
    │
    ├── Validate hostname ends with configured zone domain
    ├── Validate service URL format
    ├── Add to tunnel routes DB
    ├── Rebuild /etc/cloudflared/config.yml:
    │       Query all active routes from DB → render YAML → write file
    │
    ├── Reload cloudflared: systemctl reload cloudflared
    │
    ├── If auto-DNS enabled:
    │       POST https://api.cloudflare.com/client/v4/zones/{zoneId}/dns_records
    │       Body: { type: "CNAME", name: {hostname},
    │               content: "{tunnelId}.cfargotunnel.com", proxied: true }
    │
    ├── Write audit log: tunnel.route.add { hostname, service }
    └── Return updated routes list

Tunnel status polling (every 30s)
    │
    ├── systemctl is-active cloudflared → active/inactive
    ├── cloudflared tunnel info {tunnelId} --output json → connection count
    ├── Update DB: tunnel.status
    └── Push status update to frontend via WebSocket
```

---

## 16. Web Terminal

### Feature List
```
Full browser-based terminal (xterm.js)
Shell as root (full access for admin)
256-color / truecolor support
Resize terminal (responsive to window size)
Copy selected text to clipboard
Paste from clipboard
Tab completion (native shell)
Scrollback buffer
Custom font size
Clear terminal button
Reconnect on disconnect (auto-reconnect with countdown)
Multiple terminal tabs
Terminal session timeout (configurable idle timeout)
Download terminal session log
```

---

### WEB TERMINAL — User Flow
```
Admin → Terminal page
    │
    ├── Terminal opens immediately (full-page xterm.js)
    ├── Connected as: root
    ├── Prompt: root@hostname:~#
    │
    ├── Toolbar (thin bar above terminal):
    │       [+ New Tab] [Font -] [Font +] [Clear] [Download Log] [Disconnect]
    │
    ├── Tab bar (if multiple sessions):
    │       [Terminal 1] [Terminal 2 ×] [+]
    │
    └── On disconnect:
            "Connection lost. Reconnecting in 3s..." countdown → auto-reconnect
```

### WEB TERMINAL — Function Flow
```
Admin opens terminal
    │
    ├── Frontend opens WebSocket: /ws/terminal?sessionToken={jwt}
    │
    ├── Backend on WS connection:
    │       ├── Verify JWT session token
    │       ├── Spawn PTY process (node-pty):
    │       │       pty.spawn('/bin/bash', [], {
    │       │           name: 'xterm-256color',
    │       │           cols: 80, rows: 24,
    │       │           cwd: '/root',
    │       │           env: { HOME: '/root', USER: 'root', TERM: 'xterm-256color' }
    │       │       })
    │       └── Write audit log: terminal.session.start { ip, userAgent }
    │
    ├── PTY data → WebSocket send to browser
    │
    ├── Message types (browser → backend):
    │       { type: 'input', data: 'ls -la\n' }    → pty.write(data)
    │       { type: 'resize', cols: 120, rows: 40 } → pty.resize(cols, rows)
    │       { type: 'ping' }                        → keep-alive
    │
    ├── Message types (backend → browser):
    │       { type: 'output', data: '...' }
    │       { type: 'exit', code: 0 }
    │
    ├── On PTY exit:
    │       → send { type: 'exit' } to browser
    │       → close WebSocket
    │       → Write audit log: terminal.session.end { duration }
    │
    └── On WS disconnect:
            → pty.kill('SIGHUP') → cleanup
```

---

## 17. Log Viewer

### Feature List
```
Domain access logs (Nginx / Apache per domain)
Domain error logs (Nginx / Apache per domain)
PHP-FPM logs per domain
Mail logs (Postfix, Dovecot) per domain
DNS query logs (BIND9)
FTP logs (ProFTPd) per domain
Panel system logs (ServerForge internal)
Fail2Ban logs
System auth log (/var/log/auth.log)
Real-time log tail (WebSocket streaming, auto-scroll)
Date range filter
Search/filter within log content
Download log file
Clear log file (with confirm)
Log rotation settings per domain
Log size indicator per domain
```

---

### LOG VIEWER — User Flow
```
Admin → Domain Detail → Logs tab
    │
    ├── Log type selector tabs:
    │       [Access] [Error] [PHP] [Mail] [FTP] [DNS]
    │
    ├── Controls bar:
    │       [▶ Live Tail] toggle | Lines: [100] [500] [1000]
    │       [🔍 Search] text input | [⬇ Download] | [🗑 Clear Log] → confirm
    │
    ├── Log output area:
    │       Monospace font, dark background
    │       Colorized: errors red, warnings yellow, info white
    │       Line numbers in gutter
    │
    └── Log rotation section (expandable):
            Rotate: [Daily] [Weekly] [When size exceeds: __ MB]
            Keep: last __ rotated files
            Compress old logs: [ON/OFF]
```

### LOG VIEWER — Function Flow
```
Admin opens live log tail
    │
    ├── Browser opens WebSocket: /ws/logs?domain={id}&type={access|error|php|mail}
    │
    ├── Backend resolves log file path:
    │       access → /var/www/vhosts/{domain}/logs/{domain}-access.log
    │       error  → /var/www/vhosts/{domain}/logs/{domain}-error.log
    │       php    → /var/log/php{version}-fpm/{domain}.log
    │       mail   → /var/log/mail.log (filtered by domain)
    │
    ├── Security check: log path within allowed directories
    ├── Send last 100 lines immediately
    ├── Start file watcher (chokidar) on log file:
    │       → on file change: read new bytes since last position
    │       → send new content to browser via WebSocket
    │       → browser appends + auto-scrolls
    │
    └── On WS disconnect: stop file watcher, cleanup
```

---

## 18. Server Monitoring & Stats

### Feature List
```
Real-time CPU usage (overall + per core)
RAM usage (total / used / cached / free / swap)
Disk usage per mount point (used / free / percentage)
Network I/O (bytes in/out per second per interface)
Disk I/O (read/write bytes per second)
System load average (1m / 5m / 15m)
Server uptime
Top processes (by CPU, by RAM)
Per-domain disk usage breakdown
Per-domain bandwidth usage (monthly totals)
Historical graphs: CPU, RAM, Network (last 1h / 6h / 24h / 7d / 30d)
Service health checks
Alert thresholds: email when CPU > X%, disk > X%, etc.
OS info: kernel version, distribution, architecture
Installed software versions
Open file descriptor count
Active TCP connections count
```

---

### MONITORING — User Flow
```
Admin → Statistics & Monitoring page
    │
    ├── Top row: real-time tiles (refresh every 5s):
    │       [CPU: 23%] [RAM: 4.2/8 GB] [Disk: 120/500 GB] [Load: 0.45] [Uptime: 14d 3h]
    │
    ├── Charts section (time range: [1h] [6h] [24h] [7d] [30d]):
    │       ├── CPU % line chart (multi-line: total + per core)
    │       ├── RAM area chart (stacked: used / cached / free)
    │       ├── Network I/O chart (in: blue, out: green)
    │       └── Disk I/O chart (read: orange, write: purple)
    │
    ├── Top Processes table (refresh every 10s):
    │       Rank | PID | Process Name | CPU% | RAM | User
    │
    ├── Per-Domain Usage table:
    │       Domain | Disk Used | Bandwidth (month) | Last Updated
    │
    ├── Software Versions card:
    │       Nginx 1.24.0 | Apache 2.4.57 | PHP 8.1/8.2/8.3/8.4 | MariaDB 10.11
    │       Postfix 3.7 | Dovecot 2.3 | BIND 9.18 | ServerForge 1.0.0
    │
    └── Alert Thresholds section:
            CPU alert: [__]% for [__] minutes → email
            RAM alert: [__]% → email
            Disk alert: [__]% → email
            [Save Thresholds] button
```

### MONITORING — Function Flow
```
Stats collection background job (every 30 seconds)
    │
    ├── CPU:     read /proc/stat → calculate delta from previous read → percent
    ├── RAM:     read /proc/meminfo → parse MemTotal, MemAvailable, Buffers, Cached
    ├── Disk:    df -B1 → parse all mounts (source, size, used, avail, pcent)
    ├── Network: read /proc/net/dev → calculate delta bytes in/out
    ├── Disk I/O: read /proc/diskstats → calculate delta
    ├── Load:    read /proc/loadavg → 1m/5m/15m values
    │
    ├── Store in stats_history DB table (rolling window: delete records > 30 days old)
    │
    ├── Check alert thresholds:
    │       → if cpu > threshold sustained → send alert email (track state to avoid repeat)
    │       → if disk > threshold → send alert email
    │
    └── Push update to all connected dashboard WebSocket clients

Per-domain bandwidth tracking (hourly batch)
    │
    ├── Parse Nginx access logs per domain:
    │       awk '{sum += $10} END {print sum}' {domain}-access.log
    │       → extract total bytes sent (field $10 in combined log format)
    ├── Update domain bandwidth_used_mb in DB
    └── Reset monthly totals on 1st of each month
```

---

## 19. Application Installer

### Feature List
```
One-click install: WordPress, Joomla, Drupal, Magento, PrestaShop, Laravel (skeleton), Next.js (skeleton)
Select target domain and subdirectory (or root)
Set admin credentials during install
Set database (auto-create or select existing)
Auto-detect existing installation (warn if files present)
Install progress with real-time output
Post-install checklist shown
List installed applications per domain
Update application (for WordPress: WP-CLI upgrade)
View application admin URL link
Uninstall application (with confirm, optionally keep database)
WordPress-specific extras:
    - Install/activate plugins (WP-CLI)
    - Install/activate themes (WP-CLI)
    - Run WP-CLI commands from panel
    - WordPress core update check
    - Plugin update list + one-click update all
    - Enable/disable maintenance mode
    - WordPress debug mode toggle
    - Create WordPress admin user
    - Reset WordPress admin password
```

---

### APP INSTALLER — User Flow
```
Admin → Application Installer page
    │
    ├── Available Apps grid (icon + name + version + Install button):
    │       [WordPress] [Joomla] [Drupal] [Magento] [PrestaShop] [Laravel] [Next.js]
    │
    ├── Click [Install WordPress] → modal:
    │       ├── Target domain: selector dropdown
    │       ├── Subdirectory: input (blank = root, or /blog, /shop)
    │       ├── Database: [Auto-create new] or [Use existing → dropdown]
    │       ├── Site title input
    │       ├── Admin username, password (strength meter), email
    │       ├── Language: dropdown
    │       └── [Install] button
    │
    ├── Install progress modal:
    │       "Downloading WordPress 6.x..." [====50%]
    │       "Extracting files..."          [===100%]
    │       "Creating database..."         ✅
    │       "Configuring wp-config.php..." ✅
    │       "Running WordPress installer..." ✅
    │       "Done!" [Open Site] [Open Admin Panel] [Close]
    │
    └── Installed apps list:
            App | Domain | Path | Version | Last Updated | Actions
            Actions: [Open] [Admin] [Update] [WP-CLI] [Uninstall]
```

### APP INSTALLER — Function Flow
```
Admin installs WordPress
    │
    ├── Validate target path is empty (or warn if not)
    ├── Download WordPress:
    │       curl -sL https://wordpress.org/latest.zip -o /tmp/wp.zip
    │
    ├── Extract to target directory:
    │       unzip /tmp/wp.zip -d /tmp/wp_extract/
    │       rsync -a /tmp/wp_extract/wordpress/ {documentRoot}/
    │       rm -rf /tmp/wp.zip /tmp/wp_extract/
    │
    ├── Create database + user (if auto-create)
    │
    ├── Generate wp-config.php:
    │       wp config create
    │           --dbname={db} --dbuser={user} --dbpass={pass}
    │           --dbhost=localhost --path={documentRoot} --allow-root
    │
    ├── Run WordPress installation:
    │       wp core install
    │           --url=https://{domain} --title="{siteTitle}"
    │           --admin_user={adminUser} --admin_password={adminPass}
    │           --admin_email={adminEmail} --path={documentRoot} --allow-root
    │
    ├── Fix file ownership:
    │       chown -R {systemUser}:www-data {documentRoot}
    │       find {documentRoot} -type d -exec chmod 755 {} \;
    │       find {documentRoot} -type f -exec chmod 644 {} \;
    │
    ├── Save installation record to DB
    ├── Write audit log: app.install { app: 'wordpress', domain, path }
    └── Emit completion event with admin URL
```

---

## 20. Notifications & Alerts

### Feature List
```
In-panel notification bell with unread count
Notification types:
    - SSL certificate expiring (30d / 7d / 1d warnings)
    - SSL renewal success / failure
    - Backup complete / failed
    - Service down alert
    - Disk usage > 80% / 90% / 95%
    - CPU sustained high usage
    - RAM critically low
    - Cron job failure
    - Failed login attempts spike
    - Cloudflare tunnel disconnected
    - Panel update available
Email notification delivery (configurable SMTP)
Mark notification as read / mark all as read
Delete notification
Notification history (last 90 days)
Notification settings (toggle each type on/off)
Test notification button (send test email)
```

---

### NOTIFICATIONS — User Flow
```
Admin sees bell icon in topbar
    │
    ├── Red badge shows unread count
    ├── Click bell → dropdown notification list (last 10)
    │       Each: icon + message + time ago + [Mark read ×]
    └── [View All] → full notifications page with filter + history

Admin → Settings → Notifications:
    ├── SMTP configuration:
    │       Host, Port, Username, Password, From address, Encryption (TLS/SSL)
    │       [Test Email] button
    │
    └── Toggle per notification type (ON/OFF):
            SSL expiry warnings | Backup alerts | Service down
            Disk usage (+ threshold %) | CPU usage (+ threshold % + duration)
            Failed logins (+ threshold count) | Tunnel disconnect
```

### NOTIFICATIONS — Function Flow
```
Create notification (called from any module)
    │
    ├── Input: { type, severity: 'info'|'warning'|'critical', title, message }
    ├── Save to notifications table in DB
    ├── Increment unread count in memory cache
    ├── Push via WebSocket to admin if connected:
    │       → frontend updates bell badge + shows toast for critical
    │
    └── If email enabled for this notification type:
            → queue email job in BullMQ
            → worker sends via configured SMTP

SSL expiry check job (daily at 6:00 AM)
    │
    ├── Query all active SSL certs from DB
    ├── For each cert where expiresAt < now + 30 days:
    │       ├── daysLeft <= 1  → create critical notification
    │       ├── daysLeft <= 7  → create warning (if not already sent today)
    │       └── daysLeft <= 30 → create info (if not already sent this week)
    └── Deduplicate: skip if same notification already exists unread
```

---

## 21. API Token Management

### Feature List
```
Generate API token (shown once only)
Name API token (descriptive label)
Set token expiry: never / 30d / 90d / 1 year / custom date
Set token permissions (scope):
    - Read only (GET requests only)
    - Full access
    - Module-specific scope (e.g., SSL only, DNS only)
List all API tokens
View token metadata (created, last used, IP of last use)
Revoke token
Revoke all tokens
Token usage log (last 100 API calls per token)
```

---

### API TOKEN — User Flow
```
Admin → Settings → API Tokens
    │
    ├── Token list table:
    │       Name | Created | Expires | Last Used | Scope | Actions
    │
    ├── [Generate Token] button → modal:
    │       ├── Token name input
    │       ├── Expiry: [Never] [30 days] [90 days] [1 year] [Custom date]
    │       ├── Scope: [Full access] [Read only] [Custom → checkbox list per module]
    │       └── [Generate] button
    │
    ├── Token created modal:
    │       "Copy this token now. It will never be shown again."
    │       Token display: sf_AbCdEfGh1234... [Copy button]
    │       [Done] button
    │
    └── Per-token actions: [View Usage] | [Revoke]
```

### API TOKEN — Function Flow
```
Admin generates API token
    │
    ├── Generate token: "sf_" + crypto.randomBytes(32).toString('hex')
    ├── Hash token: SHA-256
    ├── Store in DB: { name, tokenHash, scope, expiresAt, createdAt }
    ├── Write audit log: apitoken.create { name, scope }
    └── Return PLAINTEXT token to frontend (only time it's shown)

API request authentication
    │
    ├── Extract Bearer token from Authorization header
    ├── Hash incoming token: SHA-256
    ├── Look up tokenHash in DB
    │       └── Not found → 401 Unauthorized
    ├── Check expiry → Expired → 401 Unauthorized
    ├── Check scope against requested action
    │       └── Insufficient scope → 403 Forbidden
    ├── Update token: { lastUsedAt, lastUsedIp }
    └── Attach token info to request context, continue
```

---

## 22. Server Settings

### Feature List
```
Panel URL / hostname configuration
Panel port (default 8443)
Panel admin email
Default PHP version (used when creating new domains)
Default web server mode (nginx / apache / nginx+apache)
Default SSL contact email (for Let's Encrypt)
SMTP settings for panel email delivery
Nameservers configuration (primary NS, secondary NS)
Server IP address settings (used in DNS auto-generation)
Panel timezone
Session timeout duration (idle logout in minutes)
Password policy: min length, require uppercase/numbers/symbols
Panel update check + one-click update
Maintenance mode toggle
Data retention settings (audit log days, stats history days)
Panel backup (export all panel settings as JSON)
Panel restore from JSON
System packages update trigger (apt-get upgrade)
Reboot server button (with confirm)
Shutdown server button (with confirm)
```

---

### SERVER SETTINGS — User Flow
```
Admin → Settings page
    │
    ├── Sub-tabs: [General] [Security] [Mail/SMTP] [DNS] [Notifications] [Updates] [Danger Zone]
    │
    ├── GENERAL tab:
    │       Panel hostname, Panel port, Admin email
    │       Default PHP version, Default web server mode
    │       Server primary IP (auto-detected, overridable)
    │       Timezone selector, Language selector
    │
    ├── SECURITY tab:
    │       Session idle timeout (minutes)
    │       Password minimum length, uppercase/numbers/symbols toggles
    │       Max login attempts, Lockout duration
    │
    ├── MAIL/SMTP tab:
    │       SMTP Host, Port, Username, Password
    │       Encryption: [None] [TLS] [SSL]
    │       From name, From email
    │       [Test Email] button
    │
    ├── DNS tab:
    │       Primary nameserver hostname (ns1.yourdomain.com)
    │       Secondary nameserver hostname (ns2.yourdomain.com)
    │       Default DNS TTL, Default SOA settings template
    │
    ├── UPDATES tab:
    │       Current version | [Check for Updates] | [Update ServerForge]
    │       Auto-check toggle
    │       [Update System Packages] → runs apt-get upgrade
    │
    └── DANGER ZONE tab:
            [Reboot Server] → confirm → systemctl reboot
            [Shutdown Server] → confirm → systemctl poweroff
            [Export Panel Config] → download settings JSON
            [Import Panel Config] → upload JSON → restore
            [Reset Panel to Defaults] → confirm by typing "RESET"
```

---

## 23. Audit Log

### Feature List
```
Complete log of all admin actions with timestamp
Action categories:
    auth | domain | webserver | php | ssl | dns | mail
    database | ftp | files | cron | backup | firewall
    tunnel | terminal | settings | apitoken
IP address of action
User-agent of action
Action details (what changed)
Search by keyword
Filter by category / date range
Export audit log as CSV
Retention policy (default 90 days, auto-purge old entries)
```

---

### AUDIT LOG — User Flow
```
Admin → Audit Log page
    │
    ├── Filter bar:
    │       Date range picker | Category dropdown | Search input | [Export CSV] button
    │
    └── Log table:
            Timestamp | Category | Action | Details | IP Address | User-Agent
            ├── Color-coded by category
            ├── Expandable row → full details JSON
            └── Pagination (50 per page)
```

### AUDIT LOG — Function Flow
```
Write audit log (called from every module on mutating action)
    │
    ├── Input: { action, category, details: object, ip, userAgent }
    ├── Serialize details to JSON
    ├── Insert to audit_logs table: { id, action, category, details, ip, userAgent, createdAt }
    └── Return (non-blocking, fire-and-forget)

Retention cleanup job (daily)
    │
    ├── Query DB: audit logs WHERE createdAt < now - retentionDays
    ├── Delete in batches (1000 rows per batch to avoid lock)
    └── Log cleanup count to panel logs

Admin exports audit log
    │
    ├── Apply filters (category, dateRange, search)
    ├── Query matching audit_logs from DB
    ├── Format as CSV:
    │       Headers: Timestamp, Category, Action, Details, IP, UserAgent
    │       Rows: each log entry, details JSON stringified
    ├── Stream CSV response to browser
    └── Browser triggers file download
```

---

## 24. Master Function Index

### Complete Function Reference
```
AUTH
  login(username, password, rememberMe)
  logout(sessionId)
  verify2FA(tempToken, totpCode)
  verify2FABackupCode(tempToken, backupCode)
  setup2FAInit()
  setup2FAConfirm(password, totpCode) → backupCodes[]
  disable2FA(password, totpCode)
  getSessions()
  revokeSession(sessionId)
  revokeAllOtherSessions()
  changePassword(currentPassword, newPassword)
  changeEmail(currentPassword, newEmail)
  requestPasswordReset(email)
  resetPassword(token, newPassword)

DASHBOARD
  getServerStats()
  getServicesStatus()
  getNetworkStats()
  getDiskStats()
  getEntityCounts()
  getExpiringSslCerts()
  getRecentAuditLogs(limit)
  controlService(serviceName, action: start|stop|restart|reload)

DOMAINS
  listDomains(search, sort, order)
  getDomain(domainId)
  createDomain(name, documentRoot, phpVersion, webServer, createDns, createMail)
  deleteDomain(domainId)
  suspendDomain(domainId)
  activateDomain(domainId)
  renameDomain(domainId, newName)
  cloneDomain(domainId, newName)
  listSubdomains(domainId)
  createSubdomain(domainId, prefix, documentRoot, phpVersion)
  deleteSubdomain(subdomainId)
  listAliases(domainId)
  createAlias(domainId, alias)
  deleteAlias(aliasId)
  listRedirects(domainId)
  createRedirect(domainId, sourcePath, targetUrl, type)
  deleteRedirect(redirectId)
  getDomainStats(domainId)

WEBSERVER
  getWebServerConfig(domainId)
  saveWebServerConfig(domainId, config)
  previewWebServerConfig(domainId, config)
  testWebServerConfig(domainId, config)
  reloadWebServer(webServer)
  restartWebServer(webServer)

PHP
  getInstalledPhpVersions()
  getPhpConfig(domainId)
  savePhpConfig(domainId, config)
  getPhpIniValues(domainId)
  savePhpIniValues(domainId, values)
  restartPhpFpmPool(domainId)
  getPhpFpmPoolStatus(domainId)
  getPhpInfo(domainId)

SSL
  getSslCertificate(domainId)
  issueLetsEncrypt(domainId, domains[], contactEmail)
  issueWildcardLetsEncrypt(domainId, cfApiToken)
  uploadCustomCertificate(domainId, cert, key, chain)
  generateSelfSignedCertificate(domainId)
  renewCertificate(domainId)
  revokeCertificate(domainId)
  toggleHttpsRedirect(domainId, enabled)
  toggleHsts(domainId, enabled, preload)
  getCertificateDetails(domainId)
  listExpiringSslCerts(daysThreshold)
  downloadCertificateFiles(domainId)

DNS
  getDnsZone(domainId)
  listDnsRecords(domainId)
  createDnsRecord(domainId, type, name, value, ttl, priority)
  updateDnsRecord(recordId, name, value, ttl, priority)
  deleteDnsRecord(recordId)
  importDnsZone(domainId, zoneFileText)
  exportDnsZone(domainId)
  resetDnsToDefaults(domainId)
  getRawZoneFile(domainId)
  checkDnsPropagation(domainId)
  saveSoaRecord(domainId, soaConfig)

MAIL
  getMailDomain(domainId)
  enableMailDomain(domainId)
  disableMailDomain(domainId)
  listMailboxes(domainId)
  createMailbox(domainId, username, password, quotaMb)
  updateMailbox(mailboxId, quotaMb)
  changeMailboxPassword(mailboxId, newPassword)
  deleteMailbox(mailboxId)
  suspendMailbox(mailboxId)
  activateMailbox(mailboxId)
  toggleAutoresponder(mailboxId, enabled, subject, message)
  listMailAliases(domainId)
  createMailAlias(domainId, alias, destination, keepCopy)
  deleteMailAlias(aliasId)
  setCatchAll(domainId, enabled, destination)
  generateDkimKey(domainId)
  rotateDkimKey(domainId)
  getDkimStatus(domainId)
  applyRecommendedSpf(domainId)
  applyDmarc(domainId, policy, reportEmail)
  getMailQueue()
  flushMailQueue()
  deleteMailQueueMessage(messageId)
  getMailLogs(domainId, dateRange)

DATABASES
  listDatabases()
  getDatabase(dbId)
  createDatabase(name, engine, charset, createUser, userPassword)
  deleteDatabase(dbId)
  listDatabaseUsers(dbId)
  createDatabaseUser(dbId, username, password, privileges)
  changeDatabaseUserPassword(userId, newPassword)
  deleteDatabaseUser(userId)
  getDatabaseSize(dbId)
  exportDatabase(dbId)
  importDatabase(dbId, sqlFile)
  cloneDatabase(dbId, newName)
  repairDatabase(dbId)
  optimizeDatabase(dbId)
  generatePhpMyAdminSsoUrl(dbId)
  executeQuery(dbId, sql)

FTP
  listFtpAccounts(domainId)
  createFtpAccount(domainId, username, password, homeDir, readonly)
  changeFtpPassword(ftpId, newPassword)
  changeFtpDirectory(ftpId, newDir)
  toggleFtpReadonly(ftpId, readonly)
  suspendFtpAccount(ftpId)
  activateFtpAccount(ftpId)
  deleteFtpAccount(ftpId)
  getFtpConnectionInfo(ftpId)

FILES
  listDirectory(domainId, path)
  readFile(domainId, path)
  writeFile(domainId, path, content)
  uploadFile(domainId, targetPath, fileStream)
  downloadFile(domainId, path)
  downloadDirectoryAsZip(domainId, path)
  createDirectory(domainId, path)
  deleteFile(domainId, path)
  deleteDirectory(domainId, path, recursive)
  renameItem(domainId, oldPath, newPath)
  moveItem(domainId, sourcePath, destinationPath)
  copyItem(domainId, sourcePath, destinationPath)
  changePermissions(domainId, path, mode, recursive)
  getDirectorySize(domainId, path)
  searchFiles(domainId, query, path)
  extractArchive(domainId, archivePath, destinationPath)
  createArchive(domainId, paths[], outputPath, format)

CRON
  listCronJobs()
  getCronJob(jobId)
  createCronJob(schedule, command, runAsUser, emailOnFailure)
  updateCronJob(jobId, schedule, command, emailOnFailure)
  deleteCronJob(jobId)
  enableCronJob(jobId)
  disableCronJob(jobId)
  runCronJobNow(jobId)
  getCronJobHistory(jobId, limit)

BACKUP
  listBackups(domainId)
  getBackup(backupId)
  createBackup(scope, domainId, encrypt, password)
  deleteBackup(backupId)
  downloadBackup(backupId)
  restoreBackup(backupId, scope)
  getBackupSchedule()
  saveBackupSchedule(schedule)
  getStorageSettings()
  saveStorageSettings(config)
  testStorageConnection(config)

FIREWALL
  getFirewallStatus()
  listFirewallRules()
  addFirewallRule(action, port, protocol, sourceIp, comment)
  deleteFirewallRule(ruleId)
  enableFirewall()
  disableFirewall()
  addPresetRule(preset)
  resetFirewallToDefaults()
  listFail2BanJails()
  getBannedIps(jail)
  unbanIp(jail, ip)
  banIp(jail, ip)
  getFail2BanSettings(jail)
  saveFail2BanSettings(jail, settings)
  getSshSettings()
  saveSshSettings(config)

TUNNEL
  getTunnel()
  validateCloudflareToken(apiToken)
  listCloudflareZones(apiToken, accountId)
  createTunnel(name, apiToken, accountId, zoneId)
  deleteTunnel(tunnelId)
  getTunnelStatus()
  startTunnel()
  stopTunnel()
  restartTunnel()
  listTunnelRoutes()
  addTunnelRoute(hostname, service, autoCreateDns)
  updateTunnelRoute(routeId, hostname, service)
  deleteTunnelRoute(routeId)
  toggleTunnelRoute(routeId, enabled)
  getTunnelConfig()
  getTunnelLogs(lines)

TERMINAL (WebSocket only)
  openTerminalSession()
  writeToTerminal(data)
  resizeTerminal(cols, rows)
  closeTerminalSession()

LOGS
  getLogFile(domainId, type, lines)
  tailLogFile(domainId, type)         ← WebSocket
  downloadLogFile(domainId, type)
  clearLogFile(domainId, type)
  getLogRotationSettings(domainId)
  saveLogRotationSettings(domainId, config)

STATS
  getServerStats(timeRange)
  getTopProcesses()
  getPerDomainUsage()
  getNetworkHistory(timeRange)
  getInstalledVersions()
  getAlertThresholds()
  saveAlertThresholds(config)

APP INSTALLER
  listAvailableApps()
  listInstalledApps()
  installApp(appName, domainId, subdirectory, config)
  uninstallApp(installationId, keepDatabase)
  getInstallationStatus(installationId)
  updateApp(installationId)
  runWpCli(installationId, command)

NOTIFICATIONS
  listNotifications(filter)
  markRead(notificationId)
  markAllRead()
  deleteNotification(notificationId)
  getNotificationSettings()
  saveNotificationSettings(config)
  sendTestEmail()

API TOKENS
  listApiTokens()
  createApiToken(name, scope, expiresAt)
  revokeApiToken(tokenId)
  revokeAllApiTokens()
  getTokenUsageLog(tokenId)

SETTINGS
  getGeneralSettings()
  saveGeneralSettings(config)
  getSecuritySettings()
  saveSecuritySettings(config)
  getSmtpSettings()
  saveSmtpSettings(config)
  getDnsSettings()
  saveDnsSettings(config)
  checkForPanelUpdate()
  updatePanel()
  exportPanelConfig()
  importPanelConfig(configJson)
  rebootServer()
  shutdownServer()

AUDIT
  listAuditLogs(filter)
  exportAuditLogCsv(filter)
  writeAuditLog(action, category, details, ip, userAgent)
  runRetentionCleanup()
```

---

*End of ServerForge Complete Feature & Function Specification*
*23 modules | 200+ distinct functions | Every user flow mapped | Every backend action described*
