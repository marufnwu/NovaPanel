import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const buckets = sqliteTable('buckets', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  region: text('region').default('default'),
  publicAccess: integer('public_access', { mode: 'boolean' }).default(false).notNull(),
  versioning: integer('versioning', { mode: 'boolean' }).default(false).notNull(),
  corsRules: text('cors_rules', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const storageAccessKeys = sqliteTable('storage_access_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  accessKeyId: text('access_key_id').notNull().unique(),
  secretKeyHash: text('secret_key_hash').notNull(),
  permissions: text('permissions', { mode: 'json' }).default('[]').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Bucket = typeof buckets.$inferSelect;
export type NewBucket = typeof buckets.$inferInsert;
export type StorageAccessKey = typeof storageAccessKeys.$inferSelect;
export type NewStorageAccessKey = typeof storageAccessKeys.$inferInsert;