import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as sudoFs from './sudo-fs.js';
import { db } from '../db/index.js';
import { sites, siteRuntimes } from '../db/schema/index.js';
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

  static async getInstalledVersions(): Promise<string[]> {
    try {
      const result = await run('ls', ['-1', '/etc/php/'], { sudo: true });
      if (result.success && result.stdout.trim()) {
        const dirs = result.stdout.trim().split('\n').filter(Boolean);
        const versions = dirs
          .map(d => d.trim())
          .filter(d => /^\d+\.\d+$/.test(d))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (versions.length > 0) return versions;
      }
    } catch {}
    const versions: string[] = [];
    for (const v of ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4']) {
      const service = new PhpFpmService(v);
      if (await service.isInstalled()) versions.push(v);
    }
    return versions;
  }

  /**
   * Resolve PHP version from site config.
   * In v4: sites + site_runtimes.runtimeConfig JSON holds PHP config.
   */
  private static async getSiteInfo(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new Error(`Site not found: ${siteId}`);

    let phpVersion = '8.2';
    let phpHandler = 'php-fpm';
    const [runtime] = await db.select().from(siteRuntimes).where(eq(siteRuntimes.siteId, siteId)).limit(1);
    if (runtime?.runtimeConfig) {
      const cfg = runtime.runtimeConfig as any;
      phpVersion = cfg.phpVersion || cfg.version || '8.2';
      phpHandler = cfg.phpHandler || 'php-fpm';
    }

    return { site, phpVersion, phpHandler };
  }

  static async generateWebsitePool(siteId: string): Promise<void> {
    const { site, phpVersion, phpHandler } = await this.getSiteInfo(siteId);
    if (phpHandler === 'disabled') { logger.info({ siteId }, 'PHP-FPM pool skipped — handler disabled'); return; }

    const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', phpVersion);
    const poolPath = `${poolDir}/website-${siteId}.conf`;
    const poolName = `website-${siteId}`;
    const docRoot = `${site.homeDir}/httpdocs`;

    const config = `[${poolName}]
user = ${site.systemUser}
group = www-data
listen = /run/php/php${phpVersion}-fpm-${poolName}.sock
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
php_admin_value[open_basedir] = ${docRoot}:/tmp
php_admin_value[upload_tmp_dir] = ${docRoot}/../tmp
request_terminate_timeout = 300
`;

    await sudoFs.mkdir(poolDir);
    await sudoFs.atomicWrite(poolPath, config);

    try {
      await PhpFpmService.reloadPhpFpm(phpVersion);
    } catch (reloadError) {
      await sudoFs.unlink(poolPath).catch(() => {});
      try { await PhpFpmService.reloadPhpFpm(phpVersion); } catch {}
      throw new AppError(422, 'PHP_FPM_RELOAD_FAILED', `PHP-FPM pool config rejected: ${reloadError instanceof Error ? reloadError.message : String(reloadError)}`);
    }
    logger.info({ siteId, phpVersion }, 'Site PHP-FPM pool generated');
  }

  static async removeWebsitePool(siteId: string): Promise<void> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);

    if (site) {
      let phpVersion = '8.2';
      const [runtime] = await db.select().from(siteRuntimes).where(eq(siteRuntimes.siteId, siteId)).limit(1);
      if (runtime?.runtimeConfig) {
        const cfg = runtime.runtimeConfig as any;
        phpVersion = cfg.phpVersion || cfg.version || '8.2';
      }
      const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', phpVersion);
      const poolPath = `${poolDir}/website-${siteId}.conf`;
      await sudoFs.unlink(poolPath).catch(() => {});
      await PhpFpmService.reloadPhpFpm(phpVersion).catch(() => {});
    } else {
      for (const version of ['8.1', '8.2', '8.3', '8.4']) {
        const poolDir = env.PHP_FPM_POOL_DIR.replace('{version}', version);
        const poolPath = `${poolDir}/website-${siteId}.conf`;
        await sudoFs.unlink(poolPath).catch(() => {});
        await PhpFpmService.reloadPhpFpm(version).catch(() => {});
      }
    }
    logger.info({ siteId }, 'Site PHP-FPM pool removed');
  }

  static async reloadPhpFpm(phpVersion: string): Promise<void> {
    await run('systemctl', ['reload', `php${phpVersion}-fpm`], { sudo: true });
  }

  // Legacy per-domain pool methods
  private getPoolDir(): string {
    return env.PHP_FPM_POOL_DIR.replace('{version}', this.version);
  }

  /** @deprecated Use PhpFpmService.generateWebsitePool() instead. */
  async createPool(domain: string, systemUser: string, documentRoot: string): Promise<void> {
    const poolDir = this.getPoolDir();
    const poolPath = `${poolDir}/${domain}.conf`;
    const poolName = domain.replace(/\./g, '_');
    const config = `[${poolName}]\nuser = ${systemUser}\ngroup = www-data\nlisten = /run/php/php${this.version}-fpm-${poolName}.sock\nlisten.owner = www-data\nlisten.group = www-data\npm = dynamic\npm.max_children = 5\npm.start_servers = 2\npm.min_spare_servers = 1\npm.max_spare_servers = 3\nphp_admin_value[open_basedir] = ${documentRoot}:/tmp\nphp_admin_value[upload_tmp_dir] = ${documentRoot}/../tmp\n`;
    await sudoFs.mkdir(poolDir);
    await sudoFs.atomicWrite(poolPath, config);
    await this.reload().catch(() => {});
    logger.info({ domain, version: this.version }, 'PHP-FPM pool created');
  }

  /** @deprecated Use PhpFpmService.removeWebsitePool() instead. */
  async deletePool(domain: string): Promise<void> {
    for (const version of ['8.1', '8.2', '8.3', '8.4']) {
      const dir = env.PHP_FPM_POOL_DIR.replace('{version}', version);
      const path = `${dir}/${domain}.conf`;
      await run('rm', ['-f', path], { sudo: true }).catch(() => {});
    }
    const poolPath = `${this.getPoolDir()}/${domain}.conf`;
    await run('rm', ['-f', poolPath], { sudo: true }).catch(() => {});
    for (const version of ['8.1', '8.2', '8.3', '8.4']) {
      await run('systemctl', ['reload', `php${version}-fpm`], { sudo: true }).catch(() => {});
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
