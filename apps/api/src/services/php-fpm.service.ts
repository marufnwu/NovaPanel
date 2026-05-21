import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as sudoFs from './sudo-fs.js';
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

  static async generateWebsitePool(_siteId: string): Promise<void> {
  }

  static async removeWebsitePool(_siteId: string): Promise<void> {
  }

  static async reloadPhpFpm(_phpVersion: string): Promise<void> {
  }

  private getPoolDir(): string {
    return env.PHP_FPM_POOL_DIR.replace('{version}', this.version);
  }

  async createPool(_domain: string, _systemUser: string, _documentRoot: string): Promise<void> {
  }

  async deletePool(_domain: string): Promise<void> {
  }
}

export const phpFpmServices = {
  '8.1': new PhpFpmService('8.1'),
  '8.2': new PhpFpmService('8.2'),
  '8.3': new PhpFpmService('8.3'),
  '8.4': new PhpFpmService('8.4'),
};
