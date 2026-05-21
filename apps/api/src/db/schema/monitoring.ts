import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const metrics = sqliteTable('metrics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  labels: text('labels', { mode: 'json' }).default('{}').notNull(),
  value: integer('value').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id'),
  name: text('name').notNull(),
  description: text('description'),
  metric: text('metric').notNull(),
  condition: text('condition', { enum: ['gt', 'lt', 'eq', 'gte', 'lte'] }).notNull(),
  threshold: integer('threshold').notNull(),
  duration: integer('duration').default(60).notNull(),
  channels: text('channels', { mode: 'json' }).default('[]').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const alertHistory = sqliteTable('alert_history', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id').notNull(),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  value: integer('value').notNull(),
  message: text('message'),
});

export type Metric = typeof metrics.$inferSelect;
export type NewMetric = typeof metrics.$inferInsert;
export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type NewAlertHistory = typeof alertHistory.$inferInsert;