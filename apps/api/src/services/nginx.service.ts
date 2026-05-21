import { run } from './executor.js';
import { env } from '../config/env.js';
import type { SystemService, ServiceInfo, ServiceStatus } from './types.js';
import { logger } from '../config/logger.js';
import * as sudoFs from './sudo-fs.js';
import { db } from '../db/index.js';
import { sites } from '../db/schema/sites.js';
import { domains, sslCertificates } from '../db/schema/domains.js';
import { wafRules, ipAllowlists } from '../db/schema/security.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../errors.js';
import { nanoid } from 'nanoid';

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
  upstreamPort?: number;
  projectId?: string;
  ipAllow?: string[];
  ipBlock?: string[];
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

  async testConfig(): Promise<{ valid: boolean; output: string }> {
    const result = await run('nginx', ['-T'], { sudo: true });
    const combinedOutput = result.stdout + result.stderr;

    const filteredOutput = combinedOutput
      .split('\n')
      .filter(line => !/\[(emerg|warn)\].*open\(\)[^)]*\).*Read-only file system/i.test(line))
      .join('\n')
      .trim();

    const hadPidErrors = combinedOutput.includes('open()') && combinedOutput.includes('Read-only file system');
    const looksValid = filteredOutput.includes('syntax is ok');

    return {
      valid: result.exitCode === 0 || (hadPidErrors && looksValid),
      output: filteredOutput || combinedOutput,
    };
  }

  async generateSiteConfig(siteId: string): Promise<void> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId));
    for (const domain of siteDomains) {
      await this.addVhost({
        domain: domain.name,
        documentRoot: `${env.VHOSTS_ROOT}/${site.projectId}/${site.name}`,
        ssl: await this.getSslPaths(domain.id),
        redirectHttpToHttps: domain.forceHttps,
        hsts: domain.hstsEnabled,
        upstreamPort: site.port || 3000,
      });
    }
  }

  async addVhost(ctx: VhostContext): Promise<void> {
    if (ctx.projectId) {
      const { allow, block } = await this.getIpAllowlistForProject(ctx.projectId);
      ctx.ipAllow = allow;
      ctx.ipBlock = block;
    }

    const configContent = this.renderVhost(ctx);
    const safeName = ctx.domain.replace(/[^a-z0-9]/gi, '_');
    const configPath = `${env.NGINX_SITES_AVAILABLE}/${safeName}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${safeName}.conf`;

    await sudoFs.writeFile(configPath, configContent);
    await run('ln', ['-sf', configPath, enabledPath], { sudo: true });
    await this.reloadNginx();
  }

  async removeVhost(domain: string): Promise<void> {
    const safeName = domain.replace(/[^a-z0-9]/gi, '_');
    const configPath = `${env.NGINX_SITES_AVAILABLE}/${safeName}.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/${safeName}.conf`;

    try {
      await run('rm', ['-f', enabledPath], { sudo: true });
      await run('rm', ['-f', configPath], { sudo: true });
      await this.reloadNginx();
    } catch {}
  }

  async reloadNginx(): Promise<void> {
    try {
      await run('nginx', ['-s', 'reload'], { sudo: true });
    } catch {
      await this.restart();
    }
  }

  renderVhostConfig(ctx: VhostContext): string {
    return this.renderVhost(ctx);
  }

  private renderVhost(ctx: VhostContext): string {
    const sslDirectives = ctx.ssl ? `
  ssl_certificate ${ctx.ssl.certPath};
  ssl_certificate_key ${ctx.ssl.keyPath};
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
` : '';

    const hstsHeader = ctx.hsts ? `
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` : '';

    const redirectBlock = ctx.redirectHttpToHttps ? `
  server {
    listen 80;
    server_name ${ctx.domain};
    return 301 https://$server_name$request_uri;
  }
` : '';

    const ipAllowDirectives = (ctx.ipAllow && ctx.ipAllow.length > 0)
      ? ctx.ipAllow.map(ip => `  allow ${ip};`).join('\n') + '\n  deny all;\n'
      : '';

    return `${redirectBlock}
server {
  listen 443 ssl http2;
  server_name ${ctx.domain};
  root ${ctx.documentRoot};${sslDirectives}
${hstsHeader}
${ipAllowDirectives}
  index index.html index.htm index.php;

  location / {
    try_files $uri $uri/ =404;
  }

  location ~ \\.php$ {
    fastcgi_pass unix:/run/php/php${ctx.phpVersion || '8.3'}-fpm.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
  }

  location ~ /\\.ht {
    deny all;
  }

  access_log /var/log/nginx/${ctx.domain}.access.log;
  error_log /var/log/nginx/${ctx.domain}.error.log;
}
`;
  }

  async generateWebsiteConfig(_websiteId: string): Promise<void> {
    // Legacy v4 method — no-op in v5
  }

  async generateSubdomainConfig(_subdomainDomainId: string): Promise<void> {
    // Legacy v4 method — no-op in v5
  }

  async generateSuspendedConfig(_websiteId: string): Promise<void> {
    // Legacy v4 method — no-op in v5
  }

  async removeWebsiteConfig(_websiteId: string): Promise<void> {
    // Legacy v4 method — no-op in v5
  }

  async generateSingleDomainSuspendedConfig(_domainId: string): Promise<void> {
    // Legacy v4 method — no-op in v5
  }

  private renderPhpLocation(_phpVersion: string, _upstreamPort?: number): string {
    return '';
  }

  private resolveDocumentRoot(_domain: any, _website: any): string | null {
    return null;
  }

  private resolvePhpVersion(_domain: any, _website: any): string | undefined {
    return undefined;
  }

  private buildPrimaryServerBlock(_primaryDomain: any, _parkedDomains: any[], _website: any, _phpVersion?: string): string {
    return '';
  }

  private buildAddonServerBlock(_addonDomain: any, _website: any, _phpVersion?: string): string {
    return '';
  }

  private buildSubdomainServerBlock(_subdomainDomain: any, _website: any, _phpVersion?: string): string {
    return '';
  }

  private buildSuspendedBlock(_domain: any): string {
    return '';
  }

  private generateConfigHeader(_websiteName: string, _websiteId: string): string {
    return '';
  }

  private async getSslPaths(domainId: string): Promise<{ certPath: string; keyPath: string } | undefined> {
    const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domainId, domainId)).limit(1);
    if (!cert || cert.status !== 'active') return undefined;

    const certDir = `/etc/letsencrypt/live/${domainId}`;
    return {
      certPath: cert.certPem ? `${certDir}/cert.pem` : `${certDir}/fullchain.pem`,
      keyPath: cert.keyPem ? `${certDir}/privkey.pem` : `${certDir}/privkey.pem`,
    };
  }

  private async getWafRulesForProject(projectId: string): Promise<string[]> {
    const rules = await db.select().from(wafRules).where(eq(wafRules.projectId, projectId)).orderBy(wafRules.priority);
    return rules.filter(r => r.enabled).map(r => {
      switch (r.type) {
        case 'rate_limit':
          return `limit_req zone=${r.name}_limit burst=${(r.config as any)?.burst || 10} nodelay;`;
        case 'geo_block': {
          const blockedCountries = (r.config as any)?.countries || [];
          if (blockedCountries.length === 0) return '';
          return `# Geo block rule: ${r.name}\ngEOAllowed ${blockedCountries.join(' ')};`;
        }
        case 'owasp':
          return `# OWASP rule: ${r.name}`;
        case 'bot':
          return `# Bot protection rule: ${r.name}`;
        default:
          return `# Custom rule: ${r.name}`;
      }
    }).filter(Boolean);
  }

  private async getIpAllowlistForProject(projectId: string): Promise<{ allow: string[]; block: string[] }> {
    const lists = await db.select().from(ipAllowlists).where(eq(ipAllowlists.projectId, projectId));
    const allow: string[] = [];
    const block: string[] = [];

    for (const list of lists) {
      if (!list.ips || !Array.isArray(list.ips)) continue;
      if (list.type === 'allow') {
        allow.push(...list.ips);
      } else {
        block.push(...list.ips);
      }
    }

    return { allow, block };
  }

  async applySecurityRules(projectId: string): Promise<void> {
    const rules = await db.select().from(wafRules).where(eq(wafRules.projectId, projectId));
    const allowlists = await db.select().from(ipAllowlists).where(eq(ipAllowlists.projectId, projectId));

    const globalConfigPath = `${env.NGINX_SITES_AVAILABLE}/security-global.conf`;
    const enabledPath = `${env.NGINX_SITES_ENABLED}/security-global.conf`;

    const rateLimitRules = rules.filter(r => r.enabled && r.type === 'rate_limit').map(r => {
      const cfg = r.config as any;
      return `limit_req_zone $binary_remote_addr zone=${r.name}_req:10m rate=${cfg?.rate || '10r/s'};`;
    });

    const ipDenyBlocks = allowlists.filter(l => l.type === 'block' && (l.ips as string[])?.length).map(l => {
      const ips = (l.ips as string[]).filter((ip: string) => typeof ip === 'string').join(' ');
      return ips ? `deny ${ips};` : '';
    }).filter(Boolean);

    const ipAllowBlocks = allowlists.filter(l => l.type === 'allow' && (l.ips as string[])?.length).map(l => {
      const ips = (l.ips as string[]).filter((ip: string) => typeof ip === 'string').join(' ');
      return ips ? `allow ${ips};` : '';
    }).filter(Boolean);

    const geoBlocks = rules.filter(r => r.enabled && r.type === 'geo_block').map(r => {
      const countries = ((r.config as any)?.countries || []).join(' ');
      return countries ? `geo ${r.name}_geo { default 0; ${countries.split(' ').map((c: string) => `${c} 1;`).join(' ')} }` : '';
    }).filter(Boolean);

    const content = [
      '# Global security rules - managed by NovaPanel',
      ...rateLimitRules,
      ...geoBlocks,
      '# IP allowlist',
      ...ipAllowBlocks,
      'deny all;',
      '# IP blocklist',
      ...ipDenyBlocks,
    ].join('\n');

    await sudoFs.writeFile(globalConfigPath, content);
    await run('ln', ['-sf', globalConfigPath, enabledPath], { sudo: true });
    await this.reloadNginx();
    logger.info({ projectId }, 'Security rules applied to nginx');
  }
}

export const nginxService = new NginxService();
