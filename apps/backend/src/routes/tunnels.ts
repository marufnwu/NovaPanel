import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../services/crypto.service.js';
import * as cf from '../services/cloudflare.service.js';
import {
  detectCloudflared,
  installCloudflared,
  writeTunnelCredentials,
  writeTunnelConfig,
  installTunnelService,
  restartCloudflared,
  stopCloudflared,
  getCloudflaredStatus,
  uninstallCloudflared,
} from '../services/cloudflared.service.js';
import { decryptAndConnect, isConnected } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

async function getServerForTeam(serverId: string, teamId: string) {
  return prisma.server.findFirst({
    where: { id: serverId, teamId, deletedAt: null },
    include: { sshKey: true },
  });
}

// ─── Cloudflare Account Routes ───

export async function cfAccountRoutes(app: FastifyInstance) {
  // List CF accounts
  app.get('/api/v1/cf-accounts', async (request) => {
    const user = getUser(request);
    const accounts = await prisma.cfAccount.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true, email: true, accountId: true, createdAt: true },
    });
    return { ok: true, data: accounts };
  });

  // Connect CF account
  app.post('/api/v1/cf-accounts', async (request, reply) => {
    const user = getUser(request);
    const schema = z.object({
      name: z.string().min(1),
      apiToken: z.string().min(1),
      email: z.string().optional(),
      accountId: z.string().optional(),
    });

    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    // Verify the token works
    let detectedAccountId: string | undefined = body.data.accountId;
    try {
      const tokenInfo = await cf.verifyToken({ apiToken: body.data.apiToken });
      if (!detectedAccountId && (tokenInfo as any).account_id) {
        detectedAccountId = (tokenInfo as any).account_id;
      }
    } catch (err) {
      return reply.code(400).send({ ok: false, error: `Token verification failed: ${err instanceof Error ? err.message : 'Invalid token'}` });
    }

    // Fetch zones to confirm access
    try {
      await cf.listZones({ apiToken: body.data.apiToken });
    } catch (err) {
      return reply.code(400).send({ ok: false, error: `Failed to fetch zones: ${err instanceof Error ? err.message : 'Check permissions'}` });
    }

    const account = await prisma.cfAccount.create({
      data: {
        name: body.data.name,
        apiTokenEncrypted: encrypt(body.data.apiToken),
        email: body.data.email ?? null,
        accountId: detectedAccountId ?? null,
        teamId: user.teamId,
      },
      select: { id: true, name: true, email: true, accountId: true, createdAt: true },
    });

    return reply.code(201).send({ ok: true, data: account });
  });

  // Delete CF account
  app.delete('/api/v1/cf-accounts/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const account = await prisma.cfAccount.findFirst({ where: { id, teamId: user.teamId } });
    if (!account) return reply.code(404).send({ ok: false, error: 'Account not found' });

    // Check for active tunnels using this account
    const zones = await prisma.cfZone.findMany({ where: { cfAccountId: id } });
    if (zones.length > 0) {
      return reply.code(409).send({ ok: false, error: 'Account has zones synced. Remove zones first.' });
    }

    await prisma.cfAccount.delete({ where: { id } });
    return { ok: true };
  });

  // Sync zones from CF
  app.post('/api/v1/cf-accounts/:id/sync-zones', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const account = await prisma.cfAccount.findFirst({ where: { id, teamId: user.teamId } });
    if (!account) return reply.code(404).send({ ok: false, error: 'Account not found' });

    const apiToken = decrypt(account.apiTokenEncrypted);
    const zones = await cf.listZones({ apiToken });

    // Upsert zones
    for (const zone of zones) {
      await prisma.cfZone.upsert({
        where: {
          id: `${account.id}_${zone.id}`,
        },
        update: {
          zoneName: zone.name,
          sslMode: zone.ssl,
          plan: zone.plan?.name,
          syncedAt: new Date(),
        },
        create: {
          id: `${account.id}_${zone.id}`,
          cfAccountId: account.id,
          zoneId: zone.id,
          zoneName: zone.name,
          sslMode: zone.ssl,
          plan: zone.plan?.name,
          syncedAt: new Date(),
        },
      });
    }

    const syncedZones = await prisma.cfZone.findMany({
      where: { cfAccountId: account.id },
    });

    return { ok: true, data: syncedZones };
  });
}

// ─── Tunnel Routes ───

export async function tunnelRoutes(app: FastifyInstance) {
  // Get tunnel for a server
  app.get('/api/v1/servers/:id/tunnel', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await getServerForTeam(id, user.teamId);
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    const tunnel = await prisma.tunnel.findUnique({
      where: { serverId: id },
    });

    if (!tunnel) return { ok: true, data: null };
    return { ok: true, data: tunnel };
  });

  // Create tunnel
  app.post('/api/v1/servers/:id/tunnel', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const schema = z.object({ name: z.string().min(1) });
    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const server = await getServerForTeam(id, user.teamId);
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    // Check for existing tunnel
    const existing = await prisma.tunnel.findUnique({ where: { serverId: id } });
    if (existing) return reply.code(409).send({ ok: false, error: 'Server already has a tunnel' });

    // Need a CF account to create a tunnel
    const cfAccount = await prisma.cfAccount.findFirst({ where: { teamId: user.teamId } });
    if (!cfAccount) return reply.code(400).send({ ok: false, error: 'No Cloudflare account connected. Add one first.' });

    if (!cfAccount.accountId) return reply.code(400).send({ ok: false, error: 'CF account has no account ID. Re-sync the account.' });

    const apiToken = decrypt(cfAccount.apiTokenEncrypted);

    // Create tunnel via CF API
    let tunnelData: cf.CfTunnel;
    try {
      tunnelData = await cf.createTunnel(cfAccount.accountId, body.data.name, { apiToken });
    } catch (err) {
      return reply.code(502).send({ ok: false, error: `CF API error: ${err instanceof Error ? err.message : 'Failed to create tunnel'}` });
    }

    // Save tunnel in DB
    const tunnel = await prisma.tunnel.create({
      data: {
        serverId: id,
        cfTunnelId: tunnelData.id,
        name: body.data.name,
        status: 'installing',
        ingressRoutes: [],
      },
    });

    // Connect to server via SSH and install cloudflared
    try {
      if (!isConnected(id)) {
        await decryptAndConnect(id, server);
      }

      // Install cloudflared
      const installed = await detectCloudflared(id);
      if (!installed) {
        await installCloudflared(id);
      }

      // Write credentials
      const credentialsJson = JSON.stringify({
        AccountTag: cfAccount.accountId,
        TunnelSecret: (tunnelData as any).secret || '',
        TunnelID: tunnelData.id,
        TunnelName: body.data.name,
      });

      const credPath = await writeTunnelCredentials(id, tunnelData.id, credentialsJson);

      // Write initial config (catch-all only)
      await writeTunnelConfig(id, {
        tunnelId: tunnelData.id,
        credentialsFile: credPath,
        ingress: [],
      });

      // Install as systemd service
      await installTunnelService(id, tunnelData.id);

      await prisma.tunnel.update({
        where: { id: tunnel.id },
        data: {
          status: 'connected',
          credentialsPath: credPath,
          installedAt: new Date(),
        },
      });
    } catch (err) {
      await prisma.tunnel.update({
        where: { id: tunnel.id },
        data: { status: 'disconnected' },
      });
      return reply.code(502).send({
        ok: false,
        error: `Tunnel created on CF but installation failed: ${err instanceof Error ? err.message : 'SSH error'}`,
        data: tunnel,
      });
    }

    const result = await prisma.tunnel.findUnique({ where: { id: tunnel.id } });
    return reply.code(201).send({ ok: true, data: result });
  });

  // Update tunnel routes
  app.put('/api/v1/servers/:id/tunnel/routes', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const schema = z.object({
      routes: z.array(z.object({
        hostname: z.string(),
        service: z.string(),
      })),
    });

    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const tunnel = await prisma.tunnel.findUnique({ where: { serverId: id } });
    if (!tunnel) return reply.code(404).send({ ok: false, error: 'No tunnel on this server' });

    const server = await getServerForTeam(id, user.teamId);
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    // Update config on server
    try {
      if (!isConnected(id)) {
        await decryptAndConnect(id, server);
      }

      await writeTunnelConfig(id, {
        tunnelId: tunnel.cfTunnelId,
        credentialsFile: tunnel.credentialsPath || `${`/etc/cloudflared/${tunnel.cfTunnelId}-credentials.json`}`,
        ingress: body.data.routes,
      });

      await restartCloudflared(id);
    } catch (err) {
      return reply.code(502).send({ ok: false, error: `Failed to update config: ${err instanceof Error ? err.message : 'SSH error'}` });
    }

    // Update DB
    const updated = await prisma.tunnel.update({
      where: { id: tunnel.id },
      data: { ingressRoutes: body.data.routes as any },
    });

    return { ok: true, data: updated };
  });

  // Reload tunnel
  app.post('/api/v1/servers/:id/tunnel/reload', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const tunnel = await prisma.tunnel.findUnique({ where: { serverId: id } });
    if (!tunnel) return reply.code(404).send({ ok: false, error: 'No tunnel on this server' });

    const server = await getServerForTeam(id, user.teamId);
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);
      await restartCloudflared(id);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Reload failed' });
    }
  });

  // Delete tunnel
  app.delete('/api/v1/servers/:id/tunnel', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const tunnel = await prisma.tunnel.findUnique({ where: { serverId: id } });
    if (!tunnel) return reply.code(404).send({ ok: false, error: 'No tunnel on this server' });

    const server = await getServerForTeam(id, user.teamId);
    const cfAccount = await prisma.cfAccount.findFirst({ where: { teamId: user.teamId } });

    // Uninstall from server
    if (server) {
      try {
        if (!isConnected(id)) await decryptAndConnect(id, server);
        await uninstallCloudflared(id, tunnel.cfTunnelId);
      } catch {
        // best effort
      }
    }

    // Delete from CF API
    if (cfAccount?.accountId) {
      try {
        const apiToken = decrypt(cfAccount.apiTokenEncrypted);
        await cf.deleteTunnel(cfAccount.accountId, tunnel.cfTunnelId, { apiToken });
      } catch {
        // best effort
      }
    }

    // Delete DNS records managed by panel for this tunnel
    await prisma.dnsRecord.deleteMany({
      where: { managedByPanel: true, name: { contains: tunnel.cfTunnelId } },
    });

    await prisma.tunnel.delete({ where: { id: tunnel.id } });
    return { ok: true };
  });
}
