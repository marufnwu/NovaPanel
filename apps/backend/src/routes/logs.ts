import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function logsRoutes(app: FastifyInstance) {
  // ─── Server logs ───
  app.get('/api/v1/servers/:id/logs', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { type = 'syslog', lines = '100' } = request.query as { type?: string; lines?: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      let command: string;
      switch (type) {
        case 'syslog':
          command = `sudo journalctl -n ${lines} --no-pager`;
          break;
        case 'nginx_access':
          command = `sudo tail -n ${lines} /var/log/nginx/access.log 2>/dev/null || echo "No nginx access log found"`;
          break;
        case 'nginx_error':
          command = `sudo tail -n ${lines} /var/log/nginx/error.log 2>/dev/null || echo "No nginx error log found"`;
          break;
        case 'auth':
          command = `sudo journalctl -u sshd -n ${lines} --no-pager`;
          break;
        case 'kernel':
          command = `sudo dmesg | tail -n ${lines}`;
          break;
        default:
          command = `sudo journalctl -n ${lines} --no-pager`;
      }

      const output = await exec(id, command);
      return { ok: true, data: { logs: output, type } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to fetch logs' });
    }
  });

  // ─── Site logs ───
  app.get('/api/v1/sites/:id/logs', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { type = 'app', lines = '100' } = request.query as { type?: string; lines?: string };

    const site = await prisma.site.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { server: { include: { sshKey: true } } },
    });
    if (!site) return reply.code(404).send({ ok: false, error: 'Site not found' });

    try {
      if (!isConnected(site.serverId)) await decryptAndConnect(site.serverId, site.server);

      const rootPath = site.rootPath || `/var/www/${site.name}`;
      let command: string;

      switch (type) {
        case 'nginx_access':
          command = `sudo tail -n ${lines} /var/log/nginx/${site.domain}.access.log 2>/dev/null || sudo tail -n ${lines} /var/log/nginx/access.log 2>/dev/null || echo "No log found"`;
          break;
        case 'nginx_error':
          command = `sudo tail -n ${lines} /var/log/nginx/${site.domain}.error.log 2>/dev/null || sudo tail -n ${lines} /var/log/nginx/error.log 2>/dev/null || echo "No log found"`;
          break;
        case 'app':
          // Check for common log locations
          command = `if [ -f ${rootPath}/storage/logs/laravel.log ]; then sudo tail -n ${lines} ${rootPath}/storage/logs/laravel.log; elif [ -f ${rootPath}/logs/app.log ]; then sudo tail -n ${lines} ${rootPath}/logs/app.log; elif [ -f ${rootPath}/npm-debug.log ]; then sudo tail -n ${lines} ${rootPath}/npm-debug.log; else sudo journalctl -u "pm2-*" -n ${lines} --no-pager 2>/dev/null || echo "No application logs found"; fi`;
          break;
        case 'deploy':
          command = `if [ -f ${rootPath}/.novadash/deploy.log ]; then sudo tail -n ${lines} ${rootPath}/.novadash/deploy.log; else echo "No deploy logs found"; fi`;
          break;
        default:
          command = `sudo tail -n ${lines} /var/log/nginx/${site.domain}.access.log 2>/dev/null || echo "No log found"`;
      }

      const output = await exec(site.serverId, command);
      return { ok: true, data: { logs: output, type } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to fetch logs' });
    }
  });
}
