import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites';

export const siteStates = sqliteTable('site_states', {
  id: text('id').primaryKey(),                    // nanoid
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }).unique(),
  
  // Nginx state
  nginxStatus: text('nginx_status', { 
    enum: ['ok', 'missing', 'invalid', 'reload_needed', 'unknown'] 
  }).default('unknown').notNull(),
  nginxConfigValid: integer('nginx_config_valid', { mode: 'boolean' }),
  nginxReloadNeeded: integer('nginx_reload_needed', { mode: 'boolean' }).default(false).notNull(),
  
  // Process state
  processStatus: text('process_status', { 
    enum: ['running', 'stopped', 'error', 'restarting', 'unknown'] 
  }).default('unknown').notNull(),
  processRunning: integer('process_running', { mode: 'boolean' }),
  processPid: integer('process_pid'),
  processUptime: integer('process_uptime'),      // seconds
  processRestartCount: integer('process_restart_count').default(0).notNull(),
  
  // Port allocation
  currentInternalPort: integer('current_internal_port'),
  
  // Deployment state
  deployedCommitSha: text('deployed_commit_sha'),
  lastDeploymentStatus: text('last_deployment_status', {
    enum: ['success', 'failed', 'pending', 'unknown']
  }).default('unknown').notNull(),
  lastDeployAt: integer('last_deploy_at', { mode: 'timestamp' }),
  
  // SSL state
  sslProvisioned: integer('ssl_provisioned', { mode: 'boolean' }).default(false).notNull(),
  sslExpiresAt: integer('ssl_expires_at', { mode: 'timestamp' }),
  sslAutoRenew: integer('ssl_auto_renew', { mode: 'boolean' }).default(true).notNull(),
  
  // DNS state
  dnsResolving: integer('dns_resolving', { mode: 'boolean' }),
  dnsPointsToServer: integer('dns_points_to_server', { mode: 'boolean' }),
  
  // Health
  lastHealthCheckAt: integer('last_health_check_at', { mode: 'timestamp' }),
  lastHealthyAt: integer('last_healthy_at', { mode: 'timestamp' }),
  
  // Reconcile metadata
  lastReconcileAt: integer('last_reconcile_at', { mode: 'timestamp' }),
  reconcileErrors: text('reconcile_errors', { mode: 'json' }),
  
  // Observation timestamp
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SiteState = typeof siteStates.$inferSelect;
export type NewSiteState = typeof siteStates.$inferInsert;