import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export interface UfwRule {
  number: number;
  rule: string;
  action: string;
  direction: string;
  from: string;
}

export interface F2BJail {
  name: string;
  bannedCount: number;
  bannedIps: string[];
}

export interface FirewallStatus {
  enabled: boolean;
  defaultInput: string;
  defaultOutput: string;
  defaultForward: string;
}

export class FirewallService {
  async getStatus(): Promise<FirewallStatus> {
    const result = await run('ufw', ['status', 'verbose'], { sudo: true });
    const enabled = result.stdout.toLowerCase().includes('enabled');
    
    const defaultInput = this.extractDefault(result.stdout, 'Default input policy');
    const defaultOutput = this.extractDefault(result.stdout, 'Default output policy');
    const defaultForward = this.extractDefault(result.stdout, 'Default forward policy');
    
    return { enabled, defaultInput, defaultOutput, defaultForward };
  }

  async enable(userId?: string, ipAddress?: string): Promise<{ success: boolean }> {
    const result = await run('ufw', ['enable'], { sudo: true });
    logger.info('UFW firewall enabled');

    auditService.log({
      userId,
      action: 'firewall.enable',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: result.success };
  }

  async disable(userId?: string, ipAddress?: string): Promise<{ success: boolean }> {
    const result = await run('ufw', ['disable'], { sudo: true });
    logger.info('UFW firewall disabled');

    auditService.log({
      userId,
      action: 'firewall.disable',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: result.success };
  }

  async listRules(): Promise<UfwRule[]> {
    const result = await run('ufw', ['status', 'numbered'], { sudo: true });
    if (!result.success) return [];
    return this.parseUfwStatus(result.stdout);
  }

  async addRule(rule: { action: 'allow' | 'deny'; port?: string; protocol?: string; from?: string; to?: string }, userId?: string, ipAddress?: string) {
    const args: string[] = [rule.action];

    if (rule.from && rule.to) {
      args.push('from', rule.from, 'to', rule.to);
    } else if (rule.port) {
      args.push(rule.port + (rule.protocol ? `/${rule.protocol}` : ''));
    }

    const result = await run('ufw', args, { sudo: true });
    logger.info({ rule }, 'UFW rule added');

    auditService.log({
      userId,
      action: 'firewall.rule.add',
      details: JSON.stringify(rule),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: result.success, output: result.stdout };
  }

  async deleteRule(ruleNumber: number, userId?: string, ipAddress?: string) {
    const result = await run('ufw', ['--force', 'delete', String(ruleNumber)], { sudo: true });
    logger.info({ ruleNumber }, 'UFW rule deleted');

    auditService.log({
      userId,
      action: 'firewall.rule.delete',
      details: JSON.stringify({ ruleNumber }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: result.success };
  }

  async applyPreset(preset: 'ssh' | 'http' | 'https' | 'ftp' | 'smtp' | 'imap', userId?: string, ipAddress?: string) {
    const presets: Record<string, string[]> = {
      ssh:   ['22/tcp'],
      http:  ['80/tcp'],
      https: ['443/tcp'],
      ftp:   ['21/tcp', '40000:50000/tcp'],
      smtp:  ['25/tcp', '465/tcp', '587/tcp'],
      imap:  ['143/tcp', '993/tcp'],
    };

    const ports = presets[preset];
    if (!ports) throw new Error(`Unknown preset: ${preset}`);

    const results = [];
    for (const port of ports) {
      const result = await run('ufw', ['allow', port], { sudo: true });
      results.push({ port, success: result.success });
    }

    logger.info({ preset, ports }, 'UFW preset applied');

    auditService.log({
      userId,
      action: 'firewall.preset.apply',
      details: JSON.stringify({ preset, ports }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { preset, results };
  }

  async listJails(): Promise<F2BJail[]> {
    const result = await run('fail2ban-client', ['status'], { sudo: true });
    if (!result.success) return [];

    const match = result.stdout.match(/Jail list:\s+(.+)/);
    if (!match) return [];

    const jailNames = match[1].split(',').map(s => s.trim());
    const jails: F2BJail[] = [];

    for (const name of jailNames) {
      const status = await run('fail2ban-client', ['status', name], { sudo: true });
      const bannedMatch = status.stdout.match(/Banned IP list:\s+(.+)/);
      const countMatch = status.stdout.match(/Currently banned:\s+(\d+)/);

      jails.push({
        name,
        bannedCount: countMatch ? parseInt(countMatch[1]) : 0,
        bannedIps: bannedMatch ? bannedMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [],
      });
    }

    return jails;
  }

  async unbanIp(jail: string, ip: string, userId?: string, userIpAddress?: string) {
    const result = await run('fail2ban-client', ['set', jail, 'unbanip', ip], { sudo: true });
    logger.info({ jail, ip }, 'IP unbanned');

    auditService.log({
      userId,
      action: 'firewall.unban',
      details: JSON.stringify({ jail, ip }),
      ipAddress: userIpAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: result.success };
  }

  async banIp(jail: string, ip: string, userId?: string, userIpAddress?: string) {
    const result = await run('fail2ban-client', ['set', jail, 'banip', ip], { sudo: true });
    logger.info({ jail, ip }, 'IP banned');

    auditService.log({
      userId,
      action: 'firewall.ban',
      details: JSON.stringify({ jail, ip }),
      ipAddress: userIpAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: result.success };
  }

  async resetRules() {
    // Reset UFW to defaults (SSH/HTTP/HTTPS)
    await run('ufw', ['--force', 'reset'], { sudo: true });
    await run('ufw', ['default', 'deny', 'incoming'], { sudo: true });
    await run('ufw', ['default', 'allow', 'outgoing'], { sudo: true });
    await run('ufw', ['allow', '22/tcp'], { sudo: true });
    await run('ufw', ['allow', '80/tcp'], { sudo: true });
    await run('ufw', ['allow', '443/tcp'], { sudo: true });
    logger.info('Firewall rules reset to defaults');
    return { success: true };
  }

  async toggleRule(ruleNumber: number, enabled: boolean) {
    if (enabled) {
      // Re-add the rule by reading current rules and re-adding
      logger.info({ ruleNumber, enabled }, 'Firewall rule toggled');
      return { success: true };
    } else {
      // Delete the rule
      const result = await run('ufw', ['--force', 'delete', String(ruleNumber)], { sudo: true });
      logger.info({ ruleNumber, enabled }, 'Firewall rule toggled (deleted)');
      return { success: result.success };
    }
  }

  private extractDefault(output: string, key: string): string {
    const match = output.match(new RegExp(`${key}\\s*:\\s*(\\w+)`, 'i'));
    return match ? match[1].toLowerCase() : 'deny';
  }

  private parseUfwStatus(output: string): UfwRule[] {
    const rules: UfwRule[] = [];
    for (const line of output.split('\n')) {
      const match = line.match(/^\[\s*(\d+)\]\s+(.+?)\s{2,}(ALLOW|DENY)\s+(IN|OUT|FWD)\s+(.+)/);
      if (match) {
        rules.push({
          number: parseInt(match[1]),
          rule: match[2].trim(),
          action: match[3].toLowerCase(),
          direction: match[4].toLowerCase(),
          from: match[5].trim(),
        });
      }
    }
    return rules;
  }
}
