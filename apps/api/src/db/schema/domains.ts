import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites';

/**
 * Unified domains table — all domain types live here.
 *
 * Domain types:
 *   primary   — main domain for a site, owns the site root directory
 *   addon     — independent domain sharing site resources, own subdirectory
 *   parked    — alias pointing to primary domain's content (merged server_name)
 *   subdomain — child of a parent domain, own subdirectory
 *   redirect  — HTTP 301/302 redirect to another URL
 *   mail-only — email only, no web hosting
 *
 * Relationships:
 *   siteId          → sites table (which site owns this domain's infrastructure)
 *   parentDomainId  → self-referential FK (subdomain parent, parked mirror target)
 *
 * At most one primary per site — enforced at service layer + DB unique index.
 */
export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),

  // --- Container relationship (v4 unified) ---
  siteId: text('site_id').references(() => sites.id, { onDelete: 'set null' }),

  // --- Domain classification ---
  type: text('type', {
    enum: ['primary', 'addon', 'parked', 'subdomain', 'redirect', 'mail-only']
  }).default('primary').notNull(),

  // Primary flag — at most one per site (enforced at service layer)
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false).notNull(),

  // Self-referential: subdomain → parent domain; parked → domain it mirrors
  parentDomainId: text('parent_domain_id'),

  // --- Document root (nullable for parked/redirect/mail-only) ---
  documentRoot: text('document_root'),

  // --- Hosting config ---
  phpVersion: text('php_version').default('8.2').notNull(),
  phpHandler: text('php_handler', { enum: ['php-fpm', 'cgi', 'disabled'] }).default('php-fpm').notNull(),
  webServer: text('web_server', { enum: ['nginx', 'apache', 'nginx+apache'] }).default('nginx+apache').notNull(),

  // --- Redirect config (type = redirect only) ---
  redirectTarget: text('redirect_target'),
  redirectType: text('redirect_type', { enum: ['301', '302'] }).default('301'),

  // --- SSL ---
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(false).notNull(),
  sslCertId: text('ssl_cert_id'),
  redirectHttpToHttps: integer('redirect_http_to_https', { mode: 'boolean' }).default(false).notNull(),
  hsts: integer('hsts', { mode: 'boolean' }).default(false).notNull(),

  // --- Suspension — original server block stored here for single-domain suspend ---
  suspendedConfig: text('suspended_config'),

  // --- Status & timestamps ---
  status: text('status', { enum: ['active', 'suspended', 'pending'] }).default('active').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Path-level redirects (e.g., /old-page → /new-page on same domain)
export const domainRedirects = sqliteTable('domain_redirects', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  sourcePath: text('source_path').notNull(),
  targetUrl: text('target_url').notNull(),
  type: text('type', { enum: ['301', '302'] }).default('301').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Types
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DomainRedirect = typeof domainRedirects.$inferSelect;
