import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCronJobs,
  useCronJob,
  useCreateCronJob,
  useUpdateCronJob,
  useDeleteCronJob,
  useToggleCronJob,
  useRunCronJob,
  useCronHistory,
} from './cron';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('cron hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCronJobs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useCronJobs(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('returns query object with domainId filter', () => {
      const { result } = renderHook(() => useCronJobs('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCronJob', () => {
    it('returns query object for specific job', () => {
      const { result } = renderHook(() => useCronJob('job-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty id', () => {
      const { result } = renderHook(() => useCronJob(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCreateCronJob', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateCronJob(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUpdateCronJob', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateCronJob(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDeleteCronJob', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteCronJob(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useToggleCronJob', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useToggleCronJob(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useRunCronJob', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useRunCronJob(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCronHistory', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useCronHistory('job-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty jobId', () => {
      const { result } = renderHook(() => useCronHistory(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });
});