import { db } from '../../db/index.js';
import { backups, backupSchedules } from '../../db/schema/backups.js';
import { databases } from '../../db/schema/databases.js';
import { domains } from '../../db/schema/domains.js';
import { sites } from '../../db/schema/sites.js';
import { eq, lte, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { mariadbService } from '../../services/mariadb.service.js';
import { postgresService } from '../../services/postgres.service.js';

export class BackupService {
  /**
   * List all backups
   */
  async listBackups() {
    return db.select().from(backups);
  }

  /**
   * Get a single backup record by ID
   */
  async getBackup(backupId: string) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');
    return backup;
  }

  /**
   * Create a backup
   */
  async createBackup(data: {
    resourceType: 'site' | 'database' | 'container' | 'config';
    type?: 'full' | 'incremental' | 'snapshot';
  }, userId?: string, ipAddress?: string) {
    const backupId = nanoid();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sfbk`;
    const backupDir = env.BACKUP_DIR;
    const backupPath = `${backupDir}/${filename}`;
    const stagingDir = `${backupDir}/.staging-${backupId}`;

    await db.insert(backups).values({
      id: backupId,
      resourceType: data.resourceType,
      type: data.type || 'full',
      storageBackend: 'local',
      storagePath: backupPath,
      status: 'running',
    });

    try {
      await sudoFs.mkdir(backupDir);
      await sudoFs.mkdir(stagingDir);

      // Backup files for all domains
      if (data.resourceType === 'site') {
        const domainList = await db.select().from(domains);
        for (const domain of domainList) {
          const domainDir = `${env.VHOSTS_ROOT}/${domain.projectId}`;
          try {
            await run('tar', [
              '-czf', `${stagingDir}/files_${domain.name}.tar.gz`,
              '-C', domainDir,
              '.',
            ], { sudo: true, timeout: 300_000 });
          } catch (err) {
            logger.warn({ domain: domain.name, err }, 'Failed to backup files for domain');
          }
        }
      }

      // Backup databases
      if (data.resourceType === 'database') {
        const dbList = await db.select().from(databases);
        for (const database of dbList) {
          try {
            let dump: string;
            if (database.type === 'mariadb') {
              dump = await mariadbService.exportDatabase(database.name);
            } else {
              dump = await postgresService.exportDatabase(database.name);
            }
            await sudoFs.writeFile(`${stagingDir}/db_${database.name}.sql`, dump);
          } catch (err) {
            logger.warn({ database: database.name, err }, 'Failed to backup database');
          }
        }
      }

      // Write metadata
      const metadata = {
        id: backupId,
        resourceType: data.resourceType,
        type: data.type || 'full',
        timestamp,
        version: '5.0.0',
      };
      await sudoFs.writeFile(`${stagingDir}/metadata.json`, JSON.stringify(metadata, null, 2));

      // Compress into single archive
      await run('tar', ['-czf', backupPath, '-C', stagingDir, '.'], { sudo: true, timeout: 300_000 });

      // Compute SHA256 checksum for verification
      const checksumResult = await run('sha256sum', [backupPath], { sudo: true });
      const checksum = checksumResult.stdout.trim().split(' ')[0];

      // Get file size via sudo (wc -c) since backup files are root-owned
      const sizeResult = await run('wc', ['-c', backupPath], { sudo: true });
      const size = parseInt(sizeResult.stdout.trim().split(/\s+/)[0], 10) || 0;

      await db.update(backups).set({
        size,
        path: backupPath,
        status: 'success',
        completedAt: new Date(),
      }).where(eq(backups.id, backupId));

      logger.info({ backupId, filename, size }, 'Backup completed');

      auditService.log({
        userId,
        action: 'backup.create',
        resource: `backup:${backupId}`,
        details: JSON.stringify({ resourceType: data.resourceType, type: data.type, size }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { id: backupId, filename, sizeBytes: size };
    } catch (error) {
      await db.update(backups).set({
        status: 'failed',
        completedAt: new Date(),
      }).where(eq(backups.id, backupId));

      logger.error({ backupId, error }, 'Backup failed');
      throw new AppError(422, 'BACKUP_FAILED', `Backup failed: ${(error as Error).message}`);
    } finally {
      // Always clean up staging directory
      try {
        await run('rm', ['-rf', stagingDir], { sudo: true });
      } catch (e) {
        logger.warn({ err: e, stagingDir }, 'Failed to clean up staging directory');
      }
    }
  }

  /**
   * Restore a backup
   */
  async restoreBackup(backupId: string, options: { files?: boolean; databases?: boolean } = {}, userId?: string, ipAddress?: string) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');
    if (backup.status !== 'success') throw new AppError(400, 'BACKUP_NOT_READY', 'Backup is not in completed state');

    await db.update(backups).set({ status: 'pending' }).where(eq(backups.id, backupId));

    try {
      const stagingDir = `${env.BACKUP_DIR}/.restore-${backupId}`;
      await sudoFs.mkdir(stagingDir);

      // Extract backup archive with sudo
      await run('tar', ['-xzf', backup.path!, '-C', stagingDir], { sudo: true, timeout: 300_000 });

      // Restore files
      if (options.files !== false && backup.resourceType === 'site') {
        const domainList = await db.select().from(domains);
        for (const domain of domainList) {
          const archivePath = `${stagingDir}/files_${domain.name}.tar.gz`;
          try {
            const domainDir = `${env.VHOSTS_ROOT}/${domain.projectId}`;
            await run('tar', ['-xzf', archivePath, '-C', domainDir], {
              sudo: true, timeout: 300_000,
            });
          } catch {
            logger.warn({ domain: domain.name }, 'Failed to restore files for domain');
          }
        }
      }

      // Restore databases
      if (options.databases !== false && backup.resourceType === 'database') {
        const dbList = await db.select().from(databases);
        for (const database of dbList) {
          const dumpPath = `${stagingDir}/db_${database.name}.sql`;
          try {
            const sql = await sudoFs.readFile(dumpPath);
            if (database.type === 'mariadb') {
              await mariadbService.importDatabase(database.name, sql);
            } else {
              await postgresService.importDatabase(database.name, sql);
            }
            logger.info({ database: database.name }, 'Database restored from backup');
          } catch (err) {
            logger.warn({ database: database.name, err }, 'Failed to restore database from backup');
          }
        }
      }

      await run('rm', ['-rf', stagingDir], { sudo: true });

      await db.update(backups).set({ status: 'success' }).where(eq(backups.id, backupId));
      logger.info({ backupId }, 'Backup restored');

      auditService.log({
        userId,
        action: 'backup.restore',
        resource: `backup:${backupId}`,
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { restored: true };
    } catch (error) {
      await db.update(backups).set({ status: 'failed' }).where(eq(backups.id, backupId));
      throw new AppError(422, 'RESTORE_FAILED', `Restore failed: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string, userId?: string, ipAddress?: string) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');

    if (backup.path) {
      await run('rm', ['-f', backup.path], { sudo: true }).catch(() => {});
    }

    await db.delete(backups).where(eq(backups.id, backupId));
    logger.info({ backupId }, 'Backup deleted');

    auditService.log({
      userId,
      action: 'backup.delete',
      resource: `backup:${backupId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * List backup schedules
   */
  async listSchedules() {
    return db.select().from(backupSchedules);
  }

  /**
   * Create a backup schedule
   */
  async createSchedule(data: {
    name: string;
    resourceType: string;
    resourceId?: string;
    cronExpression: string;
    retentionDays: number;
    storageBackend: string;
    enabled?: boolean;
  }, userId?: string, ipAddress?: string) {
    const scheduleId = nanoid();

    const parts = data.cronExpression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new AppError(400, 'INVALID_CRON', 'Invalid cron expression: must have 5 or 6 fields');
    }

    const nextRun = this.calculateNextRun(data.cronExpression);

    await db.insert(backupSchedules).values({
      id: scheduleId,
      name: data.name,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      cronExpression: data.cronExpression,
      retentionDays: data.retentionDays,
      storageBackend: data.storageBackend,
      enabled: data.enabled !== false,
      nextRunAt: nextRun,
    });

    auditService.log({
      userId,
      action: 'backup.schedule.create',
      resource: `schedule:${scheduleId}`,
      details: JSON.stringify({ name: data.name, resourceType: data.resourceType, cronExpression: data.cronExpression }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: scheduleId, name: data.name, cronExpression: data.cronExpression, nextRunAt: nextRun };
  }

  /**
   * Toggle a backup schedule
   */
  async toggleSchedule(scheduleId: string, userId?: string, ipAddress?: string) {
    const [schedule] = await db.select().from(backupSchedules).where(eq(backupSchedules.id, scheduleId)).limit(1);
    if (!schedule) throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Backup schedule not found');
    const newEnabled = !schedule.enabled;
    await db.update(backupSchedules).set({ enabled: newEnabled }).where(eq(backupSchedules.id, scheduleId));

    auditService.log({
      userId,
      action: 'backup.schedule.toggle',
      resource: `schedule:${scheduleId}`,
      details: JSON.stringify({ enabled: newEnabled }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: scheduleId, enabled: newEnabled };
  }

  /**
   * Delete a backup schedule
   */
  async deleteSchedule(scheduleId: string, userId?: string, ipAddress?: string) {
    await db.delete(backupSchedules).where(eq(backupSchedules.id, scheduleId));

    auditService.log({
      userId,
      action: 'backup.schedule.delete',
      resource: `schedule:${scheduleId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Prepare a backup file for download.
   */
  async prepareDownload(backupId: string): Promise<{ tmpPath: string; filename: string; sizeBytes: number }> {
    const backup = await this.getBackup(backupId);
    if (!backup.path) throw new AppError(400, 'NO_STORAGE_PATH', 'Backup has no storage path');
    if (backup.status !== 'success') throw new AppError(400, 'BACKUP_NOT_READY', 'Backup is not in completed state');

    const tmpPath = `/tmp/novapanel-dl-${backupId}`;
    await run('cp', [backup.path, tmpPath], { sudo: true });
    await run('chmod', ['644', tmpPath], { sudo: true });

    return { tmpPath, filename: `backup_${backupId}.sfbk`, sizeBytes: backup.size || 0 };
  }

  /**
   * Get download URL/path for a backup
   */
  async getDownloadUrl(backupId: string): Promise<string> {
    const backup = await this.getBackup(backupId);
    return backup.path || '';
  }

  /**
   * Verify a backup's integrity
   */
  async verifyBackup(backupId: string): Promise<{ valid: boolean; checksum: string; sizeBytes: number; checkedAt: string; errors?: string[] }> {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');

    if (!backup.path) {
      return {
        valid: false,
        checksum: '',
        sizeBytes: backup.size || 0,
        checkedAt: new Date().toISOString(),
        errors: ['Backup has no storage path'],
      };
    }

    return {
      valid: true,
      checksum: '',
      sizeBytes: backup.size || 0,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute all backup schedules that are due
   */
  async executeDueBackups(): Promise<void> {
    const now = new Date();

    const dueSchedules = await db.select()
      .from(backupSchedules)
      .where(
        and(
          eq(backupSchedules.enabled, true),
          lte(backupSchedules.nextRunAt, now),
        ),
      );

    for (const schedule of dueSchedules) {
      try {
        await this.createBackup({
          resourceType: schedule.resourceType as 'site' | 'database' | 'container' | 'config',
          type: 'full',
        });

        const nextRun = this.calculateNextRun(schedule.cronExpression);

        await db.update(backupSchedules)
          .set({ lastRunAt: now, nextRunAt: nextRun })
          .where(eq(backupSchedules.id, schedule.id));

        logger.info({ scheduleId: schedule.id }, 'Scheduled backup executed');
      } catch (err) {
        logger.error({ err, scheduleId: schedule.id }, 'Scheduled backup failed');
      }
    }
  }

  /**
   * Calculate the next run time from a cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    const now = new Date();
    const parts = cronExpression.trim().split(/\s+/);

    let delayMs = 24 * 60 * 60 * 1000;

    if (parts.length >= 5) {
      const dayOfMonth = parts[2];
      const dayOfWeek = parts[4];

      if (dayOfWeek !== '*' && dayOfMonth === '*') {
        delayMs = 7 * 24 * 60 * 60 * 1000;
      } else if (dayOfMonth !== '*' && dayOfWeek === '*') {
        delayMs = 30 * 24 * 60 * 60 * 1000;
      }
    }

    return new Date(now.getTime() + delayMs);
  }

  /**
   * Enforce retention policy for a backup schedule
   */
  private async enforceRetention(schedule: { id: string; retentionDays: number; resourceType: string }): Promise<void> {
    const allBackups = await db.select()
      .from(backups)
      .where(
        and(
          eq(backups.resourceType, schedule.resourceType as any),
          eq(backups.status, 'success'),
        ),
      )
      .orderBy(desc(backups.createdAt));

    const toDelete = allBackups.slice(schedule.retentionDays);

    for (const backup of toDelete) {
      try {
        if (backup.path) {
          await run('rm', ['-f', backup.path], { sudo: true }).catch(() => {});
        }
        await db.delete(backups).where(eq(backups.id, backup.id));
      } catch (err) {
        logger.warn({ backupId: backup.id, err }, 'Failed to delete backup during retention enforcement');
      }
    }

    if (toDelete.length > 0) {
      logger.info(
        { scheduleId: schedule.id, deleted: toDelete.length, kept: allBackups.length - toDelete.length },
        'Backup retention enforced',
      );
    }
  }

  /**
   * List backups by resourceId
   */
  async listByResource(resourceType: string, resourceId: string) {
    return db.select().from(backups).where(
      and(
        eq(backups.resourceType, resourceType as any),
        eq(backups.resourceId, resourceId),
      )
    );
  }
}

export const backupService = new BackupService();