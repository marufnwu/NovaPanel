import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { collectMetrics, storeMetrics } from '../services/metrics.service.js';
import { decryptAndConnect, getAllConnectedIds, isConnected } from '../services/ssh.service.js';

export const metricsQueue = new Queue('metrics', { connection: redis });

const worker = new Worker(
  'metrics',
  async () => {
    const servers = await prisma.server.findMany({
      where: { deletedAt: null },
      include: { sshKey: true },
    });

    for (const server of servers) {
      try {
        if (!isConnected(server.id)) {
          await decryptAndConnect(server.id, server);
        }

        const metrics = await collectMetrics(server.id);
        await storeMetrics(server.id, metrics);
      } catch {
        // Connection or collection failed — skip this server
        await prisma.server.update({
          where: { id: server.id },
          data: { status: 'offline' },
        }).catch(() => {});
      }
    }
  },
  { connection: redis, concurrency: 1 },
);

worker.on('failed', (job, err) => {
  console.error(`Metrics job ${job?.id} failed:`, err.message);
});

// Repeat every 60 seconds
export async function startMetricsJob() {
  await metricsQueue.add('poll', {}, { repeat: { every: 60000 } });
}
