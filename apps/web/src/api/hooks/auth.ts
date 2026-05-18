import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useAuthStore } from '../../store/auth.store';

// --- Types ---

interface LoginResponse {
  sessionId?: string;
  sessionHash?: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: 'admin';
    displayName: string | null;
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
  };
  requiresTwoFactor?: boolean;
  userId?: string;
  lockedUntil?: string;
  remainingAttempts?: number;
}

interface MeResponse {
  id: string;
  username: string;
  email: string;
  role: 'admin';
  displayName: string | null;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
}

interface Enable2FAResponse {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}

interface SessionInfo {
  id: string;
  createdAt: string;
  lastAccessedAt: string;
  browser: string;
  os: string;
  isCurrent: boolean;
}

interface ApiTokenResponse {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
}

// --- Login Hooks ---

export function useLogin() {
  const { setUser, setPendingTwoFactor } = useAuthStore();
  return useMutation({
    mutationFn: (data: { username: string; password: string; rememberMe?: boolean }) =>
      api.post<LoginResponse>('/auth/login', data),
    onSuccess: (data) => {
      if (data.requiresTwoFactor && data.userId) {
        setPendingTwoFactor(data.userId);
      } else if (data.user) {
        setUser(data.user as any, data.sessionHash);
      }
    },
  });
}

export function useLogin2FA() {
  const { setUser, clearPendingTwoFactor } = useAuthStore();
  return useMutation({
    mutationFn: (data: {
      username: string;
      password: string;
      twoFactorCode?: string;
      backupCode?: string;
      rememberMe?: boolean;
    }) => api.post<LoginResponse>('/auth/login', data),
    onSuccess: (data) => {
      if (data.user) {
        setUser(data.user as any, data.sessionHash);
        clearPendingTwoFactor();
      }
    },
  });
}

export function useLogout() {
  const { logout: storeLogout } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout').catch(() => {}),
    onSettled: () => {
      storeLogout();
      queryClient.clear();
    },
  });
}

// --- Current User ---

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<MeResponse>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// --- 2FA Hooks ---

export function useEnable2FA() {
  return useMutation({
    mutationFn: () => api.post<Enable2FAResponse>('/auth/2fa/enable'),
  });
}

export function useVerify2FA() {
  const { updateUser } = useAuthStore();
  return useMutation({
    mutationFn: (data: { code: string; secret: string }) =>
      api.post<{ enabled: boolean }>('/auth/2fa/verify', data),
    onSuccess: (data) => {
      if (data.enabled) {
        updateUser({ twoFactorEnabled: true });
      }
    },
  });
}

export function useDisable2FA() {
  const { updateUser } = useAuthStore();
  return useMutation({
    mutationFn: (data: { password: string }) =>
      api.post<{ disabled: boolean }>('/auth/2fa/disable', data),
    onSuccess: (data) => {
      if (data.disabled) {
        updateUser({ twoFactorEnabled: false });
      }
    },
  });
}

// --- Profile Hooks ---

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put<{ success: boolean }>('/auth/password', data),
  });
}

export function useChangeEmail() {
  const { updateUser } = useAuthStore();
  return useMutation({
    mutationFn: (data: { newEmail: string; password: string }) =>
      api.put<{ email: string }>('/auth/email', data),
    onSuccess: (data) => {
      updateUser({ email: data.email });
    },
  });
}

export function useUpdateProfile() {
  const { updateUser } = useAuthStore();
  return useMutation({
    mutationFn: (data: { displayName?: string }) =>
      api.put<{ displayName: string | null }>('/auth/profile', data),
    onSuccess: (data) => {
      updateUser({ displayName: data.displayName });
    },
  });
}

// --- Session Hooks ---

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => api.get<SessionInfo[]>('/auth/sessions'),
    staleTime: 30 * 1000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
  });
}

export function useRevokeAllOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/auth/sessions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
  });
}

// --- Password Reset ---

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: { email: string }) =>
      api.post<{ message: string; resetToken?: string }>('/auth/forgot-password', data),
  });
}

export function useVerifyResetToken() {
  return useMutation({
    mutationFn: (data: { token: string }) =>
      api.post<{ valid: boolean; email?: string }>('/auth/verify-reset-token', data),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
      api.post<{ success: boolean }>('/auth/reset-password', data),
  });
}

// NOTE: useGenerateApiToken was removed - API tokens are now managed via
// the dedicated /tokens endpoint. Use useCreateToken from './tokens' instead.
