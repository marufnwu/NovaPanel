import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface UsageRecord {
  id: string;
  orgId: string;
  resourceType: 'cpu' | 'memory' | 'storage' | 'bandwidth' | 'requests';
  resourceId?: string;
  quantity: number;
  unit: string;
  timestamp: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  status: 'draft' | 'open' | 'paid' | 'overdue' | 'cancelled';
  amount: number;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  lineItems?: unknown[];
  paidAt?: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  quotas: Record<string, unknown>;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateInvoicePayload {
  amount: number;
  currency?: string;
  lineItems?: unknown[];
}

export interface CreatePlanPayload {
  name: string;
  slug: string;
  price: number;
  currency?: string;
  interval?: 'monthly' | 'yearly';
  quotas: Record<string, unknown>;
  features: string[];
  isActive?: boolean;
}

export interface UpdatePlanPayload {
  name?: string;
  price?: number;
  quotas?: Record<string, unknown>;
  features?: string[];
  isActive?: boolean;
}

export function useUsageRecords(orgId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['usage-records', orgId, from, to],
    queryFn: () => api.get<UsageRecord[]>(`/organizations/${orgId}/usage${query}`),
    enabled: !!orgId,
  });
}

export function useUsageSummary(orgId: string) {
  return useQuery({
    queryKey: ['usage-summary', orgId],
    queryFn: () => api.get<Record<string, { quantity: number; unit: string }>>(`/organizations/${orgId}/usage/summary`),
    enabled: !!orgId,
  });
}

export function useRecordUsage() {
  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: { resourceType: string; quantity: number; unit: string; resourceId?: string } }) =>
      api.post(`/organizations/${orgId}/usage`, data),
  });
}

export function useInvoices(orgId: string) {
  return useQuery({
    queryKey: ['invoices', orgId],
    queryFn: () => api.get<Invoice[]>(`/organizations/${orgId}/invoices`),
    enabled: !!orgId,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: CreateInvoicePayload }) =>
      api.post<Invoice>(`/organizations/${orgId}/invoices`, data),
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['invoices', orgId] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice['status'] }) =>
      api.put<Invoice>(`/invoices/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<Plan[]>('/plans'),
  });
}

export function usePlan(slug: string) {
  return useQuery({
    queryKey: ['plans', slug],
    queryFn: () => api.get<Plan>(`/plans/${slug}`),
    enabled: !!slug,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanPayload) => api.post<Plan>('/plans', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdatePlanPayload) =>
      api.put<Plan>(`/plans/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}