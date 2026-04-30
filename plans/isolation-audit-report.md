# NovaPanel — Panel vs User Website Isolation Audit Report

**Date:** 2026-04-30  
**Scope:** Comprehensive isolation audit of NovaPanel codebase  
**Method:** Source code review of all service-layer files, configuration templates, Docker setup, and production installer  

---

## 1. System Architecture Summary

### How the Panel Runs

| Aspect | Docker | Production (install.sh) |
|--------|--------|------------------------|
| Panel API process | Node.js on port 3000, user `novapanel` via supervisord | Node.js on port 3000, user `novapanel` via systemd |
| Panel frontend | Served by Fastify static plugin from `apps/web/dist` | Same — built into the API server |
| Panel DB | SQLite at `/var/lib/novapanel/novapanel.db` | Same |
| Process manager | supervisord | systemd |

### How the Panel is Accessed

```
Client → Nginx (port 80/443) → Panel API (port 3000 internal)
                              → Apache (port 8080) for .htaccess sites
```

The panel's Nginx config ([`docker/nginx-default.conf`](docker/nginx-default.conf) / [`install.sh` line 618](scripts/install.sh:618)) is a `default_server` catch-all block that proxies `/api/`, `/ws/`, and `/` to `panel_api` upstream at `127.0.0.1:3000`.

### How User Websites Run

| Aspect | Detail |
|--------|--------|
| Website files | `/var/www/sites/{websiteId}/httpdocs` |
| System user | `sf_{websiteId}` — system user, shell `/usr/sbin/nologin` |
| Nginx config | `/etc/nginx/sites-available/website-{websiteId}.conf` → symlinked to `sites-enabled` |
| PHP-FPM pool | `/etc/php/{version}/fpm/pool.d/website-{websiteId}.conf` |
| PHP-FPM socket | `/run/php/php{version}-fpm-website-{websiteId}.sock` |
| Ownership | `sf_{websiteId}:www-data`, chmod 755 on documentRoot |

### Shared Services (Panel + User Websites)

- **Nginx** — single instance serves both panel proxy and user vhosts
- **PHP-FPM** — separate pools per website, but shared master process per version
- **MariaDB** — shared instance, panel uses SQLite but user DBs are here
- **Redis** — used by panel only, but runs on the same OS

---

## 2. Isolation Issues Found

### ISSUE-01: Custom Nginx Directives Bypass Config Validation

| Field | Value |
|-------|-------|
| **ID** | ISSUE-01 |
| **Concern** | A — Web Server Configuration Isolation |
| **Severity** | 🔴 CRITICAL |
| **File** | [`apps/api/src/modules/webserver/webserver.service.ts:136-139`](apps/api/src/modules/webserver/webserver.service.ts:136) |

**What was found:**  
In [`updateConfig()`](apps/api/src/modules/webserver/webserver.service.ts:103), after the standard vhost is written and validated with `nginx -t`, custom Nginx directives are appended via:

```typescript
await run('bash', ['-c', `echo '${data.customNginxDirectives.replace(/'/g, "'\\''")}' >> ${configPath}`], { sudo: true });
```

This has two problems:

1. **No `nginx -t` after appending** — the custom directives are injected AFTER validation passes, so a syntax error in user-provided directives will corrupt the config file. The next Nginx reload (from any website change) will fail.

2. **Shell injection risk** — `bash -c` is used with string-interpolated `configPath` (derived from `domain.name`) and user input. While single quotes are escaped, `bash -c` with interpolated strings is inherently fragile. The `configPath` variable is not sanitized.

**Risk:** Admin injects custom directives with a syntax error → config file is corrupted → next Nginx reload fails → **all websites AND the panel become inaccessible** (because the panel is served through the same Nginx).

**Blast radius:** Complete panel + all websites outage until the bad config file is manually removed from the server.

**Blast likelihood:** Medium — requires admin to enter invalid Nginx syntax, but the UI exposes this field without validation.

**Fix must achieve:** Custom directives must be validated with `nginx -t` before being committed. The injection mechanism must not use `bash -c` with interpolated user input.

---

### ISSUE-02: Panel Has No Independent Access Path

| Field | Value |
|-------|-------|
| **ID** | ISSUE-02 |
| **Concern** | G — Panel Accessibility Independence |
| **Severity** | 🔴 CRITICAL |
| **Files** | [`docker/nginx-default.conf`](docker/nginx-default.conf), [`scripts/install.sh:618-671`](scripts/install.sh:618) |

**What was found:**  
All panel traffic (API, WebSocket, frontend) flows through the same Nginx instance that serves user websites. The panel API listens on port 3000 internally, but is never exposed directly — Nginx is the sole entry point.

If Nginx fails to reload/restart due to a broken config (see ISSUE-01, ISSUE-03), the admin loses access to the panel — the very tool they need to diagnose and fix the problem.

**Risk:** A cascading failure where a bad user config breaks Nginx, which breaks the panel, which prevents the admin from fixing Nginx.

**Blast radius:** Complete panel inaccessibility. Admin must SSH into the server and manually fix Nginx config files.

**Blast likelihood:** Low for normal operations, but becomes certain if ISSUE-01 or ISSUE-03 is triggered.

**Fix must achieve:** The panel must remain reachable even when Nginx is down. Options include: a dedicated Nginx config that is never modified by user operations, a separate port for direct panel access, or a health-check endpoint that bypasses Nginx.

---

### ISSUE-03: No Port Conflict Protection for Custom Directives

| Field | Value |
|-------|-------|
| **ID** | ISSUE-03 |
| **Concern** | B — Port Conflict Isolation |
| **Severity** | 🟠 HIGH |
| **File** | [`apps/api/src/modules/webserver/webserver.service.ts:136-139`](apps/api/src/modules/webserver/webserver.service.ts:136) |

**What was found:**  
The standard vhost template in [`renderVhost()`](apps/api/src/services/nginx.service.ts:281) hardcodes `listen 80` and `listen 443`, so normal website creation cannot cause port conflicts. However, the custom Nginx directives feature (ISSUE-01) allows injecting arbitrary config including new `listen` directives.

A user/admin could inject:
```nginx
}
server {
    listen 3000;
    server_name evil.example.com;
    ...
}
```

This would create a server block listening on port 3000 (the panel API port), causing Nginx to fail to bind on reload.

**Risk:** Nginx fails to reload, all websites and panel become inaccessible.

**Blast radius:** Same as ISSUE-02 — complete outage.

**Blast likelihood:** Low — requires intentional or highly malformed custom directives.

**Fix must achieve:** Custom directives must be validated against a denylist of dangerous directives (listen, server_name, upstream, etc.) or parsed to ensure they cannot create new server blocks.

---

### ISSUE-04: PHP-FPM Pool Reload Errors Silently Swallowed

| Field | Value |
|-------|-------|
| **ID** | ISSUE-04 |
| **Concern** | C — PHP-FPM Pool Isolation |
| **Severity** | 🟠 HIGH |
| **File** | [`apps/api/src/services/php-fpm.service.ts:120`](apps/api/src/services/php-fpm.service.ts:120) |

**What was found:**  
In [`generateWebsitePool()`](apps/api/src/services/php-fpm.service.ts:86), after writing the pool config, PHP-FPM is reloaded with:

```typescript
await PhpFpmService.reloadPhpFpm(website.phpVersion).catch(() => {});
```

The `.catch(() => {})` silently swallows ALL errors. If the pool config is malformed (e.g., invalid `open_basedir` path, duplicate pool name), PHP-FPM will fail to reload, and **all pools on that PHP version** will stop processing requests until the bad config is removed and PHP-FPM is manually restarted.

Unlike Nginx (which has `nginx -t` validation), there is no pre-validation of PHP-FPM config before reload.

**Risk:** A malformed pool config for one website can take down PHP processing for ALL websites using the same PHP version.

**Blast radius:** All websites on the affected PHP version return 502 errors. Panel itself is not affected (it uses Node.js, not PHP).

**Blast likelihood:** Medium — any path issue or config typo in pool generation could trigger this.

**Fix must achieve:** Pool config must be validated (e.g., `php-fpm8.2 -t` or equivalent) before reload. Errors must be caught, the bad config removed, and the admin notified — not silently swallowed.

---

### ISSUE-05: No Per-Pool PHP Resource Limits

| Field | Value |
|-------|-------|
| **ID** | ISSUE-05 |
| **Concern** | I — Resource Exhaustion Isolation |
| **Severity** | 🟠 HIGH |
| **File** | [`apps/api/src/services/php-fpm.service.ts:101-114`](apps/api/src/services/php-fpm.service.ts:101) |

**What was found:**  
The PHP-FPM pool template sets `pm.max_children = 5` but does NOT set:

- `php_admin_value[memory_limit]` — a single PHP process can consume all available RAM
- `php_admin_value[max_execution_time]` — a PHP script can run indefinitely
- `php_admin_value[max_input_time]` — no request timeout
- `rlimit_core`, `rlimit_files` — no OS-level resource limits
- `slowlog` / `request_slowlog_timeout` — no monitoring for slow requests

**Risk:** A runaway PHP script in one website's pool can consume all server memory or CPU, starving the panel and all other websites.

**Blast radius:** Server-wide degradation. Panel API (Node.js) may become slow or unresponsive due to memory pressure.

**Blast likelihood:** High — this is a common real-world scenario (WordPress plugin gone rogue, infinite loop, memory leak).

**Fix must achieve:** Each pool must have explicit `memory_limit`, `max_execution_time`, and process-level resource limits. These should be configurable per website with sensible defaults.

---

### ISSUE-06: Shell Injection in File Service getDirectorySize

| Field | Value |
|-------|-------|
| **ID** | ISSUE-06 |
| **Concern** | D — System User and File System Isolation |
| **Severity** | 🟠 HIGH |
| **File** | [`apps/api/src/modules/files/files.service.ts:526`](apps/api/src/modules/files/files.service.ts:526) |

**What was found:**  
[`getDirectorySize()`](apps/api/src/modules/files/files.service.ts:523) uses Node.js `execAsync` (not the safe `run()` executor) with shell interpolation:

```typescript
const { stdout } = await execAsync(`du -sb "${targetPath}"`, { maxBuffer: 1024 * 1024 * 10 });
```

While `targetPath` comes from `safePath()` which prevents path traversal, the path is placed inside double quotes in a shell command. A path containing shell metacharacters (`$`, `` ` ``, `!`, etc.) could break out of the quotes.

Similarly, [`getFileOwnership()`](apps/api/src/modules/files/files.service.ts:551) uses:
```typescript
const { stdout: userOutput } = await execAsync(`getent passwd ${stats.uid}`);
```
Though `stats.uid` is a number, this pattern of using `execAsync` with string interpolation bypasses the command allowlist in [`executor.ts`](apps/api/src/services/executor.ts).

**Risk:** Path with shell metacharacters could execute arbitrary commands as the panel user (`novapanel`).

**Blast radius:** Full system compromise if the panel user has sudo access (which it does for file operations).

**Blast likelihood:** Low — requires a specifically crafted directory name, but the file manager allows creating directories with arbitrary names.

**Fix must achieve:** All command execution must go through the `run()` executor in [`executor.ts`](apps/api/src/services/executor.ts) which uses `execa` without shell interpolation. Never use `execAsync` with string interpolation.

---

### ISSUE-07: Config File Writes Are Not Atomic

| Field | Value |
|-------|-------|
| **ID** | ISSUE-07 |
| **Concern** | J — Config File Write Safety |
| **Severity** | 🟡 MEDIUM |
| **File** | [`apps/api/src/services/sudo-fs.ts:15-25`](apps/api/src/services/sudo-fs.ts:15) |

**What was found:**  
[`writeFile()`](apps/api/src/services/sudo-fs.ts:15) uses `tee` to write config files:

```typescript
const result = await run('tee', [path], { sudo: true, input: content });
```

This is NOT atomic. If the panel process crashes or is interrupted mid-write, the config file will be partially written. For Nginx configs, this could mean a broken config that prevents Nginx from starting.

There is also no file-level locking. If two website operations run concurrently (e.g., creating two websites simultaneously), their config writes could interleave.

**Risk:** Interrupted write leaves a corrupted Nginx or PHP-FPM config, preventing service from starting.

**Blast radius:** Service outage for the affected config file's scope (one website for vhost, all websites on a PHP version for pool config).

**Blast likelihood:** Low — requires exact timing of crash during write.

**Fix must achieve:** Config writes must use write-to-temp-then-rename (atomic rename). Concurrent writes to the same config directory must be serialized.

---

### ISSUE-08: No Backup Before Overwriting Existing Nginx Config

| Field | Value |
|-------|-------|
| **ID** | ISSUE-08 |
| **Concern** | F — Nginx/Apache Reload Safety |
| **Severity** | 🟡 MEDIUM |
| **File** | [`apps/api/src/services/nginx.service.ts:108-109`](apps/api/src/services/nginx.service.ts:108) |

**What was found:**  
In [`generateWebsiteConfig()`](apps/api/src/services/nginx.service.ts:77), the new config is written directly over the existing file:

```typescript
await sudoFs.writeFile(configPath, config);
```

Unlike [`generateSuspendedConfig()`](apps/api/src/services/nginx.service.ts:136) which creates a `.active` backup before overwriting, the normal config generation does NOT back up the previous config.

If the new config passes `nginx -t` but has a semantic error (e.g., wrong document root, missing SSL cert path that exists but is wrong), the old working config is permanently lost.

**Risk:** Admin cannot easily revert to the previous working config.

**Blast radius:** One website affected.

**Blast likelihood:** Medium — any config update overwrites without backup.

**Fix must achieve:** Before overwriting, the existing config must be backed up (similar to the suspend flow). A rollback mechanism should be available.

---

### ISSUE-09: No Nginx Config Test in systemctl-wrapper Reload

| Field | Value |
|-------|-------|
| **ID** | ISSUE-09 |
| **Concern** | F — Nginx/Apache Reload Safety |
| **Severity** | 🟡 MEDIUM |
| **File** | [`docker/systemctl-wrapper.sh:144-147`](docker/systemctl-wrapper.sh:144) |

**What was found:**  
In the Docker systemctl wrapper, Nginx reload is implemented as:

```bash
nginx)
    nginx -s reload >/dev/null 2>&1
    ;;
```

This directly sends a reload signal without first testing the config with `nginx -t`. In the production path, `systemctl reload nginx` does test config before reloading (systemd behavior). But in Docker, a broken config will cause Nginx to exit after receiving the reload signal.

Since supervisord has `autorestart=true`, Nginx will restart, but if the config is still broken, it will enter a restart loop.

**Risk:** In Docker, a broken config causes Nginx restart loop, making all websites and panel inaccessible.

**Blast radius:** Complete outage in Docker environment.

**Blast likelihood:** Medium — any config error that bypasses the TypeScript-level `nginx -t` check.

**Fix must achieve:** The systemctl wrapper must run `nginx -t` before `nginx -s reload`, and skip the reload if the test fails.

---

### ISSUE-10: Dovecot Reads Panel SQLite Database Directly

| Field | Value |
|-------|-------|
| **ID** | ISSUE-10 |
| **Concern** | E — Database Isolation |
| **Severity** | 🟡 MEDIUM |
| **File** | [`scripts/install.sh:462-474`](scripts/install.sh:462) |

**What was found:**  
The Dovecot SQL configuration points directly at the panel's SQLite database:

```
connect = /var/lib/novapanel/novapanel.db
password_query = SELECT email as user, password_hash as password FROM users WHERE email = '%u' AND active = 1
```

This means the Dovecot process (running as its own user) needs read access to the panel's entire SQLite database. Any vulnerability in Dovecot's SQL query handling could potentially expose panel data.

Additionally, the `users` table referenced doesn't match the actual schema — the panel uses an `auth` table with different column names. This query will fail at runtime.

**Risk:** Dovecot has read access to the panel DB. A Dovecot vulnerability could leak panel secrets. Also, the query is currently broken.

**Blast radius:** Panel database exposure.

**Blast likelihood:** Low for data exposure (requires Dovecot vulnerability), but high for the broken query (mail auth will fail).

**Fix must achieve:** Dovecot should use a separate authentication database or a dedicated view/table, not the raw panel SQLite DB. The SQL query must be updated to match the actual schema.

---

### ISSUE-11: Panel .env File Contains DB Password in Plaintext

| Field | Value |
|-------|-------|
| **ID** | ISSUE-11 |
| **Concern** | E — Database Isolation |
| **Severity** | 🟡 MEDIUM |
| **File** | [`scripts/install.sh:794-836`](scripts/install.sh:794) |

**What was found:**  
The installer writes all secrets to `${PANEL_HOME}/.env` including `SESSION_SECRET`, `JWT_SECRET`, `SF_ENCRYPTION_KEY`, and `DB_PASSWORD`. The file is owned by `novapanel:novapanel` with `chmod 600`.

However, website PHP processes running as `sf_*` users cannot read this file (correct). The risk is that if the panel user is compromised, all secrets are exposed.

**Risk:** Standard secret management risk. Acceptable for a panel application but worth noting.

**Blast radius:** Full secret compromise if panel user is breached.

**Blast likelihood:** Low.

**Fix must achieve:** Consider using a secrets manager or at minimum ensuring the .env file is not readable by any user other than `novapanel`.

---

### ISSUE-12: No Per-Website Disk Quota Enforcement

| Field | Value |
|-------|-------|
| **ID** | ISSUE-12 |
| **Concern** | I — Resource Exhaustion Isolation |
| **Severity** | 🟡 MEDIUM |
| **File** | [`apps/api/src/db/schema/websites.ts:13`](apps/api/src/db/schema/websites.ts:13) |

**What was found:**  
The `diskUsedMb` field in the websites table is informational only — it is never checked or enforced. There are no OS-level disk quotas set up for website users (`sf_*`). A single website can fill the entire disk, causing the panel DB, logs, and all other websites to fail.

**Risk:** One website fills the disk → panel SQLite DB cannot write → panel crashes → admin cannot fix the problem.

**Blast radius:** Server-wide failure.

**Blast likelihood:** Medium — common scenario for user websites with upload functionality.

**Fix must achieve:** Per-website disk quotas must be enforced at the OS level (e.g., `setquota` for `sf_*` users) or at the application level with periodic checks and suspension.

---

### ISSUE-13: Rollback in generateWebsiteConfig Is Best-Effort

| Field | Value |
|-------|-------|
| **ID** | ISSUE-13 |
| **Concern** | F — Nginx/Apache Reload Safety |
| **Severity** | 🟢 LOW |
| **File** | [`apps/api/src/services/nginx.service.ts:122-124`](apps/api/src/services/nginx.service.ts:122) |

**What was found:**  
When `nginx -t` fails after writing a new config, rollback attempts to unlink both files:

```typescript
await sudoFs.unlink(enabledPath).catch(() => {});
await sudoFs.unlink(configPath).catch(() => {});
```

If either unlink fails (e.g., permission issue, file locked), the broken config remains on disk. The next Nginx restart will pick up the broken config.

**Risk:** Broken config persists, causing future Nginx restarts to fail.

**Blast radius:** All websites and panel inaccessible after next Nginx restart.

**Blast likelihood:** Low — unlink rarely fails.

**Fix must achieve:** Rollback must be verified. If rollback fails, an alert must be raised and the admin notified immediately.

---

### ISSUE-14: No Protection Against Rapid Service Restart Loops

| Field | Value |
|-------|-------|
| **ID** | ISSUE-14 |
| **Concern** | H — Service Control Safety |
| **Severity** | 🟢 LOW |
| **File** | [`apps/api/src/modules/stats/stats.service.ts:148-181`](apps/api/src/modules/stats/stats.service.ts:148) |

**What was found:**  
[`restartService()`](apps/api/src/modules/stats/stats.service.ts:148) has no rate limiting or cooldown. An admin (or automated script) could rapidly restart Nginx or PHP-FPM, causing continuous service interruption.

**Risk:** Repeated restarts cause transient outages for all websites and the panel.

**Blast radius:** Intermittent outage for all services.

**Blast likelihood:** Low — requires intentional or scripted behavior.

**Fix must achieve:** Add rate limiting or cooldown period for service restart operations.

---

## 3. What Is Already Well Isolated

### ✅ Nginx Config Validation Before Reload (Standard Path)

[`generateWebsiteConfig()`](apps/api/src/services/nginx.service.ts:77) implements a proper validate-then-apply pattern:
1. Write config to `sites-available`
2. Symlink to `sites-enabled`
3. Run `nginx -t`
4. If test fails → rollback (unlink both files) → throw error
5. If test passes → reload Nginx

This prevents most config errors from reaching production.

### ✅ Per-Website System Users

Each website gets a unique system user `sf_{websiteId}` with `/usr/sbin/nologin` shell ([`websites.service.ts:126-132`](apps/api/src/modules/websites/websites.service.ts:126)). This prevents:
- SSH login as website user
- Cross-website file access (each user can only read their own files)

### ✅ PHP-FPM Pool Isolation

Each website gets a dedicated PHP-FPM pool ([`php-fpm.service.ts:86-122`](apps/api/src/services/php-fpm.service.ts:86)):
- Separate `[pool]` section
- Per-website Unix socket
- Runs as the website's system user
- `open_basedir` restricted to document root + `/tmp`
- `pm.max_children = 5` limits process count

### ✅ File Manager Path Traversal Protection

[`safePath()`](apps/api/src/modules/files/files.service.ts:39) properly validates that resolved paths stay within the home directory:

```typescript
const resolved = path.resolve(homeDir, relativePath || '.');
if (!resolved.startsWith(homeDir)) {
    throw new AppError(403, 'PATH_TRAVERSAL', 'Access denied: path outside home directory');
}
```

### ✅ Archive Extraction Path Traversal Protection

[`extractArchive()`](apps/api/src/modules/files/files.service.ts:348) checks every entry in an archive for path traversal (Zip Slip attack):

```typescript
for (const entry of entries) {
    const resolvedEntry = path.resolve(extractDir, entry);
    if (!resolvedEntry.startsWith(extractDir)) {
        throw new AppError(400, 'PATH_TRAVERSAL', 'Archive contains paths outside target directory');
    }
}
```

### ✅ Command Execution Allowlist

[`executor.ts`](apps/api/src/services/executor.ts) uses a strict allowlist of permitted commands. All arguments are sanitized for control characters. No shell interpolation is used (execa runs commands directly).

### ✅ Separate Panel User

The panel runs as `novapanel` user, separate from website users (`sf_*`). In production, the systemd service has `ProtectSystem=strict` and `NoNewPrivileges=true` ([`install.sh:888-891`](scripts/install.sh:888)).

### ✅ Config File Naming Prevents Collisions

Website configs use `website-{websiteId}.conf` naming where `websiteId` is a nanoid. This prevents filename collisions between different websites.

### ✅ Supervisord Auto-Restart in Docker

All services in [`supervisord.conf`](docker/supervisord.conf) have `autorestart=true`, providing automatic recovery from crashes.

### ✅ Panel DB Uses SQLite (Not MariaDB)

The panel uses SQLite at `/var/lib/novapanel/novapanel.db` while user databases are in MariaDB/PostgreSQL. This provides inherent isolation — user database operations cannot affect the panel's database.

---

## 4. Things That Could Not Be Verified

### NEEDS VERIFICATION-01: Panel SQLite DB File Permissions

The install script sets `chown -R novapanel:novapanel /var/lib/novapanel`. Need to verify that the actual SQLite file permissions (typically 644 or 640 after creation) prevent `sf_*` users from reading it. If the file is world-readable, any website PHP process could read panel data (though `open_basedir` provides additional protection).

### NEEDS VERIFICATION-02: FTP User Chroot/Jail

The ProFTPD configuration in [`install.sh:502-516`](scripts/install.sh:502) does not explicitly configure chroot. Need to verify whether ProFTPD's `DefaultRoot` directive is set, or if FTP users can navigate outside their home directory.

### NEEDS VERIFICATION-03: Redis Authentication

Redis is configured with `protected-mode yes` and `bind 127.0.0.1` ([`install.sh:528-531`](scripts/install.sh:528)), but no `requirepass` is set. Any local process (including website PHP processes) can connect to Redis. Need to verify if this poses a risk (e.g., can a website flush the panel's session store?).

### NEEDS VERIFICATION-04: Docker Container Runs Privileged

[`docker-compose.yml:98`](docker-compose.yml:98) sets `privileged: true`. This gives the container full access to host devices and kernel capabilities. Need to verify if this is required for all functionality or if capabilities can be restricted.

### NEEDS VERIFICATION-05: Nginx Default Server Block Priority

The panel config uses `listen 80 default_server` and user vhosts use `listen 80` without `default_server`. Need to verify that the panel config is always loaded as the default and cannot be overridden by a user vhost that somehow gets `default_server` set.

---

## 5. The Single Most Important Fix

**Fix ISSUE-01: Custom Nginx Directives Bypass Config Validation**

This is the most critical issue because it combines three failure modes:

1. **No validation** — custom directives are never tested with `nginx -t`
2. **Shell injection** — `bash -c` with interpolated user input
3. **Cascading failure** — broken config takes down the panel along with all websites

The fix must:
1. Replace the `bash -c` injection with a safe write mechanism (use `sudoFs.writeFile` or `sudoFs.appendFile`)
2. Run `nginx -t` AFTER appending custom directives
3. If `nginx -t` fails, revert to the pre-custom-directives config
4. Optionally: validate custom directives against a denylist of dangerous Nginx directives (`listen`, `server_name`, `include`, `upstream`, etc.)

This single fix eliminates the most likely path to a complete panel + website outage.

---

## Appendix: Architecture Diagram

```mermaid
graph TB
    subgraph External
        Client[Browser Client]
    end

    subgraph Nginx Layer
        NginxMain[Nginx - Port 80/443]
        PanelBlock[default_server block<br/>Panel Proxy]
        UserBlock1[server block<br/>website-abc.conf]
        UserBlock2[server block<br/>website-xyz.conf]
    end

    subgraph Panel
        PanelAPI[Node.js API<br/>Port 3000<br/>user: novapanel]
        PanelDB[SQLite DB<br/>/var/lib/novapanel/novapanel.db]
    end

    subgraph PHP-FPM
        FPM82[PHP 8.2 FPM Master]
        Pool1[Pool: website-abc<br/>user: sf_abc<br/>socket: fpm-abc.sock]
        Pool2[Pool: website-xyz<br/>user: sf_xyz<br/>socket: fpm-xyz.sock]
    end

    subgraph Website Files
        Site1[/var/www/sites/abc/httpdocs<br/>owner: sf_abc]
        Site2[/var/www/sites/xyz/httpdocs<br/>owner: sf_xyz]
    end

    Client --> NginxMain
    NginxMain --> PanelBlock
    NginxMain --> UserBlock1
    NginxMain --> UserBlock2
    PanelBlock --> PanelAPI
    PanelAPI --> PanelDB
    UserBlock1 --> Pool1
    UserBlock2 --> Pool2
    Pool1 --> Site1
    Pool2 --> Site2
    FPM82 --> Pool1
    FPM82 --> Pool2

    style PanelAPI fill:#4CAF50,color:#fff
    style PanelDB fill:#4CAF50,color:#fff
    style NginxMain fill:#FF9800,color:#fff
    style FPM82 fill:#FF9800,color:#fff
```

**Shared failure points highlighted in orange:** Nginx and PHP-FPM master processes are shared between panel and user websites. A failure in either affects everything.
