import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const installedApps = sqliteTable('installed_apps', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  siteId: text('site_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  version: text('version'),
  config: text('config', { mode: 'json' }).default('{}').notNull(),
  status: text('status', { enum: ['installing', 'ready', 'error', 'removing'] }).default('installing').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type InstalledApp = typeof installedApps.$inferSelect;
export type NewInstalledApp = typeof installedApps.$inferInsert;