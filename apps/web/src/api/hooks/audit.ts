import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  ip: string | null;
  timestamp: string;
  details?: string | null;
  userAgent?: string | null;
}

export function useAuditLog(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['audit', limit, offset],
    queryFn: () =>
      api.get<AuditEntry[]>(`/audit?limit=${limit}&offset=${offset}`),
  });
}
