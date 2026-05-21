import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tunnels = sqliteTable('tunnels', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['cloudflare', 'ngrok', 'localtunnel'] }).notNull(),
  status: text('status', { enum: ['active', 'inactive', 'error'] }).default('inactive').notNull(),
  config: text('config', { mode: 'json' }).default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Tunnel = typeof tunnels.$inferSelect;
export type NewTunnel = typeof tunnels.$inferInsert;