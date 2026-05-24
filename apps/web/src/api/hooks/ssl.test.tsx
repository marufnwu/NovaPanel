import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSslCertificates,
  useSslCertificate,
  useExpiringCerts,
  useIssueLetsEncrypt,
  useUploadCustomCert,
  useGenerateSelfSigned,
  useDeleteCertificate,
  useRenewCertificate,
  useToggleAutoRenew,
  useDownloadCert,
  useCertDetails,
  useValidateChain,
  useCheckMixedContent,
  useUpdateHsts,
  useUpdateOcspStapling,
} from './ssl';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ssl hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useSslCertificates', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useSslCertificates(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('useSslCertificate', () => {
    it('returns query object for specific domain', () => {
      const { result } = renderHook(() => useSslCertificate('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useSslCertificate(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useExpiringCerts', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useExpiringCerts(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('returns query object with days parameter', () => {
      const { result } = renderHook(() => useExpiringCerts(30), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useIssueLetsEncrypt', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useIssueLetsEncrypt(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUploadCustomCert', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useUploadCustomCert(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useGenerateSelfSigned', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useGenerateSelfSigned(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useDeleteCertificate', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDeleteCertificate(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useRenewCertificate', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useRenewCertificate(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useToggleAutoRenew', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useToggleAutoRenew(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useDownloadCert', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useDownloadCert(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCertDetails', () => {
    it('returns query object with correct structure', () => {
      const { result } = renderHook(() => useCertDetails('domain-123'), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });

    it('renders without crashing with empty domainId', () => {
      const { result } = renderHook(() => useCertDetails(''), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useValidateChain', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useValidateChain(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useCheckMixedContent', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useCheckMixedContent(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });

  describe('useUpdateHsts', () => {
    it('returns mutation object with correct structure', () => {
      const { result } = renderHook(() => useUpdateHsts(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
      expect(result.current).toHaveProperty('isPending');
    });
  });

  describe('useUpdateOcspStapling', () => {
    it('returns mutation object', () => {
      const { result } = renderHook(() => useUpdateOcspStapling(), { wrapper: createWrapper() });
      expect(result.current).toHaveProperty('mutate');
      expect(result.current).toHaveProperty('mutateAsync');
    });
  });
});