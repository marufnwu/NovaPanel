import { z } from 'zod';

export const addFirewallRuleSchema = z.object({
  action: z.enum(['allow', 'deny']),
  port: z.string().optional(),
  protocol: z.enum(['tcp', 'udp']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
