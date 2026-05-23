import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogin, useLogout, useMe } from './auth';
import { useAuthStore } from '../../store/auth.store';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('auth hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      pendingTwoFactor: false,
      pendingUserId: null,
      sessionHash: null,
      organizations: [],
      activeOrgId: null,
    });
  });

  describe('useLogin', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useLogout', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useMe', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useMe(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });
});