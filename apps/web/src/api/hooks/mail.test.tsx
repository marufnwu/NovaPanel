import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMailDomainInfo,
  useMailboxes,
  useMailAliases,
  useDkimStatus,
  useMailQueue,
  useEnableMail,
  useDisableMail,
  useCreateMailbox,
  useUpdateMailbox,
  useDeleteMailbox,
  useCreateAlias,
  useDeleteAlias,
  useGenerateDKIM,
  useSetSPF,
  useSetDMARC,
  useSetCatchAll,
  useSetSpamAssassin,
} from './mail';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('mail hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useMailDomainInfo', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useMailDomainInfo('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useMailDomainInfo(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useMailboxes', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useMailboxes('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useMailboxes(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useMailAliases', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useMailAliases('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useMailAliases(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useDkimStatus', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useDkimStatus('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useDkimStatus(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useMailQueue', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useMailQueue('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useMailQueue(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useEnableMail', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useEnableMail(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDisableMail', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDisableMail(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCreateMailbox', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateMailbox(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUpdateMailbox', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateMailbox(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDeleteMailbox', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteMailbox(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCreateAlias', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateAlias(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteAlias', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteAlias(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useGenerateDKIM', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useGenerateDKIM(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useSetSPF', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useSetSPF(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useSetDMARC', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useSetDMARC(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useSetCatchAll', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useSetCatchAll(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useSetSpamAssassin', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useSetSpamAssassin(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });
});