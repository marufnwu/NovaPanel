import { z } from 'zod';

export const setupTunnelSchema = z.object({
  name: z.string().min(1).max(64),
  apiToken: z.string().min(1),
  accountId: z.string().optional(),
});

export const addRouteSchema = z.object({
  tunnelId: z.string(),
  hostname: z.string().min(1),
  service: z.string().min(1),
  domainId: z.string().optional(),
});
