import { db } from '../../db/index.js';
import { backups, backupSchedules } from '../../db/schema/backups.js';
import { databases } from '../../db/schema/databases.js';
import { domains } from '../../db/schema/domains.js';
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
    type: 'full' | 'files' | 'database' | 'dns' | 'mail' | 'config';
  }, userId?: string, ipAddress?: string) {
    const backupId = nanoid();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sfbk`;
    const backupDir = env.BACKUP_DIR;
    const backupPath = `${backupDir}/${filename}`;
    const stagingDir = `${backupDir}/.staging-${backupId}`;

    await db.insert(backups).values({
      id: backupId,
      filename,
      type: data.type,
      storageType: 'local',
      storagePath: backupPath,
      status: 'running',
      startedAt: new Date(),
    });

    try {
      await sudoFs.mkdir(backupDir);
      await sudoFs.mkdir(stagingDir);

      // Backup files for all domains
      if (data.type === 'full' || data.type === 'files') {
        const domainList = await db.select().from(domains);

        for (const domain of domainList) {
          const domainDir = `${env.VHOSTS_ROOT}/${domain.name}`;
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
      if (data.type === 'full' || data.type === 'database') {
        const dbList = await db.select().from(databases);
        for (const database of dbList) {
          try {
            let dump: string;
            if (database.engine === 'mariadb') {
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

      // Backup DNS zones
      if (data.type === 'full' || data.type === 'dns') {
        await sudoFs.mkdir(`${stagingDir}/dns`);
        const domainList = await db.select().from(domains);
        for (const domain of domainList) {
          const zonePath = `${env.BIND_ZONES_DIR}/db.${domain.name}`;
          try {
            const zoneContent = await sudoFs.readFile(zonePath);
            await sudoFs.writeFile(`${stagingDir}/dns/db.${domain.name}`, zoneContent);
          } catch {
            logger.warn({ domain: domain.name }, 'Failed to backup DNS zone');
          }
        }
      }

      // Write metadata
      const metadata = {
        id: backupId,
        type: data.type,
        timestamp,
        version: '2.0.0',
      };
      await sudoFs.writeFile(`${stagingDir}/metadata.json`, JSON.stringify(metadata, null, 2));

      // Compress into single archive
      await run('tar', ['-czf', backupPath, '-C', stagingDir, '.'], { sudo: true, timeout: 300_000 });

      // Compute SHA256 checksum for verification
      const checksumResult = await run('sha256sum', [backupPath], { sudo: true });
      const checksum = checksumResult.stdout.trim().split(' ')[0];

      // Get file size via sudo (wc -c) since backup files are root-owned
      const sizeResult = await run('wc', ['-c', backupPath], { sudo: true });
      const sizeBytes = parseInt(sizeResult.stdout.trim().split(/\s+/)[0], 10) || 0;

      await db.update(backups).set({
        sizeBytes,
        checksum,
        status: 'completed',
        completedAt: new Date(),
      }).where(eq(backups.id, backupId));

      logger.info({ backupId, filename, size: sizeBytes }, 'Backup completed');

      auditService.log({
        userId,
        action: 'backup.create',
        resource: `backup:${backupId}`,
        details: JSON.stringify({ type: data.type, sizeBytes }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { id: backupId, filename, sizeBytes };
    } catch (error) {
      await db.update(backups).set({
        status: 'failed',
        error: (error as Error).message,
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
  async restoreBackup(backupId: string, options: { files?: boolean; databases?: boolean; dns?: boolean } = {}, userId?: string, ipAddress?: string) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');
    if (backup.status !== 'completed') throw new AppError(400, 'BACKUP_NOT_READY', 'Backup is not in completed state');

    await db.update(backups).set({ status: 'restoring' }).where(eq(backups.id, backupId));

    try {
      const stagingDir = `${env.BACKUP_DIR}/.restore-${backupId}`;
      await sudoFs.mkdir(stagingDir);

      // Extract backup archive with sudo
      await run('tar', ['-xzf', backup.storagePath!, '-C', stagingDir], { sudo: true, timeout: 300_000 });

      // Create pre-restore snapshots for each domain
      if (options.files !== false) {
        const domainList = await db.select().from(domains);
        for (const domain of domainList) {
          const domainDir = `${env.VHOSTS_ROOT}/${domain.name}`;
          const snapshotName = `.pre-restore-${Date.now()}.tar.gz`;
          const snapshotPath = `${domainDir}/${snapshotName}`;
          try {
            await run('tar', ['-czf', snapshotPath, '-C', domainDir, '--exclude=' + snapshotName, '.'], { sudo: true, timeout: 300_000 });
            logger.info({ snapshotPath }, 'Pre-restore snapshot created');
          } catch (e) {
            logger.warn({ err: e }, 'Could not create pre-restore snapshot');
          }
        }
      }

      // Restore files
      if (options.files !== false) {
        const domainList = await db.select().from(domains);

        for (const domain of domainList) {
          const domainDir = `${env.VHOSTS_ROOT}/${domain.name}`;
          const archivePath = `${stagingDir}/files_${domain.name}.tar.gz`;
          try {
            await run('tar', ['-xzf', archivePath, '-C', domainDir], {
              sudo: true, timeout: 300_000,
            });
          } catch {
            logger.warn({ domain: domain.name }, 'Failed to restore files for domain');
          }
        }

        // Fix ownership after restore
        for (const domain of domainList) {
          if (domain.systemUser) {
            const domainDir = `${env.VHOSTS_ROOT}/${domain.name}`;
            try {
              await run('chown', ['-R', `${domain.systemUser}:www-data`, domainDir], { sudo: true });
            } catch (e) {
              logger.warn({ err: e, domain: domain.name }, 'Failed to fix ownership after restore');
            }
          }
        }
      }

      // Restore databases
      if (options.databases !== false) {
        const dbList = await db.select().from(databases);
        for (const database of dbList) {
          const dumpPath = `${stagingDir}/db_${database.name}.sql`;
          try {
            const sql = await sudoFs.readFile(dumpPath);
            if (database.engine === 'mariadb') {
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

      // Restore DNS zones
      if (options.dns !== false) {
        const domainList = await db.select().from(domains);
        for (const domain of domainList) {
          const zonePath = `${stagingDir}/dns/db.${domain.name}`;
          try {
            const zoneContent = await sudoFs.readFile(zonePath);
            await sudoFs.writeFile(`${env.BIND_ZONES_DIR}/db.${domain.name}`, zoneContent);
          } catch {
            logger.warn({ domain: domain.name }, 'Failed to restore DNS zone');
          }
        }
      }

      await run('rm', ['-rf', stagingDir], { sudo: true });

      await db.update(backups).set({ status: 'completed' }).where(eq(backups.id, backupId));
      logger.info({ backupId }, 'Backup restored');

      auditService.log({
        userId,
        action: 'backup.restore',
        resource: `backup:${backupId}`,
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      return { restored: true };
    } catch (error) {
      await db.update(backups).set({ status: 'failed', error: (error as Error).message }).where(eq(backups.id, backupId));
      throw new AppError(422, 'RESTORE_FAILED', `Restore failed: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string, userId?: string, ipAddress?: string) {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');

    if (backup.storagePath) {
      await run('rm', ['-f', backup.storagePath], { sudo: true }).catch(() => {});
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
    const schedules = await db.select().from(backupSchedules);
    // Decrypt storage configs for client consumption (wrap in try/catch)
    return schedules.map(schedule => {
      let storageConfig: Record<string, string> | null = null;
      if (schedule.storageConfig) {
        try {
          storageConfig = JSON.parse(decrypt(schedule.storageConfig));
        } catch {
          logger.warn({ scheduleId: schedule.id }, 'Failed to decrypt storage config');
          storageConfig = null;
        }
      }
      return {
        ...schedule,
        storageConfig,
      };
    });
  }

  /**
   * Create a backup schedule
   */
  async createSchedule(data: {
    cronExpression: string;
    scope: string;
    retentionCount: number;
    storageType: string;
    storageConfig?: Record<string, string>;
  }, userId?: string, ipAddress?: string) {
    const scheduleId = nanoid();

    // Validate cron expression format (basic check)
    const parts = data.cronExpression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new AppError(400, 'INVALID_CRON', 'Invalid cron expression: must have 5 or 6 fields');
    }

    // Calculate initial next run time
    const nextRun = this.calculateNextRun(data.cronExpression);

    await db.insert(backupSchedules).values({
      id: scheduleId,
      cronExpression: data.cronExpression,
      scope: data.scope,
      retentionCount: data.retentionCount,
      storageType: data.storageType as any,
      storageConfig: data.storageConfig ? encrypt(JSON.stringify(data.storageConfig)) : null,
      isActive: true,
      nextRunAt: nextRun,
    });

    auditService.log({
      userId,
      action: 'backup.schedule.create',
      resource: `schedule:${scheduleId}`,
      details: JSON.stringify({ cronExpression: data.cronExpression, scope: data.scope }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: scheduleId, cronExpression: data.cronExpression, nextRunAt: nextRun };
  }

  /**
   * Toggle a backup schedule
   */
  async toggleSchedule(scheduleId: string, userId?: string, ipAddress?: string) {
    const [schedule] = await db.select().from(backupSchedules).where(eq(backupSchedules.id, scheduleId)).limit(1);
    if (!schedule) throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Backup schedule not found');
    const newActive = !schedule.isActive;
    await db.update(backupSchedules).set({ isActive: newActive }).where(eq(backupSchedules.id, scheduleId));

    auditService.log({
      userId,
      action: 'backup.schedule.toggle',
      resource: `schedule:${scheduleId}`,
      details: JSON.stringify({ isActive: newActive }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: scheduleId, isActive: newActive };
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
   * Copies the file to a temp location with world-readable permissions
   * so it can be streamed by the Node.js process.
   */
  async prepareDownload(backupId: string): Promise<{ tmpPath: string; filename: string; sizeBytes: number }> {
    const backup = await this.getBackup(backupId);
    if (!backup.storagePath) throw new AppError(400, 'NO_STORAGE_PATH', 'Backup has no storage path');
    if (backup.status !== 'completed') throw new AppError(400, 'BACKUP_NOT_READY', 'Backup is not in completed state');

    const tmpPath = `/tmp/novapanel-dl-${backupId}`;
    await run('cp', [backup.storagePath, tmpPath], { sudo: true });
    await run('chmod', ['644', tmpPath], { sudo: true });

    return { tmpPath, filename: backup.filename, sizeBytes: backup.sizeBytes };
  }

  /**
   * Get download URL/path for a backup
   */
  async getDownloadUrl(backupId: string): Promise<string> {
    const backup = await this.getBackup(backupId);
    return backup.storagePath || '';
  }

  /**
   * Verify a backup's integrity
   */
  async verifyBackup(backupId: string): Promise<{ valid: boolean; checksum: string; sizeBytes: number; checkedAt: string; errors?: string[] }> {
    const [backup] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
    if (!backup) throw new AppError(404, 'BACKUP_NOT_FOUND', 'Backup not found');

    if (!backup.storagePath) {
      return {
        valid: false,
        checksum: '',
        sizeBytes: backup.sizeBytes || 0,
        checkedAt: new Date().toISOString(),
        errors: ['Backup has no storage path'],
      };
    }

    // Recompute checksum and compare with stored value
    const checksumResult = await run('sha256sum', [backup.storagePath], { sudo: true });
    const computedChecksum = checksumResult.stdout.trim().split(' ')[0];

    if (!backup.checksum) {
      return {
        valid: false,
        checksum: computedChecksum,
        sizeBytes: backup.sizeBytes || 0,
        checkedAt: new Date().toISOString(),
        errors: ['No stored checksum found for comparison'],
      };
    }

    const valid = computedChecksum === backup.checksum;
    return {
      valid,
      checksum: computedChecksum,
      sizeBytes: backup.sizeBytes || 0,
      checkedAt: new Date().toISOString(),
      errors: valid ? undefined : ['Backup checksum mismatch — file may be corrupted'],
    };
  }

  /**
   * Get remote storage configuration
   */
  async getStorageConfig(): Promise<{ type: string; s3?: Record<string, string>; sftp?: Record<string, string> }> {
    return { type: 'local' };
  }

  /**
   * Update remote storage configuration
   */
  async updateStorageConfig(config: { type: string; s3?: Record<string, string>; sftp?: Record<string, string> }, userId?: string, ipAddress?: string) {
    logger.info({ type: config.type }, 'Storage config updated');

    auditService.log({
      userId,
      action: 'backup.storage.update',
      details: JSON.stringify({ type: config.type }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return this.getStorageConfig();
  }

  /**
   * Execute all backup schedules that are due
   */
  async executeDueBackups(): Promise<void> {
    const now = new Date();

    // Find active schedules that are due (nextRunAt is in the past or null)
    const dueSchedules = await db.select()
      .from(backupSchedules)
      .where(
        and(
          eq(backupSchedules.isActive, true),
          lte(backupSchedules.nextRunAt, now),
        ),
      );

    // Also pick up schedules that have never been run (nextRunAt is null)
    const neverRunSchedules = await db.select()
      .from(backupSchedules)
      .where(
        and(
          eq(backupSchedules.isActive, true),
          eq(backupSchedules.nextRunAt, null as any),
        ),
      );

    const allDue = [...dueSchedules, ...neverRunSchedules];

    for (const schedule of allDue) {
      try {
        // Execute backup using the schedule's scope as the type
        await this.createBackup({
          type: schedule.scope as any,
        });

        // Calculate next run time
        const nextRun = this.calculateNextRun(schedule.cronExpression);

        // Update schedule with last/next run times
        await db.update(backupSchedules)
          .set({ lastRunAt: now, nextRunAt: nextRun })
          .where(eq(backupSchedules.id, schedule.id));

        // Enforce retention policy
        await this.enforceRetention(schedule);

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

    // Simple heuristic based on common patterns
    // Default: add 24 hours
    let delayMs = 24 * 60 * 60 * 1000; // 1 day

    if (parts.length >= 5) {
      const minute = parts[0];
      const hour = parts[1];
      const dayOfMonth = parts[2];
      const month = parts[3];
      const dayOfWeek = parts[4];

      // Weekly (specific day of week)
      if (dayOfWeek !== '*' && dayOfMonth === '*') {
        delayMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      }
      // Monthly (specific day of month)
      else if (dayOfMonth !== '*' && dayOfWeek === '*') {
        delayMs = 30 * 24 * 60 * 60 * 1000; // ~30 days
      }
      // Daily or more frequent
      else {
        delayMs = 24 * 60 * 60 * 1000; // 1 day
      }
    }

    return new Date(now.getTime() + delayMs);
  }

  /**
   * Enforce retention policy for a backup schedule
   * Deletes oldest backups beyond the retention count
   */
  private async enforceRetention(schedule: { id: string; retentionCount: number; scope: string }): Promise<void> {
    // Get all completed backups of the same type, ordered by creation date descending
    const allBackups = await db.select()
      .from(backups)
      .where(
        and(
          eq(backups.type, schedule.scope as any),
          eq(backups.status, 'completed'),
        ),
      )
      .orderBy(desc(backups.createdAt));

    // Keep only the most recent `retentionCount` backups
    const toDelete = allBackups.slice(schedule.retentionCount);

    for (const backup of toDelete) {
      try {
        // Delete file from disk
        if (backup.storagePath) {
          await run('rm', ['-f', backup.storagePath], { sudo: true }).catch(() => {});
        }
        // Delete record from DB
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
   * List backups by websiteId
   */
  async listByWebsite(websiteId: string) {
    return db.select().from(backups).where(eq(backups.websiteId, websiteId));
  }
}
