import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface FtpAccountFormProps {
  mode: 'create' | 'edit';
  initialData?: { username?: string; homeDir?: string; readonly?: boolean; isActive?: boolean };
  onSubmit: (data: { username: string; password?: string; homeDir: string; readonly: boolean; isActive?: boolean }) => void;
  onCancel: () => void;
  isPending: boolean;
  domainId?: string;
}

export function FtpAccountForm({ mode, initialData, onSubmit, onCancel, isPending, domainId }: FtpAccountFormProps) {
  const [form, setForm] = useState({
    username: initialData?.username || '',
    password: '',
    homeDir: initialData?.homeDir || (domainId ? `/var/www/vhosts/${domainId}/httpdocs` : ''),
    readonly: initialData?.readonly || false,
    isActive: initialData?.isActive ?? true,
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    onSubmit(form);
  };

  const handleGenerate = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    const password = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm(f => ({ ...f, password }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{mode === 'create' ? 'Create FTP Account' : 'Edit FTP Account'}</h3>
          <button onClick={onCancel} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="webmaster" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}

          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button onClick={handleGenerate} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Generate</button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Home Directory</label>
            <input value={form.homeDir} onChange={(e) => setForm({ ...form, homeDir: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.readonly} onChange={(e) => setForm({ ...form, readonly: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Read-only mode</span>
          </label>

          {mode === 'edit' && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-input" />
              <span className="text-sm">Active</span>
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={isPending || (mode === 'create' && (!form.username.trim() || !form.password))}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? (mode === 'create' ? 'Creating...' : 'Saving...') : (mode === 'create' ? 'Create Account' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}