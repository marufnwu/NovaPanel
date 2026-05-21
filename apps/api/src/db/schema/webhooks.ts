import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: text('events', { mode: 'json' }).notNull().default([]),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  headers: text('headers', { mode: 'json' }).default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull(),
  event: text('event').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error: text('error'),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;