import { db } from '../../db/index.js';
import { cronJobs } from '../../db/schema/cron.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class CronService {
  /**
   * List all cron jobs
   */
  async listJobs(_domainId?: string) {
    // For single-admin mode, list all cron jobs
    // In original multi-tenant mode, this would filter by subscription
    return db.select().from(cronJobs);
  }

  /**
   * Get a single cron job by ID
   */
  async getJob(jobId: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');
    return job;
  }

  /**
   * Create a cron job
   */
  async createJob(data: {
    command: string;
    schedule: string;
    systemUser?: string;
    domainId?: string;
    websiteId?: string;
  }, userId?: string, ipAddress?: string) {
    const parts = data.schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new AppError(400, 'INVALID_CRON', 'Cron expression must have 5 fields: min hour day month weekday');
    }

    // In single-admin mode, use provided systemUser or default to root
    const sysUser = data.systemUser || 'root';

    const jobId = nanoid();

    const cronLine = `${data.schedule} ${data.command} # serverforge:${jobId}\n`;
    const result = await run('crontab', ['-u', sysUser, '-l'], { sudo: true });
    const existing = result.success ? result.stdout : '';
    await run('crontab', ['-u', sysUser, '-'], {
      sudo: true,
      input: existing + cronLine,
    });

    await db.insert(cronJobs).values({
      id: jobId,
      domainId: data.domainId || null,
      websiteId: data.websiteId || null,
      command: data.command,
      schedule: data.schedule,
      systemUser: sysUser,
      isActive: true,
    });

    logger.info({ jobId, command: data.command, schedule: data.schedule }, 'Cron job created');

    auditService.log({
      userId,
      action: 'cron.job.create',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ command: data.command, schedule: data.schedule }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: jobId, command: data.command, schedule: data.schedule, systemUser: sysUser };
  }

  /**
   * Update a cron job
   */
  async updateJob(jobId: string, data: { schedule?: string; command?: string; systemUser?: string }, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    // Remove old entry
    const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
    if (result.success) {
      const updated = result.stdout
        .split('\n')
        .filter(line => !line.includes(`serverforge:${jobId}`))
        .join('\n');
      await run('crontab', ['-u', job.systemUser, '-'], { sudo: true, input: updated });
    }

    const newSchedule = data.schedule || job.schedule;
    const newCommand = data.command || job.command;
    const newUser = data.systemUser || job.systemUser;

    // Add new entry
    const cronLine = `${newSchedule} ${newCommand} # serverforge:${jobId}\n`;
    const result2 = await run('crontab', ['-u', newUser, '-l'], { sudo: true });
    const existing = result2.success ? result2.stdout : '';
    await run('crontab', ['-u', newUser, '-'], {
      sudo: true,
      input: existing + cronLine,
    });

    await db.update(cronJobs).set({
      schedule: newSchedule,
      command: newCommand,
      systemUser: newUser,
    }).where(eq(cronJobs.id, jobId));

    logger.info({ jobId }, 'Cron job updated');

    auditService.log({
      userId,
      action: 'cron.job.update',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ schedule: newSchedule, command: newCommand }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: jobId, schedule: newSchedule, command: newCommand, systemUser: newUser };
  }

  /**
   * Delete a cron job
   */
  async deleteJob(jobId: string, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
    if (result.success) {
      const updated = result.stdout
        .split('\n')
        .filter(line => !line.includes(`serverforge:${jobId}`))
        .join('\n');
      await run('crontab', ['-u', job.systemUser, '-'], { sudo: true, input: updated });
    }

    await db.delete(cronJobs).where(eq(cronJobs.id, jobId));
    logger.info({ jobId }, 'Cron job deleted');

    auditService.log({
      userId,
      action: 'cron.job.delete',
      resource: `cron:${jobId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Toggle a cron job on/off
   */
  async toggleJob(jobId: string, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const newActive = !job.isActive;

    if (newActive) {
      const cronLine = `${job.schedule} ${job.command} # serverforge:${jobId}\n`;
      const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
      const existing = result.success ? result.stdout : '';
      await run('crontab', ['-u', job.systemUser, '-'], {
        sudo: true,
        input: existing + cronLine,
      });
    } else {
      const result = await run('crontab', ['-u', job.systemUser, '-l'], { sudo: true });
      if (result.success) {
        const updated = result.stdout
          .split('\n')
          .filter(line => !line.includes(`serverforge:${jobId}`))
          .join('\n');
        await run('crontab', ['-u', job.systemUser, '-'], { sudo: true, input: updated });
      }
    }

    await db.update(cronJobs).set({ isActive: newActive }).where(eq(cronJobs.id, jobId));

    auditService.log({
      userId,
      action: 'cron.job.toggle',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ isActive: newActive }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: jobId, isActive: newActive };
  }

  /**
   * Run a cron job immediately
   */
  async runJob(jobId: string, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const result = await run('su', ['-c', job.command, job.systemUser], { sudo: true, timeout: 60_000 });

    await db.update(cronJobs).set({
      lastRun: new Date(),
      lastStatus: result.success ? 'success' : 'failed',
    }).where(eq(cronJobs.id, jobId));

    auditService.log({
      userId,
      action: 'cron.job.run',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ exitCode: result.exitCode, success: result.success }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }

  /**
   * Get cron job execution history
   */
  async getJobHistory(jobId: string): Promise<Array<{ id: string; jobId: string; startTime: string; endTime: string; durationMs: number; exitCode: number; outputPreview: string }>> {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');
    // Return empty history for now — history tracking can be implemented later
    return [];
  }

  /**
   * List cron jobs by websiteId
   */
  async listByWebsite(websiteId: string) {
    return db.select().from(cronJobs).where(eq(cronJobs.websiteId, websiteId));
  }
}
