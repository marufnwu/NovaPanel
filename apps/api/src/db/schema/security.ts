import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const wafRules = sqliteTable('waf_rules', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  type: text('type', { enum: ['owasp', 'custom', 'rate_limit', 'geo_block', 'bot'] }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  priority: integer('priority').default(100).notNull(),
  config: text('config', { mode: 'json' }).default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const ipAllowlists = sqliteTable('ip_allowlists', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  ips: text('ips', { mode: 'json' }).default('[]').notNull(),
  type: text('type', { enum: ['allow', 'block'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type WafRule = typeof wafRules.$inferSelect;
export type NewWafRule = typeof wafRules.$inferInsert;
export type IpAllowlist = typeof ipAllowlists.$inferSelect;
export type NewIpAllowlist = typeof ipAllowlists.$inferInsert;