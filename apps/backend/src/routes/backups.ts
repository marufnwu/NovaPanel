import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function backupRoutes(app: FastifyInstance) {
  // ─── Create site backup ───
  app.post('/api/v1/sites/:id/backup', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);

      const rootPath = site.rootPath || `/var/www/${site.name}`;
      const backupDir = `${rootPath}/.novadash/backups`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${site.name}-${timestamp}.tar.gz`;

      await exec(site.serverId, `sudo mkdir -p ${backupDir}`);
      await exec(site.serverId, `sudo tar -czf ${backupDir}/${backupName} -C ${rootPath} --exclude='.novadash/backups' --exclude='node_modules' --exclude='.git' . 2>/dev/null`);

      const sizeRaw = await exec(site.serverId, `sudo stat -c %s ${backupDir}/${backupName} 2>/dev/null || echo "0"`);

      return {
        ok: true,
        data: {
          name: backupName,
          path: `${backupDir}/${backupName}`,
          size: parseInt(sizeRaw),
          createdAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Backup failed' });
    }
  });

  // ─── List backups ───
  app.get('/api/v1/sites/:id/backups', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);

      const rootPath = site.rootPath || `/var/www/${site.name}`;
      const backupDir = `${rootPath}/.novadash/backups`;

      const listing = await exec(site.serverId, `ls -la ${backupDir}/*.tar.gz 2>/dev/null || echo ""`);

      const backups = listing.split('\n').filter((l) => l.includes('.tar.gz')).map((line) => {
        const parts = line.split(/\s+/);
        const name = parts[parts.length - 1];
        const size = parseInt(parts[4]) || 0;
        return { name: name.split('/').pop(), path: name, size };
      });

      return { ok: true, data: backups };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to list backups' });
    }
  });

  // ─── Restore backup ───
  app.post('/api/v1/sites/:id/backups/restore', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { backupPath } = request.body as { backupPath: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);

      const rootPath = site.rootPath || `/var/www/${site.name}`;
      await exec(site.serverId, `sudo tar -xzf ${backupPath} -C ${rootPath}`);

      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Restore failed' });
    }
  });

  // ─── Delete backup ───
  app.post('/api/v1/sites/:id/backups/delete', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { backupPath } = request.body as { backupPath: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);
      await exec(site.serverId, `sudo rm -f ${backupPath}`);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Delete failed' });
    }
  });
}
