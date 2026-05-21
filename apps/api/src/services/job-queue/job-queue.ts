import { db } from '../../db/index.js';
import { backgroundJobs, type BackgroundJob, type NewBackgroundJob } from '../../db/schema/background_jobs.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../../config/logger.js';
import { jobHandlers, JOB_TYPES } from './index.js';

const WORKER_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_CONCURRENT_JOBS = 3;
const METRIC_INTERVAL_MS = 60000; // Collect metrics every 60 seconds
const ALERT_INTERVAL_MS = 60000; // Evaluate alerts every 60 seconds

class JobQueueService {
  private isRunning = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private metricInterval: NodeJS.Timeout | null = null;
  private alertInterval: NodeJS.Timeout | null = null;
  private processingCount = 0;

  /**
   * Start the job queue worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Job queue worker already running');
      return;
    }

    this.isRunning = true;
    logger.info('Job queue worker started');

    // Poll for pending jobs
    this.workerInterval = setInterval(() => {
      this.processJobs().catch(err => {
        logger.error({ err }, 'Job processing error');
      });
    }, WORKER_INTERVAL_MS);

    // Schedule recurring metrics collection
    this.metricInterval = setInterval(() => {
      this.enqueue(JOB_TYPES.METRIC_COLLECT, {}, { maxRetries: 1 }).catch(err => {
        logger.error({ err }, 'Failed to enqueue metric collect');
      });
    }, METRIC_INTERVAL_MS);

    // Schedule recurring alert evaluation
    this.alertInterval = setInterval(() => {
      this.enqueue(JOB_TYPES.ALERT_EVALUATE, {}, { maxRetries: 1 }).catch(err => {
        logger.error({ err }, 'Failed to enqueue alert evaluate');
      });
    }, ALERT_INTERVAL_MS);

    // Process immediately on start
    this.processJobs().catch(err => {
      logger.error({ err }, 'Initial job processing error');
    });

    // Enqueue initial metric and alert jobs
    this.enqueue(JOB_TYPES.METRIC_COLLECT, {}, { maxRetries: 1 });
    this.enqueue(JOB_TYPES.ALERT_EVALUATE, {}, { maxRetries: 1 });
  }

  /**
   * Stop the job queue worker
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    if (this.metricInterval) {
      clearInterval(this.metricInterval);
      this.metricInterval = null;
    }
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }
    logger.info('Job queue worker stopped');
  }

  /**
   * Enqueue a new job
   */
  async enqueue(
    type: string,
    payload: Record<string, unknown>,
    options: {
      dedupeKey?: string;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const { maxRetries = 3 } = options;

    const jobId = nanoid();
    const newJob: NewBackgroundJob = {
      id: jobId,
      type,
      payload,
      status: 'pending',
      maxAttempts: maxRetries,
      runAt: new Date(),
    };

    await db.insert(backgroundJobs).values(newJob);
    logger.debug({ jobId, type }, 'Job enqueued');

    return jobId;
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    if (this.processingCount >= MAX_CONCURRENT_JOBS) {
      return; // Too many jobs running
    }

    // Get pending jobs
    const pendingJobs = await db.select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.status, 'pending'))
      .limit(MAX_CONCURRENT_JOBS - this.processingCount);

    for (const job of pendingJobs) {
      this.processJob(job).catch(err => {
        logger.error({ err, jobId: job.id }, 'Job processing failed');
      });
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: BackgroundJob): Promise<void> {
    const handler = jobHandlers[job.type];
    if (!handler) {
      logger.error({ jobId: job.id, type: job.type }, 'No handler found for job type');
      await this.completeJob(job.id, 'failed', { error: `Unknown job type: ${job.type}` });
      return;
    }

    this.processingCount++;

    try {
      // Mark as running
      await db.update(backgroundJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(backgroundJobs.id, job.id));

      logger.debug({ jobId: job.id, type: job.type }, 'Processing job');

      // Execute handler
      const result = await handler(job.payload as Record<string, unknown>);

      if (result.success) {
        await this.completeJob(job.id, 'success', result);
      } else {
        await this.handleJobFailure(job, result.error || 'Job failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.handleJobFailure(job, message);
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: BackgroundJob, error: string): Promise<void> {
    const newAttempts = job.attempts + 1;

    if (newAttempts < job.maxAttempts) {
      // Retry job
      logger.warn({ jobId: job.id, attempts: newAttempts, maxAttempts: job.maxAttempts, error }, 'Job failed, will retry');

      await db.update(backgroundJobs)
        .set({
          status: 'pending',
          attempts: newAttempts,
          result: { error },
        })
        .where(eq(backgroundJobs.id, job.id));
    } else {
      // Max retries exceeded
      logger.error({ jobId: job.id, attempts: newAttempts, error }, 'Job failed permanently');
      await this.completeJob(job.id, 'failed', { error });
    }
  }

  /**
   * Mark job as completed
   */
  private async completeJob(jobId: string, status: 'success' | 'failed', result: unknown): Promise<void> {
    await db.update(backgroundJobs)
      .set({
        status,
        result: status === 'success' ? result : { error: (result as { error?: string }).error },
        completedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, jobId));

    logger.debug({ jobId, status }, 'Job completed');
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<BackgroundJob | null> {
    const [job] = await db.select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);
    return job || null;
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const [job] = await db.select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);

    if (!job || job.status !== 'pending') {
      return false;
    }

    await db.update(backgroundJobs)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(backgroundJobs.id, jobId));

    return true;
  }

  /**
   * List jobs with filters
   */
  async listJobs(filters: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: BackgroundJob[]; total: number }> {
    const conditions = [];
    if (filters.status) conditions.push(eq(backgroundJobs.status, filters.status as any));
    if (filters.type) conditions.push(eq(backgroundJobs.type, filters.type));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const items = await db.select()
      .from(backgroundJobs)
      .where(where)
      .orderBy(backgroundJobs.createdAt)
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: backgroundJobs.id })
      .from(backgroundJobs)
      .where(where);

    return { items, total: total as unknown as number };
  }
}

// Singleton instance
export const jobQueue = new JobQueueService();