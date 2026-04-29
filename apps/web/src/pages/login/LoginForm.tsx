import { useState, useEffect } from 'react';
import { Loader2, LogIn, Mail, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useForgotPassword } from '../../api/hooks/auth';

interface LoginFormProps {
  onSubmit: (username: string, password: string, rememberMe: boolean) => void;
  isLoading: boolean;
  error?: ApiError | null;
  lockedUntil?: string | null;
  remainingAttempts?: number;
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    forgotPassword.mutate({ email }, {
      onSuccess: () => {
        setSent(true);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Forgot Password</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-600">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Check your email</span>
              </div>
              <p className="mt-2">
                If an account with that email exists, a reset link has been sent.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm font-medium">
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="admin@example.com"
                required
                autoFocus
              />
            </div>
            {(forgotPassword.error as any) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {(forgotPassword.error as any).message}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={forgotPassword.isPending || !email.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {forgotPassword.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send Reset Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function LoginForm({
  onSubmit,
  isLoading,
  error,
  lockedUntil: lockedUntilProp,
  remainingAttempts,
}: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handle lockout countdown
  useEffect(() => {
    if (!lockedUntilProp) {
      setLockCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(lockedUntilProp).getTime() - Date.now()) / 1000));
      if (remaining <= 0) {
        setLockCountdown(null);
        return false;
      }
      setLockCountdown(remaining);
      return true;
    };

    if (!updateCountdown()) return;
    const interval = setInterval(() => {
      if (!updateCountdown()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUntilProp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockCountdown !== null) return;
    onSubmit(username, password, rememberMe);
  };

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">ServerForge</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your control panel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && !lockCountdown && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error.message}
                {remainingAttempts !== undefined && remainingAttempts > 0 && (
                  <span className="mt-1 block text-xs opacity-80">
                    {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before lockout
                  </span>
                )}
              </div>
            )}

            {lockCountdown !== null && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Account temporarily locked due to too many failed attempts.
                <span className="mt-1 block font-medium">
                  Try again in {Math.floor(lockCountdown / 60)}:{(lockCountdown % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="admin"
                required
                autoFocus
                disabled={lockCountdown !== null}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                  placeholder="••••••••"
                  required
                  disabled={lockCountdown !== null}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <label htmlFor="remember" className="text-sm text-muted-foreground">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockCountdown !== null}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Sign In
            </button>
          </form>
        </div>
      </div>

      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    </>
  );
}
