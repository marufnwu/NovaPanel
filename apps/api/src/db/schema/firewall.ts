import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const firewallRules = sqliteTable('firewall_rules', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  action: text('action', { enum: ['allow', 'deny'] }).notNull(),
  protocol: text('protocol', { enum: ['tcp', 'udp', 'icmp', 'all'] }).default('tcp').notNull(),
  port: text('port'),
  source: text('source'),
  destination: text('destination'),
  comment: text('comment'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type FirewallRule = typeof firewallRules.$inferSelect;
export type NewFirewallRule = typeof firewallRules.$inferInsert;