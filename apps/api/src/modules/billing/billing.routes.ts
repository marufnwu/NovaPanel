import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { billingService } from './billing.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createInvoiceSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().optional(),
  lineItems: z.array(z.any()).optional(),
});

export default async function billingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/organizations/:orgId/usage', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { from, to } = req.query as { from?: string; to?: string };
    const records = await billingService.listUsageRecords(
      orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined
    );
    return { success: true, data: records };
  });

  fastify.get('/organizations/:orgId/usage/summary', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const summary = await billingService.getCurrentUsage(orgId);
    return { success: true, data: summary };
  });

  fastify.post('/organizations/:orgId/usage', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const { resourceType, quantity, unit, resourceId } = z.object({
      resourceType: z.enum(['cpu', 'memory', 'storage', 'bandwidth', 'requests']),
      quantity: z.number(),
      unit: z.string(),
      resourceId: z.string().optional(),
    }).parse(req.body);
    const record = await billingService.recordUsage(orgId, resourceType, quantity, unit, resourceId);
    return reply.status(201).send({ success: true, data: record });
  });

  fastify.get('/organizations/:orgId/invoices', async (req) => {
    const { orgId } = req.params as { orgId: string };
    const invoices = await billingService.listInvoices(orgId);
    return { success: true, data: invoices };
  });

  fastify.post('/organizations/:orgId/invoices', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const data = createInvoiceSchema.parse(req.body);
    const invoice = await billingService.createInvoice(orgId, data.amount, data.currency, data.lineItems);
    return reply.status(201).send({ success: true, data: invoice });
  });

  fastify.put('/invoices/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status } = z.object({
      status: z.enum(['draft', 'open', 'paid', 'overdue', 'cancelled']),
    }).parse(req.body);
    const invoice = await billingService.updateInvoiceStatus(id, status);
    return { success: true, data: invoice };
  });

  fastify.get('/plans', async () => {
    const plans = await billingService.listPlans();
    return { success: true, data: plans };
  });

  fastify.get('/plans/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const plan = await billingService.getPlan(slug);
    if (!plan) return { success: false, error: 'Plan not found' };
    return { success: true, data: plan };
  });

  fastify.post('/plans', async (req, reply) => {
    const data = z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      price: z.number().int(),
      currency: z.string().optional(),
      interval: z.enum(['monthly', 'yearly']).optional(),
      quotas: z.record(z.unknown()),
      features: z.array(z.string()),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const plan = await billingService.createPlan(data);
    return reply.status(201).send({ success: true, data: plan });
  });

  fastify.put('/plans/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = z.object({
      name: z.string().min(1).optional(),
      price: z.number().int().optional(),
      quotas: z.record(z.unknown()).optional(),
      features: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const plan = await billingService.updatePlan(id, data);
    return { success: true, data: plan };
  });

  fastify.delete('/plans/:id', async (req) => {
    const { id } = req.params as { id: string };
    await billingService.deletePlan(id);
    return { success: true };
  });
}