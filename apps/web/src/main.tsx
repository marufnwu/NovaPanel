import { createRoot } from 'react-dom/client';
import { StrictMode, Component, ReactNode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import './index.css';

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
    this.setState({ info });
    console.error('React Error Boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: '#1a1a1a',
          color: '#ff6b6b',
          minHeight: '100vh',
          fontFamily: 'monospace',
        }}>
          <h1 style={{ color: '#ff4757' }}>React Error</h1>
          <pre style={{
            background: '#2d2d2d',
            padding: '16px',
            borderRadius: '8px',
            overflow: 'auto',
            maxHeight: '60vh',
          }}>
            {this.state.error?.stack || this.state.error?.message || 'Unknown error'}
          </pre>
          {this.state.info?.componentStack && (
            <details style={{ marginTop: '16px', color: '#aaa' }}>
              <summary>Component Stack</summary>
              <pre style={{ fontSize: '12px' }}>{this.state.info.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ErrorBoundary>
);