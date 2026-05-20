import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';

/**
 * Cloudflare zones linked to NovaPanel domains.
 * Stores the Cloudflare API token and zone metadata.
 */
export const cloudflareZones = sqliteTable('cloudflare_zones', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'cascade' }),
  zoneId: text('zone_id'),                          // Cloudflare zone UUID
  zoneName: text('zone_name').notNull(),
  accountId: text('account_id'),                     // CF account ID
  apiToken: text('api_token'),                        // encrypted CF API token
  plan: text('plan'),                                 // e.g. "Free", "Pro", "Business"
  status: text('status').default('active'),           // active, pending, paused
  sslMode: text('ssl_mode').default('flexible'),      // off, flexible, full, strict
  isPaused: integer('is_paused', { mode: 'boolean' }).default(false),
  nameservers: text('nameservers'),                   // JSON array of CF nameservers
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * Redirect rules managed via Cloudflare API.
 * These are Cloudflare-side redirect rules (not nginx).
 */
export const cloudflareRedirectRules = sqliteTable('cloudflare_redirect_rules', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => cloudflareZones.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id'),                           // CF ruleset rule ID
  sourcePattern: text('source_pattern').notNull(),    // e.g. "www.example.com/*"
  destinationUrl: text('destination_url').notNull(),  // e.g. "https://example.com/$1"
  redirectType: text('redirect_type', { enum: ['301', '302'] }).default('301'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type CloudflareZone = typeof cloudflareZones.$inferSelect;
export type CloudflareRedirectRule = typeof cloudflareRedirectRules.$inferSelect;
