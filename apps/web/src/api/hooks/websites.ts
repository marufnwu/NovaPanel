import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// --- Types ---

export interface Website {
  id: string;
  name: string;
  systemUser: string;
  documentRoot: string;
  phpVersion: string;
  phpHandler: string;
  webServer: string;
  status: 'active' | 'suspended' | 'error';
  diskUsedMb: number | null;
  bandwidthUsedMb: number | null;
  createdAt: string;
}

export interface CreateWebsiteInput {
  name: string;
  systemUser?: string;
  documentRoot?: string;
  phpVersion?: string;
  phpHandler?: string;
  webServer?: string;
}

export interface UpdateWebsiteInput {
  name?: string;
  phpVersion?: string;
  phpHandler?: string;
  webServer?: string;
  documentRoot?: string;
}

export interface FtpAccount {
  id: string;
  username: string;
  path: string;
  status: string;
}

export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  status: string;
}

export interface Backup {
  id: string;
  name: string;
  date: string;
  size: string;
  status: string;
}

export interface Database {
  id: string;
  name: string;
  type: string;
  size: string;
}

export interface InstalledApp {
  id: string;
  appName: string;
  version: string;
  status: string;
}

// --- Website CRUD Hooks ---

export function useWebsites() {
  return useQuery({
    queryKey: ['websites'],
    queryFn: () => api.get<Website[]>('/websites'),
  });
}

export function useWebsite(id: string) {
  return useQuery({
    queryKey: ['websites', id],
    queryFn: () => api.get<Website>(`/websites/${id}`),
    enabled: !!id,
  });
}

export function useCreateWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWebsiteInput) => api.post<Website>('/websites', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites'] }),
  });
}

export function useUpdateWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateWebsiteInput) =>
      api.put<Website>(`/websites/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['websites'] });
      qc.invalidateQueries({ queryKey: ['websites', variables.id] });
    },
  });
}

export function useDeleteWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/websites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites'] }),
  });
}

// --- Status Actions ---

export function useSuspendWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/websites/${id}/suspend`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['websites'] });
      qc.invalidateQueries({ queryKey: ['websites', id] });
    },
  });
}

export function useActivateWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/websites/${id}/activate`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['websites'] });
      qc.invalidateQueries({ queryKey: ['websites', id] });
    },
  });
}

// --- Domain Attachment ---

export function useAttachDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ websiteId, domainId }: { websiteId: string; domainId: string }) =>
      api.post(`/websites/${websiteId}/domains/${domainId}/attach`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['websites'] });
      qc.invalidateQueries({ queryKey: ['websites', variables.websiteId] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useDetachDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ websiteId, domainId }: { websiteId: string; domainId: string }) =>
      api.post(`/websites/${websiteId}/domains/${domainId}/detach`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['websites'] });
      qc.invalidateQueries({ queryKey: ['websites', variables.websiteId] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

// --- Website Sub-resources ---

export function useWebsiteFtp(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'ftp'],
    queryFn: () => api.get<FtpAccount[]>(`/websites/${websiteId}/ftp`),
    enabled: !!websiteId,
  });
}

export function useWebsiteCron(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'cron'],
    queryFn: () => api.get<CronJob[]>(`/websites/${websiteId}/cron`),
    enabled: !!websiteId,
  });
}

export function useWebsiteBackups(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'backups'],
    queryFn: () => api.get<Backup[]>(`/websites/${websiteId}/backups`),
    enabled: !!websiteId,
  });
}

export function useWebsiteDatabases(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'databases'],
    queryFn: () => api.get<Database[]>(`/websites/${websiteId}/databases`),
    enabled: !!websiteId,
  });
}

export function useWebsiteApps(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'apps'],
    queryFn: () => api.get<InstalledApp[]>(`/websites/${websiteId}/apps`),
    enabled: !!websiteId,
  });
}
