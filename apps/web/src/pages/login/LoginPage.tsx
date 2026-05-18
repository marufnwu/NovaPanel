import { useState, useEffect } from 'react';
import { useLogin, useLogin2FA } from '../../api/hooks/auth';
import { useAuthStore } from '../../store/auth.store';
import { LoginForm } from './LoginForm';
import { TwoFactorForm } from './TwoFactorForm';

export function LoginPage() {
  const { isAuthenticated, pendingTwoFactor } = useAuthStore();
  const loginMutation = useLogin();
  const login2FAMutation = useLogin2FA();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>(undefined);

  // Redirect if already authenticated - useEffect to avoid side effects during render
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return null;
  }

  const handleLogin = (u: string, p: string, remember: boolean) => {
    setUsername(u);
    setPassword(p);
    setRememberMe(remember);
    setLockedUntil(null);
    setRemainingAttempts(undefined);
    loginMutation.mutate(
      { username: u, password: p, rememberMe: remember },
      {
        onError: (err: any) => {
          // Extract lockout info from error response
          if (err?.body) {
            setLockedUntil(err.body.lockedUntil || null);
            setRemainingAttempts(err.body.remainingAttempts);
          }
        },
      }
    );
  };

  const handle2FA = (code: string, isBackupCode: boolean) => {
    login2FAMutation.mutate({
      username,
      password,
      ...(isBackupCode ? { backupCode: code } : { twoFactorCode: code }),
      rememberMe,
    });
  };

  if (pendingTwoFactor) {
    return (
      <TwoFactorForm
        onSubmit={handle2FA}
        isLoading={login2FAMutation.isPending}
        error={login2FAMutation.error as any}
      />
    );
  }

  return (
    <LoginForm
      onSubmit={handleLogin}
      isLoading={loginMutation.isPending}
      error={loginMutation.error as any}
      lockedUntil={lockedUntil}
      remainingAttempts={remainingAttempts}
    />
  );
}
