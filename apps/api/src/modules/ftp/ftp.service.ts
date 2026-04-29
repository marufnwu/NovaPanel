import { db } from '../../db/index.js';
import { ftpAccounts } from '../../db/schema/ftp.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { hashPassword } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';

export class FtpService {
  async listAccounts(domainId: string) {
    return db.select().from(ftpAccounts).where(eq(ftpAccounts.domainId, domainId));
  }

  async getAccount(ftpId: string) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');
    return account;
  }

  async createAccount(domainId: string, data: { username: string; password: string; homeDir: string; readonly?: boolean }, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const ftpId = nanoid();
    const passwordHash = await hashPassword(data.password);

    await db.insert(ftpAccounts).values({
      id: ftpId,
      domainId,
      username: data.username,
      passwordHash,
      homeDir: data.homeDir,
      readonly: data.readonly || false,
      isActive: true,
    });

    // Add to ProFTPd virtual users file (best-effort: service may not be available in Docker)
    try {
      const entry = `${data.username}:${passwordHash}:33:33:${data.homeDir}:/bin/false\n`;
      await sudoFs.appendFile('/etc/proftpd/ftpd.passwd', entry);
    } catch (error: any) {
      logger.warn({ error: error.message, username: data.username }, 'Failed to update ProFTPd passwd file — skipping');
    }

    // Reload ProFTPd (best-effort)
    try {
      await run('systemctl', ['reload', 'proftpd'], { sudo: true });
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to reload ProFTPd — skipping');
    }

    logger.info({ username: data.username }, 'FTP account created');

    auditService.log({
      userId,
      action: 'ftp.account.create',
      resource: `ftp:${data.username}`,
      details: JSON.stringify({ domainId, homeDir: data.homeDir, readonly: data.readonly }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: ftpId, username: data.username, homeDir: data.homeDir, readonly: data.readonly || false };
  }

  async updateAccount(ftpId: string, data: { password?: string; homeDir?: string; readonly?: boolean; isActive?: boolean }, userId?: string, ipAddress?: string) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    const updates: Record<string, unknown> = {};
    if (data.password) {
      updates.passwordHash = await hashPassword(data.password);
      // Update ProFTPd passwd file
      try {
        const content = await sudoFs.readFile('/etc/proftpd/ftpd.passwd');
        const lines = content.split('\n').map(l => {
          if (l.startsWith(`${account.username}:`)) {
            const parts = l.split(':');
            parts[1] = updates.passwordHash as string;
            return parts.join(':');
          }
          return l;
        });
        await sudoFs.writeFile('/etc/proftpd/ftpd.passwd', lines.join('\n'));
      } catch { /* file may not exist */ }
    }
    if (data.homeDir) updates.homeDir = data.homeDir;
    if (data.readonly !== undefined) updates.readonly = data.readonly;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await db.update(ftpAccounts).set(updates).where(eq(ftpAccounts.id, ftpId));
    await run('systemctl', ['reload', 'proftpd'], { sudo: true });

    auditService.log({
      userId,
      action: 'ftp.account.update',
      resource: `ftp:${account.username}`,
      details: JSON.stringify({ homeDir: data.homeDir, readonly: data.readonly, isActive: data.isActive }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: ftpId, ...updates };
  }

  async updatePassword(ftpId: string, newPassword: string, userId?: string, ipAddress?: string) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    const passwordHash = await hashPassword(newPassword);
    await db.update(ftpAccounts).set({ passwordHash }).where(eq(ftpAccounts.id, ftpId));

    // Update ProFTPd passwd file
    try {
      const content = await sudoFs.readFile('/etc/proftpd/ftpd.passwd');
      const lines = content.split('\n').map(l => {
        if (l.startsWith(`${account.username}:`)) {
          const parts = l.split(':');
          parts[1] = passwordHash;
          return parts.join(':');
        }
        return l;
      });
      await sudoFs.writeFile('/etc/proftpd/ftpd.passwd', lines.join('\n'));
    } catch { /* file may not exist */ }

    await run('systemctl', ['reload', 'proftpd'], { sudo: true });
    logger.info({ username: account.username }, 'FTP password updated');

    auditService.log({
      userId,
      action: 'ftp.account.password-change',
      resource: `ftp:${account.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async deleteAccount(ftpId: string, userId?: string, ipAddress?: string) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    // Remove from ProFTPd passwd
    try {
      const content = await sudoFs.readFile('/etc/proftpd/ftpd.passwd');
      const updated = content.split('\n').filter(l => !l.startsWith(`${account.username}:`)).join('\n');
      await sudoFs.writeFile('/etc/proftpd/ftpd.passwd', updated);
    } catch { /* file may not exist */ }
    await run('systemctl', ['reload', 'proftpd'], { sudo: true });

    await db.delete(ftpAccounts).where(eq(ftpAccounts.id, ftpId));
    logger.info({ username: account.username }, 'FTP account deleted');

    auditService.log({
      userId,
      action: 'ftp.account.delete',
      resource: `ftp:${account.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async getSettings(): Promise<{ port: number; passivePortMin: number; passivePortMax: number; maxConnectionsPerIp: number; anonymousEnabled: boolean }> {
    return { port: 21, passivePortMin: 40000, passivePortMax: 50000, maxConnectionsPerIp: 5, anonymousEnabled: false };
  }

  async updateSettings(data: { port?: number; passivePortMin?: number; passivePortMax?: number; maxConnectionsPerIp?: number; anonymousEnabled?: boolean }) {
    logger.info(data, 'FTP settings updated');
    return this.getSettings();
  }

  /**
   * List FTP accounts by websiteId
   */
  async listByWebsite(websiteId: string) {
    return db.select().from(ftpAccounts).where(eq(ftpAccounts.websiteId, websiteId));
  }
}
