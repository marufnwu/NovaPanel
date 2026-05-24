import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAccessLogs,
  useErrorLogs,
  usePanelLogs,
  useFail2banLogs,
  useAuthLogs,
  useSystemLogs,
} from './logs';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('logs hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAccessLogs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useAccessLogs('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useAccessLogs(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with custom line count', () => {
      const { result } = renderHook(() => useAccessLogs('domain-123', 200), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useErrorLogs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useErrorLogs('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useErrorLogs(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('usePanelLogs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePanelLogs(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('renders without crashing with custom line count', () => {
      const { result } = renderHook(() => usePanelLogs(200), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useFail2banLogs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useFail2banLogs(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useAuthLogs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useAuthLogs(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useSystemLogs', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useSystemLogs(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });
});