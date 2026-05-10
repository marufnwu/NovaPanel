import { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { useChangeDbPassword } from '../../api/hooks/databases';

interface ChangePasswordModalProps {
  databaseId: string;
  userId: string;
  username: string;
  onClose: () => void;
}

export function ChangePasswordModal({ databaseId, userId, username, onClose }: ChangePasswordModalProps) {
  const changePassword = useChangeDbPassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = () => {
    if (!newPassword || newPassword !== confirmPassword) return;
    changePassword.mutate(
      { dbId: databaseId, userId, password: newPassword },
      { onSuccess: onClose }
    );
  };

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Change Password — {username}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><EyeOff className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && !passwordLongEnough && (
              <p className="mt-1 text-xs text-destructive">Password must be at least 8 characters</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
          {changePassword.error && (
            <p className="text-sm text-destructive">{String(changePassword.error)}</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={changePassword.isPending || !passwordsMatch || !passwordLongEnough}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {changePassword.isPending ? <KeyRound className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {changePassword.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}