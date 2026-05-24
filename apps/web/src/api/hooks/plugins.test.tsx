import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePlugins,
  usePlugin,
  useCreatePlugin,
  useUpdatePlugin,
  useDeletePlugin,
  useTogglePlugin,
  useUpdatePluginConfig,
} from './plugins';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('plugins hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('usePlugins', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => usePlugins(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('usePlugin', () => {
    it('returns query object for specific plugin', () => {
      const { result } = renderHook(() => usePlugin('plugin-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty id', () => {
      const { result } = renderHook(() => usePlugin(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCreatePlugin', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useCreatePlugin(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUpdatePlugin', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdatePlugin(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDeletePlugin', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeletePlugin(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useTogglePlugin', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useTogglePlugin(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useUpdatePluginConfig', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useUpdatePluginConfig(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });
});