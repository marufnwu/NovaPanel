import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const dnsZones = sqliteTable('dns_zones', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  domainId: text('domain_id').notNull(),
  name: text('name').notNull(),
  soa: text('soa', { mode: 'json' }),
  nsRecords: text('ns_records', { mode: 'json' }),
  dnssecEnabled: integer('dnssec_enabled', { mode: 'boolean' }).default(false).notNull(),
  dnssecKeys: text('dnssec_keys', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const dnsRecords = sqliteTable('dns_records', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS', 'PTR'] }).notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').default(3600).notNull(),
  priority: integer('priority'),
  weight: integer('weight'),
  port: integer('port'),
  proxied: integer('proxied', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type DnsZone = typeof dnsZones.$inferSelect;
export type NewDnsZone = typeof dnsZones.$inferInsert;
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type NewDnsRecord = typeof dnsRecords.$inferInsert;