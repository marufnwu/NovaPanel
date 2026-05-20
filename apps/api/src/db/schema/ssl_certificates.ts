import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites.js';

export const sslCertificates = sqliteTable('ssl_certificates', {
  id: text('id').primaryKey(),                    // nanoid
  siteId: text('site_id').references(() => sites.id, { onDelete: 'set null' }),
  
  // Primary domain this cert was issued for
  primaryDomain: text('primary_domain').notNull(),
  
  // Certificate type
  type: text('type', {
    enum: ['wildcard', 'single', 'san']
  }).notNull(),
  
  //domains covered by this certificate (for SAN/wildcard)
  domains: text('domains', { mode: 'json' }).default([]),  // string[]
  
  // Certificate data paths (NOT raw data - store paths for security)
  certPath: text('cert_path').notNull(),
  keyPath: text('key_path').notNull(),
  chainPath: text('chain_path'),
  
  // Let's Encrypt specific
  leWildcard: integer('le_wildcard', { mode: 'boolean' }).default(false).notNull(),
  leAccountId: text('le_account_id'),
  
  // Validity
  issuedAt: integer('issued_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true).notNull(),
  
  // Status
  status: text('status', {
    enum: ['active', 'expired', 'revoked', 'pending']
  }).default('active').notNull(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type SslCertificate = typeof sslCertificates.$inferSelect;
export type NewSslCertificate = typeof sslCertificates.$inferInsert;
