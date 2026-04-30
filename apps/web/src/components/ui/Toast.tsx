import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { __registerToastListener } from '../../lib/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_TOASTS = 5;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: Infinity, // Error toasts stay until manually closed
  warning: 6000,
  info: 5000,
};

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider');
  return ctx;
}

// ─── Icons & Colors ─────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { icon: typeof CheckCircle; bg: string; border: string; iconColor: string; titleColor: string }> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    iconColor: 'text-green-500',
    titleColor: 'text-green-400',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    iconColor: 'text-red-500',
    titleColor: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    iconColor: 'text-yellow-500',
    titleColor: 'text-yellow-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-400',
  },
};

// ─── Toast Item ─────────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseRef = useRef(false);
  const remainingRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];

  const startTimer = useCallback(() => {
    if (duration === Infinity) return; // No timer for error toasts
    startRef.current = Date.now();
    remainingRef.current = duration;
    timerRef.current = setTimeout(() => {
      onRemove();
    }, duration);
  }, [duration, onRemove]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      remainingRef.current -= (Date.now() - startRef.current);
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (duration === Infinity) return;
    if (remainingRef.current <= 0) {
      onRemove();
      return;
    }
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onRemove();
    }, remainingRef.current);
  }, [duration, onRemove]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [startTimer]);

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border ${style.border} ${style.bg} p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full duration-300`}
      role="alert"
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-semibold ${style.titleColor}`}>{toast.title}</p>
        )}
        <p className="text-sm text-foreground/90">{toast.message}</p>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      // Remove oldest toasts if exceeding max
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS);
      }
      return next;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register listener so `toast` utility works outside React tree
  useEffect(() => {
    return __registerToastListener(addToast);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container — fixed to bottom-right */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
