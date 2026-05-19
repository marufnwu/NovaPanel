import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const backgroundJobs = sqliteTable('background_jobs', {
  id: text('id').primaryKey(),                    // nanoid
  type: text('type').notNull(),                   // Job type enum handled in service

  // Job payload as JSON
  payload: text('payload', { mode: 'json' }).notNull(),

  // Job state machine
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled']
  }).default('pending').notNull(),

  // Result (success) or error message (failure)
  result: text('result', { mode: 'json' }),

  // Idempotency: prevent duplicate job execution
  dedupeKey: text('dedupe_key').unique(),          // For idempotent job execution

  // Retry configuration
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),

  // Progress tracking
  progress: integer('progress').default(0),       // 0-100
  progressMessage: text('progress_message'),
});

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;

// Job type constants
export const JOB_TYPES = {
  // Nginx
  NGINX_RELOAD: 'nginx_reload',
  NGINX_CONFIG_REGENERATE: 'nginx_config_regenerate',

  // SSL
  SSL_PROVISION: 'ssl_provision',
  SSL_RENEW: 'ssl_renew',

  // Process
  PM2_RESTART: 'pm2_restart',
  PM2_STOP: 'pm2_stop',
  PM2_DELETE: 'pm2_delete',

  // Deployment
  DEPLOYMENT_BUILD: 'deployment_build',
  DEPLOYMENT_ROLLBACK: 'deployment_rollback',

  // DNS
  DNS_ZONE_CREATE: 'dns_zone_create',
  DNS_ZONE_DELETE: 'dns_zone_delete',
  DNS_SYNC: 'dns_sync',

  // Runtime
  RUNTIME_INSTALL: 'runtime_install',

  // Backup
  BACKUP_CREATE: 'backup_create',
  BACKUP_RESTORE: 'backup_restore',

  // Reconcile
  RECONCILE_SITE: 'reconcile_site',
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];