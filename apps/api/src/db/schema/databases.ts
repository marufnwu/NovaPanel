import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains.js';
import { websites } from './websites.js';

export const databases = sqliteTable('databases', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id),
  websiteId: text('website_id').references(() => websites.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  engine: text('engine', { enum: ['mariadb', 'postgresql'] }).notNull().default('mariadb'),
  charset: text('charset').default('utf8mb4'),
  collation: text('collation').default('utf8mb4_unicode_ci'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const databaseUsers = sqliteTable('database_users', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull().references(() => databases.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),     // stored for display; real auth in DB engine
  host: text('host').default('localhost'),
  privileges: text('privileges').default('ALL'),     // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Database = typeof databases.$inferSelect;
export type DatabaseUser = typeof databaseUsers.$inferSelect;
