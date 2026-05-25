import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface ProcessStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  memoryMb?: number;
  cpuPercent?: number;
  restartCount: number;
  status: 'online' | 'stopped' | 'errored' | 'launching';
}

export interface ProcessInfo {
  name: string;
  status: ProcessStatus;
}

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: () => api.get<ProcessInfo[]>('/processes'),
    refetchInterval: 30_000,
  });
}

export function useProcess(name: string) {
  return useQuery({
    queryKey: ['processes', name],
    queryFn: () => api.get<ProcessInfo | null>(`/processes/${encodeURIComponent(name)}`),
    enabled: !!name,
    refetchInterval: 30_000,
  });
}

export function useStartProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; config?: { command: string; cwd?: string; env?: Record<string, string> } }) =>
      api.post<{ success: boolean }>(`/processes/${encodeURIComponent(params.name)}/start`, params.config ? { config: params.config } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useStopProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ success: boolean }>(`/processes/${encodeURIComponent(name)}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useRestartProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ success: boolean }>(`/processes/${encodeURIComponent(name)}/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useDeleteProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.delete<{ success: boolean }>(`/processes/${encodeURIComponent(name)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useProcessLogs(name: string, lines = 100) {
  return useQuery({
    queryKey: ['processes', name, 'logs', lines],
    queryFn: () => api.get<{ logs: string }>(`/processes/${encodeURIComponent(name)}/logs?lines=${lines}`),
    enabled: !!name,
  });
}