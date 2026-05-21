import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useAuthStore } from '../../store/auth.store';

export interface Registry {
  id: string;
  orgId: string;
  name: string;
  provider: 'dockerhub' | 'ghcr' | 'ecr' | 'gcr' | 'selfhosted';
  url?: string;
  username?: string;
  password?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateRegistryInput {
  orgId: string;
  name: string;
  provider: 'dockerhub' | 'ghcr' | 'ecr' | 'gcr' | 'selfhosted';
  url?: string;
  username?: string;
  password?: string;
}

export interface UpdateRegistryInput {
  name?: string;
  url?: string;
  username?: string;
  password?: string;
}

export function useRegistries() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';
  return useQuery({
    queryKey: ['registries', orgId],
    queryFn: () => api.get<Registry[]>(`/registries/list?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

export function useRegistry(id: string) {
  return useQuery({
    queryKey: ['registries', id],
    queryFn: () => api.get<Registry>(`/registries/${id}`),
    enabled: !!id,
  });
}

export function useCreateRegistry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRegistryInput) => api.post<Registry>('/registries/create', data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['registries', vars.orgId] });
    },
  });
}

export function useUpdateRegistry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateRegistryInput) =>
      api.put<Registry>(`/registries/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registries'] });
    },
  });
}

export function useDeleteRegistry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/registries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registries'] });
    },
  });
}