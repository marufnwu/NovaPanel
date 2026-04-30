import { useState, useRef } from 'react';
import { Loader2, Shield, Key } from 'lucide-react';
import { ApiError } from '../../api/client';

interface TwoFactorFormProps {
  onSubmit: (code: string, isBackupCode: boolean) => void;
  isLoading: boolean;
  error?: ApiError | null;
}

export function TwoFactorForm({ onSubmit, isLoading, error }: TwoFactorFormProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every((d) => d !== '')) {
      onSubmit(newCode.join(''), false);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useBackupCode) {
      onSubmit(backupCode.trim(), true);
    } else {
      onSubmit(code.join(''), false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          {useBackupCode ? (
            <Key className="mx-auto h-10 w-10 text-primary" />
          ) : (
            <Shield className="mx-auto h-10 w-10 text-primary" />
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {useBackupCode
              ? 'Enter one of your backup recovery codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          {useBackupCode ? (
            <div className="space-y-2">
              <label htmlFor="backupCode" className="text-sm font-medium">
                Backup Code
              </label>
              <input
                id="backupCode"
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg font-mono tracking-widest placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="AB12CD34EF"
                autoFocus
                required
              />
            </div>
          ) : (
            <div className="flex justify-center gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus={i === 0}
                />
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (!useBackupCode && code.some((d) => !d)) || (useBackupCode && !backupCode.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setUseBackupCode(!useBackupCode)}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {useBackupCode
                ? 'Use authenticator code instead'
                : 'Use a backup code instead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
