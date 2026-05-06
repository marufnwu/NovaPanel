import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';
import { env } from '../../config/env.js';
import * as fs from 'fs';
import * as path from 'path';

/** Path to the persistent settings JSON file */
const SETTINGS_FILE = path.resolve(env.DB_PATH, '..', 'settings.json');

/**
 * In-memory settings store, initialised from disk on first access.
 * Falls back to defaults when the file does not exist.
 */
let settingsCache: Record<string, any> | null = null;

function loadSettings(): Record<string, any> {
  if (settingsCache !== null) return settingsCache;
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      settingsCache = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    } else {
      settingsCache = {};
    }
  } catch {
    settingsCache = {};
  }
  return settingsCache!;
}

function saveSettings(settings: Record<string, any>): void {
  settingsCache = settings;
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to persist settings to disk');
  }
}

function getSetting(key: string, defaultValue: any): any {
  const settings = loadSettings();
  return settings[key] ?? defaultValue;
}

function setSetting(key: string, value: any): void {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

export class SettingsService {
  /**
   * Get server identity settings
   */
  async getServerIdentity(): Promise<{ hostname: string; domain: string }> {
    // Try reading actual hostname from the system first
    let systemHostname = 'serverforge';
    try {
      const result = await run('hostname', []);
      systemHostname = result.stdout.trim() || 'serverforge';
    } catch { /* fallback */ }

    return {
      hostname: getSetting('hostname', systemHostname),
      domain: getSetting('domain', ''),
    };
  }

  /**
   * Update server identity — persists to settings file
   */
  async updateServerIdentity(data: { hostname?: string; domain?: string }, userId?: string, ipAddress?: string) {
    const current = await this.getServerIdentity();
    if (data.hostname !== undefined) {
      setSetting('hostname', data.hostname);
    }
    if (data.domain !== undefined) {
      setSetting('domain', data.domain);
    }

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
      backupPath: getSetting('backupPath', env.BACKUP_DIR),
      retentionDays: getSetting('retentionDays', 7),
      schedule: getSetting('backupSchedule', '0 2 * * *'),
      enabled: getSetting('backupEnabled', true),
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
    if (data.backupPath !== undefined) setSetting('backupPath', data.backupPath);
    if (data.retentionDays !== undefined) setSetting('retentionDays', data.retentionDays);
    if (data.schedule !== undefined) setSetting('backupSchedule', data.schedule);
    if (data.enabled !== undefined) setSetting('backupEnabled', data.enabled);

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
    return {
      panelUrl: getSetting('panelUrl', env.PANEL_URL),
      adminEmail: getSetting('adminEmail', env.ADMIN_EMAIL),
    };
  }

  async updatePanelSettings(data: { panelUrl?: string; adminEmail?: string }, userId?: string, ipAddress?: string) {
    if (data.panelUrl !== undefined) setSetting('panelUrl', data.panelUrl);
    if (data.adminEmail !== undefined) setSetting('adminEmail', data.adminEmail);

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
    return {
      ns1: getSetting('ns1', 'ns1.example.com'),
      ns2: getSetting('ns2', 'ns2.example.com'),
    };
  }

  async updateNameserverSettings(data: { ns1?: string; ns2?: string }, userId?: string, ipAddress?: string) {
    if (data.ns1 !== undefined) setSetting('ns1', data.ns1);
    if (data.ns2 !== undefined) setSetting('ns2', data.ns2);

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
    return { timeout: getSetting('sessionTimeout', env.SESSION_IDLE_TIMEOUT_MINUTES * 60) };
  }

  async updateSessionSettings(data: { timeout?: number }, userId?: string, ipAddress?: string) {
    if (data.timeout !== undefined) setSetting('sessionTimeout', data.timeout);

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
      minLength: getSetting('passwordMinLength', 8),
      requireUppercase: getSetting('passwordRequireUppercase', true),
      requireLowercase: getSetting('passwordRequireLowercase', true),
      requireNumbers: getSetting('passwordRequireNumbers', true),
      requireSpecialChars: getSetting('passwordRequireSpecialChars', false),
    };
  }

  async updatePasswordPolicy(data: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  }, userId?: string, ipAddress?: string) {
    if (data.minLength !== undefined) setSetting('passwordMinLength', data.minLength);
    if (data.requireUppercase !== undefined) setSetting('passwordRequireUppercase', data.requireUppercase);
    if (data.requireLowercase !== undefined) setSetting('passwordRequireLowercase', data.requireLowercase);
    if (data.requireNumbers !== undefined) setSetting('passwordRequireNumbers', data.requireNumbers);
    if (data.requireSpecialChars !== undefined) setSetting('passwordRequireSpecialChars', data.requireSpecialChars);

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
      // Hostname
      const hostname = (await run('hostname', [])).stdout.trim();

      // Kernel
      const kernel = (await run('uname', ['-r'])).stdout.trim();

      // Architecture
      const arch = (await run('uname', ['-m'])).stdout.trim();

      // OS name from /etc/os-release
      const osRelease = (await run('cat', ['/etc/os-release'])).stdout;
      const osMatch = osRelease.match(/^NAME="(.+)"/m);
      const os = osMatch ? osMatch[1] : 'Linux';

      // CPU info — read model name from /proc/cpuinfo and count cores
      let cpuModel = 'Unknown';
      let cpuCores = 1;
      try {
        const cpuinfo = (await run('cat', ['/proc/cpuinfo'])).stdout;
        const modelMatch = cpuinfo.match(/^model name\s*:\s*(.+)$/m);
        if (modelMatch) cpuModel = modelMatch[1].trim();
        // Count processor entries
        const processorCount = (cpuinfo.match(/^processor\s*:/gm) || []).length;
        if (processorCount > 0) cpuCores = processorCount;
      } catch {
        // Fallback: use nproc
        try {
          const nprocResult = await run('nproc', []);
          cpuCores = parseInt(nprocResult.stdout.trim(), 10) || 1;
        } catch { /* keep default */ }
      }

      // RAM info from /proc/meminfo (values in kB)
      let ramTotal = 0;
      let ramAvailable = 0;
      try {
        const meminfo = (await run('cat', ['/proc/meminfo'])).stdout;
        const totalMatch = meminfo.match(/^MemTotal:\s*(\d+)\s*kB/m);
        const availMatch = meminfo.match(/^MemAvailable:\s*(\d+)\s*kB/m);
        if (totalMatch) ramTotal = parseInt(totalMatch[1], 10) * 1024; // convert to bytes
        if (availMatch) ramAvailable = parseInt(availMatch[1], 10) * 1024;
      } catch { /* keep zeros */ }
      const ramUsed = ramTotal - ramAvailable;

      // Disk info from df -h /
      let diskTotal = 0;
      let diskUsed = 0;
      let diskAvailable = 0;
      try {
        const dfResult = await run('df', ['-B1', '/']);
        const lines = dfResult.stdout.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/);
          if (parts.length >= 4) {
            diskTotal = parseInt(parts[1], 10) || 0;
            diskUsed = parseInt(parts[2], 10) || 0;
            diskAvailable = parseInt(parts[3], 10) || 0;
          }
        }
      } catch { /* keep zeros */ }

      // Uptime from /proc/uptime (seconds)
      let uptimeSeconds = 0;
      try {
        const uptimeStr = (await run('cat', ['/proc/uptime'])).stdout.trim();
        const uptimeVal = parseFloat(uptimeStr.split(/\s+/)[0]);
        if (!isNaN(uptimeVal)) uptimeSeconds = Math.floor(uptimeVal);
      } catch { /* keep zero */ }

      // Software versions
      const softwareVersions: Record<string, string> = {};
      const versionChecks: [string, string, string[]][] = [
        ['nginx', 'nginx', ['-v']],
        ['apache', 'apache2ctl', ['-v']],
        ['php', 'php', ['-v']],
        ['mysql', 'mysql', ['--version']],
        ['postgres', 'psql', ['--version']],
        ['node', 'node', ['--version']],
        ['certbot', 'certbot', ['--version']],
        ['cloudflared', 'cloudflared', ['--version']],
      ];
      for (const [name, cmd, args] of versionChecks) {
        try {
          const result = await run(cmd, args);
          if (result.success || result.stdout || result.stderr) {
            // Many version commands output to stderr (e.g., nginx -v)
            const output = (result.stderr || result.stdout).trim();
            const versionMatch = output.match(/(\d+\.[\d.]+)/);
            softwareVersions[name] = versionMatch ? versionMatch[1] : output.split('\n')[0];
          }
        } catch { /* not installed */ }
      }

      return {
        os,
        kernel,
        arch,
        hostname,
        cpu: { model: cpuModel, cores: cpuCores },
        ram: { total: ramTotal, used: ramUsed, available: ramAvailable },
        disk: { total: diskTotal, used: diskUsed, available: diskAvailable },
        uptime: uptimeSeconds,
        softwareVersions,
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
    return { port: getSetting('panelPort', env.PORT) };
  }

  async updatePanelPort(port: number) {
    setSetting('panelPort', port);
    logger.info({ port }, 'Panel port updated');
    return this.getPanelPort();
  }

  // --- Default Web Server ---

  async getDefaultWebServer(): Promise<{ mode: string }> {
    return { mode: getSetting('defaultWebServer', 'nginx') };
  }

  async updateDefaultWebServer(mode: string) {
    setSetting('defaultWebServer', mode);
    logger.info({ mode }, 'Default web server updated');
    return this.getDefaultWebServer();
  }

  // --- Default SSL Email ---

  async getSslEmail(): Promise<{ email: string }> {
    return { email: getSetting('sslEmail', env.LE_EMAIL) };
  }

  async updateSslEmail(email: string) {
    setSetting('sslEmail', email);
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
    return { enabled: getSetting('maintenanceMode', false) };
  }

  async updateMaintenanceMode(enabled: boolean, userId?: string, ipAddress?: string) {
    setSetting('maintenanceMode', enabled);
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
    const settings = loadSettings();
    return {
      identity: await this.getServerIdentity(),
      panel: await this.getPanelSettings(),
      nameservers: await this.getNameserverSettings(),
      session: await this.getSessionSettings(),
      passwordPolicy: await this.getPasswordPolicy(),
      backup: await this.getBackupSettings(),
      ssh: await this.getSshSettings(),
      panelPort: await this.getPanelPort(),
      defaultWebServer: await this.getDefaultWebServer(),
      sslEmail: await this.getSslEmail(),
      maintenance: await this.getMaintenanceMode(),
      dataRetention: await this.getDataRetention(),
      // Include raw settings for completeness
      rawSettings: settings,
    };
  }

  async importConfig(config: Record<string, unknown>) {
    logger.info('Config imported');
    // Persist the raw settings if provided
    if (config.rawSettings && typeof config.rawSettings === 'object') {
      const current = loadSettings();
      const merged = { ...current, ...(config.rawSettings as Record<string, any>) };
      delete merged.rawSettings; // don't store nested rawSettings
      saveSettings(merged);
    }
    return { success: true };
  }

  // --- Data Retention ---

  async getDataRetention(): Promise<{
    auditLogRetentionDays: number;
    logRetentionDays: number;
    backupRetentionCount: number;
  }> {
    return {
      auditLogRetentionDays: getSetting('auditLogRetentionDays', 90),
      logRetentionDays: getSetting('logRetentionDays', 30),
      backupRetentionCount: getSetting('backupRetentionCount', 7),
    };
  }

  async updateDataRetention(data: { auditLogRetentionDays?: number; logRetentionDays?: number; backupRetentionCount?: number }, userId?: string, ipAddress?: string) {
    if (data.auditLogRetentionDays !== undefined) setSetting('auditLogRetentionDays', data.auditLogRetentionDays);
    if (data.logRetentionDays !== undefined) setSetting('logRetentionDays', data.logRetentionDays);
    if (data.backupRetentionCount !== undefined) setSetting('backupRetentionCount', data.backupRetentionCount);

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
