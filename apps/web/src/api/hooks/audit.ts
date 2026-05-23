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

export interface AuditMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AuditResponse {
  success: boolean;
  data: AuditEntry[];
  meta: AuditMeta;
}

export interface AuditFilters {
  search?: string;
  category?: string;
  user?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export function useAuditLog(filters?: AuditFilters) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.user) params.set('user', filters.user);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.perPage) params.set('per_page', String(filters.perPage ?? 20));
  const query = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api.get<AuditResponse>(`/audit${query}`),
  });
}
