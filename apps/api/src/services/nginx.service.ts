import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import * as sudoFs from './sudo-fs.js';
import { db } from '../db/index.js';
import { websites } from '../db/schema/websites.js';
import { domains } from '../db/schema/domains.js';
import { eq } from 'drizzle-orm';

export interface VhostContext {
  domain: string;
  documentRoot: string;
  phpVersion?: string;
  ssl?: {
    certPath: string;
    keyPath: string;
  };
  aliases?: string[];
  redirectHttpToHttps?: boolean;
  hsts?: boolean;
  upstreamPort?: number; // For Apache backend
}

export class NginxService implements SystemService {
  readonly name = 'nginx';
  readonly displayName = 'Nginx';

  async start(): Promise<void> {
    await run('systemctl', ['start', 'nginx'], { sudo: true });
  }

  async stop(): Promise<void> {
    await run('systemctl', ['stop', 'nginx'], { sudo: true });
  }

  async restart(): Promise<void> {
    await run('systemctl', ['restart', 'nginx'], { sudo: true });
  }

  async reload(): Promise<void> {
    await run('systemctl', ['reload', 'nginx'], { sudo: true });
  }

  async status(): Promise<ServiceInfo> {
    const result = await run('systemctl', ['is-active', 'nginx'], { sudo: true });
    const status: ServiceStatus = result.stdout.trim() === 'active' ? 'running' : 'stopped';
    return { name: this.name, displayName: this.displayName, status };
  }

  async isInstalled(): Promise<boolean> {
    const result = await run('which', ['nginx']);
    return result.success;
  }

  /**
   * Test Nginx configuration syntax without applying
   */
  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await run('nginx', ['-t'], { sudo: true });
    return {
      valid: result.exitCode === 0,
      output: result.stderr, // nginx -t outputs to stderr
    };
  }

  // ---------------------------------------------------------------------------
  // Website-scoped config methods (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Generate a single nginx config file for a website containing one server
   * block per attached domain. The config is written to
   * `/etc/nginx/sites-available/website-{websiteId}.conf` and symlinked into
   * sites-enabled. After writing, nginx -t is run and nginx is reloaded.
   */
  async generateWebsiteConfig(websiteId: string): Promise<void> {
    // 1. Look up website
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new Error(`Website not found: ${websiteId}`);

    // 2. Find all domains attached to this website
    const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, websiteId));

    // 3. Build config — one server block per domain
    let config = `# NovaPanel website config — ${website.name} (${websiteId})\n`;

    if (attachedDomains.length === 0) {
      config += `# No domains attached yet\n`;
    }

    const phpVersion = website.phpHandler !== 'disabled' ? website.phpVersion : undefined;

    for (const domain of attachedDomains) {
      config += '\n';
      config += this.renderVhost({
        domain: domain.name,
        documentRoot: website.documentRoot,
        phpVersion,
        aliases: [`www.${domain.name}`],
      });
    }

    // 4. Write config file
    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;

    await sudoFs.mkdir(env.NGINX_SITES_AVAILABLE);

    // Backup existing config before overwriting (ISSUE-08)
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.bak`;
    try {
      const existing = await sudoFs.readFile(configPath);
      await sudoFs.writeFile(backupPath, existing);
    } catch {
      // No existing config to backup — that's OK
    }

    // Use atomic write to ensure config is never partial (ISSUE-07)
    await sudoFs.atomicWrite(configPath, config);

    // Symlink to sites-enabled
    try {
      await sudoFs.symlink(configPath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    // 5. Test nginx config
    const test = await this.testConfig();
    if (!test.valid) {
      // Rollback — try to restore from backup
      try {
        const backup = await sudoFs.readFile(backupPath);
        await sudoFs.atomicWrite(configPath, backup);
      } catch (restoreError) {
        // Rollback failed — system may be in inconsistent state
        const originalError = `Nginx config test failed for website ${websiteId}: ${test.output}`;
        const restoreFailedMsg = `Rollback also failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}. System may be in an inconsistent state.`;
        throw new Error(`${originalError}; ${restoreFailedMsg}`);
      }
      // Clean up backup file after successful restore
      await sudoFs.unlink(backupPath).catch(() => {});
      throw new Error(`Nginx config test failed for website ${websiteId}: ${test.output}`);
    }

    // Clean up backup file after successful validation
    await sudoFs.unlink(backupPath).catch(() => {});

    // 6. Reload nginx
    await this.reload();
    logger.info({ websiteId, domainCount: attachedDomains.length }, 'Website nginx config generated');
  }

  /**
   * Generate a "suspended" nginx config for a website — all domains return 503.
   * The original config is backed up with a `.active` suffix before overwriting.
   */
  async generateSuspendedConfig(websiteId: string): Promise<void> {
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new Error(`Website not found: ${websiteId}`);

    const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, websiteId));

    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.active`;

    // Backup current config
    try {
      const original = await sudoFs.readFile(configPath);
      await sudoFs.writeFile(backupPath, original);
    } catch {
      // No existing config to backup — that's OK
    }

    // Build suspended config
    let config = `# NovaPanel website SUSPENDED — ${website.name} (${websiteId})\n`;

    for (const domain of attachedDomains) {
      config += `\nserver {\n`;
      config += `    listen 80;\n`;
      config += `    server_name ${domain.name} www.${domain.name};\n`;
      config += `    return 503;\n`;
      config += `    add_header Retry-After "3600";\n`;
      config += `}\n`;
    }

    if (attachedDomains.length === 0) {
      config += `# No domains attached\n`;
    }

    await sudoFs.writeFile(configPath, config);

    try {
      await sudoFs.symlink(configPath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    const test = await this.testConfig();
    if (!test.valid) {
      // Try to restore backup
      try {
        const backup = await sudoFs.readFile(backupPath);
        await sudoFs.writeFile(configPath, backup);
      } catch { /* ignore */ }
      throw new Error(`Nginx config test failed for suspended website ${websiteId}: ${test.output}`);
    }

    await this.reload();
    logger.info({ websiteId }, 'Website nginx suspended config generated');
  }

  /**
   * Remove the nginx config file for a website and reload nginx.
   */
  async removeWebsiteConfig(websiteId: string): Promise<void> {
    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.active`;

    await sudoFs.unlink(enabledPath).catch(() => {});
    await sudoFs.unlink(configPath).catch(() => {});
    await sudoFs.unlink(backupPath).catch(() => {});

    const test = await this.testConfig();
    if (test.valid) {
      await this.reload();
    }
    logger.info({ websiteId }, 'Website nginx config removed');
  }

  /**
   * Test nginx config and reload if valid.
   * Throws if nginx -t fails.
   */
  async reloadNginx(): Promise<void> {
    const test = await this.testConfig();
    if (!test.valid) {
      throw new Error(`Nginx config test failed: ${test.output}`);
    }
    await this.reload();
  }

  // ---------------------------------------------------------------------------
  // Legacy per-domain methods (deprecated — use website-scoped methods instead)
  // ---------------------------------------------------------------------------

  /**
   * @deprecated Use generateWebsiteConfig() instead.
   * Add a virtual host configuration (per-domain).
   */
  async addVhost(context: VhostContext): Promise<void> {
    const config = this.renderVhost(context);
    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${context.domain}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${context.domain}.conf`;

    // Write config to sites-available (via sudo)
    await sudoFs.mkdir(env.NGINX_SITES_AVAILABLE);
    await sudoFs.writeFile(availablePath, config);

    // Symlink to sites-enabled (via sudo)
    try {
      await sudoFs.symlink(availablePath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    // Test and reload
    const test = await this.testConfig();
    if (!test.valid) {
      // Rollback
      await sudoFs.unlink(availablePath).catch(() => {});
      await sudoFs.unlink(enabledPath).catch(() => {});
      throw new Error(`Nginx config test failed: ${test.output}`);
    }

    await this.reload();
    logger.info({ domain: context.domain }, 'Nginx vhost added');
  }

  /**
   * @deprecated Use removeWebsiteConfig() instead.
   * Remove a virtual host configuration (per-domain).
   */
  async removeVhost(domain: string): Promise<void> {
    const availablePath = `${env.NGINX_SITES_AVAILABLE}/${domain}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${domain}.conf`;

    await sudoFs.unlink(enabledPath).catch(() => {});
    await sudoFs.unlink(availablePath).catch(() => {});

    const test = await this.testConfig();
    if (test.valid) {
      await this.reload();
    }
    logger.info({ domain }, 'Nginx vhost removed');
  }

  /**
   * Render Nginx vhost config from template
   */
  private renderVhost(ctx: VhostContext): string {
    const hasSSL = ctx.ssl && ctx.ssl.certPath && ctx.ssl.keyPath;

    let config = '';

    // HTTP server block
    config += `server {\n`;
    config += `    listen 80;\n`;
    config += `    server_name ${ctx.domain}`;
    if (ctx.aliases?.length) {
      config += ` ${ctx.aliases.join(' ')}`;
    }
    config += `;\n\n`;

    if (hasSSL && ctx.redirectHttpToHttps) {
      config += `    return 301 https://$host$request_uri;\n`;
    } else {
      config += `    root ${ctx.documentRoot};\n`;
      config += `    index index.php index.html index.htm;\n\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (ctx.phpVersion) {
        config += this.renderPhpLocation(ctx.phpVersion, ctx.upstreamPort);
      }
    }
    config += `}\n\n`;

    // HTTPS server block
    if (hasSSL) {
      config += `server {\n`;
      config += `    listen 443 ssl http2;\n`;
      config += `    server_name ${ctx.domain}`;
      if (ctx.aliases?.length) {
        config += ` ${ctx.aliases.join(' ')}`;
      }
      config += `;\n\n`;
      config += `    ssl_certificate ${ctx.ssl!.certPath};\n`;
      config += `    ssl_certificate_key ${ctx.ssl!.keyPath};\n`;
      config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
      config += `    ssl_ciphers HIGH:!aNULL:!MD5;\n\n`;
      if (ctx.hsts) {
        config += `    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n\n`;
      }
      config += `    root ${ctx.documentRoot};\n`;
      config += `    index index.php index.html index.htm;\n\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (ctx.phpVersion) {
        config += this.renderPhpLocation(ctx.phpVersion, ctx.upstreamPort);
      }
      config += `}\n`;
    }

    return config;
  }

  private renderPhpLocation(phpVersion: string, upstreamPort?: number): string {
    if (upstreamPort) {
      // Proxy to Apache backend
      return `\n    location ~ \\.php$ {\n    proxy_pass http://127.0.0.1:${upstreamPort};\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    }\n`;
    }
    // PHP-FPM via unix socket
    const socket = `/run/php/php${phpVersion}-fpm.sock`;
    return `\n    location ~ \\.php$ {\n        fastcgi_pass unix:${socket};\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        include fastcgi_params;\n    }\n`;
  }
}

export const nginxService = new NginxService();
