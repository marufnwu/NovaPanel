import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export type ActivityType = 
  | 'deployment'
  | 'config_change'
  | 'ssl_renewal'
  | 'ssl_issue'
  | 'cron_run'
  | 'cron_create'
  | 'cron_delete'
  | 'domain_attach'
  | 'domain_detach'
  | 'database_create'
  | 'database_delete'
  | 'env_var_create'
  | 'env_var_update'
  | 'env_var_delete'
  | 'build'
  | 'restart'
  | 'stop'
  | 'start'
  | 'health_check'
  | 'cache_clear'
  | 'settings_update'
  | 'user_action'
  | 'system';

export interface SiteActivity {
  id: string;
  siteId: string;
  type: ActivityType;
  action: string;
  description: string;
  details?: Record<string, any>;
  userId?: string;
  userName?: string;
  timestamp: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    resourceType?: string;
    resourceId?: string;
  };
}

export interface SiteActivitiesResponse {
  items: SiteActivity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export type ActivityFilter = ActivityType | 'all';

export function useSiteActivities(
  siteId: string, 
  options?: {
    filter?: ActivityFilter;
    limit?: number;
    offset?: number;
    page?: number;
  }
) {
  const { filter = 'all', limit = 50, offset, page = 1 } = options || {};
  
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  if (offset !== undefined) {
    params.set('offset', String(offset));
  }
  if (filter !== 'all') {
    params.set('type', filter);
  }

  return useQuery({
    queryKey: ['sites', siteId, 'activities', { filter, limit, offset, page }],
    queryFn: () => api.get<SiteActivitiesResponse>(`/sites/${siteId}/activities?${params.toString()}`),
    enabled: !!siteId,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time feel
  });
}

export function useSiteActivityStream(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'activities', 'stream'],
    queryFn: () => api.get<SiteActivity[]>(`/sites/${siteId}/activities/recent`),
    enabled: !!siteId,
    refetchInterval: 10000, // Poll more frequently for "stream" effect
  });
}

// Activity type to display info mapping
export const activityTypeConfig: Record<ActivityType, { 
  icon: string; 
  label: string; 
  color: string;
}> = {
  deployment: { icon: 'icon-upload', label: 'Deployment', color: 'text-foreground-success' },
  config_change: { icon: 'icon-edit', label: 'Config Change', color: 'text-foreground-secondary' },
  ssl_renewal: { icon: 'icon-refresh', label: 'SSL Renewal', color: 'text-foreground-success' },
  ssl_issue: { icon: 'icon-lock', label: 'SSL Issue', color: 'text-foreground-success' },
  cron_run: { icon: 'icon-play', label: 'Cron Run', color: 'text-foreground-warning' },
  cron_create: { icon: 'icon-plus', label: 'Cron Create', color: 'text-foreground-success' },
  cron_delete: { icon: 'icon-trash', label: 'Cron Delete', color: 'text-foreground-danger' },
  domain_attach: { icon: 'icon-world', label: 'Domain Attach', color: 'text-foreground-success' },
  domain_detach: { icon: 'icon-x', label: 'Domain Detach', color: 'text-foreground-warning' },
  database_create: { icon: 'icon-database', label: 'Database Create', color: 'text-foreground-success' },
  database_delete: { icon: 'icon-trash', label: 'Database Delete', color: 'text-foreground-danger' },
  env_var_create: { icon: 'icon-plus', label: 'Env Var Create', color: 'text-foreground-success' },
  env_var_update: { icon: 'icon-edit', label: 'Env Var Update', color: 'text-foreground-secondary' },
  env_var_delete: { icon: 'icon-trash', label: 'Env Var Delete', color: 'text-foreground-danger' },
  build: { icon: 'icon-play', label: 'Build', color: 'text-foreground-primary' },
  restart: { icon: 'icon-refresh-cw', label: 'Restart', color: 'text-foreground-warning' },
  stop: { icon: 'icon-stop', label: 'Stop', color: 'text-foreground-danger' },
  start: { icon: 'icon-play', label: 'Start', color: 'text-foreground-success' },
  health_check: { icon: 'icon-activity', label: 'Health Check', color: 'text-foreground-primary' },
  cache_clear: { icon: 'icon-refresh', label: 'Cache Clear', color: 'text-foreground-secondary' },
  settings_update: { icon: 'icon-settings', label: 'Settings Update', color: 'text-foreground-secondary' },
  user_action: { icon: 'icon-user', label: 'User Action', color: 'text-foreground-primary' },
  system: { icon: 'icon-server', label: 'System', color: 'text-foreground-tertiary' },
};

// Filter options for activity type filtering
export const activityFilters: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All Activities' },
  { value: 'deployment', label: 'Deployments' },
  { value: 'config_change', label: 'Config Changes' },
  { value: 'ssl_renewal', label: 'SSL' },
  { value: 'ssl_issue', label: 'SSL Issue' },
  { value: 'cron_run', label: 'Cron Runs' },
  { value: 'cron_create', label: 'Cron Created' },
  { value: 'domain_attach', label: 'Domains' },
  { value: 'database_create', label: 'Databases' },
  { value: 'env_var_create', label: 'Env Variables' },
  { value: 'build', label: 'Builds' },
  { value: 'restart', label: 'Restarts' },
  { value: 'health_check', label: 'Health Checks' },
];