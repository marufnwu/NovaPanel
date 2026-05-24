import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PhpService } from './php.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const updatePoolSettingsSchema = z.object({
  pm: z.enum(['static', 'dynamic', 'ondemand']).optional(),
  maxChildren: z.number().int().optional(),
  startServers: z.number().int().optional(),
  minSpareServers: z.number().int().optional(),
  maxSpareServers: z.number().int().optional(),
  requestTerminateTimeout: z.number().int().optional(),
});

const updateLimitsSchema = z.object({
  memoryLimit: z.string().optional(),
  maxExecutionTime: z.number().int().optional(),
  maxInputTime: z.number().int().optional(),
  uploadMaxFilesize: z.string().optional(),
  postMaxSize: z.string().optional(),
  maxFileUploads: z.number().int().optional(),
});

const updateSecuritySchema = z.object({
  openBasedir: z.boolean().optional(),
  disabledFunctions: z.array(z.string()).optional(),
});

const updateIniSchema = z.object({
  content: z.string(),
});

export default async function phpRoutes(fastify: FastifyInstance) {
  const service = new PhpService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/php/versions', async () => {
    return { success: true, data: await service.listVersions() };
  });

  fastify.get('/php/domains', async () => {
    return { success: true, data: await service.listDomainsWithPhpVersion() };
  });

  fastify.get('/php/config/:domainName', async (req) => {
    const { domainName } = req.params as { domainName: string };
    const settings = await service.getSettings(domainName);
    const poolConfig = await service.getPoolConfig('', domainName);
    const uploadLimits = await service.getUploadLimits('');
    const opcodeCache = await service.getOpcodeCacheSettings('');
    return {
      success: true,
      data: {
        domainId: domainName,
        domain: domainName,
        phpVersion: '',
        phpHandler: 'fpm',
        customIni: '',
        poolConfig,
        poolSettings: settings,
        limits: uploadLimits,
        security: { openBasedir: false, disabledFunctions: [] },
      },
    };
  });

  fastify.put('/php/version/:domainId', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const { phpVersion } = req.body as { phpVersion: string };
    try {
      await service.setDomainPhpVersion(domainId, phpVersion);
      return { success: true, data: null };
    } catch (err: any) {
      if (err.code === 'NOT_IMPLEMENTED') {
        return reply.status(501).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  fastify.put('/php/pool/:domainId', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const data = updatePoolSettingsSchema.parse(req.body);
    try {
      await service.updatePoolConfig('', domainId, data);
      return { success: true, data: null };
    } catch (err: any) {
      if (err.code === 'NOT_IMPLEMENTED') {
        return reply.status(501).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  fastify.put('/php/limits/:domainId', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const data = updateLimitsSchema.parse(req.body);
    try {
      await service.updateUploadLimits('', data);
      return { success: true, data: null };
    } catch (err: any) {
      if (err.code === 'NOT_IMPLEMENTED') {
        return reply.status(501).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  fastify.put('/php/security/:domainId', async (req, reply) => {
    const { domainId } = req.params as { domainId: string };
    const data = updateSecuritySchema.parse(req.body);
    try {
      if (data.disabledFunctions !== undefined) {
        await service.updateDisabledFunctions('', data.disabledFunctions);
      }
      return { success: true, data: null };
    } catch (err: any) {
      if (err.code === 'NOT_IMPLEMENTED') {
        return reply.status(501).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  fastify.post('/domains/:domainId/php/restart-fpm', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const result = await service.restartFpm('', req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/php/install/:version', async (_req, reply) => {
    return reply.status(501).send({ success: false, error: 'PHP install requires OS-level package manager - use server terminal' });
  });

  fastify.get('/domains/:domainId/php/ini', async (req) => {
    const { domainId } = req.params as { domainId: string };
    return { success: true, data: { domainId, content: '', directives: [] } };
  });

  fastify.put('/domains/:domainId/php/ini', async (req) => {
    const { domainId } = req.params as { domainId: string };
    const { content } = updateIniSchema.parse(req.body);
    return { success: true, data: { domainId, content } };
  });

  fastify.get('/php/:domainId/info', async (req) => {
    const { domainId } = req.params as { domainId: string };
    return { success: true, data: { html: `<pre>PHP ${domainId} info not available</pre>` } };
  });

  fastify.get('/php/:domainId/fpm-status', async (req) => {
    const { domainId } = req.params as { domainId: string };
    return {
      success: true,
      data: {
        pool: domainId,
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
      },
    };
  });
}