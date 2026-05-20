import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites.js';

export const siteProcesses = sqliteTable('site_processes', {
  id: text('id').primaryKey(),                    // nanoid
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  
  // Start command - user-defined, e.g., "npm start" or "gunicorn app:app"
  startCommand: text('start_command').notNull(),
  
  // Auto-assigned internal port - NEVER user-defined, system assigns from ephemeral range
  // Range: 30000-40000 to avoid conflicts
  internalPort: integer('internal_port'),
  
  // Process manager: pm2, supervisor, systemd, php-fpm
  processManager: text('process_manager', { enum: ['pm2', 'supervisor', 'systemd', 'php-fpm'] }).default('pm2').notNull(),
  
  // Process scaling
  replicas: integer('replicas').default(1).notNull(),
  
  // Auto-restart on crash
  autoRestart: integer('auto_restart', { mode: 'boolean' }).default(true).notNull(),
  
  // Health check
  healthCheckPath: text('health_check_path').default('/health'),
  
  // Process state (managed by reconciler)
  pid: integer('pid'),
  uptime: integer('uptime'),           // seconds
  restartCount: integer('restart_count').default(0).notNull(),
  memoryMb: integer('memory_mb'),
  cpuPercent: integer('cpu_percent'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SiteProcess = typeof siteProcesses.$inferSelect;
export type NewSiteProcess = typeof siteProcesses.$inferInsert;