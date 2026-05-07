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
