import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
}

export type LogType = 'access' | 'error' | 'panel' | 'fail2ban' | 'auth' | 'system';

export interface LogQueryOptions {
  domainId?: string;
  lines?: number;
  search?: string;
  level?: string;
}

export function useAccessLogs(domainId?: string, lines: number = 100) {
  return useQuery({
    queryKey: ['logs', 'access', domainId, lines],
    queryFn: () => domainId
      ? api.get<{ log: string }>(`/domains/${domainId}/logs/access?lines=${lines}`)
      : Promise.resolve({ log: '' }),
    refetchInterval: 30_000,
    enabled: !!domainId,
  });
}

export function useErrorLogs(domainId?: string, lines: number = 100) {
  return useQuery({
    queryKey: ['logs', 'error', domainId, lines],
    queryFn: () => domainId
      ? api.get<{ log: string }>(`/domains/${domainId}/logs/error?lines=${lines}`)
      : Promise.resolve({ log: '' }),
    refetchInterval: 30_000,
    enabled: !!domainId,
  });
}

export function usePanelLogs(lines: number = 100) {
  return useQuery({
    queryKey: ['logs', 'panel', lines],
    queryFn: () => api.get<{ log: string }>(`/logs/panel?lines=${lines}`),
    refetchInterval: 30_000,
  });
}

export function useFail2banLogs(lines: number = 100) {
  return useQuery({
    queryKey: ['logs', 'fail2ban', lines],
    queryFn: () => api.get<{ log: string }>(`/logs/fail2ban?lines=${lines}`),
    refetchInterval: 30_000,
  });
}

export function useAuthLogs(lines: number = 100) {
  return useQuery({
    queryKey: ['logs', 'auth', lines],
    queryFn: () => api.get<{ log: string }>(`/logs/auth?lines=${lines}`),
    refetchInterval: 30_000,
  });
}

export function useSystemLogs(lines: number = 100) {
  return useQuery({
    queryKey: ['logs', 'system', lines],
    queryFn: () => api.get<{ log: string }>(`/logs/system?lines=${lines}`),
    refetchInterval: 30_000,
  });
}
