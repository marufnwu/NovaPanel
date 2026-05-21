import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  permissions: text('permissions', { mode: 'json' }).default('[]').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;