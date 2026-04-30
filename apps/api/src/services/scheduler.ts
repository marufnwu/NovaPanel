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
      try {
        const stats = await this.statsService.getServerStats();
        await this.statsService.collectAndStore(stats);
        logger.info('Scheduled stats collection completed');
      } catch (err) {
        logger.error({ err }, 'Scheduled stats collection failed');
      }
    });
    this.tasks.push(statsTask);

    // SSL renewal check — daily at 3 AM
    const sslTask = cron.schedule('0 3 * * *', async () => {
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
            await this.sslService.renewCertificate(cert.domainId!);
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
          logger.info({ count: expiring.length }, 'SSL renewal check completed');
        }
      } catch (err) {
        logger.error({ err }, 'SSL renewal check failed');
      }
    });
    this.tasks.push(sslTask);

    // Backup scheduler — every minute
    const backupTask = cron.schedule('* * * * *', async () => {
      try {
        await this.backupService.executeDueBackups();
      } catch (err) {
        logger.error({ err }, 'Backup scheduler failed');
      }
    });
    this.tasks.push(backupTask);

    // Session cleanup — hourly
    const sessionTask = cron.schedule('0 * * * *', async () => {
      try {
        const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        logger.info('Expired sessions cleaned up');
      } catch (err) {
        logger.error({ err }, 'Session cleanup failed');
      }
    });
    this.tasks.push(sessionTask);

    // Notification cleanup — daily at 4 AM
    const notificationTask = cron.schedule('0 4 * * *', async () => {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
        logger.info('Old notifications cleaned up');
      } catch (err) {
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
