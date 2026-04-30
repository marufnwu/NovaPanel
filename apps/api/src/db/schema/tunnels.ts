import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains.js';

export const cloudflareTunnels = sqliteTable('cloudflare_tunnels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tunnelId: text('tunnel_id'),                      // CF tunnel UUID
  accountId: text('account_id'),
  apiToken: text('api_token'),                      // encrypted
  credentialsJson: text('credentials_json'),        // encrypted JSON
  status: text('status', { enum: ['active', 'inactive', 'error'] }).default('inactive'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const tunnelRoutes = sqliteTable('tunnel_routes', {
  id: text('id').primaryKey(),
  tunnelId: text('tunnel_id').notNull().references(() => cloudflareTunnels.id, { onDelete: 'cascade' }),
  hostname: text('hostname').notNull(),             // panel.example.com
  service: text('service').notNull(),               // http://localhost:8080
  domainId: text('domain_id').references(() => domains.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type CloudflareTunnel = typeof cloudflareTunnels.$inferSelect;
export type TunnelRoute = typeof tunnelRoutes.$inferSelect;
