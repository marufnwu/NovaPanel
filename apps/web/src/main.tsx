import { createRoot } from 'react-dom/client';
import { Component, ReactNode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import './index.css';

window.onerror = function(msg, src, line, col, err) {
  const msgStr = String(msg);
  if (msgStr.includes('useSyncExternalStore') || msgStr.includes('Invariant')) {
    document.getElementById('root')!.innerHTML = `
      <div style="padding:20px;background:#1a1a1a;color:#ff6b6b;min-height:100vh;font-family:monospace;font-size:14px;">
        <h1 style="color:#ff4757;font-size:24px;">useSyncExternalStore Error</h1>
        <p><strong>Message:</strong> ${msgStr}</p>
        <p><strong>Source:</strong> ${src}</p>
        <p><strong>Line:</strong> ${line}:${col}</p>
        <h2 style="color:#ff6b6b;margin-top:20px;">Stack:</h2>
        <pre style="background:#222;padding:16px;border-radius:8px;font-size:11px;overflow:auto;max-height:50vh;">${err?.stack || 'No stack'}</pre>
      </div>
    `;
    return true;
  }
  return false;
};

class ErrorBoundary extends Component<
  { children?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ErrorBoundary>
);

createRoot(document.getElementById('root')!).render(<App />);