import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/store/auth.store';

describe('Auth Store', () => {
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

  describe('Initial State', () => {
    it('has null user by default', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('is not authenticated by default', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('has no pending two factor by default', () => {
      const state = useAuthStore.getState();
      expect(state.pendingTwoFactor).toBe(false);
      expect(state.pendingUserId).toBeNull();
    });

    it('has empty organizations by default', () => {
      const state = useAuthStore.getState();
      expect(state.organizations).toHaveLength(0);
      expect(state.activeOrgId).toBeNull();
    });
  });

  describe('setUser', () => {
    it('sets user and marks as authenticated', () => {
      const mockUser = {
        id: '1',
        username: 'admin',
        email: 'admin@test.com',
        role: 'admin' as const,
        displayName: null,
        twoFactorEnabled: false,
        mustChangePassword: false,
      };

      useAuthStore.getState().setUser(mockUser, 'hash123', [], 'org-1');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.sessionHash).toBe('hash123');
    });

    it('sets organizations when provided', () => {
      const orgs = [
        { id: 'org-1', name: 'Org 1', slug: 'org-1', plan: 'pro' as const, status: 'active' as const },
        { id: 'org-2', name: 'Org 2', slug: 'org-2', plan: 'starter' as const, status: 'active' as const },
      ];

      useAuthStore.getState().setUser(
        { id: '1', username: 'admin', email: 'a@a.com', role: 'admin' as const, displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        'hash',
        orgs,
        'org-2'
      );

      const state = useAuthStore.getState();
      expect(state.organizations).toHaveLength(2);
      expect(state.activeOrgId).toBe('org-2');
    });

    it('clears pending two factor on setUser', () => {
      useAuthStore.setState({ pendingTwoFactor: true, pendingUserId: 'user-123' });

      useAuthStore.getState().setUser(
        { id: '1', username: 'admin', email: 'a@a.com', role: 'admin' as const, displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        'hash'
      );

      const state = useAuthStore.getState();
      expect(state.pendingTwoFactor).toBe(false);
      expect(state.pendingUserId).toBeNull();
    });

    it('defaults activeOrgId to first organization when not specified', () => {
      const orgs = [
        { id: 'org-1', name: 'Org 1', slug: 'org-1', plan: 'pro' as const, status: 'active' as const },
      ];

      useAuthStore.getState().setUser(
        { id: '1', username: 'admin', email: 'a@a.com', role: 'admin' as const, displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        'hash',
        orgs
      );

      const state = useAuthStore.getState();
      expect(state.activeOrgId).toBe('org-1');
    });
  });

  describe('updateUser', () => {
    it('updates user fields', () => {
      useAuthStore.setState({
        user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin' as const, displayName: null, twoFactorEnabled: false, mustChangePassword: false },
        isAuthenticated: true,
      });

      useAuthStore.getState().updateUser({ displayName: 'Admin User', twoFactorEnabled: true });

      const state = useAuthStore.getState();
      expect(state.user?.displayName).toBe('Admin User');
      expect(state.user?.twoFactorEnabled).toBe(true);
      expect(state.user?.email).toBe('admin@test.com');
    });

    it('does nothing when user is null', () => {
      useAuthStore.setState({ user: null });
      expect(() => useAuthStore.getState().updateUser({ displayName: 'test' })).not.toThrow();
    });
  });

  describe('setPendingTwoFactor', () => {
    it('sets pending two factor state', () => {
      useAuthStore.getState().setPendingTwoFactor('user-456');

      const state = useAuthStore.getState();
      expect(state.pendingTwoFactor).toBe(true);
      expect(state.pendingUserId).toBe('user-456');
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('clearPendingTwoFactor', () => {
    it('clears pending two factor state', () => {
      useAuthStore.setState({ pendingTwoFactor: true, pendingUserId: 'user-456' });

      useAuthStore.getState().clearPendingTwoFactor();

      const state = useAuthStore.getState();
      expect(state.pendingTwoFactor).toBe(false);
      expect(state.pendingUserId).toBeNull();
    });
  });

  describe('setActiveOrg', () => {
    it('updates active organization', () => {
      useAuthStore.setState({
        organizations: [
          { id: 'org-1', name: 'Org 1', slug: 'org-1', plan: 'pro' as const, status: 'active' as const },
          { id: 'org-2', name: 'Org 2', slug: 'org-2', plan: 'starter' as const, status: 'active' as const },
        ],
        activeOrgId: 'org-1',
      });

      useAuthStore.getState().setActiveOrg('org-2');

      const state = useAuthStore.getState();
      expect(state.activeOrgId).toBe('org-2');
    });
  });

  describe('logout', () => {
    it('clears all auth state', () => {
      useAuthStore.setState({
        user: { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin' as const, displayName: null, twoFactorEnabled: false, mustChangePassword: false },
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
  });
});