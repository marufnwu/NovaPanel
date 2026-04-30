import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  permissions: string[];
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiToken extends ApiToken {
  token: string; // Only available immediately after creation
}

export interface TokenUsageEntry {
  id: string;
  tokenId: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface CreateTokenPayload {
  name: string;
  expiresIn: '30d' | '90d' | '1y' | 'never';
  permissions: string[];
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useTokens() {
  return useQuery({
    queryKey: ['tokens'],
    queryFn: () => api.get<ApiToken[]>('/tokens'),
  });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTokenPayload) =>
      api.post<CreatedApiToken>('/tokens', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) =>
      api.delete(`/tokens/${tokenId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}

export function useTokenUsage(tokenId: string | null) {
  return useQuery({
    queryKey: ['tokens', tokenId, 'usage'],
    queryFn: () => api.get<TokenUsageEntry[]>(`/tokens/${tokenId}/usage`),
    enabled: !!tokenId,
  });
}
