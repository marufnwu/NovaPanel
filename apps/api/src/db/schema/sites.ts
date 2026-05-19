import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Minimal site identity - no runtime info, no PHP config, etc.
export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),                    // nanoid, e.g., 'site_abc123'
  name: text('name').notNull(),                   // Human label: "My Blog"
  systemUser: text('system_user').notNull().unique(), // OS user: sf_abc123
  homeDir: text('home_dir').notNull(),            // /var/www/sites/site_abc123
  status: text('status', { enum: ['active', 'suspended'] }).default('active').notNull(),
  diskUsedMb: integer('disk_used_mb').default(0).notNull(),
  bandwidthUsedMb: integer('bandwidth_used_mb').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
