import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),                    // nanoid

  // Who performed the action
  actorId: text('actor_id'),                      // User ID (null for system)
  actorType: text('actor_type', {
    enum: ['user', 'system', 'reconciler', 'job']
  }).default('user').notNull(),

  // What was affected
  resourceType: text('resource_type').notNull(), // 'site', 'domain', 'deployment', etc.
  resourceId: text('resource_id'),                // The affected resource ID

  // What action was taken
  action: text('action').notNull(),               // 'site.create', 'domain.delete', etc.

  // Additional context
  metadata: text('metadata', { mode: 'json' }),   // Flexible JSON for extra info

  // Source
  ipAddress: text('ip_address'),                 // Client IP for user actions

  // Timestamp
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
