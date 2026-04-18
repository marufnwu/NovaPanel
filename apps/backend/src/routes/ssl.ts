import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../services/crypto.service.js';
import * as cf from '../services/cloudflare.service.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function sslRoutes(app: FastifyInstance) {
  // ─── Get SSL status for a site ───
  app.get('/api/v1/sites/:id/ssl', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    // Find zone for this domain
    const domainParts = site.domain.split('.');
    const zoneName = domainParts.slice(-2).join('.');
    const zone = await prisma.cfZone.findFirst({ where: { zoneName } });

    if (!zone) return { ok: true, data: { sslMode: null, provider: null } };

    const cfAccount = await prisma.cfAccount.findFirst({ where: { id: zone.cfAccountId } });
    if (!cfAccount) return { ok: true, data: { sslMode: zone.sslMode, provider: 'cloudflare' } };

    try {
      const apiToken = decrypt(cfAccount.apiTokenEncrypted);
      const cfZone = await cf.getZone(zone.zoneId, { apiToken });
      return {
        ok: true,
        data: {
          sslMode: cfZone.ssl,
          provider: 'cloudflare',
          zoneStatus: cfZone.status,
        },
      };
    } catch {
      return { ok: true, data: { sslMode: zone.sslMode, provider: 'cloudflare' } };
    }
  });

  // ─── Set SSL mode for a site's zone ───
  app.put('/api/v1/sites/:id/ssl', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { sslMode } = request.body as { sslMode: string };

    const validModes = ['off', 'flexible', 'full', 'strict', 'full_strict'];
    if (!validModes.includes(sslMode)) {
      return reply.code(400).send({ ok: false, error: `Invalid SSL mode. Use: ${validModes.join(', ')}` });
    }

    const site = await prisma.site.findFirst({ where: { id, teamId: user.teamId, deletedAt: null } });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    const domainParts = site.domain.split('.');
    const zoneName = domainParts.slice(-2).join('.');
    const zone = await prisma.cfZone.findFirst({ where: { zoneName } });
    if (!zone) return reply.code(400).send({ ok: false, error: 'No Cloudflare zone found for this domain' });

    const cfAccount = await prisma.cfAccount.findFirst({ where: { id: zone.cfAccountId } });
    if (!cfAccount) return reply.code(400).send({ ok: false, error: 'CF account not found' });

    const apiToken = decrypt(cfAccount.apiTokenEncrypted);
    await cf.setZoneSslMode(zone.zoneId, sslMode, { apiToken });

    await prisma.cfZone.update({ where: { id: zone.id }, data: { sslMode } });

    return { ok: true, data: { sslMode } };
  });

  // ─── Install Certbot SSL (for VPS with public IP, no tunnel) ───
  app.post('/api/v1/sites/:id/ssl/certbot', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    }) as any;
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);

      // Install certbot
      await exec(site.serverId, 'sudo apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true');

      // Obtain certificate
      const email = user.email;
      await exec(site.serverId, [
        `sudo certbot --nginx -d ${site.domain}`,
        `--non-interactive --agree-tos --email ${email}`,
        '--redirect',
      ].join(' '));

      return { ok: true, data: { provider: 'letsencrypt', domain: site.domain } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Certbot failed' });
    }
  });
}

// ─── CF Security Settings Routes ───

export async function securityRoutes(app: FastifyInstance) {
  // Get security settings for a zone
  app.get('/api/v1/domains/:zoneId/security', async (request, reply) => {
    const user = getUser(request);
    const { zoneId } = request.params as { zoneId: string };

    const zone = await prisma.cfZone.findFirst({
      where: { id: zoneId },
      include: { cfAccount: true },
    });
    if (!zone || zone.cfAccount.teamId !== user.teamId) {
      return reply.code(404).send({ ok: false, error: 'Zone not found' });
    }

    const apiToken = decrypt(zone.cfAccount.apiTokenEncrypted);

    try {
      const [sslMode, waf, botFight, browserCheck] = await Promise.all([
        cf.setZoneSslMode(zone.zoneId, '', { apiToken }).catch(() => null),
        getZoneSetting(zone.zoneId, 'waf', apiToken),
        getZoneSetting(zone.zoneId, 'botManagement', apiToken),
        getZoneSetting(zone.zoneId, 'browser IntegrityCheck', apiToken),
      ]);

      return {
        ok: true,
        data: {
          sslMode: zone.sslMode,
          waf: waf,
          botFightMode: botFight,
          browserIntegrityCheck: browserCheck,
        },
      };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to fetch settings' });
    }
  });

  // Update security settings
  app.put('/api/v1/domains/:zoneId/security', async (request, reply) => {
    const user = getUser(request);
    const { zoneId } = request.params as { zoneId: string };
    const body = request.body as {
      sslMode?: string;
      waf?: string;
      botFightMode?: boolean;
      browserIntegrityCheck?: boolean;
    };

    const zone = await prisma.cfZone.findFirst({
      where: { id: zoneId },
      include: { cfAccount: true },
    });
    if (!zone || zone.cfAccount.teamId !== user.teamId) {
      return reply.code(404).send({ ok: false, error: 'Zone not found' });
    }

    const apiToken = decrypt(zone.cfAccount.apiTokenEncrypted);

    if (body.sslMode) {
      await cf.setZoneSslMode(zone.zoneId, body.sslMode, { apiToken });
      await prisma.cfZone.update({ where: { id: zone.id }, data: { sslMode: body.sslMode } });
    }

    return { ok: true };
  });
}

async function getZoneSetting(zoneId: string, name: string, apiToken: string): Promise<any> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/${name}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const body = await res.json() as any;
    return body.result?.value ?? null;
  } catch {
    return null;
  }
}
