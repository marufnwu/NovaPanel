import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useJobs,
  useJob,
  useCancelJob,
  useRefreshJobs,
} from './jobs';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('jobs hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useJobs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useJobs(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('returns query object with status filter', () => {
      const { result } = renderHook(() => useJobs({ status: 'pending' }), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('returns query object with type filter', () => {
      const { result } = renderHook(() => useJobs({ type: 'deploy' }), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('returns query object with limit and offset', () => {
      const { result } = renderHook(() => useJobs({ limit: 10, offset: 5 }), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useJob', () => {
    it('returns query object for specific job', () => {
      const { result } = renderHook(() => useJob('job-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty id', () => {
      const { result } = renderHook(() => useJob(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCancelJob', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useCancelJob(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useRefreshJobs', () => {
    it('returns a function', () => {
      const { result } = renderHook(() => useRefreshJobs(), { wrapper: createWrapper() });
      expect(typeof result.current).toBe('function');
    });
  });
});