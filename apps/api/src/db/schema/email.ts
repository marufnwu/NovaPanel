import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';

export const mailDomains = sqliteTable('mail_domains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  catchAllDestination: text('catch_all_destination'),   // email address or "drop" for catch-all
  spfRecord: text('spf_record'),
  dkimPublicKey: text('dkim_public_key'),
  dkimPrivateKey: text('dkim_private_key'),          // encrypted
  dmarcPolicy: text('dmarc_policy'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const mailboxes = sqliteTable('mailboxes', {
  id: text('id').primaryKey(),
  mailDomainId: text('mail_domain_id').notNull().references(() => mailDomains.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),              // user@example.com
  passwordHash: text('password_hash').notNull(),
  quotaMb: integer('quota_mb').default(1024),
  usedMb: integer('used_mb').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  autoresponder: integer('autoresponder', { mode: 'boolean' }).default(false),
  autoresponderMessage: text('autoresponder_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const mailAliases = sqliteTable('mail_aliases', {
  id: text('id').primaryKey(),
  mailDomainId: text('mail_domain_id').notNull().references(() => mailDomains.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),                   // alias@example.com
  destination: text('destination').notNull(),        // dest@example.com (can be external)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const mailForwards = sqliteTable('mail_forwards', {
  id: text('id').primaryKey(),
  mailboxId: text('mailbox_id').notNull().references(() => mailboxes.id, { onDelete: 'cascade' }),
  forwardTo: text('forward_to').notNull(),
  keepCopy: integer('keep_copy', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type MailDomain = typeof mailDomains.$inferSelect;
export type Mailbox = typeof mailboxes.$inferSelect;
export type MailAlias = typeof mailAliases.$inferSelect;
export type MailForward = typeof mailForwards.$inferSelect;
