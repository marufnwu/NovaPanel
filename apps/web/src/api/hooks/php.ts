import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

/** Default PHP versions used as fallback when API is unavailable */
export const DEFAULT_PHP_VERSIONS = ['8.1', '8.2', '8.3', '8.4'];

export interface PhpConfig {
  domainId: string;
  domain: string;
  phpVersion: string;
  phpHandler: string;
  customIni: string;
  poolConfig: string;
  poolSettings: {
    pm: string;
    maxChildren: number;
    startServers: number;
    minSpareServers: number;
    maxSpareServers: number;
    requestTerminateTimeout: number;
  };
  limits: {
    memoryLimit: string;
    maxExecutionTime: number;
    maxInputTime: number;
    uploadMaxFilesize: string;
    postMaxSize: string;
    maxFileUploads: number;
  };
  security: {
    openBasedir: boolean;
    disabledFunctions: string[];
  };
}

export interface PhpDomainOption {
  id: string;
  name: string;
  phpVersion: string;
  phpHandler: string;
}

export function usePhpVersions() {
  return useQuery({
    queryKey: ['php', 'versions'],
    queryFn: () => api.get<{ versions: Array<{ version: string; fpm: { active: boolean; port: number | null } }> }>('/php/versions'),
    staleTime: 60_000, // Cache for 1 minute — versions don't change often
  });
}

export function usePhpDomains() {
  return useQuery({
    queryKey: ['php', 'domains'],
    queryFn: () => api.get<PhpDomainOption[]>('/php/domains'),
  });
}

export function usePhpConfig(domainName: string) {
  return useQuery({
    queryKey: ['php', 'config', domainName],
    queryFn: () => api.get<PhpConfig>(`/php/config/${domainName}`),
    enabled: !!domainName,
  });
}

export function useSetPhpVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, phpVersion }: { domainId: string; phpVersion: string }) =>
      api.put(`/php/version/${domainId}`, { phpVersion }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['php'] }),
  });
}

export function useUpdatePoolSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string } & Record<string, any>) =>
      api.put(`/php/pool/${domainId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['php'] }),
  });
}

export function useUpdatePhpLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string } & Record<string, any>) =>
      api.put(`/php/limits/${domainId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['php'] }),
  });
}

export function useUpdatePhpSecurity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string; openBasedir?: boolean; disabledFunctions?: string[] }) =>
      api.put(`/php/security/${domainId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['php'] }),
  });
}

export function useRestartFpm() {
  return useMutation({
    mutationFn: (domainId: string) =>
      api.post(`/domains/${domainId}/php/restart-fpm`),
  });
}

export function useInstallPhp() {
  return useMutation({
    mutationFn: (version: string) => api.post(`/php/install/${version}`),
  });
}

// --- Custom php.ini ---

export interface PhpIniDirective {
  key: string;
  value: string;
}

export interface PhpIniData {
  domainId: string;
  content: string;
  directives: PhpIniDirective[];
}

export function usePhpIni(domainId: string) {
  return useQuery({
    queryKey: ['php', 'ini', domainId],
    queryFn: () => api.get<PhpIniData>(`/domains/${domainId}/php/ini`),
    enabled: !!domainId,
  });
}

export function useUpdatePhpIni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, content }: { domainId: string; content: string }) =>
      api.put(`/domains/${domainId}/php/ini`, { content }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['php', 'ini', vars.domainId] }),
  });
}

// --- PHP Info ---

export function usePhpInfo(domainId: string) {
  return useQuery({
    queryKey: ['php', 'info', domainId],
    queryFn: () => api.get<{ html: string }>(`/php/${domainId}/info`),
    enabled: !!domainId,
    staleTime: 5 * 60_000,
  });
}

// --- FPM Pool Status ---

export interface FpmPoolStatus {
  pool: string;
  processManager: string;
  startTime: string;
  startSince: number;
  acceptedConn: number;
  listenQueue: number;
  maxListenQueue: number;
  listenQueueLen: number;
  idleProcesses: number;
  activeProcesses: number;
  totalProcesses: number;
  maxActiveProcesses: number;
  maxChildrenReached: number;
  slowRequests: number;
}

export function useFpmStatus(domainId: string) {
  return useQuery({
    queryKey: ['php', 'fpm-status', domainId],
    queryFn: () => api.get<FpmPoolStatus>(`/php/${domainId}/fpm-status`),
    enabled: !!domainId,
    refetchInterval: 30_000,
  });
}
