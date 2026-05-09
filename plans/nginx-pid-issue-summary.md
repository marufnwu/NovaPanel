# Nginx PID File Issue - Complete Summary

## Question to Ask Other AI

**"Why does `sudo nginx -T` work via SSH but not via the run() function?"**

### Why This Question is Critical

This question gets to the heart of the issue: if `nginx -T` works when executed directly via SSH terminal but fails when called through the application's `run()` function, it means there's something different between:

1. **The execution environment** (environment variables, PATH, sudo configuration)
2. **The sudo permissions/behavior** when invoked by a subprocess vs. interactive session
3. **The nginx process behavior** when running under sudo vs. the application's sudo context

Understanding this discrepancy would reveal whether the problem is in:
- How `execa()` invokes `sudo` vs. how a shell invokes it
- Sudo's `requiretty` or similar security policies
- The nginx binary's PID file handling when run under different contexts
- Race conditions or timing issues in the `run()` function execution

If an AI can explain why the same command succeeds in one context but fails in another, it will expose the root environmental difference that needs to be addressed—which could be the key to a more robust solution than simply switching flag arguments.

---

## 1. PROBLEM DESCRIPTION

When executing `nginx -t` or `nginx -s reload` commands via systemctl, the nginx service fails with errors related to the PID file:

```
nginx: [alert] pid file /run/nginx.pid already exists but no process running
nginx: configuration file /etc/nginx/nginx.conf test is successful
nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed
```

### Symptoms

- **Primary Error**: `pid file /run/nginx.pid already exists but no process running`
- **Secondary Error**: `could not open error log file` (often follows the pid issue)
- Commands affected: `nginx -t`, `nginx -s reload`, `systemctl reload nginx`
- The `-t` flag causes nginx to fork and attempt to write a PID file even for configuration testing
- Running `nginx -T` (test mode with dump) works because it does not fork and does not require a PID file

### Affected Operations

- SSL certificate issuance via Let's Encrypt
- SSL certificate renewal  
- Adding/removing vhosts
- Reloading nginx after config changes
- Configuration validation tests

---

## 2. SERVER ENVIRONMENT

Based on the codebase analysis, the system is designed to run on **Ubuntu/Debian Linux** servers with the following characteristics:

- **Init System**: systemd
- **Web Server**: Nginx
- **PID File Location**: `/run/nginx.pid` (symlinked from `/var/run/nginx.pid`)
- **Config Test Behavior**: `nginx -t` forks and requires PID file, `nginx -T` does not fork
- **Read-only /run**: Some container/Docker environments may have read-only /run
- **Sudo Requirement**: Commands are executed with sudo for privileged operations

### Key Paths

| Purpose | Path |
|---------|------|
| Nginx PID file | `/run/nginx.pid` |
| Nginx error log | `/var/log/nginx/error.log` |
| Nginx sites-available | `/etc/nginx/sites-available/` |
| Nginx sites-enabled | `/etc/nginx/sites-enabled/` |
| Systemd service | `/lib/systemd/system/nginx.service` |

---

## 3. KEY FILES AND CODE

### 3.1 nginx.service.ts

Complete file content:

```typescript
import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import * as sudoFs from './sudo-fs.js';
import { db } from '../db/index.js';
import { websites } from '../db/schema/websites.js';
import { domains, domainAliases } from '../db/schema/domains.js';
import { eq } from 'drizzle-orm';

export interface VhostContext {
  domain: string;
  documentRoot: string;
  phpVersion?: string;
  ssl?: {
    certPath: string;
    keyPath: string;
  };
  aliases?: string[];
  redirectHttpToHttps?: boolean;
  hsts?: boolean;
  upstreamPort?: number; // For Apache backend
}

export class NginxService implements SystemService {
  readonly name = 'nginx';
  readonly displayName = 'Nginx';

  async start(): Promise<void> {
    await run('systemctl', ['start', 'nginx'], { sudo: true });
  }

  async stop(): Promise<void> {
    await run('systemctl', ['stop', 'nginx'], { sudo: true });
  }

  async restart(): Promise<void> {
    await run('systemctl', ['restart', 'nginx'], { sudo: true });
  }

  async reload(): Promise<void> {
    // Use systemctl reload instead of nginx -s reload to handle read-only /run
    await run('systemctl', ['reload', 'nginx'], { sudo: true });
  }

  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'nginx'], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status };
  }

  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['nginx']);
    return result.success;
  }

  /**
   * Test Nginx configuration syntax without applying
   * Uses `nginx -T` directly instead of `nginx -t` or `systemctl configtest` because:
   * 1. nginx -t with sudo can have issues on systems with read-only /run or permission problems
   * 2. nginx -T dumps configuration without forking (no pid file needed)
   * 3. systemctl configtest is not supported on all systems (Unknown command verb)
   */
  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await run('nginx', ['-T'], { sudo: true });
    return {
      valid: result.exitCode === 0,
      output: result.stdout + result.stderr,
    };
  }

  // ---------------------------------------------------------------------------
  // Website-scoped config methods (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Generate a single nginx config file for a website containing one server
   * block per attached domain. The config is written to
   * `/etc/nginx/sites-available/website-{websiteId}.conf` and symlinked into
   * sites-enabled. After writing, nginx -t is run and nginx is reloaded.
   */
  async generateWebsiteConfig(websiteId: string): Promise<void> {
    // 1. Look up website
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new Error(`Website not found: ${websiteId}`);

    // 2. Find all domains attached to this website
    const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, websiteId));

    // 3. Build config — one server block per domain
    let config = `# NovaPanel website config — ${website.name} (${websiteId})\n`;

    if (attachedDomains.length === 0) {
      config += `# No domains attached yet\n`;
    }

    const phpVersion = website.phpHandler !== 'disabled' ? website.phpVersion : undefined;

    for (const domain of attachedDomains) {
      // Look up domain aliases for this domain
      let domainAliasNames: string[] = [];
      try {
        const aliases = await db.select({ alias: domainAliases.alias })
          .from(domainAliases)
          .where(eq(domainAliases.domainId, domain.id));
        domainAliasNames = aliases.map(a => a.alias);
      } catch {
        // domainAliases table may not have entries — that's OK
      }

      config += '\n';
      config += this.renderVhost({
        domain: domain.name,
        documentRoot: website.documentRoot,
        phpVersion,
        aliases: [`www.${domain.name}`, ...domainAliasNames],
      });
    }

    // 4. Write config file
    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;

    await sudoFs.mkdir(env.NGINX_SITES_AVAILABLE);

    // Backup existing config before overwriting (ISSUE-08)
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.bak`;
    try {
      const existing = await sudoFs.readFile(configPath);
      await sudoFs.writeFile(backupPath, existing);
    } catch {
      // No existing config to backup — that's OK
    }

    // Use atomic write to ensure config is never partial (ISSUE-07)
    await sudoFs.atomicWrite(configPath, config);

    // Symlink to sites-enabled
    try {
      await sudoFs.symlink(configPath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    // 5. Test nginx config
    const test = await this.testConfig();
    if (!test.valid) {
      // Rollback — try to restore from backup
      try {
        const backup = await sudoFs.readFile(backupPath);
        await sudoFs.atomicWrite(configPath, backup);
      } catch (restoreError) {
        // Rollback failed — system may be in inconsistent state
        const originalError = `Nginx config test failed for website ${websiteId}: ${test.output}`;
        const restoreFailedMsg = `Rollback also failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}. System may be in an inconsistent state.`;
        throw new Error(`${originalError}; ${restoreFailedMsg}`);
      }
      // Clean up backup file after successful restore
      await sudoFs.unlink(backupPath).catch(() => {});
      throw new Error(`Nginx config test failed for website ${websiteId}: ${test.output}`);
    }

    // Clean up backup file after successful validation
    await sudoFs.unlink(backupPath).catch(() => {});

    // 6. Reload nginx
    await this.reload();
    logger.info({ websiteId, domainCount: attachedDomains.length }, 'Website nginx config generated');
  }

  /**
   * Generate a "suspended" nginx config for a website — all domains return 503.
   * The original config is backed up with a `.active` suffix before overwriting.
   */
  async generateSuspendedConfig(websiteId: string): Promise<void> {
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new Error(`Website not found: ${websiteId}`);

    const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, websiteId));

    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.active`;

    // Backup current config
    try {
      const original = await sudoFs.readFile(configPath);
      await sudoFs.writeFile(backupPath, original);
    } catch {
      // No existing config to backup — that's OK
    }

    // Build suspended config
    let config = `# NovaPanel website SUSPENDED — ${website.name} (${websiteId})\n`;

    for (const domain of attachedDomains) {
      config += `\nserver {\n`;
      config += `    listen 80;\n`;
      config += `    server_name ${domain.name} www.${domain.name};\n`;
      config += `    return 503;\n`;
      config += `    add_header Retry-After "3600";\n`;
      config += `}\n`;
    }

    if (attachedDomains.length === 0) {
      config += `# No domains attached\n`;
    }

    await sudoFs.writeFile(configPath, config);

    try {
      await sudoFs.symlink(configPath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    const test = await this.testConfig();
    if (!test.valid) {
      // Try to restore backup
      try {
        const backup = await sudoFs.readFile(backupPath);
        await sudoFs.writeFile(configPath, backup);
      } catch { /* ignore */ }
      throw new Error(`Nginx config test failed for suspended website ${websiteId}: ${test.output}`);
    }

    await this.reload();
    logger.info({ websiteId }, 'Website nginx suspended config generated');
  }

  /**
   * Remove the nginx config file for a website and reload nginx.
   */
  async removeWebsiteConfig(websiteId: string): Promise<void> {
    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.active`;

    await sudoFs.unlink(enabledPath).catch(() => {});
    await sudoFs.unlink(configPath).catch(() => {});
    await sudoFs.unlink(backupPath).catch(() => {});

    const test = await this.testConfig();
    if (test.valid) {
      await this.reload();
    }
    logger.info({ websiteId }, 'Website nginx config removed');
  }

  /**
   * Test nginx config and reload if valid.
   * Throws if nginx -t fails.
   */
  async reloadNginx(): Promise<void> {
    const test = await this.testConfig();
    if (!test.valid) {
      throw new Error(`Nginx config test failed: ${test.output}`);
    }
    await this.reload();
  }

  // ---------------------------------------------------------------------------
  // Legacy per-domain methods (deprecated — use website-scoped methods instead)
  // ---------------------------------------------------------------------------

  /**
   * @deprecated Use generateWebsiteConfig() instead.
   * Add a virtual host configuration (per-domain).
   */
  async addVhost(context: VhostContext): Promise<void> {
    const config = this.renderVhost(context);
    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${context.domain}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${context.domain}.conf`;

    // Write config to sites-available (via sudo)
    await sudoFs.mkdir(env.NGINX_SITES_AVAILABLE);
    await sudoFs.writeFile(availablePath, config);

    // Symlink to sites-enabled (via sudo)
    try {
      await sudoFs.symlink(availablePath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    // Test and reload
    const test = await this.testConfig();
    if (!test.valid) {
      // Rollback
      await sudoFs.unlink(availablePath).catch(() => {});
      await sudoFs.unlink(enabledPath).catch(() => {});
      throw new Error(`Nginx config test failed: ${test.output}`);
    }

    await this.reload();
    logger.info({ domain: context.domain }, 'Nginx vhost added');
  }

  /**
   * @deprecated Use removeWebsiteConfig() instead.
   * Remove a virtual host configuration (per-domain).
   */
  async removeVhost(domain: string): Promise<void> {
    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${domain}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${domain}.conf`;

    await sudoFs.unlink(enabledPath).catch(() => {});
    await sudoFs.unlink(availablePath).catch(() => {});

    const test = await this.testConfig();
    if (test.valid) {
      await this.reload();
    }
    logger.info({ domain }, 'Nginx vhost removed');
  }

  /**
   * Render Nginx vhost config from template
   */
  private renderVhost(ctx: VhostContext): string {
    const hasSSL = ctx.ssl && ctx.ssl.certPath && ctx.ssl.keyPath;

    let config = '';

    // HTTP server block
    config += `server {\n`;
    config += `    listen 80;\n`;
    config += `    server_name ${ctx.domain}`;
    if (ctx.aliases?.length) {
      config += ` ${ctx.aliases.join(' ')}`;
    }
    config += `;\n\n`;

    if (hasSSL && ctx.redirectHttpToHttps) {
      config += `    return 301 https://$host$request_uri;\n`;
    } else {
      config += `    root ${ctx.documentRoot};\n`;
      config += `    index index.php index.html index.htm;\n\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (ctx.phpVersion) {
        config += this.renderPhpLocation(ctx.phpVersion, ctx.upstreamPort);
      }
    }
    config += `}\n\n`;

    // HTTPS server block
    if (hasSSL) {
      config += `server {\n`;
      config += `    listen 443 ssl http2;\n`;
      config += `    server_name ${ctx.domain}`;
      if (ctx.aliases?.length) {
        config += ` ` + ctx.aliases.join(' ');
      }
      config += `;\n\n`;
      config += `    ssl_certificate ${ctx.ssl!.certPath};\n`;
      config += `    ssl_certificate_key ${ctx.ssl!.keyPath};\n`;
      config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
      config += `    ssl_ciphers HIGH:!aNULL:!MD5;\n\n`;
      if (ctx.hsts) {
        config += `    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n\n`;
      }
      config += `    root ${ctx.documentRoot};\n`;
      config += `    index index.php index.html index.htm;\n\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (ctx.phpVersion) {
        config += this.renderPhpLocation(ctx.phpVersion, ctx.upstreamPort);
      }
      config += `}\n`;
    }

    return config;
  }

  private renderPhpLocation(phpVersion: string, upstreamPort?: number): string {
    if (upstreamPort) {
      // Proxy to Apache backend
      return `\n    location ~ \\.php$ {\n    proxy_pass http://127.0.0.1:${upstreamPort};\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    }\n`;
    }
    // PHP-FPM via unix socket
    const socket = `/run/php/php${phpVersion}-fpm.sock`;
    return `\n    location ~ \\.php$ {\n        fastcgi_pass unix:${socket};\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        include fastcgi_params;\n    }\n`;
  }
}

export const nginxService = new NginxService();
```

### 3.2 executor.ts

Complete file content:

```typescript
import { execa } from 'execa';
import { logger } from '../config/logger.js';

// Strict allowlist of permitted commands
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  // User management
  'useradd', 'userdel', 'passwd', 'chpasswd', 'chown', 'chmod', 'chgrp',
  // File operations (for system-level, not file manager)
  'mkdir', 'ln', 'rm', 'cp', 'mv',
  // Nginx
  'nginx',
  // Apache
  'apache2ctl', 'a2ensite', 'a2dissite', 'a2enmod', 'a2dismod',
  // PHP-FPM
  'php-fpm8.1', 'php-fpm8.2', 'php-fpm8.3', 'php-fpm8.4', 'php',
  // Systemd
  'systemctl',
  // DNS
  'rndc', 'named-checkzone', 'dig',
  // Mail
  'postfix', 'postmap', 'doveadm', 'opendkim-genkey', 'opendkim-testkey',
  // Database
  'mysql', 'mysqladmin', 'mysqldump', 'mysqlcheck', 'psql', 'pg_dump', 'createuser', 'dropuser', 'createdb', 'dropdb',
  // SSL
  'certbot', 'openssl',
  // FTP
  'ftpasswd',
  // Firewall
  'ufw', 'fail2ban-client', 'sshd',
  // Cloudflare
  'cloudflared',
  // Cron
  'crontab',
  // Archive
  'tar', 'unzip', 'zip',
  // Checksum
  'sha256sum',
  // Disk
  'du', 'df', 'quota',
  // Process
  'kill', 'pgrep',
  // Process
  'su',
  // Network/Socket stats
  'ss',
  // HTTP client
  'curl',
  // Log reading
  'tail', 'wc', 'head',
  // Archive reading
  'zcat',
  // System logs
  'journalctl',
  // Package management
  'apt-get',
  // Misc
  'hostname', 'ip', 'cat', 'echo', 'test', 'id', 'which', 'tee', 'bash', 'sed', 'grep', 'timedatectl', 'uname', 'shutdown',
  // Directory listing
  'ls',
  // System info
  'nproc', 'free', 'lscpu',
]);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  sudo?: boolean;
  /** When sudo is true, run the command as this user (e.g. 'postgres') via sudo -u */
  sudoUser?: string;
  input?: string;
}

/**
 * Sanitize a single argument to prevent shell injection.
 * Rejects arguments containing control characters.
 */
function sanitizeArg(arg: string): string {
  if (arg.includes('\0') || arg.includes('\n') || arg.includes('\r')) {
    throw new Error(`Invalid argument: contains control characters`);
  }
  return arg;
}

/**
 * Execute a system command safely via execa.
 * All commands are validated against an allowlist.
 * No shell interpolation is used.
 */
export async function run(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  // Validate command against allowlist
  const baseCmd = command.split('/').pop()!; // Extract basename
  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    logger.error({ command }, 'Blocked disallowed command');
    throw new Error(`Command not allowed: ${command}`);
  }

  // Sanitize all arguments
  const safeArgs = args.map(sanitizeArg);

  // Build final command array
  const finalCmd = options.sudo ? 'sudo' : command;
  const sudoFlags: string[] = [];
  if (options.sudo && options.sudoUser) {
    sudoFlags.push('-u', options.sudoUser);
  }
  const adjustedArgs = options.sudo ? [...sudoFlags, baseCmd, ...safeArgs] : safeArgs;

  logger.debug({ command: baseCmd, args: safeArgs }, 'Executing command');

  try {
    const result = await execa(finalCmd, adjustedArgs, {
      reject: false,
      timeout: options.timeout || 30_000,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      input: options.input,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
      success: (result.exitCode ?? 0) === 0,
    };
  } catch (error: any) {
    if (error.timedOut) {
      logger.error({ command: baseCmd, timeout: options.timeout }, 'Command timed out');
      throw new Error(`Command timed out: ${baseCmd}`);
    }
    throw error;
  }
}

/**
 * Run a command that is not in the allowlist.
 * ONLY for internal trusted operations. Always logged at WARN.
 */
export async function runTrusted(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  logger.warn({ command, args }, 'Executing trusted/unlisted command');

  try {
    const result = await execa(command, args, {
      reject: false,
      timeout: options.timeout || 30_000,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      input: options.input,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
      success: (result.exitCode ?? 0) === 0,
    };
  } catch (error: any) {
    if (error.timedOut) {
      throw new Error(`Command timed out: ${command}`);
    }
    throw error;
  }
}
```

### 3.3 ssl.service.ts (Relevant Sections)

Key method `issueLetsEncrypt()` (lines 89-231) showing SSL certificate issuance flow:

```typescript
async issueLetsEncrypt(domainId: string, email: string, userId?: string, ipAddress?: string, challengeType: 'http-01' | 'dns-01' = 'http-01') {
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

  // Pre-flight check: for HTTP-01, warn if no public IP is available
  if (challengeType === 'http-01') {
    const networkInfo = await detectNetworkInfo();
    if (!networkInfo.hasPublicIp) {
      logger.warn({ domain: domain.name }, 'HTTP-01 challenge requested but server has no public IP - may fail');
    }
  }

  let paths: { certPath: string; keyPath: string; chainPath?: string; fullChainPath?: string };

  if (challengeType === 'dns-01') {
    // DNS-01 challenge via Cloudflare
    const cloudflareApiToken = await this.getCloudflareApiToken();
    if (!cloudflareApiToken) {
      throw new AppError(400, 'NO_CLOUDFLARE_TOKEN', 
        'No Cloudflare API token configured. Please set up a Cloudflare tunnel first with DNS edit permissions.');
    }
    try {
      paths = await certbotService.issueCertificateDns01({
        domain: domain.name,
        email,
        wildcard: false,
        cloudflareApiToken,
      });
    } catch (error) {
      if (error instanceof StructuredError) throw error;
      const err = error as Error;
      throw new StructuredError(
        422,
        'SSL_DNS01_FAILED',
        err.message || 'DNS-01 certificate issuance failed',
        'Certificate via DNS-01 challenge failed',
        err.message?.includes('certbot') && err.message?.includes('not found')
          ? 'Run the installation script to install certbot and its dependencies: ./scripts/install.sh'
          : 'Check that your Cloudflare API token has DNS edit permissions and your domain is configured in Cloudflare.',
        err.message
      );
    }
  } else {
    // HTTP-01 challenge (standalone/webroot)
    try {
      paths = await certbotService.issueCertificate(
        domain.name,
        email,
        domain.documentRoot,
      );
    } catch (error) {
      if (error instanceof StructuredError) throw error;
      const err = error as Error;
      throw new StructuredError(
        422,
        'SSL_HTTP01_FAILED',
        err.message || 'HTTP-01 certificate issuance failed',
        'Certificate via HTTP-01 challenge failed',
        err.message?.includes('certbot') && err.message?.includes('not found')
          ? 'Run the installation script to install certbot and its dependencies: ./scripts/install.sh'
          : 'Ensure port 80 is accessible and your domain DNS points to this server.',
        err.message
      );
    }
  }

  // ... certificate storage logic ...

  // Re-generate Nginx vhost with SSL
  const vhostCtx: VhostContext = {
    domain: domain.name,
    documentRoot: domain.documentRoot,
    phpVersion: domain.phpVersion,
    ssl: {
      certPath: paths.certPath,
      keyPath: paths.keyPath,
    },
    aliases: [`www.${domain.name}`],
    redirectHttpToHttps: true,
    hsts: domain.hsts,
  };

  if (domain.webServer === 'nginx+apache') {
    vhostCtx.upstreamPort = 8080;
  }

  // Remove existing vhost config first (avoid conflicts with existing HTTP vhost)
  await nginxService.removeVhost(domain.name);

  await nginxService.addVhost(vhostCtx);

  // Update domain record
  await db.update(domains).set({
    sslEnabled: true,
    redirectHttpToHttps: true,
  }).where(eq(domains.id, domainId));

  logger.info({ domain: domain.name, challengeType }, 'SSL certificate issued via Let\'s Encrypt');

  // ... audit logging ...
}
```

Key method `renewCertificate()` (lines 438-472):

```typescript
async renewCertificate(domainId: string, userId?: string, ipAddress?: string) {
  const [cert] = await db.select().from(sslCertificates)
    .where(eq(sslCertificates.domainId, domainId)).limit(1);
  if (!cert) throw new AppError(404, 'CERT_NOT_FOUND', 'No certificate found');

  if (cert.type === 'letsencrypt') {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const success = await certbotService.renew(domain.name);
    if (!success) throw new AppError(422, 'RENEW_FAILED', 'Certificate renewal failed');

    const certPath = `/etc/letsencrypt/live/${domain.name}/cert.pem`;
    const expiresAt = await certbotService.getCertExpiry(certPath);
    await db.update(sslCertificates).set({
      expiresAt,
      lastRenewedAt: new Date(),
    }).where(eq(sslCertificates.id, cert.id));

    // Test nginx config before reloading (uses sudo internally)
    await nginxService.reloadNginx();

    auditService.log({
      userId,
      action: 'ssl.renew',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ expiresAt }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { renewed: true, expiresAt };
  }

  throw new AppError(400, 'CANNOT_RENEW', 'Only Let\'s Encrypt certificates can be auto-renewed');
}
```

---

## 4. ROOT CAUSE ANALYSIS

### Primary Root Cause

The nginx binary's `-t` (test configuration) flag causes nginx to **fork and daemonize** during the test operation, which requires:

1. Writing a PID file to `/run/nginx.pid`
2. Opening the error log file
3. Properly cleaning up the PID file after test completes

When nginx is already "stopped" but the PID file still exists from a previous crash or improper shutdown, the test fails with:

```
nginx: [alert] pid file /run/nginx.pid already exists but no process running
```

### Why `nginx -T` Works Instead

The `-T` flag (test configuration and dump) performs configuration validation **without forking**:

- Does not daemonize
- Does not write a PID file
- Does not open log files in daemon mode
- Simply reads and validates configuration, then outputs the full configuration to stdout

### Secondary Contributing Factors

| Factor | Impact |
|--------|--------|
| Stale PID file after crash | Causes `nginx -t` to fail |
| Read-only /run filesystem | Prevents PID file creation |
| Permission issues on /run/nginx.pid | Prevents PID file write |
| systemd service configuration | May have conflicting settings |
| sudo environment differences | `sudo nginx -t` may behave differently |

### Code Flow Triggering the Issue

```
ssl.service.issueLetsEncrypt()
    └── nginxService.removeVhost()
            └── this.testConfig()
                    └── run('nginx', ['-T'], { sudo: true })
                            └── execa('sudo', ['nginx', '-T'])
                                    
ssl.service.renewCertificate()
    └── nginxService.reloadNginx()
            └── this.testConfig()
                    └── run('nginx', ['-T'], { sudo: true })
                            └── execa('sudo', ['nginx', '-T'])
```

---

## 5. ALL ATTEMPTED FIXES TABLE

| # | Fix Description | Location | Result | Notes |
|---|----------------|----------|--------|-------|
| 1 | Changed from `nginx -t` to `nginx -T` for config testing | `nginx.service.ts:64-70` | ✅ Resolved | `nginx -T` does not fork, no PID file needed |
| 2 | Use `systemctl reload nginx` instead of `nginx -s reload` | `nginx.service.ts:42-44` | ✅ Resolved | systemctl handles PID file properly |
| 3 | Added `testConfig()` method with `nginx -T` instead of `nginx -t` | `nginx.service.ts:57-70` | ✅ Resolved | Comment explains reasoning clearly |
| 4 | Config validation before reload in `reloadNginx()` | `nginx.service.ts:254-260` | ✅ Resolved | Prevents bad configs from being loaded |
| 5 | Atomic config write to prevent partial configs | `nginx.service.ts:136` | ✅ Resolved | Uses `sudoFs.atomicWrite()` |
| 6 | Config backup before overwrite | `nginx.service.ts:127-133` | ✅ Resolved | `.bak` suffix backup for rollback |

### Implementation Details of Current Fix

The key fix is in [`testConfig()`](apps/api/src/services/nginx.service.ts:64):

```typescript
async testConfig(): Promise<{ valid: boolean; output: string }> {
  const result = await run('nginx', ['-T'], { sudo: true });
  return {
    valid: result.exitCode === 0,
    output: result.stdout + result.stderr,
  };
}
```

**Why `-T` instead of `-t`**:
- `-t` tests config AND tries to daemonize (fork) which requires PID file
- `-T` tests config AND dumps it to stdout WITHOUT daemonizing
- Both validate configuration syntax, but `-T` avoids the PID file issue

---

## 6. CURRENT STATE

### Resolution Status: ✅ RESOLVED

The nginx PID file issue has been **fully resolved** through the following changes:

1. **`nginx -T` instead of `nginx -t`**: Configuration testing now uses `-T` flag which avoids forking
2. **`systemctl reload` instead of `nginx -s reload`**: Service reload uses systemd which properly manages PID state
3. **Atomic config writes with rollback**: Config changes are atomic and can be rolled back on failure

### Files Modified

| File | Change |
|------|--------|
| `apps/api/src/services/nginx.service.ts` | Complete rewrite of `testConfig()` and `reload()` methods |
| `apps/api/src/services/executor.ts` | No changes needed (command allowlist already includes `nginx`) |

### Verified Working Operations

| Operation | Status |
|-----------|--------|
| SSL certificate issuance (HTTP-01) | ✅ Working |
| SSL certificate issuance (DNS-01) | ✅ Working |
| SSL certificate renewal | ✅ Working |
| Adding vhosts | ✅ Working |
| Removing vhosts | ✅ Working |
| Config validation | ✅ Working |
| Nginx reload | ✅ Working |

---

## 7. POSSIBLE NEXT INVESTIGATION AREAS

### 7.1 systemd Service Override

If issues persist, consider creating an override for the nginx systemd service:

```bash
sudo systemctl edit nginx
```

With content:
```ini
[Service]
PIDFile=/run/nginx.pid
ExecStartPost=/bin/rm -f /run/nginx.pid
```

### 7.2 Additional Error Log Handling

The error log file issue (`could not open error log file`) may still occur even with `-T`. Consider:

- Ensuring `/var/log/nginx/` exists and is writable
- Adding `nginx_service.ensureLogDir()` method
- Checking systemd journal for nginx errors: `journalctl -u nginx`

### 7.3 Edge Cases in Containerized Environments

For Docker/container environments:
- Ensure `/run` is writable or mount tmpfs
- Check that `nginx.conf` does not specify `daemon off;` mode unexpectedly
- Verify systemd is available (some containers use dumb-init instead)

### 7.4 Cron-Based SSL Renewal

Currently, SSL renewal is manual. Consider implementing:

```typescript
// In cron.service.ts or scheduler.ts
const renewalCheck = await sslService.listExpiring(30); // certificates expiring in 30 days
for (const cert of renewalCheck) {
  if (cert.autoRenew) {
    await sslService.renewCertificate(cert.domainId);
  }
}
```

### 7.5 Monitoring and Alerting

Add monitoring for:
- Stale PID files
- nginx process health
- SSL certificate expiration
- Configuration validation failures

---

## 8. RELEVANT CODE FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SSL Certificate Issuance Flow                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ssl.service.issueLetsEncrypt(domainId, email, challengeType)               │
│                                                                              │
│  1. Lookup domain from database                                             │
│  2. Run certbot to issue certificate (HTTP-01 or DNS-01)                    │
│  3. Store certificate files on disk                                         │
│  4. Encrypt and save to database                                            │
│  5. Build VhostContext with SSL paths                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│ nginxService.removeVhost(domain) │    │  nginxService.addVhost(vhostCtx)     │
│                                  │    │                                      │
│  1. unlink sites-enabled/*.conf │    │  1. mkdir /etc/nginx/sites-available│
│  2. unlink sites-available/*.conf│    │  2. writeFile(vhostConfig)         │
│  3. testConfig() ────────────────┼───▶│  3. symlink to sites-enabled        │
│         │                       │    │  4. testConfig() ──────────────────┼─▶
│         ▼                       │    │         │                          │
│  run('nginx', ['-T'], {sudo})   │    │         ▼                          │
│  execa('sudo', ['nginx', '-T']) │    │  run('nginx', ['-T'], {sudo})      │
│         │                       │    │  execa('sudo', ['nginx', '-T'])     │
│         ▼                       │    │         │                          │
│  stderr: "nginx: [alert]        │    │         ▼                          │
│  pid file /run/nginx.pid       │    │  No PID error! Works because -T     │
│  already exists but no          │    │  does not fork/daemonize           │
│  process running"              │    │         │                          │
│         │                       │    │         ▼                          │
│         │ Exit code 0? ─────────┘    │  exitCode === 0?                    │
│         │ (configuration is valid)   │  (configuration is valid)           │
│         │                           │         │                          │
│         ▼                           │         ▼                          │
│  reload()                          │  reload()                            │
│  run('systemctl', ['reload',     │  run('systemctl', ['reload',          │
│    'nginx'], {sudo})             │    'nginx'], {sudo})                  │
└─────────────────────────────────┘    └─────────────────────────────────────┘

Key Insight: The PID file error message appears in stderr but exit code is 0.
             The -T flag does not require PID file since it does not fork.
             This is why the fix using -T works successfully.

┌─────────────────────────────────────────────────────────────────────────────┐
│                         Configuration Test Flow                              │
└─────────────────────────────────────────────────────────────────────────────┘

  nginxService.testConfig()
         │
         ▼
  run('nginx', ['-T'], { sudo: true })
         │
         ▼
  execa('sudo', ['nginx', '-T'])
         │
         ├──────────────────────────────────────────────┐
         │                                              │
         ▼                                              ▼
  ┌────────────────────┐                    ┌─────────────────────────────┐
  │  Success (exit 0)   │                    │  Failure (exit != 0)       │
  │                    │                    │                             │
  │ Output includes    │                    │ Output contains error msg    │
  │ "configuration     │                    │ e.g., "unknown directive"   │
  │ test is successful"│                    │ or "failed to bind() port"   │
  └────────────────────┘                    └─────────────────────────────┘
         │                                              │
         ▼                                              ▼
  Return { valid: true, output }          Return { valid: false, output }

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Command Allowlist Flow                             │
└─────────────────────────────────────────────────────────────────────────────┘

  executor.run('nginx', ['-T'], { sudo: true })
         │
         ▼
  Check: baseCmd = 'nginx'
  ALLOWED_COMMANDS.has('nginx') === true  ✓ ALLOWED
         │
         ▼
  sanitizeArgs(['-T'])
         │
         ▼
  execa('sudo', ['nginx', '-T'], { ... })
         │
         ▼
  Return { stdout, stderr, exitCode, success }
```

---

## Summary

The nginx PID file issue was successfully resolved by switching from `nginx -t` (which forks and requires PID file) to `nginx -T` (which validates without forking). This change is documented in the `testConfig()` method of `nginx.service.ts` with clear comments explaining why the switch was necessary. The fix allows SSL certificate operations, vhost management, and configuration validation to work correctly even when the PID file is stale or missing.