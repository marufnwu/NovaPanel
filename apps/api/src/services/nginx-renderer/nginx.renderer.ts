import { NginxRenderer, SiteModel, DomainConfig, NginxConfigOptions } from './types.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export class DefaultNginxRenderer implements NginxRenderer {
  private readonly NGINX_SITES_AVAILABLE: string;

  constructor() {
    this.NGINX_SITES_AVAILABLE = env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available';
  }

  getConfigPath(siteId: string): string {
    return `${this.NGINX_SITES_AVAILABLE}/site-${siteId}.conf`;
  }

  render(model: SiteModel): string {
    const { site, runtime, domains: siteDomains } = model;

    if (!runtime) {
      throw new Error(`Site ${site.id} has no runtime configuration`);
    }

    const config = runtime.runtimeConfig as {
      runtime?: string;
      healthCheckPath?: string;
    };

    // Get primary domain
    const primaryDomain = siteDomains.find(d => d.type === 'primary' && d.isPrimary);
    const attachedDomains = siteDomains.filter(d => d.type === 'addon');
    const aliasDomains = siteDomains.filter(d => d.type === 'parked');
    const redirectDomains = siteDomains.filter(d => d.type === 'redirect');

    // Build server_name directive
    const serverNames = [
      primaryDomain?.name,
      ...attachedDomains.map(d => d.name),
      ...aliasDomains.map(d => d.name),
    ].filter(Boolean);

    // Build redirect server blocks
    const redirectBlocks = redirectDomains
      .map(d => this.renderRedirectBlock(d))
      .join('\n');

    // Main server block
    const mainBlock = this.renderMainBlock(
      site,
      config,
      serverNames as string[],
      primaryDomain
    );

    return `# NovaPanel Site: ${site.name}
# Auto-generated - DO NOT EDIT MANUALLY
# Site ID: ${site.id}

${redirectBlocks}

${mainBlock}
`;
  }

  private renderMainBlock(
    site: SiteModel['site'],
    runtimeConfig: { runtime?: string; healthCheckPath?: string },
    serverNames: string[],
    primaryDomain: DomainConfig | undefined
  ): string {
    const documentRoot = primaryDomain?.documentRoot || `${site.homeDir}/httpdocs`;
    const runtime = runtimeConfig.runtime || 'static';

    // Base server config
    let config = `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames.join(' ')};
    
    root ${documentRoot};
    index index.html index.php;
    
    # Logging
    access_log ${site.homeDir}/logs/access.log;
    error_log ${site.homeDir}/logs/error.log;
    
    # Default charset
    charset utf-8;
`;

    // Add PHP-FPM config if runtime is PHP
    if (runtime === 'php') {
      config += `
    # PHP-FPM configuration
    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }
`;
    }

    // Add health check endpoint
    const healthPath = runtimeConfig.healthCheckPath || '/health';
    config += `
    # Health check endpoint
    location = ${healthPath} {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
`;

    // Add Node.js/Python proxy config if not PHP
    if (runtime === 'node' || runtime === 'python') {
      // Internal port will be resolved at runtime from site_processes
      config += `
    # Proxy to application
    location / {
        proxy_pass http://127.0.0.1:30000;  # Port resolved by reconciler
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
`;
    }

    // Static file serving
    config += `
    # Serve static files
    location ~* \\.(jpg|jpeg|gif|png|ico|css|js|woff|woff2|ttf|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
`;

    config += `}`;

    return config;
  }

  private renderRedirectBlock(domain: DomainConfig): string {
    if (domain.type !== 'redirect' || !domain.redirectTarget) {
      return '';
    }

    return `
server {
    listen 80;
    listen [::]:80;
    server_name ${domain.name};
    
    location / {
        return 301 ${domain.redirectTarget};
    }
}
`;
  }

  async validate(config: string): Promise<boolean> {
    const { run } = await import('../../services/executor.js');
    const sudoFs = await import('../../services/sudo-fs.js');
    
    const tmpPath = '/tmp/nginx-test-config.conf';
    
    try {
      await sudoFs.writeFile(tmpPath, config);
      const result = await run('nginx', ['-t', '-c', tmpPath], { sudo: true });
      return result.success;
    } catch {
      return false;
    } finally {
      await sudoFs.unlink(tmpPath).catch(() => {});
    }
  }
}

export const nginxRenderer = new DefaultNginxRenderer();
