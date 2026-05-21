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

  fastify.get('/projects/:projectId/waf-rules', async (req) => {
    const { projectId } = req.params as { projectId: string };
    const rules = await securityService.listWafRules(projectId);
    return { success: true, data: rules };
  });

  fastify.post('/projects/:projectId/waf-rules', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const data = wafRuleSchema.parse(req.body);
    const rule = await securityService.createWafRule(projectId, data);
    return reply.status(201).send({ success: true, data: rule });
  });

  fastify.put('/waf-rules/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = wafRuleSchema.partial().parse(req.body);
    const rule = await securityService.updateWafRule(id, data);
    return { success: true, data: rule };
  });

  fastify.delete('/waf-rules/:id', async (req) => {
    const { id } = req.params as { id: string };
    await securityService.deleteWafRule(id);
    return { success: true };
  });

  fastify.get('/projects/:projectId/ip-allowlists', async (req) => {
    const { projectId } = req.params as { projectId: string };
    const allowlists = await securityService.listIpAllowlists(projectId);
    return { success: true, data: allowlists };
  });

  fastify.post('/projects/:projectId/ip-allowlists', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const data = ipAllowlistSchema.parse(req.body);
    const allowlist = await securityService.createIpAllowlist(projectId, data);
    return reply.status(201).send({ success: true, data: allowlist });
  });

  fastify.put('/ip-allowlists/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = ipAllowlistSchema.partial().parse(req.body);
    const allowlist = await securityService.updateIpAllowlist(id, data);
    return { success: true, data: allowlist };
  });

  fastify.delete('/ip-allowlists/:id', async (req) => {
    const { id } = req.params as { id: string };
    await securityService.deleteIpAllowlist(id);
    return { success: true };
  });
}