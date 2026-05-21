import { z } from 'zod';

export const createCronJobSchema = z.object({
  command: z.string().min(1),
  schedule: z.string().min(9).max(100),
  siteId: z.string().optional(),
  name: z.string().optional(),
});
