import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBar } from './StatusBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('StatusBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<StatusBar />, { wrapper: createWrapper() });
    expect(container).toBeTruthy();
  });

  it('has h-9 class', () => {
    const { container } = render(<StatusBar />, { wrapper: createWrapper() });
    expect(container.querySelector('.h-9')).toBeInTheDocument();
  });

  it('has bg-background-secondary', () => {
    const { container } = render(<StatusBar />, { wrapper: createWrapper() });
    expect(container.querySelector('.bg-background-secondary')).toBeInTheDocument();
  });

  it('has border-b', () => {
    const { container } = render(<StatusBar />, { wrapper: createWrapper() });
    expect(container.querySelector('.border-b')).toBeInTheDocument();
  });

  it('has text-small class', () => {
    const { container } = render(<StatusBar />, { wrapper: createWrapper() });
    expect(container.querySelector('.text-small')).toBeInTheDocument();
  });

  it('has flex class', () => {
    const { container } = render(<StatusBar />, { wrapper: createWrapper() });
    expect(container.querySelector('.flex')).toBeInTheDocument();
  });
});