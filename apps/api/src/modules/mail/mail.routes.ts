import type { FastifyInstance, FastifyReply } from 'fastify';
import { MailService } from './mail.service.js';
import { createMailboxSchema, updateMailboxSchema, createAliasSchema } from './mail.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';

export default async function mailRoutes(fastify: FastifyInstance) {
  const service = new MailService();
  fastify.addHook('preHandler', requireAuth);

  // GET /domains/:id/mail — Get mail overview
  fastify.get('/domains/:id/mail', async (req) => {
    const { id } = req.params as { id: string };
    const mailboxes = await service.listMailboxes(id);
    return { success: true, data: { mailboxes } };
  });

  // POST /domains/:id/mail/enable — Enable mail for domain
  fastify.post('/domains/:id/mail/enable', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.enableMail(id, req.user.id, req.ip) };
  });

  // DELETE /domains/:id/mail/disable — Disable mail for domain
  fastify.delete('/domains/:id/mail/disable', async (req) => {
    const { id } = req.params as { id: string };
    await service.disableMail(id, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /domains/:id/mail/mailboxes — List mailboxes
  fastify.get('/domains/:id/mail/mailboxes', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listMailboxes(id) };
  });

  // POST /domains/:id/mail/mailboxes — Create mailbox
  fastify.post('/domains/:id/mail/mailboxes', async (req, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = createMailboxSchema.parse(req.body);
    const mailbox = await service.createMailbox(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: mailbox });
  });

  // PUT /domains/:id/mail/mailboxes/:mbId — Update mailbox
  fastify.put('/domains/:id/mail/mailboxes/:mbId', async (req) => {
    const { mbId } = req.params as { mbId: string };
    const data = updateMailboxSchema.parse(req.body);
    return { success: true, data: await service.updateMailbox(mbId, data, req.user.id, req.ip) };
  });

  // DELETE /domains/:id/mail/mailboxes/:mbId — Delete mailbox
  fastify.delete('/domains/:id/mail/mailboxes/:mbId', async (req) => {
    const { mbId } = req.params as { mbId: string };
    await service.deleteMailbox(mbId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // GET /domains/:id/mail/aliases — List aliases
  fastify.get('/domains/:id/mail/aliases', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listAliases(id) };
  });

  // POST /domains/:id/mail/aliases — Create alias
  fastify.post('/domains/:id/mail/aliases', async (req) => {
    const { id } = req.params as { id: string };
    const { alias, destination } = createAliasSchema.parse(req.body);
    return { success: true, data: await service.createAlias(id, alias, destination, req.user.id, req.ip) };
  });

  // DELETE /domains/:id/mail/aliases/:aliasId — Delete alias
  fastify.delete('/domains/:id/mail/aliases/:aliasId', async (req) => {
    const { aliasId } = req.params as { aliasId: string };
    await service.deleteAlias(aliasId, req.user.id, req.ip);
    return { success: true, data: null };
  });

  // POST /domains/:id/mail/dkim/generate — Generate DKIM keys
  fastify.post('/domains/:id/mail/dkim/generate', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.generateDKIM(id, req.user.id, req.ip) };
  });

  // GET /domains/:id/mail/dkim/status — Get DKIM status
  fastify.get('/domains/:id/mail/dkim/status', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getDKIMStatus(id) };
  });

  // GET /domains/:id/mail/info — Full mail domain info (mailboxes + aliases + forwards)
  fastify.get('/domains/:id/mail/info', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getMailDomainInfo(id) };
  });

  // PUT /domains/:id/mail/spf — Set SPF record
  fastify.put('/domains/:id/mail/spf', async (req) => {
    const { id } = req.params as { id: string };
    const { serverIp } = req.body as { serverIp: string };
    return { success: true, data: await service.setSPF(id, serverIp, req.user.id, req.ip) };
  });

  // PUT /domains/:id/mail/dmarc — Set DMARC policy
  fastify.put('/domains/:id/mail/dmarc', async (req) => {
    const { id } = req.params as { id: string };
    const { policy, reportEmail } = req.body as { policy: 'none' | 'quarantine' | 'reject'; reportEmail?: string };
    return { success: true, data: await service.setDMARC(id, policy, reportEmail, req.user.id, req.ip) };
  });

  // PUT /domains/:id/mail/mailboxes/catch-all — Set catch-all destination
  fastify.put('/domains/:id/mail/mailboxes/catch-all', async (req) => {
    const { id } = req.params as { id: string };
    const { destination } = req.body as { destination: string };
    return { success: true, data: await service.setCatchAll(id, destination, req.user.id, req.ip) };
  });

  // PUT /domains/:id/mail/spamassassin — Set SpamAssassin settings
  fastify.put('/domains/:id/mail/spamassassin', async (req) => {
    const { id } = req.params as { id: string };
    const { enabled, spamScoreThreshold } = req.body as { enabled: boolean; spamScoreThreshold?: number };
    return { success: true, data: await service.setSpamAssassin(id, enabled, spamScoreThreshold, req.user.id, req.ip) };
  });
}
