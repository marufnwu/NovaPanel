import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFirewallStatus,
  useFirewallRules,
  useAddFirewallRule,
  useDeleteFirewallRule,
  useApplyFirewallPreset,
  useToggleFirewall,
  useFail2BanJails,
  useUnbanIp,
  useBanIp,
  useResetFirewallRules,
  useToggleRule,
} from './firewall';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('firewall hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFirewallStatus', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useFirewallStatus(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useFirewallRules', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useFirewallRules(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useAddFirewallRule', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useAddFirewallRule(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteFirewallRule', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteFirewallRule(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useApplyFirewallPreset', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useApplyFirewallPreset(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useToggleFirewall', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useToggleFirewall(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useFail2BanJails', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useFail2BanJails(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useUnbanIp', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUnbanIp(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useBanIp', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useBanIp(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useResetFirewallRules', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useResetFirewallRules(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useToggleRule', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useToggleRule(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });
});