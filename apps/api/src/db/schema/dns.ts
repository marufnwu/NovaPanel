import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { domains } from './domains';

export const dnsZones = sqliteTable('dns_zones', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  serial: integer('serial').notNull(),
  ttl: integer('ttl').default(3600),
  primaryNs: text('primary_ns').notNull(),
  adminEmail: text('admin_email').notNull(),
  refresh: integer('refresh').default(86400),
  retry: integer('retry').default(7200),
  expire: integer('expire').default(3600000),
  minimumTtl: integer('minimum_ttl').default(172800),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const dnsRecords = sqliteTable('dns_records', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => dnsZones.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'] }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').default(3600),
  priority: integer('priority'),                    // for MX, SRV
  isSystem: integer('is_system', { mode: 'boolean' }).default(false), // auto-generated records
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type DnsZone = typeof dnsZones.$inferSelect;
export type DnsRecord = typeof dnsRecords.$inferSelect;
