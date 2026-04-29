import type { FastifyInstance } from 'fastify';
import { FirewallService } from './firewall.service.js';
import { addFirewallRuleSchema } from './firewall.schema.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export default async function firewallRoutes(fastify: FastifyInstance) {
  const service = new FirewallService();
  fastify.addHook('preHandler', requireAuth);

  // GET /firewall/status
  fastify.get('/firewall/status', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      try {
        return { success: true, data: await service.getStatus() };
      } catch {
        return { success: true, data: { enabled: false, defaultInput: 'deny', defaultOutput: 'allow', defaultForward: 'deny', message: 'UFW is not available' } };
      }
    },
  });

  // POST /firewall/enable
  fastify.post('/firewall/enable', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        return { success: true, data: await service.enable(req.user.id, req.ip) };
      } catch {
        return { success: true, data: { success: false, enabled: false, message: 'UFW is not available' } };
      }
    },
  });

  // POST /firewall/disable
  fastify.post('/firewall/disable', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        return { success: true, data: await service.disable(req.user.id, req.ip) };
      } catch {
        return { success: true, data: { success: false, message: 'UFW is not available' } };
      }
    },
  });

  // GET /firewall/rules
  fastify.get('/firewall/rules', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      try {
        return { success: true, data: await service.listRules() };
      } catch {
        return { success: true, data: [] };
      }
    },
  });

  // POST /firewall/rules
  fastify.post('/firewall/rules', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        const rule = addFirewallRuleSchema.parse(req.body);
        return { success: true, data: await service.addRule(rule, req.user.id, req.ip) };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to add rule' };
      }
    },
  });

  // DELETE /firewall/rules/:number
  fastify.delete('/firewall/rules/:number', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        const { number } = req.params as { number: string };
        return { success: true, data: await service.deleteRule(parseInt(number), req.user.id, req.ip) };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to delete rule' };
      }
    },
  });

  // POST /firewall/preset/:preset
  fastify.post('/firewall/preset/:preset', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        const { preset } = req.params as { preset: string };
        return { success: true, data: await service.applyPreset(preset as any, req.user.id, req.ip) };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to apply preset' };
      }
    },
  });

  // GET /firewall/fail2ban
  fastify.get('/firewall/fail2ban', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      try {
        return { success: true, data: await service.listJails() };
      } catch {
        return { success: true, data: [] };
      }
    },
  });

  // POST /firewall/fail2ban/unban
  fastify.post('/firewall/fail2ban/unban', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        const { jail, ip } = req.body as { jail: string; ip: string };
        return { success: true, data: await service.unbanIp(jail, ip, req.user.id, req.ip) };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to unban IP' };
      }
    },
  });

  // POST /firewall/fail2ban/ban
  fastify.post('/firewall/fail2ban/ban', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        const { jail, ip } = req.body as { jail?: string; ip: string };
        const jailName = jail || 'sshd';
        return { success: true, data: await service.banIp(jailName, ip, req.user.id, req.ip) };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to ban IP' };
      }
    },
  });

  // POST /firewall/reset
  fastify.post('/firewall/reset', {
    preHandler: [requireRole('admin')],
    handler: async () => {
      try {
        return { success: true, data: await service.resetRules() };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to reset firewall rules' };
      }
    },
  });

  // POST /firewall/rules/:number/toggle
  fastify.post('/firewall/rules/:number/toggle', {
    preHandler: [requireRole('admin')],
    handler: async (req) => {
      try {
        const { number } = req.params as { number: string };
        const { enabled } = req.body as { enabled: boolean };
        return { success: true, data: await service.toggleRule(parseInt(number), enabled) };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to toggle rule' };
      }
    },
  });
}
