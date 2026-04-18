import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { performUptimeCheck, recordUptimeCheck, evaluateAlerts } from '../services/monitoring.service.js';

export const monitoringQueue = new Queue('monitoring', { connection: redis });

// ─── Uptime Check Worker ───

const uptimeWorker = new Worker(
  'monitoring',
  async (job) => {
    if (job.name !== 'uptime-check') return;

    const checks = await prisma.uptimeCheck.findMany({
      include: { site: { select: { domain: true, serverId: true } } },
    });

    for (const check of checks) {
      try {
        const url = check.url || `https://${check.site.domain}`;
        const result = await performUptimeCheck(url);
        await recordUptimeCheck(check.siteId, check.id, result);

        // Evaluate alerts for this site
        await evaluateAlerts(check.site.serverId, check.siteId);
      } catch (err) {
        console.error(`Uptime check failed for ${check.site.domain}:`, err instanceof Error ? err.message : err);
      }
    }
  },
  { connection: redis, concurrency: 1 },
);

// ─── Alert Evaluation Worker ───

const alertWorker = new Worker(
  'monitoring',
  async (job) => {
    if (job.name !== 'alert-eval') return;

    const servers = await prisma.server.findMany({
      where: { deletedAt: null, status: 'online' },
      select: { id: true },
    });

    for (const server of servers) {
      await evaluateAlerts(server.id, null);
    }
  },
  { connection: redis, concurrency: 1 },
);

uptimeWorker.on('failed', (job, err) => {
  console.error(`Monitoring job ${job?.id} failed:`, err.message);
});

alertWorker.on('failed', (job, err) => {
  console.error(`Alert eval job ${job?.id} failed:`, err.message);
});

// ─── Scheduler ───

export async function startMonitoringJob(): Promise<void> {
  // Uptime checks every 60s
  await monitoringQueue.add('uptime-check', {}, {
    repeat: { every: 60_000 },
  });

  // Alert evaluation every 60s
  await monitoringQueue.add('alert-eval', {}, {
    repeat: { every: 60_000 },
  });
}
