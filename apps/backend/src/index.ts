import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { auditMiddleware } from './middleware/audit.middleware.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { serverRoutes } from './routes/servers.js';
import { sshKeyRoutes } from './routes/ssh-keys.js';
import { metricsRoutes } from './routes/metrics.js';
import { fileRoutes } from './routes/files.js';
import { cfAccountRoutes, tunnelRoutes } from './routes/tunnels.js';
import { domainRoutes } from './routes/domains.js';
import { siteRoutes } from './routes/sites.js';
import { sslRoutes, securityRoutes } from './routes/ssl.js';
import { monitoringRoutes } from './routes/monitoring.js';
import { auditRoutes } from './routes/audit.js';
import { settingsRoutes } from './routes/settings.js';
import { firewallRoutes } from './routes/firewall.js';
import { cronRoutes } from './routes/cron.js';
import { startMetricsJob } from './jobs/metrics.job.js';
import { startMonitoringJob } from './jobs/monitoring.job.js';
import { setupTerminalWSS } from './services/terminal.service.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.FRONTEND_URL,
  credentials: true,
});

await app.register(cookie);

await app.register(jwt, {
  secret: config.JWT_SECRET,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes',
});

await app.register(authMiddleware);
await app.register(auditMiddleware);

// Routes
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(serverRoutes);
await app.register(sshKeyRoutes);
await app.register(metricsRoutes);
await app.register(fileRoutes);
await app.register(cfAccountRoutes);
await app.register(tunnelRoutes);
await app.register(domainRoutes);
await app.register(siteRoutes);
await app.register(sslRoutes);
await app.register(securityRoutes);
await app.register(monitoringRoutes);
await app.register(auditRoutes);
await app.register(settingsRoutes);
await app.register(firewallRoutes);
await app.register(cronRoutes);

try {
  await app.listen({ port: config.BACKEND_PORT, host: '0.0.0.0' });
  app.log.info(`NovaDash backend running on port ${config.BACKEND_PORT}`);

  const httpServer = app.server;
  setupTerminalWSS(httpServer);
  app.log.info('Terminal WebSocket server started');

  await startMetricsJob();
  await startMonitoringJob();
  app.log.info('Metrics + Monitoring jobs started');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
