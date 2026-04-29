import { z } from 'zod';

export const createMailboxSchema = z.object({
  username: z.string().min(1).max(64).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(8),
  quotaMb: z.number().min(10).default(1024),
});

export const updateMailboxSchema = z.object({
  password: z.string().min(8).optional(),
  quotaMb: z.number().min(10).optional(),
  isActive: z.boolean().optional(),
  autoresponder: z.boolean().optional(),
  autoresponderMessage: z.string().max(5000).optional(),
});

export const createAliasSchema = z.object({
  alias: z.string().min(1),
  destination: z.string().email(),
});

export const createForwardSchema = z.object({
  forwardTo: z.string().email(),
  keepCopy: z.boolean().default(true),
});
