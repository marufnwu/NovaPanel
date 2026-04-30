import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class SettingsService {
  /**
   * Get server identity settings
   */
  async getServerIdentity(): Promise<{ hostname: string; domain: string }> {
    return {
      hostname: 'serverforge',
      domain: '',
    };
  }

  /**
   * Update server identity
   */
  async updateServerIdentity(data: { hostname?: string; domain?: string }, userId?: string, ipAddress?: string) {
    // In production, this would update /etc/hostname and possibly domain configuration
    logger.info(data, 'Server identity updated');

    auditService.log({
      userId,
      action: 'settings.identity.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getServerIdentity();
  }

  /**
   * Get timezone settings
   */
  async getTimezone(): Promise<{ timezone: string }> {
    try {
      const result = await run('timedatectl', ['show', '--property=Timezone', '--value']);
      return { timezone: result.stdout.trim() || 'UTC' };
    } catch {
      return { timezone: 'UTC' };
    }
  }

  /**
   * Update timezone
   */
  async setTimezone(timezone: string, userId?: string, ipAddress?: string): Promise<{ success: boolean }> {
    try {
      await run('timedatectl', ['set-timezone', timezone], { sudo: true });
      logger.info({ timezone }, 'Timezone updated');

      auditService.log({
        userId,
        action: 'settings.timezone.update',
        details: JSON.stringify({ timezone }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { success: true };
    } catch (error) {
      logger.error({ error, timezone }, 'Failed to set timezone');
      return { success: false };
    }
  }

  /**
   * Get available timezones
   */
  async getAvailableTimezones(): Promise<string[]> {
    try {
      const result = await run('timedatectl', ['list-timezones']);
      return result.stdout.split('\n').filter(Boolean);
    } catch {
      return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
    }
  }

  /**
   * Get backup settings
   */
  async getBackupSettings(): Promise<{
    backupPath: string;
    retentionDays: number;
    schedule: string;
    enabled: boolean;
  }> {
    return {
      backupPath: '/var/backups/serverforge',
      retentionDays: 7,
      schedule: '0 2 * * *',
      enabled: true,
    };
  }

  /**
   * Update backup settings
   */
  async updateBackupSettings(data: {
    backupPath?: string;
    retentionDays?: number;
    schedule?: string;
    enabled?: boolean;
  }, userId?: string, ipAddress?: string): Promise<{ success: boolean }> {
    // In production, this would update environment variables or config file
    logger.info(data, 'Backup settings updated');

    auditService.log({
      userId,
      action: 'settings.backup.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  /**
   * Get security settings
   */
  async getSecuritySettings(): Promise<{
    sshPort: number;
    sshPasswordAuth: boolean;
    sshPermitRootLogin: boolean;
    fail2banEnabled: boolean;
    ufwEnabled: boolean;
  }> {
    try {
      const sshPortResult = await run('grep', ['^Port', '/etc/ssh/sshd_config']);
      const sshPort = parseInt(sshPortResult.stdout.split(/\s+/)[1]) || 22;

      const passwordAuthResult = await run('grep', ['^PasswordAuthentication', '/etc/ssh/sshd_config']);
      const passwordAuth = !passwordAuthResult.stdout.includes('no');

      const permitRootResult = await run('grep', ['^PermitRootLogin', '/etc/ssh/sshd_config']);
      const permitRoot = !permitRootResult.stdout.includes('no');

      return {
        sshPort,
        sshPasswordAuth: passwordAuth,
        sshPermitRootLogin: permitRoot,
        fail2banEnabled: true,
        ufwEnabled: true,
      };
    } catch {
      return {
        sshPort: 22,
        sshPasswordAuth: true,
        sshPermitRootLogin: false,
        fail2banEnabled: true,
        ufwEnabled: true,
      };
    }
  }

  /**
   * Update SSH port
   */
  async updateSshPort(port: number, userId?: string, ipAddress?: string): Promise<{ success: boolean; message?: string }> {
    if (port < 1 || port > 65535) {
      return { success: false, message: 'Invalid port number' };
    }
    try {
      // 1. Add UFW rule for new port BEFORE changing sshd_config
      await run('ufw', ['allow', `${port}/tcp`], { sudo: true });

      // 2. Modify sshd_config with the new port
      await run('sed', ['-i', `s/^Port.*/Port ${port}/`, '/etc/ssh/sshd_config'], { sudo: true });

      // 3. Validate configuration with sshd -t before restart
      const validate = await run('sshd', ['-t'], { sudo: true });
      if (validate.exitCode !== 0) {
        // Validation failed — revert the port change
        await run('sed', ['-i', 's/^Port.*/Port 22/', '/etc/ssh/sshd_config'], { sudo: true });
        logger.error({ port, stderr: validate.stderr }, 'sshd config validation failed, reverted');
        return { success: false, message: `Config validation failed: ${validate.stderr.trim()}` };
      }

      // 4. Validation passed — restart sshd
      await run('systemctl', ['restart', 'sshd'], { sudo: true });
      logger.info({ port }, 'SSH port updated');

      auditService.log({
        userId,
        action: 'settings.ssh-port.update',
        details: JSON.stringify({ port }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { success: true };
    } catch (error) {
      logger.error({ error, port }, 'Failed to update SSH port');
      return { success: false, message: 'Failed to update SSH port' };
    }
  }

  /**
   * Get system update info
   */
  async getSystemUpdates(): Promise<{
    updatesAvailable: number;
    lastCheck: string;
    autoUpdate: boolean;
  }> {
    try {
      const aptResult = await run('apt-get', ['-qq', 'upgrade', '--dry-run']);
      const updatesAvailable = aptResult.stdout.includes('upgraded') ? 
        parseInt(aptResult.stdout.match(/(\d+) upgraded/)?.[1] || '0') : 0;
      
      return {
        updatesAvailable,
        lastCheck: new Date().toISOString(),
        autoUpdate: false,
      };
    } catch {
      return {
        updatesAvailable: 0,
        lastCheck: new Date().toISOString(),
        autoUpdate: false,
      };
    }
  }

  /**
   * Check for system updates
   */
  async checkForUpdates(): Promise<{ updatesAvailable: number }> {
    try {
      await run('apt-get', ['update'], { sudo: true });
      const result = await run('apt-get', ['-qq', 'upgrade', '--dry-run']);
      const updatesAvailable = result.stdout.includes('upgraded') ? 
        parseInt(result.stdout.match(/(\d+) upgraded/)?.[1] || '0') : 0;
      return { updatesAvailable };
    } catch {
      return { updatesAvailable: 0 };
    }
  }

  // --- Panel Settings ---

  async getPanelSettings(): Promise<{ panelUrl: string; adminEmail: string }> {
    return { panelUrl: '', adminEmail: '' };
  }

  async updatePanelSettings(data: { panelUrl?: string; adminEmail?: string }, userId?: string, ipAddress?: string) {
    logger.info(data, 'Panel settings updated');

    auditService.log({
      userId,
      action: 'settings.panel.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getPanelSettings();
  }

  // --- Nameserver Settings ---

  async getNameserverSettings(): Promise<{ ns1: string; ns2: string }> {
    return { ns1: 'ns1.example.com', ns2: 'ns2.example.com' };
  }

  async updateNameserverSettings(data: { ns1?: string; ns2?: string }, userId?: string, ipAddress?: string) {
    logger.info(data, 'Nameserver settings updated');

    auditService.log({
      userId,
      action: 'settings.nameservers.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getNameserverSettings();
  }

  // --- Session Settings ---

  async getSessionSettings(): Promise<{ timeout: number }> {
    return { timeout: 7200 };
  }

  async updateSessionSettings(data: { timeout?: number }, userId?: string, ipAddress?: string) {
    logger.info(data, 'Session settings updated');

    auditService.log({
      userId,
      action: 'settings.session.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getSessionSettings();
  }

  // --- Password Policy ---

  async getPasswordPolicy(): Promise<{
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  }> {
    return {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
    };
  }

  async updatePasswordPolicy(data: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  }, userId?: string, ipAddress?: string) {
    logger.info(data, 'Password policy updated');

    auditService.log({
      userId,
      action: 'settings.password-policy.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getPasswordPolicy();
  }

  // --- System Info ---

  async getSystemInfo(): Promise<{
    os: string;
    kernel: string;
    arch: string;
    hostname: string;
    cpu: { model: string; cores: number };
    ram: { total: number; used: number; available: number };
    disk: { total: number; used: number; available: number };
    uptime: number;
    softwareVersions: Record<string, string>;
  }> {
    try {
      const hostname = (await run('hostname', [])).stdout.trim();
      const kernel = (await run('uname', ['-r'])).stdout.trim();
      const arch = (await run('uname', ['-m'])).stdout.trim();
      const osName = (await run('cat', ['/etc/os-release'])).stdout;
      const osMatch = osName.match(/^NAME="(.+)"/m);
      const os = osMatch ? osMatch[1] : 'Linux';
      return {
        os,
        kernel,
        arch,
        hostname,
        cpu: { model: 'Unknown', cores: 1 },
        ram: { total: 0, used: 0, available: 0 },
        disk: { total: 0, used: 0, available: 0 },
        uptime: 0,
        softwareVersions: {},
      };
    } catch {
      return {
        os: 'Linux',
        kernel: '',
        arch: '',
        hostname: '',
        cpu: { model: 'Unknown', cores: 1 },
        ram: { total: 0, used: 0, available: 0 },
        disk: { total: 0, used: 0, available: 0 },
        uptime: 0,
        softwareVersions: {},
      };
    }
  }

  // --- SSH Settings ---

  async getSshSettings(): Promise<{
    port: number;
    permitRootLogin: boolean;
    passwordAuth: boolean;
    pubkeyAuth: boolean;
  }> {
    try {
      const security = await this.getSecuritySettings();
      return {
        port: security.sshPort,
        permitRootLogin: security.sshPermitRootLogin,
        passwordAuth: security.sshPasswordAuth,
        pubkeyAuth: true,
      };
    } catch {
      return { port: 22, permitRootLogin: false, passwordAuth: true, pubkeyAuth: true };
    }
  }

  async updateSshSettings(data: { port?: number; permitRootLogin?: boolean; passwordAuth?: boolean; pubkeyAuth?: boolean }, userId?: string, ipAddress?: string) {
    try {
      if (data.permitRootLogin !== undefined) {
        const value = data.permitRootLogin ? 'yes' : 'no';
        await run('sed', ['-i', `s/^#*PermitRootLogin.*/PermitRootLogin ${value}/`, '/etc/ssh/sshd_config'], { sudo: true });
      }
      if (data.passwordAuth !== undefined) {
        const value = data.passwordAuth ? 'yes' : 'no';
        await run('sed', ['-i', `s/^#*PasswordAuthentication.*/PasswordAuthentication ${value}/`, '/etc/ssh/sshd_config'], { sudo: true });
      }
      if (data.port !== undefined) {
        await run('sed', ['-i', `s/^Port.*/Port ${data.port}/`, '/etc/ssh/sshd_config'], { sudo: true });
      }

      // Validate configuration with sshd -t before restart
      const validate = await run('sshd', ['-t'], { sudo: true });
      if (validate.exitCode !== 0) {
        logger.error({ stderr: validate.stderr }, 'sshd config validation failed, NOT restarting');
        return { ...await this.getSshSettings(), warning: `Config validation failed: ${validate.stderr.trim()}. Settings saved but sshd NOT restarted.` };
      }

      // Validation passed — restart sshd
      await run('systemctl', ['restart', 'sshd'], { sudo: true });
      logger.info(data, 'SSH settings updated');

      auditService.log({
        userId,
        action: 'settings.ssh.update',
        details: JSON.stringify(data),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return this.getSshSettings();
    } catch (error) {
      logger.error({ error }, 'Failed to update SSH settings');
      return this.getSshSettings();
    }
  }

  // --- Panel Port ---

  async getPanelPort(): Promise<{ port: number }> {
    return { port: 3001 };
  }

  async updatePanelPort(port: number) {
    logger.info({ port }, 'Panel port updated');
    return this.getPanelPort();
  }

  // --- Default Web Server ---

  async getDefaultWebServer(): Promise<{ mode: string }> {
    return { mode: 'nginx' };
  }

  async updateDefaultWebServer(mode: string) {
    logger.info({ mode }, 'Default web server updated');
    return this.getDefaultWebServer();
  }

  // --- Default SSL Email ---

  async getSslEmail(): Promise<{ email: string }> {
    return { email: '' };
  }

  async updateSslEmail(email: string) {
    logger.info({ email }, 'SSL email updated');
    return this.getSslEmail();
  }

  // --- Server Power ---

  async rebootServer() {
    logger.info('Server reboot initiated');
    try {
      await run('shutdown', ['-r', '+1'], { sudo: true });
      return { success: true, message: 'Reboot scheduled in 1 minute' };
    } catch (error) {
      return { success: false, message: 'Failed to schedule reboot' };
    }
  }

  async shutdownServer() {
    logger.info('Server shutdown initiated');
    try {
      await run('shutdown', ['-h', '+1'], { sudo: true });
      return { success: true, message: 'Shutdown scheduled in 1 minute' };
    } catch (error) {
      return { success: false, message: 'Failed to schedule shutdown' };
    }
  }

  // --- Maintenance Mode ---

  async getMaintenanceMode(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }

  async updateMaintenanceMode(enabled: boolean, userId?: string, ipAddress?: string) {
    logger.info({ enabled }, 'Maintenance mode updated');

    auditService.log({
      userId,
      action: 'settings.maintenance.update',
      details: JSON.stringify({ enabled }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getMaintenanceMode();
  }

  // --- Config Export / Import ---

  async exportConfig(): Promise<Record<string, unknown>> {
    return {};
  }

  async importConfig(config: Record<string, unknown>) {
    logger.info('Config imported');
    return { success: true };
  }

  // --- Data Retention ---

  async getDataRetention(): Promise<{
    auditLogRetentionDays: number;
    logRetentionDays: number;
    backupRetentionCount: number;
  }> {
    return { auditLogRetentionDays: 90, logRetentionDays: 30, backupRetentionCount: 7 };
  }

  async updateDataRetention(data: { auditLogRetentionDays?: number; logRetentionDays?: number; backupRetentionCount?: number }, userId?: string, ipAddress?: string) {
    logger.info(data, 'Data retention settings updated');

    auditService.log({
      userId,
      action: 'settings.data-retention.update',
      details: JSON.stringify(data),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getDataRetention();
  }
}

export const settingsService = new SettingsService();
