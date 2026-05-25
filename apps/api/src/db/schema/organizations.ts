import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] }).default('free').notNull(),
  status: text('status', { enum: ['active', 'suspended', 'cancelled'] }).default('active').notNull(),
  settings: text('settings', { mode: 'json' }).default('{}').notNull(),
  quotas: text('quotas', { mode: 'json' }).default('{}').notNull(),
  branding: text('branding', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const organizationMembers = sqliteTable('organization_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member', 'billing'] }).default('member').notNull(),
  permissions: text('permissions', { mode: 'json' }).default('[]').notNull(),
  invitedBy: text('invited_by'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferInsert;