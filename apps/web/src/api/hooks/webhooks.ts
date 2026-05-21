import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Webhook {
  id: string;
  orgId: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  headers: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  success: boolean;
  error?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface CreateWebhookPayload {
  name: string;
  url: string;
  secret?: string;
  events?: string[];
  enabled?: boolean;
  headers?: Record<string, string>;
}

export interface UpdateWebhookPayload {
  name?: string;
  url?: string;
  events?: string[];
  enabled?: boolean;
  headers?: Record<string, string>;
}

export function useWebhooks(orgId: string) {
  return useQuery({
    queryKey: ['webhooks', orgId],
    queryFn: () => api.get<Webhook[]>(`/organizations/${orgId}/webhooks`),
    enabled: !!orgId,
  });
}

export function useWebhook(id: string) {
  return useQuery({
    queryKey: ['webhooks', id],
    queryFn: () => api.get<Webhook>(`/webhooks/${id}`),
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: CreateWebhookPayload }) =>
      api.post<Webhook>(`/organizations/${orgId}/webhooks`, data),
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
    },
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookPayload }) =>
      api.put<Webhook>(`/webhooks/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useRegenerateWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ secret: string }>(`/webhooks/${id}/regenerate-secret`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useWebhookDeliveries(webhookId: string) {
  return useQuery({
    queryKey: ['webhooks', webhookId, 'deliveries'],
    queryFn: () => api.get<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`),
    enabled: !!webhookId,
  });
}

export function useTriggerWebhook() {
  return useMutation({
    mutationFn: ({ orgId, event, payload }: { orgId: string; event: string; payload: Record<string, unknown> }) =>
      api.post(`/organizations/${orgId}/webhooks/trigger`, { event, payload }),
  });
}