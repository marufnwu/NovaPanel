import type { FastifyInstance } from 'fastify';
import { PhpService } from './php.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { z } from 'zod';

const setVersionSchema = z.object({
  phpVersion: z.string().regex(/^\d+\.\d+$/, 'Invalid PHP version format'),
});

const updateIniSchema = z.object({
  content: z.string().max(10000),
});

const poolSettingsSchema = z.object({
  pm: z.enum(['dynamic', 'static', 'ondemand']).optional(),
  maxChildren: z.number().min(1).max(500).optional(),
  startServers: z.number().min(1).max(200).optional(),
  minSpareServers: z.number().min(1).max(200).optional(),
  maxSpareServers: z.number().min(1).max(200).optional(),
  requestTerminateTimeout: z.number().min(0).max(3600).optional(),
});

const limitsSchema = z.object({
  memoryLimit: z.string().optional(),
  maxExecutionTime: z.number().min(0).max(7200).optional(),
  maxInputTime: z.number().min(0).max(7200).optional(),
  uploadMaxFilesize: z.string().optional(),
  postMaxSize: z.string().optional(),
  maxFileUploads: z.number().min(1).max(1000).optional(),
});

const securitySchema = z.object({
  openBasedir: z.boolean().optional(),
  disabledFunctions: z.array(z.string()).optional(),
});

export default async function phpRoutes(fastify: FastifyInstance) {
  const service = new PhpService();
  fastify.addHook('preHandler', requireAuth);

  // GET /php/versions — List installed PHP versions
  fastify.get('/php/versions', async () => {
    return { success: true, data: await service.listVersions() };
  });

  // GET /php/domains — List domains for selector
  fastify.get('/php/domains', async () => {
    const domains = await service.listDomains();
    return { success: true, data: domains };
  });

  // GET /php/config/:domainName — Get full PHP config for a domain
  fastify.get('/php/config/:domainName', async (req) => {
    const { domainName } = req.params as { domainName: string };
    return { success: true, data: await service.getConfigByName(domainName) };
  });

  // PUT /php/version/:id — Set PHP version for a domain
  fastify.put('/php/version/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { phpVersion } = setVersionSchema.parse(req.body);
    return { success: true, data: await service.setVersion(id, phpVersion, req.user.id) };
  });

  // PUT /php/pool/:id — Update FPM pool settings
  fastify.put('/php/pool/:id', async (req) => {
    const { id } = req.params as { id: string };
    const settings = poolSettingsSchema.parse(req.body);
    return { success: true, data: await service.updatePoolSettings(id, settings, req.user.id) };
  });

  // PUT /php/limits/:id — Update PHP limits
  fastify.put('/php/limits/:id', async (req) => {
    const { id } = req.params as { id: string };
    const limits = limitsSchema.parse(req.body);
    return { success: true, data: await service.updateLimits(id, limits, req.user.id) };
  });

  // PUT /php/security/:id — Update security settings
  fastify.put('/php/security/:id', async (req) => {
    const { id } = req.params as { id: string };
    const security = securitySchema.parse(req.body);
    return { success: true, data: await service.updateSecurity(id, security, req.user.id) };
  });

  // GET /domains/:id/php/ini — Get custom ini
  fastify.get('/domains/:id/php/ini', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getIni(id) };
  });

  // PUT /domains/:id/php/ini — Update custom ini
  fastify.put('/domains/:id/php/ini', async (req) => {
    const { id } = req.params as { id: string };
    const { content } = updateIniSchema.parse(req.body);
    return { success: true, data: await service.updateIni(id, content) };
  });

  // POST /domains/:id/php/restart-fpm — Restart PHP-FPM for domain
  fastify.post('/domains/:id/php/restart-fpm', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.restartFpm(id, req.user.id) };
  });

  // GET /php/:id/fpm-status — Get PHP-FPM pool status
  fastify.get('/php/:id/fpm-status', async (req) => {
    const { id } = req.params as { id: string };
    try {
      const status = await service.getFpmStatus(id);
      return { success: true, data: status };
    } catch (error: any) {
      return { success: true, data: {
        pool: 'unknown',
        processManager: 'dynamic',
        startTime: new Date().toISOString(),
        startSince: 0,
        acceptedConn: 0,
        listenQueue: 0,
        maxListenQueue: 0,
        listenQueueLen: 0,
        idleProcesses: 0,
        activeProcesses: 0,
        totalProcesses: 0,
        maxActiveProcesses: 0,
        maxChildrenReached: 0,
        slowRequests: 0,
      }};
    }
  });

  // GET /php/:id/info — Get PHP info
  fastify.get('/php/:id/info', async (req) => {
    const { id } = req.params as { id: string };
    try {
      const info = await service.getPhpInfo(id);
      return { success: true, data: info };
    } catch (error: any) {
      return { success: true, data: { html: '<p>PHP info not available</p>' } };
    }
  });

  // POST /php/install/:version — Install PHP version
  fastify.post('/php/install/:version', async (req) => {
    const { version } = req.params as { version: string };
    try {
      const result = await service.installPhp(version, req.user.id);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
