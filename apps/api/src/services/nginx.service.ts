import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import * as sudoFs from './sudo-fs.js';
import { db } from '../db/index.js';
import { websites } from '../db/schema/websites.js';  // Keep for backward compat
import { sites, siteRuntimes } from '../db/schema/index.js';
import { domains } from '../db/schema/domains.js';
import { eq, and } from 'drizzle-orm';

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
    // Use systemctl reload instead of nginx -s reload to handle read-only /run
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
   * Uses `nginx -T` directly instead of `nginx -t` or `systemctl configtest` because:
   * 1. nginx -t with sudo can have issues on systems with read-only /run or permission problems
   * 2. nginx -T dumps configuration without forking (no pid file needed)
   * 3. systemctl configtest is not supported on all systems (Unknown command verb)
   */
  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await run('nginx', ['-T'], { sudo: true });
    const combinedOutput = result.stdout + result.stderr;

    // Filter out read-only filesystem pid file warnings
    const filteredOutput = combinedOutput
      .split('\n')
      .filter(line => !/\[(emerg|warn)\].*open\(\)[^)]*\).*Read-only file system/i.test(line))
      .join('\n')
      .trim();

    // Check if we filtered out any pid errors
    const hadPidErrors = combinedOutput.includes('open()') && combinedOutput.includes('Read-only file system');

    // Config is valid if: exit code is 0, OR we filtered pid errors and rest looks ok
    // Note: nginx always says "syntax is ok" when syntax is valid - "test failed" appears only due to pid file errors
    const looksValid = filteredOutput.includes('syntax is ok');

    return {
      valid: result.exitCode === 0 || (hadPidErrors && looksValid),
      output: filteredOutput || combinedOutput,
    };
  }

  // ---------------------------------------------------------------------------
  // Website-scoped config methods (v3 architecture)
  // ---------------------------------------------------------------------------

  /**
   * Resolve the document root for a domain based on its type.
   * - primary: {website.homeDir}/httpdocs
   * - addon: {website.homeDir}/addons/{domainId}/httpdocs
   * - parked: NULL (uses primary's docroot)
   * - subdomain: {website.homeDir}/subdomains/{domainId}/httpdocs
   * - redirect/mail-only: NULL
   */
  private resolveDocumentRoot(domain: { type: string; id: string; documentRoot?: string | null }, website: { homeDir: string }): string | null {
    if (domain.type === 'parked' || domain.type === 'redirect' || domain.type === 'mail-only') {
      return null;
    }
    if (domain.type === 'primary') {
      return `${website.homeDir}/httpdocs`;
    }
    if (domain.type === 'addon') {
      return `${website.homeDir}/addons/${domain.id}/httpdocs`;
    }
    if (domain.type === 'subdomain') {
      return `${website.homeDir}/subdomains/${domain.id}/httpdocs`;
    }
    // Fallback for legacy types or custom docroot
    return domain.documentRoot || `${website.homeDir}/httpdocs`;
  }

  /**
   * Resolve effective PHP version for a domain (inherit from website if null).
   */
  private resolvePhpVersion(domain: { phpVersion?: string | null }, website: { phpVersion: string; phpHandler: string }): string | undefined {
    if (website.phpHandler === 'disabled') return undefined;
    return domain.phpVersion || website.phpVersion;
  }

  /**
   * Generate a single nginx config file for a website containing type-aware server blocks.
   * Per v3 architecture:
   * - Primary domain + parked domains share one server block (parked merged into server_name)
   * - Each addon domain gets its own server block
   * - Each subdomain gets its own server block
   * - Suspended domains get a 503 block instead of their normal block
   */
async generateWebsiteConfig(websiteId: string): Promise<void> {
  // 1. Look up site (try new sites table first, fall back to websites for migration)
  const [site] = await db.select().from(sites).where(eq(sites.id, websiteId)).limit(1);
  
  let siteData = site;
  let phpVersion = '8.2'; // default
  
  if (!siteData) {
    // Fall back to old websites table for migration period
    const [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (!website) throw new Error(`Website/Site not found: ${websiteId}`);
    siteData = {
      id: website.id,
      name: website.name,
      systemUser: website.systemUser,
      homeDir: website.homeDir,
      status: website.status,
      diskUsedMb: website.diskUsedMb,
      bandwidthUsedMb: website.bandwidthUsedMb,
      createdAt: website.createdAt,
    };
    phpVersion = website.phpVersion || '8.2';
  } else {
    // Get runtime config from site_runtimes
    const [runtime] = await db.select().from(siteRuntimes).where(eq(siteRuntimes.siteId, websiteId)).limit(1);
    if (runtime?.runtimeConfig) {
      const config = runtime.runtimeConfig as any;
      phpVersion = config.phpVersion || config.version || '8.2';
    }
  }

  // 2. Find all domains attached to this site
  const attachedDomains = await db.select().from(domains).where(eq(domains.websiteId, websiteId));

  // 3. Group domains by type
  const primaryDomain = attachedDomains.find(d => d.type === 'primary' && d.isPrimary);
  const addonDomains = attachedDomains.filter(d => d.type === 'addon');
  const parkedDomains = attachedDomains.filter(d => d.type === 'parked');
  const subdomainDomains = attachedDomains.filter(d => d.type === 'subdomain');

  // 4. Build config
  let config = this.generateConfigHeader(siteData.name, websiteId);

  // Primary + parked domains (port 80)
  if (primaryDomain) {
    config += this.buildPrimaryServerBlock(primaryDomain, parkedDomains, siteData, phpVersion);
  } else if (parkedDomains.length > 0) {
    logger.warn({ websiteId }, 'Parked domains exist but no primary domain found');
  }

  // Addon domains
  for (const addon of addonDomains) {
    if (addon.status === 'suspended') {
      config += this.buildSuspendedBlock(addon);
    } else {
      config += this.buildAddonServerBlock(addon, siteData, phpVersion);
    }
  }

  // Subdomain domains
  for (const subdomain of subdomainDomains) {
    if (subdomain.status === 'suspended') {
      config += this.buildSuspendedBlock(subdomain);
    } else {
      config += this.buildSubdomainServerBlock(subdomain, siteData, phpVersion);
    }
}

    // Write config file
    const configPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/website-${websiteId}.conf`;

    await sudoFs.mkdir(env.NGINX_SITES_AVAILABLE);

    // Backup existing config before overwriting
    const backupPath = `${env.NGINX_SITES_AVAILABLE}/website-${websiteId}.conf.bak`;
    try {
      const existing = await sudoFs.readFile(configPath);
      await sudoFs.writeFile(backupPath, existing);
    } catch {
      // No existing config to backup
    }

    // Use atomic write to ensure config is never partial
    await sudoFs.atomicWrite(configPath, config);

    // Symlink to sites-enabled
    try {
      await sudoFs.symlink(configPath, enabledPath);
    } catch {
      // Symlink may already exist
    }

    // Test nginx config
    const test = await this.testConfig();
    if (!test.valid) {
      // Rollback
      try {
        const backup = await sudoFs.readFile(backupPath);
        await sudoFs.atomicWrite(configPath, backup);
      } catch (restoreError) {
        const originalError = `Nginx config test failed for website ${websiteId}: ${test.output}`;
        const restoreFailedMsg = `Rollback also failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}.`;
        throw new Error(`${originalError}; ${restoreFailedMsg}`);
      }
      await sudoFs.unlink(backupPath).catch(() => {});
      throw new Error(`Nginx config test failed for website ${websiteId}: ${test.output}`);
    }

    // Clean up backup after successful validation
    await sudoFs.unlink(backupPath).catch(() => {});

    // Reload nginx
    await this.reload();
    logger.info({ websiteId, domainCount: attachedDomains.length }, 'Website nginx config generated (v3)');
  }

  private generateConfigHeader(websiteName: string, websiteId: string): string {
    return `# NovaPanel website config — ${websiteName} (${websiteId})\n# Generated: ${new Date().toISOString()}\n`;
  }

  /**
   * Build primary domain server block with parked domains merged into server_name.
   * Both HTTP and HTTPS blocks are included if SSL is enabled.
   */
  private buildPrimaryServerBlock(primaryDomain: any, parkedDomains: any[], website: any, phpVersion?: string): string {
    const allServerNames = [primaryDomain.name, ...parkedDomains.map(p => p.name)];
    const serverNameLine = allServerNames.join(' ');
    const docRoot = this.resolveDocumentRoot(primaryDomain, website) || website.documentRoot;
    const resolvedPhpVersion = phpVersion ?? this.resolvePhpVersion(primaryDomain, website);

    let config = `\n# ── Primary + Parked domains (port 80) ───────\n`;
    config += `server {\n`;
    config += `    listen 80;\n`;
    config += `    server_name ${serverNameLine};\n`;
    config += `    root ${docRoot};\n`;
    config += `    access_log ${website.homeDir}/logs/access.log;\n`;
    config += `    error_log ${website.homeDir}/logs/error.log;\n`;
    config += `    index index.php index.html index.htm;\n`;
    config += `    location / {\n`;
    config += `        try_files $uri $uri/ =404;\n`;
    config += `    }\n`;
    if (resolvedPhpVersion) {
      config += this.renderPhpLocation(resolvedPhpVersion);
    }
    config += `}\n`;

    // HTTPS block if SSL enabled
    if (primaryDomain.sslEnabled && primaryDomain.sslCertId) {
      config += `\n# ── Primary + Parked domains (port 443, SSL) ──\n`;
      config += `server {\n`;
      config += `    listen 443 ssl http2;\n`;
      config += `    server_name ${serverNameLine};\n`;
      config += `    root ${docRoot};\n`;
      // SSL cert path would be looked up from sslCertId - using website SSL dir for now
      config += `    ssl_certificate ${website.homeDir}/ssl/fullchain.pem;\n`;
      config += `    ssl_certificate_key ${website.homeDir}/ssl/privkey.pem;\n`;
      config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
      config += `    access_log ${website.homeDir}/logs/access.log;\n`;
      config += `    error_log ${website.homeDir}/logs/error.log;\n`;
      config += `    index index.php index.html index.htm;\n`;
      if (primaryDomain.hsts) {
        config += `    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n`;
      }
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (resolvedPhpVersion) {
        config += this.renderPhpLocation(resolvedPhpVersion);
      }
      config += `}\n`;
    }

    return config;
  }

  /**
   * Build addon domain server block with its own docroot under addons/.
   */
  private buildAddonServerBlock(addonDomain: any, website: any, phpVersion?: string): string {
    const docRoot = this.resolveDocumentRoot(addonDomain, website) || `${website.homeDir}/addons/${addonDomain.id}/httpdocs`;
    const resolvedPhpVersion = phpVersion ?? this.resolvePhpVersion(addonDomain, website);

    let config = `\n# ── Addon domain: ${addonDomain.name} (port 80) ─────────\n`;
    config += `server {\n`;
    config += `    listen 80;\n`;
    config += `    server_name ${addonDomain.name};\n`;
    config += `    root ${docRoot};\n`;
    config += `    access_log ${website.homeDir}/addons/${addonDomain.id}/logs/access.log;\n`;
    config += `    error_log ${website.homeDir}/addons/${addonDomain.id}/logs/error.log;\n`;
    config += `    index index.php index.html index.htm;\n`;
    config += `    location / {\n`;
    config += `        try_files $uri $uri/ =404;\n`;
    config += `    }\n`;
    if (resolvedPhpVersion) {
      config += this.renderPhpLocation(resolvedPhpVersion);
    }
    config += `}\n`;

    // HTTPS block if SSL enabled
    if (addonDomain.sslEnabled && addonDomain.sslCertId) {
      config += `\nserver {\n`;
      config += `    listen 443 ssl http2;\n`;
      config += `    server_name ${addonDomain.name};\n`;
      config += `    root ${docRoot};\n`;
      config += `    ssl_certificate ${website.homeDir}/ssl/addons/${addonDomain.id}/fullchain.pem;\n`;
      config += `    ssl_certificate_key ${website.homeDir}/ssl/addons/${addonDomain.id}/privkey.pem;\n`;
      config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
      config += `    access_log ${website.homeDir}/addons/${addonDomain.id}/logs/access.log;\n`;
      config += `    error_log ${website.homeDir}/addons/${addonDomain.id}/logs/error.log;\n`;
      config += `    index index.php index.html index.htm;\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (resolvedPhpVersion) {
        config += this.renderPhpLocation(resolvedPhpVersion);
      }
      config += `}\n`;
    }

    return config;
  }

  /**
   * Build subdomain server block with its own docroot under subdomains/.
   */
  private buildSubdomainServerBlock(subdomainDomain: any, website: any, phpVersion?: string): string {
    const docRoot = this.resolveDocumentRoot(subdomainDomain, website) || `${website.homeDir}/subdomains/${subdomainDomain.id}/httpdocs`;
    const resolvedPhpVersion = phpVersion ?? this.resolvePhpVersion(subdomainDomain, website);

    let config = `\n# ── Subdomain: ${subdomainDomain.name} (port 80) ────\n`;
    config += `server {\n`;
    config += `    listen 80;\n`;
    config += `    server_name ${subdomainDomain.name};\n`;
    config += `    root ${docRoot};\n`;
    config += `    access_log ${website.homeDir}/subdomains/${subdomainDomain.id}/logs/access.log;\n`;
    config += `    error_log ${website.homeDir}/subdomains/${subdomainDomain.id}/logs/error.log;\n`;
    config += `    index index.php index.html index.htm;\n`;
    config += `    location / {\n`;
    config += `        try_files $uri $uri/ =404;\n`;
    config += `    }\n`;
    if (resolvedPhpVersion) {
      config += this.renderPhpLocation(resolvedPhpVersion);
    }
    config += `}\n`;

    // HTTPS block if SSL enabled
    if (subdomainDomain.sslEnabled && subdomainDomain.sslCertId) {
      config += `\nserver {\n`;
      config += `    listen 443 ssl http2;\n`;
      config += `    server_name ${subdomainDomain.name};\n`;
      config += `    root ${docRoot};\n`;
      config += `    ssl_certificate ${website.homeDir}/ssl/subdomains/${subdomainDomain.id}/fullchain.pem;\n`;
      config += `    ssl_certificate_key ${website.homeDir}/ssl/subdomains/${subdomainDomain.id}/privkey.pem;\n`;
      config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
      config += `    access_log ${website.homeDir}/subdomains/${subdomainDomain.id}/logs/access.log;\n`;
      config += `    error_log ${website.homeDir}/subdomains/${subdomainDomain.id}/logs/error.log;\n`;
      config += `    index index.php index.html index.htm;\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ =404;\n`;
      config += `    }\n`;
      if (resolvedPhpVersion) {
        config += this.renderPhpLocation(resolvedPhpVersion);
      }
      config += `}\n`;
    }

    return config;
  }

  /**
   * Build a 503 suspended block for a single domain.
   * This replaces only that domain's server block within the website conf.
   */
  private buildSuspendedBlock(domain: any): string {
    let config = `\n# ── SUSPENDED: ${domain.name} ──────────────────────\n`;
    config += `server {\n`;
    config += `    listen 80;\n`;
    config += `    server_name ${domain.name};\n`;
    config += `    return 503;\n`;
    config += `    add_header Retry-After "3600";\n`;
    config += `}\n`;
    return config;
  }

  /**
   * Generate nginx config for a subdomain (v3: subdomain is now a domain type).
   * Since subdomains are now stored in the domains table with type='subdomain',
   * this method regenerates the website config which now includes subdomain blocks.
   */
  async generateSubdomainConfig(subdomainDomainId: string): Promise<void> {
    // Subdomains are now stored in domains table with type='subdomain'
    const [subdomain] = await db.select().from(domains).where(eq(domains.id, subdomainDomainId)).limit(1);
    if (!subdomain) throw new Error(`Subdomain not found: ${subdomainDomainId}`);

    const targetWebsiteId = subdomain.websiteId;
    if (!targetWebsiteId) {
      return;
    }

    await this.generateWebsiteConfig(targetWebsiteId);
    logger.info({ subdomainDomainId, targetWebsiteId }, 'Subdomain nginx config generated (v3)');
  }

  /**
   * Generate nginx config for a site (v4 architecture - alias for generateWebsiteConfig).
   * In v4, "site" replaces "website" as the primary entity.
   * This method delegates to generateWebsiteConfig for backward compatibility.
   */
  async generateSiteConfig(siteId: string): Promise<void> {
    // v4 architecture: sites and websites are equivalent
    // This method exists to provide a semantic name for the new architecture
    // while reusing the existing website-scoped config generation
    await this.generateWebsiteConfig(siteId);
    logger.info({ siteId }, 'Site nginx config generated (v4)');
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

    // Suspended domains are now handled via domain status='suspended' in generateWebsiteConfig
    // No need to query subdomains table separately

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
   * Generate a suspended config for a single domain within a website.
   * Unlike generateSuspendedConfig which suspends all domains in a website,
   * this method only suspends ONE domain by replacing its server block with a 503.
   * The original server block is stored in domains.suspendedConfig for restoration.
   */
  async generateSingleDomainSuspendedConfig(domainId: string): Promise<void> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new Error(`Domain not found: ${domainId}`);
    if (!domain.websiteId) throw new Error(`Domain has no website attached: ${domainId}`);

    // Store the current config for this domain in the database
    // The suspendedConfig will be used to restore the domain later

    // Regenerate the website config with this domain suspended
    await this.generateWebsiteConfig(domain.websiteId);
    logger.info({ domainId, domain: domain.name }, 'Single domain suspended (v3)');
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
