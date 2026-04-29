import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface VhostConfig {
  domainId: string;
  domain: string;
  webServer: string;
  phpVersion: string;
  phpHandler: string;
  ssl: boolean;
  documentRoot: string;
  redirectHttpToHttps: boolean;
  hsts: boolean;
  gzipEnabled: boolean;
  browserCachingEnabled: boolean;
  staticFileExpiryDays: number;
  hotlinkProtection: boolean;
  hotlinkAllowedDomains: string;
  directoryBrowsing: boolean;
  ipRestrictionMode: 'allow_all' | 'whitelist' | 'blacklist';
  ipList: string;
  reverseProxyEnabled: boolean;
  reverseProxyTarget: string;
  maxUploadSizeMb: number;
  customNginxDirectives: string;
  customApacheDirectives: string;
}

export interface DomainOption {
  id: string;
  name: string;
  webServer: string;
  status: string;
}

export function useWebserverStatus() {
  return useQuery({
    queryKey: ['webserver', 'status'],
    queryFn: () => api.get<{ nginx: { status: string }; apache: { status: string } }>('/webserver/status'),
  });
}

export function useWebserverDomains() {
  return useQuery({
    queryKey: ['webserver', 'domains'],
    queryFn: () => api.get<DomainOption[]>('/webserver/domains'),
  });
}

export function useVhostConfig(domain: string) {
  return useQuery({
    queryKey: ['webserver', 'vhost', domain],
    queryFn: () => api.get<VhostConfig>(`/webserver/vhost/${domain}`),
    enabled: !!domain,
  });
}

export function useUpdateVhost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domain, ...data }: { domain: string } & Record<string, unknown>) =>
      api.put(`/webserver/vhost/${domain}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['webserver', 'vhost', variables.domain] });
    },
  });
}

export function usePreviewConfig(domainId: string) {
  return useQuery({
    queryKey: ['webserver', 'preview', domainId],
    queryFn: () => api.get<{ domain: string; server: string; config: string }>(`/webserver/preview/${domainId}`),
    enabled: !!domainId,
  });
}

export function useTestConfig() {
  return useMutation({
    mutationFn: (serverType: 'nginx' | 'apache') =>
      api.post<{ valid: boolean; output: string }>(`/webserver/test-config/${serverType}`),
  });
}

export function useReloadServer() {
  return useMutation({
    mutationFn: (serverType: 'nginx' | 'apache') =>
      api.post(`/webserver/reload/${serverType}`),
  });
}

// --- Custom Error Pages ---

export interface CustomErrorPage {
  code: number;
  enabled: boolean;
  content: string;
  contentType: 'text/html' | 'text/plain';
}

export function useCustomErrorPages(domain: string) {
  return useQuery({
    queryKey: ['webserver', 'error-pages', domain],
    queryFn: () => api.get<CustomErrorPage[]>(`/webserver/vhost/${domain}/error-pages`),
    enabled: !!domain,
  });
}

export function useUpdateCustomErrorPages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domain, errorPages }: { domain: string; errorPages: CustomErrorPage[] }) =>
      api.put(`/webserver/vhost/${domain}/error-pages`, { errorPages }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['webserver', 'error-pages', variables.domain] });
    },
  });
}

// --- Rate Limiting ---

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerSecond: number;
  burstSize: number;
  timeoutSeconds: number;
}

export function useRateLimitConfig(domain: string) {
  return useQuery({
    queryKey: ['webserver', 'rate-limit', domain],
    queryFn: () => api.get<RateLimitConfig>(`/webserver/vhost/${domain}/rate-limit`),
    enabled: !!domain,
  });
}

export function useUpdateRateLimitConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domain, ...data }: { domain: string } & RateLimitConfig) =>
      api.put(`/webserver/vhost/${domain}/rate-limit`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['webserver', 'rate-limit', variables.domain] });
    },
  });
}
