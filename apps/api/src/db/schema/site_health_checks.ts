import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites.js';

export const siteHealthChecks = sqliteTable('site_health_checks', {
  id: text('id').primaryKey(),                    // nanoid
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }).unique(),

  // Check configuration
  checkInterval: integer('check_interval').default(60),   // seconds
  timeout: integer('timeout').default(10),               // seconds
  healthyThreshold: integer('healthy_threshold').default(3),  // consecutive successes before healthy
  unhealthyThreshold: integer('unhealthy_threshold').default(3), // consecutive failures before unhealthy

  // Check endpoint
  checkPath: text('check_path').default('/health'),
  checkMethod: text('check_method', { enum: ['GET', 'HEAD'] }).default('GET'),

  // Status
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true).notNull(),

  // State counters (managed by reconciler)
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  consecutiveSuccesses: integer('consecutive_successes').default(0).notNull(),

  // Last check results
  lastCheckAt: integer('last_check_at', { mode: 'timestamp' }),
  lastCheckDuration: integer('last_check_duration'),    // milliseconds
  lastCheckStatus: text('last_check_status', {
    enum: ['healthy', 'unhealthy', 'unknown']
  }).default('unknown').notNull(),
  lastCheckError: text('last_check_error'),

  // Health state
  healthStatus: text('health_status', {
    enum: ['healthy', 'unhealthy', 'unknown']
  }).default('unknown').notNull(),
  lastHealthyAt: integer('last_healthy_at', { mode: 'timestamp' }),
  lastUnhealthyAt: integer('last_unhealthy_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SiteHealthCheck = typeof siteHealthChecks.$inferSelect;
export type NewSiteHealthCheck = typeof siteHealthChecks.$inferInsert;
