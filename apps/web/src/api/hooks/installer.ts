import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  phpVersion?: string;
  requirements: string[];
  installCommand: string;
  installPath: string;
  configFiles: string[];
  adminPath?: string;
  adminUrlPattern?: string;
  needsDatabase?: boolean;
}

export interface InstalledApp {
  id: number;
  appId: string;
  appName: string;
  domainId: string | null;
  domain?: string | null;
  installPath: string | null;
  status: string;
  progress: number | null;
  adminEmail: string | null;
  adminPassword: string | null;
  adminUrl?: string | null;
  databaseHost: string | null;
  databaseName: string | null;
  databaseUser: string | null;
  databasePassword: string | null;
  installedAt: string | null;
  updatedAt: string | null;
  createdAt: string;
}

export interface InstallLog {
  id: number;
  appId: string;
  domainId: string | null;
  message: string | null;
  level: string | null;
  createdAt: string;
}

export interface AppConfig {
  id: number;
  appId: string | null;
  configKey: string | null;
  configValue: string | null;
  updatedAt: string;
}

export interface PostInstallChecklist {
  appInstalled: boolean;
  databaseConfigured: boolean;
  adminUrl: string | null;
  sslConfigured: boolean;
  backupsConfigured: boolean;
}

type InstallStatus = {
  status: 'installing' | 'ready' | 'error';
  progress?: number;
  message?: string;
};

export interface PathCheckResult {
  exists: boolean;
  isEmpty: boolean;
  files: string[];
}

export function useInstallerApps() {
  return useQuery({
    queryKey: ['installer', 'apps'],
    queryFn: () => api.get<AppDefinition[]>('/installer/apps'),
  });
}

export function useAppDetails(appId: string) {
  return useQuery({
    queryKey: ['installer', 'app', appId],
    queryFn: () => api.get<AppDefinition>(`/installer/apps/${appId}`),
    enabled: !!appId,
  });
}

export function useInstallApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      appId: string;
      domain: string;
      path: string;
      adminEmail: string;
      adminPassword: string;
      databaseOption?: 'auto' | 'existing';
      databaseId?: string;
    }) =>
      api.post<InstalledApp>('/installer/install', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installer', 'apps'] });
      qc.invalidateQueries({ queryKey: ['installer', 'installed'] });
    },
  });
}

export function useInstallStatus(appId: string) {
  return useQuery({
    queryKey: ['installer', 'status', appId],
    queryFn: () => api.get<InstallStatus>(`/installer/status/${appId}`),
    enabled: !!appId,
  });
}

export function useUninstallApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { appId: string }) =>
      api.post('/installer/uninstall', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installer', 'installed'] }),
  });
}

export function useUpdateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { appId: string }) =>
      api.post('/installer/update', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installer', 'installed'] }),
  });
}

export function useInstallLogs(appId: string, limit: number = 50) {
  return useQuery({
    queryKey: ['installer', 'logs', appId],
    queryFn: () => api.get<InstallLog[]>(`/installer/logs/${appId}?limit=${limit}`),
    enabled: !!appId,
  });
}

export function useInstalledApps() {
  return useQuery({
    queryKey: ['installer', 'installed'],
    queryFn: () => api.get<InstalledApp[]>('/installer/installed'),
  });
}

export function useAppConfigs(appId: string) {
  return useQuery({
    queryKey: ['installer', 'configs', appId],
    queryFn: () => api.get<AppConfig[]>(`/installer/config/${appId}`),
    enabled: !!appId,
  });
}

export function useSetAppConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { appId: string; configKey: string; configValue: string }) =>
      api.post('/installer/config', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installer', 'configs'] }),
  });
}

export function useDeleteAppConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { appId: string; configKey: string }) =>
      api.post('/installer/config/delete', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installer', 'configs'] }),
  });
}

export function useCheckPath() {
  return useMutation({
    mutationFn: (data: { path: string }) =>
      api.post<PathCheckResult>('/installer/check-path', data),
  });
}
