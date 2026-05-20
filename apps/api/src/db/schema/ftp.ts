import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';
import { sites } from './sites';

export const ftpAccounts = sqliteTable('ftp_accounts', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  websiteId: text('website_id').references(() => sites.id, { onDelete: 'set null' }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  homeDir: text('home_dir').notNull(),
  readonly: integer('readonly', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  lastLoginIp: text('last_login_ip'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type FtpAccount = typeof ftpAccounts.$inferSelect;
