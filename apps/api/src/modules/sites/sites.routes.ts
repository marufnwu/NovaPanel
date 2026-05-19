import type { FastifyInstance } from 'fastify';
import { sitesService } from './sites.service.js';
import { createSiteSchema, updateSiteSchema, attachDomainToSiteSchema, detachDomainFromSiteSchema } from './sites.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function siteRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/sites — List all sites
  fastify.get('/', async () => {
    const items = await sitesService.list();
    return { success: true, data: items };
  });

  // POST /api/v1/sites — Create site
  fastify.post('/', async (req, reply) => {
    const data = createSiteSchema.parse(req.body);
    const site = await sitesService.create({
      ...data,
      userId: req.user.id,
      ipAddress: req.ip,
    });
    return reply.status(201).send({ success: true, data: site });
  });

  // GET /api/v1/sites/:id — Get site with details
  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.get(id);
    if (!site) {
      return { success: false, error: 'Site not found' };
    }
    return { success: true, data: site };
  });

  // PUT /api/v1/sites/:id — Update site
  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateSiteSchema.parse(req.body);
    const site = await sitesService.update(id, data, req.user.id, req.ip);
    return { success: true, data: site };
  });

  // DELETE /api/v1/sites/:id — Delete site
  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.delete(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // POST /api/v1/sites/:id/suspend — Suspend site
  fastify.post('/:id/suspend', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.suspend(id, req.user.id, req.ip);
    return { success: true, data: site };
  });

  // POST /api/v1/sites/:id/activate — Activate site
  fastify.post('/:id/activate', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.activate(id, req.user.id, req.ip);
    return { success: true, data: site };
  });

  // POST /api/v1/sites/:id/domains/attach — Attach domain to site
  fastify.post('/:id/domains/attach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = attachDomainToSiteSchema.parse(req.body);
    await sitesService.attachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /api/v1/sites/:id/domains/detach — Detach domain from site
  fastify.post('/:id/domains/detach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = detachDomainFromSiteSchema.parse(req.body);
    await sitesService.detachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: null };
  });
}
