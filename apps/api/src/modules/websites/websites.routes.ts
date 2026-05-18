import type { FastifyInstance } from 'fastify';
import { WebsitesService } from './websites.service.js';
import { createWebsiteSchema, updateWebsiteSchema, attachDomainSchema, detachDomainSchema } from './websites.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { FtpService } from '../ftp/ftp.service.js';
import { CronService } from '../cron/cron.service.js';
import { BackupService } from '../backup/backup.service.js';
import { DatabasesService } from '../databases/databases.service.js';
import { InstallerService } from '../installer/installer.service.js';

export default async function websiteRoutes(fastify: FastifyInstance) {
  const service = new WebsitesService();
  const ftpService = new FtpService();
  const cronService = new CronService();
  const backupService = new BackupService();
  const databasesService = new DatabasesService();
  const installerService = new InstallerService();

  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/websites — List all websites
  fastify.get('/', async () => {
    const items = await service.list();
    return { success: true, data: items };
  });

  // POST /api/v1/websites — Create website
  fastify.post('/', async (req, reply) => {
    const data = createWebsiteSchema.parse(req.body);
    const website = await service.create(data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: website });
  });

  // GET /api/v1/websites/:id — Get website with attached domains
  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const website = await service.get(id);
    return { success: true, data: website };
  });

  // PUT /api/v1/websites/:id — Update website
  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateWebsiteSchema.parse(req.body);
    const website = await service.update(id, data, req.user.id, req.ip);
    return { success: true, data: website };
  });

  // DELETE /api/v1/websites/:id — Delete website (with cascade)
  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await service.delete(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // POST /api/v1/websites/:id/suspend — Suspend
  fastify.post('/:id/suspend', async (req) => {
    const { id } = req.params as { id: string };
    const website = await service.suspend(id, req.user.id, req.ip);
    return { success: true, data: website };
  });

  // POST /api/v1/websites/:id/activate — Activate
  fastify.post('/:id/activate', async (req) => {
    const { id } = req.params as { id: string };
    const website = await service.activate(id, req.user.id, req.ip);
    return { success: true, data: website };
  });

  // POST /api/v1/websites/:id/domains/attach — Attach domain
  fastify.post('/:id/domains/attach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = attachDomainSchema.parse(req.body);
    const result = await service.attachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // POST /api/v1/websites/:id/domains/detach — Detach domain
  fastify.post('/:id/domains/detach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId, action } = detachDomainSchema.parse(req.body);
    const result = await service.detachDomain(id, domainId, action, undefined, req.user.id, req.ip);
    return { success: true, data: result };
  });

  // ── Website-scoped child-resource endpoints ────────────────────────

  // GET /api/v1/websites/:websiteId/ftp — List FTP accounts for a website
  fastify.get('/:websiteId/ftp', async (req) => {
    const { websiteId } = req.params as { websiteId: string };
    const data = await ftpService.listByWebsite(websiteId);
    return { success: true, data };
  });

  // GET /api/v1/websites/:websiteId/cron — List cron jobs for a website
  fastify.get('/:websiteId/cron', async (req) => {
    const { websiteId } = req.params as { websiteId: string };
    const data = await cronService.listByWebsite(websiteId);
    return { success: true, data };
  });

  // GET /api/v1/websites/:websiteId/backups — List backups for a website
  fastify.get('/:websiteId/backups', async (req) => {
    const { websiteId } = req.params as { websiteId: string };
    const data = await backupService.listByWebsite(websiteId);
    return { success: true, data };
  });

  // GET /api/v1/websites/:websiteId/databases — List databases for a website
  fastify.get('/:websiteId/databases', async (req) => {
    const { websiteId } = req.params as { websiteId: string };
    const data = await databasesService.listByWebsite(websiteId);
    return { success: true, data };
  });

  // GET /api/v1/websites/:websiteId/apps — List installed apps for a website
  fastify.get('/:websiteId/apps', async (req) => {
    const { websiteId } = req.params as { websiteId: string };
    const data = await installerService.listByWebsite(websiteId);
    return { success: true, data };
  });
}
