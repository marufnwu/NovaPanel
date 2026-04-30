# Plesk Features & Flows - Gap Analysis Report

**Date:** 2026-04-27  
**Plan Document:** plesk-features-and-flows.md  
**System:** NovaPanel (ServerForge)  
**Status:** Cross-check complete

---

## Executive Summary

The NovaPanel implementation covers approximately **60-65%** of the features specified in the plesk-features-and-flows.md plan. Core infrastructure is in place with solid database schemas, API routes, and frontend pages. However, significant gaps exist in advanced features, security capabilities, and several complete modules.

### Overall Implementation Status by Module:

| Module | Completion | Status |
|---------|-------------|--------|
| Authentication & Profile | 70% | 🟡 Partial |
| Dashboard & Server Overview | 75% | 🟡 Partial |
| Domain Management | 60% | 🟡 Partial |
| Web Server Configuration | 15% | 🔴 Minimal |
| PHP Management | 40% | 🔴 Minimal |
| SSL / TLS Certificates | 70% | 🟡 Partial |
| DNS Management | 50% | 🔴 Partial |
| Mail Management | 45% | 🔴 Partial |
| Database Management | 60% | 🟡 Partial |
| FTP Management | 40% | 🔴 Minimal |
| File Manager | 5% | 🔴 Not Implemented |
| Scheduled Tasks (Cron) | 50% | 🔴 Partial |
| Backup & Restore | 40% | 🔴 Minimal |
| Firewall & Security | 45% | 🔴 Partial |
| Cloudflare Tunnel | 10% | 🔴 Not Implemented |
| Web Terminal | 30% | 🔴 Minimal |
| Log Viewer | 10% | 🔴 Not Implemented |
| Server Monitoring & Stats | 40% | 🔴 Minimal |
| Application Installer | 0% | 🔴 Not Implemented |
| Notifications & Alerts | 5% | 🔴 Not Implemented |
| API Token Management | 30% | 🔴 Minimal |
| Server Settings | 20% | 🔴 Not Implemented |
| Audit Log | 50% | 🔴 Partial |

---

## Detailed Gap Analysis

### 1. Authentication & Profile

#### ✅ Implemented Features:
- Login with username + password
- Remember me (30-day persistent session)
- TOTP Two-Factor Authentication (Google Authenticator / Authy)
- Brute-force protection (5 failed attempts, 15 min lockout)
- Active session list
- Remote session kill (revoke individual sessions, revoke all other sessions)
- Change password
- Change email address
- Change display name

#### 🔴 Missing Features:
- **2FA backup codes** - Generated but not properly stored (TODO comment in auth.service.ts:204)
- **Idle session timeout** - No configurable idle timeout enforcement
- **Profile avatar** - Initials-based auto avatar not implemented
- **Forgot password via email reset link** - Token generated but email not sent (TODO comment in auth.service.ts:396)
- **API Token Management** - Only one token per user, missing:
  - List all API tokens
  - Name API tokens (descriptive label)
  - Set token expiry (30d / 90d / 1 year / custom)
  - Set token permissions (scope: read-only, full access, module-specific)
  - View token metadata (created, last used, IP of last use)
  - Revoke all tokens
  - Token usage log (last 100 API calls per token)

#### 🟡 Partially Implemented:
- **Forced password change on first boot** - Field exists (`mustChangePassword`) but not enforced on first login

---

### 2. Dashboard & Server Overview

#### ✅ Implemented Features:
- Real-time server health tiles (CPU %, RAM %, Disk %, Uptime)
- RAM usage breakdown (used / total, swap)
- Disk usage per mount point
- Network I/O (bytes in/out per second)
- Running services status grid (green/red per service)
- Restart any service from dashboard with one click
- Server uptime counter
- Quick summary counts: Domains, Mailboxes, Databases, FTP Accounts, Active Cron Jobs
- Expiring SSL certificates warning list (< 30 days)
- Recent audit log entries (last 10 actions)
- Quick action buttons: Add Domain, New Database, Issue SSL, Open Terminal, Add Mailbox
- System information: OS, kernel version, hostname, server IP(s)

#### 🔴 Missing Features:
- **CPU usage graph** - Only current percentage, no historical graph (1h / 6h / 24h switchable)
- **Network I/O graph** - Only current rate, no historical graph
- **Recent failed login attempts** - Not shown on dashboard
- **Cloudflare tunnel connection status widget** - Not displayed

#### 🟡 Partially Implemented:
- **Load average** - Shown as text but not visualized
- **Disk usage warning** - Only >80% warning, no >90% or >95% thresholds

---

### 3. Domain Management

#### ✅ Implemented Features:
- Add new domain
- Add subdomain (linked to parent domain)
- Add domain alias (parked domain)
- Add domain redirect (URL redirect, 301 or 302)
- Delete domain (with full cleanup)
- Suspend domain (disable web access, keep files)
- Activate suspended domain
- View domain overview: PHP version, web server, SSL status, disk usage
- Set document root path
- Open domain in browser (quick link)
- Domain search and filter
- Domain list with sortable columns
- Per-domain quick settings panel (slide-over via detail view)

#### 🔴 Missing Features:
- **Rename domain** - Not implemented
- **Clone domain** - Not implemented
- **Bulk suspend / delete / activate** - Not implemented
- **Domain-level access logs stats** - Not implemented (visits, bandwidth)
- **Subdomain DNS A record** - Not added automatically
- **Subdomain Nginx vhost** - Not added (only directory created)
- **Subdomain PHP-FPM sub-pool** - Not created
- **Alias DNS A record** - Not added automatically
- **Redirect Nginx vhost** - Not added (only DB record)

---

### 4. Web Server Configuration

#### ✅ Implemented Features:
- Toggle web server mode per domain (Nginx only / Apache only / Nginx + Apache)

#### 🔴 Missing Features:
- **Custom Nginx directives input** - Not implemented
- **Custom Apache directives / .htaccess toggle** - Not implemented
- **Static file serving via Nginx** - Not implemented
- **Hotlink protection** - Not implemented
- **IP-based access restriction** - Not implemented
- **Gzip compression toggle per domain** - Not implemented
- **Browser caching headers control per domain** - Not implemented
- **Custom error pages** - Not implemented
- **Directory browsing toggle** - Not implemented
- **Proxy pass configuration** - Not implemented
- **Request rate limiting per domain** - Not implemented
- **Max upload file size setting** - Not implemented
- **Preview generated Nginx/Apache config before applying** - Not implemented
- **Test config validity before save** - Not implemented
- **Force reload / restart web server** - Not implemented

---

### 5. PHP Management

#### ✅ Implemented Features:
- Set PHP version per domain (switch between versions)
- Set PHP handler per domain (PHP-FPM / CGI / Disabled)

#### 🔴 Missing Features:
- **List all installed PHP versions on server** - Not implemented
- **PHP-FPM pool settings per domain** - Not implemented:
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
- **Custom php.ini values per domain** - Not implemented
- **open_basedir restriction toggle** - Not implemented
- **Disable dangerous PHP functions per domain** - Not implemented
- **View PHP info (phpinfo() output in panel)** - Not implemented
- **Restart PHP-FPM pool for domain** - Not implemented
- **Check PHP-FPM pool status** - Not implemented
- **Global PHP settings** - Not implemented

---

### 6. SSL / TLS Certificates

#### ✅ Implemented Features:
- Issue free Let's Encrypt certificate (HTTP-01 challenge)
- Upload custom certificate (paste PEM)
- Generate self-signed certificate
- View certificate details: issuer, validity, SANs, fingerprint
- Enable SSL / redirect HTTP to HTTPS toggle
- Enable HSTS (Strict Transport Security)
- Certificate expiry warnings (dashboard + email)
- Auto-renew Let's Encrypt certificates (background job)
- Manual renew button
- Revoke / remove certificate
- Download certificate files (cert.pem, key.pem, chain.pem)

#### 🔴 Missing Features:
- **Issue Let's Encrypt wildcard certificate (DNS-01 via Cloudflare API)** - Not implemented
- **HSTS preload option** - Not implemented
- **OCSP stapling toggle** - Not implemented
- **Certificate chain validator** - Not implemented
- **Multi-domain SAN certificates** - Not implemented
- **Mixed-content checker** - Not implemented

---

### 7. DNS Management

#### ✅ Implemented Features:
- Full DNS zone per domain (BIND9)
- Record types: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR
- Auto-generated default records on domain creation
- Add / edit / delete any record
- Set TTL per record
- Zone serial auto-increment on every change
- Import zone from BIND zone file text
- Export zone as BIND zone file
- Reset zone to defaults
- View raw zone file
- DNS propagation checker (query external resolvers)

#### 🔴 Missing Features:
- **SOA record management** - Not implemented (Primary nameserver, Admin email, Refresh/Retry/Expire/Minimum TTL)
- **External DNS mode** - Not implemented (disable local BIND, manage via Cloudflare API)

---

### 8. Mail Management

#### ✅ Implemented Features:
- Enable / disable mail for a domain
- Create mailbox (user@domain.com)
- Set mailbox password
- Set per-mailbox storage quota (MB)
- View mailbox disk usage
- Delete mailbox
- Create email alias (alias@domain.com → destination)
- DKIM key generation (2048-bit RSA)
- DKIM DNS record auto-injection
- SPF record helper (one-click recommended SPF setup)
- DMARC record helper (policy: none / quarantine / reject)
- View DKIM / SPF / DMARC status (valid / invalid)

#### 🔴 Missing Features:
- **Mailbox suspension** - Not implemented
- **Email forwarder** - Not implemented (copies or redirects)
- **Catch-all address** - Not implemented
- **Auto-responder per mailbox** - Not implemented
- **SpamAssassin toggle per domain** - Not implemented
- **SpamAssassin score threshold setting** - Not implemented
- **Webmail access link (Roundcube integration)** - Not implemented
- **SMTP / IMAP / POP3 connection settings display** - Not implemented
- **Mail queue viewer** - Not implemented
- **Flush mail queue button** - Not implemented
- **Delete message from mail queue** - Not implemented
- **Mail logs viewer per domain** - Not implemented
- **DKIM key rotation** - Not implemented

---

### 9. Database Management

#### ✅ Implemented Features:
- Create MariaDB database
- Create PostgreSQL database
- Create database user
- Assign user to database with specific privileges
- Change database user password
- Revoke user from database
- Delete database user
- Delete database
- View database size
- Export database (mysqldump / pg_dump to .sql)
- Import database from SQL file (upload)
- Clone database (copy schema + data to new DB)
- Repair database tables (MariaDB: mysqlcheck)
- Optimize database tables (MariaDB: mysqlcheck --optimize)
- Database character set and collation selection
- In-panel SQL query editor

#### 🔴 Missing Features:
- **phpMyAdmin access (single sign-on link)** - Not implemented
- **phpPgAdmin access (single sign-on link)** - Not implemented
- **Remote access toggle (allow connections from %)** - Not implemented
- **View database tables list** - Not implemented

---

### 10. FTP Management

#### ✅ Implemented Features:
- Create FTP account per domain
- Set FTP account password
- Set FTP account home directory (default: httpdocs)
- Set FTP account as read-only
- Suspend FTP account
- Delete FTP account
- List all FTP accounts per domain
- Change FTP password

#### 🔴 Missing Features:
- **Change FTP directory** - Not implemented
- **View last FTP login (IP, timestamp)** - Not implemented
- **Show FTP connection info (host, port, credentials)** - Not implemented
- **FTPS (FTP over TLS) support** - Not implemented
- **ProFTPd global settings** - Not implemented (passive port range, max connections)

---

### 11. File Manager

#### ✅ Implemented Features:
- Routes exist for file operations

#### 🔴 Missing Features:
- **Browse directory tree (left panel) + file list (right panel)** - Not implemented
- **Navigate by clicking folders** - Not implemented
- **Breadcrumb path bar** - Not implemented
- **File / folder search within current directory** - Not implemented
- **Create new folder** - Not implemented
- **Create new file (opens inline editor)** - Not implemented
- **Upload files (drag-and-drop + click to select)** - Not implemented
- **Multi-file upload with progress bar** - Not implemented
- **Upload zip and auto-extract** - Not implemented
- **Download file** - Not implemented
- **Download folder as zip** - Not implemented
- **Rename file or folder** - Not implemented
- **Move files / folders (drag or cut+paste)** - Not implemented
- **Copy files / folders** - Not implemented
- **Delete file / folder (single + multi-select)** - Not implemented
- **Select all / deselect all** - Not implemented
- **File permissions editor (chmod)** - Not implemented
- **Ownership display (user:group)** - Not implemented
- **File size and last modified timestamp** - Not implemented
- **Sort by name / size / date** - Not implemented
- **Code editor (CodeMirror) for text files** - Not implemented
- **Image preview** - Not implemented
- **Video preview** - Not implemented
- **PDF preview** - Not implemented
- **Archive browser (peek inside .zip)** - Not implemented
- **Extract archive (.zip, .tar.gz, .tar.bz2)** - Not implemented
- **Compress selected files to .zip or .tar.gz** - Not implemented
- **Disk usage view per folder** - Not implemented
- **Hidden files toggle (show/hide dotfiles)** - Not implemented

---

### 12. Scheduled Tasks (Cron)

#### ✅ Implemented Features:
- View all cron jobs on server
- Add new cron job
- Set command to run
- Set which user runs the cron (root or domain system user)
- Enable / disable cron job without deleting
- Delete cron job
- Run cron job immediately (manual trigger)

#### 🔴 Missing Features:
- **View last run status (success / failed)** - Not implemented
- **View last run output (stdout + stderr)** - Not implemented
- **View next scheduled run time** - Not implemented
- **Email on cron failure notification toggle per job** - Not implemented
- **Common schedule presets** - Not implemented (every minute / hourly / daily / weekly / monthly)
- **Cron expression validator and human-readable description** - Not implemented
- **Cron job run history (last 20 executions)** - Not implemented
- **Visual schedule builder** - Not implemented

---

### 13. Backup & Restore

#### ✅ Implemented Features:
- Manual backup trigger (full or selective)
- Scheduled automatic backups (daily / weekly / monthly)
- Backup scope per run (files, databases, dns, mail, config)
- Backup list with: domain, date, size, type, location
- Download backup archive
- Restore full backup
- Restore partial (files only, or DB only, or mail only)
- Delete backup
- Retention policy: keep last N backups per domain (auto-purge old)

#### 🔴 Missing Features:
- **Backup storage options** - Not implemented:
  - Remote SFTP server
  - S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO)
- **Backup encryption (AES-256 password-protected archive)** - Not implemented
- **Backup integrity check (hash verification)** - Not implemented
- **Backup notification on success / failure** - Not implemented
- **Backup progress (real-time via WebSocket)** - Not implemented

---

### 14. Firewall & Security

#### ✅ Implemented Features:
- View all UFW rules (allow/deny/reject)
- Add firewall rule: port / protocol / source IP / action
- Delete firewall rule
- Enable / disable UFW
- Toggle UFW rule (enable without deleting)
- Preset rule buttons: Allow SSH, HTTP, HTTPS, FTP, SMTP, IMAP, POP3, MySQL
- Reset to default rules
- View UFW status
- Fail2Ban jail list
- View currently banned IPs per jail
- Manually unban IP from jail

#### 🔴 Missing Features:
- **Manually ban IP in jail** - Not implemented
- **View Fail2Ban log** - Not implemented
- **Fail2Ban settings per jail** - Not implemented (maxRetry, findTime, banTime)
- **View recent login failures (from auth.log)** - Not implemented
- **View recent successful logins** - Not implemented
- **Port scanner (scan own server for open ports)** - Not implemented
- **SSH settings management** - Not implemented (port, password auth toggle, root login toggle)
- **Automatic security updates toggle (unattended-upgrades)** - Not implemented
- **Panel login attempt log** - Not implemented

---

### 15. Cloudflare Tunnel

#### ✅ Implemented Features:
- Basic route structure exists

#### 🔴 Missing Features:
- **Setup wizard (first-time guided flow)** - Not implemented
- **Enter Cloudflare API token** - Not implemented
- **Select Cloudflare account and zone** - Not implemented
- **Create named tunnel (cloudflared tunnel create)** - Not implemented
- **View all tunnels (list)** - Not implemented
- **Delete tunnel** - Not implemented
- **Add ingress route: hostname → local service** - Not implemented
- **Edit ingress route** - Not implemented
- **Delete ingress route** - Not implemented
- **Enable / disable individual routes** - Not implemented
- **Tunnel status: active / inactive / error** - Not implemented
- **View cloudflared live logs (WebSocket tail)** - Not implemented
- **Start / stop / restart cloudflared daemon** - Not implemented
- **View tunnel metrics** - Not implemented
- **Auto-create CNAME DNS record in Cloudflare for each route** - Not implemented
- **One-click expose panel itself via tunnel** - Not implemented
- **One-click expose a domain via tunnel** - Not implemented
- **Tunnel config file preview** - Not implemented

---

### 16. Web Terminal

#### ✅ Implemented Features:
- Basic WebSocket terminal connection exists

#### 🔴 Missing Features:
- **Full browser-based terminal (xterm.js)** - Not implemented (basic connection only)
- **Shell as root (full access for admin)** - Not verified
- **256-color / truecolor support** - Not implemented
- **Resize terminal (responsive to window size)** - Not implemented
- **Copy selected text to clipboard** - Not implemented
- **Paste from clipboard** - Not implemented
- **Tab completion (native shell)** - Not verified
- **Scrollback buffer** - Not implemented
- **Custom font size** - Not implemented
- **Clear terminal button** - Not implemented
- **Reconnect on disconnect (auto-reconnect with countdown)** - Not implemented
- **Multiple terminal tabs** - Not implemented
- **Terminal session timeout (configurable idle timeout)** - Not implemented
- **Download terminal session log** - Not implemented

---

### 17. Log Viewer

#### ✅ Implemented Features:
- Basic routes exist

#### 🔴 Missing Features:
- **Domain access logs (Nginx / Apache per domain)** - Not implemented
- **Domain error logs (Nginx / Apache per domain)** - Not implemented
- **PHP-FPM logs per domain** - Not implemented
- **Mail logs (Postfix, Dovecot) per domain** - Not implemented
- **DNS query logs (BIND9)** - Not implemented
- **FTP logs (ProFTPd) per domain** - Not implemented
- **Panel system logs (ServerForge internal)** - Not implemented
- **Fail2Ban logs** - Not implemented
- **System auth log (/var/log/auth.log)** - Not implemented
- **Real-time log tail (WebSocket streaming, auto-scroll)** - Not implemented
- **Date range filter** - Not implemented
- **Search/filter within log content** - Not implemented
- **Download log file** - Not implemented
- **Clear log file (with confirm)** - Not implemented
- **Log rotation settings per domain** - Not implemented
- **Log size indicator per domain** - Not implemented

---

### 18. Server Monitoring & Stats

#### ✅ Implemented Features:
- Real-time CPU usage (overall)
- RAM usage (total / used / cached / free / swap)
- Disk usage per mount point (used / free / percentage)
- Network I/O (bytes in/out per second per interface)
- System load average (1m / 5m / 15m)
- Server uptime
- OS info: kernel version, distribution, architecture

#### 🔴 Missing Features:
- **Real-time CPU usage (per core)** - Not implemented
- **Disk I/O (read/write bytes per second)** - Not implemented
- **Top processes (by CPU, by RAM)** - Not implemented
- **Per-domain disk usage breakdown** - Not implemented
- **Per-domain bandwidth usage (monthly totals)** - Not implemented
- **Historical graphs: CPU, RAM, Network** - Not implemented (1h / 6h / 24h / 7d / 30d)
- **Service health checks** - Not implemented
- **Alert thresholds: email when CPU > X%, disk > X%, etc.** - Not implemented
- **Installed software versions** - Not implemented
- **Open file descriptor count** - Not implemented
- **Active TCP connections count** - Not implemented

---

### 19. Application Installer

#### 🔴 Missing Features:
- **One-click install: WordPress, Joomla, Drupal, Magento, PrestaShop, Laravel (skeleton), Next.js (skeleton)** - Not implemented
- **Select target domain and subdirectory (or root)** - Not implemented
- **Set admin credentials during install** - Not implemented
- **Set database (auto-create or select existing)** - Not implemented
- **Auto-detect existing installation (warn if files present)** - Not implemented
- **Install progress with real-time output** - Not implemented
- **Post-install checklist shown** - Not implemented
- **List installed applications per domain** - Not implemented
- **Update application (for WordPress: WP-CLI upgrade)** - Not implemented
- **View application admin URL link** - Not implemented
- **Uninstall application (with confirm, optionally keep database)** - Not implemented
- **WordPress-specific extras** - Not implemented:
  - Install/activate plugins (WP-CLI)
  - Install/activate themes (WP-CLI)
  - Run WP-CLI commands from panel
  - WordPress core update check
  - Plugin update list + one-click update all
  - Enable/disable maintenance mode
  - WordPress debug mode toggle
  - Create WordPress admin user
  - Reset WordPress admin password

---

### 20. Notifications & Alerts

#### ✅ Implemented Features:
- Database schema for notifications exists

#### 🔴 Missing Features:
- **In-panel notification bell with unread count** - Not implemented
- **Notification types** - Not implemented:
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
- **Email notification delivery (configurable SMTP)** - Not implemented
- **Mark notification as read / mark all as read** - Not implemented
- **Delete notification** - Not implemented
- **Notification history (last 90 days)** - Not implemented
- **Notification settings (toggle each type on/off)** - Not implemented
- **Test notification button (send test email)** - Not implemented

---

### 21. API Token Management

#### ✅ Implemented Features:
- Generate API token (shown once only)
- Validate API token on requests

#### 🔴 Missing Features:
- **Name API token (descriptive label)** - Not implemented
- **Set token expiry: never / 30d / 90d / 1 year / custom date** - Not implemented
- **Set token permissions (scope)** - Not implemented:
  - Read only (GET requests only)
  - Full access
  - Module-specific scope (e.g., SSL only, DNS only)
- **List all API tokens** - Not implemented
- **View token metadata (created, last used, IP of last use)** - Not implemented
- **Revoke token** - Not implemented
- **Revoke all tokens** - Not implemented
- **Token usage log (last 100 API calls per token)** - Not implemented

---

### 22. Server Settings

#### ✅ Implemented Features:
- Profile page exists (change password, email, display name)

#### 🔴 Missing Features:
- **Panel URL / hostname configuration** - Not implemented
- **Panel port (default 8443)** - Not implemented
- **Panel admin email** - Not implemented
- **Default PHP version (used when creating new domains)** - Not implemented
- **Default web server mode (nginx / apache / nginx+apache)** - Not implemented
- **Default SSL contact email (for Let's Encrypt)** - Not implemented
- **SMTP settings for panel email delivery** - Not implemented
- **Nameservers configuration (primary NS, secondary NS)** - Not implemented
- **Server IP address settings (used in DNS auto-generation)** - Not implemented
- **Panel timezone** - Not implemented
- **Session timeout duration (idle logout in minutes)** - Not implemented
- **Password policy** - Not implemented (min length, require uppercase/numbers/symbols)
- **Panel update check + one-click update** - Not implemented
- **Maintenance mode toggle** - Not implemented
- **Data retention settings (audit log days, stats history days)** - Not implemented
- **Panel backup (export all panel settings as JSON)** - Not implemented
- **Panel restore from JSON** - Not implemented
- **System packages update trigger (apt-get upgrade)** - Not implemented
- **Reboot server button (with confirm)** - Not implemented
- **Shutdown server button (with confirm)** - Not implemented

---

### 23. Audit Log

#### ✅ Implemented Features:
- Complete log of all admin actions with timestamp
- Action categories (auth, domain, webserver, php, ssl, dns, mail, database, ftp, files, cron, backup, firewall, tunnel, terminal, settings, apitoken)
- IP address of action
- User-agent of action
- Action details (what changed)

#### 🔴 Missing Features:
- **Search by keyword** - Not implemented
- **Filter by category / date range** - Not implemented
- **Export audit log as CSV** - Not implemented
- **Retention policy (default 90 days, auto-purge old entries)** - Not implemented

---

## Critical Implementation Gaps

### Priority 1 - Core Missing Modules:
1. **File Manager** - Completely missing (only 5% implemented)
2. **Application Installer** - Completely missing (0% implemented)
3. **Log Viewer** - Completely missing (only 10% implemented)
4. **Cloudflare Tunnel** - Completely missing (only 10% implemented)
5. **Notifications & Alerts** - Completely missing (only 5% implemented)

### Priority 2 - Major Feature Gaps:
1. **Web Server Configuration** - Only basic mode toggle (15% implemented)
2. **PHP Management** - Missing pool settings and advanced config (40% implemented)
3. **Mail Management** - Missing critical features like auto-responder, webmail, spam filtering (45% implemented)
4. **Backup & Restore** - Missing remote storage, encryption, progress tracking (40% implemented)
5. **Server Settings** - Missing most server-wide configuration (20% implemented)

### Priority 3 - Security & Monitoring Gaps:
1. **Firewall & Security** - Missing SSH settings, login activity monitoring (45% implemented)
2. **Server Monitoring & Stats** - Missing historical data, alerts, process monitoring (40% implemented)
3. **Authentication** - Missing backup codes storage, email delivery, API token management (70% implemented)

---

## Database Schema Analysis

### ✅ Well-Implemented Schemas:
- [`users.ts`](apps/api/src/db/schema/users.ts) - Complete with 2FA, sessions, API token hash
- [`domains.ts`](apps/api/src/db/schema/domains.ts) - Complete with subdomains, aliases, redirects
- [`ssl.ts`](apps/api/src/db/schema/ssl.ts) - Complete with expiry tracking
- [`databases.ts`](apps/api/src/db/schema/databases.ts) - Complete with users and privileges
- [`dns.ts`](apps/api/src/db/schema/dns.ts) - Complete with zones and records
- [`email.ts`](apps/api/src/db/schema/email.ts) - Complete with mailboxes, aliases, forwards
- [`ftp.ts`](apps/api/src/db/schema/ftp.ts) - Complete with last login tracking
- [`cron.ts`](apps/api/src/db/schema/cron.ts) - Basic structure exists
- [`tunnels.ts`](apps/api/src/db/schema/tunnels.ts) - Complete structure exists
- [`audit.ts`](apps/api/src/db/schema/audit.ts) - Complete with details
- [`stats.ts`](apps/api/src/db/schema/stats.ts) - Complete with historical tracking
- [`backups.ts`](apps/api/src/db/schema/backups.ts) - Complete with schedules
- [`notifications.ts`](apps/api/src/db/schema/notifications.ts) - Complete with preferences

### 🔴 Missing Schema Elements:
- **Two-factor backup codes table** - Not implemented (commented in auth.service.ts:189)
- **API tokens table** - Only one token per user in users table
- **Cron job runs history table** - Not implemented
- **Log rotation settings table** - Not implemented
- **Server settings table** - Not implemented
- **Notification delivery queue table** - Not implemented

---

## API Routes Analysis

### ✅ Well-Implemented Routes:
- [`auth.routes.ts`](apps/api/src/modules/auth/auth.routes.ts) - Complete auth endpoints
- [`domains.routes.ts`](apps/api/src/modules/domains/domains.routes.ts) - Complete CRUD with subdomains, aliases, redirects
- [`ssl.routes.ts`](apps/api/src/modules/ssl/ssl.routes.ts) - Complete SSL management
- [`databases.routes.ts`](apps/api/src/modules/databases/databases.routes.ts) - Complete with users, export, import, query
- [`dns.routes.ts`](apps/api/src/modules/dns/dns.routes.ts) - Complete with import/export/propagation
- [`mail.routes.ts`](apps/api/src/modules/mail/mail.routes.ts) - Complete with DKIM, SPF, DMARC
- [`cron.routes.ts`](apps/api/src/modules/cron/cron.routes.ts) - Basic CRUD exists
- [`backup.routes.ts`](apps/api/src/modules/backup/backup.routes.ts) - Complete with schedules
- [`firewall.routes.ts`](apps/api/src/modules/firewall/firewall.routes.ts) - Complete with Fail2Ban

### 🔴 Missing Routes:
- **Web Server Config routes** - Not implemented
- **PHP Config routes** - Not implemented
- **FTP routes** - Not implemented (only basic structure)
- **File Manager routes** - Not implemented
- **Terminal WebSocket** - Partially implemented
- **Logs routes** - Not implemented
- **Monitoring & Stats routes** - Partially implemented
- **Application Installer routes** - Not implemented
- **Notifications routes** - Not implemented
- **API Token management routes** - Not implemented
- **Server Settings routes** - Not implemented

---

## Frontend Pages Analysis

### ✅ Well-Implemented Pages:
- [`LoginPage.tsx`](apps/web/src/pages/login/LoginPage.tsx) - Complete with 2FA
- [`DashboardPage.tsx`](apps/web/src/pages/dashboard/DashboardPage.tsx) - Comprehensive dashboard
- [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx) - Complete with CRUD, subdomains, aliases, redirects
- [`router.tsx`](apps/web/src/router.tsx) - Complete routing structure

### 🔴 Missing or Minimal Pages:
- **Web Server Config page** - Not implemented
- **PHP Config page** - Not implemented
- **SSL page** - Routes exist but page implementation unknown
- **DNS page** - Routes exist but page implementation unknown
- **Mail page** - Routes exist but page implementation unknown
- **Databases page** - Routes exist but page implementation unknown
- **FTP page** - Routes exist but page implementation unknown
- **Tunnels page** - Routes exist but page implementation unknown
- **Files page** - Routes exist but page implementation unknown
- **Terminal page** - Routes exist but page implementation unknown
- **Cron page** - Routes exist but page implementation unknown
- **Firewall page** - Routes exist but page implementation unknown
- **Logs page** - Routes exist but page implementation unknown
- **Backups page** - Routes exist but page implementation unknown
- **Audit page** - Routes exist but page implementation unknown
- **Monitoring page** - Routes exist but page implementation unknown
- **Application Installer page** - Not implemented
- **Notifications page** - Not implemented
- **Server Settings page** - Partially implemented (ProfilePage.tsx only)

---

## Recommendations

### Immediate Actions (High Priority):

1. **Complete File Manager Implementation**
   - Implement full file browsing, upload/download, permissions
   - Add code editor with syntax highlighting
   - Implement archive handling

2. **Implement Notification System**
   - Build notification bell with unread count
   - Implement email delivery for alerts
   - Add notification preferences

3. **Complete Log Viewer**
   - Implement log file reading and tailing
   - Add WebSocket streaming for real-time logs
   - Implement log rotation settings

4. **Complete Web Server Configuration**
   - Add custom directives editor
   - Implement security features (hotlink, IP restrictions)
   - Add performance settings (gzip, caching)

5. **Complete PHP Management**
   - Implement PHP-FPM pool settings
   - Add custom php.ini editor
   - Implement phpinfo() viewer

### Medium Priority:

6. **Complete Cloudflare Tunnel**
   - Implement setup wizard
   - Add tunnel management UI
   - Implement live logs and status

7. **Complete Mail Management**
   - Add auto-responder
   - Implement webmail integration
   - Add spam filtering settings

8. **Complete Backup & Restore**
   - Add remote storage (S3, SFTP)
   - Implement backup encryption
   - Add progress tracking

9. **Complete Server Settings**
   - Implement server-wide configuration
   - Add security policies
   - Implement system update controls

10. **Complete API Token Management**
    - Add token listing and management
    - Implement token scopes
    - Add usage logging

### Lower Priority:

11. **Implement Application Installer**
    - Start with WordPress installer
    - Add WP-CLI integration
    - Implement update management

12. **Enhance Monitoring**
    - Add historical graphs
    - Implement alert thresholds
    - Add process monitoring

13. **Complete Terminal**
    - Add multi-tab support
    - Implement session management
    - Add log download

14. **Complete Firewall**
    - Add SSH settings
    - Implement login activity monitoring
    - Add port scanner

15. **Complete Audit Log**
    - Add search and filtering
    - Implement CSV export
    - Add retention policy

---

## Conclusion

The NovaPanel system has a solid foundation with well-designed database schemas, API structure, and core functionality. However, significant work remains to reach the feature parity described in the plesk-features-and-flows.md plan.

**Key Strengths:**
- Clean architecture with proper separation of concerns
- Comprehensive database schema design
- Well-structured API routes
- Good authentication and authorization foundation
- Solid domain management implementation

**Key Weaknesses:**
- Several complete modules missing (File Manager, Application Installer, Log Viewer)
- Many advanced features not implemented in existing modules
- Limited frontend implementation beyond core pages
- Missing notification and alerting system
- Incomplete server-wide configuration

**Estimated Effort to Complete:**
- File Manager: 2-3 weeks
- Application Installer: 2-3 weeks
- Log Viewer: 1-2 weeks
- Web Server Config: 1-2 weeks
- PHP Management: 1-2 weeks
- Cloudflare Tunnel: 1-2 weeks
- Other enhancements: 3-4 weeks

**Total Estimated Time: 11-18 weeks** to reach feature parity with the plan.

---

*Report generated by cross-checking plesk-features-and-flows.md against NovaPanel implementation on 2026-04-27*
