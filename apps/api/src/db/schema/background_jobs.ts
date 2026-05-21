import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const backgroundJobs = sqliteTable('background_jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }).default('{}').notNull(),
  status: text('status', { enum: ['pending', 'running', 'success', 'failed'] }).default('pending').notNull(),
  result: text('result', { mode: 'json' }),
  error: text('error'),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  runAt: integer('run_at', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;