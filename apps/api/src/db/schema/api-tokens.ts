import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * API tokens for programmatic access to the NovaPanel API.
 * Tokens are stored as SHA-256 hashes — the plain text is only shown once at creation.
 */
export const apiTokens = sqliteTable('api_tokens', {
  id: text('id').primaryKey(), // nanoid
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(), // SHA-256 hash of the raw token
  permissions: text('permissions').notNull(), // JSON array of permission strings
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type ApiTokenRow = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
