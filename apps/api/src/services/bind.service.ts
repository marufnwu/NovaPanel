import { run } from './executor.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as sudoFs from './sudo-fs.js';

export class BindService implements SystemService {
  readonly name = 'bind9';
  readonly displayName = 'BIND9';

  private readonly namedConfLocal = '/etc/bind/named.conf.local';

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

  /**
   * Remove a zone file from disk.
   */
  async removeZoneFile(domain: string): Promise<void> {
    const zonePath = `${env.BIND_ZONES_DIR}/db.${domain}`;
    await sudoFs.unlink(zonePath).catch(() => {});
    logger.info({ domain }, 'BIND zone file removed');
  }

  /**
   * Add a zone declaration to named.conf.local so BIND serves the zone.
   * Idempotent — does nothing if the zone block already exists.
   */
  async addZoneToConfig(domain: string): Promise<void> {
    try {
      const content = await sudoFs.readFile(this.namedConfLocal);

      // Check if zone already exists in config
      const escapedDomain = domain.replace(/\./g, '\\.');
      const zoneRegex = new RegExp(`zone\\s+"${escapedDomain}\\.?"\\s*\\{`);
      if (zoneRegex.test(content)) {
        logger.debug({ domain }, 'Zone already in named.conf.local — skipping');
        return;
      }
    } catch {
      // named.conf.local doesn't exist yet — we'll create it below
    }

    const zoneBlock = `
zone "${domain}" {
    type master;
    file "${env.BIND_ZONES_DIR}/db.${domain}";
};
`;
    await sudoFs.appendFile(this.namedConfLocal, zoneBlock);
    logger.info({ domain }, 'Zone added to named.conf.local');
  }

  /**
   * Remove a zone declaration from named.conf.local.
   */
  async removeZoneFromConfig(domain: string): Promise<void> {
    try {
      const content = await sudoFs.readFile(this.namedConfLocal);
      const escapedDomain = domain.replace(/\./g, '\\.');
      const zoneBlockRegex = new RegExp(
        `\\s*zone\\s+"${escapedDomain}\\.?"\\s*\\{[^}]*\\};?\\s*`,
        'g',
      );
      const updated = content.replace(zoneBlockRegex, '\n');
      await sudoFs.writeFile(this.namedConfLocal, updated);
      logger.info({ domain }, 'Zone removed from named.conf.local');
    } catch {
      // named.conf.local may not exist or zone block not found
    }
  }

  /**
   * Reload BIND via systemctl (alternative to rndc reload).
   */
  async reloadBind(): Promise<void> {
    await run('systemctl', ['reload', 'bind9'], { sudo: true }).catch(() => {
      // Fallback to restart if reload fails
      return run('systemctl', ['restart', 'bind9'], { sudo: true });
    });
    logger.info('BIND reloaded via systemctl');
  }
}

export const bindService = new BindService();
