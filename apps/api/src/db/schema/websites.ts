import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const websites = sqliteTable('websites', {
  id: text('id').primaryKey(),                    // nanoid, e.g., 'ws_abc123'
  name: text('name').notNull(),                   // Human label: "Main Site"
  systemUser: text('system_user').notNull().unique(), // OS user: sf_abc123
  documentRoot: text('document_root').notNull(),   // /var/www/sites/ws_abc123/httpdocs
  phpVersion: text('php_version').default('8.2').notNull(),
  phpHandler: text('php_handler', { enum: ['php-fpm', 'cgi', 'disabled'] }).default('php-fpm').notNull(),
  webServer: text('web_server', { enum: ['nginx', 'apache', 'nginx+apache'] }).default('nginx+apache').notNull(),
  status: text('status', { enum: ['active', 'suspended'] }).default('active').notNull(),
  diskUsedMb: integer('disk_used_mb').default(0).notNull(),
  bandwidthUsedMb: integer('bandwidth_used_mb').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Website = typeof websites.$inferSelect;
