import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const usageRecords = sqliteTable('usage_records', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  resourceType: text('resource_type', { enum: ['cpu', 'memory', 'storage', 'bandwidth', 'requests'] }).notNull(),
  resourceId: text('resource_id'),
  quantity: integer('quantity').notNull(),
  unit: text('unit').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  status: text('status', { enum: ['draft', 'open', 'paid', 'overdue', 'cancelled'] }).default('draft').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').default('USD').notNull(),
  periodStart: integer('period_start', { mode: 'timestamp' }),
  periodEnd: integer('period_end', { mode: 'timestamp' }),
  lineItems: text('line_items', { mode: 'json' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  price: integer('price').notNull(),
  currency: text('currency').default('USD').notNull(),
  interval: text('interval', { enum: ['monthly', 'yearly'] }).default('monthly').notNull(),
  quotas: text('quotas', { mode: 'json' }).notNull(),
  features: text('features', { mode: 'json' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;