import { NginxRenderer, SiteModel, NginxConfigOptions } from './types.js';
import { env } from '../../config/env.js';

export class DefaultNginxRenderer implements NginxRenderer {
  private readonly NGINX_SITES_AVAILABLE: string;

  constructor() {
    this.NGINX_SITES_AVAILABLE = env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available';
  }

  getConfigPath(siteId: string): string {
    return `${this.NGINX_SITES_AVAILABLE}/site-${siteId}.conf`;
  }

  render(_model: SiteModel): string {
    return '';
  }

  async validate(_config: string): Promise<boolean> {
    return true;
  }
}

export const nginxRenderer = new DefaultNginxRenderer();
