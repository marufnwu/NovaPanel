import type { FastifyInstance } from 'fastify';
import { sitesService } from './sites.service.js';
import { createSiteSchema, updateSiteSchema, attachDomainToSiteSchema, detachDomainFromSiteSchema, type CreateSiteInput } from './sites.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';

export default async function siteRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const items = await sitesService.list();
    return { success: true, data: items };
  });

  fastify.post('/', async (req, reply) => {
    const data: CreateSiteInput = createSiteSchema.parse(req.body);
    const site = await sitesService.create(data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: site });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.get(id);
    if (!site) {
      return { success: false, error: 'Site not found' };
    }
    return { success: true, data: site };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateSiteSchema.parse(req.body);
    const site = await sitesService.update(id, data, req.user.id, req.ip);
    return { success: true, data: site };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.delete(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/:id/suspend', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.suspend(id, req.user.id, req.ip);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Site not found');
    return { success: true, data: result };
  });

  fastify.post('/:id/activate', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.activate(id, req.user.id, req.ip);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Site not found');
    return { success: true, data: result };
  });

  fastify.post('/:id/domains/attach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = attachDomainToSiteSchema.parse(req.body);
    const result = await sitesService.attachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/:id/domains/detach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = detachDomainFromSiteSchema.parse(req.body);
    const result = await sitesService.detachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: result };
  });
}