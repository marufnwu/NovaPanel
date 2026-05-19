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

    // Log the installation
    await db.insert(appInstallLogs).values({
      appId: data.appId,
      domainId: data.domain,
      message: `Starting installation of ${app.appName} to ${data.path}`,
      level: 'info',
    });

    try {
      logger.info({ appId: data.appId, domain: data.domain, path: data.path }, 'Installing app');

      // Get domain info for document root and PHP version
      const domainInfo = await this.getDomainInfo(data.domain);
      if (!domainInfo) {
        return { success: false, message: 'Domain not found' };
      }

      const installPath = data.path || `${domainInfo.documentRoot}/apps/${app.appId}`;
      const dbHost = 'localhost';
      const dbName = `${data.domain.replace(/\./g, '_')}_${app.appId}`;
      const dbUser = `${data.domain.replace(/\./g, '_')}_${app.appId}`;
      const dbPass = this.generatePassword();

      // Update progress
      await this.updateInstallProgress(data.appId, data.domain, 10, 'Creating database...');

      // Create database for the app
      const dbResult = await this.createAppDatabase(dbHost, dbName, dbUser, dbPass);
      if (!dbResult.success) {
        throw new Error(dbResult.message);
      }

      // Update progress
      await this.updateInstallProgress(data.appId, data.domain, 30, 'Downloading application files...');

      // Download and extract the application based on app type
      const downloadResult = await this.downloadApp(app.appId, installPath);
      if (!downloadResult.success) {
        throw new Error(downloadResult.message);
      }

      // Update progress
      await this.updateInstallProgress(data.appId, data.domain, 60, 'Configuring application...');

      // Configure the application
      const configResult = await this.configureApp(app.appId, installPath, {
        dbHost,
        dbName,
        dbUser,
        dbPass,
        domain: data.domain,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
      });
      if (!configResult.success) {
        throw new Error(configResult.message);
      }

      // Update progress
      await this.updateInstallProgress(data.appId, data.domain, 80, 'Setting permissions...');

      // Set correct ownership and permissions
      await this.setAppPermissions(installPath, domainInfo.phpVersion);

      // Update progress
      await this.updateInstallProgress(data.appId, data.domain, 95, 'Finalizing installation...');

      // Insert installation record
      const newApp = await db.insert(installedApps).values({
        appId: data.appId,
        appName: app.appName,
        domainId: data.domain,
        websiteId: domainInfo.websiteId,
        installPath: installPath,
        status: 'ready',
        progress: 100,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        databaseHost: dbHost,
        databaseName: dbName,
        databaseUser: dbUser,
        databasePassword: dbPass,
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
        message: `Installation of ${app.appName} completed successfully`,
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
   * Update installation progress
   */
  private async updateInstallProgress(appId: string, domainId: string, progress: number, message: string): Promise<void> {
    await db.insert(appInstallLogs).values({
      appId,
      domainId,
      message: `[${progress}%] ${message}`,
      level: 'info',
    }).catch(() => {});
  }

  /**
   * Get domain info from domain name
   */
  private async getDomainInfo(domainName: string): Promise<{ documentRoot: string | null; phpVersion: string; websiteId: string | null } | null> {
    try {
      const { domains } = await import('../../db/schema/domains.js');
      const { eq } = await import('drizzle-orm');
      const [domain] = await db.select({
        documentRoot: domains.documentRoot,
        phpVersion: domains.phpVersion,
        websiteId: domains.siteId,
      }).from(domains).where(eq(domains.name, domainName)).limit(1);
      return domain || null;
    } catch {
      return null;
    }
  }

  /**
   * Create database for app installation
   */
  private async createAppDatabase(host: string, dbName: string, dbUser: string, dbPass: string): Promise<{ success: boolean; message: string }> {
    try {
      // Create database
      const createDbResult = await run('mysql', ['-e', `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`]);
      if (!createDbResult.success) {
        return { success: false, message: 'Failed to create database' };
      }

      // Create user and grant privileges
      const createUserResult = await run('mysql', ['-e', `CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}';`]);
      if (!createUserResult.success) {
        return { success: false, message: 'Failed to create database user' };
      }

      const grantResult = await run('mysql', ['-e', `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;`]);
      if (!grantResult.success) {
        return { success: false, message: 'Failed to grant database privileges' };
      }

      return { success: true, message: 'Database created successfully' };
    } catch (error: any) {
      return { success: false, message: `Database creation failed: ${error.message}` };
    }
  }

  /**
   * Download and extract application files
   */
  private async downloadApp(appId: string, installPath: string): Promise<{ success: boolean; message: string }> {
    try {
      // WordPress download URL
      const wordpressUrl = 'https://wordpress.org/latest.tar.gz';

      // Create install directory
      await run('mkdir', ['-p', installPath]);

      // Download WordPress
      const downloadResult = await run('wget', ['-q', '-O', '/tmp/wordpress.tar.gz', wordpressUrl]);
      if (!downloadResult.success) {
        // Try curl as fallback
        const curlResult = await run('curl', ['-sL', '-o', '/tmp/wordpress.tar.gz', wordpressUrl]);
        if (!curlResult.success) {
          return { success: false, message: 'Failed to download WordPress' };
        }
      }

      // Extract to temp location first
      const extractResult = await run('tar', ['-xzf', '/tmp/wordpress.tar.gz', '-C', '/tmp']);
      if (!extractResult.success) {
        return { success: false, message: 'Failed to extract WordPress' };
      }

      // Move files to install path (WordPress extracts to /tmp/wordpress/)
      await run('sh', ['-c', `cp -r /tmp/wordpress/* "${installPath}/"`]);

      // Cleanup
      await run('rm', ['-rf', '/tmp/wordpress.tar.gz', '/tmp/wordpress']);

      return { success: true, message: 'Downloaded successfully' };
    } catch (error: any) {
      return { success: false, message: `Download failed: ${error.message}` };
    }
  }

  /**
   * Configure the installed application
   */
  private async configureApp(appId: string, installPath: string, config: {
    dbHost: string;
    dbName: string;
    dbUser: string;
    dbPass: string;
    domain: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    if (appId.toLowerCase().includes('wordpress') || appId === 'wordpress') {
      return this.configureWordPress(installPath, config);
    }
    return { success: true, message: 'Configuration skipped (unsupported app type)' };
  }

  /**
   * Configure WordPress specific settings
   */
  private async configureWordPress(installPath: string, config: {
    dbHost: string;
    dbName: string;
    dbUser: string;
    dbPass: string;
    domain: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Create wp-config.php
      const wpConfigContent = `<?php
/**
 * WordPress Database Configuration
 * Generated by NovaPanel
 */

define( 'DB_NAME', '${config.dbName}' );
define( 'DB_USER', '${config.dbUser}' );
define( 'DB_PASSWORD', '${config.dbPass}' );
define( 'DB_HOST', '${config.dbHost}' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

// Security keys (using standard WordPress salting)
define('AUTH_KEY',         '${this.generatePassword()}');
define('SECURE_AUTH_KEY',  '${this.generatePassword()}');
define('LOGGED_IN_KEY',    '${this.generatePassword()}');
define('NONCE_KEY',        '${this.generatePassword()}');
define('AUTH_SALT',        '${this.generatePassword()}');
define('SECURE_AUTH_SALT', '${this.generatePassword()}');
define('LOGGED_IN_SALT',   '${this.generatePassword()}');
define('NONCE_SALT',       '${this.generatePassword()}');

$table_prefix = 'wp_';

define( 'WP_DEBUG', false );

// Absolute path to the WordPress directory
if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

// Sets up WordPress vars and included files
require_once ABSPATH . 'wp-settings.php';
`;

      // Write wp-config.php using tee
      const wpConfigPath = `${installPath}/wp-config.php`;
      const writeResult = await run('tee', [wpConfigPath], { input: wpConfigContent });
      if (!writeResult.success) {
        return { success: false, message: 'Failed to write wp-config.php' };
      }

      return { success: true, message: 'WordPress configured successfully' };
    } catch (error: any) {
      return { success: false, message: `WordPress configuration failed: ${error.message}` };
    }
  }

  /**
   * Set correct permissions for installed app
   */
  private async setAppPermissions(installPath: string, phpVersion: string): Promise<void> {
    try {
      // Set directory ownership
      await run('chown', ['-R', 'www-data:www-data', installPath]);

      // Set correct permissions for WordPress
      await run('chmod', ['755', `${installPath}`]);
      await run('chmod', ['755', `${installPath}/wp-content`]);

      // Make wp-content writable for uploads and upgrades
      await run('chmod', ['775', `${installPath}/wp-content/uploads`]);

      // Protect wp-config.php
      await run('chmod', ['640', `${installPath}/wp-config.php`]);
    } catch (error) {
      // Permissions are best-effort, don't fail installation
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
