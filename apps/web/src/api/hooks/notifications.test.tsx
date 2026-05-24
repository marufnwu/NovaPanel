import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from './notifications';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('notifications hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useNotificationPreferences', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useNotificationPreferences(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useUpdateNotificationPreferences', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useUpdateNotificationPreferences(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useNotifications', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('returns query object with custom limit and offset', () => {
      const { result } = renderHook(() => useNotifications(25, 10), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useUnreadCount', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useMarkAsRead', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useMarkAsRead(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useMarkAllAsRead', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useMarkAllAsRead(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDeleteNotification', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteNotification(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });
});