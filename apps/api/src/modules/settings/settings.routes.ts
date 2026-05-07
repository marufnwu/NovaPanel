import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { settingsService } from './settings.service.js';
import {
  updateIdentitySchema,
  updateTimezoneSchema,
  updateBackupSettingsSchema,
  updateSshPortSchema,
  updatePanelSettingsSchema,
  updateNameserversSchema,
  updateSessionSchema,
  updatePasswordPolicySchema,
  updateSshSettingsSchema,
  updatePanelPortSchema,
  updateDefaultWebserverSchema,
  updateSslEmailSchema,
  updateMaintenanceSchema,
  importConfigSchema,
  updateDataRetentionSchema,
} from './settings.schema.js';

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /settings/identity
  fastify.get('/settings/identity', async () => {
    return { success: true, data: await settingsService.getServerIdentity() };
  });

  // PUT /settings/identity
  fastify.put('/settings/identity', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updateIdentitySchema.parse(req.body);
      return { success: true, data: await settingsService.updateServerIdentity(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/timezone
  fastify.get('/settings/timezone', async () => {
    return { success: true, data: await settingsService.getTimezone() };
  });

  // PUT /settings/timezone
  fastify.put('/settings/timezone', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { timezone } = updateTimezoneSchema.parse(req.body);
      return { success: true, data: await settingsService.setTimezone(timezone, req.user.id, req.ip) };
    },
  });

  // GET /settings/timezones
  fastify.get('/settings/timezones', async () => {
    return { success: true, data: await settingsService.getAvailableTimezones() };
  });

  // GET /settings/backup
  fastify.get('/settings/backup', async () => {
    return { success: true, data: await settingsService.getBackupSettings() };
  });

  // PUT /settings/backup
  fastify.put('/settings/backup', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updateBackupSettingsSchema.parse(req.body);
      return { success: true, data: await settingsService.updateBackupSettings(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/security
  fastify.get('/settings/security', async () => {
    return { success: true, data: await settingsService.getSecuritySettings() };
  });

  // PUT /settings/security/ssh-port
  fastify.put('/settings/security/ssh-port', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { port } = updateSshPortSchema.parse(req.body);
      return { success: true, data: await settingsService.updateSshPort(port, req.user.id, req.ip) };
    },
  });

  // GET /settings/updates
  fastify.get('/settings/updates', async () => {
    return { success: true, data: await settingsService.getSystemUpdates() };
  });

  // POST /settings/updates/check
  fastify.post('/settings/updates/check', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      return { success: true, data: await settingsService.checkForUpdates() };
    },
  });

  // GET /settings/panel
  fastify.get('/settings/panel', async () => {
    return { success: true, data: await settingsService.getPanelSettings() };
  });

  // PUT /settings/panel
  fastify.put('/settings/panel', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updatePanelSettingsSchema.parse(req.body);
      return { success: true, data: await settingsService.updatePanelSettings(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/nameservers
  fastify.get('/settings/nameservers', async () => {
    return { success: true, data: await settingsService.getNameserverSettings() };
  });

  // PUT /settings/nameservers
  fastify.put('/settings/nameservers', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updateNameserversSchema.parse(req.body);
      return { success: true, data: await settingsService.updateNameserverSettings(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/session
  fastify.get('/settings/session', async () => {
    return { success: true, data: await settingsService.getSessionSettings() };
  });

  // PUT /settings/session
  fastify.put('/settings/session', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updateSessionSchema.parse(req.body);
      return { success: true, data: await settingsService.updateSessionSettings(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/password-policy
  fastify.get('/settings/password-policy', async () => {
    return { success: true, data: await settingsService.getPasswordPolicy() };
  });

  // PUT /settings/password-policy
  fastify.put('/settings/password-policy', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updatePasswordPolicySchema.parse(req.body);
      return { success: true, data: await settingsService.updatePasswordPolicy(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/system-info
  fastify.get('/settings/system-info', async () => {
    return { success: true, data: await settingsService.getSystemInfo() };
  });

  // GET /settings/ssh
  fastify.get('/settings/ssh', async () => {
    return { success: true, data: await settingsService.getSshSettings() };
  });

  // PUT /settings/ssh
  fastify.put('/settings/ssh', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updateSshSettingsSchema.parse(req.body);
      return { success: true, data: await settingsService.updateSshSettings(data, req.user.id, req.ip) };
    },
  });

  // GET /settings/panel-port
  fastify.get('/settings/panel-port', async () => {
    return { success: true, data: await settingsService.getPanelPort() };
  });

  // PUT /settings/panel-port
  fastify.put('/settings/panel-port', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { port } = updatePanelPortSchema.parse(req.body);
      return { success: true, data: await settingsService.updatePanelPort(port) };
    },
  });

  // GET /settings/default-webserver
  fastify.get('/settings/default-webserver', async () => {
    return { success: true, data: await settingsService.getDefaultWebServer() };
  });

  // PUT /settings/default-webserver
  fastify.put('/settings/default-webserver', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { mode } = updateDefaultWebserverSchema.parse(req.body);
      return { success: true, data: await settingsService.updateDefaultWebServer(mode) };
    },
  });

  // GET /settings/ssl-email
  fastify.get('/settings/ssl-email', async () => {
    return { success: true, data: await settingsService.getSslEmail() };
  });

  // GET /settings/cloudflare
  fastify.get('/settings/cloudflare', async () => {
    return { success: true, data: await settingsService.getCloudflareConfig() };
  });

  // PUT /settings/cloudflare
  fastify.put('/settings/cloudflare', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = req.body as { apiToken: string; accountId: string };
      return { success: true, data: await settingsService.setCloudflareConfig(data, req.user.id, req.ip) };
    },
  });

  // PUT /settings/ssl-email
  fastify.put('/settings/ssl-email', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { email } = updateSslEmailSchema.parse(req.body);
      return { success: true, data: await settingsService.updateSslEmail(email) };
    },
  });

  // POST /settings/reboot
  fastify.post('/settings/reboot', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      return { success: true, data: await settingsService.rebootServer() };
    },
  });

  // POST /settings/shutdown
  fastify.post('/settings/shutdown', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      return { success: true, data: await settingsService.shutdownServer() };
    },
  });

  // GET /settings/maintenance
  fastify.get('/settings/maintenance', async () => {
    return { success: true, data: await settingsService.getMaintenanceMode() };
  });

  // PUT /settings/maintenance
  fastify.put('/settings/maintenance', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const { enabled } = updateMaintenanceSchema.parse(req.body);
      return { success: true, data: await settingsService.updateMaintenanceMode(enabled, req.user.id, req.ip) };
    },
  });

  // GET /settings/export
  fastify.get('/settings/export', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      return { success: true, data: await settingsService.exportConfig() };
    },
  });

  // POST /settings/import
  fastify.post('/settings/import', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const config = importConfigSchema.parse(req.body);
      return { success: true, data: await settingsService.importConfig(config) };
    },
  });

  // GET /settings/data-retention
  fastify.get('/settings/data-retention', async () => {
    return { success: true, data: await settingsService.getDataRetention() };
  });

  // PUT /settings/data-retention
  fastify.put('/settings/data-retention', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      const data = updateDataRetentionSchema.parse(req.body);
      return { success: true, data: await settingsService.updateDataRetention(data, req.user.id, req.ip) };
    },
  });
}
