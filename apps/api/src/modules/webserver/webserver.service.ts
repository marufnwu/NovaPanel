import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nginxService } from '../../services/nginx.service.js';
import { apacheService } from '../../services/apache.service.js';
import { PhpFpmService } from '../../services/php-fpm.service.js';
import { auditService } from '../audit/audit.service.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';

export class WebServerService {
  // ---------------------------------------------------------------------------
  // Website-scoped config methods (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Apply the full web server configuration for a website:
   * 1. Generate nginx config (one server block per attached domain)
   * 2. Generate PHP-FPM pool for the website
   * 3. Both are tested before reload — if nginx -t fails nothing is reloaded
   */
  async applyWebsiteConfig(websiteId: string): Promise<void> {
    logger.info({ websiteId }, 'Applying website config (nginx + PHP-FPM)');

    // Generate nginx config (includes test + reload internally)
    await nginxService.generateWebsiteConfig(websiteId);

    // Generate PHP-FPM pool (includes reload internally)
    await PhpFpmService.generateWebsitePool(websiteId);

    logger.info({ websiteId }, 'Website config applied successfully');
  }

  /**
   * Remove the full web server configuration for a website:
   * 1. Remove nginx config file
   * 2. Remove PHP-FPM pool file
   * 3. Reload both services
   */
  async removeWebsiteConfig(websiteId: string): Promise<void> {
    logger.info({ websiteId }, 'Removing website config (nginx + PHP-FPM)');

    // Remove nginx config (includes reload internally)
    await nginxService.removeWebsiteConfig(websiteId);

    // Remove PHP-FPM pool (includes reload internally)
    await PhpFpmService.removeWebsitePool(websiteId);

    logger.info({ websiteId }, 'Website config removed successfully');
  }

  // ---------------------------------------------------------------------------
  // Domain-level config methods (legacy)
  // ---------------------------------------------------------------------------

  /**
   * Get current web server config for a domain (by ID)
   */
  async getConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    return {
      domainId: domain.id,
      domain: domain.name,
      webServer: domain.webServer,
      phpVersion: domain.phpVersion,
      phpHandler: domain.phpHandler,
      ssl: domain.sslEnabled,
      documentRoot: domain.documentRoot,
      redirectHttpToHttps: domain.redirectHttpToHttps,
      hsts: domain.hsts,
      // These would come from a separate config store in production
      // For now, return defaults
      gzipEnabled: true,
      browserCachingEnabled: true,
      staticFileExpiryDays: 30,
      hotlinkProtection: false,
      hotlinkAllowedDomains: '',
      directoryBrowsing: false,
      ipRestrictionMode: 'allow_all' as const,
      ipList: '',
      reverseProxyEnabled: false,
      reverseProxyTarget: '',
      maxUploadSizeMb: 64,
      customNginxDirectives: '',
      customApacheDirectives: '',
    };
  }

  /**
   * Get current web server config for a domain (by name)
   */
  async getConfigByName(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return this.getConfig(domain.id);
  }

  /**
   * Update web server configuration for a domain (by ID)
   */
  async updateConfig(domainId: string, userId: string | undefined, data: {
    webServer?: string;
    gzipEnabled?: boolean;
    browserCachingEnabled?: boolean;
    staticFileExpiryDays?: number;
    hotlinkProtection?: boolean;
    hotlinkAllowedDomains?: string;
    directoryBrowsing?: boolean;
    ipRestrictionMode?: string;
    ipList?: string;
    reverseProxyEnabled?: boolean;
    reverseProxyTarget?: string;
    maxUploadSizeMb?: number;
    customNginxDirectives?: string;
    customApacheDirectives?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const webServer = data.webServer || domain.webServer;

    // Regenerate Nginx vhost with new settings
    await nginxService.removeVhost(domain.name).catch(() => {});
    await nginxService.addVhost({
      domain: domain.name,
      documentRoot: domain.documentRoot,
      phpVersion: domain.phpVersion,
      redirectHttpToHttps: domain.redirectHttpToHttps,
      hsts: domain.hsts,
      aliases: [`www.${domain.name}`],
    });

    // Append custom directives if provided
    if (data.customNginxDirectives) {
      const { run } = await import('../../services/executor.js');
      const configPath = `/etc/nginx/sites-available/${domain.name}.conf`;
      await run('bash', ['-c', `echo '${data.customNginxDirectives.replace(/'/g, "'\\''")}' >> ${configPath}`], { sudo: true });
    }

    // Update DB if webServer changed
    if (data.webServer) {
      await db.update(domains).set({ webServer: data.webServer as any }).where(eq(domains.id, domainId));
    }

    // Audit log
    if (userId) {
      await auditService.log({
        userId,
        action: 'webserver.config.update',
        resource: domain.name,
        details: JSON.stringify(data),
      });
    }

    return this.getConfig(domainId);
  }

  /**
   * Update web server configuration for a domain (by name)
   */
  async updateConfigByName(domainName: string, userId: string | undefined, data: any) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return this.updateConfig(domain.id, userId, data);
  }

  /**
   * Get the rendered Nginx config for preview
   */
  async previewConfig(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Read the actual config file
    const configPath = `/etc/nginx/sites-available/${domain.name}.conf`;
    try {
      const { run } = await import('../../services/executor.js');
      const result = await run('cat', [configPath], { sudo: true });
      return {
        domain: domain.name,
        server: 'nginx',
        config: result.stdout,
      };
    } catch {
      return {
        domain: domain.name,
        server: 'nginx',
        config: '# Config file not found or not readable',
      };
    }
  }

  /**
   * Test config validity
   */
  async testConfig(_domainId: string) {
    const nginxTest = await nginxService.testConfig();
    return { nginx: nginxTest };
  }

  /**
   * Get list of all domains for the domain selector
   */
  async listDomains() {
    return db.select({
      id: domains.id,
      name: domains.name,
      webServer: domains.webServer,
      status: domains.status,
    }).from(domains);
  }

  /**
   * Get custom error pages for a domain
   */
  async getErrorPages(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Return default error pages — real implementation would read from config files
    return [
      { code: 400, enabled: false, content: '', contentType: 'text/html' as const },
      { code: 401, enabled: false, content: '', contentType: 'text/html' as const },
      { code: 403, enabled: false, content: '', contentType: 'text/html' as const },
      { code: 404, enabled: true, content: '<h1>404 - Page Not Found</h1>', contentType: 'text/html' as const },
      { code: 500, enabled: true, content: '<h1>500 - Internal Server Error</h1>', contentType: 'text/html' as const },
      { code: 502, enabled: false, content: '', contentType: 'text/html' as const },
      { code: 503, enabled: false, content: '', contentType: 'text/html' as const },
    ];
  }

  /**
   * Update custom error pages for a domain
   */
  async updateErrorPages(domainName: string, errorPages: Array<{ code: number; enabled: boolean; content: string; contentType: string }>, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // In a real implementation, this would write error page files and update nginx config
    if (userId) {
      await auditService.log({
        userId,
        action: 'webserver.error-pages.update',
        resource: domainName,
        details: `Updated ${errorPages.length} error pages`,
      });
    }

    return { success: true, errorPages };
  }

  /**
   * Get rate limiting configuration for a domain
   */
  async getRateLimitConfig(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Return default config — real implementation would read from nginx config
    return {
      enabled: false,
      requestsPerSecond: 10,
      burstSize: 20,
      timeoutSeconds: 60,
    };
  }

  /**
   * Update rate limiting configuration for a domain
   */
  async updateRateLimitConfig(domainName: string, data: {
    enabled?: boolean;
    requestsPerSecond?: number;
    burstSize?: number;
    timeoutSeconds?: number;
  }, userId?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // In a real implementation, this would update nginx config with rate limiting directives
    if (userId) {
      await auditService.log({
        userId,
        action: 'webserver.rate-limit.update',
        resource: domainName,
        details: JSON.stringify(data),
      });
    }

    return {
      enabled: data.enabled ?? false,
      requestsPerSecond: data.requestsPerSecond ?? 10,
      burstSize: data.burstSize ?? 20,
      timeoutSeconds: data.timeoutSeconds ?? 60,
    };
  }
}
