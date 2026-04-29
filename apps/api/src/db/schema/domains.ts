import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { websites } from './websites.js';

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  documentRoot: text('document_root').notNull(),
  systemUser: text('system_user'),                          // OS system user for this domain
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

  // --- New columns for domain/website separation (Phase 1) ---
  type: text('type', { enum: ['primary', 'subdomain', 'alias', 'redirect', 'parked', 'mail-only'] }).default('primary').notNull(),
  websiteId: text('website_id').references(() => websites.id, { onDelete: 'set null' }),
  redirectTarget: text('redirect_target'),
  parentDomainId: text('parent_domain_id'),
});

export const subdomains = sqliteTable('subdomains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  documentRoot: text('document_root').notNull(),
  phpVersion: text('php_version'),
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
