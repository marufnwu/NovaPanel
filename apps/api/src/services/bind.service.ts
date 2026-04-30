import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as sudoFs from './sudo-fs.js';

export class BindService implements SystemService {
  readonly name = 'bind9';
  readonly displayName = 'BIND9';

  async start(): Promise<void> {
    await run('systemctl', ['start', 'named'], { sudo: true });
  }

  async stop(): Promise<void> {
    await run('systemctl', ['stop', 'named'], { sudo: true });
  }

  async restart(): Promise<void> {
    await run('systemctl', ['restart', 'named'], { sudo: true });
  }

  async reload(): Promise<void> {
    await run('rndc', ['reload'], { sudo: true });
  }

  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'named'], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status };
  }

  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['rndc']);
    return result.success;
  }

  /**
   * Check a zone file for syntax errors
   */
  async checkZone(zoneName: string, zoneFile: string): Promise<{ valid: boolean; output: string }> {
    const result = await run('named-checkzone', [zoneName, zoneFile], { sudo: true });
    return {
      valid: result.exitCode === 0,
      output: result.stdout,
    };
  }

  /**
   * Write a zone file to disk and reload BIND
   */
  async writeZoneFile(domain: string, content: string): Promise<void> {
    const zonesDir = env.BIND_ZONES_DIR;
    await sudoFs.mkdir(zonesDir);

    const zonePath = `${zonesDir}/db.${domain}`;
    await sudoFs.writeFile(zonePath, content);

    // Reload BIND to pick up changes
    await this.reload();
    logger.info({ domain }, 'BIND zone file written');
  }
}

export const bindService = new BindService();
