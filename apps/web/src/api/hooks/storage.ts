import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Bucket {
  id: string;
  projectId: string;
  name: string;
  region?: string;
  publicAccess: boolean;
  versioning: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AccessKey {
  id: string;
  projectId: string;
  name: string;
  accessKey: string;
  secretKey: string;
  permissions: string[];
  createdAt: string;
}

export interface CreateBucketPayload {
  projectId: string;
  name: string;
  region?: string;
  publicAccess?: boolean;
  versioning?: boolean;
  corsRules?: unknown[];
}

export interface UpdateBucketPayload {
  name?: string;
  publicAccess?: boolean;
  versioning?: boolean;
  corsRules?: unknown[];
}

export interface CreateAccessKeyPayload {
  projectId: string;
  name: string;
  permissions?: string[];
}

export function useBuckets(projectId: string) {
  return useQuery({
    queryKey: ['buckets', projectId],
    queryFn: () => api.get<Bucket[]>(`/buckets?projectId=${projectId}`),
    enabled: !!projectId,
  });
}

export function useBucket(id: string) {
  return useQuery({
    queryKey: ['buckets', id],
    queryFn: () => api.get<Bucket>(`/buckets/${id}`),
    enabled: !!id,
  });
}

export function useCreateBucket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBucketPayload) => api.post<Bucket>('/buckets', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buckets'] });
    },
  });
}

export function useUpdateBucket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateBucketPayload) =>
      api.put<Bucket>(`/buckets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buckets'] });
    },
  });
}

export function useDeleteBucket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/buckets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buckets'] });
    },
  });
}

export function useAccessKeys(projectId: string) {
  return useQuery({
    queryKey: ['access-keys', projectId],
    queryFn: () => api.get<AccessKey[]>(`/access-keys?projectId=${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateAccessKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAccessKeyPayload) => api.post<AccessKey>('/access-keys', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-keys'] });
    },
  });
}

export function useDeleteAccessKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/access-keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-keys'] });
    },
  });
}