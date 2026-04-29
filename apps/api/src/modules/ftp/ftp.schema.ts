import { z } from 'zod';

export const createFtpAccountSchema = z.object({
  username: z.string().min(1).max(32).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(8),
  homeDir: z.string().min(1),
  readonly: z.boolean().default(false),
});

export const updateFtpAccountSchema = z.object({
  password: z.string().min(8).optional(),
  homeDir: z.string().min(1).optional(),
  readonly: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
