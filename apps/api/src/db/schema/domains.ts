import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  siteId: text('site_id'),
  name: text('name').notNull(),
  type: text('type', { enum: ['apex', 'subdomain', 'wildcard'] }).default('apex').notNull(),
  dnsZoneId: text('dns_zone_id'),
  nameservers: text('nameservers', { mode: 'json' }),
  dnssecEnabled: integer('dnssec_enabled', { mode: 'boolean' }).default(false).notNull(),
  sslStatus: text('ssl_status', { enum: ['pending', 'active', 'expired', 'error'] }).default('pending').notNull(),
  sslCertId: text('ssl_cert_id'),
  sslAutoRenew: integer('ssl_auto_renew', { mode: 'boolean' }).default(true).notNull(),
  forceHttps: integer('force_https', { mode: 'boolean' }).default(true).notNull(),
  hstsEnabled: integer('hsts_enabled', { mode: 'boolean' }).default(false).notNull(),
  proxyEnabled: integer('proxy_enabled', { mode: 'boolean' }).default(true).notNull(),
  customNginxConfig: text('custom_nginx_config'),
  status: text('status', { enum: ['active', 'suspended', 'pending'] }).default('active').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const sslCertificates = sqliteTable('ssl_certificates', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull(),
  type: text('type', { enum: ['letsencrypt', 'zerossl', 'google', 'custom', 'self_signed'] }).notNull(),
  certPem: text('cert_pem'),
  keyPem: text('key_pem'),
  chainPem: text('chain_pem'),
  issuedAt: integer('issued_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true).notNull(),
  renewalDaysBeforeExpiry: integer('renewal_days').default(14).notNull(),
  status: text('status', { enum: ['active', 'pending', 'expired', 'revoked', 'error'] }).default('pending').notNull(),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type SslCertificate = typeof sslCertificates.$inferSelect;
export type NewSslCertificate = typeof sslCertificates.$inferInsert;