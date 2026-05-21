import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const cloudflareTunnels = sqliteTable('cloudflare_tunnels', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  tunnelToken: text('tunnel_token'),
  status: text('status', { enum: ['active', 'inactive', 'error'] }).default('inactive').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const cloudflareDns = sqliteTable('cloudflare_dns', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  zoneId: text('zone_id').notNull(),
  recordId: text('record_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  proxied: integer('proxied', { mode: 'boolean' }).default(false).notNull(),
  autoSync: integer('auto_sync', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type CloudflareTunnel = typeof cloudflareTunnels.$inferSelect;
export type NewCloudflareTunnel = typeof cloudflareTunnels.$inferInsert;
export type CloudflareDns = typeof cloudflareDns.$inferSelect;
export type NewCloudflareDns = typeof cloudflareDns.$inferInsert;