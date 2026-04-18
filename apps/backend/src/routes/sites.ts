import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../services/crypto.service.js';
import { provisioningQueue, deployQueue } from '../jobs/provisioning.job.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import { getDriver } from '../services/stack/stack.interface.js';
import type { UserPayload, StackType } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  serverId: z.string().min(1),
  stackType: z.enum(['nodejs', 'laravel', 'python', 'static', 'docker']),
  domain: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  gitUrl: z.string().url().optional().nullable(),
  gitBranch: z.string().optional(),
  envVars: z.record(z.string()).optional(),
});

const updateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  gitBranch: z.string().optional(),
});

export async function siteRoutes(app: FastifyInstance) {
  // ─── List Sites ───
  app.get('/api/v1/sites', async (request) => {
    const user = getUser(request);
    const sites = await prisma.site.findMany({
      where: { teamId: user.teamId, deletedAt: null },
      select: {
        id: true,
        serverId: true,
        name: true,
        domain: true,
        subdomain: true,
        stackType: true,
        rootPath: true,
        port: true,
        status: true,
        gitUrl: true,
        gitBranch: true,
        createdAt: true,
        server: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { ok: true, data: sites };
  });

  // ─── Create Site (triggers provisioning) ───
  app.post('/api/v1/sites', async (request, reply) => {
    const user = getUser(request);
    const body = createSiteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const { name, serverId, stackType, domain, port, gitUrl, gitBranch, envVars } = body.data;

    // Verify server belongs to team
    const server = await prisma.server.findFirst({
      where: { id: serverId, teamId: user.teamId, deletedAt: null },
    });
    if (!server) {
      return reply.code(404).send({ ok: false, error: 'Server not found' });
    }

    // Check domain uniqueness
    const existing = await prisma.site.findFirst({
      where: { domain, deletedAt: null },
    });
    if (existing) {
      return reply.code(409).send({ ok: false, error: 'Domain already in use' });
    }

    const autoPort = port || 3000;

    const site = await prisma.site.create({
      data: {
        name,
        serverId,
        domain,
        stackType: stackType as StackType,
        port: autoPort,
        gitUrl: gitUrl ?? null,
        gitBranch: gitBranch ?? null,
        rootPath: `/var/www/${name.toLowerCase().replace(/\s+/g, '-')}`,
        status: 'provisioning',
        teamId: user.teamId,
      },
    });

    // Store env vars encrypted
    if (envVars && Object.keys(envVars).length > 0) {
      for (const [key, value] of Object.entries(envVars)) {
        await prisma.siteEnvVar.create({
          data: {
            siteId: site.id,
            key,
            valueEncrypted: encrypt(value),
            version: 1,
            createdBy: user.sub,
          },
        });
      }
    }

    // Queue provisioning job
    await provisioningQueue.add('provision', { siteId: site.id });

    return reply.code(201).send({ ok: true, data: site });
  });

  // ─── Get Site ───
  app.get('/api/v1/sites/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: {
        server: { select: { id: true, name: true, host: true, status: true } },
        deploys: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });

    if (!site) {
      return reply.code(404).send({ ok: false, error: 'Site not found' });
    }

    return { ok: true, data: site };
  });

  // ─── Update Site ───
  app.put('/api/v1/sites/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = updateSiteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const site = await prisma.site.findFirst({ where: { id, teamId: user.teamId, deletedAt: null } });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    const updated = await prisma.site.update({
      where: { id },
      data: body.data,
    });

    return { ok: true, data: updated };
  });

  // ─── Delete Site (soft) ───
  app.delete('/api/v1/sites/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    // Uninstall from server
    try {
      if (!isConnected(site.serverId)) {
        await decryptAndConnect(site.serverId, site.server);
      }
      const driver = getDriver(site.stackType);
      await driver.uninstall({
        siteId: site.id,
        serverId: site.serverId,
        domain: site.domain,
        port: site.port || 3000,
        rootPath: site.rootPath || '',
        gitUrl: site.gitUrl,
        gitBranch: site.gitBranch,
        envVars: {},
        log: () => {},
      });
    } catch {
      // best effort uninstall
    }

    await prisma.site.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'stopped' },
    });

    return { ok: true };
  });

  // ─── Deploy ───
  app.post('/api/v1/sites/:id/deploy', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({ where: { id, teamId: user.teamId, deletedAt: null } });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    const job = await deployQueue.add('deploy', { siteId: id, userId: user.sub });

    return { ok: true, data: { jobId: job.id } };
  });

  // ─── Restart ───
  app.post('/api/v1/sites/:id/restart', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);
      const driver = getDriver(site.stackType);
      await driver.restart({
        siteId: site.id, serverId: site.serverId, domain: site.domain,
        port: site.port || 3000, rootPath: site.rootPath || '',
        gitUrl: site.gitUrl, gitBranch: site.gitBranch, envVars: {}, log: () => {},
      });
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Restart failed' });
    }
  });

  // ─── Stop ───
  app.post('/api/v1/sites/:id/stop', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);
      const driver = getDriver(site.stackType);
      await driver.stop({
        siteId: site.id, serverId: site.serverId, domain: site.domain,
        port: site.port || 3000, rootPath: site.rootPath || '',
        gitUrl: site.gitUrl, gitBranch: site.gitBranch, envVars: {}, log: () => {},
      });
      await prisma.site.update({ where: { id }, data: { status: 'stopped' } });
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Stop failed' });
    }
  });

  // ─── Get Deploy History ───
  app.get('/api/v1/sites/:id/deploys', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({ where: { id, teamId: user.teamId, deletedAt: null } });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    const deploys = await prisma.deploy.findMany({
      where: { siteId: id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return { ok: true, data: deploys };
  });

  // ─── Get/Set Env Vars ───
  app.get('/api/v1/sites/:id/env', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({ where: { id, teamId: user.teamId, deletedAt: null } });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    const vars = await prisma.siteEnvVar.findMany({
      where: { siteId: id },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });

    // Return only latest version of each key, masked
    const latest: Array<{ key: string; version: number }> = [];
    const seen = new Set<string>();
    for (const v of vars) {
      if (!seen.has(v.key)) {
        latest.push({ key: v.key, version: v.version });
        seen.add(v.key);
      }
    }

    return { ok: true, data: latest };
  });

  app.put('/api/v1/sites/:id/env', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const schema = z.object({ envVars: z.record(z.string()) });
    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const site = await prisma.site.findFirst({ where: { id, teamId: user.teamId, deletedAt: null } });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    for (const [key, value] of Object.entries(body.data.envVars)) {
      // Get latest version
      const latest = await prisma.siteEnvVar.findFirst({
        where: { siteId: id, key },
        orderBy: { version: 'desc' },
      });

      await prisma.siteEnvVar.create({
        data: {
          siteId: id,
          key,
          valueEncrypted: encrypt(value),
          version: (latest?.version ?? 0) + 1,
          createdBy: user.sub,
        },
      });
    }

    return { ok: true };
  });
}

// getDriver is exported from stack.interface.ts
