import { useState } from 'react';
import { useDomains } from '../../api/hooks/domains';
import { useFtpAccounts, useCreateFtpAccount, useUpdateFtpAccount, useChangeFtpPassword, useDeleteFtpAccount, useFtpSettings, useUpdateFtpSettings, type FtpAccount } from '../../api/hooks/ftp';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FolderUp, Plus, Trash2, Key, Edit2, Copy, Check, X, Server, Settings, Clock, MapPin, Save, Eye, EyeOff } from 'lucide-react';

function CreateAccountModal({ domainId, onClose }: { domainId: string; onClose: () => void }) {
  const create = useCreateFtpAccount();
  const [form, setForm] = useState({ username: '', password: '', homeDir: `/var/www/vhosts/${domainId}/httpdocs`, readonly: false });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    if (!form.username.trim() || !form.password) return;
    create.mutate({ domainId, ...form }, {
      onSuccess: () => {
        onClose();
        setForm({ username: '', password: '', homeDir: `/var/www/vhosts/${domainId}/httpdocs`, readonly: false });
      },
    });
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
          <h3 className="text-lg font-semibold">Create FTP Account</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="webmaster" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
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
          <div>
            <label className="mb-1 block text-sm font-medium">Home Directory</label>
            <select value={form.homeDir} onChange={(e) => setForm({ ...form, homeDir: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value={`/var/www/vhosts/${domainId}/httpdocs`}>httpdocs (Web root)</option>
              <option value={`/var/www/vhosts/${domainId}/private`}>private</option>
              <option value={`/var/www/vhosts/${domainId}`}>{domainId} (Base)</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.readonly} onChange={(e) => setForm({ ...form, readonly: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Read-only mode</span>
          </label>
          {create.error && <p className="text-sm text-destructive">{String(create.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending || !form.username.trim() || !form.password} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {create.isPending ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAccountModal({ account, onClose }: { account: FtpAccount; onClose: () => void }) {
  const update = useUpdateFtpAccount();
  const [form, setForm] = useState({ homeDir: account.homeDir, readonly: account.readonly, isActive: account.isActive });

  const handleSubmit = () => {
    update.mutate({ id: account.id, ...form }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit FTP Account</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{account.username}</div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Home Directory</label>
            <input value={form.homeDir} onChange={(e) => setForm({ ...form, homeDir: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.readonly} onChange={(e) => setForm({ ...form, readonly: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Read-only mode</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Active</span>
          </label>
          {update.error && <p className="text-sm text-destructive">{String(update.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={update.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {update.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ account, onClose }: { account: FtpAccount; onClose: () => void }) {
  const changePw = useChangeFtpPassword();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = () => {
    if (password !== confirm) { setValidationError('Passwords do not match'); return; }
    if (password.length < 8) { setValidationError('Password must be at least 8 characters'); return; }
    setValidationError('');
    changePw.mutate({ id: account.id, password }, { onSuccess: () => { onClose(); setPassword(''); setConfirm(''); } });
  };

  const handleGenerate = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    const pwd = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setPassword(pwd);
    setConfirm(pwd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Change Password — {account.username}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setValidationError(''); }} placeholder="••••••••" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={handleGenerate} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Generate</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm Password</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setValidationError(''); }} placeholder="••••••••" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          {changePw.error && <p className="text-sm text-destructive">{String(changePw.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={changePw.isPending || !password || password !== confirm} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {changePw.isPending ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectionInfo({ account }: { account: FtpAccount }) {
  const [copied, setCopied] = useState(false);
  const serverIp = window.location.hostname || 'your-server-ip';
  
  const info = [
    { label: 'Host', value: serverIp },
    { label: 'Port (FTP)', value: '21' },
    { label: 'Port (FTPS)', value: '990' },
    { label: 'Username', value: account.username },
    { label: 'Home Dir', value: account.homeDir },
    { label: 'Mode', value: account.readonly ? 'Read-only' : 'Read + Write' },
  ];

  const copyAll = () => {
    const text = `Host: ${serverIp}\nPort: 21\nUsername: ${account.username}\nPassword: [your-password]`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium">Connection Information</h4>
        <button onClick={copyAll} className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy All'}
        </button>
      </div>
      <div className="grid gap-2 text-sm">
        {info.map(item => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Global FTP Settings ---
function FtpGlobalSettings() {
  const { data: settings, isLoading } = useFtpSettings();
  const updateSettings = useUpdateFtpSettings();
  const [form, setForm] = useState({
    port: 21,
    passivePortMin: 50000,
    passivePortMax: 51000,
    maxConnectionsPerIp: 5,
    anonymousEnabled: false,
  });
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setForm({
      port: settings.port,
      passivePortMin: settings.passivePortMin,
      passivePortMax: settings.passivePortMax,
      maxConnectionsPerIp: settings.maxConnectionsPerIp,
      anonymousEnabled: settings.anonymousEnabled,
    });
    setInitialized(true);
  }

  const handleSave = () => {
    updateSettings.mutate(form);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Settings className="h-4 w-4" /> Global FTP Settings
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">FTP Port</label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 21 })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Passive Port Range (Min)</label>
          <input
            type="number"
            value={form.passivePortMin}
            onChange={(e) => setForm({ ...form, passivePortMin: parseInt(e.target.value) || 50000 })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Passive Port Range (Max)</label>
          <input
            type="number"
            value={form.passivePortMax}
            onChange={(e) => setForm({ ...form, passivePortMax: parseInt(e.target.value) || 51000 })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Connections per IP</label>
          <input
            type="number"
            value={form.maxConnectionsPerIp}
            onChange={(e) => setForm({ ...form, maxConnectionsPerIp: parseInt(e.target.value) || 5 })}
            min={1}
            max={50}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.anonymousEnabled}
              onChange={(e) => setForm({ ...form, anonymousEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            <div>
              <span className="text-sm font-medium">Anonymous FTP Access</span>
              <p className="text-xs text-muted-foreground">Allow anonymous users to connect without authentication</p>
            </div>
          </label>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
        </button>
        {updateSettings.isSuccess && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

export function FtpPage() {
  const { data: domains } = useDomains();
  const [domainId, setDomainId] = useState('');
  const { data: accounts, isLoading } = useFtpAccounts(domainId);
  const deleteAccount = useDeleteFtpAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<FtpAccount | null>(null);
  const [passwordAccount, setPasswordAccount] = useState<FtpAccount | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FtpAccount | null>(null);

  return (
    <div>
      <PageHeader title="FTP Accounts" description="Manage FTP access accounts per domain" />

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex gap-3">
          <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select a domain...</option>
            {domains?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {domainId && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Account
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium ${
              showSettings ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
            }`}
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>
      </div>

      {/* Global FTP Settings */}
      {showSettings && (
        <div className="mb-6">
          <FtpGlobalSettings />
        </div>
      )}

      {showCreate && domainId && <CreateAccountModal domainId={domainId} onClose={() => setShowCreate(false)} />}
      {editAccount && <EditAccountModal account={editAccount} onClose={() => setEditAccount(null)} />}
      {passwordAccount && <ChangePasswordModal account={passwordAccount} onClose={() => setPasswordAccount(null)} />}

      {!domainId ? (
        <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">Select a domain to manage FTP accounts</div>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : !accounts?.length ? (
        <EmptyState icon={FolderUp} title="No FTP accounts" description="Create your first FTP account for this domain." />
      ) : (
        <div className="space-y-6">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded bg-primary/10 p-2">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{a.username}</div>
                    <div className="text-sm text-muted-foreground font-mono">{a.homeDir}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {a.isActive ? 'Active' : 'Disabled'}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.readonly ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {a.readonly ? 'Read-only' : 'Read+Write'}
                  </span>
                </div>
              </div>

              {/* Last Login Display */}
              <div className="mb-4 flex items-center gap-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Last Login:</span>
                  <span className="font-medium text-foreground">
                    {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                {a.lastLoginIp && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>IP:</span>
                    <span className="font-mono font-medium text-foreground">{a.lastLoginIp}</span>
                  </div>
                )}
              </div>

              <ConnectionInfo account={a} />

              <div className="mt-4 flex gap-2">
                <button onClick={() => setEditAccount(a)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => setPasswordAccount(a)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
                  <Key className="h-3.5 w-3.5" /> Change Password
                </button>
                <button onClick={() => setDeleteTarget(a)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={() => {
          if (deleteTarget) deleteAccount.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        title="Delete FTP Account"
        message={`This will permanently delete the FTP account '${deleteTarget?.username}'. This cannot be undone.`}
        confirmText="Delete Account"
        variant="danger"
      />
    </div>
  );
}
