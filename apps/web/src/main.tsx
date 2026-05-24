import { createRoot } from 'react-dom/client';
import { Component, ReactNode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import './index.css';

const showErrorOverlay = (msg: string, stack: string) => {
  const overlay = document.createElement('div');
  overlay.id = 'debug-error-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#1a1a1a;color:#ff6b6b;padding:20px;font-family:monospace;overflow:auto;">
      <h1 style="color:#ff4757;font-size:28px;margin-bottom:20px;">🔴 useSyncExternalStore Error</h1>
      <div style="background:#2d2d2d;padding:16px;border-radius:8px;margin-bottom:16px;">
        <p style="margin:0;font-size:16px;"><strong>Message:</strong> ${msg}</p>
      </div>
      <h2 style="color:#ff6b6b;">Stack Trace:</h2>
      <pre style="background:#222;padding:16px;border-radius:8px;font-size:12px;white-space:pre-wrap;">${stack}</pre>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top:20px;padding:10px 20px;font-size:16px;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);
};

let errorHandled = false;

window.onerror = function(msg, src, line, col, err) {
  const msgStr = String(msg);
  if ((msgStr.includes('useSyncExternalStore') || msgStr.includes('Invariant')) && !errorHandled) {
    errorHandled = true;
    showErrorOverlay(msgStr, err?.stack || 'No stack');
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