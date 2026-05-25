import { z } from 'zod';

export const createDbSchema = z.object({
  domainId: z.string().optional(),
  name: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  engine: z.enum(['mariadb', 'postgresql']).default('mariadb'),
  charset: z.string().optional(),
  /** When true, also create a database user with access to this database */
  createUser: z.boolean().default(false),
  /** Username for the auto-created user (required if createUser is true) */
  username: z.string().min(1).max(32).regex(/^[a-z0-9_]+$/).optional(),
  /** Password for the auto-created user (required if createUser is true) */
  password: z.string().min(8).optional(),
  /** Host for the auto-created user */
  host: z.string().default('localhost'),
}).refine(
  (data) => !data.createUser || data.username,
  { message: 'username is required when createUser is true', path: ['username'] }
).refine(
  (data) => !data.createUser || data.password,
  { message: 'password is required when createUser is true', path: ['password'] }
);

export const createUserSchema = z.object({
  username: z.string().min(1).max(32).regex(/^[a-z0-9_]+$/),
  password: z.string().min(8),
  host: z.string().default('localhost'),
});

export const importDbSchema = z.object({
  sql: z.string().min(1),
});

// Change password schema
export const changePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Export schema (no body needed, exports to file)
export const exportSchema = z.object({
  // Optional target file path, defaults to /tmp/{database}_{timestamp}.sql
  outputPath: z.string().optional(),
});

// Repair schema (no body needed)
export const repairSchema = z.object({});

// Optimize schema (no body needed)
export const optimizeSchema = z.object({});

// Clone schema
export const cloneSchema = z.object({
  targetName: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores allowed'),
});

// Query execution schema with read-only restrictions
export const querySchema = z.object({
  sql: z.string().min(1).max(10000, 'Query must be under 10000 characters'),
  // Optional limit to prevent accidental large result sets
  limit: z.number().int().min(1).max(10000).optional().default(1000),
});
