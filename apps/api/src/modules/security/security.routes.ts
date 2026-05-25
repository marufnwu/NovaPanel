import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { securityService } from './security.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const wafRuleSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['owasp', 'custom', 'rate_limit', 'geo_block', 'bot']),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
});

const ipAllowlistSchema = z.object({
  name: z.string().min(1),
  ips: z.array(z.string()),
  type: z.enum(['allow', 'block']),
});

export default async function securityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/waf-rules', async (req) => {
    const orgId = req.orgId;
    const rules = await securityService.listWafRules(orgId!);
    return { success: true, data: rules };
  });

  fastify.post('/waf-rules', async (req, reply) => {
    const orgId = req.orgId;
    const data = wafRuleSchema.parse(req.body);
    const rule = await securityService.createWafRule(orgId!, data);
    return reply.status(201).send({ success: true, data: rule });
  });

  fastify.put('/waf-rules/:id', async (req) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId;
    const data = wafRuleSchema.partial().parse(req.body);
    const rule = await securityService.updateWafRule(id, orgId!, data);
    return { success: true, data: rule };
  });

  fastify.delete('/waf-rules/:id', async (req) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId;
    await securityService.deleteWafRule(id, orgId!);
    return { success: true };
  });

  fastify.get('/ip-allowlists', async (req) => {
    const orgId = req.orgId;
    const allowlists = await securityService.listIpAllowlists(orgId!);
    return { success: true, data: allowlists };
  });

  fastify.post('/ip-allowlists', async (req, reply) => {
    const orgId = req.orgId;
    const data = ipAllowlistSchema.parse(req.body);
    const allowlist = await securityService.createIpAllowlist(orgId!, data);
    return reply.status(201).send({ success: true, data: allowlist });
  });

  fastify.put('/ip-allowlists/:id', async (req) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId;
    const data = ipAllowlistSchema.partial().parse(req.body);
    const allowlist = await securityService.updateIpAllowlist(id, orgId!, data);
    return { success: true, data: allowlist };
  });

  fastify.delete('/ip-allowlists/:id', async (req) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId;
    await securityService.deleteIpAllowlist(id, orgId!);
    return { success: true };
  });
}