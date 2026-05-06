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

export const changePasswordSchema = z.object({
  password: z.string().min(8),
});

export const importDbSchema = z.object({
  sql: z.string().min(1),
});
