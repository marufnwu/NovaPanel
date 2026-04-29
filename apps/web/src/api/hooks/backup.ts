import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Backup {
  id: string;
  domainId?: string | null;
  filename: string;
  type: 'full' | 'files' | 'database' | 'dns' | 'mail' | 'config';
  storageType: string;
  storagePath?: string | null;
  sizeBytes?: number | null;
  status: 'running' | 'completed' | 'failed' | 'restoring';
  startedAt: string;
  completedAt?: string | null;
  error?: string | null;
  encrypted?: boolean;
  createdAt: string;
}

export interface BackupSchedule {
  id: string;
  cronExpression: string;
  scope: string;
  retentionCount: number;
  storageType: string;
  storageConfig?: Record<string, string>;
  isActive: boolean;
}

export interface BackupVerifyResult {
  valid: boolean;
  checksum: string;
  sizeBytes: number;
  checkedAt: string;
  errors?: string[];
}

export interface RemoteStorageConfig {
  type: 'local' | 's3' | 'sftp';
  s3?: {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
  };
  sftp?: {
    host: string;
    port: number;
    user: string;
    path: string;
    authType: 'password' | 'key';
    password?: string;
    key?: string;
  };
}

export function useBackups(domainId?: string) {
  return useQuery({
    queryKey: ['backups', domainId],
    queryFn: () => api.get<Backup[]>(domainId ? `/backups?domainId=${domainId}` : '/backups'),
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: Backup['type']; domainId?: string; encrypted?: boolean; encryptionPassword?: string }) =>
      api.post<Backup>('/backups', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { files?: boolean; databases?: boolean; dns?: boolean } }) =>
      api.post(`/backups/${id}/restore`, options || {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/backups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const data = await api.get<string>(`/backups/${id}/download`);
      return data;
    },
  });
}

export function useVerifyBackup() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<BackupVerifyResult>(`/backups/${id}/verify`),
  });
}

export function useBackupSchedules() {
  return useQuery({
    queryKey: ['backup-schedules'],
    queryFn: () => api.get<BackupSchedule[]>('/backups/schedules'),
  });
}

export function useCreateBackupSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { cronExpression: string; scope: string; retentionCount: number; storageType: string; storageConfig?: Record<string, string> }) =>
      api.post('/backups/schedules', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup-schedules'] }),
  });
}

export function useDeleteBackupSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/backups/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup-schedules'] }),
  });
}

export function useToggleBackupSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/backups/schedules/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup-schedules'] }),
  });
}

export function useRemoteStorageConfig() {
  return useQuery({
    queryKey: ['backup-storage'],
    queryFn: () => api.get<RemoteStorageConfig>('/backups/storage'),
  });
}

export function useUpdateRemoteStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RemoteStorageConfig) =>
      api.put('/backups/storage', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backup-storage'] }),
  });
}
