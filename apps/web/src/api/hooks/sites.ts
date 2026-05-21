import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Site, CreateSiteInput, Deployment } from '@serverforge/schemas/sites';

export type { Site, CreateSiteInput, Deployment } from '@serverforge/schemas/sites';

export interface UpdateSiteInput {
  name?: string;
  runtime?: string;
  status?: string;
}

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<Site[]>('/sites'),
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: () => api.get<Site>(`/sites/${id}`),
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

export function useSiteDeployments(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'deployments'],
    queryFn: () => api.get<Deployment[]>(`/sites/${siteId}/deployments`),
    enabled: !!siteId,
  });
}

export function useSiteBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.post<{ deploymentId: string }>(`/sites/${siteId}/build`),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['sites', siteId, 'deployments'] });
      qc.invalidateQueries({ queryKey: ['sites', siteId] });
    },
  });
}

export function useSiteDeploy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.post<{ deploymentId: string }>(`/sites/${siteId}/deploy`),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['sites', siteId, 'deployments'] });
      qc.invalidateQueries({ queryKey: ['sites', siteId] });
    },
  });
}

export function useSiteLogs(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'logs'],
    queryFn: () => api.get<{ logs: string }>(`/sites/${siteId}/logs`),
    enabled: !!siteId,
    refetchInterval: 5000,
  });
}

export function useSiteStatus(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'status'],
    queryFn: () => api.get<{ running: boolean; containerId?: string }>(`/sites/${siteId}/status`),
    enabled: !!siteId,
    refetchInterval: 3000,
  });
}

export function useSiteStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.post(`/sites/${siteId}/stop`),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['sites', siteId, 'status'] });
      qc.invalidateQueries({ queryKey: ['sites', siteId] });
    },
  });
}

export function useSiteDockerfile(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'dockerfile'],
    queryFn: () => api.get<{ dockerfile: string }>(`/sites/${siteId}/dockerfile`),
    enabled: !!siteId,
  });
}