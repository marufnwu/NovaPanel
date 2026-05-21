import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { AppError } from '../../errors.js';

export class InstallerService {
  async getAvailableApps() {
    return [];
  }

  async getApp(_appId: string) {
    return null;
  }

  async installApp(_appId: string, _siteId: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'App installation requires installed-apps schema - not available in v5 schema');
  }

  async uninstallApp(_installId: string, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'App uninstallation requires installed-apps schema - not available in v5 schema');
  }

  async getInstallLogs(_installId: string) {
    return [];
  }

  async updateAppConfig(_installId: string, _config: Record<string, any>, _userId?: string, _ipAddress?: string) {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'App config requires installed-apps schema - not available in v5 schema');
  }
}

export const installerService = new InstallerService();