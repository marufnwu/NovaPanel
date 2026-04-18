import { exec } from './ssh.service.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export interface SystemMetrics {
  cpuPercent: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number | null;
  diskTotal: number | null;
  netIn: number | null;
  netOut: number | null;
  loadAvg: { '1m': number; '5m': number; '15m': number } | null;
}

export async function collectMetrics(serverId: string): Promise<SystemMetrics> {
  const [cpuOut, memOut, diskOut, loadOut] = await Promise.all([
    exec(serverId, "grep 'cpu ' /proc/stat | head -1"),
    exec(serverId, 'free -b | grep Mem'),
    exec(serverId, "df -B1 / | tail -1"),
    exec(serverId, 'cat /proc/loadavg'),
  ]);

  // Parse CPU
  const cpuParts = cpuOut.trim().split(/\s+/);
  const user = parseInt(cpuParts[1]) || 0;
  const nice = parseInt(cpuParts[2]) || 0;
  const system = parseInt(cpuParts[3]) || 0;
  const idle = parseInt(cpuParts[4]) || 0;
  const total = user + nice + system + idle;
  const cpuPercent = total > 0 ? ((user + nice + system) / total) * 100 : 0;

  // Parse RAM
  const memParts = memOut.trim().split(/\s+/);
  const ramTotal = parseInt(memParts[1]) || 0;
  const ramUsed = parseInt(memParts[2]) || 0;

  // Parse Disk
  const diskParts = diskOut.trim().split(/\s+/);
  const diskTotal = parseInt(diskParts[1]) || null;
  const diskUsed = parseInt(diskParts[2]) || null;

  // Parse Load
  const loadParts = loadOut.trim().split(/\s+/);
  const loadAvg = loadParts.length >= 3
    ? { '1m': parseFloat(loadParts[0]), '5m': parseFloat(loadParts[1]), '15m': parseFloat(loadParts[2]) }
    : null;

  const metrics: SystemMetrics = {
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    ramUsed,
    ramTotal,
    diskUsed,
    diskTotal,
    netIn: null,
    netOut: null,
    loadAvg,
  };

  return metrics;
}

export async function storeMetrics(serverId: string, metrics: SystemMetrics): Promise<void> {
  // Store in PostgreSQL
  await prisma.metric.create({
    data: {
      serverId,
      cpuPercent: metrics.cpuPercent,
      ramUsed: metrics.ramUsed,
      ramTotal: metrics.ramTotal,
      diskUsed: metrics.diskUsed,
      diskTotal: metrics.diskTotal,
      netIn: metrics.netIn,
      netOut: metrics.netOut,
      loadAvg: metrics.loadAvg as any,
    },
  });

  // Cache latest in Redis
  await redis.set(
    `metrics:latest:${serverId}`,
    JSON.stringify({ ...metrics, recordedAt: new Date().toISOString() }),
    'EX',
    120,
  );
}

export async function getLatestMetrics(serverId: string): Promise<(SystemMetrics & { recordedAt: string }) | null> {
  const cached = await redis.get(`metrics:latest:${serverId}`);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function getMetricsHistory(
  serverId: string,
  from: Date,
  to: Date,
): Promise<Array<SystemMetrics & { recordedAt: Date }>> {
  const metrics = await prisma.metric.findMany({
    where: {
      serverId,
      recordedAt: { gte: from, lte: to },
    },
    orderBy: { recordedAt: 'asc' },
    take: 500,
  });

  return metrics.map((m) => ({
    cpuPercent: m.cpuPercent,
    ramUsed: m.ramUsed,
    ramTotal: m.ramTotal,
    diskUsed: m.diskUsed,
    diskTotal: m.diskTotal,
    netIn: m.netIn,
    netOut: m.netOut,
    loadAvg: m.loadAvg as SystemMetrics['loadAvg'],
    recordedAt: m.recordedAt,
  }));
}
