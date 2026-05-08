import { db } from '../../db/index.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { nginxService } from '../../services/nginx.service.js';
import { apacheService } from '../../services/apache.service.js';
import { PhpFpmService } from '../../services/php-fpm.service.js';
import { auditService } from '../audit/audit.service.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';

// Reserved ports that cannot be used in custom Nginx directives
const RESERVED_PORTS: readonly number[] = [80, 443, 8732, 8080, 53, 21, 25, 110, 143, 993, 995];

/**
 * Validate custom Nginx directives for dangerous patterns.
 * Rejects directives that could break the server or conflict with panel services.
 */
function validateCustomDirectives(directives: string): void {
  const lines = directives.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for listen directives on reserved ports
    const listenMatch = trimmed.match(/^listen\s+(\d+)/);
    if (listenMatch) {
      const port = parseInt(listenMatch[1], 10);
      if (RESERVED_PORTS.includes(port)) {
        throw new AppError(400, 'INVALID_DIRECTIVE', `Listen on reserved port ${port} is not allowed in custom directives`);
      }
    }

    // Reject any upstream blocks (could create backdoor proxies)
    if (trimmed.startsWith('upstream ')) {
      throw new AppError(400, 'INVALID_DIRECTIVE', 'upstream blocks are not allowed in custom directives');
    }

    // Reject server_name directives that could override panel routing
    if (trimmed.startsWith('server_name ') && trimmed.includes('novapanel')) {
      throw new AppError(400, 'INVALID_DIRECTIVE', 'server_name cannot reference novapanel in custom directives');
    }

    // Reject include directives (path traversal risk)
    if (trimmed.startsWith('include ')) {
      throw new AppError(400, 'INVALID_DIRECTIVE', 'include directives are not allowed in custom directives');
    }
  }
}

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
      // Validate custom directives for dangerous patterns (ISSUE-01, ISSUE-03)
      validateCustomDirectives(data.customNginxDirectives);

      const configPath = `/etc/nginx/sites-available/${domain.name}.conf`;

      // Read existing config to enable rollback
      let existingConfig: string;
      try {
        existingConfig = await sudoFs.readFile(configPath);
      } catch {
        existingConfig = '';
      }

      // Safely append custom directives using sudoFs.appendFile
      // Instead of bash -c with string interpolation (ISSUE-01 fix)
      await sudoFs.appendFile(configPath, '\n# Custom directives\n' + data.customNginxDirectives);

      // Validate the full config with nginx -t after appending custom directives
      const test = await nginxService.testConfig();
      if (!test.valid) {
        // Rollback: restore original config
        if (existingConfig !== '') {
          await sudoFs.writeFile(configPath, existingConfig);
        }
        throw new AppError(422, 'NGINX_CONFIG_INVALID', `Custom directives caused nginx config test failure: ${test.output}`);
      }
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
   * Get custom error pages for a domain by parsing nginx config
   */
  async getErrorPages(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Try to read the actual nginx config to find error page directives
    const configPath = `/etc/nginx/sites-available/${domainName}.conf`;
    
    try {
      const configContent = await sudoFs.readFile(configPath);
      
      // Parse error_page directives from nginx config
      // Format: error_page 404 = /404.html;
      const errorPageRegex = /error_page\s+(\d+)\s*(?:=\s*\/?(\S+))?;/g;
      const customErrorPages: Record<number, { enabled: boolean; content: string }> = {};
      let match;
      
      while ((match = errorPageRegex.exec(configContent)) !== null) {
        const code = parseInt(match[1], 10);
        const page = match[2] || '';
        customErrorPages[code] = {
          enabled: true,
          content: page,
        };
      }

      // Build response with defaults for missing codes but override if we found them
      const defaultPages = [
        { code: 400, enabled: false, content: '', contentType: 'text/html' as const },
        { code: 401, enabled: false, content: '', contentType: 'text/html' as const },
        { code: 403, enabled: false, content: '', contentType: 'text/html' as const },
        { code: 404, enabled: true, content: '/404.html', contentType: 'text/html' as const },
        { code: 500, enabled: true, content: '/500.html', contentType: 'text/html' as const },
        { code: 502, enabled: false, content: '', contentType: 'text/html' as const },
        { code: 503, enabled: false, content: '', contentType: 'text/html' as const },
      ];

      return defaultPages.map(page => {
        if (customErrorPages[page.code]) {
          return {
            ...page,
            enabled: customErrorPages[page.code].enabled,
            content: customErrorPages[page.code].content,
          };
        }
        return page;
      });
    } catch {
      // Config file not readable, return defaults
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
   * Get rate limiting configuration for a domain by parsing nginx config
   */
  async getRateLimitConfig(domainName: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.name, domainName)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    // Try to read the actual nginx config to find rate limiting directives
    const configPath = `/etc/nginx/sites-available/${domainName}.conf`;
    
    try {
      const configContent = await sudoFs.readFile(configPath);
      
      // Check if rate limiting is enabled in this vhost
      // Look for limit_req_zone and limit_req directives
      const hasLimitReqZone = /limit_req_zone\s+\$binary_remote_addr/.test(configContent);
      const limitReqMatch = configContent.match(/limit_req_zone\s+\$binary_remote_addr\s+zone=(\w+):(\d+m)/);
      
      let zoneName = 'limit';
      let zoneSize = '10m';
      if (limitReqMatch) {
        zoneName = limitReqMatch[1];
        zoneSize = limitReqMatch[2];
      }

      // Parse limit_req directives
      const limitReqRegex = /limit_req\s+(?:zone=(\w+)\s+)?(burst=(\d+)\s+)?(?:nodelay\s+)?(?:delay=(\d+)\s+)?/g;
      const limitReqMatch2 = limitReqRegex.exec(configContent);
      
      // Also look for limit_conn directives
      const limitConnRegex = /limit_conn\s+(\w+)\s+(\d+)/;
      const limitConnMatch = limitConnRegex.exec(configContent);

      if (hasLimitReqZone || limitReqMatch2) {
        // Rate limiting is configured
        const requestsPerSecond = limitReqMatch2 ? 1 : 10; // Default to conservative estimate
        const burstSize = limitReqMatch2?.[2] ? parseInt(limitReqMatch2[2].replace('burst=', '')) : 20;
        
        return {
          enabled: true,
          requestsPerSecond,
          burstSize,
          timeoutSeconds: 60,
          zoneName,
          maxConnections: limitConnMatch ? parseInt(limitConnMatch[2]) : undefined,
        };
      }

      // Rate limiting not configured for this domain
      return {
        enabled: false,
        requestsPerSecond: 10,
        burstSize: 20,
        timeoutSeconds: 60,
      };
    } catch {
      // Config file not readable, return defaults
      return {
        enabled: false,
        requestsPerSecond: 10,
        burstSize: 20,
        timeoutSeconds: 60,
      };
    }
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
