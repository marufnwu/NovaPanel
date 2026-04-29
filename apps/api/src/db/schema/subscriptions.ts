import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  maxDomains: integer('max_domains').default(-1).notNull(),
  maxDiskMb: integer('max_disk_mb').default(-1).notNull(),
  maxBandwidthMb: integer('max_bandwidth_mb').default(-1).notNull(),
  maxDatabases: integer('max_databases').default(-1).notNull(),
  maxEmailAccounts: integer('max_email_accounts').default(-1).notNull(),
  maxFtpAccounts: integer('max_ftp_accounts').default(-1).notNull(),
  phpVersions: text('php_versions'), // JSON array: '["8.1","8.2","8.3","8.4"]'
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(true).notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => plans.id),
  systemUser: text('system_user').notNull().unique(),
  homeDir: text('home_dir').notNull(),
  diskUsedMb: integer('disk_used_mb').default(0).notNull(),
  bandwidthUsedMb: integer('bandwidth_used_mb').default(0).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
