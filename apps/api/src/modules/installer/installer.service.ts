import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { nanoid } from 'nanoid';

const AVAILABLE_APPS: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  phpVersion?: string;
  requirements: string[];
  installCommand: string;
  installPath: string;
  configFiles: string[];
  adminPath?: string;
  adminUrlPattern?: string;
  needsDatabase?: boolean;
}> = [
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'World\'s most popular CMS for blogging and websites',
    category: 'cms',
    phpVersion: '8.1',
    requirements: ['php', 'mysql', 'mod_rewrite'],
    installCommand: 'wp core install',
    installPath: '/var/www/wordpress',
    configFiles: ['wp-config.php'],
    adminPath: '/wp-admin',
    adminUrlPattern: '/wp-admin/install.php',
    needsDatabase: true,
  },
  {
    id: 'wordpress-theme',
    name: 'WordPress Theme',
    description: 'Install a WordPress theme from repository',
    category: 'cms',
    phpVersion: '8.1',
    requirements: ['php'],
    installCommand: 'wp theme install',
    installPath: '/var/www/html/wp-content/themes',
    configFiles: [],
    needsDatabase: false,
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    description: 'Self-hosted cloud storage and collaboration platform',
    category: 'productivity',
    requirements: ['php', 'mysql', 'redis'],
    installCommand: 'occ maintenance:install',
    installPath: '/var/www/nextcloud',
    configFiles: ['config.php'],
    adminPath: '/settings/admin',
    adminUrlPattern: '/settings/admin',
    needsDatabase: true,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    description: 'Professional publishing platform for blogs',
    category: 'blogging',
    requirements: ['nodejs', 'mysql'],
    installCommand: 'ghost install',
    installPath: '/var/www/ghost',
    configFiles: ['config.production.json'],
    adminPath: '/ghost',
    adminUrlPattern: '/ghost',
    needsDatabase: true,
  },
  {
    id: 'laravel',
    name: 'Laravel',
    description: 'PHP framework for web artisans',
    category: 'framework',
    phpVersion: '8.2',
    requirements: ['php', 'composer'],
    installCommand: 'composer create-project laravel/laravel',
    installPath: '/var/www/html',
    configFiles: ['.env'],
    adminPath: '/admin',
    needsDatabase: true,
  },
  {
    id: 'strapi',
    name: 'Strapi',
    description: 'Headless CMS for building APIs',
    category: 'cms',
    requirements: ['nodejs', 'postgresql'],
    installCommand: 'npx create-strapi-app',
    installPath: '/var/www/strapi',
    configFiles: ['.env'],
    adminPath: '/admin',
    adminUrlPattern: '/admin',
    needsDatabase: true,
  },
  {
    id: 'ghost-theme',
    name: 'Ghost Theme',
    description: 'Install a Ghost theme from repository',
    category: 'blogging',
    requirements: ['nodejs'],
    installCommand: 'ghost theme install',
    installPath: '/var/www/ghost/content/themes',
    configFiles: [],
    needsDatabase: false,
  },
  {
    id: 'craftcms',
    name: 'Craft CMS',
    description: 'Flexible and powerful CMS',
    category: 'cms',
    phpVersion: '8.2',
    requirements: ['php', 'mysql'],
    installCommand: './craft setup/install',
    installPath: '/var/www/craft',
    configFiles: ['composer.json'],
    adminPath: '/admin',
    adminUrlPattern: '/admin',
    needsDatabase: true,
  },
];

interface InstalledAppRecord {
  id: string;
  appId: string;
  appName: string;
  siteId: string | null;
  domainId: string | null;
  domain: string | null;
  installPath: string | null;
  status: string;
  progress: number | null;
  adminEmail: string | null;
  adminPassword: string | null;
  adminUrl: string | null;
  databaseHost: string | null;
  databaseName: string | null;
  databaseUser: string | null;
  databasePassword: string | null;
  installedAt: string | null;
  updatedAt: string | null;
  createdAt: string;
}

export class InstallerService {
  async getAvailableApps() {
    return AVAILABLE_APPS;
  }

  async getApp(appId: string) {
    return AVAILABLE_APPS.find(a => a.id === appId) || null;
  }

  async installApp(
    appId: string,
    siteId: string,
    domainId: string,
    path: string,
    adminEmail: string,
    adminPassword: string,
    _userId?: string,
    _ipAddress?: string
  ): Promise<InstalledAppRecord> {
    const app = AVAILABLE_APPS.find(a => a.id === appId);
    if (!app) throw new Error(`App ${appId} not found`);

    const record: InstalledAppRecord = {
      id: nanoid(),
      appId,
      appName: app.name,
      siteId,
      domainId,
      domain: null,
      installPath: path,
      status: 'installing',
      progress: 0,
      adminEmail,
      adminPassword,
      adminUrl: null,
      databaseHost: null,
      databaseName: null,
      databaseUser: null,
      databasePassword: null,
      installedAt: null,
      updatedAt: null,
      createdAt: new Date().toISOString(),
    };

    return record;
  }

  async getInstalledApps(siteId?: string) {
    return [];
  }

  async getInstalledApp(installId: string) {
    return null;
  }

  async uninstallApp(_installId: string, _userId?: string, _ipAddress?: string) {
    return { success: true };
  }

  async updateApp(_installId: string, _userId?: string, _ipAddress?: string) {
    return { success: true };
  }

  async getInstallLogs(_installId: string, _limit?: number) {
    return [];
  }

  async getAppConfigs(_installId: string) {
    return [];
  }

  async setAppConfig(_installId: string, _configKey: string, _configValue: string, _userId?: string, _ipAddress?: string) {
    return { success: true };
  }

  async deleteAppConfig(_installId: string, _configKey: string, _userId?: string, _ipAddress?: string) {
    return { success: true };
  }

  async checkPath(_path: string) {
    return { exists: false, isEmpty: true, files: [] };
  }

  async getPostInstallChecklist(_installId: string) {
    return {
      appInstalled: true,
      databaseConfigured: true,
      adminUrl: null,
      sslConfigured: false,
      backupsConfigured: false,
    };
  }
}

export const installerService = new InstallerService();