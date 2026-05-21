import si from 'systeminformation';
import { loadavg, hostname as osHostname, type } from 'node:os';
import { createReadStream, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { mailboxes } from '../../db/schema/mail.js';
import { databases } from '../../db/schema/databases.js';
import { ftpAccounts } from '../../db/schema/ftp.js';
import { cronJobs } from '../../db/schema/cron.js';
import { sslCertificates } from '../../db/schema/domains.js';
import { serverStats } from '../../db/schema/stats.js';
import { eq, and, lt, count, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { auditService } from '../audit/audit.service.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../errors.js';

const ALLOWED_SERVICES = [
  'nginx', 'apache2', 'named', 'mariadb', 'postgresql',
  'postfix', 'dovecot', 'proftpd', 'ufw', 'fail2ban', 'cloudflared',
  'php8.1-fpm', 'php8.2-fpm', 'php8.3-fpm', 'php8.4-fpm',
];

const restartRateLimitMs = 30_000;
const lastRestartTimes = new Map<string, number>();

export class StatsService {
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

    const ips = networkInterfaces
      .filter((iface) => !iface.internal && iface.ip4)
      .map((iface) => iface.ip4);

    return {
      cpu: { usage: Math.round(cpu.currentLoad), cores: cpu.cpus.length },
      memory: {
        total: mem.total, used: mem.used, available: mem.available,
        cached: mem.cached || 0, buffered: mem.buffcache || 0,
        swapTotal: mem.swaptotal, swapUsed: mem.swapused,
        usagePercent: Math.round((mem.used / mem.total) * 100),
      },
      disk: {
        total: rootDisk?.size || 0, used: rootDisk?.used || 0,
        available: rootDisk?.available || 0, usagePercent: Math.round(rootDisk?.use || 0),
        mount: rootDisk?.mount || '/',
      },
      uptime: time.uptime,
      loadAvg: loadavg(),
      system: { hostname: osHostname(), os: osInfo.distro || type(), kernel: osInfo.kernel || '', arch: osInfo.arch || '', ips },
    };
  }

  async collectAndStore(stats: ServerStats): Promise<void> {
    const networkStats = await this.getNetworkStats();
    await db.insert(serverStats).values({
      id: nanoid(),
      cpuPercent: stats.cpu.usage,
      memoryPercent: Math.round((stats.memory.used / stats.memory.total) * 100),
      memoryUsedMb: Math.round(stats.memory.used / (1024 * 1024)),
      memoryTotalMb: Math.round(stats.memory.total / (1024 * 1024)),
      diskPercent: stats.disk.usagePercent,
      diskUsedMb: Math.round(stats.disk.used / (1024 * 1024)),
      diskTotalMb: Math.round(stats.disk.total / (1024 * 1024)),
      networkIn: networkStats.rxSec,
      networkOut: networkStats.txSec,
    });
  }

  async getDiskDetails(): Promise<DiskMount[]> {
    const disks = await si.fsSize();
    return disks.map((d) => ({
      fs: d.fs || '', mount: d.mount, total: d.size, used: d.used,
      available: d.available, usagePercent: Math.round(d.use || 0),
    }));
  }

  async getServiceStatuses(): Promise<ServiceStatusItem[]> {
    const services = [
      { name: 'nginx', displayName: 'Nginx' }, { name: 'apache2', displayName: 'Apache2' },
      { name: 'named', displayName: 'BIND9 DNS' }, { name: 'mariadb', displayName: 'MariaDB' },
      { name: 'postgresql', displayName: 'PostgreSQL' }, { name: 'postfix', displayName: 'Postfix Mail' },
      { name: 'dovecot', displayName: 'Dovecot IMAP' }, { name: 'proftpd', displayName: 'ProFTPd' },
      { name: 'ufw', displayName: 'UFW Firewall' }, { name: 'fail2ban', displayName: 'Fail2Ban' },
      { name: 'cloudflared', displayName: 'Cloudflare Tunnel' },
    ];

    const statuses: ServiceStatusItem[] = [];
    for (const svc of services) {
      const result = await run('systemctl', ['is-active', svc.name], { sudo: false });
      const active = result.stdout.trim() === 'active';
      statuses.push({ ...svc, status: active ? 'running' : 'stopped' });
    }
    return statuses;
  }

  async restartService(serviceName: string, userId?: string): Promise<{ success: boolean; log?: string }> {
    if (!ALLOWED_SERVICES.includes(serviceName)) {
      throw new Error(`Service '${serviceName}' is not in the allowed list`);
    }

    const now = Date.now();
    const lastRestart = lastRestartTimes.get(serviceName) || 0;
    if (now - lastRestart < restartRateLimitMs) {
      const waitMs = restartRateLimitMs - (now - lastRestart);
      throw new AppError(429, 'SERVICE_RESTART_RATE_LIMITED', `Service restart rate limited. Please wait ${Math.ceil(waitMs / 1000)} seconds before restarting ${serviceName} again.`);
    }
    lastRestartTimes.set(serviceName, now);

    const result = await run('systemctl', ['restart', serviceName], { sudo: true });

    let active = false;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await run('systemctl', ['is-active', serviceName], { sudo: false });
      if (check.stdout.trim() === 'active') { active = true; break; }
    }

    if (userId) {
      await auditService.log({
        userId, action: 'service.restart', resource: serviceName,
        details: active ? 'Service restarted successfully' : 'Service failed to restart',
      });
    }

    if (!active) {
      const journal = await run('journalctl', ['-u', serviceName, '-n', '20', '--no-pager'], { sudo: false });
      return { success: false, log: journal.stdout };
    }
    return { success: true };
  }

  async getDomainStats(domainId: string): Promise<DomainStats> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new Error('Domain not found');
    return { domainId: domain.id, domainName: domain.name, diskUsedMb: 0, status: domain.status, sslEnabled: domain.sslStatus === 'active', phpVersion: '' };
  }

  async getNetworkStats(): Promise<NetworkStats> {
    const stats = await si.networkStats();
    const defaultIface = stats.find((s) => s.iface !== 'lo') || stats[0];
    return { interface: defaultIface?.iface || 'unknown', rxBytes: defaultIface?.rx_bytes || 0, txBytes: defaultIface?.tx_bytes || 0, rxSec: defaultIface?.rx_sec || 0, txSec: defaultIface?.tx_sec || 0 };
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const allDomains = await db.select().from(domains);
    const [{ total: totalMailboxes }] = await db.select({ total: count() }).from(mailboxes);
    const [{ total: totalDatabases }] = await db.select({ total: count() }).from(databases);
    const [{ total: totalFtp }] = await db.select({ total: count() }).from(ftpAccounts);
    const [{ total: totalCron }] = await db.select({ total: count() }).from(cronJobs).where(eq(cronJobs.status, 'active'));
    return {
      totalDomains: allDomains.length, activeDomains: allDomains.filter((d) => d.status === 'active').length,
      suspendedDomains: allDomains.filter((d) => d.status === 'suspended').length,
      sslEnabledDomains: allDomains.filter((d) => d.sslStatus === 'active').length,
      totalMailboxes, totalDatabases, totalFtpAccounts: totalFtp, totalActiveCronJobs: totalCron, expiringSslCerts: 0,
    };
  }

  async getExpiringSslCerts(_days: number = 30): Promise<ExpiringSslCert[]> { return []; }

  async getProcessList(sortBy: 'cpu' | 'memory' = 'cpu', limit: number = 10): Promise<ProcessInfo[]> {
    const processes = await si.processes();
    const sorted = processes.list.filter(p => p.name && p.pid).sort((a, b) => sortBy === 'cpu' ? (b.cpu || 0) - (a.cpu || 0) : (b.mem || 0) - (a.mem || 0)).slice(0, limit);
    return sorted.map(p => ({ pid: p.pid, name: p.name, cpu: Math.round((p.cpu || 0) * 10) / 10, memory: Math.round((p.mem || 0) * 10) / 10, state: p.state || 'unknown' }));
  }

  async getTcpConnections(): Promise<TcpConnectionStats | null> {
    try {
      const connections = await si.networkConnections();
      const tcpConns = connections.filter(c => c.protocol === 'tcp' || c.protocol === 'TCP');
      const established = tcpConns.filter(c => c.state === 'ESTABLISHED').length;
      const timeWait = tcpConns.filter(c => c.state === 'TIME_WAIT').length;
      const closeWait = tcpConns.filter(c => c.state === 'CLOSE_WAIT').length;
      return { established, timeWait, closeWait, total: tcpConns.length };
    } catch {
      return null;
    }
  }

  async getFdStats(): Promise<FdStats | null> {
    try {
      const openFiles = await si.fsOpenFiles();
      if (!openFiles || !Array.isArray(openFiles)) return null;
      const allFds = openFiles.reduce((sum: number, entry: { total?: number }) => sum + (entry.total || 0), 0);
      const maxFd = 65536;
      return { openFd: allFds, maxFd, usagePercent: Math.round((allFds / maxFd) * 100) };
    } catch {
      return null;
    }
  }

  async getDiskIOStats(): Promise<DiskIOStats | null> {
    try {
      const io = await si.disksIO();
      if (!io) return null;
      return {
        readBytesSec: (io as any).rIO_sec || 0,
        writeBytesSec: (io as any).wIO_sec || 0,
        readOpsSec: (io as any).rIO_sec || 0,
        writeOpsSec: (io as any).wIO_sec || 0,
      };
    } catch {
      return null;
    }
  }
  async getDomainBandwidth(): Promise<DomainBandwidthStats[]> { return []; }
}

export interface ServerStats { cpu: { usage: number; cores: number }; memory: { total: number; used: number; available: number; cached: number; buffered: number; swapTotal: number; swapUsed: number; usagePercent: number }; disk: { total: number; used: number; available: number; usagePercent: number; mount: string }; uptime: number; loadAvg: number[]; system: { hostname: string; os: string; kernel: string; arch: string; ips: string[] } }
export interface DiskMount { fs: string; mount: string; total: number; used: number; available: number; usagePercent: number }
export interface ServiceStatusItem { name: string; displayName: string; status: 'running' | 'stopped' | 'error' }
export interface DomainStats { domainId: string; domainName: string; diskUsedMb: number; status: string; sslEnabled: boolean; phpVersion: string }
export interface NetworkStats { interface: string; rxBytes: number; txBytes: number; rxSec: number; txSec: number }
export interface DashboardSummary { totalDomains: number; activeDomains: number; suspendedDomains: number; sslEnabledDomains: number; totalMailboxes: number; totalDatabases: number; totalFtpAccounts: number; totalActiveCronJobs: number; expiringSslCerts: number }
export interface ExpiringSslCert { id: string; domainId: string; domainName: string; issuer: string; expiresAt: string; daysUntilExpiry: number }
export interface ProcessInfo { pid: number; name: string; cpu: number; memory: number; state: string }
export interface TcpConnectionStats { established: number; timeWait: number; closeWait: number; total: number }
export interface FdStats { openFd: number; maxFd: number; usagePercent: number }
export interface DiskIOStats { readBytesSec: number; writeBytesSec: number; readOpsSec: number; writeOpsSec: number }
export interface DomainBandwidthStats { domainId: string; domainName: string; incomingBytes: number; outgoingBytes: number; totalBytes: number }