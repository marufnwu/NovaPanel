import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, KeyRound } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth.store';

type Step = 'request' | 'confirm';

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  resetToken?: string;
}

interface VerifyResetTokenResponse {
  valid: boolean;
  email?: string;
}

interface ResetPasswordResponse {
  success: boolean;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<Step>('request');
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 'request'
              ? 'Enter your email to receive a reset link'
              : 'Enter your reset token and new password'}
          </p>
        </div>
        {step === 'request' ? (
          <RequestForm onSuccess={(token) => {
            if (token) {
              setResetToken(token);
              setStep('confirm');
            } else {
              setStep('confirm');
            }
          }} />
        ) : (
          <ConfirmForm />
        )}
      </div>
    </div>
  );
}

function RequestForm({ onSuccess }: { onSuccess: (token?: string) => void }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
      setSuccess(true);
      setTimeout(() => {
        onSuccess(data.resetToken);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Check your email for a reset link.
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Email Address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="admin@example.com"
          required
          autoFocus
          disabled={isLoading || success}
        />
      </div>
      {success && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Development mode: copy this token and use it on the next step.
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={isLoading || success || !email.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {success ? 'Email Sent' : 'Send Reset Link'}
      </button>
    </form>
  );
}

function ConfirmForm() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      if (token) {
        const verifyData = await api.post<VerifyResetTokenResponse>('/auth/verify-reset-token', { token });
        if (!verifyData.valid) {
          setError('Invalid or expired reset token');
          setIsLoading(false);
          return;
        }
        setEmail(verifyData.email || '');
      }
      await api.post<ResetPasswordResponse>('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-6 text-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
          <h3 className="text-lg font-semibold">Password Reset Complete</h3>
          <p className="text-sm text-muted-foreground">
            Your password has been changed. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="token" className="text-sm font-medium">Reset Token</label>
        <input
          id="token"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Paste your reset token here"
          required
          autoFocus
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-sm font-medium">New Password</label>
        <div className="relative">
          <input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="At least 8 characters"
            required
            minLength={8}
            disabled={isLoading}
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
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
        <input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Repeat new password"
          required
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !token.trim() || !newPassword.trim() || !confirmPassword.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Reset Password
      </button>
    </form>
  );
}