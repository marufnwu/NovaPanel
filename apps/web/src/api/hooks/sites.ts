import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Site, CreateSiteInput, Deployment } from '@serverforge/schemas/sites';
import type { CronJob } from './cron';

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

export function useSiteRollback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, deploymentId }: { siteId: string; deploymentId: string }) =>
      api.post<{ deploymentId: string }>(`/sites/${siteId}/deployments/${deploymentId}/rollback`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'deployments'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId] });
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

export function useSiteCronJobs(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'cron'],
    queryFn: () => api.get<CronJob[]>(`/sites/${siteId}/cron`),
    enabled: !!siteId,
  });
}

export function useSiteDomains(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'domains'],
    queryFn: () => api.get<any[]>(`/sites/${siteId}/domains`),
    enabled: !!siteId,
  });
}

export interface SiteStats {
  visitorsToday: number;
  bandwidthToday: string;
  diskUsage: string;
  cpuUsage: number;
  memoryUsage: number;
  requestsPerMinute: number;
  avgResponseTime: string;
  uptime: string;
}

export function useSiteStats(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'stats'],
    queryFn: () => api.get<SiteStats>(`/sites/${siteId}/stats`),
    enabled: !!siteId,
    refetchInterval: 30000,
  });
}

export interface SiteHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  webServer: 'running' | 'stopped' | 'unknown';
  phpFpm: 'running' | 'stopped' | 'not_applicable';
  database: 'connected' | 'disconnected' | 'unknown';
  lastCheck: string;
  issues: string[];
  // Extended health check details (UX-11)
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  avgResponseTime: number;
  errorRate4xx: number;
  errorRate5xx: number;
  lastSuccessfulCheck: string;
  checkInterval: number;
  healthCheckUrl: string;
  consecutiveFailures: number;
  failures: Array<{
    timestamp: string;
    error: string;
    responseCode?: number;
  }>;
}

export function useSiteHealth(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'health'],
    queryFn: () => api.get<SiteHealth>(`/sites/${siteId}/health`),
    enabled: !!siteId,
    refetchInterval: 60000,
  });
}

export function useUpdateHealthCheckConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, healthCheckUrl, checkInterval }: { siteId: string; healthCheckUrl: string; checkInterval: number }) =>
      api.put<SiteHealth>(`/sites/${siteId}/health`, { healthCheckUrl, checkInterval }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'health'] });
    },
  });
}

export function useRunHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.post<SiteHealth>(`/sites/${siteId}/health/check`),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['sites', siteId, 'health'] });
    },
  });
}

export function useSiteRestart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.post(`/sites/${siteId}/restart`),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['sites', siteId, 'status'] });
      qc.invalidateQueries({ queryKey: ['sites', siteId] });
    },
  });
}

export function useClearCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => api.post(`/sites/${siteId}/clear-cache`),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['sites', siteId] });
    },
  });
}

// Environment Variables
export interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  source: 'env_file' | 'database' | 'builtin';
  createdAt: string;
  updatedAt: string;
}

export function useSiteEnvVars(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'env'],
    queryFn: () => api.get<EnvVar[]>(`/sites/${siteId}/env`),
    enabled: !!siteId,
  });
}

export function useCreateEnvVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, key, value, isSecret }: { siteId: string; key: string; value: string; isSecret?: boolean }) =>
      api.post<EnvVar>(`/sites/${siteId}/env`, { key, value, isSecret }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'env'] });
    },
  });
}

export function useUpdateEnvVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, envId, key, value, isSecret }: { siteId: string; envId: string; key: string; value: string; isSecret?: boolean }) =>
      api.put<EnvVar>(`/sites/${siteId}/env/${envId}`, { key, value, isSecret }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'env'] });
    },
  });
}

export function useDeleteEnvVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, envId }: { siteId: string; envId: string }) =>
      api.delete(`/sites/${siteId}/env/${envId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'env'] });
    },
  });
}

// Deployment Settings
export interface DeploymentSettings {
  id: string;
  siteId: string;
  gitRepo: string;
  gitBranch: string;
  gitCredentials: {
    username?: string;
    password?: string;
    sshKey?: string;
  } | null;
  autoDeploy: boolean;
  deployOnPush: boolean;
  deployOnPr: boolean;
  buildCommand: string;
  installCommand: string;
  outputDirectory: string;
  deployPath: string;
  preDeployHook: string;
  postDeployHook: string;
  healthCheckPath: string;
  autoRollback: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useDeploymentSettings(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'deployment-settings'],
    queryFn: () => api.get<DeploymentSettings>(`/sites/${siteId}/deployment-settings`),
    enabled: !!siteId,
  });
}

export function useUpdateDeploymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, ...data }: { siteId: string } & Partial<DeploymentSettings>) =>
      api.put<DeploymentSettings>(`/sites/${siteId}/deployment-settings`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'deployment-settings'] });
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId] });
    },
  });
}

export interface DeploymentHook {
  id: string;
  deploymentId: string;
  type: 'pre_deploy' | 'post_deploy';
  command: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  output: string;
  createdAt: string;
}

export function useDeploymentHooks(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'deployment-hooks'],
    queryFn: () => api.get<DeploymentHook[]>(`/sites/${siteId}/deployment-hooks`),
    enabled: !!siteId,
  });
}

export function useTestWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, hookType }: { siteId: string; hookType: string }) =>
      api.post<{ success: boolean; message: string }>(`/sites/${siteId}/webhook/test`, { hookType }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'deployment-hooks'] });
    },
  });
}