import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// --- Types for v4 Architecture ---

export interface RuntimeConfig {
  schemaVersion: number;
  runtime: 'php' | 'node' | 'python' | 'static' | 'docker';
  version?: string;
  buildCommand?: string;
  startCommand?: string;
  healthCheckPath?: string;
  phpVersion?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  venvPath?: string;
}

export interface Site {
  id: string;
  name: string;
  systemUser: string;
  homeDir: string;
  status: 'active' | 'suspended';
  diskUsedMb: number;
  bandwidthUsedMb: number;
  createdAt: string;
}

export interface SiteWithDetails extends Site {
  runtime?: SiteRuntime;
  process?: SiteProcess;
  domains: Domain[];
}

export interface SiteRuntime {
  id: string;
  siteId: string;
  runtimeConfig: RuntimeConfig;
  webServer: 'nginx' | 'apache';
  createdAt: string;
  updatedAt: string;
}

export interface SiteProcess {
  id: string;
  siteId: string;
  startCommand: string;
  internalPort?: number;
  processManager: 'pm2' | 'supervisor' | 'systemd' | 'php-fpm';
  replicas: number;
  autoRestart: boolean;
  healthCheckPath: string;
  pid?: number;
  uptime?: number;
  restartCount: number;
  memoryMb?: number;
  cpuPercent?: number;
}

export interface Domain {
  id: string;
  name: string;
  siteId: string | null;
  parentDomainId: string | null;
  role: 'primary' | 'attached';
  behavior: 'normal' | 'alias' | 'redirect';
  isSubdomain: boolean;
  documentRoot: string | null;
  redirectTarget: string | null;
  sslEnabled: boolean;
  status: 'active' | 'suspended' | 'pending';
}

export interface CreateSiteInput {
  name: string;
  runtime: RuntimeConfig;
  primaryDomain?: string;
}

export interface UpdateSiteInput {
  name?: string;
}

// --- Sites CRUD Hooks ---

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<Site[]>('/sites'),
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: () => api.get<SiteWithDetails>(`/sites/${id}`),
    enabled: !!id,
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSiteInput) => api.post<Site>('/sites', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateSiteInput) =>
      api.put<Site>(`/sites/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.id] });
    },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });
}

// --- Status Actions ---

export function useSuspendSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/suspend`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

export function useActivateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/activate`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

// --- Domain Attachment ---

export function useAttachDomainToSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, domainId }: { siteId: string; domainId: string }) =>
      api.post(`/sites/${siteId}/domains/attach`, { domainId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useDetachDomainFromSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, domainId }: { siteId: string; domainId: string }) =>
      api.post(`/sites/${siteId}/domains/detach`, { domainId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export const useWebsites = useSites;
export const useWebsite = useSite;
export const useAttachDomain = useAttachDomainToSite;
export const useDetachDomain = useDetachDomainFromSite;

// --- Process Management ---

export function useStartSiteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/process/start`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

export function useStopSiteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/process/stop`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

export function useRestartSiteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/process/restart`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}