import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDnsZone,
  useCreateDnsRecord,
  useUpdateDnsRecord,
  useDeleteDnsRecord,
  useImportZone,
  useExportZone,
  useResetDnsZone,
  useRawZone,
  usePropagationCheck,
  useUpdateSoaRecord,
  useCloudflareConfig,
  useUpdateCloudflareConfig,
  useSyncCloudflareRecords,
} from './dns';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('dns hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDnsZone', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useDnsZone('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useDnsZone(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCreateDnsRecord', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateDnsRecord(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUpdateDnsRecord', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateDnsRecord(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDeleteDnsRecord', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteDnsRecord(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useImportZone', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useImportZone(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useExportZone', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useExportZone('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useExportZone(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useResetDnsZone', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useResetDnsZone(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useRawZone', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useRawZone('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useRawZone(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('usePropagationCheck', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePropagationCheck('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => usePropagationCheck(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useUpdateSoaRecord', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateSoaRecord(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCloudflareConfig', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useCloudflareConfig('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useCloudflareConfig(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useUpdateCloudflareConfig', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateCloudflareConfig(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useSyncCloudflareRecords', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useSyncCloudflareRecords(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });
});