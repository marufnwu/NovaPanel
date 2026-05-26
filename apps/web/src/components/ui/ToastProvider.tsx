import { Toaster, toast as sonnerToast } from 'sonner';
import { __registerToastListener } from '../../lib/toast';

/**
 * ToastProvider — mounts Sonner's Toaster and bridges it to the
 * module-level toast API in src/lib/toast.ts.
 *
 * Mount once at the root (AppLayout). Sonner handles all rendering.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'var(--color-background-secondary, #f8f9fa)',
          border: '1px solid var(--color-border-tertiary, #e5e7eb)',
          borderRadius: 'var(--radius-lg, 8px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06)',
          color: 'var(--color-text-primary, #111827)',
          fontSize: '13px',
          fontFamily: 'var(--font-sans, system-ui)',
          padding: '14px 16px',
          minWidth: '280px',
          maxWidth: '400px',
        },
      }}
    />
  );
}

// Bridge: re-export sonner's toast from our module-level API
export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
  warning: (message: string) => sonnerToast.warning(message),
  info: (message: string) => sonnerToast.info(message),
};

// Register with the module-level listener so src/lib/toast.ts callers work
if (typeof window !== 'undefined') {
  __registerToastListener((options) => {
    switch (options.type) {
      case 'success':
        sonnerToast.success(options.message);
        break;
      case 'error':
        sonnerToast.error(options.message);
        break;
      case 'warning':
        sonnerToast.warning(options.message);
        break;
      case 'info':
        sonnerToast.info(options.message);
        break;
    }
  });
}