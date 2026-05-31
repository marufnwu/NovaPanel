import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface SslCertificate {
  id: string;
  domainId: string;
  domain: string;
  type: 'letsencrypt' | 'custom' | 'selfsigned';
  enabled: boolean;
  issuer: string;
  expiresAt: string | null;
  issuedAt: string | null;
  autoRenew: boolean;
  daysUntilExpiry: number | null;
  sanDomains: string[];
  fingerprint: string | null;
  hstsEnabled?: boolean;
  hstsMaxAge?: number;
  hstsIncludeSubdomains?: boolean;
  ocspStapling?: boolean;
}

export interface ChainValidationResult {
  valid: boolean;
  issues: string[];
  chainComplete: boolean;
  intermediateCount: number;
  rootTrusted: boolean;
  expiresAt: string | null;
}

export interface MixedContentResult {
  url: string;
  issues: Array<{
    resourceUrl: string;
    type: 'image' | 'script' | 'stylesheet' | 'iframe' | 'other';
    line?: number;
  }>;
  totalIssues: number;
  scannedAt: string;
}

export function useSslCertificates() {
  return useQuery({
    queryKey: ['ssl'],
    queryFn: () => api.get<SslCertificate[]>('/ssl'),
  });
}

export function useSslCertificate(domainId: string) {
  return useQuery({
    queryKey: ['ssl', domainId],
    queryFn: () => api.get<SslCertificate>(`/domains/${domainId}/ssl`),
    enabled: !!domainId,
  });
}

export function useExpiringCerts(days?: number) {
  return useQuery({
    queryKey: ['ssl', 'expiring', days],
    queryFn: () => api.get<SslCertificate[]>(`/ssl/expiring${days ? `?days=${days}` : ''}`),
  });
}

export function useIssueLetsEncrypt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      email,
      sanDomains,
      wildcard,
      dnsProvider,
      challengeType,
    }: {
      domainId: string;
      email: string;
      sanDomains?: string[];
      wildcard?: boolean;
      dnsProvider?: string;
      challengeType?: 'http-01' | 'dns-01';
    }) =>
      api.post<SslCertificate>(`/domains/${domainId}/letsencrypt`, {
        email,
        sanDomains,
        wildcard,
        dnsProvider,
        challengeType,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ssl'] });
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUploadCustomCert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, certificate, privateKey, chain }: { domainId: string; certificate: string; privateKey: string; chain?: string }) =>
      api.post<SslCertificate>(`/domains/${domainId}/custom`, { certificate, privateKey, chain }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}

export function useGenerateSelfSigned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, days }: { domainId: string; days?: number }) =>
      api.post<SslCertificate>(`/domains/${domainId}/self-signed`, { days: days || 365 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}

export function useDeleteCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.delete(`/ssl/domains/${domainId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}

export function useRenewCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.post(`/domains/${domainId}/renew`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}

export function useToggleAutoRenew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, autoRenew }: { domainId: string; autoRenew: boolean }) =>
      api.put(`/ssl/domains/${domainId}/auto-renew`, { autoRenew }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}

export function useDownloadCert() {
  return useMutation({
    mutationFn: ({ domainId, file }: { domainId: string; file: 'cert' | 'key' | 'chain' }) =>
      api.get<{ pem: string }>(`/ssl/domains/${domainId}/download/${file}`),
  });
}

export function useCertDetails(domainId: string) {
  return useQuery({
    queryKey: ['ssl', domainId, 'details'],
    queryFn: () => api.get<SslCertificate & {
      issuer: string;
      sanDomains: string[];
      fingerprint: string | null;
      issuedAt: string | null;
      hasChain: boolean;
      hasPrivateKey: boolean;
    }>(`/ssl/domains/${domainId}/details`),
    enabled: !!domainId,
  });
}

export function useValidateChain() {
  return useMutation({
    mutationFn: (domainId: string) =>
      api.post<ChainValidationResult>(`/ssl/domains/${domainId}/validate-chain`),
  });
}

export function useCheckMixedContent() {
  return useMutation({
    mutationFn: (domainId: string) =>
      api.post<MixedContentResult>(`/ssl/domains/${domainId}/mixed-content`),
  });
}

export function useUpdateHsts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domainId,
      enabled,
      maxAge,
      includeSubdomains,
    }: {
      domainId: string;
      enabled: boolean;
      maxAge: number;
      includeSubdomains: boolean;
    }) =>
      api.put(`/ssl/domains/${domainId}/hsts`, { enabled, maxAge, includeSubdomains }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}

export function useUpdateOcspStapling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, enabled }: { domainId: string; enabled: boolean }) =>
      api.put(`/ssl/domains/${domainId}/ocsp-stapling`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssl'] }),
  });
}
