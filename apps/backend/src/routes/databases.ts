import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { exec } from '../services/ssh.service.js';
import { isConnected, decryptAndConnect } from '../services/ssh.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

export async function databaseRoutes(app: FastifyInstance) {
  // ─── List databases ───
  app.get('/api/v1/servers/:id/databases', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { engine = 'mysql' } = request.query as { engine?: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      let output: string;
      if (engine === 'mysql') {
        output = await exec(id, `sudo mysql -e "SHOW DATABASES;" -s 2>/dev/null || echo "MySQL not available"`);
      } else {
        output = await exec(id, `sudo -u postgres psql -lqt 2>/dev/null | cut -d '|' -f 1 || echo "PostgreSQL not available"`);
      }

      const databases = output.split('\n').map((l) => l.trim()).filter((l) => l && !['Database', 'information_schema', 'performance_schema', 'mysql', 'sys', 'template0', 'template1'].includes(l));

      return { ok: true, data: { engine, databases } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to list databases' });
    }
  });

  // ─── Create database ───
  app.post('/api/v1/servers/:id/databases', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { name, engine = 'mysql', user: dbUser, password } = request.body as {
      name: string;
      engine?: string;
      user?: string;
      password?: string;
    };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      const dbUserSafe = dbUser || name;
      const dbPass = password || Math.random().toString(36).slice(2, 18);

      if (engine === 'mysql') {
        await exec(id, `sudo mysql -e "CREATE DATABASE IF NOT EXISTS \`${name}\`; CREATE USER IF NOT EXISTS '${dbUserSafe}'@'localhost' IDENTIFIED BY '${dbPass}'; GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${dbUserSafe}'@'localhost'; FLUSH PRIVILEGES;"`);
      } else {
        await exec(id, `sudo -u postgres psql -c "CREATE DATABASE \\"${name}\\";" && sudo -u postgres psql -c "CREATE USER \\"${dbUserSafe}\\" WITH PASSWORD '${dbPass}';" && sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \\"${name}\\" TO \\"${dbUserSafe}\\";"`);
      }

      return { ok: true, data: { name, user: dbUserSafe, password: dbPass, engine } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to create database' });
    }
  });

  // ─── Delete database ───
  app.delete('/api/v1/servers/:id/databases/:name', async (request, reply) => {
    const user = getUser(request);
    const { id, name } = request.params as { id: string; name: string };
    const { engine = 'mysql' } = request.query as { engine?: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      if (engine === 'mysql') {
        await exec(id, `sudo mysql -e "DROP DATABASE IF EXISTS \`${name}\`;"`);
      } else {
        await exec(id, `sudo -u postgres psql -c "DROP DATABASE IF EXISTS \\"${name}\\";"`);
      }

      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Failed to delete database' });
    }
  });

  // ─── Dump database ───
  app.post('/api/v1/servers/:id/databases/:name/dump', async (request, reply) => {
    const user = getUser(request);
    const { id, name } = request.params as { id: string; name: string };
    const { engine = 'mysql' } = request.query as { engine?: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
      include: { sshKey: true },
    });
    if (!server) return reply.code(404).send({ ok: false, error: 'Server not found' });

    try {
      if (!isConnected(id)) await decryptAndConnect(id, server);

      const dumpPath = `/tmp/${name}_${Date.now()}.sql`;

      if (engine === 'mysql') {
        await exec(id, `sudo mysqldump ${name} > ${dumpPath} 2>/dev/null`);
      } else {
        await exec(id, `sudo -u postgres pg_dump ${name} > ${dumpPath}`);
      }

      const size = await exec(id, `stat -c %s ${dumpPath} 2>/dev/null || echo "0"`);

      return { ok: true, data: { path: dumpPath, size: parseInt(size) } };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err instanceof Error ? err.message : 'Dump failed' });
    }
  });
}
