import type { FastifyInstance, FastifyReply } from 'fastify';
import { FtpService } from './ftp.service.js';
import { createFtpAccountSchema, updateFtpAccountSchema } from './ftp.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function ftpRoutes(fastify: FastifyInstance) {
  const service = new FtpService();
  fastify.addHook('preHandler', requireAuth);

  // GET /domains/:id/ftp — List FTP accounts
  fastify.get('/domains/:id/ftp', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listAccounts(id) };
  });

  // POST /domains/:id/ftp — Create FTP account
  fastify.post('/domains/:id/ftp', async (req, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = createFtpAccountSchema.parse(req.body);
    const account = await service.createAccount(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: account });
  });

  // GET /ftp/:ftpId — Get single FTP account
  fastify.get('/ftp/:ftpId', async (req) => {
    const { ftpId } = req.params as { ftpId: string };
    return { success: true, data: await service.getAccount(ftpId) };
  });

  // PUT /ftp/:ftpId — Update FTP account
  fastify.put('/ftp/:ftpId', async (req) => {
    const { ftpId } = req.params as { ftpId: string };
    const data = updateFtpAccountSchema.parse(req.body);
    return { success: true, data: await service.updateAccount(ftpId, data, req.user.id, req.ip) };
  });

  // PUT /ftp/:ftpId/password — Change password
  fastify.put('/ftp/:ftpId/password', async (req) => {
    const { ftpId } = req.params as { ftpId: string };
    const { password } = req.body as { password: string };
    await service.updatePassword(ftpId, password, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // DELETE /ftp/:ftpId — Delete FTP account
  fastify.delete('/ftp/:ftpId', async (req) => {
    const { ftpId } = req.params as { ftpId: string };
    await service.deleteAccount(ftpId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /ftp/settings — Get FTP global settings
  fastify.get('/ftp/settings', async () => {
    return { success: true, data: await service.getSettings() };
  });

  // PUT /ftp/settings — Update FTP global settings
  fastify.put('/ftp/settings', async (req) => {
    const data = req.body as any;
    return { success: true, data: await service.updateSettings(data) };
  });
}
