import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Site, SiteWithRuntime, RuntimeConfig, CreateSiteInput, SiteProcess } from '@serverforge/schemas/sites';

export type { Site, SiteWithRuntime, RuntimeConfig, CreateSiteInput, SiteProcess } from '@serverforge/schemas/sites';

// Alias for backward compat
export type SiteWithDetails = SiteWithRuntime;

export interface UpdateSiteInput {
  name?: string;
}

// --- Sites CRUD Hooks ---

export function useSites(options?: { includeRuntime?: boolean }) {
  return useQuery({
    queryKey: ['sites', options],
    queryFn: () => {
      const params = options?.includeRuntime ? '?include=runtime' : '';
      return api.get<Site[]>(`/sites${params}`);
    },
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: () => api.get<SiteWithRuntime>(`/sites/${id}`),
    enabled: !!id,
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSiteInput) => api.post<Site>('/sites', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateSiteInput) =>
      api.put<Site>(`/sites/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.id] });
    },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });
}

// --- Status Actions ---

export function useSuspendSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/suspend`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

export function useActivateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/activate`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

// --- Domain Attachment ---

export function useAttachDomainToSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, domainId }: { siteId: string; domainId: string }) =>
      api.post(`/sites/${siteId}/domains/attach`, { domainId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useDetachDomainFromSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, domainId }: { siteId: string; domainId: string }) =>
      api.post(`/sites/${siteId}/domains/detach`, { domainId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export const useAttachDomain = useAttachDomainToSite;
export const useDetachDomain = useDetachDomainFromSite;

// --- Process Management ---

export function useStartSiteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/process/start`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

export function useStopSiteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/process/stop`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}

export function useRestartSiteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sites/${id}/process/restart`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['sites', id] });
    },
  });
}