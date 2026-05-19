import { createServer } from './server.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { SchedulerService } from './services/scheduler.js';
import { jobQueue } from './services/job-queue/index.js';
import { reconciler } from './services/reconciler/index.js';

async function main() {
  const server = await createServer();

  await server.listen({ port: env.PORT, host: env.HOST });
  logger.info(`ServerForge API running on ${env.HOST}:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);

  // Start background job scheduler
  const scheduler = new SchedulerService();
  scheduler.start();

  // Start job queue worker (processes background jobs)
  jobQueue.start();
  logger.info('Job queue worker started');

  // Start reconciler loop (monitors and repairs infrastructure drift)
  reconciler.start();
  logger.info('Reconciler loop started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop all background services
    reconciler.stop();
    jobQueue.stop();
    scheduler.stop();

    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
