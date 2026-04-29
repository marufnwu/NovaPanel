import type { FastifyInstance } from 'fastify';
import { installerService } from './installer.service.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  installAppSchema,
  uninstallAppSchema,
  updateAppSchema,
  setAppConfigSchema,
  deleteAppConfigSchema,
  checkPathSchema,
} from './installer.schema.js';

export default async function installerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /installer/apps - Get list of available applications
  fastify.get('/installer/apps', async (req) => {
    const apps = await installerService.getAvailableApps();
    return { success: true, data: apps };
  });

  // GET /installer/apps/:id - Get app by ID
  fastify.get('/installer/apps/:id', async (req) => {
    const { id } = req.params as { id: string };
    const app = await installerService.getApp(id);
    return { success: true, data: app };
  });

  // POST /installer/install - Install an application
  fastify.post('/installer/install', async (req) => {
    const body = installAppSchema.parse(req.body);
    const result = await installerService.installApp(body);
    return result;
  });

  // GET /installer/status/:id - Check installation status
  fastify.get('/installer/status/:id', async (req) => {
    const { id } = req.params as { id: string };
    const status = await installerService.getInstallStatus(id);
    return { success: true, data: status };
  });

  // POST /installer/uninstall - Uninstall an application
  fastify.post('/installer/uninstall', async (req) => {
    const { appId } = uninstallAppSchema.parse(req.body);
    const result = await installerService.uninstallApp(appId);
    return result;
  });

  // POST /installer/update - Update an application
  fastify.post('/installer/update', async (req) => {
    const { appId } = updateAppSchema.parse(req.body);
    const result = await installerService.updateApp(appId);
    return result;
  });

  // GET /installer/logs/:id - Get installation logs
  fastify.get('/installer/logs/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { limit } = req.query as { limit?: string };
    const logs = await installerService.getInstallLogs(id, parseInt(limit || '50'));
    return { success: true, data: logs };
  });

  // GET /installer/installed - Get all installed apps
  fastify.get('/installer/installed', async (req) => {
    const apps = await installerService.getInstalledApps();
    return { success: true, data: apps };
  });

  // POST /installer/config - Set app configuration
  fastify.post('/installer/config', async (req) => {
    const { appId, configKey, configValue } = setAppConfigSchema.parse(req.body);
    const result = await installerService.setAppConfig(appId, configKey, configValue);
    return result;
  });

  // GET /installer/config/:id - Get app configuration
  fastify.get('/installer/config/:id', async (req) => {
    const { id } = req.params as { id: string };
    const configs = await installerService.getAppConfig(id);
    return { success: true, data: configs };
  });

  // DELETE /installer/config - Delete app configuration
  fastify.delete('/installer/config', async (req) => {
    const { appId, configKey } = deleteAppConfigSchema.parse(req.body);
    const result = await installerService.deleteAppConfig(appId, configKey);
    return result;
  });

  // POST /installer/config/delete - Delete app configuration (alternative endpoint for frontend compatibility)
  fastify.post('/installer/config/delete', async (req) => {
    const { appId, configKey } = deleteAppConfigSchema.parse(req.body);
    const result = await installerService.deleteAppConfig(appId, configKey);
    return result;
  });

  // POST /installer/check-path - Check if installation path exists and is empty
  fastify.post('/installer/check-path', async (req) => {
    const { path: installPath } = checkPathSchema.parse(req.body);
    try {
      const { run: runCmd } = await import('../../services/executor.js');
      try {
        await runCmd('test', ['-d', installPath], { sudo: true });
        // Directory exists, check if empty
        const result = await runCmd('ls', ['-A', installPath], { sudo: true });
        const files = result.stdout.trim().split('\n').filter(Boolean);
        return { success: true, data: { exists: true, isEmpty: files.length === 0, files } };
      } catch {
        return { success: true, data: { exists: false, isEmpty: true, files: [] } };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to check path' };
    }
  });
}
