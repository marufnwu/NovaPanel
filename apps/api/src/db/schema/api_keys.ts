import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  userId: text('user_id'),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  permissions: text('permissions', { mode: 'json' }).default('[]').notNull(),
  scopes: text('scopes', { mode: 'json' }).default('[]').notNull(),
  rateLimit: integer('rate_limit').default(1000).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;