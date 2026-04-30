import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // nanoid
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin'] }).notNull().default('admin'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false).notNull(),
  apiTokenHash: text('api_token_hash'), // SHA256 of sf_ token
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: integer('locked_until', { mode: 'timestamp' }),
  passwordChangedAt: integer('password_changed_at', { mode: 'timestamp' }),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).default(false).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  // Password reset fields
  passwordResetToken: text('password_reset_token'), // SHA-256 hash of reset token
  passwordResetExpiresAt: integer('password_reset_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionHash: text('session_hash').notNull(), // SHA-256 hash of session ID for WS auth
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  rememberMe: integer('remember_me', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * Temporary tokens for 2FA verification flow.
 * When 2FA is enabled, login returns a tempToken instead of a session.
 * The user must verify their 2FA code with the tempToken to get a real session.
 */
export const tempTokens = sqliteTable('temp_tokens', {
  id: text('id').primaryKey(), // nanoid
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(), // SHA-256 hash of the temp token
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * Two-factor authentication backup codes.
 * Stored as Argon2 hashes for security. Each code is single-use.
 */
export const twoFactorBackupCodes = sqliteTable('two_factor_backup_codes', {
  id: text('id').primaryKey(), // nanoid
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(), // Argon2 hash of the backup code
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type TempToken = typeof tempTokens.$inferSelect;
export type NewTempToken = typeof tempTokens.$inferInsert;
export type TwoFactorBackupCode = typeof twoFactorBackupCodes.$inferSelect;
export type NewTwoFactorBackupCode = typeof twoFactorBackupCodes.$inferInsert;
