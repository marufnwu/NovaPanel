import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useAuthStore } from '../../store/auth.store';

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string;
  environment: 'production' | 'staging' | 'development';
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  orgId: string;
  environment?: 'production' | 'staging' | 'development';
}

export interface UpdateProjectInput {
  name?: string;
  environment?: 'production' | 'staging' | 'development';
}

export function useProjects() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';
  return useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>(`/projects?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) => api.post<Project>('/projects', data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.orgId] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateProjectInput) =>
      api.put<Project>(`/projects/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}