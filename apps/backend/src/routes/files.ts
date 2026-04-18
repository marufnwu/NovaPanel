import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getSftpConnection, listDirectory, readFileContent, writeFileContent, deleteFile, deleteDirectory, createDirectory, rename, downloadFile } from '../services/sftp.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

async function getServerAndSftp(request: FastifyRequest, reply: FastifyReply) {
  const user = getUser(request);
  const { id } = request.params as { id: string };

  const server = await prisma.server.findFirst({
    where: { id, teamId: user.teamId, deletedAt: null },
    include: { sshKey: true },
  });

  if (!server) {
    reply.code(404).send({ ok: false, error: 'Server not found' });
    return null;
  }

  try {
    const { client, sftp } = await getSftpConnection(server);
    return { client, sftp };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SFTP connection failed';
    reply.code(502).send({ ok: false, error: msg });
    return null;
  }
}

export async function fileRoutes(app: FastifyInstance) {
  // ─── Browse Directory ───
  app.get('/api/v1/servers/:id/files', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;
    const query = request.query as { path?: string };
    const dirPath = query.path || '/';

    try {
      const entries = await listDirectory(sftp, dirPath);
      return { ok: true, data: { path: dirPath, entries } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to list directory';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── Read File Content ───
  app.get('/api/v1/servers/:id/files/content', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;
    const query = request.query as { path: string };

    if (!query.path) {
      client.end();
      return reply.code(400).send({ ok: false, error: 'path is required' });
    }

    try {
      const content = await readFileContent(sftp, query.path);
      return { ok: true, data: { path: query.path, content } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── Download File ───
  app.get('/api/v1/servers/:id/files/download', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;
    const query = request.query as { path: string };

    if (!query.path) {
      client.end();
      return reply.code(400).send({ ok: false, error: 'path is required' });
    }

    try {
      const buffer = await downloadFile(sftp, query.path);
      const filename = query.path.split('/').pop() || 'file';
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Type', 'application/octet-stream');
      return reply.send(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── Save File Content ───
  app.put('/api/v1/servers/:id/files/content', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;

    const body = z.object({ path: z.string().min(1), content: z.string() }).safeParse(request.body);
    if (!body.success) {
      client.end();
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    try {
      await writeFileContent(sftp, body.data.path, body.data.content);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save file';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── Create Directory ───
  app.post('/api/v1/servers/:id/files/mkdir', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;

    const body = z.object({ path: z.string().min(1) }).safeParse(request.body);
    if (!body.success) {
      client.end();
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    try {
      await createDirectory(sftp, body.data.path);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create directory';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── Rename ───
  app.post('/api/v1/servers/:id/files/rename', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;

    const body = z.object({ oldPath: z.string().min(1), newPath: z.string().min(1) }).safeParse(request.body);
    if (!body.success) {
      client.end();
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    try {
      await rename(sftp, body.data.oldPath, body.data.newPath);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rename';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── Delete ───
  app.delete('/api/v1/servers/:id/files', async (request, reply) => {
    const result = await getServerAndSftp(request, reply);
    if (!result) return;
    const { client, sftp } = result;
    const query = request.query as { path: string; type?: string };

    if (!query.path) {
      client.end();
      return reply.code(400).send({ ok: false, error: 'path is required' });
    }

    try {
      if (query.type === 'directory') {
        await deleteDirectory(sftp, query.path);
      } else {
        await deleteFile(sftp, query.path);
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      return reply.code(500).send({ ok: false, error: msg });
    } finally {
      client.end();
    }
  });

  // ─── WS Ticket for Terminal ───
  app.post('/api/v1/servers/:id/terminal-ticket', async (request) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const server = await prisma.server.findFirst({
      where: { id, teamId: user.teamId, deletedAt: null },
    });

    if (!server) {
      throw new Error('Server not found');
    }

    // Return the user's access token as the WS ticket
    return { ok: true, data: { ticket: request.headers.authorization?.replace('Bearer ', '') } };
  });
}
