import { z } from 'zod';

export const setupTunnelSchema = z.object({
  name: z.string().min(1).max(64),
  apiToken: z.string().min(1),
  accountId: z.string().optional(),
  zoneId: z.string().optional(),  // CF zone ID for DNS operations
});

export const addRouteSchema = z.object({
  tunnelId: z.string(),
  hostname: z.string().min(1),
  service: z.string().min(1),
  noTlsVerify: z.boolean().optional().default(false),  // skip cert verification for self-signed
  domainId: z.string().optional(),
});

export const editRouteSchema = z.object({
  hostname: z.string().min(1).optional(),
  service: z.string().min(1).optional(),
  noTlsVerify: z.boolean().optional(),
});
