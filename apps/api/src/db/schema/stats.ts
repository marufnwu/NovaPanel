import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const serverStats = sqliteTable('server_stats', {
  id: text('id').primaryKey(),
  cpuUsage: real('cpu_usage').notNull(),            // percentage
  memoryUsed: integer('memory_used').notNull(),     // bytes
  memoryTotal: integer('memory_total').notNull(),   // bytes
  diskUsed: integer('disk_used').notNull(),         // bytes
  diskTotal: integer('disk_total').notNull(),       // bytes
  networkRx: integer('network_rx').default(0),      // bytes per second
  networkTx: integer('network_tx').default(0),      // bytes per second
  loadAvg1: real('load_avg_1'),
  loadAvg5: real('load_avg_5'),
  loadAvg15: real('load_avg_15'),
  uptime: integer('uptime'),                       // seconds
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type ServerStat = typeof serverStats.$inferSelect;
