import si from 'systeminformation';
import { loadavg, hostname as osHostname, type } from 'node:os';
import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { mailboxes } from '../../db/schema/email.js';
import { databases } from '../../db/schema/databases.js';
import { ftpAccounts } from '../../db/schema/ftp.js';
import { cronJobs } from '../../db/schema/cron.js';
import { sslCertificates } from '../../db/schema/ssl.js';
import { serverStats } from '../../db/schema/stats.js';
import { eq, and, lt, count, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { auditService } from '../audit/audit.service.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../errors.js';

const ALLOWED_SERVICES = [
  'nginx', 'apache2', 'bind9', 'mariadb', 'postgresql',
  'postfix', 'dovecot', 'proftpd', 'ufw', 'fail2ban', 'cloudflared',
  'php8.1-fpm', 'php8.2-fpm', 'php8.3-fpm', 'php8.4-fpm',
];

/** Rate limiter for service restarts — tracks last restart time per service (ISSUE-14) */
const restartRateLimitMs = 30_000; // 30 seconds cooldown
const lastRestartTimes = new Map<string, number>();

export class StatsService {
  /**
   * Get real-time server stats: CPU, RAM, Disk, Uptime, Load, OS info
   */
  async getServerStats(): Promise<ServerStats> {
    const [cpu, mem, disk, time, osInfo, networkInterfaces] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
      si.osInfo(),
      si.networkInterfaces(),
    ]);

    const rootDisk = disk.find((d) => d.mount === '/') || disk[0];

    // Get server IPs (exclude internal/loopback)
    const ips = networkInterfaces
      .filter((iface) => !iface.internal && iface.ip4)
      .map((iface) => iface.ip4);

    return {
      cpu: {
        usage: Math.round(cpu.currentLoad),
        cores: cpu.cpus.length,
      },
      memory: {
        total: mem.total,
        used: mem.used,
        available: mem.available,
        cached: mem.cached || 0,
        buffered: mem.buffcache || 0,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
        usagePercent: Math.round((mem.used / mem.total) * 100),
      },
      disk: {
        total: rootDisk?.size || 0,
        used: rootDisk?.used || 0,
        available: rootDisk?.available || 0,
        usagePercent: Math.round(rootDisk?.use || 0),
        mount: rootDisk?.mount || '/',
      },
      uptime: time.uptime,
      loadAvg: loadavg(),
      system: {
        hostname: osHostname(),
        os: osInfo.distro || type(),
        kernel: osInfo.kernel || '',
        arch: osInfo.arch || '',
        ips,
      },
    };
  }

  /**
   * Collect server stats and store them in the server_stats table
   */
  async collectAndStore(stats: ServerStats): Promise<void> {
    const networkStats = await this.getNetworkStats();

    await db.insert(serverStats).values({
      id: nanoid(),
      cpuUsage: stats.cpu.usage,
      memoryUsed: stats.memory.used,
      memoryTotal: stats.memory.total,
      diskUsed: stats.disk.used,
      diskTotal: stats.disk.total,
      networkRx: networkStats.rxSec,
      networkTx: networkStats.txSec,
      loadAvg1: stats.loadAvg[0] ?? null,
      loadAvg5: stats.loadAvg[1] ?? null,
      loadAvg15: stats.loadAvg[2] ?? null,
      uptime: stats.uptime,
    });
  }

  /**
   * Get all disk mount points
   */
  async getDiskDetails(): Promise<DiskMount[]> {
    const disks = await si.fsSize();
    return disks.map((d) => ({
      fs: d.fs || '',
      mount: d.mount,
      total: d.size,
      used: d.used,
      available: d.available,
      usagePercent: Math.round(d.use || 0),
    }));
  }

  /**
   * Get status of all managed services
   */
  async getServiceStatuses(): Promise<ServiceStatusItem[]> {
    const services = [
      { name: 'nginx', displayName: 'Nginx' },
      { name: 'apache2', displayName: 'Apache2' },
      { name: 'bind9', displayName: 'BIND9 DNS' },
      { name: 'mariadb', displayName: 'MariaDB' },
      { name: 'postgresql', displayName: 'PostgreSQL' },
      { name: 'postfix', displayName: 'Postfix Mail' },
      { name: 'dovecot', displayName: 'Dovecot IMAP' },
      { name: 'proftpd', displayName: 'ProFTPd' },
      { name: 'ufw', displayName: 'UFW Firewall' },
      { name: 'fail2ban', displayName: 'Fail2Ban' },
      { name: 'cloudflared', displayName: 'Cloudflare Tunnel' },
    ];

    const statuses: ServiceStatusItem[] = [];
    for (const svc of services) {
      const result = await run('systemctl', ['is-active', svc.name], { sudo: true });
      const active = result.stdout.trim() === 'active';
      statuses.push({
        ...svc,
        status: active ? 'running' : 'stopped',
      });
    }
    return statuses;
  }

  /**
   * Restart a service by name
   */
  async restartService(serviceName: string, userId?: string): Promise<{ success: boolean; log?: string }> {
    if (!ALLOWED_SERVICES.includes(serviceName)) {
      throw new Error(`Service '${serviceName}' is not in the allowed list`);
    }

    // ISSUE-14: Rate limit check — prevent rapid restarts within 30 seconds
    const now = Date.now();
    const lastRestart = lastRestartTimes.get(serviceName) || 0;
    if (now - lastRestart < restartRateLimitMs) {
      const waitMs = restartRateLimitMs - (now - lastRestart);
      throw new AppError(429, 'SERVICE_RESTART_RATE_LIMITED', `Service restart rate limited. Please wait ${Math.ceil(waitMs / 1000)} seconds before restarting ${serviceName} again.`);
    }
    lastRestartTimes.set(serviceName, now);

    const result = await run('systemctl', ['restart', serviceName], { sudo: true });

    // Wait up to 5s for service to become active
    let active = false;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await run('systemctl', ['is-active', serviceName], { sudo: true });
      if (check.stdout.trim() === 'active') {
        active = true;
        break;
      }
    }

    if (userId) {
      await auditService.log({
        userId,
        action: 'service.restart',
        resource: serviceName,
        details: active ? 'Service restarted successfully' : 'Service failed to restart',
      });
    }

    if (!active) {
      // Get last 20 journal lines for debugging
      const journal = await run('journalctl', ['-u', serviceName, '-n', '20', '--no-pager'], { sudo: true });
      return { success: false, log: journal.stdout };
    }

    return { success: true };
  }

  /**
   * Get per-domain stats (disk usage)
   */
  async getDomainStats(domainId: string): Promise<DomainStats> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new Error('Domain not found');

    // Get disk usage via du
    const result = await run('du', ['-sm', domain.documentRoot], { sudo: true });
    const usedMb = parseInt(result.stdout.split('\t')[0], 10) || 0;

    return {
      domainId: domain.id,
      domainName: domain.name,
      diskUsedMb: usedMb,
      status: domain.status,
      sslEnabled: domain.sslEnabled,
      phpVersion: domain.phpVersion,
    };
  }

  /**
   * Get network I/O stats
   */
  async getNetworkStats(): Promise<NetworkStats> {
    const stats = await si.networkStats();
    const defaultIface = stats.find((s) => s.iface !== 'lo') || stats[0];
    return {
      interface: defaultIface?.iface || 'unknown',
      rxBytes: defaultIface?.rx_bytes || 0,
      txBytes: defaultIface?.tx_bytes || 0,
      rxSec: defaultIface?.rx_sec || 0,
      txSec: defaultIface?.tx_sec || 0,
    };
  }

  /**
   * Get summary counts for dashboard (single-admin: no subscriptions)
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const allDomains = await db.select().from(domains);

      const [{ total: totalMailboxes }] = await db.select({ total: count() }).from(mailboxes);
      const [{ total: totalDatabases }] = await db.select({ total: count() }).from(databases);
      const [{ total: totalFtp }] = await db.select({ total: count() }).from(ftpAccounts);
      const [{ total: totalCron }] = await db.select({ total: count() }).from(cronJobs).where(eq(cronJobs.isActive, true));

      // Expiring SSL certs (< 30 days)
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      let expiringCertsCount = 0;
      try {
        const expiringCerts = await db.select().from(sslCertificates)
          .where(lt(sslCertificates.expiresAt, thirtyDaysFromNow));
        expiringCertsCount = expiringCerts.length;
      } catch (error: any) {
        // SSL table may have issues — return 0 gracefully
        logger.warn({ error: error.message }, 'Failed to query expiring SSL certs — returning 0');
      }

      return {
        totalDomains: allDomains.length,
        activeDomains: allDomains.filter((d) => d.status === 'active').length,
        suspendedDomains: allDomains.filter((d) => d.status === 'suspended').length,
        sslEnabledDomains: allDomains.filter((d) => d.sslEnabled).length,
        totalMailboxes,
        totalDatabases,
        totalFtpAccounts: totalFtp,
        totalActiveCronJobs: totalCron,
        expiringSslCerts: expiringCertsCount,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get dashboard summary');
      throw new Error(`Failed to get dashboard summary: ${error.message}`);
    }
  }

  /**
   * Get expiring SSL certificates with details
   */
  async getExpiringSslCerts(days: number = 30): Promise<ExpiringSslCert[]> {
    try {
      const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const certs = await db.select().from(sslCertificates)
        .where(lt(sslCertificates.expiresAt, threshold));

      // Enrich with domain names
      const allDomains = await db.select({
        id: domains.id,
        name: domains.name,
      }).from(domains);

      const domainMap = new Map(allDomains.map((d) => [d.id, d.name]));

      return certs.map((cert) => ({
        id: cert.id,
        domainId: cert.domainId || 'unknown',
        domainName: cert.domainId ? (domainMap.get(cert.domainId) || 'Unknown') : 'Unknown',
        issuer: cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'self-signed' ? 'Self-Signed' : 'Custom',
        expiresAt: cert.expiresAt ? cert.expiresAt.toISOString() : new Date().toISOString(),
        daysUntilExpiry: cert.expiresAt ? Math.ceil((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
      }));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get expiring SSL certs');
      // Return empty array instead of throwing — allows dashboard to still render
      return [];
    }
  }

  /**
   * Get top processes by CPU or memory usage
   */
  async getProcessList(sortBy: 'cpu' | 'memory' = 'cpu', limit: number = 10): Promise<ProcessInfo[]> {
    const processes = await si.processes();
    
    const sorted = processes.list
      .filter(p => p.name && p.pid)
      .sort((a, b) => {
        if (sortBy === 'cpu') return (b.cpu || 0) - (a.cpu || 0);
        return (b.mem || 0) - (a.mem || 0);
      })
      .slice(0, limit);

    return sorted.map(p => ({
      pid: p.pid,
      name: p.name,
      cpu: Math.round((p.cpu || 0) * 10) / 10,
      memory: Math.round((p.mem || 0) * 10) / 10,
      state: p.state || 'unknown',
    }));
  }

  /**
   * Get TCP connection statistics
   */
  async getTcpConnections(): Promise<TcpConnectionStats> {
    try {
      const result = await run('ss', ['-s']);
      const output = result.stdout;

      let established = 0;
      let timeWait = 0;
      let closeWait = 0;
      let total = 0;

      // Parse "ss -s" output
      const estMatch = output.match(/ESTAB\s+(\d+)/);
      if (estMatch) established = parseInt(estMatch[1], 10);

      const twMatch = output.match(/TIME-WAIT\s+(\d+)/);
      if (twMatch) timeWait = parseInt(twMatch[1], 10);

      const cwMatch = output.match(/CLOSE-WAIT\s+(\d+)/);
      if (cwMatch) closeWait = parseInt(cwMatch[1], 10);

      const totalMatch = output.match(/Total:\s+(\d+)/);
      if (totalMatch) total = parseInt(totalMatch[1], 10);
      else total = established + timeWait + closeWait;

      return { established, timeWait, closeWait, total };
    } catch {
      return { established: 0, timeWait: 0, closeWait: 0, total: 0 };
    }
  }

  /**
   * Get file descriptor statistics
   */
  async getFdStats(): Promise<FdStats> {
    try {
      const result = await run('cat', ['/proc/sys/fs/file-nr']);
      const parts = result.stdout.trim().split(/\s+/);
      const openFd = parseInt(parts[0], 10) || 0;
      const maxFd = parseInt(parts[2], 10) || 0;
      const usagePercent = maxFd > 0 ? Math.round((openFd / maxFd) * 100) : 0;
      return { openFd, maxFd, usagePercent };
    } catch {
      // Fallback: try sysctl
      try {
        const result = await run('cat', ['/proc/sys/fs/file-max']);
        const maxFd = parseInt(result.stdout.trim(), 10) || 65536;
        return { openFd: 0, maxFd, usagePercent: 0 };
      } catch {
        return { openFd: 0, maxFd: 65536, usagePercent: 0 };
      }
    }
  }

  /**
   * Get disk I/O statistics
   */
  async getDiskIOStats(): Promise<DiskIOStats> {
    try {
      const stats = await si.disksIO();
      return {
        readBytesSec: Math.round(stats.rIO_sec || 0),
        writeBytesSec: Math.round(stats.wIO_sec || 0),
        readOpsSec: Math.round(stats.rIO_sec || 0),
        writeOpsSec: Math.round(stats.wIO_sec || 0),
      };
    } catch {
      return { readBytesSec: 0, writeBytesSec: 0, readOpsSec: 0, writeOpsSec: 0 };
    }
  }

  /**
   * Get per-domain bandwidth statistics
   */
  async getDomainBandwidth(): Promise<DomainBandwidthStats[]> {
    try {
      const allDomains = await db.select({
        id: domains.id,
        name: domains.name,
      }).from(domains);

      // Return mock/empty data for now — real implementation would parse log files
      return allDomains.map(d => ({
        domainId: d.id,
        domainName: d.name,
        incomingBytes: 0,
        outgoingBytes: 0,
        totalBytes: 0,
      }));
    } catch {
      return [];
    }
  }
}

export interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; available: number; cached: number; buffered: number; swapTotal: number; swapUsed: number; usagePercent: number };
  disk: { total: number; used: number; available: number; usagePercent: number; mount: string };
  uptime: number;
  loadAvg: number[];
  system: { hostname: string; os: string; kernel: string; arch: string; ips: string[] };
}

export interface DiskMount {
  fs: string;
  mount: string;
  total: number;
  used: number;
  available: number;
  usagePercent: number;
}

export interface ServiceStatusItem {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
}

export interface DomainStats {
  domainId: string;
  domainName: string;
  diskUsedMb: number;
  status: string;
  sslEnabled: boolean;
  phpVersion: string;
}

export interface NetworkStats {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxSec: number;
  txSec: number;
}

export interface DashboardSummary {
  totalDomains: number;
  activeDomains: number;
  suspendedDomains: number;
  sslEnabledDomains: number;
  totalMailboxes: number;
  totalDatabases: number;
  totalFtpAccounts: number;
  totalActiveCronJobs: number;
  expiringSslCerts: number;
}

export interface ExpiringSslCert {
  id: string;
  domainId: string;
  domainName: string;
  issuer: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  state: string;
}

export interface TcpConnectionStats {
  established: number;
  timeWait: number;
  closeWait: number;
  total: number;
}

export interface FdStats {
  openFd: number;
  maxFd: number;
  usagePercent: number;
}

export interface DiskIOStats {
  readBytesSec: number;
  writeBytesSec: number;
  readOpsSec: number;
  writeOpsSec: number;
}

export interface DomainBandwidthStats {
  domainId: string;
  domainName: string;
  incomingBytes: number;
  outgoingBytes: number;
  totalBytes: number;
}
