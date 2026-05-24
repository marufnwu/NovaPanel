import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useBackups,
  useCreateBackup,
  useRestoreBackup,
  useDeleteBackup,
  useVerifyBackup,
  useBackupSchedules,
  useCreateBackupSchedule,
  useDeleteBackupSchedule,
  useToggleBackupSchedule,
  useRemoteStorageConfig,
  useUpdateRemoteStorage,
} from './backup';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('backup hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useBackups', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useBackups(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('returns query object with domainId filter', () => {
      const { result } = renderHook(() => useBackups('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCreateBackup', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateBackup(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useRestoreBackup', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useRestoreBackup(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDeleteBackup', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteBackup(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useVerifyBackup', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useVerifyBackup(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useBackupSchedules', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useBackupSchedules(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useCreateBackupSchedule', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateBackupSchedule(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteBackupSchedule', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteBackupSchedule(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useToggleBackupSchedule', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useToggleBackupSchedule(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useRemoteStorageConfig', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useRemoteStorageConfig(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useUpdateRemoteStorage', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateRemoteStorage(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });
});