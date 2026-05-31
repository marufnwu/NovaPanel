import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface CronJob {
  id: string;
  siteId: string | null;
  name: string;
  command: string;
  schedule: string;
  user: string;
  workingDir: string | null;
  status: 'active' | 'paused' | 'error';
  lastRunAt: string | null;
  lastExitCode: number | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CronRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function useCronJobs(siteId?: string) {
  return useQuery({
    queryKey: ['cron', siteId],
    queryFn: () => api.get<CronJob[]>(siteId ? `/cron?siteId=${siteId}` : '/cron'),
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
    mutationFn: (data: { schedule: string; command: string; systemUser?: string; domainId?: string; siteId?: string }) =>
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
