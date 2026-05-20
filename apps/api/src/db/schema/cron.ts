import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';
import { sites } from './sites';

export const cronJobs = sqliteTable('cron_jobs', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'cascade' }),
  websiteId: text('website_id').references(() => sites.id, { onDelete: 'set null' }),
  command: text('command').notNull(),
  schedule: text('schedule').notNull(),             // cron expression: "0 * * * *"
  systemUser: text('system_user').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRun: integer('last_run', { mode: 'timestamp' }),
  lastStatus: text('last_status', { enum: ['success', 'failed', 'running'] }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const cronJobHistory = sqliteTable('cron_job_history', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => cronJobs.id, { onDelete: 'cascade' }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  exitCode: integer('exit_code'),
  outputPreview: text('output_preview'),
  errorPreview: text('error_preview'),
});

export type CronJob = typeof cronJobs.$inferSelect;
export type CronJobHistoryEntry = typeof cronJobHistory.$inferSelect;
