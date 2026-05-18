import cron, { type ScheduledTask } from 'node-cron';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/users.js';
import { notifications } from '../db/schema/notifications.js';
import { users } from '../db/schema/users.js';
import { lt } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import { StatsService } from '../modules/stats/stats.service.js';
import { SslService } from '../modules/ssl/ssl.service.js';
import { BackupService } from '../modules/backup/backup.service.js';
import { notificationsService } from '../modules/notifications/notifications.service.js';
import { emitJobRunning, emitJobDone, emitJobFailed } from './job-events.js';

export class SchedulerService {
  private statsService = new StatsService();
  private sslService = new SslService();
  private backupService = new BackupService();
  private tasks: ScheduledTask[] = [];

  /**
   * Get the single admin user ID for system notifications
   */
  private async getAdminUserId(): Promise<string | null> {
    const [admin] = await db.select({ id: users.id }).from(users).limit(1);
    return admin?.id ?? null;
  }

  start() {
    // Stats collection — every 5 minutes
    const statsTask = cron.schedule('*/5 * * * *', async () => {
      const jobId = `stats-collection-${Date.now()}`;
      emitJobRunning(jobId, 'stats-collection', 'Scheduled stats collection started', 0);
      try {
        const stats = await this.statsService.getServerStats();
        await this.statsService.collectAndStore(stats);
        emitJobDone(jobId, 'stats-collection', 'Scheduled stats collection completed');
        logger.info('Scheduled stats collection completed');
      } catch (err) {
        emitJobFailed(jobId, 'stats-collection', `Stats collection failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Scheduled stats collection failed');
      }
    });
    this.tasks.push(statsTask);

    // SSL renewal check — daily at 3 AM
    const sslTask = cron.schedule('0 3 * * *', async () => {
      const jobId = `ssl-renewal-${Date.now()}`;
      emitJobRunning(jobId, 'ssl-renewal', 'SSL renewal check started', 0);
      try {
        const expiring = await this.sslService.listExpiring(30);
        const adminId = await this.getAdminUserId();

        for (const cert of expiring) {
          // Only auto-renew certs that have autoRenew enabled
          if (!cert.autoRenew) continue;

          // Spread renewals: wait 30 seconds between each cert
          if (expiring.indexOf(cert) > 0) {
            await new Promise((resolve) => setTimeout(resolve, 30_000));
          }

          try {
            const certJobId = `ssl-renewal-${cert.domainId}-${Date.now()}`;
            emitJobRunning(certJobId, 'ssl-renewal', `Renewing certificate for ${cert.domainName || cert.domainId}`, 50);
            await this.sslService.renewCertificate(cert.domainId!);
            emitJobDone(certJobId, 'ssl-renewal', `SSL certificate renewed for ${cert.domainName || cert.domainId}`);
            logger.info({ domainId: cert.domainId }, 'SSL certificate renewed via scheduler');

            if (adminId) {
              await notificationsService.createNotification(
                adminId,
                'info',
                'SSL Certificate Renewed',
                `SSL certificate for domain ${cert.domainName || cert.domainId} was successfully auto-renewed.`,
              ).catch(() => {});
            }
          } catch (err) {
            emitJobFailed(`ssl-renewal-${cert.domainId}-${Date.now()}`, 'ssl-renewal', `SSL renewal failed for ${cert.domainName || cert.domainId}`);
            logger.error({ err, domainId: cert.domainId }, 'SSL renewal failed');

            if (adminId) {
              await notificationsService.createNotification(
                adminId,
                'security_alert',
                'SSL Renewal Failed',
                `Auto-renewal failed for domain ${cert.domainName || cert.domainId}. Manual intervention may be required.`,
              ).catch(() => {});
            }
          }
        }

        if (expiring.length > 0) {
          emitJobDone(jobId, 'ssl-renewal', `SSL renewal check completed (${expiring.length} certificates)`);
          logger.info({ count: expiring.length }, 'SSL renewal check completed');
        } else {
          emitJobDone(jobId, 'ssl-renewal', 'SSL renewal check completed — no certificates due');
        }
      } catch (err) {
        emitJobFailed(jobId, 'ssl-renewal', `SSL renewal check failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'SSL renewal check failed');
      }
    });
    this.tasks.push(sslTask);

    // Backup scheduler — every minute
    const backupTask = cron.schedule('* * * * *', async () => {
      const jobId = `backup-scheduler-${Date.now()}`;
      emitJobRunning(jobId, 'backup-scheduler', 'Checking for due backups...', 0);
      try {
        await this.backupService.executeDueBackups();
        emitJobDone(jobId, 'backup-scheduler', 'Backup scheduler check completed');
      } catch (err) {
        emitJobFailed(jobId, 'backup-scheduler', `Backup scheduler failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Backup scheduler failed');
      }
    });
    this.tasks.push(backupTask);

    // Session cleanup — hourly
    const sessionTask = cron.schedule('0 * * * *', async () => {
      const jobId = `session-cleanup-${Date.now()}`;
      emitJobRunning(jobId, 'session-cleanup', 'Cleaning up expired sessions...', 0);
      try {
        const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        emitJobDone(jobId, 'session-cleanup', `Session cleanup completed`);
        logger.info('Expired sessions cleaned up');
      } catch (err) {
        emitJobFailed(jobId, 'session-cleanup', `Session cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.error({ err }, 'Session cleanup failed');
      }
    });
    this.tasks.push(sessionTask);

    // Notification cleanup — daily at 4 AM
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
