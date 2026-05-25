import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const ftpAccounts = sqliteTable('ftp_accounts', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  databaseId: text('database_id'),
  siteId: text('site_id'),
  username: text('username').notNull(),
  password: text('password').notNull(),
  homeDir: text('home_dir').notNull(),
 quota: integer('quota'),
  status: text('status', { enum: ['active', 'suspended'] }).default('active').notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type FtpAccount = typeof ftpAccounts.$inferSelect;
export type NewFtpAccount = typeof ftpAccounts.$inferInsert;