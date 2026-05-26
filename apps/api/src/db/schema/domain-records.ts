import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const domainSubdomains = sqliteTable('domain_subdomains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull(),
  name: text('name').notNull(),
  documentRoot: text('document_root').default(''),
  phpVersion: text('php_version').default('8.1'),
  siteId: text('site_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const domainAliases = sqliteTable('domain_aliases', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull(),
  alias: text('alias').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const domainRedirects = sqliteTable('domain_redirects', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull(),
  sourcePath: text('source_path').notNull(),
  targetUrl: text('target_url').notNull(),
  type: text('type', { enum: ['301', '302'] }).default('301').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type DomainSubdomain = typeof domainSubdomains.$inferSelect;
export type NewDomainSubdomain = typeof domainSubdomains.$inferInsert;
export type DomainAlias = typeof domainAliases.$inferSelect;
export type NewDomainAlias = typeof domainAliases.$inferInsert;
export type DomainRedirect = typeof domainRedirects.$inferSelect;
export type NewDomainRedirect = typeof domainRedirects.$inferInsert;
