import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { websites } from './websites.js';
import { sites } from './sites.js';

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  documentRoot: text('document_root'),                  // nullable: parked/redirect/mail-only have no docroot
  systemUser: text('system_user'),                     // OS system user for this domain
  phpVersion: text('php_version').default('8.2').notNull(),
  phpHandler: text('php_handler', { enum: ['php-fpm', 'cgi', 'disabled'] }).default('php-fpm').notNull(),
  webServer: text('web_server', { enum: ['nginx', 'apache', 'nginx+apache'] }).default('nginx+apache').notNull(),
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(false).notNull(),
  sslCertId: text('ssl_cert_id'),
  redirectHttpToHttps: integer('redirect_http_to_https', { mode: 'boolean' }).default(false).notNull(),
  hsts: integer('hsts', { mode: 'boolean' }).default(false).notNull(),
  diskUsedMb: integer('disk_used_mb').default(0).notNull(),
  bandwidthUsedMb: integer('bandwidth_used_mb').default(0).notNull(),
  status: text('status', { enum: ['active', 'suspended', 'pending'] }).default('active').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),

  // --- Domain/website separation (Phase 1) ---
  type: text('type', { enum: ['primary', 'addon', 'parked', 'subdomain', 'redirect', 'mail-only'] }).default('primary').notNull(),
  websiteId: text('website_id').references(() => websites.id, { onDelete: 'set null' }),
  siteId: text('site_id').references(() => sites.id, { onDelete: 'set null' }),
  parentDomainId: text('parent_domain_id'),           // subdomain → parent domain; parked → domain it mirrors

  // Primary flag — at most one primary per website (enforced at service layer)
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false).notNull(),

  // Subdomain flag - derived from type === 'subdomain'
  isSubdomain: integer('is_subdomain', { mode: 'boolean' }).default(false).notNull(),

  // Redirect config (type = redirect only)
  redirectTarget: text('redirect_target'),

  // Suspension storage — when single domain is suspended, its normal server
  // block content is stored here so it can be restored without file-level backup
  suspendedConfig: text('suspended_config'),
});

export const subdomains = sqliteTable('subdomains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  documentRoot: text('document_root').notNull(),
  phpVersion: text('php_version'),
  websiteId: text('website_id').references(() => websites.id, { onDelete: 'set null' }), // Optional: allows subdomain to be attached to a different website than parent domain
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const domainAliases = sqliteTable('domain_aliases', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const domainRedirects = sqliteTable('domain_redirects', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  sourcePath: text('source_path').notNull(),
  targetUrl: text('target_url').notNull(),
  type: text('type', { enum: ['301', '302'] }).default('301').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Domain = typeof domains.$inferSelect;
export type Subdomain = typeof subdomains.$inferSelect;
export type DomainAlias = typeof domainAliases.$inferSelect;
export type DomainRedirect = typeof domainRedirects.$inferSelect;
