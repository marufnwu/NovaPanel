import { createRoot } from 'react-dom/client';
import { Component, ReactNode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import './index.css';

window.addEventListener('error', (event) => {
  if (event.message?.includes?.('Invariant') || event.message?.includes?.('useSyncExternalStore')) {
    event.preventDefault();
    document.getElementById('root')!.innerHTML = `
      <div style="padding:20px;background:#1a1a1a;color:#ff6b6b;min-height:100vh;font-family:monospace;">
        <h1 style="color:#ff4757">useSyncExternalStore Error</h1>
        <pre style="background:#2d2d2d;padding:16px;border-radius:8px;overflow:auto;max-height:60vh;">${event.message}</pre>
        <pre style="background:#333;padding:16px;margin-top:16px;border-radius:8px;font-size:12px;">${event.error?.stack || 'No stack'}</pre>
      </div>
    `;
  }
});

class ErrorBoundary extends Component<
  { children?: ReactNode },
  { hasError: boolean; error: Error | null; info?: React.ErrorInfo }
> {
  constructor(props: { children?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#1a1a1a', color: '#ff6b6b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#ff4757' }}>React Error</h1>
          <pre style={{ background: '#2d2d2d', padding: '16px', borderRadius: '8px', overflow: 'auto', maxHeight: '60vh' }}>
            {this.state.error?.stack || this.state.error?.message || 'Unknown error'}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ErrorBoundary>
);