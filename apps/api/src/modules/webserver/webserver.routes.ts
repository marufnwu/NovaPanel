import type { FastifyInstance } from 'fastify';
import { WebServerService } from './webserver.service.js';
import { updateWebServerSchema, updateErrorPagesSchema, updateRateLimitSchema } from './webserver.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { nginxService } from '../../services/nginx.service.js';
import { apacheService } from '../../services/apache.service.js';

export default async function webServerRoutes(fastify: FastifyInstance) {
  const service = new WebServerService();
  fastify.addHook('preHandler', requireAuth);

  // GET /webserver/status — Get nginx/apache status
  fastify.get('/webserver/status', async () => {
    const [nginx, apache] = await Promise.all([
      nginxService.status(),
      apacheService.status(),
    ]);
    return {
      success: true,
      data: {
        nginx: { status: nginx.status },
        apache: { status: apache.status },
      },
    };
  });

  // GET /webserver/domains — List all domains for selector
  fastify.get('/webserver/domains', async () => {
    const domains = await service.listDomains();
    return { success: true, data: domains };
  });

  // GET /webserver/vhost/:domain — Get vhost config by domain name
  fastify.get('/webserver/vhost/:domain', async (req) => {
    const { domain } = req.params as { domain: string };
    const data = await service.getConfigByName(domain);
    return { success: true, data };
  });

  // PUT /webserver/vhost/:domain — Update vhost config by domain name
  fastify.put('/webserver/vhost/:domain', async (req) => {
    const { domain } = req.params as { domain: string };
    const data = updateWebServerSchema.parse(req.body);
    const result = await service.updateConfigByName(domain, req.user.id, data);
    return { success: true, data: result };
  });

  // GET /webserver/preview/:domainId — Preview rendered config
  fastify.get('/webserver/preview/:domainId', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const preview = await service.previewConfig(domainId);
    return { success: true, data: preview };
  });

  // POST /webserver/test-config/:serverType — Test config
  fastify.post('/webserver/test-config/:serverType', async (req) => {
    const { serverType } = req.params as { serverType: string };
    if (serverType === 'nginx') {
      const result = await nginxService.testConfig();
      return { success: true, data: result };
    } else if (serverType === 'apache') {
      const result = await apacheService.testConfig();
      return { success: true, data: result };
    }
    return { success: true, data: { valid: false, output: 'Unknown server type' } };
  });

  // POST /webserver/reload/:serverType — Reload server
  fastify.post('/webserver/reload/:serverType', async (req, reply) => {
    const { serverType } = req.params as { serverType: string };
    try {
      if (serverType === 'nginx') {
        await nginxService.reload();
      } else if (serverType === 'apache') {
        await apacheService.reload();
      }
      return { success: true, data: null };
    } catch (error: any) {
      return reply.status(200).send({
        success: false,
        data: { success: false, message: `Web server (${serverType}) is not running or not available` },
      });
    }
  });

  // GET /webserver/vhost/:domain/error-pages — Get custom error pages
  fastify.get('/webserver/vhost/:domain/error-pages', async (req) => {
    const { domain } = req.params as { domain: string };
    try {
      const pages = await service.getErrorPages(domain);
      return { success: true, data: pages };
    } catch (error: any) {
      return { success: true, data: [] };
    }
  });

  // PUT /webserver/vhost/:domain/error-pages — Update custom error pages
  fastify.put('/webserver/vhost/:domain/error-pages', async (req, reply) => {
    const { domain } = req.params as { domain: string };
    try {
      const parsed = updateErrorPagesSchema.parse(req.body);
      const result = await service.updateErrorPages(domain, parsed.errorPages, req.user.id);
      return { success: true, data: result };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Invalid error pages data', details: error.errors });
      }
      return { success: false, error: error.message };
    }
  });

  // GET /webserver/vhost/:domain/rate-limit — Get rate limiting config
  fastify.get('/webserver/vhost/:domain/rate-limit', async (req) => {
    const { domain } = req.params as { domain: string };
    try {
      const config = await service.getRateLimitConfig(domain);
      return { success: true, data: config };
    } catch (error: any) {
      return { success: true, data: { enabled: false, requestsPerSecond: 10, burstSize: 20, timeoutSeconds: 60 } };
    }
  });

  // PUT /webserver/vhost/:domain/rate-limit — Update rate limiting config
  fastify.put('/webserver/vhost/:domain/rate-limit', async (req, reply) => {
    const { domain } = req.params as { domain: string };
    try {
      const data = updateRateLimitSchema.parse(req.body);
      const result = await service.updateRateLimitConfig(domain, data, req.user.id);
      return { success: true, data: result };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Invalid rate limit data', details: error.errors });
      }
      return { success: false, error: error.message };
    }
  });
}
