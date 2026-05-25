import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const mailboxes = sqliteTable('mailboxes', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  domainId: text('domain_id').notNull(),
  username: text('username').notNull(),
  password: text('password'),
  quota: integer('quota').default(5120),
  aliases: text('aliases', { mode: 'json' }).default('[]').notNull(),
  forwards: text('forwards', { mode: 'json' }).default('[]').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Mailbox = typeof mailboxes.$inferSelect;
export type NewMailbox = typeof mailboxes.$inferInsert;