import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLogin } from '../../api/hooks/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login.mutateAsync({ username, password });
      navigate({ to: '/dashboard' });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <h1 className="text-page-title font-medium mb-2">NovaPanel</h1>
          <p className="text-foreground-secondary">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
          {error && (
            <p className="text-small text-foreground-danger">{error}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={login.isPending}
            className="w-full"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}