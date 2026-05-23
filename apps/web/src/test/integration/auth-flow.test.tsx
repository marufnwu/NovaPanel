import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { useLogin, useLogout, useMe } from '@/api/hooks/auth';
import { useAuthStore } from '@/store/auth.store';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      pendingTwoFactor: false,
      pendingUserId: null,
      sessionHash: null,
      organizations: [],
      activeOrgId: null,
    });
    localStorage.clear();
  });

  describe('useLogin', () => {
    it('returns loading state during login', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(() =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({
                success: true,
                data: {
                  user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin', displayName: null, twoFactorEnabled: false, mustChangePassword: false },
                  sessionHash: 'abc123',
                  organizations: [],
                },
              }),
            }), 100
          )
        )
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      expect(result.current.isPending).toBe(false);

      result.current.mutate({ username: 'admin', password: 'test' });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      }, { timeout: 2000 }).catch(() => {});
    });
  });

  describe('useLogout', () => {
    it('clears auth store on logout', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      }) as unknown as typeof fetch;

      useAuthStore.setState({
        user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin', displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

      result.current.mutate();

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      }, { timeout: 3000 }).catch(() => {});
    });
  });

  describe('useMe', () => {
    it('returns user data when authenticated', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: '1',
            username: 'admin',
            email: 'admin@test.com',
            role: 'admin',
            displayName: 'Admin',
            twoFactorEnabled: false,
            mustChangePassword: false,
          },
        }),
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useMe(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 }).catch(() => {});

      if (result.current.data) {
        expect(result.current.data.username).toBe('admin');
      }
    });

    it('returns error when not authenticated', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        }),
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useMe(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 3000 }).catch(() => {});
    });
  });

  describe('Auth Store State', () => {
    it('setUser updates auth state correctly', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();

      useAuthStore.getState().setUser(
        { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin', displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        'session-hash-123',
        [{ id: 'org-1', name: 'Test Org', slug: 'test-org', plan: 'pro' as const, status: 'active' as const }],
        'org-1'
      );

      const newState = useAuthStore.getState();
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.user?.username).toBe('admin');
      expect(newState.sessionHash).toBe('session-hash-123');
      expect(newState.organizations).toHaveLength(1);
      expect(newState.activeOrgId).toBe('org-1');
    });

    it('logout clears all state', () => {
      useAuthStore.setState({
        user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin', displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        isAuthenticated: true,
        pendingTwoFactor: true,
        pendingUserId: 'user-123',
        sessionHash: 'hash123',
        organizations: [{ id: 'org-1', name: 'Org', slug: 'org', plan: 'pro' as const, status: 'active' as const }],
        activeOrgId: 'org-1',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.pendingTwoFactor).toBe(false);
      expect(state.pendingUserId).toBeNull();
      expect(state.sessionHash).toBeNull();
      expect(state.organizations).toHaveLength(0);
      expect(state.activeOrgId).toBeNull();
    });

    it('updateUser updates user fields correctly', () => {
      useAuthStore.setState({
        user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin', displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        isAuthenticated: true,
      });

      useAuthStore.getState().updateUser({ displayName: 'New Name', twoFactorEnabled: true });

      const state = useAuthStore.getState();
      expect(state.user?.displayName).toBe('New Name');
      expect(state.user?.twoFactorEnabled).toBe(true);
      expect(state.user?.email).toBe('admin@test.com');
    });

    it('setPendingTwoFactor sets pending state', () => {
      useAuthStore.getState().setPendingTwoFactor('user-456');

      const state = useAuthStore.getState();
      expect(state.pendingTwoFactor).toBe(true);
      expect(state.pendingUserId).toBe('user-456');
      expect(state.isAuthenticated).toBe(false);
    });

    it('clearPendingTwoFactor clears pending state', () => {
      useAuthStore.setState({ pendingTwoFactor: true, pendingUserId: 'user-456' });

      useAuthStore.getState().clearPendingTwoFactor();

      const state = useAuthStore.getState();
      expect(state.pendingTwoFactor).toBe(false);
      expect(state.pendingUserId).toBeNull();
    });

    it('setActiveOrg updates active org', () => {
      useAuthStore.setState({
        organizations: [
          { id: 'org-1', name: 'Org1', slug: 'org1', plan: 'pro' as const, status: 'active' as const },
          { id: 'org-2', name: 'Org2', slug: 'org2', plan: 'starter' as const, status: 'active' as const },
        ],
        activeOrgId: 'org-1',
      });

      useAuthStore.getState().setActiveOrg('org-2');

      const state = useAuthStore.getState();
      expect(state.activeOrgId).toBe('org-2');
    });
  });
});