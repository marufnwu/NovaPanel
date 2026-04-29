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

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  pendingTwoFactor: boolean;
  pendingUserId: string | null;
  sessionHash: string | null;
  setUser: (user: AuthUser, sessionHash?: string) => void;
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
      setUser: (user, sessionHash) =>
        set({ user, isAuthenticated: true, pendingTwoFactor: false, pendingUserId: null, sessionHash: sessionHash || null }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setPendingTwoFactor: (userId) =>
        set({ pendingTwoFactor: true, pendingUserId: userId, isAuthenticated: false }),
      clearPendingTwoFactor: () =>
        set({ pendingTwoFactor: false, pendingUserId: null }),
      logout: () =>
        set({ user: null, isAuthenticated: false, pendingTwoFactor: false, pendingUserId: null, sessionHash: null }),
    }),
    { name: 'sf-auth' }
  )
);
