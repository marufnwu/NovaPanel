import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Bucket {
  id: string;
  orgId: string;
  name: string;
  region?: string;
  publicAccess: boolean;
  versioning: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AccessKey {
  id: string;
  orgId: string;
  name: string;
  accessKey: string;
  secretKey: string;
  permissions: string[];
  createdAt: string;
}

export interface CreateBucketPayload {
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
  name: string;
  permissions?: string[];
}

export function useBuckets(orgId: string) {
  return useQuery({
    queryKey: ['buckets', orgId],
    queryFn: () => api.get<Bucket[]>(`/buckets`),
    enabled: !!orgId,
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

export function useAccessKeys(orgId: string) {
  return useQuery({
    queryKey: ['access-keys', orgId],
    queryFn: () => api.get<AccessKey[]>(`/access-keys`),
    enabled: !!orgId,
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
