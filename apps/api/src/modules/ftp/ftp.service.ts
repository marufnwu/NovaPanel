import { db } from '../../db/index.js';
import { ftpAccounts } from '../../db/schema/ftp.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class FtpService {
  async listAccounts(domainId: string) {
    return db.select().from(ftpAccounts).where(eq(ftpAccounts.siteId, domainId));
  }

  async getAccount(ftpId: string) {
    const [account] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!account) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');
    return account;
  }

  async createAccount(domainId: string, data: { username: string; password: string; homeDir: string; readonly?: boolean }, userId?: string, ipAddress?: string) {
    const [account] = await db.insert(ftpAccounts).values({
      id: nanoid(),
      projectId: 'default',
      siteId: domainId,
      username: data.username,
      password: data.password,
      homeDir: data.homeDir,
      status: 'active',
    }).returning();

    auditService.log({ userId, action: 'ftp.account.create', resource: `ftp:${data.username}`, ipAddress }).catch(() => {});
    return account;
  }

  async updateAccount(ftpId: string, data: { password?: string; homeDir?: string; readonly?: boolean; isActive?: boolean }, userId?: string, ipAddress?: string) {
    const [existing] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!existing) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    const updateData: Record<string, unknown> = {};
    if (data.homeDir !== undefined) updateData.homeDir = data.homeDir;
    if (data.isActive !== undefined) updateData.status = data.isActive ? 'active' : 'suspended';
    if (data.password) updateData.password = data.password;

    const [updated] = await db.update(ftpAccounts).set(updateData).where(eq(ftpAccounts.id, ftpId)).returning();
    auditService.log({ userId, action: 'ftp.account.update', resource: `ftp:${existing.username}`, ipAddress }).catch(() => {});
    return updated;
  }

  async updatePassword(ftpId: string, newPassword: string, userId?: string, ipAddress?: string) {
    const [existing] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!existing) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    await db.update(ftpAccounts).set({ password: newPassword }).where(eq(ftpAccounts.id, ftpId));
    auditService.log({ userId, action: 'ftp.password.update', resource: `ftp:${existing.username}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async deleteAccount(ftpId: string, userId?: string, ipAddress?: string) {
    const [existing] = await db.select().from(ftpAccounts).where(eq(ftpAccounts.id, ftpId)).limit(1);
    if (!existing) throw new AppError(404, 'FTP_NOT_FOUND', 'FTP account not found');

    await db.delete(ftpAccounts).where(eq(ftpAccounts.id, ftpId));
    auditService.log({ userId, action: 'ftp.account.delete', resource: `ftp:${existing.username}`, ipAddress }).catch(() => {});
    return { success: true };
  }

  async getSettings() {
    return { port: 21, passivePortMin: 40000, passivePortMax: 50000, maxConnectionsPerIp: 5, anonymousEnabled: false };
  }

  async updateSettings(data: { port?: number; passivePortMin?: number; passivePortMax?: number; maxConnectionsPerIp?: number; anonymousEnabled?: boolean }) {
    logger.info(data, 'FTP settings updated');
    return this.getSettings();
  }

  async listByWebsite(websiteId: string) {
    return db.select().from(ftpAccounts).where(eq(ftpAccounts.siteId, websiteId));
  }
}

export const ftpService = new FtpService();