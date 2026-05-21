import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const serverStats = sqliteTable('server_stats', {
  id: text('id').primaryKey(),
  cpuPercent: integer('cpu_percent').notNull(),
  memoryPercent: integer('memory_percent').notNull(),
  memoryUsedMb: integer('memory_used_mb').notNull(),
  memoryTotalMb: integer('memory_total_mb').notNull(),
  diskPercent: integer('disk_percent').notNull(),
  diskUsedMb: integer('disk_used_mb').notNull(),
  diskTotalMb: integer('disk_total_mb').notNull(),
  loadAverage: text('load_average', { mode: 'json' }),
  networkIn: integer('network_in').default(0).notNull(),
  networkOut: integer('network_out').default(0).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type ServerStats = typeof serverStats.$inferSelect;
export type NewServerStats = typeof serverStats.$inferInsert;