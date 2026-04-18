'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function TwoFASetupPage() {
  const { user } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  async function handleSetup() {
    setLoading(true);
    setError('');
    try {
      const data = await api.post<{ secret: string; qrCodeDataUri: string }>('/auth/2fa/setup');
      setSecret(data.secret);
      setQrCode(data.qrCodeDataUri);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post<{ enabled: boolean }>('/auth/2fa/verify', { code });
      setEnabled(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (enabled) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">2FA Enabled</h1>
          <p className="text-sm text-green-600 mt-2">
            Two-factor authentication is now active on your account.
          </p>
        </div>
        <div className="text-center">
          <a href="/dashboard" className="text-primary underline hover:no-underline text-sm">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="text-muted-foreground mt-1">Secure your account with an authenticator app</p>
      </div>

      {!qrCode ? (
        <div className="text-center">
          <button
            onClick={handleSetup}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Set up 2FA'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg border" />
          </div>

          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
            <code className="text-xs break-all">{secret}</code>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-1.5">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Enable 2FA'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
