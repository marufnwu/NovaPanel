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