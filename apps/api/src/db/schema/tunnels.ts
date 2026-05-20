import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';

export const cloudflareTunnels = sqliteTable('cloudflare_tunnels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tunnelId: text('tunnel_id'),                      // CF tunnel UUID
  tunnelToken: text('tunnel_token'),                // encrypted: token from POST /cfd_tunnel response
  accountId: text('account_id'),                     // CF account ID
  zoneId: text('zone_id'),                           // CF zone ID for DNS operations
  apiToken: text('api_token'),                        // encrypted: Cloudflare API token
  credentialsJson: text('credentials_json'),         // encrypted JSON (legacy, for old tunnels)
  status: text('status', { enum: ['active', 'inactive', 'error'] }).default('inactive'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const tunnelRoutes = sqliteTable('tunnel_routes', {
  id: text('id').primaryKey(),
  tunnelId: text('tunnel_id').notNull().references(() => cloudflareTunnels.id, { onDelete: 'cascade' }),
  hostname: text('hostname').notNull(),             // panel.example.com
  service: text('service').notNull(),               // http://localhost:8080 or https://localhost:3000
  noTlsVerify: integer('no_tls_verify', { mode: 'boolean' }).default(false), // skip cert verification for self-signed certs
  domainId: text('domain_id').references(() => domains.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type CloudflareTunnel = typeof cloudflareTunnels.$inferSelect;
export type TunnelRoute = typeof tunnelRoutes.$inferSelect;
