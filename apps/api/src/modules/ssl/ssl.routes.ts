import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';
import { sslService } from './ssl.service.js';
import { issueLetsEncryptSchema, uploadCustomSchema, generateSelfSignedSchema, updateHstsSchema, updateOcspStaplingSchema } from './ssl.schema.js';

export default async function sslRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/domains/:id/ssl', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await sslService.getCertificate(id) };
  });

  fastify.post('/domains/:id/letsencrypt', async (req) => {
    const { id } = req.params as { id: string };
    const params = issueLetsEncryptSchema.parse(req.body);
    const result = await sslService.issueLetsEncrypt(id, params, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/domains/:id/custom', async (req) => {
    const { id } = req.params as { id: string };
    const { certificate, privateKey, chain } = uploadCustomSchema.parse(req.body);
    const result = await sslService.uploadCustom(id, certificate, privateKey, chain || '', req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/domains/:id/self-signed', async (req) => {
    const { id } = req.params as { id: string };
    const { days } = generateSelfSignedSchema.parse(req.body);
    const result = await sslService.generateSelfSigned(id, days || 365, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.delete('/ssl/domains/:id', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      await sslService.removeCertificate(id, req.user.id, req.ip);
      return { success: true, data: null };
    },
  });

  fastify.post('/domains/:id/renew', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sslService.renewCertificate(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/ssl', async () => {
    const result = await sslService.listAll();
    return { success: true, data: result };
  });

  fastify.get('/ssl/expiring', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { days } = req.query as { days?: string };
      const result = await sslService.listExpiring(days ? parseInt(days) : 30);
      return { success: true, data: result };
    },
  });

  fastify.get('/ssl/domains/:id/details', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sslService.getCertDetails(id);
    return { success: true, data: result };
  });

  fastify.put('/ssl/domains/:id/auto-renew', async (req) => {
    const { id } = req.params as { id: string };
    const { autoRenew } = req.body as { autoRenew: boolean };
    await sslService.toggleAutoRenew(id, autoRenew, req.user.id, req.ip);
    return { success: true, data: null };
  });

  fastify.get('/ssl/domains/:id/download/:file', async (req) => {
    const { id, file } = req.params as { id: string; file: string };
    if (!['cert', 'key', 'chain'].includes(file)) throw new AppError(400, 'INVALID_FILE', 'File must be cert, key, or chain');
    const pem = await sslService.downloadCert(id, file as 'cert' | 'key' | 'chain');
    return { success: true, data: { pem } };
  });

  fastify.post('/ssl/domains/:id/validate-chain', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sslService.validateChain(id);
    return { success: true, data: result };
  });

  fastify.post('/ssl/domains/:id/mixed-content', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sslService.checkMixedContent(id);
    return { success: true, data: result };
  });

  fastify.put('/ssl/domains/:id/hsts', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateHstsSchema.parse(req.body);
    await sslService.updateHsts(id, data.enabled, data.maxAge, data.includeSubdomains);
    return { success: true, data: null };
  });

  fastify.put('/ssl/domains/:id/ocsp-stapling', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateOcspStaplingSchema.parse(req.body);
    await sslService.updateOcspStapling(id, data.enabled);
    return { success: true, data: null };
  });
}
