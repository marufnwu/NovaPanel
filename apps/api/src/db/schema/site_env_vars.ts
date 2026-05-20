import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites';

export const siteEnvVars = sqliteTable('site_env_vars', {
  id: text('id').primaryKey(),                    // nanoid
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),

  // Variable key
  key: text('key').notNull(),

  // Variable value (encrypted at rest)
  value: text('value').notNull(),

  // Scope: runtime (injected at runtime), build (used during build), secret (never exposed)
  scope: text('scope', {
    enum: ['runtime', 'build', 'secret']
  }).default('runtime').notNull(),

  // Whether this is a system variable (managed by panel, not user)
  isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SiteEnvVar = typeof siteEnvVars.$inferSelect;
export type NewSiteEnvVar = typeof siteEnvVars.$inferInsert;