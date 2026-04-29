import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains.js';
import { websites } from './websites.js';

export const cronJobs = sqliteTable('cron_jobs', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'cascade' }),
  websiteId: text('website_id').references(() => websites.id, { onDelete: 'set null' }),
  command: text('command').notNull(),
  schedule: text('schedule').notNull(),             // cron expression: "0 * * * *"
  systemUser: text('system_user').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRun: integer('last_run', { mode: 'timestamp' }),
  lastStatus: text('last_status', { enum: ['success', 'failed', 'running'] }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type CronJob = typeof cronJobs.$inferSelect;
