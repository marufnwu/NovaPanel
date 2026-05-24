import { db } from '../../db/index.js';
import { mailboxes } from '../../db/schema/mail.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class MailService {
  async enableMail(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({ status: 'active' }).where(eq(domains.id, domainId));
    auditService.log({ userId, action: 'mail.enable', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return { success: true, domain: domain.name };
  }

  async disableMail(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({ status: 'suspended' }).where(eq(domains.id, domainId));
    auditService.log({ userId, action: 'mail.disable', resource: `domain:${domain.name}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async getMailDomains(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return [{ id: domain.id, name: domain.name, status: domain.status }];
  }

  async createMailbox(domainId: string, data: { username: string; password: string }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [mailbox] = await db.insert(mailboxes).values({
      id: nanoid(),
      projectId: domain.projectId,
      domainId,
      username: data.username,
      password: data.password,
      enabled: true,
    }).returning();

    auditService.log({ userId, action: 'mail.mailbox.create', resource: `mailbox:${data.username}@${domain.name}`, ipAddress }).catch(() => {});
    return mailbox;
  }

  async listMailboxes(domainId: string) {
    return db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId));
  }

  async deleteMailbox(mailboxId: string, userId?: string, ipAddress?: string) {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
    if (!mailbox) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    await db.delete(mailboxes).where(eq(mailboxes.id, mailboxId));
    auditService.log({ userId, action: 'mail.mailbox.delete', resource: `mailbox:${mailbox.username}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async createAlias(domainId: string, data: { source: string; destination: string }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const existing = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId)).limit(1);
    if (!existing.length) throw new AppError(400, 'NO_MAILBOX', 'Create a mailbox first');

    const [mb] = existing;
    const aliases = JSON.parse(mb.aliases as string || '[]');
    aliases.push({ source: data.source, destination: data.destination });
    await db.update(mailboxes).set({ aliases: JSON.stringify(aliases), updatedAt: new Date() }).where(eq(mailboxes.id, mb.id));

    auditService.log({ userId, action: 'mail.alias.create', resource: `alias:${data.source}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async listAliases(domainId: string) {
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId)).limit(1);
    if (!mb) return [];
    return (JSON.parse(mb.aliases as string || '[]') as Array<{ source: string; destination: string }>).map(a => ({ ...a, mailboxId: mb.id }));
  }

  async updateMailbox(mailboxId: string, data: { password?: string; quotaMb?: number; isActive?: boolean; isSuspended?: boolean; autoresponder?: boolean; autoresponderSubject?: string; autoresponderMessage?: string }, userId?: string, ipAddress?: string) {
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
    if (!mb) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.password) updates.password = data.password;
    if (data.quotaMb !== undefined) updates.quotaMb = data.quotaMb;
    if (data.isActive !== undefined) updates.enabled = data.isActive;
    if (data.isSuspended !== undefined) updates.suspended = data.isSuspended;
    if (data.autoresponder !== undefined) updates.autoresponder = data.autoresponder;
    if (data.autoresponderSubject) updates.autoresponderSubject = data.autoresponderSubject;
    if (data.autoresponderMessage) updates.autoresponderMessage = data.autoresponderMessage;
    const [updated] = await db.update(mailboxes).set(updates).where(eq(mailboxes.id, mailboxId)).returning();
    auditService.log({ userId, action: 'mail.mailbox.update', resource: `mailbox:${mb.username}`, ipAddress }).catch(() => {});
    return updated;
  }

  async deleteAlias(domainId: string, aliasId: string, userId?: string, ipAddress?: string) {
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId)).limit(1);
    if (!mb) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    const aliases = JSON.parse(mb.aliases as string || '[]');
    const filtered = aliases.filter((_: any, i: number) => String(i) !== aliasId);
    await db.update(mailboxes).set({ aliases: JSON.stringify(filtered), updatedAt: new Date() }).where(eq(mailboxes.id, mb.id));
    auditService.log({ userId, action: 'mail.alias.delete', resource: `alias:${aliasId}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async createForward(domainId: string, data: { source: string; destinations: string[] }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const existing = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId)).limit(1);
    if (!existing.length) throw new AppError(400, 'NO_MAILBOX', 'Create a mailbox first');

    const [mb] = existing;
    const forwards = JSON.parse(mb.forwards as string || '[]');
    forwards.push({ source: data.source, destinations: data.destinations });
    await db.update(mailboxes).set({ forwards: JSON.stringify(forwards), updatedAt: new Date() }).where(eq(mailboxes.id, mb.id));

    auditService.log({ userId, action: 'mail.forward.create', resource: `forward:${data.source}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async listForwards(domainId: string) {
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId)).limit(1);
    if (!mb) return [];
    return (JSON.parse(mb.forwards as string || '[]') as Array<{ source: string; destinations: string[] }>).map(f => ({ ...f, mailboxId: mb.id }));
  }

  async deleteForward(domainId: string, forwardId: string, userId?: string, ipAddress?: string) {
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId)).limit(1);
    if (!mb) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    const forwards = JSON.parse(mb.forwards as string || '[]');
    const filtered = forwards.filter((_: any, i: number) => String(i) !== forwardId);
    await db.update(mailboxes).set({ forwards: JSON.stringify(filtered), updatedAt: new Date() }).where(eq(mailboxes.id, mb.id));
    auditService.log({ userId, action: 'mail.forward.delete', resource: `forward:${forwardId}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async getStats(domainId: string) {
    const domainMailboxes = await db.select().from(mailboxes).where(eq(mailboxes.domainId, domainId));
    let aliasCount = 0;
    let forwardCount = 0;
    for (const mb of domainMailboxes) {
      aliasCount += JSON.parse(mb.aliases as string || '[]').length;
      forwardCount += JSON.parse(mb.forwards as string || '[]').length;
    }
    return { mailboxCount: domainMailboxes.length, aliasCount, forwardCount };
  }
}

export const mailService = new MailService();