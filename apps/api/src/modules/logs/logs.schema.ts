import { z } from 'zod';

export const systemLogsSchema = z.object({
  log: z.string(),
  entries: z.array(z.object({
    timestamp: z.string(),
    level: z.string(),
    message: z.string(),
    source: z.string().optional(),
  })),
});

export const systemLogsQuerySchema = z.object({
  lines: z.coerce.number().min(10).max(5000).default(100),
});

export type SystemLogsResponse = z.infer<typeof systemLogsSchema>;
export type SystemLogsQuery = z.infer<typeof systemLogsQuerySchema>;