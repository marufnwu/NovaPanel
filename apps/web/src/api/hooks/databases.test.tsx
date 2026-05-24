import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDatabases,
  useDatabaseInfo,
  useCreateDatabase,
  useDeleteDatabase,
  useCreateDbUser,
  useDeleteDbUser,
  useChangeDbPassword,
  useExportDatabase,
  useImportDatabase,
  useRepairDatabase,
  useOptimizeDatabase,
  useCloneDatabase,
  useRunQuery,
} from './databases';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('databases hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDatabases', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useDatabases(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useDatabaseInfo', () => {
    it('returns query object for specific database', () => {
      const { result } = renderHook(() => useDatabaseInfo('db-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty id', () => {
      const { result } = renderHook(() => useDatabaseInfo(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCreateDatabase', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteDatabase', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCreateDbUser', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreateDbUser(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteDbUser', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteDbUser(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useChangeDbPassword', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useChangeDbPassword(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useExportDatabase', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useExportDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useImportDatabase', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useImportDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useRepairDatabase', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useRepairDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useOptimizeDatabase', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useOptimizeDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCloneDatabase', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCloneDatabase(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useRunQuery', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useRunQuery(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });
});