import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  isSystem?: boolean;
}

export interface DnsZone {
  zone: {
    id: string;
    domain: string;
    serial: number;
    ttl: number;
    primaryNs: string;
    adminEmail: string;
    refresh: number;
    retry: number;
    expire: number;
    minimumTtl: number;
    isActive: boolean;
  } | null;
  records: DnsRecord[];
}

export interface PropagationResult {
  resolver: string;
  ip: string;
  aRecords: string[];
  mxRecords: string[];
  aMatches: boolean;
  mxMatches: boolean;
  latencyMs: number;
  error: string | null;
}

export function useDnsZone(domainId: string) {
  return useQuery({
    queryKey: ['dns', domainId],
    queryFn: () => api.get<DnsZone>(`/domains/${domainId}/dns`),
    enabled: !!domainId,
  });
}

export function useCreateDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string; type: string; name: string; value: string; ttl?: number; priority?: number }) =>
      api.post(`/domains/${domainId}/dns/records`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dns', vars.domainId] }),
  });
}

export function useUpdateDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, recordId, ...data }: { domainId: string; recordId: string } & Record<string, unknown>) =>
      api.put(`/domains/${domainId}/dns/records/${recordId}`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dns', vars.domainId] }),
  });
}

export function useDeleteDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, recordId }: { domainId: string; recordId: string }) =>
      api.delete(`/domains/${domainId}/dns/records/${recordId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dns', vars.domainId] }),
  });
}

export function useImportZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, bindFormat }: { domainId: string; bindFormat: string }) =>
      api.post(`/domains/${domainId}/dns/import`, { bindFormat }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dns', vars.domainId] }),
  });
}

export function useExportZone(domainId: string) {
  return useQuery({
    queryKey: ['dns', domainId, 'export'],
    queryFn: () => api.get<{ content: string }>(`/domains/${domainId}/dns/export`),
    enabled: !!domainId,
  });
}

export function useResetDnsZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) =>
      api.post(`/domains/${domainId}/dns/reset-to-defaults`),
    onSuccess: (_, domainId) => qc.invalidateQueries({ queryKey: ['dns', domainId] }),
  });
}

export function useRawZone(domainId: string) {
  return useQuery({
    queryKey: ['dns', domainId, 'raw'],
    queryFn: () => api.get<{ content: string }>(`/domains/${domainId}/dns/raw`),
    enabled: !!domainId,
  });
}

export function usePropagationCheck(domainId: string) {
  return useQuery({
    queryKey: ['dns', domainId, 'propagation'],
    queryFn: () => api.get<PropagationResult[]>(`/domains/${domainId}/dns/propagation`),
    enabled: !!domainId,
    staleTime: 0, // Always refetch
  });
}

// --- SOA Record Update ---

export interface SoaRecord {
  primaryNs: string;
  adminEmail: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minimumTtl: number;
}

export function useUpdateSoaRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string } & SoaRecord) =>
      api.put(`/domains/${domainId}/dns/soa`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dns', vars.domainId] }),
  });
}

// --- External DNS (Cloudflare) ---

export interface CloudflareConfig {
  enabled: boolean;
  apiToken: string;
  zoneId: string;
  zoneName: string;
  lastSyncAt: string | null;
}

export function useCloudflareConfig(domainId: string) {
  return useQuery({
    queryKey: ['dns', domainId, 'cloudflare'],
    queryFn: () => api.get<CloudflareConfig>(`/domains/${domainId}/dns/cloudflare`),
    enabled: !!domainId,
  });
}

export function useUpdateCloudflareConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string } & Partial<CloudflareConfig>) =>
      api.put(`/domains/${domainId}/dns/cloudflare`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dns', vars.domainId, 'cloudflare'] }),
  });
}

export function useSyncCloudflareRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) =>
      api.post(`/domains/${domainId}/dns/cloudflare/sync`),
    onSuccess: (_, domainId) => {
      qc.invalidateQueries({ queryKey: ['dns', domainId] });
      qc.invalidateQueries({ queryKey: ['dns', domainId, 'cloudflare'] });
    },
  });
}
