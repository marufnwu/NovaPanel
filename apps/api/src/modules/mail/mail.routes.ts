import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MailService } from './mail.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createMailboxSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createAliasSchema = z.object({
  source: z.string().min(1),
  destination: z.string().min(1),
});

const createForwardSchema = z.object({
  source: z.string().min(1),
  destinations: z.array(z.string().min(1)),
});

const updateMailboxSchema = z.object({
  password: z.string().optional(),
  quotaMb: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  autoresponder: z.boolean().optional(),
  autoresponderSubject: z.string().optional(),
  autoresponderMessage: z.string().optional(),
});

const spfSchema = z.object({
  serverIp: z.string().min(1),
});

const dmarcSchema = z.object({
  policy: z.enum(['none', 'quarantine', 'reject']),
  reportEmail: z.string().optional(),
});

const catchAllSchema = z.object({
  destination: z.string().min(1),
});

const spamAssassinSchema = z.object({
  enabled: z.boolean(),
  spamScoreThreshold: z.number().int().optional(),
});

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

  fastify.post('/domains/:id/mail/mailboxes', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createMailboxSchema.parse(req.body);
    const mailbox = await service.createMailbox(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: mailbox });
  });

  fastify.put('/domains/:id/mail/mailboxes/:mailboxId', async (req) => {
    const { mailboxId } = req.params as { mailboxId: string };
    const data = updateMailboxSchema.parse(req.body);
    return { success: true, data: await service.updateMailbox(mailboxId, data) };
  });

  fastify.delete('/domains/:id/mail/mailboxes/:mailboxId', async (req) => {
    const { mailboxId } = req.params as { mailboxId: string };
    const result = await service.deleteMailbox(mailboxId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/domains/:id/mail/aliases', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listAliases(id) };
  });

  fastify.post('/domains/:id/mail/aliases', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createAliasSchema.parse(req.body);
    await service.createAlias(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: null });
  });

  fastify.delete('/domains/:id/mail/aliases/:aliasId', async (req) => {
    const { id, aliasId } = req.params as { id: string; aliasId: string };
    const result = await service.deleteAlias(id, aliasId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/domains/:id/mail/forwards', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.listForwards(id) };
  });

  fastify.post('/domains/:id/mail/forwards', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createForwardSchema.parse(req.body);
    await service.createForward(id, data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: null });
  });

  fastify.delete('/domains/:id/mail/forwards/:forwardId', async (req) => {
    const { id, forwardId } = req.params as { id: string; forwardId: string };
    const result = await service.deleteForward(id, forwardId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/domains/:id/mail/info', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: await service.getStats(id) };
  });

  // DKIM
  fastify.get('/domains/:id/mail/dkim/status', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: { enabled: false, hasPublicKey: false, selector: '', dnsRecord: '', spfRecord: '', dmarcPolicy: '' } };
  });

  fastify.post('/domains/:id/mail/dkim/generate', async (req) => {
    const { id } = req.params as { id: string };
    return { success: true, data: { selector: 'mail', publicKey: 'DKIM public key for ' + id } };
  });

  // SPF
  fastify.put('/domains/:id/mail/spf', async (req) => {
    const { id } = req.params as { id: string };
    const { serverIp } = spfSchema.parse(req.body);
    return { success: true, data: { spfRecord: `v=spf1 a mx ip4:${serverIp} -all` } };
  });

  // DMARC
  fastify.put('/domains/:id/mail/dmarc', async (req) => {
    const { id } = req.params as { id: string };
    const { policy, reportEmail } = dmarcSchema.parse(req.body);
    return { success: true, data: { dmarcRecord: `v=DMARC1; p=${policy}${reportEmail ? '; rua=mailto:' + reportEmail : ''}` } };
  });

  // Catch-all
  fastify.put('/domains/:id/mail/mailboxes/catch-all', async (req) => {
    const { id } = req.params as { id: string };
    const { destination } = catchAllSchema.parse(req.body);
    return { success: true, data: { catchAllDestination: destination } };
  });

  // SpamAssassin
  fastify.put('/domains/:id/mail/spamassassin', async (req) => {
    const { id } = req.params as { id: string };
    const data = spamAssassinSchema.parse(req.body);
    return { success: true, data: { spamAssassinEnabled: data.enabled, spamScoreThreshold: data.spamScoreThreshold || 5 } };
  });
}