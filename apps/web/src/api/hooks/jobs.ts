import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export type JobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface BackgroundJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  result?: Record<string, unknown>;
  error?: string;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export function useJobs(filters?: { status?: JobStatus; type?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => api.get<any>(`/jobs${query}`).then((r: any) => r.data?.items),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.get<BackgroundJob>(`/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/jobs/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useRefreshJobs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['jobs'] });
}