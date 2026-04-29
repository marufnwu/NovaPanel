import type { FastifyInstance, FastifyReply } from 'fastify';
import { DnsService } from './dns.service.js';
import { createRecordSchema, updateRecordSchema, importZoneSchema } from './dns.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function dnsRoutes(fastify: FastifyInstance) {
  const service = new DnsService();
  fastify.addHook('preHandler', requireAuth);

  // GET /domains/:id/dns — Get zone and records
  fastify.get('/domains/:id/dns', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getZone(id) };
  });

  // POST /domains/:id/dns/records — Create a DNS record
  fastify.post('/domains/:id/dns/records', async (req, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = createRecordSchema.parse(req.body);
    const record = await service.createRecord(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: record });
  });

  // PUT /domains/:id/dns/records/:recId — Update a DNS record
  fastify.put('/domains/:id/dns/records/:recId', async (req) => {
    const { recId } = req.params as { recId: string };
    const data = updateRecordSchema.parse(req.body);
    return { success: true, data: await service.updateRecord(recId, data, req.user.id, req.ip) };
  });

  // DELETE /domains/:id/dns/records/:recId — Delete a DNS record
  fastify.delete('/domains/:id/dns/records/:recId', async (req) => {
    const { recId } = req.params as { recId: string };
    await service.deleteRecord(recId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /domains/:id/dns/import — Import BIND format zone
  fastify.post('/domains/:id/dns/import', async (req) => {
    const { id } = req.params as { id: string };
    const { bindFormat } = importZoneSchema.parse(req.body);
    return { success: true, data: await service.importZone(id, bindFormat, req.user.id, req.ip) };
  });

  // GET /domains/:id/dns/export — Export zone as BIND format
  fastify.get('/domains/:id/dns/export', async (req) => {
    const { id } = req.params as { id: string };
    const zoneText = await service.exportZone(id);
    return { success: true, data: { content: zoneText } };
  });

  // POST /domains/:id/dns/reset-to-defaults — Reset DNS to defaults
  fastify.post('/domains/:id/dns/reset-to-defaults', async (req) => {
    const { id } = req.params as { id: string };
    await service.resetToDefaults(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /domains/:id/dns/raw — View raw zone file
  fastify.get('/domains/:id/dns/raw', async (req) => {
    const { id } = req.params as { id: string };
    const content = await service.getRawZone(id);
    return { success: true, data: { content } };
  });

  // GET /domains/:id/dns/propagation — Check DNS propagation
  fastify.get('/domains/:id/dns/propagation', async (req) => {
    const { id } = req.params as { id: string };
    const results = await service.checkPropagation(id);
    return { success: true, data: results };
  });

  // PUT /domains/:id/dns/soa — Update SOA record
  fastify.put('/domains/:id/dns/soa', async (req) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    try {
      return { success: true, data: await service.updateSoa(id, data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // GET /domains/:id/dns/cloudflare — Get Cloudflare DNS config
  fastify.get('/domains/:id/dns/cloudflare', async (req) => {
    const { id } = req.params as { id: string };
    try {
      const config = await service.getCloudflareConfig(id);
      return { success: true, data: config };
    } catch (error: any) {
      return { success: true, data: { enabled: false, apiToken: '', zoneId: '', zoneName: '', lastSyncAt: null } };
    }
  });

  // PUT /domains/:id/dns/cloudflare — Update Cloudflare DNS config
  fastify.put('/domains/:id/dns/cloudflare', async (req) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    try {
      const config = await service.updateCloudflareConfig(id, data);
      return { success: true, data: config };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // POST /domains/:id/dns/cloudflare/sync — Sync DNS records with Cloudflare
  fastify.post('/domains/:id/dns/cloudflare/sync', async (req) => {
    const { id } = req.params as { id: string };
    try {
      const result = await service.syncCloudflareRecords(id);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
