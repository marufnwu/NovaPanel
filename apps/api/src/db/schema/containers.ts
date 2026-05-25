import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const containers = sqliteTable('containers', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  type: text('type', { enum: ['compose', 'dockerfile', 'image'] }).notNull(),
  composeFile: text('compose_file'),
  dockerfile: text('dockerfile'),
  image: text('image'),
  env: text('env', { mode: 'json' }).default('{}').notNull(),
  secrets: text('secrets', { mode: 'json' }).default('[]').notNull(),
  networkMode: text('network_mode').default('bridge'),
  exposedPorts: text('exposed_ports', { mode: 'json' }).default('[]').notNull(),
  cpuLimit: integer('cpu_limit'),
  memoryLimit: integer('memory_limit'),
  replicas: integer('replicas').default(1).notNull(),
  status: text('status', { enum: ['running', 'stopped', 'error', 'restarting'] }).default('stopped').notNull(),
  containerId: text('container_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const containerVolumes = sqliteTable('container_volumes', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  size: integer('size'),
  mountPoint: text('mount_point'),
  driver: text('driver').default('local'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const registries = sqliteTable('registries', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  provider: text('provider', { enum: ['dockerhub', 'ghcr', 'ecr', 'gcr', 'selfhosted'] }).notNull(),
  url: text('url'),
  username: text('username'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Container = typeof containers.$inferSelect;
export type NewContainer = typeof containers.$inferInsert;
export type ContainerVolume = typeof containerVolumes.$inferSelect;
export type NewContainerVolume = typeof containerVolumes.$inferInsert;
export type Registry = typeof registries.$inferSelect;
export type NewRegistry = typeof registries.$inferInsert;