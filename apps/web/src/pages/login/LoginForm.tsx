import { useState, useEffect } from 'react';
import { Loader2, LogIn, Mail, ArrowLeft, X, Eye, EyeOff, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Forgot Password</DialogTitle>
          <DialogDescription>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/10 p-4 text-sm text-success">
              <div className="flex items-center gap-2 font-medium">
                <Mail className="size-4" />
                Check your email
              </div>
              <p className="mt-2 text-muted-foreground">
                If an account with that email exists, a reset link has been sent.
              </p>
            </div>
            <Button variant="outline" onClick={onClose} className="w-full">
              <ArrowLeft className="size-4 mr-2" />
              Back to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoFocus
              />
            </div>
            {forgotPassword.error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {(forgotPassword.error as ApiError).message}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={forgotPassword.isPending || !email.trim()}
                className="flex-1"
              >
                {forgotPassword.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                Send Reset Link
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
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
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-primary/5 dark:bg-primary/10" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-primary/5 dark:bg-primary/10" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-4">
              <Server className="size-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">NovaPanel</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your server control panel
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && !lockCountdown && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message}
                    {remainingAttempts !== undefined && remainingAttempts > 0 && (
                      <span className="mt-1 block text-xs opacity-80">
                        {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before lockout
                      </span>
                    )}
                  </div>
                )}

                {lockCountdown !== null && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    Account temporarily locked due to too many failed attempts.
                    <span className="mt-1 block font-medium">
                      Try again in {Math.floor(lockCountdown / 60)}:{(lockCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-sm font-medium">
                    Username
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    required
                    autoFocus
                    disabled={lockCountdown !== null}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={lockCountdown !== null}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || lockCountdown !== null}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            NovaPanel Server Management Platform
          </p>
        </div>
      </div>

      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    </>
  );
}