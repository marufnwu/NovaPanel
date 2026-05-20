import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/api/v1/health', async () => ({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  }));

  // Phase 3: Auth
  await fastify.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/v1/auth' });

  // Phase 5: Stats
  await fastify.register(import('./modules/stats/stats.routes.js'), { prefix: '/api/v1/stats' });

  // Phase 6: Domains
  await fastify.register(import('./modules/domains/domains.routes.js'), { prefix: '/api/v1/domains' });

  // Sites (v4 architecture - replaces websites)
  await fastify.register(import('./modules/sites/sites.routes.js'), { prefix: '/api/v1/sites' });

  // Phase 7: Web Server + PHP (routes define their own /webserver/... and /php/... paths)
  await fastify.register(import('./modules/webserver/webserver.routes.js'), { prefix: '/api/v1' });
  await fastify.register(import('./modules/php/php.routes.js'), { prefix: '/api/v1' });

  // Phase 8: SSL (routes define their own /domains/:id/... and /ssl paths)
  await fastify.register(import('./modules/ssl/ssl.routes.js'), { prefix: '/api/v1' });

  // Phase 9: DNS (routes define their own /domains/:id/dns paths)
  await fastify.register(import('./modules/dns/dns.routes.js'), { prefix: '/api/v1' });

  // Phase 10: Mail (routes define their own /domains/:id/mail/... paths)
  await fastify.register(import('./modules/mail/mail.routes.js'), { prefix: '/api/v1' });

  // Phase 11: Databases
  await fastify.register(import('./modules/databases/databases.routes.js'), { prefix: '/api/v1/databases' });

  // Phase 12: FTP
  await fastify.register(import('./modules/ftp/ftp.routes.js'), { prefix: '/api/v1' });

  // Phase 13: Cloudflare Tunnel
  await fastify.register(import('./modules/tunnel/tunnel.routes.js'), { prefix: '/api/v1' });
  const { registerTunnelLogsWs } = await import('./modules/tunnel/tunnel.ws.js');
  await registerTunnelLogsWs(fastify);

  // Phase 14: File Manager
  await fastify.register(import('./modules/files/files.routes.js'), { prefix: '/api/v1' });

  // Phase 15: Terminal + Logs
  const { registerTerminalWs } = await import('./modules/terminal/terminal.ws.js');
  await registerTerminalWs(fastify);
  // Logs module
  await fastify.register(import('./modules/logs/logs.routes.js'), { prefix: '/api/v1' });

  // Background Jobs WebSocket
  const { registerJobsWs } = await import('./modules/jobs/jobs.ws.js');
  await registerJobsWs(fastify);

  // Phase 16: Cron + Firewall
  await fastify.register(import('./modules/cron/cron.routes.js'), { prefix: '/api/v1' });
  await fastify.register(import('./modules/firewall/firewall.routes.js'), { prefix: '/api/v1' });

  // Phase 17: Backup
  await fastify.register(import('./modules/backup/backup.routes.js'), { prefix: '/api/v1' });

  // Phase 18: Audit
  await fastify.register(import('./modules/audit/audit.routes.js'), { prefix: '/api/v1' });

  // Settings
  await fastify.register(import('./modules/settings/settings.routes.js'), { prefix: '/api/v1' });
  await fastify.register(import('./modules/settings/server-context.js'), { prefix: '/api/v1' });

  // Notifications
  await fastify.register(import('./modules/notifications/notifications.routes.js'), { prefix: '/api/v1' });

  // Application Installer
  await fastify.register(import('./modules/installer/installer.routes.js'), { prefix: '/api/v1' });

  // API Token Management
  await fastify.register(import('./modules/tokens/tokens.routes.js'), { prefix: '/api/v1' });

  // Cloudflare Full Integration
  await fastify.register(import('./modules/cloudflare/cloudflare.routes.js'), { prefix: '/api/v1' });
}