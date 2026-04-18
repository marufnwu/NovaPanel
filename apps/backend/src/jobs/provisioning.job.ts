import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { decrypt, encrypt } from '../services/crypto.service.js';
import { decryptAndConnect, isConnected } from '../services/ssh.service.js';
import { exec } from '../services/ssh.service.js';
import { NodeJsDriver } from '../services/stack/nodejs.driver.js';
import { getDriver } from '../services/stack/stack.interface.js';
import * as cf from '../services/cloudflare.service.js';
import { writeTunnelConfig, restartCloudflared } from '../services/cloudflared.service.js';
import type { ProvisioningContext } from '../services/stack/stack.interface.js';

export const provisioningQueue = new Queue('provisioning', { connection: redis });
export const deployQueue = new Queue('deploy', { connection: redis });

// ─── Provisioning Worker ───

const provisioningWorker = new Worker(
  'provisioning',
  async (job) => {
    const { siteId } = job.data;

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { server: { include: { sshKey: true, tunnel: true } } },
    });

    if (!site) throw new Error('Site not found');

    const server = site.server;
    const logs: Array<{ step: string; message: string }> = [];

    const log = (step: string, message: string) => {
      logs.push({ step, message });
      job.updateProgress({ step, message, logs });
    };

    const ctx: ProvisioningContext = {
      siteId: site.id,
      serverId: server.id,
      domain: site.domain,
      port: site.port || 3000,
      rootPath: site.rootPath || `/var/www/${site.name}`,
      gitUrl: site.gitUrl,
      gitBranch: site.gitBranch,
      envVars: {},
      log,
    };

    // Load env vars
    const envVars = await prisma.siteEnvVar.findMany({
      where: { siteId },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });

    const latestEnvVars: Record<string, string> = {};
    const seen = new Set<string>();
    for (const ev of envVars) {
      if (!seen.has(ev.key)) {
        latestEnvVars[ev.key] = decrypt(ev.valueEncrypted);
        seen.add(ev.key);
      }
    }
    ctx.envVars = latestEnvVars;

    try {
      // Connect to server
      log('connect', `Connecting to ${server.host}...`);
      if (!isConnected(server.id)) {
        await decryptAndConnect(server.id, server);
      }

      const driver = getDriver(site.stackType, site.phpVersion ?? undefined);

      // Step 1: Install
      log('install', 'Installing application...');
      await driver.install(ctx);

      // Update rootPath if it was generated
      await prisma.site.update({
        where: { id: siteId },
        data: { rootPath: ctx.rootPath },
      });

      // Step 2: Configure (Nginx)
      log('configure', 'Configuring reverse proxy...');
      await driver.configure(ctx);

      // Step 3: Start process
      log('start', 'Starting application...');
      await driver.start(ctx);

      // Step 4: Cloudflare tunnel route
      if (server.tunnel) {
        log('cloudflare', 'Adding tunnel route...');
        const tunnel = server.tunnel;
        const routes = (tunnel.ingressRoutes as Array<{ hostname: string; service: string }>) || [];
        const newRoute = { hostname: site.domain, service: `http://localhost:${ctx.port}` };

        routes.push(newRoute);

        // Write updated config
        await writeTunnelConfig(server.id, {
          tunnelId: tunnel.cfTunnelId,
          credentialsFile: tunnel.credentialsPath || `/etc/cloudflared/${tunnel.cfTunnelId}-credentials.json`,
          ingress: routes,
        });
        await restartCloudflared(server.id);

        // Update DB
        await prisma.tunnel.update({
          where: { id: tunnel.id },
          data: { ingressRoutes: routes as any },
        });

        // Create DNS CNAME
        const cfAccount = await prisma.cfAccount.findFirst();
        if (cfAccount?.accountId) {
          const apiToken = decrypt(cfAccount.apiTokenEncrypted);
          const domainParts = site.domain.split('.');
          const zoneName = domainParts.slice(-2).join('.');
          const subdomain = domainParts.slice(0, -2).join('.');

          const zones = await cf.listZones({ apiToken });
          const zone = zones.find((z) => z.name === zoneName);

          if (zone) {
            try {
              await cf.createDnsRecord(zone.id, {
                type: 'CNAME',
                name: subdomain || '@',
                content: `${tunnel.cfTunnelId}.cfargotunnel.com`,
                proxied: true,
                ttl: 1,
              }, { apiToken });

              // Set SSL mode
              await cf.setZoneSslMode(zone.id, 'full_strict', { apiToken });
              log('cloudflare', `DNS CNAME created: ${site.domain} → tunnel`);
            } catch (err) {
              log('cloudflare', `DNS creation warning: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        }
      }

      // Step 5: Verification
      log('verify', 'Verifying deployment...');
      try {
        await exec(server.id, `curl -s -o /dev/null -w "%{http_code}" http://localhost:${ctx.port}`);
        log('verify', 'Application responding on local port');
      } catch {
        log('verify', 'Warning: could not verify local response (may need startup time)');
      }

      // Mark as live
      await prisma.site.update({
        where: { id: siteId },
        data: { status: 'live' },
      });

      log('complete', 'Site is live!');

      return { success: true, logs };
    } catch (err) {
      await prisma.site.update({
        where: { id: siteId },
        data: { status: 'error' },
      });

      log('error', err instanceof Error ? err.message : 'Provisioning failed');
      throw err;
    }
  },
  { connection: redis, concurrency: 2 },
);

// ─── Deploy Worker ───

const deployWorker = new Worker(
  'deploy',
  async (job) => {
    const { siteId, userId } = job.data;

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { server: { include: { sshKey: true } } },
    });

    if (!site) throw new Error('Site not found');

    const deploy = await prisma.deploy.create({
      data: {
        siteId,
        triggeredBy: userId,
        status: 'running',
      },
    });

    const logs: string[] = [];
    const log = (step: string, message: string) => {
      logs.push(`[${step}] ${message}`);
    };

    const ctx: ProvisioningContext = {
      siteId: site.id,
      serverId: site.server.id,
      domain: site.domain,
      port: site.port || 3000,
      rootPath: site.rootPath || `/var/www/${site.name}`,
      gitUrl: site.gitUrl,
      gitBranch: site.gitBranch,
      envVars: {},
      log,
    };

    const startedAt = new Date();

    try {
      if (!isConnected(site.server.id)) {
        await decryptAndConnect(site.server.id, site.server);
      }

      const driver = getDriver(site.stackType, site.phpVersion ?? undefined);
      await driver.deploy(ctx);

      await prisma.deploy.update({
        where: { id: deploy.id },
        data: {
          status: 'success',
          logOutput: logs.join('\n'),
          durationMs: Date.now() - startedAt.getTime(),
          finishedAt: new Date(),
        },
      });

      return { success: true };
    } catch (err) {
      await prisma.deploy.update({
        where: { id: deploy.id },
        data: {
          status: 'failed',
          logOutput: logs.join('\n') + `\n[error] ${err instanceof Error ? err.message : 'Deploy failed'}`,
          durationMs: Date.now() - startedAt.getTime(),
          finishedAt: new Date(),
        },
      });

      throw err;
    }
  },
  { connection: redis, concurrency: 3 },
);

// Error handlers
provisioningWorker.on('failed', (job, err) => {
  console.error(`Provisioning job ${job?.id} failed:`, err.message);
});

deployWorker.on('failed', (job, err) => {
  console.error(`Deploy job ${job?.id} failed:`, err.message);
});
