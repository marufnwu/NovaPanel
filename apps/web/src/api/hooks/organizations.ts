import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useAuthStore } from '../../store/auth.store';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  createdAt?: string | Date;
  updatedAt?: string | Date | null;
  role?: 'owner' | 'admin' | 'member' | 'billing';
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; slug: string }) => api.post<Organization>('/organizations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organizations', id],
    queryFn: () => api.get<Organization>(`/organizations/${id}`),
    enabled: !!id,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Organization>) =>
      api.put<Organization>(`/organizations/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['organizations', variables.id] });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useSwitchOrganization() {
  const { setActiveOrg, setUser } = useAuthStore();
  return useMutation({
    mutationFn: (orgId: string) => api.post<{ orgId: string; name: string; slug: string; role: string }>('/auth/switch-org', { orgId }),
    onSuccess: (data) => {
      setActiveOrg(data.orgId);
    },
  });
}

export interface OrgMember {
  id: string;
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  role: 'owner' | 'admin' | 'member' | 'billing';
  permissions: string[];
  joinedAt: string | Date;
}

export function useOrganizationMembers(orgId: string) {
  return useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => api.get<OrgMember[]>(`/organizations/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function useInviteOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, email, role }: { orgId: string; email: string; role: string }) =>
      api.post(`/organizations/${orgId}/members`, { email, role }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['organizations', variables.orgId, 'members'] });
    },
  });
}

export function useRemoveOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      api.delete(`/organizations/${orgId}/members/${userId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['organizations', variables.orgId, 'members'] });
    },
  });
}