import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  manifest: Record<string, unknown>;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePluginPayload {
  name: string;
  version: string;
  description?: string;
  author?: string;
  manifest?: Record<string, unknown>;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdatePluginPayload {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  manifest?: Record<string, unknown>;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export function usePlugins() {
  return useQuery({
    queryKey: ['plugins'],
    queryFn: () => api.get<Plugin[]>('/plugins'),
  });
}

export function usePlugin(id: string) {
  return useQuery({
    queryKey: ['plugins', id],
    queryFn: () => api.get<Plugin>(`/plugins/${id}`),
    enabled: !!id,
  });
}

export function useCreatePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePluginPayload) => api.post<Plugin>('/plugins', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] });
    },
  });
}

export function useUpdatePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdatePluginPayload) =>
      api.put<Plugin>(`/plugins/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] });
    },
  });
}

export function useDeletePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/plugins/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] });
    },
  });
}

export function useTogglePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Plugin>(`/plugins/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] });
    },
  });
}

export function useUpdatePluginConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, config }: { id: string; config: Record<string, unknown> }) =>
      api.put<Plugin>(`/plugins/${id}/config`, { config }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] });
    },
  });
}