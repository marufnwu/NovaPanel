import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Deployment {
  id: string;
  siteId: string;
  sequence: number;
  sourceType: 'git' | 'docker_registry' | 'upload' | 'rollback';
  gitRef: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  status: 'pending' | 'building' | 'testing' | 'deploying' | 'success' | 'failed' | 'cancelled';
  buildLogs: string | null;
  deployLogs: string | null;
  deployedAt: string | Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string | Date;
}

export function useSiteDeployments(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'deployments'],
    queryFn: () => api.get<Deployment[]>(`/sites/${siteId}/deployments`),
    enabled: !!siteId,
  });
}

export function useDeployment(id: string) {
  return useQuery({
    queryKey: ['deployments', id],
    queryFn: () => api.get<Deployment>(`/deployments/${id}`),
    enabled: !!id,
  });
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { siteId: string; sourceType: Deployment['sourceType']; gitRef?: string; commitSha?: string; commitMessage?: string }) =>
      api.post<Deployment>(`/sites/${data.siteId}/deployments`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'deployments'] });
    },
  });
}

export function useCancelDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/deployments/${id}/cancel`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['deployments', id] });
    },
  });
}