import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const notificationPreferences = sqliteTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).default(true).notNull(),
  pushEnabled: integer('push_enabled', { mode: 'boolean' }).default(false).notNull(),
  sslExpiry: integer('ssl_expiry', { mode: 'boolean' }).default(true).notNull(),
  backupComplete: integer('backup_complete', { mode: 'boolean' }).default(true).notNull(),
  cronFailed: integer('cron_failed', { mode: 'boolean' }).default(true).notNull(),
  securityAlert: integer('security_alert', { mode: 'boolean' }).default(true).notNull(),
  diskSpaceLow: integer('disk_space_low', { mode: 'boolean' }).default(true).notNull(),
  serviceDown: integer('service_down', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type', { enum: ['ssl_expiry', 'backup_complete', 'cron_failed', 'security_alert', 'disk_space_low', 'service_down', 'info'] }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
