import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Database {
  id: string;
  name: string;
  engine: 'mariadb' | 'postgresql';
  charset?: string;
  domainId?: string | null;
  createdAt: string;
}

export interface DatabaseInfo extends Database {
  sizeBytes: number;
  sizeMb: number;
  users: Array<{
    id: string;
    username: string;
    host: string;
  }>;
}

export interface DbUser {
  id: string;
  databaseId: string;
  username: string;
  host: string;
  privileges: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: async () => {
      const data = await api.get<{ items: Database[]; meta: { page: number; perPage: number; total: number } }>('/databases');
      return data.items ?? (Array.isArray(data) ? data : []);
    },
  });
}

export function useDatabaseInfo(databaseId: string) {
  return useQuery({
    queryKey: ['database-info', databaseId],
    queryFn: () => api.get<DatabaseInfo>(`/databases/${databaseId}`),
    enabled: !!databaseId,
  });
}

export function useCreateDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId?: string; name: string; type: 'mariadb' | 'postgresql'; charset?: string }) =>
      api.post('/databases', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useDeleteDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/databases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useCreateDbUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { databaseId: string; username: string; password: string; host?: string }) =>
      api.post(`/databases/${data.databaseId}/users`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useDeleteDbUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dbId, userId }: { dbId: string; userId: string }) =>
      api.delete(`/databases/${dbId}/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useChangeDbPassword() {
  return useMutation({
    mutationFn: ({ dbId, userId, password }: { dbId: string; userId: string; password: string }) =>
      api.put(`/databases/${dbId}/users/${userId}/password`, { password }),
  });
}

export function useExportDatabase() {
  return useMutation({
    mutationFn: (id: string) => api.get<{ sql: string }>(`/databases/${id}/export`),
  });
}

export function useImportDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dbId, sql }: { dbId: string; sql: string }) =>
      api.post(`/databases/${dbId}/import`, { sql }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useRepairDatabase() {
  return useMutation({
    mutationFn: (dbId: string) => api.post<{ success: boolean; output: string }>(`/databases/${dbId}/repair`),
  });
}

export function useOptimizeDatabase() {
  return useMutation({
    mutationFn: (dbId: string) => api.post<{ success: boolean; output: string }>(`/databases/${dbId}/optimize`),
  });
}

export function useCloneDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dbId, newName }: { dbId: string; newName: string }) =>
      api.post(`/databases/${dbId}/clone`, { newName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useRunQuery() {
  return useMutation({
    mutationFn: ({ dbId, sql }: { dbId: string; sql: string }) =>
      api.post<QueryResult>(`/databases/${dbId}/query`, { sql }),
  });
}
