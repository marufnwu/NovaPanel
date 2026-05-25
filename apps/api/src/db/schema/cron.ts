import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const cronJobs = sqliteTable('cron_jobs', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  siteId: text('site_id'),
  name: text('name').notNull(),
  command: text('command').notNull(),
  schedule: text('schedule').notNull(),
  user: text('user').default('root'),
  workingDir: text('working_dir'),
  status: text('status', { enum: ['active', 'paused', 'error'] }).default('active').notNull(),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  lastExitCode: integer('last_exit_code'),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const cronHistory = sqliteTable('cron_history', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  exitCode: integer('exit_code'),
  output: text('output'),
  error: text('error'),
});

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;
export type CronHistory = typeof cronHistory.$inferSelect;
export type NewCronHistory = typeof cronHistory.$inferInsert;