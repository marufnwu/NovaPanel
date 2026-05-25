import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  resourceType: text('resource_type', { enum: ['site', 'database', 'container', 'config'] }).notNull(),
  resourceId: text('resource_id'),
  type: text('type', { enum: ['full', 'incremental', 'snapshot'] }).default('full').notNull(),
  status: text('status', { enum: ['pending', 'running', 'success', 'failed'] }).default('pending').notNull(),
  size: integer('size'),
  path: text('path'),
  storageBackend: text('storage_backend', { enum: ['local', 's3', 'b2', 'wasabi'] }).default('local').notNull(),
  storagePath: text('storage_path'),
  retentionDays: integer('retention_days').default(30).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const backupSchedules = sqliteTable('backup_schedules', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  cronExpression: text('cron_expression').notNull(),
  retentionDays: integer('retention_days').default(30).notNull(),
  storageBackend: text('storage_backend').default('local').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
export type BackupSchedule = typeof backupSchedules.$inferSelect;
export type NewBackupSchedule = typeof backupSchedules.$inferInsert;