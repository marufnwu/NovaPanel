import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { websites } from './websites.js';

export const installedApps = sqliteTable('installed_apps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: text('app_id').notNull().unique(),
  appName: text('app_name').notNull(),
  domainId: text('domain_id'),
  websiteId: text('website_id').references(() => websites.id, { onDelete: 'set null' }),
  installPath: text('install_path'),
  status: text('status').notNull().default('installing'),
  progress: integer('progress').default(0),
  adminEmail: text('admin_email'),
  adminPassword: text('admin_password'),
  databaseHost: text('database_host'),
  databaseName: text('database_name'),
  databaseUser: text('database_user'),
  databasePassword: text('database_password'),
  installedAt: integer('installed_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const appInstallLogs = sqliteTable('app_install_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: text('app_id'),
  domainId: text('domain_id'),
  message: text('message'),
  level: text('level').default('info'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const appConfigurations = sqliteTable('app_configurations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: text('app_id'),
  configKey: text('config_key'),
  configValue: text('config_value'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
