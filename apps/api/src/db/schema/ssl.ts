import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';

export const legacySslCertificates = sqliteTable('ssl_certificates', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id),
  type: text('type', { enum: ['letsencrypt', 'custom', 'self-signed'] }).notNull(),
  certificate: text('certificate'),                   // PEM
  privateKey: text('private_key'),                    // PEM (encrypted at rest)
  chain: text('chain'),                               // CA chain PEM
  sanDomains: text('san_domains'),                    // JSON array of Subject Alternative Names
  isWildcard: integer('is_wildcard', { mode: 'boolean' }).default(false),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true),
  lastRenewedAt: integer('last_renewed_at', { mode: 'timestamp' }),
  renewalFailCount: integer('renewal_fail_count').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const sslCertificates = legacySslCertificates;
export type LegacySslCertificate = typeof legacySslCertificates.$inferSelect;
