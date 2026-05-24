import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePhpVersions,
  usePhpDomains,
  usePhpConfig,
  useSetPhpVersion,
  useUpdatePoolSettings,
  useUpdatePhpLimits,
  useUpdatePhpSecurity,
  useRestartFpm,
  useInstallPhp,
  usePhpIni,
  useUpdatePhpIni,
  usePhpInfo,
  useFpmStatus,
} from './php';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('php hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('usePhpVersions', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePhpVersions(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('usePhpDomains', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePhpDomains(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('usePhpConfig', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePhpConfig('example.com'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainName', () => {
      const { result } = renderHook(() => usePhpConfig(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useSetPhpVersion', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useSetPhpVersion(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUpdatePoolSettings', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdatePoolSettings(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useUpdatePhpLimits', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdatePhpLimits(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useUpdatePhpSecurity', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdatePhpSecurity(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useRestartFpm', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useRestartFpm(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useInstallPhp', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useInstallPhp(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('usePhpIni', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePhpIni('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => usePhpIni(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useUpdatePhpIni', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useUpdatePhpIni(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('usePhpInfo', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePhpInfo('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => usePhpInfo(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useFpmStatus', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useFpmStatus('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useFpmStatus(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });
});