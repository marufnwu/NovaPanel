import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { PhpFpmService } from '../../services/php-fpm.service.js';
import { nginxService } from '../../services/nginx.service.js';
import { auditService } from '../audit/audit.service.js';
import { AppError } from '../../errors.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { run } from '../../services/executor.js';

const DANGEROUS_FUNCTIONS = [
  'exec', 'system', 'passthru', 'popen', 'proc_open',
  'shell_exec', 'eval', 'base64_decode', 'show_source',
  'phpinfo', 'putenv', 'get_current_user',
];

export class PhpService {
  /**
   * List installed PHP versions
   */
  async listVersions() {
    const versions = await PhpFpmService.getInstalledVersions();
    return { versions };
  }

  /**
   * Get PHP config for a domain (full settings)
   */
  async getConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Read current .user.ini for custom settings
    const iniPath = `${domain.documentRoot}/../.user.ini`;
    let customIni = '';
    try {
      customIni = await sudoFs.readFile(iniPath);
    } catch { /* no ini file yet */ }

    // Read FPM pool config for pool settings
    const poolConfPath = `/etc/php/${domain.phpVersion}/fpm/pool.d/${domain.name}.conf`;
    let poolConfig = '';
    try {
      poolConfig = await sudoFs.readFile(poolConfPath);
    } catch { /* no pool config */ }

    return {
      domainId: domain.id,
      domain: domain.name,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler,
      customIni,
      poolConfig,
      // Defaults
      poolSettings: {
        pm: 'dynamic',
        maxChildren: 5,
        startServers: 2,
        minSpareServers: 1,
        maxSpareServers: 3,
        requestTerminateTimeout: 300,
      },
      limits: {
        memoryLimit: '256M',
        maxExecutionTime: 300,
        maxInputTime: 300,
        uploadMaxFilesize: '64M',
        postMaxSize: '64M',
        maxFileUploads: 20,
      },
      security: {
        openBasedir: false,
        disabledFunctions: [] as string[],
      },
    };
  }

  /**
   * Get PHP config by domain name
   */
  async getConfigByName(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return this.getConfig(domain.id);
  }

  /**
   * Set PHP version for a domain
   */
  async setVersion(domainId: string, phpVersion: string, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const oldVersion = domain.phpVersion;

    // Update DB
    await db.update(domains).set({ phpVersion }).where(eq(domains.id, domainId));

    // Regenerate nginx vhost with new PHP version
    await nginxService.removeVhost(domain.name).catch(() => {});
    await nginxService.addVhost({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      phpVersion,
      aliases: [`www.${domain.name}`],
    });

    // Remove old pool config if version changed
    if (oldVersion !== phpVersion) {
      await run('rm', ['-f', `/etc/php/${oldVersion}/fpm/pool.d/${domain.name}.conf`], { sudo: true }).catch(() => {});
    }

    if (userId) {
      await auditService.log({
        userId,
        action: 'php.version.change',
        resource: domain.name,
        details: `Changed from PHP ${oldVersion} to ${phpVersion}`,
      });
    }

    return { phpVersion };
  }

  /**
   * Update PHP-FPM pool settings for a domain
   */
  async updatePoolSettings(domainId: string, settings: {
    pm?: string;
    maxChildren?: number;
    startServers?: number;
    minSpareServers?: number;
    maxSpareServers?: number;
    requestTerminateTimeout?: number;
  }, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Render pool config
    const poolConf = this.renderPoolConfig(domain.name, domain.documentRoot, domain.phpVersion, settings);
    const poolPath = `/etc/php/${domain.phpVersion}/fpm/pool.d/${domain.name}.conf`;
    await sudoFs.writeFile(poolPath, poolConf);

    // Reload FPM
    const phpFpm = new PhpFpmService(domain.phpVersion);
    await phpFpm.reload();

    if (userId) {
      await auditService.log({
        userId,
        action: 'php.pool.update',
        resource: domain.name,
        details: JSON.stringify(settings),
      });
    }

    return { success: true };
  }

  /**
   * Update PHP limits for a domain
   */
  async updateLimits(domainId: string, limits: {
    memoryLimit?: string;
    maxExecutionTime?: number;
    maxInputTime?: number;
    uploadMaxFilesize?: string;
    postMaxSize?: string;
    maxFileUploads?: number;
  }, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Write to .user.ini
    const iniPath = `${domain.documentRoot}/../.user.ini`;
    let existingIni = '';
    try { existingIni = await sudoFs.readFile(iniPath); } catch { /* ok */ }

    const lines = existingIni.split('\n').filter((l) => l.trim());
    const iniMap = new Map(lines.map((l) => {
      const [k, ...rest] = l.split('=');
      return [k.trim(), rest.join('=').trim()];
    }));

    if (limits.memoryLimit) iniMap.set('memory_limit', limits.memoryLimit);
    if (limits.maxExecutionTime) iniMap.set('max_execution_time', String(limits.maxExecutionTime));
    if (limits.maxInputTime) iniMap.set('max_input_time', String(limits.maxInputTime));
    if (limits.uploadMaxFilesize) iniMap.set('upload_max_filesize', limits.uploadMaxFilesize);
    if (limits.postMaxSize) iniMap.set('post_max_size', limits.postMaxSize);
    if (limits.maxFileUploads) iniMap.set('max_file_uploads', String(limits.maxFileUploads));

    const newIni = Array.from(iniMap.entries()).map(([k, v]) => `${k} = ${v}`).join('\n') + '\n';
    await sudoFs.writeFile(iniPath, newIni);

    if (userId) {
      await auditService.log({
        userId,
        action: 'php.limits.update',
        resource: domain.name,
        details: JSON.stringify(limits),
      });
    }

    return { success: true };
  }

  /**
   * Update security settings (open_basedir, disabled functions)
   */
  async updateSecurity(domainId: string, security: {
    openBasedir?: boolean;
    disabledFunctions?: string[];
  }, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const iniPath = `${domain.documentRoot}/../.user.ini`;
    let existingIni = '';
    try { existingIni = await sudoFs.readFile(iniPath); } catch { /* ok */ }

    const lines = existingIni.split('\n').filter((l) => l.trim());
    const iniMap = new Map(lines.map((l) => {
      const [k, ...rest] = l.split('=');
      return [k.trim(), rest.join('=').trim()];
    }));

    if (security.openBasedir !== undefined) {
      if (security.openBasedir) {
        iniMap.set('open_basedir', `${domain.documentRoot}:/tmp:/usr/share/php`);
      } else {
        iniMap.delete('open_basedir');
      }
    }

    if (security.disabledFunctions !== undefined) {
      if (security.disabledFunctions.length > 0) {
        iniMap.set('disable_functions', security.disabledFunctions.join(','));
      } else {
        iniMap.delete('disable_functions');
      }
    }

    const newIni = Array.from(iniMap.entries()).map(([k, v]) => `${k} = ${v}`).join('\n') + '\n';
    await sudoFs.writeFile(iniPath, newIni);

    if (userId) {
      await auditService.log({
        userId,
        action: 'php.security.update',
        resource: domain.name,
        details: JSON.stringify(security),
      });
    }

    return { success: true };
  }

  /**
   * Get per-domain php.ini overrides
   */
  async getIni(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const iniPath = `${domain.documentRoot}/../.user.ini`;
    try {
      const content = await sudoFs.readFile(iniPath);
      return { content };
    } catch {
      return { content: '' };
    }
  }

  /**
   * Update per-domain php.ini overrides
   */
  async updateIni(domainId: string, content: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const iniPath = `${domain.documentRoot}/../.user.ini`;
    await sudoFs.writeFile(iniPath, content);
    return { success: true };
  }

  /**
   * Restart PHP-FPM for a domain
   */
  async restartFpm(domainId: string, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const phpFpm = new PhpFpmService(domain.phpVersion);
    await phpFpm.restart();

    if (userId) {
      await auditService.log({
        userId,
        action: 'php.fpm.restart',
        resource: domain.name,
      });
    }

    return { success: true };
  }

  /**
   * Get list of all domains for the selector
   */
  async listDomains() {
    return db.select({
      id: domains.id,
      name: domains.name,
      phpVersion: domains.phpVersion,
      phpHandler: domains.phpHandler,
    }).from(domains);
  }

  /**
   * Get PHP-FPM pool status for a domain
   */
  async getFpmStatus(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      // Try to get FPM status via the status page
      const statusPath = `/etc/php/${domain.phpVersion}/fpm/pool.d/${domain.name}.conf`;
      let statusPagePath = '/status';
      try {
        const poolConf = await sudoFs.readFile(statusPath);
        const pmStatusMatch = poolConf.match(/pm\.status_path\s*=\s*(.+)/);
        if (pmStatusMatch) statusPagePath = pmStatusMatch[1].trim();
      } catch { /* use default */ }

      // Try fetching from localhost
      const result = await run('curl', ['-s', `http://localhost${statusPagePath}`]);
      if (result.success && result.stdout) {
        return this.parseFpmStatus(result.stdout);
      }
    } catch { /* fall through to default */ }

    // Return default/empty status
    return {
      pool: domain.name,
      processManager: 'dynamic',
      startTime: new Date().toISOString(),
      startSince: 0,
      acceptedConn: 0,
      listenQueue: 0,
      maxListenQueue: 0,
      listenQueueLen: 0,
      idleProcesses: 0,
      activeProcesses: 0,
      totalProcesses: 0,
      maxActiveProcesses: 0,
      maxChildrenReached: 0,
      slowRequests: 0,
    };
  }

  private parseFpmStatus(output: string) {
    const get = (key: string): number => {
      const match = output.match(new RegExp(`${key}:\\s*(\\d+)`, 'i'));
      return match ? parseInt(match[1], 10) : 0;
    };
    const getString = (key: string): string => {
      const match = output.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
      return match ? match[1].trim() : '';
    };

    return {
      pool: getString('pool'),
      processManager: getString('process manager'),
      startTime: getString('start time'),
      startSince: get('start since'),
      acceptedConn: get('accepted conn'),
      listenQueue: get('listen queue'),
      maxListenQueue: get('max listen queue'),
      listenQueueLen: get('listen queue len'),
      idleProcesses: get('idle processes'),
      activeProcesses: get('active processes'),
      totalProcesses: get('total processes'),
      maxActiveProcesses: get('max active processes'),
      maxChildrenReached: get('max children reached'),
      slowRequests: get('slow requests'),
    };
  }

  /**
   * Get PHP info for a domain
   */
  async getPhpInfo(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const result = await run('php', ['-r', 'echo phpinfo(INFO_GENERAL);'], { sudo: true });
      return { html: result.stdout || '<p>PHP info not available</p>' };
    } catch {
      return { html: '<p>PHP info not available</p>' };
    }
  }

  /**
   * Install a PHP version
   */
  async installPhp(version: string, userId?: string) {
    const validVersions = ['8.1', '8.2', '8.3', '8.4'];
    if (!validVersions.includes(version)) {
      throw new Error(`Invalid PHP version: ${version}`);
    }

    try {
      await run('apt-get', ['install', '-y', `php${version}-fpm`, `php${version}-cli`, `php${version}-common`], { sudo: true });

      if (userId) {
        await auditService.log({
          userId,
          action: 'php.install',
          resource: `php${version}`,
          details: `PHP ${version} installed`,
        });
      }

      return { success: true, version };
    } catch (error: any) {
      throw new Error(`Failed to install PHP ${version}: ${error.message}`);
    }
  }

  /**
   * Render PHP-FPM pool config
   */
  private renderPoolConfig(domainName: string, documentRoot: string, phpVersion: string, settings: any): string {
    const pm = settings.pm || 'dynamic';
    const maxChildren = settings.maxChildren || 5;
    const startServers = settings.startServers || 2;
    const minSpare = settings.minSpareServers || 1;
    const maxSpare = settings.maxSpareServers || 3;
    const terminateTimeout = settings.requestTerminateTimeout || 300;

    return `[${domainName}]
user = ${domainName.replace(/\./g, '')}
group = www-data
listen = /run/php/php${phpVersion}-fpm.${domainName}.sock
listen.owner = www-data
listen.group = www-data
pm = ${pm}
pm.max_children = ${maxChildren}
pm.start_servers = ${startServers}
pm.min_spare_servers = ${minSpare}
pm.max_spare_servers = ${maxSpare}
request_terminate_timeout = ${terminateTimeout}
php_admin_value[docroot] = ${documentRoot}
`;
  }
}

export { DANGEROUS_FUNCTIONS };
