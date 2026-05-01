import type { FastifyInstance } from 'fastify';
import { SslService } from './ssl.service.js';
import { issueLetsEncryptSchema, uploadCustomSchema, generateSelfSignedSchema, toggleAutoRenewSchema, updateHstsSchema, updateOcspStaplingSchema } from './ssl.schema.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';

export default async function sslRoutes(fastify: FastifyInstance) {
  const service = new SslService();
  fastify.addHook('preHandler', requireAuth);

  // GET /api/v1/ssl/domains/:id/ssl — Get SSL info for a domain
  fastify.get('/domains/:id/ssl', async (req) => {
    const { id } = req.params as { id: string };
    try {
      return { success: true, data: await service.getCertificate(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to get SSL certificate');
      return { success: true, data: { enabled: false, certificate: null, error: 'Unable to retrieve certificate info' } };
    }
  });

  // POST /api/v1/ssl/domains/:id/letsencrypt — Issue Let's Encrypt cert
  fastify.post('/domains/:id/letsencrypt', async (req) => {
    const { id } = req.params as { id: string };
    const { email, challengeType } = issueLetsEncryptSchema.parse(req.body);
    try {
      return { success: true, data: await service.issueLetsEncrypt(id, email, req.user.id, req.ip, challengeType) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to issue Let\'s Encrypt certificate');
      throw new AppError(500, 'SSL_ERROR', `Failed to issue Let's Encrypt certificate: ${(error as Error).message}`);
    }
  });

  // POST /api/v1/ssl/domains/:id/custom — Upload custom cert
  fastify.post('/domains/:id/custom', async (req) => {
    const { id } = req.params as { id: string };
    const { certificate, privateKey, chain } = uploadCustomSchema.parse(req.body);
    try {
      return { success: true, data: await service.uploadCustom(id, certificate, privateKey, chain, req.user.id, req.ip) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to upload custom certificate');
      throw new AppError(500, 'SSL_ERROR', `Failed to upload custom certificate: ${(error as Error).message}`);
    }
  });

  // POST /api/v1/ssl/domains/:id/self-signed — Generate self-signed cert
  fastify.post('/domains/:id/self-signed', async (req) => {
    const { id } = req.params as { id: string };
    const { days } = generateSelfSignedSchema.parse(req.body);
    try {
      return { success: true, data: await service.generateSelfSigned(id, days, req.user.id, req.ip) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to generate self-signed certificate');
      throw new AppError(500, 'SSL_ERROR', `Failed to generate self-signed certificate: ${(error as Error).message}`);
    }
  });

  // DELETE /ssl/domains/:id — Remove SSL from domain
  fastify.delete('/ssl/domains/:id', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { id } = req.params as { id: string };
      try {
        await service.removeCertificate(id, req.user.id, req.ip);
        return { success: true, data: null };
      } catch (error) {
        if (error instanceof AppError) throw error;
        req.log.error(error, 'Failed to remove SSL certificate');
        throw new AppError(500, 'SSL_ERROR', `Failed to remove certificate: ${(error as Error).message}`);
      }
    },
  });

  // POST /api/v1/ssl/domains/:id/renew — Renew certificate
  fastify.post('/domains/:id/renew', async (req) => {
    const { id } = req.params as { id: string };
    try {
      return { success: true, data: await service.renewCertificate(id, req.user.id, req.ip) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to renew certificate');
      throw new AppError(500, 'SSL_ERROR', `Failed to renew certificate: ${(error as Error).message}`);
    }
  });

  // GET /ssl — List all certificates
  fastify.get('/ssl', async (req) => {
    try {
      return { success: true, data: await service.listAll() };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to list SSL certificates');
      return { success: true, data: [] };
    }
  });

  // GET /ssl/expiring — List expiring certificates (admin)
  fastify.get('/ssl/expiring', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { days } = req.query as { days?: string };
      try {
        return { success: true, data: await service.listExpiring(parseInt(days || '30')) };
      } catch (error) {
        if (error instanceof AppError) throw error;
        req.log.error(error, 'Failed to list expiring certificates');
        return { success: true, data: [] };
      }
    },
  });

  // GET /ssl/domains/:id/details — Get detailed certificate info
  fastify.get('/ssl/domains/:id/details', async (req) => {
    const { id } = req.params as { id: string };
    try {
      return { success: true, data: await service.getCertDetails(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to get certificate details');
      return { success: true, data: { enabled: false, certificate: null, error: 'Unable to retrieve certificate details' } };
    }
  });

  // PUT /ssl/domains/:id/auto-renew — Toggle auto-renew
  fastify.put('/ssl/domains/:id/auto-renew', async (req) => {
    const { id } = req.params as { id: string };
    const { autoRenew } = toggleAutoRenewSchema.parse(req.body);
    try {
      return { success: true, data: await service.toggleAutoRenew(id, autoRenew, req.user.id, req.ip) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to toggle auto-renew');
      throw new AppError(500, 'SSL_ERROR', `Failed to toggle auto-renew: ${(error as Error).message}`);
    }
  });

  // GET /ssl/domains/:id/download/:file — Download cert/key/chain
  fastify.get('/ssl/domains/:id/download/:file', async (req) => {
    const { id, file } = req.params as { id: string; file: string };
    if (!['cert', 'key', 'chain'].includes(file)) {
      return { success: false, error: 'Invalid file type' };
    }
    try {
      const content = await service.downloadCert(id, file as 'cert' | 'key' | 'chain');
      return { success: true, data: content };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to download certificate file');
      throw new AppError(500, 'SSL_ERROR', `Failed to download certificate file: ${(error as Error).message}`);
    }
  });

  // POST /ssl/domains/:id/validate-chain — Validate certificate chain
  fastify.post('/ssl/domains/:id/validate-chain', async (req) => {
    const { id } = req.params as { id: string };
    try {
      return { success: true, data: await service.validateChain(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to validate certificate chain');
      throw new AppError(500, 'SSL_ERROR', `Failed to validate chain: ${(error as Error).message}`);
    }
  });

  // POST /ssl/domains/:id/mixed-content — Check for mixed content
  fastify.post('/ssl/domains/:id/mixed-content', async (req) => {
    const { id } = req.params as { id: string };
    try {
      return { success: true, data: await service.checkMixedContent(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to check mixed content');
      throw new AppError(500, 'SSL_ERROR', `Failed to check mixed content: ${(error as Error).message}`);
    }
  });

  // PUT /ssl/domains/:id/hsts — Update HSTS settings
  fastify.put('/ssl/domains/:id/hsts', async (req) => {
    const { id } = req.params as { id: string };
    const { enabled, maxAge, includeSubdomains } = updateHstsSchema.parse(req.body);
    try {
      return { success: true, data: await service.updateHsts(id, enabled, maxAge, includeSubdomains) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to update HSTS settings');
      throw new AppError(500, 'SSL_ERROR', `Failed to update HSTS: ${(error as Error).message}`);
    }
  });

  // PUT /ssl/domains/:id/ocsp-stapling — Update OCSP stapling
  fastify.put('/ssl/domains/:id/ocsp-stapling', async (req) => {
    const { id } = req.params as { id: string };
    const { enabled } = updateOcspStaplingSchema.parse(req.body);
    try {
      return { success: true, data: await service.updateOcspStapling(id, enabled) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      req.log.error(error, 'Failed to update OCSP stapling');
      throw new AppError(500, 'SSL_ERROR', `Failed to update OCSP stapling: ${(error as Error).message}`);
    }
  });
}
