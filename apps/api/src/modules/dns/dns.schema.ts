import { z } from 'zod';

export const createRecordSchema = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']),
  name: z.string().min(1),
  value: z.string().min(1),
  ttl: z.number().min(60).max(86400).default(3600),
  priority: z.number().optional(),
});

export const updateRecordSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  ttl: z.number().min(60).max(86400).optional(),
  priority: z.number().optional(),
});

export const importZoneSchema = z.object({
  bindFormat: z.string().min(1),
});
