import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  runtime: text('runtime', { enum: ['docker', 'node', 'python', 'php', 'go', 'ruby', 'rust', 'static'] }).notNull(),
  runtimeVersion: text('runtime_version'),
  sourceType: text('source_type', { enum: ['git', 'docker_registry', 'upload', 'empty'] }).default('empty').notNull(),
  gitRepo: text('git_repo'),
  gitBranch: text('git_branch').default('main'),
  gitWebhookSecret: text('git_webhook_secret'),
  buildCommand: text('build_command'),
  outputDirectory: text('output_directory').default('dist'),
  installCommand: text('install_command'),
  startCommand: text('start_command'),
  port: integer('port'),
  replicas: integer('replicas').default(1).notNull(),
  autoRestart: integer('auto_restart', { mode: 'boolean' }).default(true).notNull(),
  memoryLimit: integer('memory_limit'),
  cpuLimit: integer('cpu_limit'),
  status: text('status', { enum: ['active', 'building', 'deploying', 'error', 'suspended', 'stopped'] }).default('active').notNull(),
  lastDeploymentId: text('last_deployment_id'),
  healthCheckPath: text('health_check_path').default('/health'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  siteId: text('site_id').notNull(),
  sequence: integer('sequence').notNull(),
  sourceType: text('source_type', { enum: ['git', 'docker_registry', 'upload', 'rollback'] }),
  gitRef: text('git_ref'),
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
  status: text('status', { enum: ['pending', 'building', 'testing', 'deploying', 'success', 'failed', 'cancelled'] }).default('pending').notNull(),
  buildLogs: text('build_logs'),
  deployLogs: text('deploy_logs'),
  deployedAt: integer('deployed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const siteEnvVars = sqliteTable('site_env_vars', {
  id: text('id').primaryKey(),
  siteId: text('site_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  scope: text('scope', { enum: ['runtime', 'build', 'secret'] }).default('runtime').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const siteHealthChecks = sqliteTable('site_health_checks', {
  id: text('id').primaryKey(),
  siteId: text('site_id').notNull(),
  path: text('path').default('/health'),
  interval: integer('interval').default(30),
  timeout: integer('timeout').default(5),
  healthyThreshold: integer('healthy_threshold').default(1),
  unhealthyThreshold: integer('unhealthy_threshold').default(3),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type SiteEnvVar = typeof siteEnvVars.$inferSelect;
export type NewSiteEnvVar = typeof siteEnvVars.$inferInsert;
export type SiteHealthCheck = typeof siteHealthChecks.$inferSelect;
export type NewSiteHealthCheck = typeof siteHealthChecks.$inferInsert;