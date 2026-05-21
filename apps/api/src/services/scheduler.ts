import cron, { type ScheduledTask } from 'node-cron';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/users.js';
import { notifications } from '../db/schema/notifications.js';
import { users } from '../db/schema/users.js';
import { lt } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import { emitJobRunning, emitJobDone, emitJobFailed } from './job-events.js';

export class SchedulerService {
  private tasks: ScheduledTask[] = [];

  private async getAdminUserId(): Promise<string | null> {
    const [admin] = await db.select({ id: users.id }).from(users).limit(1);
    return admin?.id ?? null;
  }

  start() {
    const statsTask = cron.schedule('*/5 * * * *', async () => {
      const jobId = `stats-collection-${Date.now()}`;
      emitJobRunning(jobId, 'stats-collection', 'Scheduled stats collection started', 0);
      try {
        emitJobDone(jobId, 'stats-collection', 'Scheduled stats collection completed (stub)');
        logger.info('Scheduled stats collection completed (stub)');
      } catch (err) {
        emitJobFailed(jobId, 'stats-collection', `Stats collection failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Scheduled stats collection failed');
      }
    });
    this.tasks.push(statsTask);

    const sslTask = cron.schedule('0 3 * * *', async () => {
      const jobId = `ssl-renewal-${Date.now()}`;
      emitJobRunning(jobId, 'ssl-renewal', 'SSL renewal check started', 0);
      try {
        emitJobDone(jobId, 'ssl-renewal', 'SSL renewal check completed (stub - SSL service not migrated)');
        logger.info('SSL renewal check completed (stub)');
      } catch (err) {
        emitJobFailed(jobId, 'ssl-renewal', `SSL renewal check failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'SSL renewal check failed');
      }
    });
    this.tasks.push(sslTask);

    const backupTask = cron.schedule('* * * * *', async () => {
      const jobId = `backup-scheduler-${Date.now()}`;
      emitJobRunning(jobId, 'backup-scheduler', 'Checking for due backups...', 0);
      try {
        emitJobDone(jobId, 'backup-scheduler', 'Backup scheduler check completed (stub)');
      } catch (err) {
        emitJobFailed(jobId, 'backup-scheduler', `Backup scheduler failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Backup scheduler failed');
      }
    });
    this.tasks.push(backupTask);

    const sessionTask = cron.schedule('0 * * * *', async () => {
      const jobId = `session-cleanup-${Date.now()}`;
      emitJobRunning(jobId, 'session-cleanup', 'Cleaning up expired sessions...', 0);
      try {
        await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        emitJobDone(jobId, 'session-cleanup', `Session cleanup completed`);
        logger.info('Expired sessions cleaned up');
      } catch (err) {
        emitJobFailed(jobId, 'session-cleanup', `Session cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Session cleanup failed');
      }
    });
    this.tasks.push(sessionTask);

    const notificationTask = cron.schedule('0 4 * * *', async () => {
      const jobId = `notification-cleanup-${Date.now()}`;
      emitJobRunning(jobId, 'notification-cleanup', 'Cleaning up old notifications...', 0);
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
        emitJobDone(jobId, 'notification-cleanup', `Old notifications cleaned up`);
        logger.info('Old notifications cleaned up');
      } catch (err) {
        emitJobFailed(jobId, 'notification-cleanup', `Notification cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Notification cleanup failed');
      }
    });
    this.tasks.push(notificationTask);

    logger.info('Scheduler started with 5 cron jobs');
  }

  stop() {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    logger.info('Scheduler stopped');
  }
}
