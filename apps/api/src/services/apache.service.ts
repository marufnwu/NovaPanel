import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as sudoFs from './sudo-fs.js';

export class ApacheService implements SystemService {
  readonly name = 'apache2';
  readonly displayName = 'Apache';

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
    return {
      valid: result.exitCode === 0,
      output: result.stderr || result.stdout,
    };
  }

  async enableSite(site: string): Promise<void> {
    await run('a2ensite', [site], { sudo: true });
    await this.reload();
    logger.info({ site }, 'Apache site enabled');
  }

  async disableSite(site: string): Promise<void> {
    await run('a2dissite', [site], { sudo: true });
    await this.reload();
    logger.info({ site }, 'Apache site disabled');
  }

  async enableModule(module: string): Promise<void> {
    await run('a2enmod', [module], { sudo: true });
    await this.reload();
    logger.info({ module }, 'Apache module enabled');
  }

  async disableModule(module: string): Promise<void> {
    await run('a2dismod', [module], { sudo: true });
    await this.reload();
    logger.info({ module }, 'Apache module disabled');
  }

  /**
   * Remove an Apache virtual host configuration
   */
  async removeVhost(domain: string): Promise<void> {
    const siteName = `${domain}.conf`;
    const availablePath = `${env.APACHE_SITES_AVAILABLE}/${siteName}`;

    // Disable the site first (best-effort)
    await run('a2dissite', [siteName], { sudo: true }).catch(() => {});

    // Remove the config file
    await sudoFs.unlink(availablePath).catch(() => {});

    // Reload Apache if config is still valid
    const test = await this.testConfig().catch(() => null);
    if (test?.valid) {
      await this.reload().catch(() => {});
    }

    logger.info({ domain }, 'Apache vhost removed');
  }
}

export const apacheService = new ApacheService();
