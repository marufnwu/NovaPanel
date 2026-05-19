import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sslCertificates } from './ssl.js';

export const domainSslBindings = sqliteTable('domain_ssl_bindings', {
  id: text('id').primaryKey(),                    // nanoid
  certId: text('cert_id').notNull().references(() => sslCertificates.id, { onDelete: 'cascade' }),
  
  // Domain this cert is bound to
  domainId: text('domain_id').notNull(),          // References domains.id
  
  // Is this the primary binding for the cert?
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false).notNull(),
  
  // SSL validation status
  validationStatus: text('validation_status', {
    enum: ['pending', 'valid', 'failed']
  }).default('valid').notNull(),
  
  // HTTP challenge path (for Let's Encrypt)
  httpChallengePath: text('http_challenge_path'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type DomainSslBinding = typeof domainSslBindings.$inferSelect;
export type NewDomainSslBinding = typeof domainSslBindings.$inferInsert;
