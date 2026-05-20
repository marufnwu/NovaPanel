import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites.js';

// Runtime configuration stored as JSONB for flexibility
// Supports PHP, Node, Python, Static, Docker, etc.
export const siteRuntimes = sqliteTable('site_runtimes', {
  id: text('id').primaryKey(),                    // nanoid
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  
  // JSONB runtime config with schemaVersion for migration support
  // Example: {"schemaVersion": 1, "runtime": "node", "version": "20", "buildCommand": "npm run build", "startCommand": "npm start"}
  runtimeConfig: text('runtime_config', { mode: 'json' }).notNull(),
  
  // Web server choice
  webServer: text('web_server', { enum: ['nginx', 'apache'] }).default('nginx').notNull(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SiteRuntime = typeof siteRuntimes.$inferSelect;
export type NewSiteRuntime = typeof siteRuntimes.$inferInsert;

// TypeScript type for runtime config structure
export interface RuntimeConfig {
  schemaVersion: number;
  runtime: 'php' | 'node' | 'python' | 'static' | 'docker' | 'ruby' | 'go';
  version?: string;
  buildCommand?: string;
  startCommand?: string;
  healthCheckPath?: string;
  // PHP specific
  phpVersion?: string;
  // Node specific
  nodeVersion?: string;
  // Python specific
  pythonVersion?: string;
  venvPath?: string;
  // Docker specific
  dockerfile?: string;
  dockerImage?: string;
}