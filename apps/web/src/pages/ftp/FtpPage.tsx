import { useState } from 'react';
import { useDomains } from '../../api/hooks/domains';
import { useFtpAccounts, useCreateFtpAccount, useUpdateFtpAccount, useChangeFtpPassword, useDeleteFtpAccount, useFtpSettings, useUpdateFtpSettings, type FtpAccount } from '../../api/hooks/ftp';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FolderUp, Plus, Trash2, Key, Edit2, Copy, Check, X, Server, Settings, Clock, MapPin, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create FTP Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ftp-username" className="mb-1">Username</Label>
            <Input id="ftp-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="webmaster" />
          </div>
          <div>
            <Label htmlFor="ftp-password" className="mb-1">Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input id="ftp-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="pr-10" />
                <Button variant="ghost" size="icon-sm" type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" onClick={handleGenerate}>Generate</Button>
            </div>
          </div>
          <div>
            <Label htmlFor="ftp-homedir" className="mb-1">Home Directory</Label>
            <select id="ftp-homedir" value={form.homeDir} onChange={(e) => setForm({ ...form, homeDir: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value={`/var/www/vhosts/${domainId}/httpdocs`}>httpdocs (Web root)</option>
              <option value={`/var/www/vhosts/${domainId}/private`}>private</option>
              <option value={`/var/www/vhosts/${domainId}`}>{domainId} (Base)</option>
            </select>
          </div>
          <Label className="flex items-center gap-2">
            <input type="checkbox" checked={form.readonly} onChange={(e) => setForm({ ...form, readonly: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Read-only mode</span>
          </Label>
          {create.error && <p className="text-sm text-destructive">{String(create.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || !form.username.trim() || !form.password}>
            {create.isPending ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountModal({ account, onClose }: { account: FtpAccount; onClose: () => void }) {
  const update = useUpdateFtpAccount();
  const [form, setForm] = useState({ homeDir: account.homeDir, readonly: account.readonly, isActive: account.isActive });

  const handleSubmit = () => {
    update.mutate({ id: account.id, ...form }, { onSuccess: onClose });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit FTP Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1">Username</Label>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{account.username}</div>
          </div>
          <div>
            <Label htmlFor="edit-homedir" className="mb-1">Home Directory</Label>
            <Input id="edit-homedir" value={form.homeDir} onChange={(e) => setForm({ ...form, homeDir: e.target.value })} />
          </div>
          <Label className="flex items-center gap-2">
            <input type="checkbox" checked={form.readonly} onChange={(e) => setForm({ ...form, readonly: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Read-only mode</span>
          </Label>
          <Label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Active</span>
          </Label>
          {update.error && <p className="text-sm text-destructive">{String(update.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>
            {update.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password — {account.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="chpw-new" className="mb-1">New Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input id="chpw-new" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setValidationError(''); }} placeholder="••••••••" className="pr-10" />
                <Button variant="ghost" size="icon-sm" type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" onClick={handleGenerate}>Generate</Button>
            </div>
          </div>
          <div>
            <Label htmlFor="chpw-confirm" className="mb-1">Confirm Password</Label>
            <div className="relative">
              <Input id="chpw-confirm" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setValidationError(''); }} placeholder="••••••••" className="pr-10" />
              <Button variant="ghost" size="icon-sm" type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-1 top-1/2 -translate-y-1/2">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          {changePw.error && <p className="text-sm text-destructive">{String(changePw.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={changePw.isPending || !password || password !== confirm}>
            {changePw.isPending ? 'Updating...' : 'Update Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <Button variant="outline" size="xs" onClick={copyAll} className="gap-1">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy All'}
        </Button>
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

  if (isLoading) return <LoadingPage />;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Settings className="h-4 w-4" /> Global FTP Settings
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label className="mb-1 text-xs font-medium text-muted-foreground">FTP Port</Label>
          <Input
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 21 })}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs font-medium text-muted-foreground">Passive Port Range (Min)</Label>
          <Input
            type="number"
            value={form.passivePortMin}
            onChange={(e) => setForm({ ...form, passivePortMin: parseInt(e.target.value) || 50000 })}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs font-medium text-muted-foreground">Passive Port Range (Max)</Label>
          <Input
            type="number"
            value={form.passivePortMax}
            onChange={(e) => setForm({ ...form, passivePortMax: parseInt(e.target.value) || 51000 })}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs font-medium text-muted-foreground">Max Connections per IP</Label>
          <Input
            type="number"
            value={form.maxConnectionsPerIp}
            onChange={(e) => setForm({ ...form, maxConnectionsPerIp: parseInt(e.target.value) || 5 })}
            min={1}
            max={50}
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Label className="flex items-center gap-2">
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
          </Label>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          <Save className="h-4 w-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
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
  const { data: accounts, isLoading, isError, refetch } = useFtpAccounts(domainId);
  const deleteAccount = useDeleteFtpAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<FtpAccount | null>(null);
  const [passwordAccount, setPasswordAccount] = useState<FtpAccount | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FtpAccount | null>(null);

  if (isError) {
    return (
      <div>
        <PageHeader title="FTP Accounts" icon={FolderUp} />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load FTP accounts</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching FTP accounts.</p>
          <Button
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="FTP Accounts" icon={FolderUp} />

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex gap-3">
          <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select a domain...</option>
            {domains?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {domainId && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Add Account
            </Button>
          )}
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant={showSettings ? "default" : "outline"}
          >
            <Settings className="h-4 w-4" /> Settings
          </Button>
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
        <LoadingPage />
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
                <Button variant="outline" size="sm" onClick={() => setEditAccount(a)}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPasswordAccount(a)}>
                  <Key className="h-3.5 w-3.5" /> Change Password
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(a)} className="hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
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
