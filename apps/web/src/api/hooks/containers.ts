import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Container {
  id: string;
  orgId: string;
  name: string;
  type: 'compose' | 'dockerfile' | 'image';
  status: 'running' | 'stopped' | 'restarting' | 'exited';
  image?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateContainerPayload {
  name: string;
  type: 'compose' | 'dockerfile' | 'image';
  composeFile?: string;
  dockerfile?: string;
  image?: string;
  env?: Record<string, string>;
  secrets?: string[];
  networkMode?: string;
  exposedPorts?: number[];
  cpuLimit?: number;
  memoryLimit?: number;
  replicas?: number;
}

export interface UpdateContainerPayload {
  name?: string;
  composeFile?: string;
  dockerfile?: string;
  image?: string;
  env?: Record<string, string>;
  secrets?: string[];
  networkMode?: string;
  exposedPorts?: number[];
  cpuLimit?: number;
  memoryLimit?: number;
  replicas?: number;
}

export function useContainers(orgId?: string) {
  return useQuery({
    queryKey: ['containers', orgId || 'all'],
    queryFn: () => orgId 
      ? api.get<Container[]>(`/containers?orgId=${orgId}`)
      : api.get<Container[]>('/containers'),
    enabled: true,
  });
}

export function useContainer(id: string) {
  return useQuery({
    queryKey: ['containers', id],
    queryFn: () => api.get<Container>(`/containers/${id}`),
    enabled: !!id,
  });
}

export function useCreateContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContainerPayload) => api.post<Container>('/containers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useUpdateContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateContainerPayload) =>
      api.put<Container>(`/containers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useDeleteContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/containers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useStartContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/containers/${id}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useStopContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/containers/${id}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useRestartContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/containers/${id}/restart`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useContainerLogs(id: string, lines: number = 200) {
  return useQuery({
    queryKey: ['containers', id, 'logs', lines],
    queryFn: () => api.get<{ logs: string }>(`/containers/${id}/logs?lines=${lines}`),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export interface ContainerStats {
  cpu: number;
  memory: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
}

export function useContainerStats(id: string) {
  return useQuery({
    queryKey: ['containers', id, 'stats'],
    queryFn: () => api.get<ContainerStats>(`/containers/${id}/stats`),
    enabled: !!id,
    refetchInterval: 2000,
  });
}

export interface PortMapping {
  containerPort: string;
  hostPort: string;
  protocol: string;
}

export interface PortInfo {
  port: string;
  protocol: string;
}

export interface ContainerPorts {
  portMappings: PortMapping[];
  exposedPorts: PortInfo[];
}

export function useContainerPorts(id: string) {
  return useQuery({
    queryKey: ['containers', id, 'ports'],
    queryFn: () => api.get<ContainerPorts>(`/containers/${id}/ports`),
    enabled: !!id,
  });
}
