import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as sudoFs from './sudo-fs.js';
import { db } from '../db/index.js';
import { websites } from '../db/schema/websites.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../errors.js';

export class PhpFpmService implements SystemService {
  constructor(private version: string) {
    this.name = `php${version}-fpm`;
    this.displayName = `PHP ${version} FPM`;
  }

  readonly name: string;
  readonly displayName: string;

  async start(): Promise<void> {
    await run('systemctl', ['start', this.name], { sudo: true });
  }

  async stop(): Promise<void> {
    await run('systemctl', ['stop', this.name], { sudo: true });
  }

  async restart(): Promise<void> {
    await run('systemctl', ['restart', this.name], { sudo: true });
  }

  async reload(): Promise<void> {
    await run('systemctl', ['reload', this.name], { sudo: true });
  }

  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', this.name], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status, version: this.version };
  }

  async isInstalled(): Promise<boolean> {
    const result = await run('which', [this.name]);
    return result.success;
  }

  /**
   * Get all installed PHP-FPM versions by scanning /etc/php/ directory.
   * Falls back to checking known versions via `which` if directory scan fails.
   */
  static async getInstalledVersions(): Promise<string[]> {
    try {
      // Scan /etc/php/ for version directories (e.g. /etc/php/8.1, /etc/php/8.2)
      const result = await run('ls', ['-1', '/etc/php/'], { sudo: true });
      if (result.success && result.stdout.trim()) {
        const dirs = result.stdout.trim().split('\n').filter(Boolean);
        const versions = dirs
          .map(d => d.trim())
          .filter(d => /^\d+\.\d+$/.test(d))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (versions.length > 0) return versions;
      }
    } catch {
      // Directory scan failed, fall through to fallback
    }

    // Fallback: check known versions via `which`
    const versions: string[] = [];
    for (const v of ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4']) {
      const service = new PhpFpmService(v);
      if (await service.isInstalled()) {
        versions.push(v);
      }
    }
    return versions;
  }

  // ---------------------------------------------------------------------------
  // Website-scoped pool methods (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Generate a PHP-FPM pool configuration for an entire website.
   * Pool name: `website-{websiteId}`
   * Config path: `/etc/php/{version}/fpm/pool.d/website-{websiteId}.conf`
   */
  static async generateWebsitePool(websiteId: string): Promise<void> {
    // 1. Look up website
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new Error(`Website not found: ${websiteId}`);

    // Skip if PHP handler is disabled
    if (website.phpHandler === 'disabled') {
      logger.info({ websiteId }, 'PHP-FPM pool skipped — handler disabled');
      return;
    }

    const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', website.phpVersion);
    const poolPath = `${poolDir}/website-${websiteId}.conf`;
    const poolName = `website-${websiteId}`;

    const config = `[${poolName}]
user = ${website.systemUser}
group = www-data
listen = /run/php/php${website.phpVersion}-fpm-${poolName}.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
pm.max_requests = 500
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 300
php_admin_value[upload_max_filesize] = 64M
php_admin_value[post_max_size] = 64M
php_value[session.save_path] = /var/lib/php/sessions/${poolName}
php_admin_value[open_basedir] = ${website.documentRoot}:/tmp
php_admin_value[upload_tmp_dir] = ${website.documentRoot}/../tmp
request_terminate_timeout = 300
`;

    await sudoFs.mkdir(poolDir);
    // Use atomic write to ensure pool config is never partial (ISSUE-07)
    await sudoFs.atomicWrite(poolPath, config);

    // Reload this PHP-FPM version and validate the reload succeeded (ISSUE-04)
    try {
      await PhpFpmService.reloadPhpFpm(website.phpVersion);
    } catch (reloadError) {
      // PHP-FPM reload failed — remove the bad pool config and re-throw
      await sudoFs.unlink(poolPath).catch(() => {});
      try {
        await PhpFpmService.reloadPhpFpm(website.phpVersion);
      } catch {
        // Second reload also failed — PHP-FPM may be in a bad state
      }
      throw new AppError(422, 'PHP_FPM_RELOAD_FAILED', `PHP-FPM pool config rejected by PHP-FPM: ${reloadError instanceof Error ? reloadError.message : String(reloadError)}`);
    }
    logger.info({ websiteId, phpVersion: website.phpVersion }, 'Website PHP-FPM pool generated');
  }

  /**
   * Remove the PHP-FPM pool configuration for a website.
   * If the website still exists in DB, uses its phpVersion to locate the file.
   * Otherwise, attempts removal across all known PHP versions.
   */
  static async removeWebsitePool(websiteId: string): Promise<void> {
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);

    if (website) {
      // Known PHP version — remove directly
      const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', website.phpVersion);
      const poolPath = `${poolDir}/website-${websiteId}.conf`;
      await sudoFs.unlink(poolPath).catch(() => {});
      await PhpFpmService.reloadPhpFpm(website.phpVersion).catch(() => {});
    } else {
      // Website already deleted from DB — try all versions
      for (const version of ['8.1', '8.2', '8.3', '8.4']) {
        const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', version);
        const poolPath = `${poolDir}/website-${websiteId}.conf`;
        await sudoFs.unlink(poolPath).catch(() => {});
        await PhpFpmService.reloadPhpFpm(version).catch(() => {});
      }
    }

    logger.info({ websiteId }, 'Website PHP-FPM pool removed');
  }

  /**
   * Reload a specific PHP-FPM version via systemctl.
   */
  static async reloadPhpFpm(phpVersion: string): Promise<void> {
    const serviceName = `php${phpVersion}-fpm`;
    await run('systemctl', ['reload', serviceName], { sudo: true });
  }

  // ---------------------------------------------------------------------------
  // Legacy per-domain pool methods (deprecated — use website-scoped methods)
  // ---------------------------------------------------------------------------

  /**
   * Get the pool config directory for this PHP version
   */
  private getPoolDir(): string {
    return env.PHP_FPM_POOL_DIR.replace('{version}', this.version);
  }

  /**
   * @deprecated Use PhpFpmService.generateWebsitePool() instead.
   * Create a per-domain PHP-FPM pool configuration
   */
  async createPool(domain: string, systemUser: string, documentRoot: string): Promise<void> {
    const poolDir = this.getPoolDir();
    const poolPath = `${poolDir}/${domain}.conf`;

    // Pool name uses underscores instead of dots
    const poolName = domain.replace(/\./g, '_');

    const config = `[${poolName}]
user = ${systemUser}
group = www-data
listen = /run/php/php${this.version}-fpm-${poolName}.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
php_admin_value[open_basedir] = ${documentRoot}:/tmp
php_admin_value[upload_tmp_dir] = ${documentRoot}/../tmp
`;

    await sudoFs.mkdir(poolDir);
    // Use atomic write to ensure pool config is never partial (ISSUE-07)
    await sudoFs.atomicWrite(poolPath, config);

    // Reload this PHP-FPM version
    await this.reload().catch(() => {});
    logger.info({ domain, version: this.version }, 'PHP-FPM pool created');
  }

  /**
   * @deprecated Use PhpFpmService.removeWebsitePool() instead.
   * Delete a per-domain PHP-FPM pool configuration
   */
  async deletePool(domain: string): Promise<void> {
    const poolDir = this.getPoolDir();
    const poolPath = `${poolDir}/${domain}.conf`;

    // Try each version since we may not know which version was used
    for (const version of ['8.1', '8.2', '8.3', '8.4']) {
      const dir = env.PHP_FPM_POOL_DIR.replace('{version}', version);
      const path = `${dir}/${domain}.conf`;
      await run('rm', ['-f', path], { sudo: true }).catch(() => {});
    }

    // Also try the current version path
    await run('rm', ['-f', poolPath], { sudo: true }).catch(() => {});

    // Reload all installed PHP-FPM versions (best-effort)
    for (const version of ['8.1', '8.2', '8.3', '8.4']) {
      const serviceName = `php${version}-fpm`;
      await run('systemctl', ['reload', serviceName], { sudo: true }).catch(() => {});
    }

    logger.info({ domain }, 'PHP-FPM pool deleted');
  }
}

export const phpFpmServices = {
  '8.1': new PhpFpmService('8.1'),
  '8.2': new PhpFpmService('8.2'),
  '8.3': new PhpFpmService('8.3'),
  '8.4': new PhpFpmService('8.4'),
};
