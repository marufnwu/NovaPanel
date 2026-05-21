import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WafRule {
  id: string;
  projectId: string;
  name: string;
  type: 'owasp' | 'custom' | 'rate_limit' | 'geo_block' | 'bot';
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface IpAllowlist {
  id: string;
  projectId: string;
  name: string;
  ips: string[];
  type: 'allow' | 'block';
  createdAt: string;
  updatedAt?: string;
}

export interface CreateWafRulePayload {
  name: string;
  type: 'owasp' | 'custom' | 'rate_limit' | 'geo_block' | 'bot';
  enabled?: boolean;
  priority?: number;
  config?: Record<string, unknown>;
}

export interface UpdateWafRulePayload {
  name?: string;
  type?: 'owasp' | 'custom' | 'rate_limit' | 'geo_block' | 'bot';
  enabled?: boolean;
  priority?: number;
  config?: Record<string, unknown>;
}

export interface CreateIpAllowlistPayload {
  name: string;
  ips: string[];
  type: 'allow' | 'block';
}

export interface UpdateIpAllowlistPayload {
  name?: string;
  ips?: string[];
  type?: 'allow' | 'block';
}

// ─── WAF Rules ───────────────────────────────────────────────────────────────

export function useWafRules(projectId: string) {
  return useQuery({
    queryKey: ['waf-rules', projectId],
    queryFn: () => api.get<WafRule[]>(`/projects/${projectId}/waf-rules`),
    enabled: !!projectId,
  });
}

export function useCreateWafRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: CreateWafRulePayload }) =>
      api.post<WafRule>(`/projects/${projectId}/waf-rules`, data),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['waf-rules', projectId] });
    },
  });
}

export function useUpdateWafRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWafRulePayload }) =>
      api.put<WafRule>(`/waf-rules/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waf-rules'] });
    },
  });
}

export function useDeleteWafRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/waf-rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waf-rules'] });
    },
  });
}

// ─── IP Allowlists ───────────────────────────────────────────────────────────

export function useIpAllowlists(projectId: string) {
  return useQuery({
    queryKey: ['ip-allowlists', projectId],
    queryFn: () => api.get<IpAllowlist[]>(`/projects/${projectId}/ip-allowlists`),
    enabled: !!projectId,
  });
}

export function useCreateIpAllowlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: CreateIpAllowlistPayload }) =>
      api.post<IpAllowlist>(`/projects/${projectId}/ip-allowlists`, data),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['ip-allowlists', projectId] });
    },
  });
}

export function useUpdateIpAllowlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIpAllowlistPayload }) =>
      api.put<IpAllowlist>(`/ip-allowlists/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ip-allowlists'] });
    },
  });
}

export function useDeleteIpAllowlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ip-allowlists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ip-allowlists'] });
    },
  });
}