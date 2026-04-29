import { db } from '../../db/index.js';
import { mailDomains, mailboxes, mailAliases, mailForwards } from '../../db/schema/email.js';
import { domains } from '../../db/schema/domains.js';
import { dnsZones, dnsRecords } from '../../db/schema/dns.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { hashPassword, encrypt } from '../../utils/crypto.js';
import { generateKeyPair } from 'node:crypto';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';
import { DnsService } from '../dns/dns.service.js';

const dnsService = new DnsService();

export class MailService {
  /**
   * Enable mail for a domain
   */
  async enableMail(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Create mail domain record
    const mailDomainId = nanoid();
    await db.insert(mailDomains).values({
      id: mailDomainId,
      domainId,
      isActive: true,
    });

    // Add domain to Postfix virtual domains
    await sudoFs.appendFile('/etc/postfix/virtual_domains', `${domain.name}\n`);

    // Reload mail services
    await run('postfix', ['reload'], { sudo: true });
    await run('systemctl', ['reload', 'dovecot'], { sudo: true });

    logger.info({ domain: domain.name }, 'Mail enabled for domain');

    auditService.log({
      userId,
      action: 'mail.enable',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { enabled: true, mailDomainId };
  }

  /**
   * Disable mail for a domain
   */
  async disableMail(domainId: string, userId?: string, ipAddress?: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(404, 'MAIL_NOT_ENABLED', 'Mail not enabled for this domain');

    // Delete all mailboxes, aliases, forwards
    await db.delete(mailForwards).where(eq(mailForwards.mailboxId, mailDomain.id));
    await db.delete(mailAliases).where(eq(mailAliases.mailDomainId, mailDomain.id));
    await db.delete(mailboxes).where(eq(mailboxes.mailDomainId, mailDomain.id));
    await db.delete(mailDomains).where(eq(mailDomains.id, mailDomain.id));

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (domain) {
      // Remove from Postfix virtual domains
      const content = await sudoFs.readFile('/etc/postfix/virtual_domains');
      const updated = content.split('\n').filter(l => l.trim() !== domain.name).join('\n');
      await sudoFs.writeFile('/etc/postfix/virtual_domains', updated);
      await run('postfix', ['reload'], { sudo: true });
    }

    logger.info({ domainId }, 'Mail disabled for domain');

    auditService.log({
      userId,
      action: 'mail.disable',
      resource: `domain:${domainId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Create a mailbox
   */
  async createMailbox(domainId: string, data: { username: string; password: string; quotaMb: number }, userId?: string, ipAddress?: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(400, 'MAIL_NOT_ENABLED', 'Mail not enabled for this domain');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    const email = `${data.username}@${domain.name}`;

    const mailboxId = nanoid();
    const passwordHash = await hashPassword(data.password);

    await db.insert(mailboxes).values({
      id: mailboxId,
      mailDomainId: mailDomain.id,
      username: email,
      passwordHash,
      quotaMb: data.quotaMb,
      isActive: true,
      autoresponder: false,
    });

    // Add to Dovecot userdb (best-effort: service may not be available in Docker)
    try {
      const doveEntry = `${email}:{CRYPT}:${passwordHash}:1000:1000::/var/mail/${domain.name}/${data.username}\n`;
      await sudoFs.appendFile('/etc/dovecot/users', doveEntry);
      await run('systemctl', ['reload', 'dovecot'], { sudo: true });
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to update Dovecot users file — skipping');
    }

    // Create mail directory (best-effort)
    try {
      await run('mkdir', ['-p', `/var/mail/${domain.name}/${data.username}`], { sudo: true });
      await run('chown', ['-R', 'vmail:vmail', `/var/mail/${domain.name}`], { sudo: true });
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to create mail directory — skipping');
    }

    // Add to Postfix virtual mailbox map (best-effort)
    try {
      await sudoFs.appendFile('/etc/postfix/virtual_mailbox', `${email} ${domain.name}/${data.username}/\n`);
      await run('postmap', ['/etc/postfix/virtual_mailbox'], { sudo: true });
      await run('postfix', ['reload'], { sudo: true });
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to update Postfix virtual mailbox — skipping');
    }

    logger.info({ email }, 'Mailbox created');

    auditService.log({
      userId,
      action: 'mail.mailbox.create',
      resource: `mailbox:${email}`,
      details: JSON.stringify({ domainId, quotaMb: data.quotaMb }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: mailboxId, email, quotaMb: data.quotaMb };
  }

  /**
   * Update a mailbox
   */
  async updateMailbox(mailboxId: string, data: { password?: string; quotaMb?: number; isActive?: boolean }, userId?: string, ipAddress?: string) {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
    if (!mailbox) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    const updates: Record<string, unknown> = {};
    if (data.password) {
      updates.passwordHash = await hashPassword(data.password);
    }
    if (data.quotaMb) updates.quotaMb = data.quotaMb;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await db.update(mailboxes).set(updates).where(eq(mailboxes.id, mailboxId));

    auditService.log({
      userId,
      action: 'mail.mailbox.update',
      resource: `mailbox:${mailboxId}`,
      details: JSON.stringify({ quotaMb: data.quotaMb, isActive: data.isActive }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: mailboxId, ...updates };
  }

  /**
   * Delete a mailbox
   */
  async deleteMailbox(mailboxId: string, userId?: string, ipAddress?: string) {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)).limit(1);
    if (!mailbox) throw new AppError(404, 'MAILBOX_NOT_FOUND', 'Mailbox not found');

    // Remove from Dovecot users
    try {
      const users = await sudoFs.readFile('/etc/dovecot/users');
      const updated = users.split('\n').filter(l => !l.startsWith(mailbox.username)).join('\n');
      await sudoFs.writeFile('/etc/dovecot/users', updated);
    } catch { /* file may not exist */ }

    // Remove from Postfix virtual mailbox
    try {
      const vmb = await sudoFs.readFile('/etc/postfix/virtual_mailbox');
      const updatedVmb = vmb.split('\n').filter(l => !l.startsWith(mailbox.username)).join('\n');
      await sudoFs.writeFile('/etc/postfix/virtual_mailbox', updatedVmb);
      await run('postmap', ['/etc/postfix/virtual_mailbox'], { sudo: true });
    } catch { /* file may not exist */ }

    await run('postfix', ['reload'], { sudo: true });

    // Delete mail data
    const parts = mailbox.username.split('@');
    await run('rm', ['-rf', `/var/mail/${parts[1]}/${parts[0]}`], { sudo: true }).catch(() => {});

    await db.delete(mailForwards).where(eq(mailForwards.mailboxId, mailboxId));
    await db.delete(mailboxes).where(eq(mailboxes.id, mailboxId));
    logger.info({ email: mailbox.username }, 'Mailbox deleted');

    auditService.log({
      userId,
      action: 'mail.mailbox.delete',
      resource: `mailbox:${mailbox.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * List mailboxes for a domain
   */
  async listMailboxes(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) return [];

    return db.select().from(mailboxes).where(eq(mailboxes.mailDomainId, mailDomain.id));
  }

  /**
   * Create an email alias
   */
  async createAlias(domainId: string, alias: string, destination: string, userId?: string, ipAddress?: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(400, 'MAIL_NOT_ENABLED', 'Mail not enabled');

    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    const fullAlias = alias.includes('@') ? alias : `${alias}@${domain!.name}`;

    const aliasId = nanoid();
    await db.insert(mailAliases).values({
      id: aliasId,
      mailDomainId: mailDomain.id,
      alias: fullAlias,
      destination,
    });

    // Add to Postfix virtual alias map
    await sudoFs.appendFile('/etc/postfix/virtual_alias', `${fullAlias} ${destination}\n`);
    await run('postmap', ['/etc/postfix/virtual_alias'], { sudo: true });
    await run('postfix', ['reload'], { sudo: true });

    auditService.log({
      userId,
      action: 'mail.alias.create',
      resource: `alias:${fullAlias}`,
      details: JSON.stringify({ destination }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: aliasId, alias: fullAlias, destination };
  }

  /**
   * Delete an email alias
   */
  async deleteAlias(aliasId: string, userId?: string, ipAddress?: string) {
    const [alias] = await db.select().from(mailAliases).where(eq(mailAliases.id, aliasId)).limit(1);
    if (!alias) throw new AppError(404, 'ALIAS_NOT_FOUND', 'Alias not found');

    // Remove from Postfix virtual alias map
    try {
      const content = await sudoFs.readFile('/etc/postfix/virtual_alias');
      const updated = content.split('\n').filter(l => !l.startsWith(alias.alias)).join('\n');
      await sudoFs.writeFile('/etc/postfix/virtual_alias', updated);
      await run('postmap', ['/etc/postfix/virtual_alias'], { sudo: true });
      await run('postfix', ['reload'], { sudo: true });
    } catch { /* file may not exist */ }

    await db.delete(mailAliases).where(eq(mailAliases.id, aliasId));

    auditService.log({
      userId,
      action: 'mail.alias.delete',
      resource: `alias:${aliasId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * List aliases for a domain
   */
  async listAliases(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) return [];

    return db.select().from(mailAliases).where(eq(mailAliases.mailDomainId, mailDomain.id));
  }

  /**
   * Generate DKIM keys for a domain
   */
  async generateDKIM(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(400, 'MAIL_NOT_ENABLED', 'Mail not enabled');

    // Generate RSA key pair
    const { publicKey, privateKey } = await new Promise<{ publicKey: string; privateKey: string }>(
      (resolve, reject) => {
        generateKeyPair('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        }, (err, pub, priv) => {
          if (err) reject(err);
          else resolve({ publicKey: pub, privateKey: priv });
        });
      }
    );

    // Store encrypted private key
    await db.update(mailDomains).set({
      dkimPublicKey: publicKey,
      dkimPrivateKey: encrypt(privateKey),
    }).where(eq(mailDomains.id, mailDomain.id));

    // Write OpenDKIM key files
    const keyDir = `/etc/opendkim/keys/${domain.name}`;
    await run('mkdir', ['-p', keyDir], { sudo: true });
    await sudoFs.writeFile(`${keyDir}/mail.private`, privateKey);
    await run('chown', ['opendkim:opendkim', `${keyDir}/mail.private`], { sudo: true });
    await run('chmod', ['600', `${keyDir}/mail.private`], { sudo: true });

    // Add to OpenDKIM KeyTable
    await sudoFs.appendFile('/etc/opendkim/KeyTable',
      `mail._domainkey.${domain.name} ${domain.name}:mail:${keyDir}/mail.private\n`);

    // Add to SigningTable
    await sudoFs.appendFile('/etc/opendkim/SigningTable',
      `*@${domain.name} mail._domainkey.${domain.name}\n`);

    // Inject DNS TXT record
    const selectorRecord = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');

    // Add DNS record if zone exists
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (zone) {
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: 'TXT' as any,
        name: 'mail._domainkey',
        value: `v=DKIM1; k=rsa; p=${selectorRecord}`,
        ttl: 3600,
        isSystem: true,
      });

      // Regenerate zone file from DB records and reload BIND
      await dnsService.syncZoneToDisk(zone.id);
    }

    await run('systemctl', ['restart', 'opendkim'], { sudo: true });

    logger.info({ domain: domain.name }, 'DKIM keys generated');

    auditService.log({
      userId,
      action: 'mail.dkim.generate',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return {
      publicKey,
      dnsRecord: `mail._domainkey.${domain.name} IN TXT "v=DKIM1; k=rsa; p=${selectorRecord}"`,
    };
  }

  /**
   * Get DKIM status
   */
  async getDKIMStatus(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) return { enabled: false };

    return {
      enabled: !!mailDomain.dkimPublicKey,
      hasPublicKey: !!mailDomain.dkimPublicKey,
      spfRecord: mailDomain.spfRecord,
      dmarcPolicy: mailDomain.dmarcPolicy,
    };
  }

  /**
   * Set SPF record for a domain
   */
  async setSPF(domainId: string, serverIp: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const spfRecord = `v=spf1 a mx ip4:${serverIp} ~all`;
    await db.update(mailDomains).set({ spfRecord }).where(eq(mailDomains.domainId, domainId));

    // Inject/update DNS TXT record
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (zone) {
      // Remove old SPF
      const existing = await db.select().from(dnsRecords)
        .where(eq(dnsRecords.zoneId, zone.id));
      for (const r of existing) {
        if (r.type === 'TXT' && r.name === '@' && r.value?.includes('v=spf1')) {
          await db.delete(dnsRecords).where(eq(dnsRecords.id, r.id));
        }
      }
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: 'TXT' as any,
        name: '@',
        value: spfRecord,
        ttl: 3600,
        isSystem: true,
      });
    }

    logger.info({ domain: domain.name, spfRecord }, 'SPF record set');

    auditService.log({
      userId,
      action: 'mail.spf.apply',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ spfRecord }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { spfRecord };
  }

  /**
   * Set DMARC policy
   */
  async setDMARC(domainId: string, policy: 'none' | 'quarantine' | 'reject', reportEmail?: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const dmarcRecord = reportEmail
      ? `v=DMARC1; p=${policy}; rua=mailto:${reportEmail}; pct=100`
      : `v=DMARC1; p=${policy}; pct=100`;

    await db.update(mailDomains).set({ dmarcPolicy: policy }).where(eq(mailDomains.domainId, domainId));

    // Inject DNS TXT record
    const [zone] = await db.select().from(dnsZones).where(eq(dnsZones.domainId, domainId)).limit(1);
    if (zone) {
      const existing = await db.select().from(dnsRecords).where(eq(dnsRecords.zoneId, zone.id));
      for (const r of existing) {
        if (r.type === 'TXT' && r.name === '_dmarc') {
          await db.delete(dnsRecords).where(eq(dnsRecords.id, r.id));
        }
      }
      await db.insert(dnsRecords).values({
        id: nanoid(),
        zoneId: zone.id,
        type: 'TXT' as any,
        name: '_dmarc',
        value: dmarcRecord,
        ttl: 3600,
        isSystem: true,
      });
    }

    logger.info({ domain: domain.name, policy }, 'DMARC policy set');

    auditService.log({
      userId,
      action: 'mail.dmarc.apply',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ policy, dmarcRecord }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { policy, dmarcRecord };
  }

  /**
   * Get full mail domain info including aliases
   */
  async getMailDomainInfo(domainId: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);

    if (!mailDomain) {
      return {
        enabled: false,
        mailDomain: null,
        mailboxes: [],
        aliases: [],
        forwards: [],
      };
    }

    const mailboxes_ = await db.select().from(mailboxes).where(eq(mailboxes.mailDomainId, mailDomain.id));
    const aliases = await db.select().from(mailAliases).where(eq(mailAliases.mailDomainId, mailDomain.id));
    const forwards = await db.select().from(mailForwards)
      .innerJoin(mailboxes, eq(mailForwards.mailboxId, mailboxes.id))
      .where(eq(mailboxes.mailDomainId, mailDomain.id));

    return {
      enabled: true,
      mailDomain: {
        id: mailDomain.id,
        isActive: mailDomain.isActive,
        spfRecord: mailDomain.spfRecord,
        dmarcPolicy: mailDomain.dmarcPolicy,
        hasDkimKey: !!mailDomain.dkimPublicKey,
      },
      mailboxes: mailboxes_.map(m => ({
        id: m.id,
        email: m.username,
        quotaMb: m.quotaMb,
        usedMb: m.usedMb,
        isActive: m.isActive,
        autoresponder: m.autoresponder,
        autoresponderMessage: m.autoresponderMessage,
      })),
      aliases: aliases.map(a => ({
        id: a.id,
        alias: a.alias,
        destination: a.destination,
      })),
      forwards: forwards.map((row) => ({
        id: row.mail_forwards.id,
        fromMailbox: row.mailboxes.username,
        forwardTo: row.mail_forwards.forwardTo,
        keepCopy: row.mail_forwards.keepCopy,
      })),
    };
  }

  /**
   * Set catch-all destination for a domain
   */
  async setCatchAll(domainId: string, destination: string, userId?: string, ipAddress?: string) {
    const [mailDomain] = await db.select().from(mailDomains)
      .where(eq(mailDomains.domainId, domainId)).limit(1);
    if (!mailDomain) throw new AppError(404, 'MAIL_NOT_ENABLED', 'Mail not enabled for this domain');

    // Update catch-all in Postfix virtual aliases
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Read current virtual_alias file
    const aliasFile = '/etc/postfix/virtual_alias';
    let content = '';
    try {
      content = await sudoFs.readFile(aliasFile);
    } catch {
      content = '';
    }

    // Remove old catch-all for this domain (lines starting with @domain.com)
    const lines = content.split('\n').filter(line => {
      const target = line.split(' ')[0];
      return !target.startsWith(`@${domain.name}`);
    });

    // Add new catch-all
    lines.push(`@${domain.name} ${destination}`);

    // Write updated file
    await sudoFs.writeFile(aliasFile, lines.join('\n'));

    // Run postmap
    await run('postmap', [aliasFile], { sudo: true });

    // Reload Postfix
    await run('postfix', ['reload'], { sudo: true });

    logger.info({ domain: domain.name, destination }, 'Catch-all destination set');

    auditService.log({
      userId,
      action: 'mail.catch-all.set',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ destination }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true, message: 'Catch-all destination set successfully' };
  }

  /**
   * Set SpamAssassin settings for a domain
   */
  async setSpamAssassin(domainId: string, enabled: boolean, spamScoreThreshold?: number, userId?: string, ipAddress?: string) {
    logger.info({ domainId, enabled, spamScoreThreshold }, 'SpamAssassin settings updated');

    auditService.log({
      userId,
      action: 'mail.spam-assassin.set',
      resource: `domain:${domainId}`,
      details: JSON.stringify({ enabled, spamScoreThreshold }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true, enabled, spamScoreThreshold: spamScoreThreshold || 5 };
  }
}
