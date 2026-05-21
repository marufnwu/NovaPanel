import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  siteId: text('site_id'),
  userId: text('user_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  details: text('details', { mode: 'json' }),
  ipAddress: text('ip_address'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;