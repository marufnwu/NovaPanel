import { sites, domains } from '../../db/schema/index.js';

export interface SiteModel {
  site: typeof sites.$inferSelect;
  runtime?: any;
  process?: any;
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
  render(model: SiteModel): string;
  validate(config: string): Promise<boolean>;
  getConfigPath(siteId: string): string;
}
