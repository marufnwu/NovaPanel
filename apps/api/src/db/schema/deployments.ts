import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites';

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),                    // nanoid, e.g., 'deploy_abc123'
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  
  // Deployment sequence number for this site
  sequence: integer('sequence').notNull(),
  
  // Source type
  sourceType: text('source_type', { 
    enum: ['git', 'archive', 'empty', 'rollback'] 
  }).notNull(),
  
  // Git info (if sourceType = git)
  gitRepo: text('git_repo'),
  gitBranch: text('git_branch').default('main'),
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
  
  // Archive info (if sourceType = archive)  
  archivePath: text('archive_path'),
  
  // Deployment directory (immutable - never modified after creation)
  deploymentPath: text('deployment_path').notNull(),
  
  // Build status
  buildStatus: text('build_status', {
    enum: ['pending', 'cloning', 'installing', 'building', 'testing', 'success', 'failed']
  }).default('pending').notNull(),
  
  // Deploy status
  deployStatus: text('deploy_status', {
    enum: ['pending', 'deploying', 'success', 'failed', 'rolled_back']
  }).default('pending').notNull(),
  
  // Build/deploy logs
  buildLogs: text('build_logs'),
  deployLogs: text('deploy_logs'),
  logsPath: text('logs_path'),
  
  // Error message if failed
  errorMessage: text('error_message'),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  deployedAt: integer('deployed_at', { mode: 'timestamp' }),
});

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;