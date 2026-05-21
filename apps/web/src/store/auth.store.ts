import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin';
  displayName: string | null;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  createdAt?: string | Date;
  updatedAt?: string | Date | null;
  role?: 'owner' | 'admin' | 'member' | 'billing';
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  pendingTwoFactor: boolean;
  pendingUserId: string | null;
  sessionHash: string | null;
  organizations: Organization[];
  activeOrgId: string | null;
  setUser: (user: AuthUser, sessionHash?: string, organizations?: Organization[], activeOrgId?: string) => void;
  setActiveOrg: (orgId: string) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setPendingTwoFactor: (userId: string) => void;
  clearPendingTwoFactor: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      pendingTwoFactor: false,
      pendingUserId: null,
      sessionHash: null,
      organizations: [],
      activeOrgId: null,
      setUser: (user, sessionHash, organizations = [], activeOrgId) =>
        set({
          user,
          isAuthenticated: true,
          pendingTwoFactor: false,
          pendingUserId: null,
          sessionHash: sessionHash || null,
          organizations,
          activeOrgId: activeOrgId || (organizations[0]?.id ?? null),
        }),
      setActiveOrg: (orgId) =>
        set((state) => ({
          activeOrgId: orgId,
        })),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setPendingTwoFactor: (userId) =>
        set({ pendingTwoFactor: true, pendingUserId: userId, isAuthenticated: false }),
      clearPendingTwoFactor: () =>
        set({ pendingTwoFactor: false, pendingUserId: null }),
      logout: () =>
        set({ user: null, isAuthenticated: false, pendingTwoFactor: false, pendingUserId: null, sessionHash: null, organizations: [], activeOrgId: null }),
    }),
    { name: 'sf-auth' }
  )
);
