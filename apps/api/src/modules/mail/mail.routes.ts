import type { FastifyInstance } from 'fastify';
import { MailService } from './mail.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function mailRoutes(fastify: FastifyInstance) {
  const service = new MailService();
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/domains/:id/mail', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getMailDomains(id) };
  });

  fastify.post('/domains/:id/mail/enable', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.enableMail(id, req.user.id, req.ip) };
  });

  fastify.delete('/domains/:id/mail/disable', async (req) => {
    const { id } = req.params as { id: string };
    await service.disableMail(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  fastify.get('/domains/:id/mail/mailboxes', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listMailboxes(id) };
  });

  fastify.get('/domains/:id/mail/aliases', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listAliases(id) };
  });

  fastify.get('/domains/:id/mail/info', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getStats(id) };
  });
}