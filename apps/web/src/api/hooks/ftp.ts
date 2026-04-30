import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface FtpAccount {
  id: string;
  domainId: string;
  username: string;
  homeDir: string;
  readonly: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
}

export function useFtpAccounts(domainId: string) {
  return useQuery({
    queryKey: ['ftp', domainId],
    queryFn: () => api.get<FtpAccount[]>(`/domains/${domainId}/ftp`),
    enabled: !!domainId,
  });
}

export function useFtpAccount(ftpId: string) {
  return useQuery({
    queryKey: ['ftp-account', ftpId],
    queryFn: () => api.get<FtpAccount>(`/ftp/${ftpId}`),
    enabled: !!ftpId,
  });
}

export function useCreateFtpAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, ...data }: { domainId: string; username: string; password: string; homeDir: string; readonly?: boolean }) =>
      api.post<FtpAccount>(`/domains/${domainId}/ftp`, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['ftp', vars.domainId] }),
  });
}

export function useUpdateFtpAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<FtpAccount>) =>
      api.put(`/ftp/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ftp'] }),
  });
}

export function useChangeFtpPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.put(`/ftp/${id}/password`, { password }),
  });
}

export function useDeleteFtpAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ftp/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ftp'] }),
  });
}

// --- FTP Global Settings ---

export interface FtpSettings {
  port: number;
  passivePortMin: number;
  passivePortMax: number;
  maxConnectionsPerIp: number;
  anonymousEnabled: boolean;
}

export function useFtpSettings() {
  return useQuery({
    queryKey: ['ftp', 'settings'],
    queryFn: () => api.get<FtpSettings>('/ftp/settings'),
  });
}

export function useUpdateFtpSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FtpSettings>) => api.put('/ftp/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ftp', 'settings'] }),
  });
}
