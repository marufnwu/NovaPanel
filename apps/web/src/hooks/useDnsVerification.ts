import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DomainDnsVerification } from '../api/hooks/domains';

export interface UseDnsVerificationOptions {
  onSuccess?: (data: DomainDnsVerification) => void;
  onError?: (error: Error) => void;
}

export function useDnsVerification(options?: UseDnsVerificationOptions) {
  return useMutation({
    mutationFn: (domain: string) =>
      api.get<DomainDnsVerification>(`/domains/verify-dns?domain=${encodeURIComponent(domain)}`),
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
