import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { installerService } from './installer.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const installSchema = z.object({
  appId: z.string().min(1),
  domain: z.string().min(1),
  path: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(1),
  databaseOption: z.enum(['auto', 'existing']).optional(),
  databaseId: z.string().optional(),
});

const setConfigSchema = z.object({
  appId: z.string().min(1),
  configKey: z.string().min(1),
  configValue: z.string(),
});

const deleteConfigSchema = z.object({
  appId: z.string().min(1),
  configKey: z.string().min(1),
});

const checkPathSchema = z.object({
  path: z.string().min(1),
});

export default async function installerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/installer/apps', async () => {
    return { success: true, data: await installerService.getAvailableApps() };
  });

  fastify.get('/installer/apps/:id', async (req) => {
    const { id } = req.params as { id: string };
    const app = await installerService.getApp(id);
    return { success: true, data: app };
  });

  fastify.post('/installer/install', async (req, reply) => {
    const data = installSchema.parse(req.body);
    const result = await installerService.installApp(
      data.appId,
      '',
      '',
      data.path,
      data.adminEmail,
      data.adminPassword
    );
    return reply.status(201).send({ success: true, data: result });
  });

  fastify.get('/installer/status/:appId', async (req) => {
    const { appId } = req.params as { appId: string };
    return { success: true, data: { status: 'ready', progress: 100, message: 'Complete' } };
  });

  fastify.post('/installer/uninstall', async (req) => {
    const { appId } = req.body as { appId: string };
    const result = await installerService.uninstallApp(appId);
    return { success: true, data: result };
  });

  fastify.post('/installer/update', async (req) => {
    const { appId } = req.body as { appId: string };
    const result = await installerService.updateApp(appId);
    return { success: true, data: result };
  });

  fastify.get('/installer/logs/:appId', async (req) => {
    const { appId } = req.params as { appId: string };
    const limit = parseInt((req.query as { limit?: string }).limit || '50');
    const logs = await installerService.getInstallLogs(appId, limit);
    return { success: true, data: logs };
  });

  fastify.get('/installer/installed', async (req) => {
    const siteId = (req.query as { siteId?: string }).siteId;
    const apps = await installerService.getInstalledApps(siteId);
    return { success: true, data: apps };
  });

  fastify.get('/installer/config/:appId', async (req) => {
    const { appId } = req.params as { appId: string };
    const configs = await installerService.getAppConfigs(appId);
    return { success: true, data: configs };
  });

  fastify.post('/installer/config', async (req) => {
    const data = setConfigSchema.parse(req.body);
    const result = await installerService.setAppConfig(data.appId, data.configKey, data.configValue);
    return { success: true, data: result };
  });

  fastify.post('/installer/config/delete', async (req) => {
    const data = deleteConfigSchema.parse(req.body);
    const result = await installerService.deleteAppConfig(data.appId, data.configKey);
    return { success: true, data: result };
  });

  fastify.post('/installer/check-path', async (req) => {
    const { path } = checkPathSchema.parse(req.body);
    const result = await installerService.checkPath(path);
    return { success: true, data: result };
  });
}