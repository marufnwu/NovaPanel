import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Metric {
  id: string;
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: string;
}

export interface AlertRule {
  id: string;
  orgId: string;
  projectId?: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number;
  channels: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  resolvedAt?: string;
  value: number;
  message?: string;
}

export interface CreateAlertRulePayload {
  projectId?: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration?: number;
  channels?: string[];
  enabled?: boolean;
}

export interface UpdateAlertRulePayload {
  name?: string;
  description?: string;
  metric?: string;
  condition?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold?: number;
  duration?: number;
  channels?: string[];
  enabled?: boolean;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export function useMetrics(filters?: { name?: string; from?: string; to?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.name) params.set('name', filters.name);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['metrics', filters],
    queryFn: () => api.get<Metric[]>(`/metrics${query}`),
  });
}

export function useRecordMetric() {
  return useMutation({
    mutationFn: (data: { name: string; value: number; labels?: Record<string, string> }) =>
      api.post('/metrics', data),
  });
}

export function useCollectMetrics() {
  return useMutation({
    mutationFn: () => api.post('/collect-metrics'),
  });
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────

export function useAlertRules(orgId: string) {
  return useQuery({
    queryKey: ['alert-rules', orgId],
    queryFn: () => api.get<AlertRule[]>(`/organizations/${orgId}/alert-rules`),
    enabled: !!orgId,
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: CreateAlertRulePayload }) =>
      api.post<AlertRule>(`/organizations/${orgId}/alert-rules`, data),
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['alert-rules', orgId] });
    },
  });
}

export function useUpdateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAlertRulePayload }) =>
      api.put<AlertRule>(`/alert-rules/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/alert-rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });
}

export function useAlertRuleHistory(ruleId: string) {
  return useQuery({
    queryKey: ['alert-rule-history', ruleId],
    queryFn: () => api.get<AlertHistory[]>(`/alert-rules/${ruleId}/history`),
    enabled: !!ruleId,
  });
}

export function useAlertHistory(orgId: string, limit = 100) {
  return useQuery({
    queryKey: ['alert-history', orgId],
    queryFn: () => api.get<AlertHistory[]>(`/organizations/${orgId}/alert-history?limit=${limit}`),
    enabled: !!orgId,
  });
}

export function useEvaluateAlerts() {
  return useMutation({
    mutationFn: () => api.post('/evaluate-alerts'),
  });
}