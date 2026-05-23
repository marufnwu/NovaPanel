import { describe, it, expect, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({
    user: {
      id: '1',
      email: 'admin@test.com',
      name: 'Test Admin',
      role: 'admin' as const,
      displayName: 'Test Admin',
      twoFactorEnabled: false,
      mustChangePassword: false,
    },
    isAuthenticated: true,
  }),
}));

export function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

export { screen, cleanup };