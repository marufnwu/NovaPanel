import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const plugins = sqliteTable('plugins', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  author: text('author'),
  manifest: text('manifest', { mode: 'json' }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(false).notNull(),
  config: text('config', { mode: 'json' }).default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Plugin = typeof plugins.$inferSelect;
export type NewPlugin = typeof plugins.$inferInsert;