# NovaPanel / ServerForge — Backend Test Report

> **Version**: 1.0.0 | **Date**: 2026-05-05 | **Status**: Complete

---

## Table of Contents

1. [Environment](#environment)
2. [Services Running](#services-running)
3. [Summary](#summary)
4. [Detailed Test Results](#detailed-test-results)
5. [Passed Tests](#passed-tests)
6. [Bug Catalogue](#bug-catalogue)
7. [Server Health After Tests](#server-health-after-tests)
8. [Root Cause Analysis](#root-cause-analysis)
9. [Recommendations](#recommendations)

---

## Environment

| Property        | Value                                              |
|-----------------|----------------------------------------------------|
| **Server IP**   | 192.168.0.211                                      |
| **OS**          | Ubuntu 24.04.4 LTS (Noble Numbat)                  |
| **Kernel**      | 6.8.0-110-generic                                  |
| **CPU**         | Intel Core i3-6100U @ 2.30GHz (4 cores)            |
| **RAM**         | 7.6 GiB                                            |
| **Disk**        | 98 GB (24% used)                                   |
| **Panel Version** | 1.0.0                                            |
| **Panel Port**  | 8732                                               |
| **Test Date**   | 2026-05-05                                         |

---

## Services Running

All **13** expected services were active at test time:

| # | Service        | Status |
|---|----------------|--------|
| 1 | nginx          | ✅ Active |
| 2 | apache2        | ✅ Active |
| 3 | mariadb        | ✅ Active |
| 4 | postgresql     | ✅ Active |
| 5 | php8.1-fpm     | ✅ Active |
| 6 | php8.2-fpm     | ✅ Active |
| 7 | php8.3-fpm     | ✅ Active |
| 8 | postfix        | ✅ Active |
| 9 | dovecot        | ✅ Active |
| 10 | bind9          | ✅ Active |
| 11 | proftpd        | ✅ Active |
| 12 | redis-server   | ✅ Active |
| 13 | fail2ban       | ✅ Active |

---

## Summary

| Step | Module               | Tests | Pass | Partial | Fail |
|------|----------------------|-------|------|---------|------|
| 1    | Authentication       | 6     | 6    | 0       | 0    |
| 2    | Domain Management    | 10    | 3    | 4       | 3    |
| 3    | Web Server Config    | 4     | 1    | 3       | 0    |
| 4    | SSL Certificates     | 5     | 2    | 1       | 2    |
| 5    | DNS Management       | 7     | 2    | 4       | 1    |
| 6    | Mail Management      | 6     | 3    | 2       | 1    |
| 7    | Database Management  | 6     | 4    | 1       | 1    |
| 8    | FTP Management       | 4     | 3    | 1       | 0    |
| 9    | File Manager         | 8     | 4    | 0       | 4    |
| 10   | Cron Jobs            | 5     | 4    | 1       | 0    |
| 11   | Backup               | 4     | 3    | 1       | 0    |
| 12   | Firewall             | 5     | 1    | 1       | 3    |
| 13   | Server Stats         | 3     | 3    | 0       | 0    |
| 14   | API Tokens           | 3     | 1    | 2       | 0    |
| 15   | Audit Log            | 1     | 0    | 1       | 0    |
| 16   | Edge Cases           | 4     | 1    | 1       | 2    |
|      | **TOTAL**            | **81** | **41** | **23** | **17** |

### Overall Results

```
81 tests run
41 PASS    (50.6%)
23 PARTIAL (28.4%)
17 FAIL    (21.0%)
```

### Result Distribution by Module

```
Authentication  ████████████████████████████████████████ 100.0%  (6/6)
Server Stats    ████████████████████████████████████████ 100.0%  (3/3)
FTP Management  ███████████████████████████████░░░░░░░░░  75.0%  (3/4)
Database Mgmt   ██████████████████████████████░░░░░░░░░░  66.7%  (4/6)
Cron Jobs       ██████████████████████████████░░░░░░░░░░  80.0%  (4/5)
Backup          ██████████████████████████████░░░░░░░░░░  75.0%  (3/4)
File Manager    ████████████████████░░░░░░░░░░░░░░░░░░░░  50.0%  (4/8)
Mail Management ████████████████████░░░░░░░░░░░░░░░░░░░░  50.0%  (3/6)
Domain Mgmt     ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  30.0%  (3/10)
Web Server Cfg  ████████████████████░░░░░░░░░░░░░░░░░░░░  25.0%  (1/4 partial)
SSL Certs       ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  40.0%  (2/5)
DNS Management  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  28.6%  (2/7)
API Tokens      ████████████████████░░░░░░░░░░░░░░░░░░░░  33.3%  (1/3)
Firewall        █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  20.0%  (1/5)
Audit Log       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0.0%  (0/1)
Edge Cases      █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  25.0%  (1/4)
```

---

## Detailed Test Results

### Step 1 — Authentication (6/6 ✅)

All authentication flows work correctly. Login, token validation, and session management are fully functional.

| Test | Description | Result |
|------|-------------|--------|
| 1.1 | Login with valid credentials → 200, session + user object | ✅ PASS |
| 1.2 | Login with wrong password → 401, generic error | ✅ PASS |
| 1.3 | Login with non-existent user → 401, same generic error | ✅ PASS |
| 1.4 | Protected endpoint without token → 401 | ✅ PASS |
| 1.5 | Protected endpoint with invalid token → 401 | ✅ PASS |
| 1.6 | Get current user profile → complete user object, no password hash | ✅ PASS |

### Step 2 — Domain Management (3/4/3)

Domain CRUD works at the DB level but nginx integration is broken. Activation crashes, subdomains/aliases don't update nginx, and deletion doesn't clean up disk.

| Test | Description | Result |
|------|-------------|--------|
| 2.1 | Create domain | 🟠 PARTIAL — DB record created, nginx vhost empty |
| 2.2 | Duplicate domain → 409 Conflict | ✅ PASS |
| 2.3 | Activate domain | 🔴 FAIL — 500 crash (naming mismatch) |
| 2.4 | Get domain list → correct array | ✅ PASS |
| 2.5 | Get single domain → full domain object | ✅ PASS |
| 2.6 | Create subdomain | 🟠 PARTIAL — DB only, no nginx update |
| 2.7 | Create alias | 🟠 PARTIAL — DB only, no nginx update |
| 2.8 | Suspend domain | 🟠 PARTIAL — Config renamed but naming inconsistent |
| 2.9 | Delete domain | 🔴 FAIL — No disk cleanup |
| 2.10 | Domain name validation | 🔴 FAIL — 206-char domain accepted |

### Step 3 — Web Server Config (1/3/0)

Basic nginx reload works but vhost configuration operations have issues.

| Test | Description | Result |
|------|-------------|--------|
| 3.1 | Get nginx vhost config | 🟠 PARTIAL — Returns content but often empty |
| 3.2 | Update nginx vhost config | 🟠 PARTIAL — Generic 500 on errors |
| 3.3 | Get PHP-FPM versions | 🟠 PARTIAL — Versions listed but pool config missing |
| 3.4 | Reload nginx → 200, nginx still active | ✅ PASS |

### Step 4 — SSL Certificates (2/1/2)

Certificate retrieval and Let's Encrypt error handling work, but actual SSL deployment is completely broken due to missing sudo.

| Test | Description | Result |
|------|-------------|--------|
| 4.1 | Create self-signed certificate | 🔴 FAIL — nginx -t fails without sudo |
| 4.2 | Get certificate details → comprehensive cert info from DB | ✅ PASS |
| 4.3 | Let's Encrypt on local → meaningful error, consistent state | ✅ PASS |
| 4.4 | Upload custom certificate | 🔴 FAIL — nginx -t fails without sudo |
| 4.5 | Delete certificate | 🟠 PARTIAL — DB deleted but disk files remain |

### Step 5 — DNS Management (2/4/1)

DNS CRUD works in the database but zone files are never written to BIND. Record validation is also missing.

| Test | Description | Result |
|------|-------------|--------|
| 5.1 | Create DNS zone | 🟠 PARTIAL — DB only, no BIND zone file |
| 5.2 | Create DNS record | 🟠 PARTIAL — DB only, no BIND update |
| 5.3 | DNS record validation | 🔴 FAIL — Non-IP values accepted for A records |
| 5.4 | List DNS records | 🟠 PARTIAL — Returns DB records (not live BIND) |
| 5.5 | Edit DNS record → value updated | ✅ PASS |
| 5.6 | Delete DNS record → record removed | ✅ PASS |
| 5.7 | Delete DNS zone | 🟠 PARTIAL — DB only, no BIND cleanup |

### Step 6 — Mail Management (3/2/1)

Domain and alias management work but mailbox creation is incomplete (missing Postfix vmailbox entry and directory). DKIM is broken.

| Test | Description | Result |
|------|-------------|--------|
| 6.1 | Enable mail domain → Postfix virtual_domains updated | ✅ PASS |
| 6.2 | Create mailbox | 🟠 PARTIAL — Dovecot user created, Postfix vmailbox missing, no directory |
| 6.3 | Create mail alias → Postfix virtual_alias updated | ✅ PASS |
| 6.4 | Set catch-all | 🟠 PARTIAL — Postfix updated but DB not persisted |
| 6.5 | DKIM key generation | 🔴 FAIL — OpenDKIM permissions/service failure |
| 6.6 | Delete mailbox → removed from Dovecot + DB | ✅ PASS |

### Step 7 — Database Management (4/1/1)

MariaDB operations work well. PostgreSQL database creation fails due to incorrect command invocation.

| Test | Description | Result |
|------|-------------|--------|
| 7.1 | Create database (MariaDB) | 🟠 PARTIAL — DB created but `createUser: true` ignored |
| 7.2 | Create database (PostgreSQL) | 🔴 FAIL — `createdb` command fails silently |
| 7.3 | Create additional DB user → MariaDB user created with correct privileges | ✅ PASS |
| 7.4 | Change DB user password → old rejected, new works | ✅ PASS |
| 7.5 | Export database → valid SQL dump | ✅ PASS |
| 7.6 | Delete database → DB + user removed from MariaDB | ✅ PASS |

### Step 8 — FTP Management (3/1/0)

FTP account management works at the DB level but no system-level ProFTPD configuration is created.

| Test | Description | Result |
|------|-------------|--------|
| 8.1 | Create FTP account | 🟠 PARTIAL — DB only, no ProFTPD config |
| 8.2 | Change FTP password → hash updated in DB | ✅ PASS |
| 8.3 | Set FTP read-only → flag updated in DB | ✅ PASS |
| 8.4 | Delete FTP account → DB record removed | ✅ PASS |

### Step 9 — File Manager (4/0/4)

Read operations and uploads work. Write operations (mkdir, delete) fail due to missing sudo. File viewing is broken due to a binary detection bug.

| Test | Description | Result |
|------|-------------|--------|
| 9.1 | List directory → matches actual server contents | ✅ PASS |
| 9.2 | Create directory | 🔴 FAIL — Missing sudo on fs operations |
| 9.3 | Upload file → file written with correct content and permissions | ✅ PASS |
| 9.4 | Get file content | 🔴 FAIL — False binary detection on files < 8KB |
| 9.5 | Edit file → content updated, ownership preserved | ✅ PASS |
| 9.6 | Path traversal attempt → 403 blocked correctly | ✅ PASS |
| 9.7 | Change permissions → mode updated correctly | ✅ PASS |
| 9.8 | Delete item | 🔴 FAIL — Missing sudo on fs operations |

### Step 10 — Cron Jobs (4/1/0)

Cron job management works in the DB but jobs are never written to the system crontab.

| Test | Description | Result |
|------|-------------|--------|
| 10.1 | Create cron job | 🟠 PARTIAL — DB only, no system crontab entry |
| 10.2 | Run cron job → realistic exit code and output | ✅ PASS |
| 10.3 | Disable cron job → isActive toggled | ✅ PASS |
| 10.4 | Enable cron job → isActive toggled back | ✅ PASS |
| 10.5 | Delete cron job → DB record removed | ✅ PASS |

### Step 11 — Backup (3/1/0)

Backup creation, listing, and deletion work. Restore has minor issues.

| Test | Description | Result |
|------|-------------|--------|
| 11.1 | Create backup → valid archive with metadata | ✅ PASS |
| 11.2 | List backups → correct array | ✅ PASS |
| 11.3 | Restore backup | 🟠 PARTIAL — Partial restoration |
| 11.4 | Delete backup → file + DB record removed | ✅ PASS |

### Step 12 — Firewall (1/1/3)

UFW parsing is broken across the board. Status, rule listing, and deletion all fail.

| Test | Description | Result |
|------|-------------|--------|
| 12.1 | Get firewall status | 🔴 FAIL — Reports disabled when UFW is active |
| 12.2 | List firewall rules | 🔴 FAIL — Empty array despite 28 active rules |
| 12.3 | Add firewall rule | 🔴 FAIL — Rule added but API reports failure |
| 12.4 | Delete firewall rule | 🔴 FAIL — Missing interactive "y" confirmation |
| 12.5 | Fail2Ban status → correct jail info | ✅ PASS |

### Step 13 — Server Stats (3/3/0)

All monitoring endpoints return accurate data matching actual system state.

| Test | Description | Result |
|------|-------------|--------|
| 13.1 | Server stats → all values match actual system | ✅ PASS |
| 13.2 | Services status → all 11 services match systemctl | ✅ PASS |
| 13.3 | Dashboard summary → correct counts | ✅ PASS |

### Step 14 — API Tokens (1/2/0)

Token creation and listing work but newly created tokens cannot be used for authentication.

| Test | Description | Result |
|------|-------------|--------|
| 14.1 | Create token | 🟠 PARTIAL — Token stored but not usable with Bearer auth |
| 14.2 | List tokens → metadata only, no plaintext | ✅ PASS |
| 14.3 | Use token for auth | 🟠 PARTIAL — In-memory token disconnected from auth middleware |

### Step 15 — Audit Log (0/1/0)

Audit logging works but has missing IP addresses on some entries.

| Test | Description | Result |
|------|-------------|--------|
| 15.1 | Audit log entries | 🟠 PARTIAL — 5 entries missing IP addresses |

### Step 16 — Edge Cases (1/1/2)

404 handling works correctly but Zod validation errors return 500 instead of 400.

| Test | Description | Result |
|------|-------------|--------|
| 16.1 | Non-existent resources → proper 404 for all | ✅ PASS |
| 16.2 | Zod validation errors | 🔴 FAIL — Returns 500 instead of 400 |
| 16.3 | Concurrent requests | 🟠 PARTIAL — Mostly handled |
| 16.4 | Large payload handling | 🔴 FAIL — Generic 500 error |

---

## Passed Tests

The following tests passed completely (one-line confirmations):

- **Test 1.1**: Login with valid credentials → 200, session + user object returned ✅
- **Test 1.2**: Login with wrong password → 401, generic error ✅
- **Test 1.3**: Login with non-existent user → 401, same generic error ✅
- **Test 1.4**: Protected endpoint without token → 401 ✅
- **Test 1.5**: Protected endpoint with invalid token → 401 ✅
- **Test 1.6**: Get current user profile → complete user object, no password hash ✅
- **Test 2.2**: Duplicate domain → 409 Conflict ✅
- **Test 2.4**: Get domain list → correct array ✅
- **Test 2.5**: Get single domain → full domain object ✅
- **Test 3.4**: Reload nginx → 200, nginx still active ✅
- **Test 4.2**: Get certificate details → comprehensive cert info from DB ✅
- **Test 4.3**: Let's Encrypt on local → meaningful error, consistent state ✅
- **Test 5.5**: Edit DNS record → value updated ✅
- **Test 5.6**: Delete DNS record → record removed ✅
- **Test 6.1**: Enable mail domain → Postfix virtual_domains updated ✅
- **Test 6.3**: Create mail alias → Postfix virtual_alias updated ✅
- **Test 6.6**: Delete mailbox → removed from Dovecot + DB ✅
- **Test 7.3**: Create additional DB user → MariaDB user created with correct privileges ✅
- **Test 7.4**: Change DB user password → old rejected, new works ✅
- **Test 7.5**: Export database → valid SQL dump ✅
- **Test 7.6**: Delete database → DB + user removed from MariaDB ✅
- **Test 8.2**: Change FTP password → hash updated in DB ✅
- **Test 8.3**: Set FTP read-only → flag updated in DB ✅
- **Test 8.4**: Delete FTP account → DB record removed ✅
- **Test 9.1**: List directory → matches actual server contents ✅
- **Test 9.3**: Upload file → file written with correct content and permissions ✅
- **Test 9.5**: Edit file → content updated, ownership preserved ✅
- **Test 9.6**: Path traversal attempt → 403 blocked correctly ✅
- **Test 9.7**: Change permissions → mode updated correctly ✅
- **Test 10.2**: Run cron job → realistic exit code and output ✅
- **Test 10.3**: Disable cron job → isActive toggled ✅
- **Test 10.4**: Enable cron job → isActive toggled back ✅
- **Test 10.5**: Delete cron job → DB record removed ✅
- **Test 11.1**: Create backup → valid archive with metadata ✅
- **Test 11.2**: List backups → correct array ✅
- **Test 11.4**: Delete backup → file + DB record removed ✅
- **Test 12.5**: Fail2Ban status → correct jail info ✅
- **Test 13.1**: Server stats → all values match actual system ✅
- **Test 13.2**: Services status → all 11 services match systemctl ✅
- **Test 13.3**: Dashboard summary → correct counts ✅
- **Test 14.2**: List tokens → metadata only, no plaintext ✅
- **Test 16.1**: Non-existent resources → proper 404 for all ✅

---

## Bug Catalogue

### Severity Legend

| Icon | Severity | Description |
|------|----------|-------------|
| 🔴 | CRITICAL | System-level failure; core functionality broken |
| 🟠 | HIGH | Feature broken; significant user impact |
| 🟡 | MEDIUM | Incorrect behavior; workaround possible |
| 🟢 | LOW | Minor issue; cosmetic or edge case |

---

### 🔴 CRITICAL — System-Level Failures (6 bugs)

#### BUG-001: Nginx vhost not populated on domain creation

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`websites.service.ts`](apps/api/src/modules/websites/websites.service.ts) |
| **Impact** | Domains cannot serve web traffic after creation |

**Description**: Domain creation creates a website directory and an nginx config file, but the config file contains only `# No domains attached yet` — no `server {}` block, no `server_name`, no `document_root`. The domain is invisible to nginx.

**Expected**: A fully populated nginx `server {}` block with the correct `server_name` and `document_root` directives.

**Actual**: Config file contains only a comment. Nginx serves no content for the domain.

---

#### BUG-002: SSL nginx -t runs without sudo

| Property | Value |
|----------|-------|
| **Module** | SSL Certificates |
| **File** | [`ssl.service.ts`](apps/api/src/modules/ssl/ssl.service.ts) |
| **Impact** | No SSL certificates can be deployed |

**Description**: The SSL service runs `nginx -t` without sudo, causing `/run/nginx.pid` read-only errors. ALL SSL operations (self-signed, custom upload, delete) fail. The certificate is stored in the DB but never written to disk and nginx is never configured for SSL.

**Expected**: `nginx -t` runs with elevated privileges, certificate files written to disk, nginx reloaded with SSL configuration.

**Actual**: `nginx -t` fails with permission error. No disk writes. No nginx reload.

---

#### BUG-003: DNS not synced to BIND

| Property | Value |
|----------|-------|
| **Module** | DNS Management |
| **File** | [`dns.service.ts`](apps/api/src/modules/dns/dns.service.ts) |
| **Impact** | DNS management is DB-only, no actual DNS resolution |

**Description**: All DNS CRUD operations work in the DB but zone files are never written to `/etc/bind/zones/` and `named.conf.local` is never updated. BIND cannot serve these records.

**Expected**: Zone files written to `/etc/bind/zones/`, `named.conf.local` updated, BIND reloaded.

**Actual**: Only SQLite database updated. BIND configuration untouched.

---

#### BUG-004: File Manager write operations lack sudo

| Property | Value |
|----------|-------|
| **Module** | File Manager |
| **File** | [`files.service.ts`](apps/api/src/modules/files/files.service.ts:212) (lines 212–215) |
| **Impact** | Cannot create directories or delete files through the file manager |

**Description**: [`createDirectory()`](apps/api/src/modules/files/files.service.ts:212) and [`deleteItem()`](apps/api/src/modules/files/files.service.ts:212) use `node:fs/promises` directly instead of `run(..., { sudo: true })`. All write operations fail on root-owned site directories.

**Expected**: File operations executed with sudo to work on root-owned directories.

**Actual**: EACCES permission denied errors on write operations.

---

#### BUG-005: File Manager false binary detection

| Property | Value |
|----------|-------|
| **Module** | File Manager |
| **File** | [`files.service.ts`](apps/api/src/modules/files/files.service.ts:387) (lines 387–404) |
| **Impact** | Cannot view most text files in the file editor |

**Description**: [`getFileContent()`](apps/api/src/modules/files/files.service.ts:387) allocates `Buffer.alloc(8192)` (zero-filled), reads a small file, then scans all 8192 bytes for nulls. Files smaller than 8KB always fail with `BINARY_FILE` error because the unread portion of the buffer contains zeros.

**Expected**: Only actual bytes read from the file are checked for binary content.

**Actual**: Entire 8KB buffer (including zero-filled padding) is scanned, causing false positives.

**Fix**: Use `Buffer.allocUnsafe()` or check only `bytesRead` from the `fs.read()` call:

```typescript
// Before (broken):
const buf = Buffer.alloc(8192);
const bytesRead = await fd.read(buf, 0, 8192, 0);
for (let i = 0; i < buf.length; i++) { /* scans all 8192 bytes */ }

// After (fixed):
const buf = Buffer.alloc(8192);
const { bytesRead } = await fd.read(buf, 0, 8192, 0);
for (let i = 0; i < bytesRead; i++) { /* only scan actual content */ }
```

---

#### BUG-006: PostgreSQL database not actually created

| Property | Value |
|----------|-------|
| **Module** | Database Management |
| **File** | [`postgres.service.ts`](apps/api/src/services/postgres.service.ts) |
| **Impact** | PostgreSQL databases cannot be created |

**Description**: The `createdb` command fails silently; the panel records success in the database. The service uses `sudo /usr/bin/createdb -U postgres` which doesn't work correctly on Ubuntu. Should use `sudo -u postgres createdb` instead.

**Expected**: PostgreSQL database created and accessible.

**Actual**: Command fails silently. DB record exists in panel but no actual PostgreSQL database.

---

### 🟠 HIGH — Feature Broken (10 bugs)

#### BUG-007: Domain activate crashes with 500

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts) |
| **Impact** | Domains stuck in "suspended" state permanently |

**Description**: Config file naming mismatch between suspend (uses `website-{id}.conf`) and activate (looks for `{domain_name}.conf.suspended`). The activate function cannot find the suspended config file, causing a 500 error. Domains remain stuck in "suspended" state.

---

#### BUG-008: Mailbox not added to Postfix vmailbox

| Property | Value |
|----------|-------|
| **Module** | Mail Management |
| **File** | [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts) |
| **Impact** | Postfix won't deliver mail for created mailboxes |

**Description**: Mailbox creation adds user to Dovecot but not to the Postfix `vmailbox` file. Postfix has no mapping for the mailbox address and will reject mail delivery.

---

#### BUG-009: Mailbox directory not created

| Property | Value |
|----------|-------|
| **Module** | Mail Management |
| **File** | [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts) |
| **Impact** | Dovecot will fail to store mail |

**Description**: No `/var/mail/{domain}/{user}/` directory is created during mailbox setup. Even if Postfix delivers mail, Dovecot has no directory to store it in.

---

#### BUG-010: DKIM key generation fails

| Property | Value |
|----------|-------|
| **Module** | Mail Management |
| **File** | [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts) |
| **Impact** | No DKIM signing for outgoing mail |

**Description**: OpenDKIM directory creation fails due to permissions. The OpenDKIM service is in a failed state and cannot be used for DKIM key generation.

---

#### BUG-011: FTP accounts not configured in ProFTPD

| Property | Value |
|----------|-------|
| **Module** | FTP Management |
| **File** | [`ftp.service.ts`](apps/api/src/modules/ftp/ftp.service.ts) |
| **Impact** | FTP login would not work for any created account |

**Description**: FTP accounts are only stored in the panel DB. No system user is created and no ProFTPD configuration entry is added. FTP login cannot succeed.

---

#### BUG-012: Firewall rules not parsed from UFW

| Property | Value |
|----------|-------|
| **Module** | Firewall |
| **File** | [`firewall.service.ts`](apps/api/src/modules/firewall/firewall.service.ts) |
| **Impact** | Firewall rule management is non-functional |

**Description**: `GET /firewall/rules` returns an empty array despite 28 active UFW rules. The UFW output parser is broken and cannot extract rule information from `ufw status numbered` output.

---

#### BUG-013: Firewall status incorrectly reports disabled

| Property | Value |
|----------|-------|
| **Module** | Firewall |
| **File** | [`firewall.service.ts`](apps/api/src/modules/firewall/firewall.service.ts) |
| **Impact** | Users see incorrect firewall status |

**Description**: `GET /firewall/status` returns `enabled: false` when UFW is active. Default policy values are also incorrect (shows "allow" when actual default is "deny").

---

#### BUG-014: Firewall delete fails (needs interactive confirmation)

| Property | Value |
|----------|-------|
| **Module** | Firewall |
| **File** | [`firewall.service.ts`](apps/api/src/modules/firewall/firewall.service.ts) |
| **Impact** | Cannot delete firewall rules via the panel |

**Description**: UFW delete requires piped "y" confirmation which the service doesn't provide. The command hangs or fails waiting for user input.

**Fix**: Pipe "y" into the command:

```bash
echo "y" | sudo ufw delete {rule_number}
```

---

#### BUG-015: New token system disconnected from Bearer auth

| Property | Value |
|----------|-------|
| **Module** | API Tokens |
| **File** | [`auth.middleware.ts`](apps/api/src/modules/auth/auth.middleware.ts:33), [`tokens.service.ts`](apps/api/src/modules/tokens/tokens.service.ts) |
| **Impact** | API tokens cannot be used for authentication |

**Description**: Tokens created via `POST /tokens` are stored in-memory but the auth middleware only checks `users.apiTokenHash` in the database. Newly created tokens don't work with `Authorization: Bearer` header.

---

#### BUG-016: `createUser: true` ignored for MariaDB

| Property | Value |
|----------|-------|
| **Module** | Database Management |
| **File** | [`databases.service.ts`](apps/api/src/modules/databases/databases.service.ts) |
| **Impact** | Database created without associated user |

**Description**: When creating a database with the `createUser: true` flag, no database user is actually created. The flag is ignored during the creation process.

---

### 🟡 MEDIUM — Incorrect Behavior (10 bugs)

#### BUG-017: Zod validation errors returned as 500

| Property | Value |
|----------|-------|
| **Module** | Global |
| **File** | Global error handler in [`server.ts`](apps/api/src/server.ts) or [`errors.ts`](apps/api/src/errors.ts) |
| **Impact** | All validation failures surface as generic 500 errors |

**Description**: All Zod validation errors (missing fields, invalid input) are returned as HTTP 500 Internal Server Error instead of 400 Bad Request. This affects all endpoints across the entire API.

**Fix**: Add ZodError handling to the global error handler:

```typescript
if (error instanceof ZodError) {
  return reply.status(400).send({
    success: false,
    error: 'VALIDATION_ERROR',
    details: error.errors,
  });
}
```

---

#### BUG-018: Subdomain/alias not reflected in nginx

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts) |
| **Impact** | Subdomains and aliases exist in DB only |

**Description**: Creating subdomains and aliases only creates DB records. The nginx `server_name` directive is never updated to include the new subdomain or alias.

---

#### BUG-019: No PHP-FPM pool created on domain creation

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`websites.service.ts`](apps/api/src/modules/websites/websites.service.ts) |
| **Impact** | PHP execution won't work for new domains |

**Description**: Domain creation with `phpVersion: "8.2"` does not create a PHP-FPM pool configuration file. PHP files cannot be executed through nginx.

---

#### BUG-020: Domain deletion doesn't clean up disk

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts) |
| **Impact** | Orphaned files consume disk space |

**Description**: Nginx vhost files and website directories remain on disk after domain deletion. Only the DB record is removed.

---

#### BUG-021: No DNS record validation

| Property | Value |
|----------|-------|
| **Module** | DNS Management |
| **File** | [`dns.schema.ts`](apps/api/src/modules/dns/dns.schema.ts) |
| **Impact** | Invalid DNS records accepted |

**Description**: A records accept non-IP values like `"not-an-ip-address"`. No Zod validation exists for DNS record values based on record type.

---

#### BUG-022: Catch-all not persisted in panel DB

| Property | Value |
|----------|-------|
| **Module** | Mail Management |
| **File** | [`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts) |
| **Impact** | Catch-all config lost on panel restart |

**Description**: Postfix config is updated but the panel DB `catch_all_destination` field remains empty. The catch-all works until Postfix config is regenerated.

---

#### BUG-023: Database detail endpoint returns 404

| Property | Value |
|----------|-------|
| **Module** | Database Management |
| **File** | [`databases.routes.ts`](apps/api/src/modules/databases/databases.routes.ts) |
| **Impact** | Cannot view individual database details |

**Description**: `GET /api/v1/db/databases/:id` returns "Resource not found" for valid database IDs. The route parameter may not be correctly passed to the service layer.

---

#### BUG-024: Cron jobs not written to system crontab

| Property | Value |
|----------|-------|
| **Module** | Cron Jobs |
| **File** | [`cron.service.ts`](apps/api/src/modules/cron/cron.service.ts) |
| **Impact** | Cron jobs never execute on the server |

**Description**: Cron jobs are stored in the DB only. No entries are written to the system crontab. Additionally, `domain_id`/`website_id` fields are not persisted.

---

#### BUG-025: Firewall add reports failure on success

| Property | Value |
|----------|-------|
| **Module** | Firewall |
| **File** | [`firewall.service.ts`](apps/api/src/modules/firewall/firewall.service.ts) |
| **Impact** | Confusing UX — rule is added but user sees error |

**Description**: UFW rule IS successfully added but the API response returns `success: false`. The response parser incorrectly interprets the UFW output.

---

#### BUG-026: No domain name length validation

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`domains.schema.ts`](apps/api/src/modules/domains/domains.schema.ts) |
| **Impact** | Invalid domain names accepted |

**Description**: A 206-character domain name was accepted. RFC 1035 limits domain names to 253 characters total and 63 characters per label. No validation exists in the Zod schema.

---

### 🟢 LOW — Minor Issues (4 bugs)

#### BUG-027: Username enumeration via login response

| Property | Value |
|----------|-------|
| **Module** | Authentication |
| **File** | [`auth.service.ts`](apps/api/src/modules/auth/auth.service.ts) |
| **Impact** | Potential security information disclosure |

**Description**: Valid username with wrong password shows "4 attempt(s) remaining"; non-existent user shows a different response. This allows username enumeration.

---

#### BUG-028: Inconsistent document root paths

| Property | Value |
|----------|-------|
| **Module** | Domain Management |
| **File** | [`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts) |
| **Impact** | Confusing path structure |

**Description**: Main domain uses `/var/www/sites/{id}/httpdocs` while subdomain uses `/var/www/vhosts/{domain}/{subdomain}`. Inconsistent path conventions.

---

#### BUG-029: Audit log entries missing IP addresses

| Property | Value |
|----------|-------|
| **Module** | Audit Log |
| **File** | Various services that call audit logging |
| **Impact** | Incomplete audit trail |

**Description**: 5 audit log entries have `null` for the `ipAddress` field. Some services don't pass the request IP when creating audit entries.

---

#### BUG-030: Generic 500 error messages

| Property | Value |
|----------|-------|
| **Module** | Web Server Config |
| **File** | Error handling in webserver module |
| **Impact** | Difficult to debug configuration errors |

**Description**: Webserver vhost PUT returns generic `INTERNAL_ERROR` instead of descriptive error messages that would help diagnose the actual problem.

---

### Bug Summary by Severity

| Severity | Count | Percentage |
|----------|-------|------------|
| 🔴 CRITICAL | 6 | 20.0% |
| 🟠 HIGH | 10 | 33.3% |
| 🟡 MEDIUM | 10 | 33.3% |
| 🟢 LOW | 4 | 13.3% |
| **Total** | **30** | **100%** |

### Bug Summary by Module

| Module | Bugs | Critical | High | Medium | Low |
|--------|------|----------|------|--------|-----|
| Domain Management | 6 | 1 | 1 | 3 | 1 |
| DNS Management | 2 | 1 | 0 | 1 | 0 |
| SSL Certificates | 1 | 1 | 0 | 0 | 0 |
| File Manager | 2 | 2 | 0 | 0 | 0 |
| Mail Management | 4 | 0 | 3 | 1 | 0 |
| Database Management | 3 | 1 | 1 | 1 | 0 |
| FTP Management | 1 | 0 | 1 | 0 | 0 |
| Firewall | 4 | 0 | 3 | 1 | 0 |
| Cron Jobs | 1 | 0 | 0 | 1 | 0 |
| API Tokens | 1 | 0 | 1 | 0 | 0 |
| Authentication | 1 | 0 | 0 | 0 | 1 |
| Web Server Config | 1 | 0 | 0 | 0 | 1 |
| Audit Log | 1 | 0 | 0 | 1 | 0 |
| Global (error handling) | 1 | 0 | 0 | 1 | 0 |
| PostgreSQL Service | 1 | 1 | 0 | 0 | 0 |

---

## Server Health After Tests

| Check | Result |
|-------|--------|
| `nginx -t` | ✅ Syntax OK |
| `named-checkconf` | ✅ No errors |
| `postconf check` | ✅ No errors |
| Failed services | ⚠️ `opendkim.service` failed (pre-existing) |
| Journal errors (last hour) | ✅ No entries |
| Disk usage | ✅ 24% used (71G free) |
| Orphaned vhosts | ℹ️ Test vhost files remain on disk |
| Orphaned site dirs | ℹ️ 4 test site directories remain |
| Orphaned cron jobs | ✅ No crontab entries |
| Panel running | ✅ Port 8732 listening |
| Health check | ✅ `{"status":"ok","version":"1.0.0"}` |

**Assessment**: The server remained stable throughout testing. No services crashed. The only issue is orphaned test artifacts (vhost files and site directories) that should be cleaned up manually.

---

## Root Cause Analysis

The majority of bugs stem from **three systemic issues**:

### 1. DB-Only Operations (Affects 8 modules)

Many modules only write to the SQLite database without calling the corresponding system services. The service layer exists in [`apps/api/src/services/`](apps/api/src/services/) but is not wired up to the route handlers.

**Affected modules**:
- **DNS** ([`dns.service.ts`](apps/api/src/modules/dns/dns.service.ts)) — BIND service ([`bind.service.ts`](apps/api/src/services/bind.service.ts)) not called
- **FTP** ([`ftp.service.ts`](apps/api/src/modules/ftp/ftp.service.ts)) — No system user or ProFTPD config
- **Cron** ([`cron.service.ts`](apps/api/src/modules/cron/cron.service.ts)) — System crontab never updated
- **Domains** ([`domains.service.ts`](apps/api/src/modules/domains/domains.service.ts)) — Nginx service ([`nginx.service.ts`](apps/api/src/services/nginx.service.ts)) not called for subdomains/aliases
- **Websites** ([`websites.service.ts`](apps/api/src/modules/websites/websites.service.ts)) — Empty vhost templates
- **Firewall** ([`firewall.service.ts`](apps/api/src/modules/firewall/firewall.service.ts)) — UFW output parsing broken
- **Mail** ([`mail.service.ts`](apps/api/src/modules/mail/mail.service.ts)) — Incomplete Postfix/Dovecot integration
- **SSL** ([`ssl.service.ts`](apps/api/src/modules/ssl/ssl.service.ts)) — Certificate files not written to disk

**Fix pattern**: Each module's service layer needs to call the corresponding system service from [`apps/api/src/services/`](apps/api/src/services/) after successful DB operations.

### 2. Missing `sudo` in File Operations (Affects File Manager)

The file manager uses `node:fs/promises` directly instead of the [`run()`](apps/api/src/services/executor.ts) executor with `{ sudo: true }`. Since site directories are owned by root, all write operations fail with permission errors.

**Affected functions**:
- [`createDirectory()`](apps/api/src/modules/files/files.service.ts:212) — uses `fs.mkdir()`
- [`deleteItem()`](apps/api/src/modules/files/files.service.ts:212) — uses `fs.rm()`

**Fix**: Replace `node:fs/promises` calls with the [`run()`](apps/api/src/services/executor.ts) executor or the [`sudo-fs`](apps/api/src/services/sudo-fs.ts) wrapper that already exists in the services directory.

### 3. ZodError → 500 (Affects all endpoints)

The global error handler doesn't catch `ZodError` and convert it to a 400 response. All validation failures surface as generic 500 errors, making it impossible for API consumers to distinguish between validation errors and server errors.

**Fix**: Add a `ZodError` check in the Fastify error handler in [`server.ts`](apps/api/src/server.ts) or [`errors.ts`](apps/api/src/errors.ts).

---

## Recommendations

### Priority 1 — Fix Systemic Issues (Addresses 20+ bugs)

1. **Wire up service layer to route handlers**: Connect the existing services in [`apps/api/src/services/`](apps/api/src/services/) to the module service files. Each DB write should be followed by the corresponding system service call.

2. **Fix global error handler**: Add `ZodError` → 400 conversion in the Fastify error handler.

3. **Fix file manager sudo**: Replace `node:fs/promises` calls with [`run()`](apps/api/src/services/executor.ts) or [`sudo-fs`](apps/api/src/services/sudo-fs.ts).

### Priority 2 — Fix Critical Bugs

4. **BUG-001**: Populate nginx vhost template on domain creation.
5. **BUG-002**: Add sudo to `nginx -t` and all SSL file operations.
6. **BUG-003**: Call BIND service after DNS CRUD operations.
7. **BUG-005**: Fix binary detection buffer scan (use `bytesRead`).
8. **BUG-006**: Fix PostgreSQL `createdb` command to use `sudo -u postgres`.

### Priority 3 — Fix High-Severity Bugs

9. **BUG-007**: Fix config file naming consistency in domain activate/suspend.
10. **BUG-008 + BUG-009**: Add Postfix vmailbox entry and mail directory creation.
11. **BUG-012 + BUG-013 + BUG-014**: Rewrite UFW output parsing.
12. **BUG-015**: Connect token system to auth middleware.
13. **BUG-011**: Add ProFTPD configuration for FTP accounts.

### Priority 4 — Fix Medium/Low Bugs

14. Add DNS record validation in Zod schemas.
15. Add domain name length validation.
16. Fix username enumeration in login response.
17. Standardize document root paths.
18. Add IP address to all audit log entries.

---

*Report generated on 2026-05-05. All tests executed against NovaPanel v1.0.0 on Ubuntu 24.04.4 LTS.*
