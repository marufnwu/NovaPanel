/**
 * Toast utility — can be called from anywhere (components, hooks, utils).
 *
 * Uses a module-level listener pattern so it works outside of React tree.
 * The ToastProvider registers itself as the active listener on mount.
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

type ToastListener = (options: ToastOptions) => void;

let activeListener: ToastListener | null = null;

/** Called by ToastProvider to register as the active toast emitter */
export function __registerToastListener(listener: ToastListener) {
  activeListener = listener;
  return () => {
    if (activeListener === listener) activeListener = null;
  };
}

function emit(options: ToastOptions) {
  if (activeListener) {
    activeListener(options);
  } else {
    // Fallback: log to console if no provider is mounted
    console.warn('[toast] No ToastProvider mounted — message:', options.message);
  }
}

export const toast = {
  success: (message: string, title?: string) => emit({ type: 'success', message, title }),
  error: (message: string, title?: string) => emit({ type: 'error', message, title }),
  warning: (message: string, title?: string) => emit({ type: 'warning', message, title }),
  info: (message: string, title?: string) => emit({ type: 'info', message, title }),
};
