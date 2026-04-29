import { z } from 'zod';

export const createDbSchema = z.object({
  domainId: z.string().optional(),
  name: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  engine: z.enum(['mariadb', 'postgresql']).default('mariadb'),
  charset: z.string().optional(),
});

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
