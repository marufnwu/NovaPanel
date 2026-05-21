import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { monitoringService } from './monitoring.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const alertRuleSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  metric: z.string().min(1),
  condition: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
  threshold: z.number().int(),
  duration: z.number().int().optional().default(60),
  channels: z.array(z.string()).optional().default([]),
  enabled: z.boolean().optional().default(true),
});

export default async function monitoringRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/metrics', async (req) => {
    const { name, from, to, limit } = req.query as { name?: string; from?: string; to?: string; limit?: string };
    const metrics = await monitoringService.getMetrics({
      name,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    return { success: true, data: metrics };
  });

  fastify.post('/metrics', async (req, reply) => {
    const { name, value, labels } = z.object({
      name: z.string().min(1),
      value: z.number(),
      labels: z.record(z.string()).optional(),
    }).parse(req.body);
    await monitoringService.recordMetric(name, value, labels);
    return reply.status(201).send({ success: true });
  });

  fastify.get('/organizations/:orgId/alert-rules', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const rules = await monitoringService.listAlertRules(orgId);
    return { success: true, data: rules };
  });

  fastify.post('/organizations/:orgId/alert-rules', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const data = alertRuleSchema.parse(req.body);
    const rule = await monitoringService.createAlertRule({ orgId, ...data });
    return reply.status(201).send({ success: true, data: rule });
  });

  fastify.put('/alert-rules/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = alertRuleSchema.partial().parse(req.body);
    const rule = await monitoringService.updateAlertRule(id, data);
    return { success: true, data: rule };
  });

  fastify.delete('/alert-rules/:id', async (req) => {
    const { id } = req.params as { id: string };
    await monitoringService.deleteAlertRule(id);
    return { success: true };
  });

  fastify.get('/alert-rules/:id/history', async (req) => {
    const { id } = req.params as { id: string };
    const history = await monitoringService.getAlertHistory(id);
    return { success: true, data: history };
  });

  fastify.get('/organizations/:orgId/alert-history', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { limit } = req.query as { limit?: string };
    const history = await monitoringService.listAlertHistory(orgId, limit ? parseInt(limit) : 100);
    return { success: true, data: history };
  });

  fastify.post('/collect-metrics', async (req, reply) => {
    await monitoringService.collectSystemMetrics();
    return reply.status(202).send({ success: true });
  });

  fastify.post('/evaluate-alerts', async (req, reply) => {
    await monitoringService.evaluateAlertRules();
    return reply.status(202).send({ success: true });
  });
}