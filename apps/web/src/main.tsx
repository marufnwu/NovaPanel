import { createRoot } from 'react-dom/client';
import { Component, ReactNode, useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { ThemeProvider } from './lib/theme-provider';
import { CommandPalette } from './components/ui/CommandPalette';
import { useCommandPaletteStore } from './store/command-palette-store';
import './index.css';

const showError = (msg: string, stack: string) => {
  if (document.getElementById('debug-error-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'debug-error-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#1a1a1a;color:#ff6b6b;padding:20px;font-family:monospace;overflow:auto;';
  overlay.innerHTML = `
    <h1 style="color:#ff4757;font-size:28px;margin-bottom:20px;">🔴 React Error</h1>
    <div style="background:#2d2d2d;padding:16px;border-radius:8px;margin-bottom:16px;font-size:16px;">
      <strong>Message:</strong> ${msg}
    </div>
    <h2 style="color:#ff6b6b;">Stack Trace:</h2>
    <pre style="background:#222;padding:16px;border-radius:8px;font-size:12px;white-space:pre-wrap;max-height:60vh;overflow:auto;">${stack}</pre>
    <button onclick="this.parentElement.remove()" style="margin-top:20px;padding:10px 20px;font-size:16px;cursor:pointer;background:#ff4757;color:white;border:none;border-radius:4px;">Close</button>
  `;
  document.body.appendChild(overlay);
};

window.onerror = function(msg, src, line, col, err) {
  const msgStr = String(msg);
  if (msgStr.includes('useSyncExternalStore') || msgStr.includes('Invariant') || msgStr.includes('installHook')) {
    showError(msgStr, err?.stack || `at ${src}:${line}:${col}`);
    return true;
  }
  return false;
};

const origError = console.error;
console.error = function(...args: any[]) {
  const msg = args.map(a => String(a)).join(' ');
  if (msg.includes('useSyncExternalStore') || msg.includes('Invariant')) {
    showError(msg, new Error().stack || '');
    return;
  }
  origError.apply(console, args);
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
          <h1 style={{ color: '#ff4757' }}>React Error Boundary</h1>
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

const AppContent = () => {
  const { isOpen, toggle } = useCommandPaletteStore();

  // Listen for Ctrl+K or Cmd+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return (
    <>
      <RouterProvider router={router} />
      <CommandPalette isOpen={isOpen} onClose={toggle} />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

createRoot(document.getElementById('root')!).render(<App />);