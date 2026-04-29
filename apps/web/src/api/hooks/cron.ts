import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface CronJob {
  id: string;
  domainId?: string | null;
  command: string;
  schedule: string;
  systemUser: string;
  isActive: boolean;
  lastRun?: string | null;
  lastStatus?: string | null;
  createdAt: string;
}

export interface CronRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function useCronJobs(domainId?: string) {
  return useQuery({
    queryKey: ['cron', domainId],
    queryFn: () => api.get<CronJob[]>(domainId ? `/cron?domainId=${domainId}` : '/cron'),
  });
}

export function useCronJob(jobId: string) {
  return useQuery({
    queryKey: ['cron-job', jobId],
    queryFn: () => api.get<CronJob>(`/cron/${jobId}`),
    enabled: !!jobId,
  });
}

export function useCreateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { schedule: string; command: string; systemUser?: string; domainId?: string }) =>
      api.post<CronJob>('/cron', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}

export function useUpdateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; schedule?: string; command?: string; systemUser?: string }) =>
      api.put(`/cron/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}

export function useDeleteCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cron/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}

export function useToggleCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/cron/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }),
  });
}

export function useRunCronJob() {
  return useMutation({
    mutationFn: (id: string) => api.post<CronRunResult>(`/cron/${id}/run`),
  });
}

// --- Cron Job History ---

export interface CronHistoryEntry {
  id: string;
  jobId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  exitCode: number;
  outputPreview: string;
}

export function useCronHistory(jobId: string) {
  return useQuery({
    queryKey: ['cron', jobId, 'history'],
    queryFn: () => api.get<CronHistoryEntry[]>(`/cron/${jobId}/history`),
    enabled: !!jobId,
  });
}
