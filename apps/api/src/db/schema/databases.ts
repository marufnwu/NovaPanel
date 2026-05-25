import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const databases = sqliteTable('databases', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  type: text('type', { enum: ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'sqlite'] }).notNull(),
  version: text('version'),
  host: text('host').default('localhost'),
  port: integer('port'),
  databaseName: text('database_name'),
  username: text('username'),
  password: text('password'),
  containerId: text('container_id'),
  volumeId: text('volume_id'),
  backupsEnabled: integer('backups_enabled', { mode: 'boolean' }).default(true).notNull(),
  backupSchedule: text('backup_schedule').default('0 2 * * *'),
  publicAccess: integer('public_access', { mode: 'boolean' }).default(false).notNull(),
  status: text('status', { enum: ['running', 'stopped', 'error', 'creating'] }).default('creating').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const databaseUsers = sqliteTable('database_users', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull(),
  username: text('username').notNull(),
  password: text('password'),
  privileges: text('privileges', { mode: 'json' }).default('[]').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Database = typeof databases.$inferSelect;
export type NewDatabase = typeof databases.$inferInsert;
export type DatabaseUser = typeof databaseUsers.$inferSelect;
export type NewDatabaseUser = typeof databaseUsers.$inferInsert;