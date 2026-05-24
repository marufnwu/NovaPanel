import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDomains, useDomain, useCreateDomain, useDeleteDomain, useSubdomains, useAliases, useRedirects } from './domains';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('domains hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDomains', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useDomains(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('returns query object with search parameter', () => {
      const { result } = renderHook(() => useDomains('test'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useDomain', () => {
    it('returns query object for specific domain', () => {
      const { result } = renderHook(() => useDomain('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty id', () => {
      const { result } = renderHook(() => useDomain(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCreateDomain', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateDomain(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteDomain', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteDomain(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useSubdomains', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useSubdomains('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useSubdomains(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useAliases', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useAliases('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useAliases(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useRedirects', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useRedirects('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useRedirects(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });
});