import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').default('en'),
  timezone: text('timezone').default('UTC'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('member'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).default(false).notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false).notNull(),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: integer('locked_until', { mode: 'timestamp' }),
  passwordChangedAt: integer('password_changed_at', { mode: 'timestamp' }),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).default(false).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpiresAt: integer('password_reset_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionHash: text('session_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  rememberMe: integer('remember_me', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const tempTokens = sqliteTable('temp_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const twoFactorBackupCodes = sqliteTable('two_factor_backup_codes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type TempToken = typeof tempTokens.$inferSelect;
export type NewTempToken = typeof tempTokens.$inferInsert;
export type TwoFactorBackupCode = typeof twoFactorBackupCodes.$inferSelect;
export type NewTwoFactorBackupCode = typeof twoFactorBackupCodes.$inferInsert;