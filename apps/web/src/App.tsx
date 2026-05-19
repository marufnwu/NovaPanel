import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { JobNotificationProvider } from './components/jobs/JobNotificationProvider';
import { CommandPalette } from './components/ui/command-palette';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <JobNotificationProvider>
            <RouterProvider router={router} />
            <CommandPalette />
            <Toaster position="bottom-right" richColors closeButton />
          </JobNotificationProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
