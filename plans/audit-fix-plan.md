# NovaPanel Audit Fix Plan

Generated: 2026-04-28
Source: Comprehensive 20-check code audit across all modules
Total Issues: 91 (28 Critical, 32 High, 25 Medium, 6 Low)

---

## Phase 1 — Critical Security Fixes (P0)

These are security vulnerabilities and critical functionality breaks that must be fixed before any production use.

### 1.1 Fix SQL Injection in MariaDB Service

**Files:** [`mariadb.service.ts`](apps/api/src/services/mariadb.service.ts:57)
**Issue:** User-supplied `username`, `password`, `host`, `name` interpolated directly into SQL strings passed to `mysql -e`
**Affected methods:** `createUser()`, `grantPrivileges()`, `dropUser()`, `changePassword()`, `getDatabaseSize()`

**Fix approach:**
- Create a helper `escapeSqlString(val: string): string` that escapes single quotes (`'` → `''`) and backslashes
- Wrap all interpolated values: `'${escapeSqlString(username)}'`
- For database names: keep backtick escaping `` `\`${escapeSqlString(name)}\`` ``
- Add `postmap` to `ALLOWED_COMMANDS` in executor.ts (already done)

**Alternative (better long-term):** Install `mysql2` npm package and use parameterized queries via Node.js MySQL client instead of shell commands.

### 1.2 Fix SQL Injection in PostgreSQL Service

**Files:** [`postgres.service.ts`](apps/api/src/services/postgres.service.ts:47)
**Issue:** Same pattern — `username` unquoted, `password` single-quote-interpolated
**Affected methods:** `createUser()`, `grantPrivileges()`, `changePassword()`, `getDatabaseSize()`

**Fix approach:**
- Double-quote identifiers: `"${escapeSqlString(username)}"`
- Single-quote string values: `'${escapeSqlString(password)}'`
- Add the same `escapeSqlString()` helper

**Alternative:** Install `pg` npm package and use parameterized queries.

### 1.3 Fix Plain-Text Password Storage

**Files:** [`databases.service.ts`](apps/api/src/modules/databases/databases.service.ts:110), [`databases.ts`](apps/api/src/db/schema/databases.ts:19)
**Issue:** `passwordHash` column stores raw password, not a hash

**Fix approach:**
- Use the existing `encrypt()`/`decrypt()` from [`utils/crypto.ts`](apps/api/src/utils/crypto.ts) to encrypt passwords before storing
- On display: `decrypt(row.passwordHash)` and show masked (`****`)
- Update all places that read/write `passwordHash`

### 1.4 Create Missing Logs Module

**Files:** [`routes.ts`](apps/api/src/routes.ts:50) imports non-existent `./modules/logs/logs.routes.js`
**Issue:** Server may crash on startup; Logs page non-functional

**Fix approach:**
- Create `apps/api/src/modules/logs/logs.routes.ts` with handlers for:
  - `GET /logs/panel` — read from `/var/log/novapanel/panel.log` via `tail`
  - `GET /logs/fail2ban` — read from `/var/log/fail2ban.log` via `tail`
  - `GET /logs/auth` — read from `/var/log/auth.log` via `tail`
  - `GET /logs/system` — use `journalctl -n {lines} --no-pager`
- Add `tail` to `ALLOWED_COMMANDS` (already done)
- Wrap all handlers in try-catch returning graceful errors when log files don't exist

### 1.5 Implement postmap Calls in Mail Service

**Files:** [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts:110)
**Issue:** Postfix lookup tables require `postmap` to generate hash database files. Without it, mail system is non-functional.

**Fix approach:**
- After every write to `/etc/postfix/virtual_mailbox`: `run('postmap', ['/etc/postfix/virtual_mailbox'], { sudo: true })`
- After every write to `/etc/postfix/virtual_alias`: `run('postmap', ['/etc/postfix/virtual_alias'], { sudo: true })`
- After every write to `/etc/postfix/virtual_domains`: `run('postmap', ['/etc/postfix/virtual_domains'], { sudo: true })`
- Add `postmap` to `ALLOWED_COMMANDS` in executor.ts
- Affected methods: `createMailbox()`, `deleteMailbox()`, `createAlias()`, `deleteAlias()`, `enableMail()`, `disableMail()`

### 1.6 Fix SSH Port Change Lockout Risk

**Files:** [`settings.service.ts`](apps/api/src/modules/settings/settings.service.ts:134)
**Issue:** SSH port change doesn't add UFW rule for new port, doesn't validate sshd config before restart

**Fix approach:**
1. Before modifying sshd_config: `sshd -t` to validate current config is parseable
2. Add UFW rule for new port: `ufw allow {newPort}/tcp`
3. Modify sshd_config with `sed`
4. Validate new config: `sshd -t`
5. If validation fails: revert sshd_config change, return error
6. If validation passes: `systemctl restart sshd`
7. Do NOT remove old port 22 rule (admin must manually remove after confirming new port works)

### 1.7 Add sshd -t Validation Before SSH Settings Restart

**Files:** [`settings.service.ts`](apps/api/src/modules/settings/settings.service.ts:139)
**Issue:** No `sshd -t` syntax check before restart — invalid config crashes sshd

**Fix approach:**
- Before any sshd restart: `run('sshd', ['-t'], { sudo: true })`
- If exit code !== 0: return error with stderr message, do NOT restart
- Add `sshd` to `ALLOWED_COMMANDS` in executor.ts

---

## Phase 2 — Audit Logging Infrastructure (P1)

### 2.1 Implement Audit Logging Across All Modules

**Files:** 15 service files need audit logging added
**Issue:** Only 3 of 18+ modules use `auditService.log()`. The audit infrastructure exists but is not called.

**Fix approach — Centralized pattern:**

Create a helper function in each route file that extracts `userId` from the authenticated request and passes it to service methods:

```typescript
// Pattern for route handlers
fastify.post('/domains', async (req) => {
  const userId = (req as any).user?.id;
  const result = await domainsService.create(data, userId);
  return result;
});

// Pattern for service methods
async create(data: CreateDomainData, userId?: string) {
  // ... existing logic ...
  if (userId) {
    await auditService.log({
      userId,
      action: 'domain.create',
      resource: `domain:${domain.id}`,
      details: JSON.stringify({ name: domain.name }),
      ipAddress: req?.ip,
    });
  }
}
```

**Modules requiring audit logging (in order):**

| Module | Actions to Log |
|--------|---------------|
| Auth | login, logout, 2FA enable/disable, password change, email change, session revoke |
| Domains | create, delete, suspend, activate, update, rename |
| Subdomains | create, delete |
| Aliases | create, delete |
| Redirects | create, delete |
| Webserver | config update, reload |
| PHP | config update, version change, pool restart |
| SSL | issue LE, upload custom, self-signed, delete, renew, HTTPS toggle, HSTS toggle |
| DNS | record add, edit, delete, zone import, zone reset |
| Mail | domain enable/disable, mailbox create/delete/update, alias create/delete, DKIM, SPF, DMARC, catch-all |
| Databases | create, delete, clone, user create/delete, password change, export, import |
| FTP | account create, delete, password change |
| Files | upload, delete, edit, chmod, rename, move, copy, extract |
| Cron | job create, update, delete, toggle, run now |
| Backup | create, restore, delete, schedule create/delete/toggle |
| Firewall | rule add, delete, UFW enable/disable, ban/unban, SSH settings |
| Tunnel | setup, delete, route add/edit/delete, start/stop |
| Settings | any settings save |
| Tokens | create, revoke |

**Estimated scope:** ~80-100 audit log insertion points across all modules.

---

## Phase 3 — Background Job System (P1)

### 3.1 Implement Background Job Scheduler

**Files:** [`index.ts`](apps/api/src/index.ts), new file `apps/api/src/services/scheduler.ts`
**Issue:** No background job system exists. SSL never auto-renews, backups never run on schedule, stats never collected.

**Fix approach:**
- Install `node-cron` package
- Create `apps/api/src/services/scheduler.ts` with cron jobs:

| Job | Schedule | Action |
|-----|----------|--------|
| SSL renewal check | Daily at 3 AM | Check certs expiring < 30 days, run `certbot renew` |
| Backup scheduler | Every minute | Check for due backup schedules, execute them |
| Stats collection | Every 5 minutes | Write system stats to `serverStats` table |
| Session cleanup | Hourly | Delete expired sessions from DB |
| Notification cleanup | Daily at 4 AM | Delete notifications older than retention period |
| Terminal cleanup | Every 10 minutes | Kill stale terminal sessions > 8 hours old |

- Import and start scheduler in [`index.ts`](apps/api/src/index.ts) after server starts

### 3.2 Wire Up Stats Collection

**Files:** [`stats.service.ts`](apps/api/src/modules/stats/stats.service.ts), [`stats.ts`](apps/api/src/db/schema/stats.ts)
**Issue:** `serverStats` table defined but never written to

**Fix approach:**
- Add `collectAndStore()` method to StatsService that reads current stats via `systeminformation` and inserts into `serverStats` table
- Add API endpoint `GET /stats/history?range=1h|6h|24h|7d` that queries historical data
- Update frontend [`MonitoringPage.tsx`](apps/web/src/pages/monitoring/MonitoringPage.tsx) to use real data instead of `generateHistoricalData()`

### 3.3 Implement SSL Auto-Renewal

**Files:** New scheduler job, [`ssl.service.ts`](apps/api/src/modules/ssl/ssl.service.ts)
**Issue:** Certificates expire without auto-renewal

**Fix approach:**
- Daily cron job calls `sslService.listExpiring(30)` to find certs expiring within 30 days
- For each: call `sslService.renewCertificate(domainId)`
- On success: reload nginx, create notification "SSL certificate renewed for {domain}"
- On failure: create notification "SSL renewal failed for {domain}"
- Spread renewals across the day to avoid LE rate limits

### 3.4 Implement Backup Scheduler Execution

**Files:** New scheduler job, [`backup.service.ts`](apps/api/src/modules/backup/backup.service.ts)
**Issue:** Backup schedules stored in DB but never executed

**Fix approach:**
- Every minute: query `backupSchedules` table for schedules where `nextRunAt <= now()`
- For each due schedule: execute backup, update `lastRunAt`, calculate `nextRunAt`
- On completion: enforce retention policy (delete oldest backups beyond `retentionCount`)
- Create notification on success/failure

---

## Phase 4 — Domain Lifecycle Fixes (P1)

### 4.1 Implement Full Domain DELETE Cascade

**Files:** [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts:219)
**Issue:** DELETE only removes nginx vhost, domain directory, system user. Leaves orphaned mailboxes, databases, FTP, cron, SSL, DNS, PHP-FPM, Apache.

**Fix approach — Delete in this order:**
1. Delete all mailboxes (Postfix/Dovecot config + `/var/mail/` data)
2. Drop all databases (MariaDB/PostgreSQL) and their users
3. Delete all FTP accounts (ProFTPd config)
4. Delete all cron jobs (remove from system crontab)
5. Remove SSL certificate (certbot delete + nginx SSL block)
6. Delete DNS zone (BIND zone file + named.conf.local entry + DB records)
7. Delete PHP-FPM pool config and reload php-fpm
8. Remove Apache vhost (a2dissite + delete config)
9. Remove nginx vhost (unlink sites-enabled + delete sites-available)
10. Delete domain directory: `rm -rf /var/www/vhosts/{domain}`
11. Delete system user: `userdel {systemUser}`
12. Delete DB records (cascading: redirects → aliases → subdomains → domain)

### 4.2 Implement Domain CREATE with DNS/Mail/PHP-FPM

**Files:** [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts:72)
**Issue:** `createDns` and `createMail` options accepted but never acted upon. No per-domain PHP-FPM pool.

**Fix approach:**
- When `createDns` is true: call `dnsService.ensureZone(domainId)` to create BIND zone
- When `createMail` is true: call `mailService.enableMail(domainId)` to set up Postfix/Dovecot
- Create per-domain PHP-FPM pool config via `phpFpmService.createPool(domain, phpVersion)`
- Add rollback for each new step on failure

### 4.3 Preserve nginx Config on Domain Suspend

**Files:** [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts:247)
**Issue:** SUSPEND overwrites original nginx config with 503 config. Custom configurations lost on activate.

**Fix approach:**
- Before writing 503 config: copy original to `${domain.name}.conf.disabled`
- On activate: restore from `.conf.disabled` backup instead of regenerating
- If no backup exists: regenerate from DB fields (current behavior as fallback)

---

## Phase 5 — Mail System Fixes (P1)

### 5.1 Add Dovecot Reload After Mailbox Creation

**Files:** [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts:93)
**Fix:** Add `await run('systemctl', ['reload', 'dovecot'], { sudo: true })` after writing Dovecot users file

### 5.2 Add chmod 600 to DKIM Private Key

**Files:** [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts:270)
**Fix:** Add `await run('chmod', ['600', `${keyDir}/mail.private`], { sudo: true })` after writing key

### 5.3 Write DKIM DNS Record to BIND Zone

**Files:** [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts:288)
**Fix:** After inserting DNS record to DB, regenerate BIND zone file and reload BIND

### 5.4 Implement Catch-All Functionality

**Files:** [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts:457)
**Fix:**
- Check for existing catch-all for the domain
- Write `@${domain.name} ${destination}` to `/etc/postfix/virtual_alias`
- Run `postmap /etc/postfix/virtual_alias`
- Reload Postfix

### 5.5 Validate Mail Alias Destination as Email

**Files:** [`mail.schema.ts`](apps/api/src/modules/mail/mail.schema.ts:19)
**Fix:** Change `destination: z.string().min(1)` to `destination: z.string().email()`

---

## Phase 6 — Backup System Fixes (P1)

### 6.1 Implement Real Backup Verification

**Files:** [`backup.service.ts`](apps/api/src/modules/backup/backup.service.ts:230)
**Fix:**
- On backup creation: compute SHA256 checksum via `sha256sum`
- Store checksum in backup DB record
- `verifyBackup()`: recompute checksum and compare with stored value

### 6.2 Add Pre-Restore Snapshot

**Files:** [`backup.service.ts`](apps/api/src/modules/backup/backup.service.ts:117)
**Fix:** Before extraction: `tar -czf /path/to/.pre-restore-{timestamp}.tar.gz -C domainDir .`

### 6.3 Fix Ownership After Restore

**Files:** [`backup.service.ts`](apps/api/src/modules/backup/backup.service.ts:137)
**Fix:** After extraction: `chown -R {systemUser}:www-data {domainDir}`

### 6.4 Fix Staging Directory Cleanup

**Files:** [`backup.service.ts`](apps/api/src/modules/backup/backup.service.ts:43)
**Fix:** Move cleanup to `finally` block instead of success path only

### 6.5 Encrypt Storage Credentials

**Files:** [`backup.service.ts`](apps/api/src/modules/backup/backup.service.ts:251)
**Fix:** Use `encrypt()`/`decrypt()` from `utils/crypto.ts` for storage config before DB insert/select

### 6.6 Implement Retention Enforcement

**Fix:** After backup creation, query backups with same scope ordered by date, delete excess beyond `retentionCount`

---

## Phase 7 — File Security Fixes (P2)

### 7.1 Stream File Uploads Instead of Buffering

**Files:** [`files.routes.ts`](apps/api/src/modules/files/files.routes.ts:78)
**Fix:** Use `data.file.pipe(writeStream)` to stream to temp file, then move to target

### 7.2 Add Dangerous Extension Blocklist

**Files:** [`files.routes.ts`](apps/api/src/modules/files/files.routes.ts:78)
**Fix:** Reject uploads with extensions: `.php`, `.php5`, `.phtml`, `.sh`, `.cgi`, `.pl`, `.py`, `.rb`, `.asp`, `.aspx`, `.jsp`

### 7.3 Add Binary File Detection in Editor

**Files:** [`files.service.ts`](apps/api/src/modules/files/files.service.ts:320)
**Fix:** Read first 8KB, check for null bytes. If found, reject with "Binary file cannot be edited"

### 7.4 Fix Archive Extraction Zip Slip

**Files:** [`files.service.ts`](apps/api/src/modules/files/files.service.ts:297)
**Fix:** After extraction, enumerate all extracted files and verify each starts with target directory

### 7.5 Use `lstat()` Instead of `stat()` for Directory Listings

**Files:** [`files.service.ts`](apps/api/src/modules/files/files.service.ts:64)
**Fix:** Use `lstat()` to avoid following symlinks in directory listings

---

## Phase 8 — Validation & Schema Fixes (P2)

### 8.1 Add Zod Schemas for Settings Routes

**Files:** Create [`settings.schema.ts`](apps/api/src/modules/settings/settings.schema.ts)
**Fix:** Create Zod schemas for all 15 settings PUT endpoints with proper types, ranges, and formats

### 8.2 Add Zod Schemas for Installer Routes

**Files:** Create [`installer.schema.ts`](apps/api/src/modules/installer/installer.schema.ts)
**Fix:** Validate appId, domain, path (whitelist), adminEmail, adminPassword

### 8.3 Apply Existing File Schemas

**Files:** [`files.routes.ts`](apps/api/src/modules/files/files.routes.ts:3)
**Fix:** Replace `req.body as { ... }` with `schema.parse(req.body)` for all file routes

### 8.4 Extend SSL Schema for SAN Domains

**Files:** [`ssl.schema.ts`](apps/api/src/modules/ssl/ssl.schema.ts)
**Fix:** Add `sanDomains: z.array(z.string()).optional()`, `wildcard: z.boolean().optional()`

### 8.5 Extend Backup Schema for Encryption

**Files:** [`backup.schema.ts`](apps/api/src/modules/backup/backup.schema.ts)
**Fix:** Add `encrypted: z.boolean().optional()`, `encryptionPassword: z.string().optional()`

### 8.6 Fix SSL Type Enum Mismatch

**Files:** [`ssl.ts`](apps/web/src/api/hooks/ssl.ts:8)
**Fix:** Change frontend type from `'selfsigned'` to `'self-signed'` to match DB enum

### 8.7 Add Missing DB Columns

**Files:** Migration file
**Fix:** Add columns:
- `mailboxes`: `isSuspended` (integer, default 0), `autoresponderSubject` (text, nullable)
- `mailDomains`: `catchAllDestination` (text, nullable), `spamAssassinEnabled` (integer, default 0), `spamScoreThreshold` (real, default 5.0)
- `mailAliases`: `forwardType` (text, default 'forward')
- `cronJobs`: `domainId` (text, nullable, references domains)
- `backups`: `domainId` (text, nullable, references domains)

---

## Phase 9 — Tunnel Fixes (P2)

### 9.1 Validate Route Hostname Within Zone

**Files:** [`tunnel.service.ts`](apps/api/src/modules/tunnel/tunnel.service.ts:339)
**Fix:** In `addRoute()`, fetch tunnel's zones, verify `hostname` ends with a configured zone name

### 9.2 Check DNS CNAME Before Creation

**Files:** [`tunnel.service.ts`](apps/api/src/modules/tunnel/tunnel.service.ts:507)
**Fix:** Before POST to Cloudflare API, GET existing CNAME records for the hostname. If exists, update instead of create.

### 9.3 Delete DNS CNAME on Route Deletion

**Files:** [`tunnel.service.ts`](apps/api/src/modules/tunnel/tunnel.service.ts:409)
**Fix:** In `deleteRoute()`, after DB deletion, look up hostname's zone and call Cloudflare DELETE API for the CNAME

### 9.4 Set chmod 600 on Credentials File

**Files:** [`tunnel.service.ts`](apps/api/src/modules/tunnel/tunnel.service.ts:470)
**Fix:** After writing config.yml: `run('chmod', ['600', configPath], { sudo: true })`

---

## Phase 10 — Auth System Fixes (P2)

### 10.1 Implement Password Reset Flow

**Files:** [`auth.service.ts`](apps/api/src/modules/auth/auth.service.ts:377)
**Fix:**
- Add `resetTokenHash` and `resetTokenExpiresAt` columns to users table
- Store token hash in DB with 1-hour expiry
- Implement `POST /auth/reset-password` endpoint that verifies token and sets new password
- Implement email sending (can use nodemailer + SMTP config from settings)

### 10.2 Implement 2FA tempToken

**Files:** [`auth.service.ts`](apps/api/src/modules/auth/auth.service.ts:60)
**Fix:**
- After successful password check with 2FA enabled: generate `tempToken` (randomBytes(32))
- Store hash in DB with 5-minute expiry
- Return `tempToken` instead of `userId`
- 2FA verification endpoint accepts `tempToken + code`
- Invalidate tempToken after use

### 10.3 Implement 2FA Backup Codes

**Files:** [`auth.service.ts`](apps/api/src/modules/auth/auth.service.ts:199)
**Fix:**
- Create `two_factor_backup_codes` table (userId, codeHash, usedAt)
- Store hashed backup codes during 2FA setup
- Implement `verifyBackupCode()` to check against stored hashes
- Mark code as used after successful verification

---

## Phase 11 — Frontend UX Fixes (P3)

### 11.1 Add Toast Notification System

**Files:** Install `sonner` package, create wrapper hook
**Fix:**
- Install `sonner` npm package
- Add `<Toaster />` to [`App.tsx`](apps/web/src/App.tsx)
- Create `useToastMutation()` wrapper hook that auto-shows success/error toasts
- Update all mutation hooks to use the wrapper

### 11.2 Add Error State Handling

**Files:** All page components
**Fix:** Create reusable `ErrorState` component. Add `isError` checks alongside `isLoading` checks.

### 11.3 Fix Tunnel WebSocket Auth

**Files:** [`tunnel.ts`](apps/web/src/api/hooks/tunnel.ts:177)
**Fix:** Use session cookie (auto-sent with WebSocket) instead of `localStorage.getItem('auth_token')`

### 11.4 Fix Monitoring Page Fake Data

**Files:** [`MonitoringPage.tsx`](apps/web/src/pages/monitoring/MonitoringPage.tsx:96)
**Fix:** Replace `generateHistoricalData()` with real API calls once stats collection is implemented (Phase 3.2)

---

## Phase 12 — WebSocket & Performance Fixes (P3)

### 12.1 Fix WS Auth to Query by Hash

**Files:** [`terminal.ws.ts`](apps/api/src/modules/terminal/terminal.ws.ts:116), [`tunnel.ws.ts`](apps/api/src/modules/tunnel/tunnel.ws.ts:139)
**Fix:** Replace `SELECT * FROM users` + iteration with `SELECT * FROM users WHERE apiTokenHash = ? LIMIT 1`

### 12.2 Add Idle Timeout to Terminal WebSocket

**Files:** [`terminal.ws.ts`](apps/api/src/modules/terminal/terminal.ws.ts:140)
**Fix:** Track `lastActivity` timestamp, close sessions idle > 30 minutes

### 12.3 Use randomBytes for Session IDs

**Files:** [`auth.service.ts`](apps/api/src/modules/auth/auth.service.ts:85)
**Fix:** Replace `nanoid(32)` with `randomBytes(32).toString('hex')` for 256-bit session IDs

---

## Implementation Order Summary

```
Phase 1  → Critical Security (SQL injection, password storage, logs module, postmap, SSH)
Phase 2  → Audit Logging Infrastructure
Phase 3  → Background Job System (scheduler, stats, SSL renewal, backup execution)
Phase 4  → Domain Lifecycle (DELETE cascade, CREATE completeness, SUSPEND preservation)
Phase 5  → Mail System (Dovecot reload, DKIM chmod, DKIM DNS, catch-all, alias validation)
Phase 6  → Backup System (verification, snapshots, ownership, cleanup, encryption, retention)
Phase 7  → File Security (streaming uploads, extension blocklist, binary detection, zip slip)
Phase 8  → Validation & Schema (settings Zod, installer Zod, file schemas, enum fix, DB columns)
Phase 9  → Tunnel Fixes (hostname validation, DNS CNAME lifecycle, credentials chmod)
Phase 10 → Auth System (password reset, 2FA tempToken, backup codes)
Phase 11 → Frontend UX (toasts, error states, WS auth, monitoring data)
Phase 12 → WebSocket & Performance (hash query, idle timeout, session ID entropy)
```

Each phase can be implemented independently. Phases 1-3 are the highest priority and should be done first.
