import { db } from '../../db/index.js';
import { cronJobs, cronHistory } from '../../db/schema/cron.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class CronService {
  async listJobs(_orgId?: string) {
    return db.select().from(cronJobs);
  }

  async getJob(jobId: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');
    return job;
  }

  async createJob(data: {
    command: string;
    schedule: string;
    siteId?: string;
    name?: string;
  }, userId?: string, ipAddress?: string) {
    const parts = data.schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new AppError(400, 'INVALID_CRON', 'Cron expression must have 5 fields: min hour day month weekday');
    }

    const jobId = nanoid();
    const user = data.siteId ? 'www-data' : 'root';

    const cronLine = `${data.schedule} ${data.command} # serverforge:${jobId}\n`;
    const result = await run('crontab', ['-u', user, '-l'], { sudo: true });
    const existing = result.success ? result.stdout : '';
    await run('crontab', ['-u', user, '-'], {
      sudo: true,
      input: existing + cronLine,
    });

    await db.insert(cronJobs).values({
      id: jobId,
      orgId: undefined,
      siteId: data.siteId ?? undefined,
      command: data.command,
      schedule: data.schedule,
      user: user,
      name: data.name ?? 'Cron Job',
      status: 'active',
    });

    logger.info({ jobId, command: data.command, schedule: data.schedule }, 'Cron job created');

    auditService.log({
      userId,
      action: 'cron.job.create',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ command: data.command, schedule: data.schedule }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: jobId, command: data.command, schedule: data.schedule, user };
  }

  async updateJob(jobId: string, data: { schedule?: string; command?: string }, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const user = job.user ?? 'root';
    const result = await run('crontab', ['-u', user, '-l'], { sudo: true });
    if (result.success) {
      const updated = result.stdout
        .split('\n')
        .filter(line => !line.includes(`serverforge:${jobId}`))
        .join('\n');
      await run('crontab', ['-u', user, '-'], { sudo: true, input: updated });
    }

    const newSchedule = data.schedule || job.schedule;
    const newCommand = data.command || job.command;

    const cronLine = `${newSchedule} ${newCommand} # serverforge:${jobId}\n`;
    const result2 = await run('crontab', ['-u', user, '-l'], { sudo: true });
    const existing = result2.success ? result2.stdout : '';
    await run('crontab', ['-u', user, '-'], {
      sudo: true,
      input: existing + cronLine,
    });

    await db.update(cronJobs).set({
      schedule: newSchedule,
      command: newCommand,
    }).where(eq(cronJobs.id, jobId));

    logger.info({ jobId }, 'Cron job updated');

    auditService.log({
      userId,
      action: 'cron.job.update',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ schedule: newSchedule, command: newCommand }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: jobId, schedule: newSchedule, command: newCommand };
  }

  async deleteJob(jobId: string, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const user = job.user ?? 'root';
    const result = await run('crontab', ['-u', user, '-l'], { sudo: true });
    if (result.success) {
      const updated = result.stdout
        .split('\n')
        .filter(line => !line.includes(`serverforge:${jobId}`))
        .join('\n');
      await run('crontab', ['-u', user, '-'], { sudo: true, input: updated });
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

  async toggleJob(jobId: string, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const newStatus = job.status === 'active' ? 'paused' : 'active';
    const user = job.user ?? 'root';

    if (newStatus === 'active') {
      const cronLine = `${job.schedule} ${job.command} # serverforge:${jobId}\n`;
      const result = await run('crontab', ['-u', user, '-l'], { sudo: true });
      const existing = result.success ? result.stdout : '';
      await run('crontab', ['-u', user, '-'], {
        sudo: true,
        input: existing + cronLine,
      });
    } else {
      const result = await run('crontab', ['-u', user, '-l'], { sudo: true });
      if (result.success) {
        const updated = result.stdout
          .split('\n')
          .filter(line => !line.includes(`serverforge:${jobId}`))
          .join('\n');
        await run('crontab', ['-u', user, '-'], { sudo: true, input: updated });
      }
    }

    await db.update(cronJobs).set({ status: newStatus }).where(eq(cronJobs.id, jobId));

    auditService.log({
      userId,
      action: 'cron.job.toggle',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ status: newStatus }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: jobId, status: newStatus };
  }

  async runJob(jobId: string, userId?: string, ipAddress?: string) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const startTime = new Date();
    const historyId = nanoid();
    const jobUser = job.user ?? 'root';

    await db.update(cronJobs).set({
      lastRunAt: startTime,
    }).where(eq(cronJobs.id, jobId));

    await db.insert(cronHistory).values({
      id: historyId,
      jobId: jobId,
      startedAt: startTime,
    });

    const result = await run('bash', ['-c', job.command], { sudo: true, sudoUser: jobUser, timeout: 60_000 });

    const endTime = new Date();

    await db.update(cronJobs).set({
      lastRunAt: endTime,
      lastExitCode: result.exitCode ?? 0,
    }).where(eq(cronJobs.id, jobId));

    await db.update(cronHistory).set({
      completedAt: endTime,
      exitCode: result.exitCode ?? 0,
      output: result.stdout?.substring(0, 1000) || '',
      error: result.stderr?.substring(0, 500) || '',
    }).where(eq(cronHistory.id, historyId));

    auditService.log({
      userId,
      action: 'cron.job.run',
      resource: `cron:${jobId}`,
      details: JSON.stringify({ exitCode: result.exitCode, success: result.success }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }

  async getJobHistory(jobId: string, limit: number = 50) {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId)).limit(1);
    if (!job) throw new AppError(404, 'CRON_NOT_FOUND', 'Cron job not found');

    const history = await db.select().from(cronHistory)
      .where(eq(cronHistory.jobId, jobId))
      .orderBy(desc(cronHistory.startedAt))
      .limit(limit);

    return history.map(h => ({
      id: h.id,
      jobId: h.jobId,
      startTime: h.startedAt?.toISOString() || '',
      endTime: h.completedAt?.toISOString() || null,
      exitCode: h.exitCode || null,
      output: h.output || null,
      error: h.error || null,
    }));
  }

  async listBySite(siteId: string) {
    return db.select().from(cronJobs).where(eq(cronJobs.siteId, siteId));
  }
}

export const cronService = new CronService();