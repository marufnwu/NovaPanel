import { useState, useRef } from 'react';
import { Loader2, Shield, Key, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-primary/5 dark:bg-primary/10" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-primary/5 dark:bg-primary/10" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-4">
            {useBackupCode ? (
              <Key className="size-7 text-primary" />
            ) : (
              <Shield className="size-7 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {useBackupCode
              ? 'Enter one of your backup recovery codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error.message}
                </div>
              )}

              {useBackupCode ? (
                <div className="space-y-1.5">
                  <label htmlFor="backupCode" className="text-sm font-medium">
                    Backup Code
                  </label>
                  <Input
                    id="backupCode"
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                    placeholder="AB12CD34EF"
                    autoFocus
                    required
                    className="text-center font-mono text-base tracking-widest"
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
                      className="h-12 w-12 rounded-lg border border-input bg-background text-center text-lg font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/50"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  isLoading ||
                  (!useBackupCode && code.some((d) => !d)) ||
                  (useBackupCode && !backupCode.trim())
                }
              >
                {isLoading && <Loader2 className="size-4 animate-spin" />}
                Verify
              </Button>

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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}