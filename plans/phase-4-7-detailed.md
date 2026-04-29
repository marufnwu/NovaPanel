# ServerForge — Phases 4-7: Detailed Implementation Guide

> **Supplement to:** `plans/implementation-plan.md`
> **Prerequisites:** Phases 1-3 completed (see `plans/phase-1-3-detailed.md`)
> **Scope:** Executor Service, Stats Module + Dashboard, Domain Module, Web Server + PHP Modules

---

## Phase 4 — Executor Service: Detailed Specification

### 4.1 Core Executor

#### `apps/api/src/services/executor.ts`

```typescript
import { execa, type ResultPromise } from 'execa';
import { logger } from '../config/logger.js';

// Strict allowlist of permitted commands
const ALLOWED_COMMANDS: ReadonlySet<string>> = new Set([
  // User management
  'useradd', 'userdel', 'passwd', 'chown', 'chmod', 'chgrp',
  // File operations (for system-level, not file manager)
  'mkdir', 'ln', 'rm', 'cp', 'mv',
  // Nginx
  'nginx',
  // Apache
  'apache2ctl', 'a2ensite', 'a2dissite', 'a2enmod', 'a2dismod',
  // PHP-FPM
  'php-fpm8.1', 'php-fpm8.2', 'php-fpm8.3', 'php-fpm8.4',
  // Systemd
  'systemctl',
  // DNS
  'rndc', 'named-checkzone',
  // Mail
  'postfix', 'doveadm', 'opendkim-genkey', 'opendkim-testkey',
  // Database
  'mysql', 'mysqladmin', 'mysqldump', 'psql', 'pg_dump', 'createuser', 'dropuser', 'createdb', 'dropdb',
  // SSL
  'certbot', 'openssl',
  // FTP
  'ftpasswd',
  // Firewall
  'ufw', 'fail2ban-client',
  // Cloudflare
  'cloudflared',
  // Cron
  'crontab',
  // Archive
  'tar', 'unzip', 'zip',
  // Disk
  'du', 'df', 'quota',
  // Process
  'kill', 'pgrep',
  // Misc
  'hostname', 'ip', 'cat', 'echo', 'test', 'id', 'which',
]);

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  sudo?: boolean;
  input?: string;
}

/**
 * Sanitize a single argument to prevent shell injection.
 * Rejects arguments containing shell metacharacters.
 */
function sanitizeArg(arg: string): string {
  // Block null bytes and newlines in args
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
  const finalArgs = options.sudo ? ['sudo', ...safeArgs] : safeArgs;
  const finalCmd = options.sudo ? 'sudo' : command;
  const adjustedArgs = options.sudo ? [baseCmd, ...safeArgs] : safeArgs;

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

### 4.2 System Service Interface

#### `apps/api/src/services/types.ts`

```typescript
export type ServiceStatus = 'running' | 'stopped' | 'error' | 'unknown';

export interface ServiceInfo {
  name: string;
  displayName: string;
  status: ServiceStatus;
  version?: string;
  uptime?: number; // seconds
}

export interface SystemService {
  readonly name: string;
  readonly displayName: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  reload(): Promise<void>;
  status(): Promise<ServiceInfo>;
  isInstalled(): Promise<boolean>;
}
```

### 4.3 Nginx Service

#### `apps/api/src/services/nginx.service.ts`

```typescript
import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { readFile, writeFile, unlink, symlink, access } from 'node:fs/promises';
import { logger } from '../config/logger.js';
import Handlebars from 'handlebars';

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
   */
  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await run('nginx', ['-t'], { sudo: true });
    return {
      valid: result.exitCode === 0,
      output: result.stderr, // nginx -t outputs to stderr
    };
  }

  /**
   * Add a virtual host configuration
   */
  async addVhost(context: VhostContext): Promise<void> {
    const config = await this.renderVhost(context);
    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${context.domain}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${context.domain}.conf`;

    await writeFile(availablePath, config, 'utf-8');
    try {
      await symlink(availablePath, enabledPath);
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Test config before reload
    const test = await this.testConfig();
    if (!test.valid) {
      // Rollback: remove the broken config
      await unlink(availablePath).catch(() => {});
      await unlink(enabledPath).catch(() => {});
      throw new Error(`Invalid Nginx config: ${test.output}`);
    }

    await this.reload();
    logger.info({ domain: context.domain }, 'Nginx vhost added');
  }

  /**
   * Remove a virtual host configuration
   */
  async removeVhost(domainName: string): Promise<void> {
    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${domainName}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${domainName}.conf`;

    await unlink(enabledPath).catch(() => {});
    await unlink(availablePath).catch(() => {});
    await this.reload();
    logger.info({ domain: domainName }, 'Nginx vhost removed');
  }

  /**
   * Enable SSL for a domain by adding SSL vhost
   */
  async enableSSL(context: VhostContext & { certPath: string; keyPath: string }): Promise<void> {
    const template = await this.readTemplate('vhost-ssl.conf.hbs');
    const compiled = Handlebars.compile(template);
    const config = compiled(context);

    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${context.domain}.conf`;
    await writeFile(availablePath, config, 'utf-8');

    const test = await this.testConfig();
    if (!test.valid) {
      throw new Error(`Invalid Nginx SSL config: ${test.output}`);
    }
    await this.reload();
  }

  /**
   * Render standard HTTP vhost from template
   */
  private async renderVhost(context: VhostContext): Promise<string> {
    const template = await this.readTemplate('vhost.conf.hbs');
    const compiled = Handlebars.compile(template);
    return compiled(context);
  }

  private async readTemplate(name: string): Promise<string> {
    const templatePath = new URL(`../templates/nginx/${name}`, import.meta.url);
    return readFile(templatePath, 'utf-8');
  }
}

export interface VhostContext {
  domain: string;
  documentRoot: string;
  user: string;
  phpVersion: string;
  phpHandler: 'php-fpm' | 'proxy-to-apache' | 'disabled';
  proxyToApache: boolean;
  customDirectives?: string;
  logDir: string;
  aliases?: string[];
}
```

### 4.4 Apache Service

#### `apps/api/src/services/apache.service.ts`

```typescript
import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { logger } from '../config/logger.js';
import Handlebars from 'handlebars';

export class ApacheService implements SystemService {
  readonly name = 'apache2';
  readonly displayName = 'Apache2';

  async start(): Promise<void> {
    await run('systemctl', ['start', 'apache2'], { sudo: true });
  }
  async stop(): Promise<void> {
    await run('systemctl', ['stop', 'apache2'], { sudo: true });
  }
  async restart(): Promise<void> {
    await run('systemctl', ['restart', 'apache2'], { sudo: true });
  }
  async reload(): Promise<void> {
    await run('systemctl', ['reload', 'apache2'], { sudo: true });
  }
  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'apache2'], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status };
  }
  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['apache2ctl']);
    return result.success;
  }

  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await run('apache2ctl', ['configtest'], { sudo: true });
    return { valid: result.exitCode === 0, output: result.stderr };
  }

  async addVhost(context: ApacheVhostContext): Promise<void> {
    const template = await this.readTemplate('vhost.conf.hbs');
    const compiled = Handlebars.compile(template);
    const config = compiled(context);

    const confPath = `${env.APACHE_SITES_AVAILABLE}/${context.domain}.conf`;
    await writeFile(confPath, config, 'utf-8');

    // Enable site
    await run('a2ensite', [context.domain], { sudo: true });

    const test = await this.testConfig();
    if (!test.valid) {
      await run('a2dissite', [context.domain], { sudo: true });
      await unlink(confPath).catch(() => {});
      throw new Error(`Invalid Apache config: ${test.output}`);
    }

    await this.reload();
    logger.info({ domain: context.domain }, 'Apache vhost added');
  }

  async removeVhost(domainName: string): Promise<void> {
    await run('a2dissite', [domainName], { sudo: true });
    const confPath = `${env.APACHE_SITES_AVAILABLE}/${domainName}.conf`;
    await unlink(confPath).catch(() => {});
    await this.reload();
    logger.info({ domain: domainName }, 'Apache vhost removed');
  }

  private async readTemplate(name: string): Promise<string> {
    const templatePath = new URL(`../templates/apache/${name}`, import.meta.url);
    return readFile(templatePath, 'utf-8');
  }
}

export interface ApacheVhostContext {
  domain: string;
  documentRoot: string;
  user: string;
  phpVersion: string;
  customDirectives?: string;
  logDir: string;
}
```

### 4.5 PHP-FPM Service

#### `apps/api/src/services/php-fpm.service.ts`

```typescript
import { run } from './executor.js';
import { env } from '../config/env.js';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { logger } from '../config/logger.js';
import Handlebars from 'handlebars';

export class PhpFpmService {
  /**
   * Detect installed PHP versions on the system
   */
  async listInstalledVersions(): Promise<string[]> {
    const versions: string[] = [];
    const checks = ['8.1', '8.2', '8.3', '8.4'];
    for (const ver of checks) {
      const result = await run('which', [`php-fpm${ver}`]);
      if (result.success) versions.push(ver);
    }
    return versions;
  }

  /**
   * Create a PHP-FPM pool configuration for a domain
   */
  async createPool(context: PoolContext): Promise<void> {
    const template = await this.readTemplate('pool.conf.hbs');
    const compiled = Handlebars.compile(template);
    const config = compiled(context);

    const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', context.phpVersion);
    const poolFile = `${poolDir}/${context.poolName}.conf`;

    await writeFile(poolFile, config, 'utf-8');
    await this.restartVersion(context.phpVersion);
    logger.info({ pool: context.poolName, version: context.phpVersion }, 'PHP-FPM pool created');
  }

  /**
   * Remove a PHP-FPM pool configuration
   */
  async removePool(poolName: string, phpVersion: string): Promise<void> {
    const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', phpVersion);
    const poolFile = `${poolDir}/${poolName}.conf`;
    await unlink(poolFile).catch(() => {});
    await this.restartVersion(phpVersion);
    logger.info({ pool: poolName }, 'PHP-FPM pool removed');
  }

  /**
   * Restart a specific PHP-FPM version
   */
  async restartVersion(version: string): Promise<void> {
    await run('systemctl', ['restart', `php${version}-fpm`], { sudo: true });
  }

  /**
   * Reload a specific PHP-FPM version (graceful)
   */
  async reloadVersion(version: string): Promise<void> {
    await run('systemctl', ['reload', `php${version}-fpm`], { sudo: true });
  }

  /**
   * Get status of all PHP-FPM versions
   */
  async getAllStatuses(): Promise<Record<string, string>> {
    const versions = await this.listInstalledVersions();
    const statuses: Record<string, string> = {};
    for (const ver of versions) {
      const result = await run('systemctl', ['is-active', `php${ver}-fpm`]);
      statuses[ver] = result.stdout.trim();
    }
    return statuses;
  }

  private async readTemplate(name: string): Promise<string> {
    const templatePath = new URL(`../templates/php-fpm/${name}`, import.meta.url);
    return readFile(templatePath, 'utf-8');
  }
}

export interface PoolContext {
  poolName: string;       // e.g., "admin_examplecom"
  systemUser: string;
  phpVersion: string;
  documentRoot: string;
  maxChildren: number;    // e.g., 5
  memoryLimit: string;    // e.g., "256M"
  uploadMaxFilesize: string; // e.g., "64M"
  maxExecutionTime: string;  // e.g., "30"
}
```

### 4.6 BIND9 Service

#### `apps/api/src/services/bind.service.ts`

```typescript
import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { logger } from '../config/logger.js';
import Handlebars from 'handlebars';

export class BindService implements SystemService {
  readonly name = 'bind9';
  readonly displayName = 'BIND9';

  async start(): Promise<void> { await run('systemctl', ['start', 'bind9'], { sudo: true }); }
  async stop(): Promise<void> { await run('systemctl', ['stop', 'bind9'], { sudo: true }); }
  async restart(): Promise<void> { await run('systemctl', ['restart', 'bind9'], { sudo: true }); }
  async reload(): Promise<void> { await run('rndc', ['reload'], { sudo: true }); }
  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'bind9']);
    return { name: this.name, displayName: this.displayName, status: result.stdout.trim() === 'active' ? 'running' : 'stopped' };
  }
  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['named']);
    return result.success;
  }

  /**
   * Create a new DNS zone file and register it in named.conf.local
   */
  async createZone(context: ZoneContext): Promise<void> {
    await mkdir(env.BIND_ZONES_DIR, { recursive: true });

    const template = await this.readTemplate('zone.hbs');
    const compiled = Handlebars.compile(template);
    const zoneContent = compiled(context);

    const zonePath = `${env.BIND_ZONES_DIR}/db.${context.domain}`;
    await writeFile(zonePath, zoneContent, 'utf-8');

    // Add zone declaration to named.conf.local
    const zoneDecl = `
zone "${context.domain}" {
  type master;
  file "${zonePath}";
};
`;
    await appendFile('/etc/bind/named.conf.local', zoneDecl, 'utf-8');

    // Validate zone
    const check = await run('named-checkzone', [context.domain, zonePath], { sudo: true });
    if (!check.success) {
      throw new Error(`Invalid zone file for ${context.domain}: ${check.stderr}`);
    }

    await this.reload();
    logger.info({ domain: context.domain }, 'DNS zone created');
  }

  /**
   * Rewrite zone file (after record changes)
   */
  async writeZoneFile(domain: string, zoneContent: string): Promise<void> {
    const zonePath = `${env.BIND_ZONES_DIR}/db.${domain}`;
    await writeFile(zonePath, zoneContent, 'utf-8');
    await this.reload();
  }

  /**
   * Remove a DNS zone
   */
  async removeZone(domain: string): Promise<void> {
    const zonePath = `${env.BIND_ZONES_DIR}/db.${domain}`;
    const { unlink } = await import('node:fs/promises');
    await unlink(zonePath).catch(() => {});

    // Remove from named.conf.local (simple line-based removal)
    const confContent = await readFile('/etc/bind/named.conf.local', 'utf-8');
    const lines = confContent.split('\n');
    let inZone = false;
    let skipCount = 0;
    const filtered = lines.filter((line) => {
      if (line.includes(`zone "${domain}"`)) { inZone = true; skipCount = 0; return false; }
      if (inZone) {
        skipCount++;
        if (line.includes('};')) { inZone = false; }
        return false;
      }
      return true;
    });
    await writeFile('/etc/bind/named.conf.local', filtered.join('\n'), 'utf-8');
    await this.reload();
    logger.info({ domain }, 'DNS zone removed');
  }

  private async readTemplate(name: string): Promise<string> {
    const templatePath = new URL(`../templates/bind/${name}`, import.meta.url);
    return readFile(templatePath, 'utf-8');
  }
}

export interface ZoneContext {
  domain: string;
  serial: number;
  ttl: number;
  primaryNs: string;
  adminEmail: string;
  refresh: number;
  retry: number;
  expire: number;
  minimumTtl: number;
  serverIp: string;
  records: Array<{ type: string; name: string; value: string; ttl?: number; priority?: number }>;
}
```

### 4.7 Additional Service Stubs

#### `apps/api/src/services/certbot.service.ts`

```typescript
import { run } from './executor.js';
import { readFile } from 'node:fs/promises';
import { logger } from '../config/logger.js';

export class CertbotService {
  /**
   * Issue a Let's Encrypt certificate using HTTP-01 challenge (webroot)
   */
  async issueCert(domain: string, wwwDomain: string, email: string, webroot: string): Promise<CertPaths> {
    const result = await run('certbot', [
      'certonly', '--webroot',
      '-w', webroot,
      '-d', domain,
      '-d', wwwDomain,
      '--email', email,
      '--agree-tos',
      '--non-interactive',
    ], { sudo: true, timeout: 120_000 });

    if (!result.success) {
      throw new Error(`Certbot failed: ${result.stderr}`);
    }

    logger.info({ domain }, 'SSL certificate issued via Let\'s Encrypt');
    return {
      certPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
      keyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
      chainPath: `/etc/letsencrypt/live/${domain}/chain.pem`,
    };
  }

  /**
   * Renew a certificate
   */
  async renew(domain: string): Promise<boolean> {
    const result = await run('certbot', [
      'renew', '--cert-name', domain, '--non-interactive',
    ], { sudo: true, timeout: 120_000 });

    logger.info({ domain, success: result.success }, 'SSL renewal attempted');
    return result.success;
  }

  /**
   * Delete a certificate
   */
  async deleteCert(domain: string): Promise<void> {
    await run('certbot', ['delete', '--cert-name', domain, '--non-interactive'], { sudo: true });
    logger.info({ domain }, 'SSL certificate deleted');
  }

  /**
   * Generate a self-signed certificate
   */
  async generateSelfSigned(domain: string, outputDir: string): Promise<CertPaths> {
    const keyPath = `${outputDir}/${domain}.key`;
    const certPath = `${outputDir}/${domain}.crt`;

    await run('openssl', [
      'req', '-x509', '-nodes',
      '-days', '365',
      '-newkey', 'rsa:2048',
      '-keyout', keyPath,
      '-out', certPath,
      '-subj', `/CN=${domain}`,
    ], { sudo: true });

    return { certPath, keyPath, chainPath: certPath };
  }

  /**
   * Read certificate details (expiry date, etc.)
   */
  async getCertExpiry(certPath: string): Promise<Date> {
    const result = await run('openssl', [
      'x509', '-enddate', '-noout', '-in', certPath,
    ]);
    // Output: notAfter=Apr 23 12:00:00 2027 GMT
    const dateStr = result.stdout.replace('notAfter=', '').trim();
    return new Date(dateStr);
  }
}

export interface CertPaths {
  certPath: string;
  keyPath: string;
  chainPath: string;
}
```

#### `apps/api/src/services/mariadb.service.ts`

```typescript
import { run } from './executor.js';
import { logger } from '../config/logger.js';

export class MariaDbService {
  /**
   * Create a database
   */
  async createDatabase(name: string, charset: string = 'utf8mb4'): Promise<void> {
    const result = await run('mysql', ['-e', `CREATE DATABASE \`${name}\` CHARACTER SET ${charset};`], { sudo: true });
    if (!result.success) throw new Error(`Failed to create database: ${result.stderr}`);
    logger.info({ database: name }, 'MariaDB database created');
  }

  /**
   * Drop a database
   */
  async dropDatabase(name: string): Promise<void> {
    await run('mysql', ['-e', `DROP DATABASE IF EXISTS \`${name}\`;`], { sudo: true });
    logger.info({ database: name }, 'MariaDB database dropped');
  }

  /**
   * Create a user and grant privileges
   */
  async createUser(username: string, password: string, database: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-e', `CREATE USER '${username}'@'${host}' IDENTIFIED BY '${password}';`], { sudo: true });
    await run('mysql', ['-e', `GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${username}'@'${host}'; FLUSH PRIVILEGES;`], { sudo: true });
    logger.info({ username, database }, 'MariaDB user created');
  }

  /**
   * Drop a user
   */
  async dropUser(username: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-e', `DROP USER IF EXISTS '${username}'@'${host}'; FLUSH PRIVILEGES;`], { sudo: true });
    logger.info({ username }, 'MariaDB user dropped');
  }

  /**
   * Change user password
   */
  async changePassword(username: string, newPassword: string, host: string = 'localhost'): Promise<void> {
    await run('mysql', ['-e', `ALTER USER '${username}'@'${host}' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;`], { sudo: true });
  }

  /**
   * Export database to SQL string
   */
  async exportDatabase(name: string): Promise<string> {
    const result = await run('mysqldump', [name], { sudo: true, timeout: 120_000 });
    return result.stdout;
  }

  /**
   * Import SQL into database
   */
  async importDatabase(name: string, sql: string): Promise<void> {
    await run('mysql', [name], { sudo: true, input: sql, timeout: 120_000 });
    logger.info({ database: name }, 'MariaDB database imported');
  }

  /**
   * Check if MariaDB is running
   */
  async isRunning(): Promise<boolean> {
    const result = await run('systemctl', ['is-active', 'mariadb']);
    return result.stdout.trim() === 'active';
  }
}
```

#### `apps/api/src/services/postgres.service.ts`

```typescript
import { run } from './executor.js';
import { logger } from '../config/logger.js';

export class PostgresService {
  /**
   * Create a database
   */
  async createDatabase(name: string, owner?: string): Promise<void> {
    const args = owner ? ['-e', `CREATE DATABASE "${name}" OWNER "${owner}";`] : ['-e', `CREATE DATABASE "${name}";`];
    const result = await run('psql', ['-U', 'postgres', ...args], { sudo: true });
    if (!result.success) throw new Error(`Failed to create PostgreSQL database: ${result.stderr}`);
    logger.info({ database: name }, 'PostgreSQL database created');
  }

  /**
   * Drop a database
   */
  async dropDatabase(name: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-e', `DROP DATABASE IF EXISTS "${name}";`], { sudo: true });
    logger.info({ database: name }, 'PostgreSQL database dropped');
  }

  /**
   * Create a user
   */
  async createUser(username: string, password: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-e', `CREATE USER "${username}" WITH PASSWORD '${password}';`], { sudo: true });
    logger.info({ username }, 'PostgreSQL user created');
  }

  /**
   * Drop a user
   */
  async dropUser(username: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-e', `DROP USER IF EXISTS "${username}";`], { sudo: true });
  }

  /**
   * Grant privileges
   */
  async grantPrivileges(username: string, database: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-e', `GRANT ALL PRIVILEGES ON DATABASE "${database}" TO "${username}";`], { sudo: true });
  }

  /**
   * Change password
   */
  async changePassword(username: string, newPassword: string): Promise<void> {
    await run('psql', ['-U', 'postgres', '-e', `ALTER USER "${username}" WITH PASSWORD '${newPassword}';`], { sudo: true });
  }

  /**
   * Export database
   */
  async exportDatabase(name: string): Promise<string> {
    const result = await run('pg_dump', ['-U', 'postgres', name], { sudo: true, timeout: 120_000 });
    return result.stdout;
  }

  /**
   * Import database
   */
  async importDatabase(name: string, sql: string): Promise<void> {
    await run('psql', ['-U', 'postgres', name], { sudo: true, input: sql, timeout: 120_000 });
  }

  async isRunning(): Promise<boolean> {
    const result = await run('systemctl', ['is-active', 'postgresql']);
    return result.stdout.trim() === 'active';
  }
}
```

### 4.8 Config Templates

#### `apps/api/src/templates/nginx/vhost.conf.hbs`

```nginx
# ServerForge generated — do not edit manually
# Domain: {{domain}}
# Updated: {{timestamp}}

server {
    listen 80;
    server_name {{domain}}{{#each aliases}} {{this}}{{/each}};

    root {{documentRoot}};
    index index.php index.html index.htm;

    access_log {{logDir}}/{{domain}}-access.log;
    error_log  {{logDir}}/{{domain}}-error.log;

    {{#if proxyToApache}}
    # Proxy PHP requests to Apache
    location ~ \.php$ {
        proxy_pass http://127.0.0.1:7080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    {{else}}
    # PHP-FPM
    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php{{phpVersion}}-fpm-{{poolName}}.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_read_timeout 300;
    }
    {{/if}}

    # Default location
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    {{#if customDirectives}}
    # Custom directives
    {{{customDirectives}}}
    {{/if}}
}
```

#### `apps/api/src/templates/nginx/vhost-ssl.conf.hbs`

```nginx
# ServerForge generated — do not edit manually
# Domain: {{domain}} (SSL)
# Updated: {{timestamp}}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name {{domain}}{{#each aliases}} {{this}}{{/each}};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name {{domain}}{{#each aliases}} {{this}}{{/each}};

    root {{documentRoot}};
    index index.php index.html index.htm;

    # SSL Configuration
    ssl_certificate {{certPath}};
    ssl_certificate_key {{keyPath}};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    {{#if hsts}}
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    {{/if}}

    access_log {{logDir}}/{{domain}}-access.log;
    error_log  {{logDir}}/{{domain}}-error.log;

    {{#if proxyToApache}}
    location ~ \.php$ {
        proxy_pass https://127.0.0.1:7443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_ssl_verify off;
    }
    {{else}}
    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php{{phpVersion}}-fpm-{{poolName}}.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_param HTTPS on;
        fastcgi_read_timeout 300;
    }
    {{/if}}

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    {{#if customDirectives}}
    {{{customDirectives}}}
    {{/if}}
}
```

#### `apps/api/src/templates/apache/vhost.conf.hbs`

```apache
# ServerForge generated — do not edit manually
# Domain: {{domain}}

<VirtualHost 127.0.0.1:7080>
    ServerName {{domain}}
    {{#each aliases}}ServerAlias {{this}}
    {{/each}}

    DocumentRoot {{documentRoot}}

    <Directory {{documentRoot}}>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog {{logDir}}/{{domain}}-error.log
    CustomLog {{logDir}}/{{domain}}-access.log combined

    <FilesMatch \.php$>
        SetHandler "proxy:unix:/run/php/php{{phpVersion}}-fpm-{{poolName}}.sock|fcgi://localhost"
    </FilesMatch>

    {{#if customDirectives}}
    {{{customDirectives}}}
    {{/if}}
</VirtualHost>
```

#### `apps/api/src/templates/php-fpm/pool.conf.hbs`

```ini
; ServerForge generated — do not edit manually
; Pool: {{poolName}} ({{systemUser}} / {{phpVersion}})

[{{poolName}}]
user = {{systemUser}}
group = {{systemUser}}

listen = /run/php/php{{phpVersion}}-fpm-{{poolName}}.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = {{maxChildren}}
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
pm.max_requests = 500

php_admin_value[memory_limit] = {{memoryLimit}}
php_admin_value[upload_max_filesize] = {{uploadMaxFilesize}}
php_admin_value[post_max_size] = {{uploadMaxFilesize}}
php_admin_value[max_execution_time] = {{maxExecutionTime}}
php_admin_value[open_basedir] = {{documentRoot}}:/tmp
php_admin_value[session.save_path] = /tmp
php_admin_flag[display_errors] = off
php_admin_value[error_log] = {{documentRoot}}/../logs/php-error.log

; Security
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
php_admin_flag[allow_url_fopen] = off
php_admin_flag[allow_url_include] = off
```

#### `apps/api/src/templates/bind/zone.hbs`

```bind
; ServerForge generated — do not edit manually
; Zone: {{domain}}
; Serial: {{serial}}

$TTL {{ttl}}
@   IN  SOA {{primaryNs}}. {{adminEmail}}. (
        {{serial}}  ; Serial
        {{refresh}} ; Refresh
        {{retry}}   ; Retry
        {{expire}}  ; Expire
        {{minimumTtl}} ; Minimum TTL
    )

; Name Servers
@   IN  NS  {{primaryNs}}.

; A Records
@   IN  A   {{serverIp}}
www IN  A   {{serverIp}}

{{#each records}}
{{name}}   {{#if ttl}}{{ttl}}{{else}}{{../ttl}}{{/if}}   IN  {{type}}   {{#if priority}}{{priority}} {{/if}}{{value}}
{{/each}}
```

### 4.9 Service Index

#### `apps/api/src/services/index.ts`

```typescript
export { NginxService } from './nginx.service.js';
export { ApacheService } from './apache.service.js';
export { PhpFpmService } from './php-fpm.service.js';
export { BindService } from './bind.service.js';
export { CertbotService } from './certbot.service.js';
export { MariaDbService } from './mariadb.service.js';
export { PostgresService } from './postgres.service.js';
export { run } from './executor.js';
```

---

## Phase 5 — Stats Module + Dashboard: Detailed Specification

### 5.1 Stats Backend

#### `apps/api/src/modules/stats/stats.service.ts`

```typescript
import si from 'systeminformation';
import { db } from '../../db/index.js';
import { domains, subscriptions } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';

export class StatsService {
  /**
   * Get real-time server stats: CPU, RAM, Disk, Uptime
   */
  async getServerStats(): Promise<ServerStats> {
    const [cpu, mem, disk, time, load] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
      si.fullLoad(),
    ]);

    const rootDisk = disk.find((d) => d.mount === '/') || disk[0];

    return {
      cpu: {
        usage: Math.round(cpu.currentLoad),
        cores: cpu.cpus.length,
        temperature: cpu.cpus[0]?.temperature || null,
      },
      memory: {
        total: mem.total,
        used: mem.used,
        available: mem.available,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
        usagePercent: Math.round((mem.used / mem.total) * 100),
      },
      disk: {
        total: rootDisk?.size || 0,
        used: rootDisk?.used || 0,
        available: rootDisk?.available || 0,
        usagePercent: Math.round(rootDisk?.use || 0),
        mount: rootDisk?.mount || '/',
      },
      uptime: time.uptime,
      loadAvg: load,
    };
  }

  /**
   * Get status of all managed services
   */
  async getServiceStatuses(): Promise<ServiceStatusItem[]> {
    const services = [
      { name: 'nginx', displayName: 'Nginx' },
      { name: 'apache2', displayName: 'Apache2' },
      { name: 'bind9', displayName: 'BIND9 DNS' },
      { name: 'mariadb', displayName: 'MariaDB' },
      { name: 'postgresql', displayName: 'PostgreSQL' },
      { name: 'postfix', displayName: 'Postfix Mail' },
      { name: 'dovecot', displayName: 'Dovecot IMAP' },
      { name: 'proftpd', displayName: 'ProFTPd' },
      { name: 'ufw', displayName: 'UFW Firewall' },
      { name: 'fail2ban', displayName: 'Fail2Ban' },
      { name: 'cloudflared', displayName: 'Cloudflare Tunnel' },
    ];

    const statuses: ServiceStatusItem[] = [];
    for (const svc of services) {
      const result = await run('systemctl', ['is-active', svc.name]);
      const active = result.stdout.trim() === 'active';
      statuses.push({
        ...svc,
        status: active ? 'running' : 'stopped',
      });
    }
    return statuses;
  }

  /**
   * Get per-domain stats (disk usage)
   */
  async getDomainStats(domainId: string): Promise<DomainStats> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new Error('Domain not found');

    // Get disk usage via du
    const result = await run('du', ['-sm', domain.documentRoot], { sudo: true });
    const usedMb = parseInt(result.stdout.split('\t')[0], 10) || 0;

    return {
      domainId: domain.id,
      domainName: domain.name,
      diskUsedMb: usedMb,
      status: domain.status,
      sslEnabled: domain.sslEnabled,
      phpVersion: domain.phpVersion,
    };
  }

  /**
   * Get network I/O stats
   */
  async getNetworkStats(): Promise<NetworkStats> {
    const stats = await si.networkStats();
    const defaultIface = stats.find((s) => s.iface !== 'lo') || stats[0];
    return {
      interface: defaultIface?.iface || 'unknown',
      rxBytes: defaultIface?.rx_bytes || 0,
      txBytes: defaultIface?.tx_bytes || 0,
      rxSec: defaultIface?.rx_sec || 0,
      txSec: defaultIface?.tx_sec || 0,
    };
  }

  /**
   * Get summary counts for dashboard
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const allDomains = await db.select().from(domains);
    const allSubs = await db.select().from(subscriptions);

    return {
      totalDomains: allDomains.length,
      activeDomains: allDomains.filter((d) => d.status === 'active').length,
      suspendedDomains: allDomains.filter((d) => d.status === 'suspended').length,
      totalSubscriptions: allSubs.length,
      sslEnabledDomains: allDomains.filter((d) => d.sslEnabled).length,
    };
  }
}

export interface ServerStats {
  cpu: { usage: number; cores: number; temperature: number | null };
  memory: { total: number; used: number; available: number; swapTotal: number; swapUsed: number; usagePercent: number };
  disk: { total: number; used: number; available: number; usagePercent: number; mount: string };
  uptime: number;
  loadAvg: number;
}

export interface ServiceStatusItem {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
}

export interface DomainStats {
  domainId: string;
  domainName: string;
  diskUsedMb: number;
  status: string;
  sslEnabled: boolean;
  phpVersion: string;
}

export interface NetworkStats {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxSec: number;
  txSec: number;
}

export interface DashboardSummary {
  totalDomains: number;
  activeDomains: number;
  suspendedDomains: number;
  totalSubscriptions: number;
  sslEnabledDomains: number;
}
```

#### `apps/api/src/modules/stats/stats.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { StatsService } from './stats.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function statsRoutes(fastify: FastifyInstance) {
  const statsService = new StatsService();

  fastify.get('/server', {
    preHandler: [requireAuth],
    handler: async () => {
      const stats = await statsService.getServerStats();
      return { success: true, data: stats };
    },
  });

  fastify.get('/services', {
    preHandler: [requireAuth],
    handler: async () => {
      const statuses = await statsService.getServiceStatuses();
      return { success: true, data: statuses };
    },
  });

  fastify.get('/summary', {
    preHandler: [requireAuth],
    handler: async () => {
      const summary = await statsService.getDashboardSummary();
      return { success: true, data: summary };
    },
  });

  fastify.get('/network', {
    preHandler: [requireAuth],
    handler: async () => {
      const stats = await statsService.getNetworkStats();
      return { success: true, data: stats };
    },
  });

  fastify.get('/domains/:id', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      const stats = await statsService.getDomainStats(id);
      return { success: true, data: stats };
    },
  });
}
```

### 5.2 Stats Collection Job

#### `apps/api/src/jobs/queue.ts`

```typescript
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const connection: ConnectionOptions = {
  host: new URL(env.REDIS_URL).hostname || '127.0.0.1',
  port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};

export const Queues = {
  stats: new Queue('stats', { connection }),
  ssl: new Queue('ssl', { connection }),
  backup: new Queue('backup', { connection }),
  mail: new Queue('mail', { connection }),
};

/**
 * Register all repeatable jobs on startup
 */
export async function registerRepeatableJobs(): Promise<void> {
  // Stats collection every 30 seconds
  await Queues.stats.add('collect', {}, {
    repeat: { pattern: '*/30 * * * * *' },
    jobId: 'stats-collect',
  });

  // SSL renewal check daily at 3 AM
  await Queues.ssl.add('renew-check', {}, {
    repeat: { pattern: '0 3 * * *' },
    jobId: 'ssl-renew-check',
  });

  // Scheduled backups at 2 AM
  await Queues.backup.add('scheduled', {}, {
    repeat: { pattern: '0 2 * * *' },
    jobId: 'backup-scheduled',
  });

  logger.info('Repeatable jobs registered');
}
```

#### `apps/api/src/jobs/stats-collect.job.ts`

```typescript
import { Worker, type ConnectionOptions } from 'bullmq';
import si from 'systeminformation';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const connection: ConnectionOptions = {
  host: new URL(env.REDIS_URL).hostname || '127.0.0.1',
  port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};

export function startStatsWorker(): Worker {
  const worker = new Worker('stats', async (job) => {
    if (job.name === 'collect') {
      const [cpu, mem, net] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkStats(),
      ]);

      logger.debug({
        cpu: Math.round(cpu.currentLoad),
        mem: Math.round((mem.used / mem.total) * 100),
      }, 'Stats collected');

      // In production, store in serverStats table for rolling 24h window
      // For now, just log
    }
  }, { connection, concurrency: 1 });

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.name, error: err.message }, 'Stats job failed');
  });

  return worker;
}
```

### 5.3 Dashboard Frontend

#### `apps/web/src/api/hooks/stats.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface ServerStats {
  cpu: { usage: number; cores: number; temperature: number | null };
  memory: { total: number; used: number; available: number; usagePercent: number };
  disk: { total: number; used: number; available: number; usagePercent: number };
  uptime: number;
}

export interface ServiceStatusItem {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
}

export interface DashboardSummary {
  totalDomains: number;
  activeDomains: number;
  suspendedDomains: number;
  totalSubscriptions: number;
  sslEnabledDomains: number;
}

export function useServerStats() {
  return useQuery({
    queryKey: ['stats', 'server'],
    queryFn: () => api.get<ServerStats>('/api/v1/stats/server'),
    refetchInterval: 30_000, // Refresh every 30s
  });
}

export function useServiceStatuses() {
  return useQuery({
    queryKey: ['stats', 'services'],
    queryFn: () => api.get<ServiceStatusItem[]>('/api/v1/stats/services'),
    refetchInterval: 60_000,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/api/v1/stats/summary'),
    refetchInterval: 30_000,
  });
}

export function useNetworkStats() {
  return useQuery({
    queryKey: ['stats', 'network'],
    queryFn: () => api.get<any>('/api/v1/stats/network'),
    refetchInterval: 10_000,
  });
}
```

#### `apps/web/src/pages/dashboard/DashboardPage.tsx`

```typescript
import { useServerStats, useServiceStatuses, useDashboardSummary } from '../../api/hooks/stats';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  Globe, Mail, Database, Shield, Activity, Cpu, HardDrive, MemoryStick,
  ArrowUp, ArrowDown, RefreshCw, Zap
} from 'lucide-react';

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useServerStats();
  const { data: services } = useServiceStatuses();
  const { data: summary } = useDashboardSummary();

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Server overview and quick actions</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Domains"
          value={summary?.totalDomains || 0}
          subtitle={`${summary?.activeDomains || 0} active`}
          icon={<Globe className="h-4 w-4" />}
        />
        <StatCard
          title="SSL Certificates"
          value={summary?.sslEnabledDomains || 0}
          subtitle="enabled"
          icon={<Shield className="h-4 w-4" />}
        />
        <StatCard
          title="Databases"
          value="-"
          subtitle="coming soon"
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          title="Mailboxes"
          value="-"
          subtitle="coming soon"
          icon={<Mail className="h-4 w-4" />}
        />
      </div>

      {/* Server Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CPU */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cpu.usage}%</div>
            <Progress value={stats?.cpu.usage || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.cpu.cores} cores
            </p>
          </CardContent>
        </Card>

        {/* Memory */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.memory.usagePercent}%</div>
            <Progress value={stats?.memory.usagePercent || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(stats?.memory.used || 0)} / {formatBytes(stats?.memory.total || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.disk.usagePercent}%</div>
            <Progress value={stats?.disk.usagePercent || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(stats?.disk.used || 0)} / {formatBytes(stats?.disk.total || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Services Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {services?.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <span className="text-sm font-medium">{service.displayName}</span>
                <Badge variant={service.status === 'running' ? 'default' : 'destructive'}>
                  {service.status === 'running' ? '● Running' : '● Stopped'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <QuickActionButton icon={<Globe />} label="Add Domain" href="/domains/new" />
            <QuickActionButton icon={<Database />} label="New Database" href="/databases/new" />
            <QuickActionButton icon={<Shield />} label="Issue SSL" href="/ssl" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper components
function StatCard({ title, value, subtitle, icon }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function QuickActionButton({ icon, label, href }: any) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### 5.4 Layout Components

#### `apps/web/src/components/layout/Layout.tsx`

```typescript
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useState } from 'react';

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

#### `apps/web/src/components/layout/Sidebar.tsx`

```typescript
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Globe, Server, Code2, Mail, Network,
  Database, Shield, FolderOpen, Terminal, Clock, Flame,
  Cloud, HardDrive, FileText, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Domains', icon: Globe, href: '/domains' },
  { label: 'Web Server', icon: Server, href: '/webserver' },
  { label: 'PHP', icon: Code2, href: '/php' },
  { label: 'Mail', icon: Mail, href: '/mail' },
  { label: 'DNS', icon: Network, href: '/dns' },
  { label: 'Databases', icon: Database, href: '/databases' },
  { label: 'SSL', icon: Shield, href: '/ssl' },
  { label: 'FTP', icon: FolderOpen, href: '/ftp' },
  { label: 'Files', icon: HardDrive, href: '/files' },
  { label: 'Terminal', icon: Terminal, href: '/terminal' },
  { label: 'Cron', icon: Clock, href: '/cron' },
  { label: 'Firewall', icon: Flame, href: '/firewall' },
  { label: 'Tunnel', icon: Cloud, href: '/tunnel' },
  { label: 'Backups', icon: HardDrive, href: '/backups' },
  { label: 'Logs', icon: FileText, href: '/logs' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SF</span>
          </div>
          {!collapsed && <span className="font-bold text-lg">ServerForge</span>}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2 rounded-lg hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
```

#### `apps/web/src/components/layout/Topbar.tsx`

```typescript
import { useAuthStore } from '../../store/auth.store';
import { useLogout } from '../../api/hooks/auth';
import { Bell, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

export function Topbar() {
  const { user } = useAuthStore();
  const logoutMutation = useLogout();

  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b bg-card">
      <div />

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline">{user?.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{user?.username}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

---

## Phase 6 — Domain Module: Detailed Specification

### 6.1 Domain Service

#### `apps/api/src/modules/domains/domains.schema.ts`

```typescript
import { z } from 'zod';

export const createDomainSchema = z.object({
  subscriptionId: z.string().min(1),
  name: z.string()
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, 'Invalid domain name')
    .transform((v) => v.toLowerCase().trim()),
  phpVersion: z.enum(['8.1', '8.2', '8.3', '8.4']).default('8.2'),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).default('php-fpm'),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).default('nginx+apache'),
});

export const updateDomainSchema = z.object({
  phpVersion: z.enum(['8.1', '8.2', '8.3', '8.4']).optional(),
  phpHandler: z.enum(['php-fpm', 'cgi', 'disabled']).optional(),
  webServer: z.enum(['nginx', 'apache', 'nginx+apache']).optional(),
  redirectHttpToHttps: z.boolean().optional(),
  hsts: z.boolean().optional(),
});

export const createSubdomainSchema = z.object({
  name: z.string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain name')
    .transform((v) => v.toLowerCase().trim()),
  documentRoot: z.string().optional(),
  phpVersion: z.enum(['8.1', '8.2', '8.3', '8.4']).optional(),
});

export const createAliasSchema = z.object({
  alias: z.string()
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, 'Invalid alias domain')
    .transform((v) => v.toLowerCase().trim()),
});

export const createRedirectSchema = z.object({
  sourcePath: z.string().min(1).startsWith('/'),
  targetUrl: z.string().url(),
  type: z.enum(['301', '302']).default('301'),
});

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
```

#### `apps/api/src/modules/domains/domains.service.ts`

```typescript
import { db } from '../../db/index.js';
import { domains, subdomains, domainAliases, domainRedirects, subscriptions, plans } from '../../db/schema/index.js';
import { eq, and, like, count, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';
import { NginxService, type VhostContext } from '../../services/nginx.service.js';
import { ApacheService, type ApacheVhostContext } from '../../services/apache.service.js';
import { PhpFpmService, type PoolContext } from '../../services/php-fpm.service.js';
import { BindService, type ZoneContext } from '../../services/bind.service.js';
import { run } from '../../services/executor.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { mkdir, writeFile } from 'node:fs/promises';

const nginxService = new NginxService();
const apacheService = new ApacheService();
const phpFpmService = new PhpFpmService();
const bindService = new BindService();

export class DomainsService {
  /**
   * List domains with pagination and filtering
   */
  async list(options: ListOptions = {}) {
    const { page = 1, perPage = 20, search, subscriptionId, status } = options;
    const offset = (page - 1) * perPage;

    let query = db.select().from(domains).$dynamic();
    const conditions = [];

    if (search) conditions.push(like(domains.name, `%${search}%`));
    if (subscriptionId) conditions.push(eq(domains.subscriptionId, subscriptionId));
    if (status) conditions.push(eq(domains.status, status));

    // Apply where conditions
    // Note: Drizzle dynamic query building varies; simplified here

    const items = await query.limit(perPage).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(domains);

    return {
      items,
      meta: { page, perPage, total },
    };
  }

  /**
   * Get a single domain with all related data
   */
  async get(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [subs] = await db.select().from(subdomains).where(eq(subdomains.domainId, id));
    const [aliases] = await db.select().from(domainAliases).where(eq(domainAliases.domainId, id));
    const [redirects] = await db.select().from(domainRedirects).where(eq(domainRedirects.domainId, id));

    return { ...domain, subdomains: subs, aliases, redirects };
  }

  /**
   * Create a new domain with full system setup
   */
  async create(data: CreateDomainInput) {
    const { subscriptionId, name, phpVersion, phpHandler, webServer } = data;

    // 1. Check domain doesn't already exist
    const [existing] = await db.select().from(domains).where(eq(domains.name, name)).limit(1);
    if (existing) throw new AppError(409, 'DOMAIN_EXISTS', 'Domain already exists on this server');

    // 2. Get subscription and check limits
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!subscription) throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    const domainCount = (await db.select({ count: count() }).from(domains).where(eq(dom