import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains.js';
import { sites } from './sites.js';

export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').references(() => sites.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  type: text('type', { enum: ['full', 'files', 'database', 'dns', 'mail', 'config'] }).notNull().default('full'),
  storageType: text('storage_type', { enum: ['local', 's3', 'sftp', 'b2'] }).notNull().default('local'),
  storagePath: text('storage_path'),
  checksum: text('checksum'),
  encrypted: integer('encrypted', { mode: 'boolean' }).default(false).notNull(),
  encryptionAlgorithm: text('encryption_algorithm', { enum: ['aes-256-cbc', 'aes-256-gcm'] }).default('aes-256-cbc'),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'restoring'] }).notNull().default('pending'),
  error: text('error'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const backupSchedules = sqliteTable('backup_schedules', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'cascade' }),
  cronExpression: text('cron_expression').notNull().default('0 2 * * *'), // 2 AM daily
  scope: text('scope').default('full').notNull(),       // full, files, database, dns, mail, config
  retentionCount: integer('retention_count').default(7).notNull(),
  storageType: text('storage_type', { enum: ['local', 's3', 'sftp', 'b2'] }).default('local').notNull(),
  storageConfig: text('storage_config'), // JSON: { endpoint, bucket, accessKey, secretKey, path }
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Backup = typeof backups.$inferSelect;
export type BackupSchedule = typeof backupSchedules.$inferSelect;
