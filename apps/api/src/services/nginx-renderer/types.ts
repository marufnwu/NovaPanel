import { sites, siteRuntimes, siteProcesses, domains } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export interface SiteModel {
  site: typeof sites.$inferSelect;
  runtime?: typeof siteRuntimes.$inferSelect;
  process?: typeof siteProcesses.$inferSelect;
  domains: Array<typeof domains.$inferSelect>;
}

export interface DomainConfig {
  name: string;
  type: 'primary' | 'addon' | 'parked' | 'subdomain' | 'redirect' | 'mail-only';
  documentRoot?: string | null;
  redirectTarget?: string | null;
  isPrimary: boolean;
  parentDomainId?: string | null;
  sslEnabled: boolean;
  status: 'active' | 'suspended' | 'pending';
}

export interface NginxConfigOptions {
  sitesEnabled?: boolean;
  sslEnabled?: boolean;
}

export interface NginxRenderer {
  /**
   * Render nginx configuration for a site
   */
  render(model: SiteModel): string;

  /**
   * Validate nginx configuration
   */
  validate(config: string): Promise<boolean>;

  /**
   * Get the config file path for a site
   */
  getConfigPath(siteId: string): string;
}
