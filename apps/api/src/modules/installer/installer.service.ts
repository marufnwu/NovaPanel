import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { installedApps, appInstallLogs, appConfigurations } from '../../db/schema/installed-apps.js';
import { logger } from '../../config/logger.js';
import { run } from '../../services/executor.js';
import { AppError } from '../../errors.js';

type InstalledApp = typeof installedApps.$inferSelect;

export class InstallerService {
  /**
   * Get list of available applications
   */
  async getAvailableApps(): Promise<InstalledApp[]> {
    const apps = await db.select().from(installedApps);
    return apps;
  }

  /**
   * Get app by ID
   */
  async getApp(appId: string): Promise<InstalledApp | undefined> {
    const [app] = await db
      .select()
      .from(installedApps)
      .where(eq(installedApps.appId, appId))
      .limit(1);
    return app;
  }

  /**
   * Install an application
   */
  async installApp(data: {
    appId: string;
    domain: string;
    path: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<{ success: boolean; message: string; installedId?: string }> {
    const app = await this.getApp(data.appId);
    if (!app) {
      return { success: false, message: 'App not found' };
    }

    const installedId = data.path || app.installPath;

    // Log the installation
    await db.insert(appInstallLogs).values({
      appId: data.appId,
      domainId: data.domain,
      message: `Starting installation of ${app.appName} to ${data.path}`,
      level: 'info',
    });

    try {
      // In a real implementation, this would:
      // 1. Create database if needed
      // 2. Download and extract the app
      // 3. Configure the app (database credentials, domain, etc.)
      // 4. Set up nginx/apache vhost
      // 5. Run any setup scripts (wp-cli, composer, etc.)

      logger.info({ appId: data.appId, domain: data.domain, path: data.path }, 'Installing app');

      // Simulate installation for now
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Insert installation record
      const newApp = await db.insert(installedApps).values({
        appId: data.appId,
        appName: app.appName,
        domainId: data.domain,
        installPath: installedId,
        status: 'ready',
        progress: 100,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        databaseHost: data.domain ? `${data.domain}.localhost` : 'localhost',
        databaseName: `${app.appName}_db`,
        databaseUser: data.domain ? `${data.domain}_db` : 'root',
        databasePassword: this.generatePassword(),
        installedAt: new Date(),
      }).returning();

      // Log completion
      await db.insert(appInstallLogs).values({
        appId: data.appId,
        domainId: data.domain,
        message: `Installation of ${app.appName} completed successfully`,
        level: 'info',
      });

      return {
        success: true,
        message: `Installation of ${app.appName} started. This may take a few minutes.`,
        installedId: newApp[0]?.id?.toString(),
      };
    } catch (error: any) {
      logger.error({ error, appId: data.appId }, 'Installation failed');

      await db.insert(appInstallLogs).values({
        appId: data.appId,
        domainId: data.domain,
        message: `Installation failed: ${error.message}`,
        level: 'error',
      });

      return {
        success: false,
        message: `Installation failed: ${error.message}`,
      };
    }
  }

  /**
   * Check installation status
   */
  async getInstallStatus(installedId: string): Promise<{
    status: 'installing' | 'ready' | 'error';
    progress?: number;
    message?: string;
  }> {
    const numericId = Number(installedId);
    if (isNaN(numericId) || numericId <= 0) {
      return {
        status: 'error',
        message: 'Invalid app ID: must be a positive number',
      };
    }

    try {
      const [app] = await db
        .select()
        .from(installedApps)
        .where(eq(installedApps.id, numericId))
        .limit(1);

      if (!app) {
        return {
          status: 'error',
          message: 'App not found',
        };
      }

      // In a real implementation, this would check actual installation logs
      return {
        status: app.status as any,
        progress: app.progress || 100,
        message: app.status === 'ready' ? 'Installation complete' : 'Installation in progress',
      };
    } catch (error: any) {
      logger.error({ error: error.message, installedId }, 'Failed to get install status');
      return {
        status: 'error',
        message: `Failed to get status: ${error.message}`,
      };
    }
  }

  /**
   * Uninstall an app
   */
  async uninstallApp(installedId: string): Promise<{ success: boolean; message: string }> {
    const numericId = Number(installedId);
    if (isNaN(numericId) || numericId <= 0) {
      return { success: false, message: 'Invalid app ID: must be a positive number' };
    }

    try {
      const [app] = await db
        .select()
        .from(installedApps)
        .where(eq(installedApps.id, numericId))
        .limit(1);

      if (!app) {
        return { success: false, message: 'App not found' };
      }

      logger.info({ installedId }, 'Uninstalling app');

      // In a real implementation, this would:
      // 1. Drop database if exists
      // 2. Remove nginx/apache vhost
      // 3. Remove files from install path
      // 4. Run any cleanup scripts

      await db.delete(installedApps).where(eq(installedApps.id, numericId));

      return {
        success: true,
        message: 'App uninstalled successfully',
      };
    } catch (error: any) {
      logger.error({ error: error.message, installedId }, 'Failed to uninstall app');
      return { success: false, message: `Failed to uninstall: ${error.message}` };
    }
  }

  /**
   * Update an app
   */
  async updateApp(installedId: string): Promise<{ success: boolean; message: string }> {
    const numericId = Number(installedId);
    if (isNaN(numericId) || numericId <= 0) {
      return { success: false, message: 'Invalid app ID: must be a positive number' };
    }

    try {
      const [app] = await db
        .select()
        .from(installedApps)
        .where(eq(installedApps.id, numericId))
        .limit(1);

      if (!app) {
        return { success: false, message: 'App not found' };
      }

      logger.info({ installedId }, 'Updating app');

      // In a real implementation, this would:
      // 1. Run update commands (wp-cli upgrade, composer update, etc.)
      // 2. Update configuration

      await db.update(installedApps)
        .set({ updatedAt: new Date() })
        .where(eq(installedApps.id, numericId));

      return {
        success: true,
        message: 'App update started',
      };
    } catch (error: any) {
      logger.error({ error: error.message, installedId }, 'Failed to update app');
      return { success: false, message: `Failed to update: ${error.message}` };
    }
  }

  /**
   * Get installation logs for an app
   */
  async getInstallLogs(appId: string, limit: number = 50): Promise<any[]> {
    const logs = await db
      .select()
      .from(appInstallLogs)
      .where(eq(appInstallLogs.appId, appId))
      .orderBy(desc(appInstallLogs.createdAt))
      .limit(limit);

    return logs;
  }

  /**
   * Get all installed apps
   */
  async getInstalledApps(): Promise<InstalledApp[]> {
    const apps = await db
      .select()
      .from(installedApps)
      .orderBy(desc(installedApps.installedAt));

    return apps;
  }

  /**
   * Set app configuration
   */
  async setAppConfig(installedId: string, configKey: string, configValue: string): Promise<{ success: boolean; message: string }> {
    const [app] = await db
      .select()
      .from(installedApps)
      .where(eq(installedApps.id, Number(installedId)))
      .limit(1);

    if (!app) {
      return { success: false, message: 'App not found' };
    }

    await db.insert(appConfigurations).values({
      appId: app.appId,
      configKey,
      configValue,
      updatedAt: new Date(),
    });

    return {
      success: true,
      message: 'Configuration saved',
    };
  }

  /**
   * Get app configuration
   */
  async getAppConfig(installedId: string): Promise<any[]> {
    const configs = await db
      .select()
      .from(appConfigurations)
      .where(eq(appConfigurations.appId, installedId));

    return configs;
  }

  /**
   * Delete app configuration
   */
  async deleteAppConfig(installedId: string, configKey: string): Promise<{ success: boolean; message: string }> {
    await db
      .delete(appConfigurations)
      .where(and(
        eq(appConfigurations.appId, installedId),
        eq(appConfigurations.configKey, configKey)
      ));

    return {
      success: true,
      message: 'Configuration deleted',
    };
  }

  /**
   * Generate a random password
   */
  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * List installed apps by websiteId
   */
  async listByWebsite(websiteId: string): Promise<InstalledApp[]> {
    return db.select().from(installedApps).where(eq(installedApps.websiteId, websiteId));
  }
}

export const installerService = new InstallerService();
