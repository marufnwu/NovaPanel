import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Domain {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'pending';
  documentRoot: string;
  phpVersion: string;
  phpHandler: string;
  webServer: string;
  sslEnabled: boolean;
  systemUser: string;
  diskUsedMb: number | null;
  bandwidthUsedMb: number | null;
  redirectHttpToHttps: boolean;
  hsts: boolean;
  createdAt: string;
  websiteId?: string | null;
  type?: 'primary' | 'subdomain' | 'alias' | 'redirect';
  parentDomainId?: string;
  redirectTarget?: string;
}

export interface CreateDomainInput {
  name: string;
  documentRoot?: string;
  phpVersion?: string;
  phpHandler?: string;
  webServer?: string;
  createDns?: boolean;
  createMail?: boolean;
  websiteMode?: 'none' | 'create' | 'existing';
  websiteId?: string;
  websiteName?: string;
  type?: 'primary' | 'subdomain' | 'alias' | 'redirect';
  parentDomainId?: string;
  redirectTarget?: string;
  createDnsZone?: boolean;
  enableMail?: boolean;
  // Cloudflare auto-public settings
  makePublic?: boolean;
  tunnelId?: string;
  // DNS verification - if true, skips DNS verification before domain creation
  skipDnsVerification?: boolean;
}

export interface Subdomain {
  id: string;
  name: string;
  domainId: string;
  documentRoot: string;
  phpVersion: string;
  createdAt: string;
}

export interface DomainAlias {
  id: string;
  alias: string;
  domainId: string;
  createdAt: string;
}

export interface DomainRedirect {
  id: string;
  sourcePath: string;
  targetUrl: string;
  type: '301' | '302';
  domainId: string;
  createdAt: string;
}

export function useDomains(search?: string) {
  return useQuery({
    queryKey: ['domains', search],
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      return api.get<Domain[]>(`/domains${params}`);
    },
  });
}

export function useDomain(id: string) {
  return useQuery({
    queryKey: ['domains', id],
    queryFn: () => api.get<Domain>(`/domains/${id}`),
    enabled: !!id,
  });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDomainInput) => api.post<Domain>('/domains', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useUpdateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.put<Domain>(`/domains/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['domains', variables.id] });
    },
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/domains/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useSuspendDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/domains/${id}/suspend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useActivateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/domains/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

// --- Subdomains ---

export function useSubdomains(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'subdomains'],
    queryFn: () => api.get<Subdomain[]>(`/domains/${domainId}/subdomains`),
    enabled: !!domainId,
  });
}

export function useCreateSubdomain(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; documentRoot?: string; phpVersion?: string }) =>
      api.post(`/domains/${domainId}/subdomains`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] }),
  });
}

export function useDeleteSubdomain(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) => api.delete(`/domains/${domainId}/subdomains/${subId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] }),
  });
}

// --- Aliases ---

export function useAliases(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'aliases'],
    queryFn: () => api.get<DomainAlias[]>(`/domains/${domainId}/aliases`),
    enabled: !!domainId,
  });
}

export function useCreateAlias(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { alias: string }) =>
      api.post(`/domains/${domainId}/aliases`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] }),
  });
}

export function useDeleteAlias(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aliasId: string) => api.delete(`/domains/${domainId}/aliases/${aliasId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] }),
  });
}

// --- Redirects ---

export function useRedirects(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'redirects'],
    queryFn: () => api.get<DomainRedirect[]>(`/domains/${domainId}/redirects`),
    enabled: !!domainId,
  });
}

export function useCreateRedirect(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourcePath: string; targetUrl: string; type: '301' | '302' }) =>
      api.post(`/domains/${domainId}/redirects`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] }),
  });
}

export function useDeleteRedirect(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (redirectId: string) => api.delete(`/domains/${domainId}/redirects/${redirectId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] }),
  });
}

// --- Bulk Actions ---

export function useBulkSuspendDomains() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.post(`/domains/${id}/suspend`))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useBulkActivateDomains() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.post(`/domains/${id}/activate`))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useBulkDeleteDomains() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.delete(`/domains/${id}`))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

// --- Domain Log Stats ---

export interface DomainLogStats {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  topUrls: { url: string; count: number }[];
}

export function useDomainLogStats(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'log-stats'],
    queryFn: () => api.get<DomainLogStats>(`/domains/${domainId}/logs/stats`),
    enabled: !!domainId,
    refetchInterval: 60_000,
  });
}

// --- Cloudflare Status ---

export interface DomainCloudflareStatus {
  hasTunnelRoute: boolean;
  tunnelStatus: 'active' | 'inactive' | 'degraded' | 'down' | null;
  hasSsl: boolean;
  hasRedirects: boolean;
  overall: 'live' | 'local' | 'down' | 'redirect' | 'suspended';
}

export function useDomainCloudflareStatus(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'cloudflare-status'],
    queryFn: () => api.get<DomainCloudflareStatus>(`/domains/${domainId}/cloudflare-status`),
    enabled: !!domainId,
  });
}

// --- Cloudflare Zone for Domain ---

export function useDomainCloudflareZone(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'cloudflare-zone'],
    queryFn: () => api.get<{ id: string; zoneName: string; zoneId: string; accountId: string | null; sslMode: string; isPaused: boolean } | null>(`/domains/${domainId}/cloudflare-zone`),
    enabled: !!domainId,
  });
}

// --- Cloudflare DNS Records for Domain ---

export interface DomainCloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number;
}

export interface DomainCloudflareDnsResult {
  records: DomainCloudflareDnsRecord[];
  total_count: number;
}

export function useDomainCloudflareDns(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'cloudflare', 'dns'],
    queryFn: () => api.get<DomainCloudflareDnsResult>(`/domains/${domainId}/cloudflare/dns`),
    enabled: !!domainId,
  });
}

export function useCreateDomainCloudflareDns(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string; name: string; content: string; proxied?: boolean; ttl?: number; priority?: number }) =>
      api.post(`/domains/${domainId}/cloudflare/dns`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'dns'] }),
  });
}

export function useDeleteDomainCloudflareDns(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => api.delete(`/domains/${domainId}/cloudflare/dns/${recordId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'dns'] }),
  });
}

// --- Cloudflare SSL Settings for Domain ---

export interface DomainCloudflareSsl {
  sslMode: string;
  alwaysUseHttps: boolean;
  automaticHttpsRewrites: boolean;
  minTlsVersion: string;
  http2: boolean;
  http3: boolean;
}

export function useDomainCloudflareSsl(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'cloudflare', 'ssl'],
    queryFn: () => api.get<DomainCloudflareSsl>(`/domains/${domainId}/cloudflare/ssl`),
    enabled: !!domainId,
  });
}

export function useUpdateDomainCloudflareSsl(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DomainCloudflareSsl>) => api.put(`/domains/${domainId}/cloudflare/ssl`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'ssl'] }),
  });
}

// --- Cloudflare Firewall Rules for Domain ---

export interface DomainCloudflareFirewallRule {
  id: string;
  action: string;
  description: string;
  paused: boolean;
  filter: { id: string; expression: string; paused: boolean };
}

export function useDomainCloudflareFirewall(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'cloudflare', 'firewall'],
    queryFn: () => api.get<DomainCloudflareFirewallRule[]>(`/domains/${domainId}/cloudflare/firewall`),
    enabled: !!domainId,
  });
}

export function useCreateDomainCloudflareFirewall(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { action: string; expression: string; description?: string }) =>
      api.post(`/domains/${domainId}/cloudflare/firewall`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'firewall'] }),
  });
}

export function useDeleteDomainCloudflareFirewall(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api.delete(`/domains/${domainId}/cloudflare/firewall/${ruleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'firewall'] }),
  });
}

// --- Cloudflare Redirect Rules for Domain ---

export interface DomainCloudflareRedirectRule {
  id: string;
  ruleId: string | null;
  sourcePattern: string;
  destinationUrl: string;
  redirectType: string;
  isActive: boolean;
}

export function useDomainCloudflareRedirects(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'cloudflare', 'redirects'],
    queryFn: () => api.get<DomainCloudflareRedirectRule[]>(`/domains/${domainId}/cloudflare/redirects`),
    enabled: !!domainId,
  });
}

export function useCreateDomainCloudflareRedirect(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourcePattern: string; destinationUrl: string; redirectType: string }) =>
      api.post(`/domains/${domainId}/cloudflare/redirects`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'redirects'] }),
  });
}

export function useDeleteDomainCloudflareRedirect(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api.delete(`/domains/${domainId}/cloudflare/redirects/${ruleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare', 'redirects'] }),
  });
}

// --- Cloudflare Tunnel Route for Domain ---

export function useCreateDomainCloudflareRoute(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/domains/${domainId}/cloudflare/route`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare-status'] });
      qc.invalidateQueries({ queryKey: ['tunnel', 'routes'] });
    },
  });
}

export function useDeleteDomainCloudflareRoute(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/domains/${domainId}/cloudflare/route`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare-status'] });
      qc.invalidateQueries({ queryKey: ['tunnel', 'routes'] });
    },
  });
}

// --- DNS Verification ---

export interface DomainDnsVerification {
  domain: string;
  serverIp: string;
  resolvesTo: string[];
  pointsToServer: boolean;
  error?: string;
}

export function useVerifyDomainDns() {
  return useMutation({
    mutationFn: (domain: string) =>
      api.get<DomainDnsVerification>(`/domains/verify-dns?domain=${encodeURIComponent(domain)}`),
  });
}

// --- Make Domain Public ---

export function useMakeDomainPublic(domainId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tunnelId?: string) => api.post(`/domains/${domainId}/make-public`, { tunnelId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains', domainId, 'cloudflare-status'] });
      qc.invalidateQueries({ queryKey: ['tunnel', 'routes'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

// --- Domain Log Access ---

export function useDomainAccessLog(domainId: string, lines: number = 100) {
  return useQuery({
    queryKey: ['domains', domainId, 'logs', 'access', lines],
    queryFn: () => {
      return api.get<string>(`/domains/${domainId}/logs/access?lines=${lines}`);
    },
  });
}

export function useDomainErrorLog(domainId: string, lines: number = 100) {
  return useQuery({
    queryKey: ['domains', domainId, 'logs', 'error', lines],
    queryFn: () => {
      return api.get<string>(`/domains/${domainId}/logs/error?lines=${lines}`);
    },
  });
}
