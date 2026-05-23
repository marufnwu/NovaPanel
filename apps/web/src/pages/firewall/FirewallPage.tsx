import { useState } from 'react';
import {
  useFirewallStatus,
  useFirewallRules,
  useAddFirewallRule,
  useDeleteFirewallRule,
  useApplyFirewallPreset,
  useToggleFirewall,
  useFail2BanJails,
  useUnbanIp,
  useBanIp,
  useResetFirewallRules,
  useToggleRule,
  type UfwRule,
  type F2BJail,
} from '../../api/hooks/firewall';
import { useFail2banLogs } from '../../api/hooks/logs';
import { useAuditLog, type AuditEntry } from '../../api/hooks/audit';
import { useSshSettings, useUpdateSshSettings } from '../../api/hooks/settings';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import {
  Flame,
  Plus,
  Trash2,
  Shield,
  X,
  ShieldAlert,
  Unlock,
  Ban,
  RotateCcw,
  AlertTriangle,
  FileText,
  Activity,
  Key,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const PRESETS = [
  { key: 'ssh', label: 'SSH (22)', desc: 'Allow SSH access' },
  { key: 'http', label: 'HTTP (80)', desc: 'Allow web traffic' },
  { key: 'https', label: 'HTTPS (443)', desc: 'Allow secure web' },
  { key: 'ftp', label: 'FTP (21)', desc: 'Allow FTP access' },
  { key: 'smtp', label: 'SMTP (25/465/587)', desc: 'Allow mail sending' },
  { key: 'imap', label: 'IMAP (143/993)', desc: 'Allow mail retrieval' },
];

type TabKey = 'rules' | 'fail2ban' | 'logs' | 'activity' | 'ssh';

// ─── Shared toggle switch ──────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

// ─── Add Rule Modal ────────────────────────────────────────────────────────────

function AddRuleModal({ onClose }: { onClose: () => void }) {
  const addRule = useAddFirewallRule();
  const [form, setForm] = useState<{
    action: 'allow' | 'deny';
    port: string;
    protocol: string;
    from: string;
    to: string;
  }>({
    action: 'allow',
    port: '',
    protocol: 'tcp',
    from: '',
    to: '',
  });

  const handleSubmit = () => {
    addRule.mutate(form, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Firewall Rule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="fw-action" className="mb-1">Action</Label>
            <select
              id="fw-action"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value as 'allow' | 'deny' })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fw-port" className="mb-1">Port</Label>
              <Input
                id="fw-port"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder="80 or 8000:9000"
              />
            </div>
            <div>
              <Label htmlFor="fw-protocol" className="mb-1">Protocol</Label>
              <select
                id="fw-protocol"
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="fw-from" className="mb-1">From (IP or range)</Label>
            <Input
              id="fw-from"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              placeholder="Any (leave empty)"
            />
          </div>
          <div>
            <Label htmlFor="fw-to" className="mb-1">To (IP or interface)</Label>
            <Input
              id="fw-to"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              placeholder="Any (leave empty)"
            />
          </div>
          {addRule.error && <p className="text-sm text-destructive">{String(addRule.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addRule.isPending || !form.port}>
            {addRule.isPending ? 'Adding...' : 'Add Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Unban IP Modal ────────────────────────────────────────────────────────────

function UnbanIpModal({ jail, onClose }: { jail: F2BJail; onClose: () => void }) {
  const unban = useUnbanIp();
  const [ip, setIp] = useState('');

  const handleUnban = () => {
    if (!ip.trim()) return;
    unban.mutate({ jail: jail.name, ip }, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unban IP — {jail.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Currently banned: {jail.bannedCount} IP(s)</p>
          {jail.bannedIps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {jail.bannedIps.map((bannedIp) => (
                <Button
                  key={bannedIp}
                  variant="destructive"
                  size="xs"
                  onClick={() => setIp(bannedIp)}
                  className="rounded-full"
                >
                  {bannedIp}
                </Button>
              ))}
            </div>
          )}
          <div>
            <Label htmlFor="unban-ip" className="mb-1">IP Address to Unban</Label>
            <Input
              id="unban-ip"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 192.168.1.100"
            />
          </div>
          {unban.error && <p className="text-sm text-destructive">{String(unban.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleUnban} disabled={unban.isPending || !ip.trim()} className="bg-green-600 hover:bg-green-600/90 text-white">
            {unban.isPending ? 'Unbanning...' : 'Unban IP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ban IP Modal ──────────────────────────────────────────────────────────────

function BanIpModal({ jails, onClose }: { jails: F2BJail[]; onClose: () => void }) {
  const banIp = useBanIp();
  const [ip, setIp] = useState('');
  const [jail, setJail] = useState('');

  const handleBan = () => {
    if (!ip.trim()) return;
    banIp.mutate({ jail: jail || undefined, ip }, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" /> Ban IP Address
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ban-ip" className="mb-1">IP Address</Label>
            <Input
              id="ban-ip"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 192.168.1.100"
            />
          </div>
          <div>
            <Label htmlFor="ban-jail" className="mb-1">Jail (optional)</Label>
            <select
              id="ban-jail"
              value={jail}
              onChange={(e) => setJail(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">All jails</option>
              {jails.map((j) => (
                <option key={j.name} value={j.name}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>
          {banIp.error && <p className="text-sm text-destructive">{String(banIp.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleBan} disabled={banIp.isPending || !ip.trim()}>
            {banIp.isPending ? 'Banning...' : 'Ban IP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Confirm Modal ───────────────────────────────────────────────────────

function ResetConfirmModal({ onClose }: { onClose: () => void }) {
  const reset = useResetFirewallRules();

  const handleReset = () => {
    reset.mutate(undefined, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset to Default Rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">This will remove all custom rules</p>
              <p className="mt-1 text-sm text-muted-foreground">
                All existing firewall rules will be deleted and replaced with the default rules:
                SSH (22), HTTP (80), and HTTPS (443).
              </p>
            </div>
          </div>
          {reset.error && <p className="text-sm text-destructive">{String(reset.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleReset} disabled={reset.isPending}>
            {reset.isPending ? 'Resetting...' : 'Reset to Defaults'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm Action Modal (generic) ────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  isPending,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
}) {
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function FirewallPage() {
  const { data: status, isLoading: statusLoading, isError: statusError } = useFirewallStatus();
  const { data: rules, isLoading: rulesLoading, isError: rulesError } = useFirewallRules();
  const { data: jails, isLoading: jailsLoading, isError: jailsError } = useFail2BanJails();
  const addRule = useAddFirewallRule();
  const deleteRule = useDeleteFirewallRule();
  const applyPreset = useApplyFirewallPreset();
  const toggleFirewall = useToggleFirewall();
  const toggleRule = useToggleRule();

  const [tab, setTab] = useState<TabKey>('rules');
  const [unbanTarget, setUnbanTarget] = useState<F2BJail | null>(null);
  const [showBanIp, setShowBanIp] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  if (rulesLoading || statusLoading || jailsLoading) return <LoadingPage />;

  if (rulesError || statusError || jailsError) {
    return (
      <div>
        <PageHeader title="Firewall" description="Manage UFW rules, Fail2Ban, and SSH settings" icon={Shield} />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load firewall data</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching firewall rules and status.</p>
          <Button
            variant="destructive"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
    { key: 'rules', label: 'UFW Rules', icon: Shield },
    { key: 'fail2ban', label: 'Fail2Ban', icon: ShieldAlert },
    { key: 'logs', label: 'Logs', icon: FileText },
    { key: 'activity', label: 'Login Activity', icon: Activity },
    { key: 'ssh', label: 'SSH', icon: Key },
  ];

  return (
    <div>
      <PageHeader title="Firewall" description="Manage UFW rules, Fail2Ban, and SSH settings" icon={Shield} />

      {/* Status banner */}
      {status && (
        <div
          className={`mb-6 flex items-center justify-between rounded-lg border p-4 ${
            status.enabled
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <Shield className={`h-5 w-5 ${status.enabled ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <div className="font-medium">UFW Firewall is {status.enabled ? 'ACTIVE' : 'INACTIVE'}</div>
              <div className="text-sm text-muted-foreground">
                Default input: {status.defaultInput} | Default output: {status.defaultOutput}
              </div>
            </div>
          </div>
          <Button
            variant={status.enabled ? "outline" : "default"}
            onClick={() => toggleFirewall.mutate(status.enabled ? 'disable' : 'enable')}
            className={status.enabled ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'bg-green-600 hover:bg-green-600/90 text-white'}
          >
            {status.enabled ? 'Disable Firewall' : 'Enable Firewall'}
          </Button>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TABS.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          ))}
        </div>

        {tab === 'rules' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowReset(true)}>
              <RotateCcw className="h-4 w-4" /> Reset to Defaults
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          </div>
        )}
        {tab === 'fail2ban' && (
          <Button variant="destructive" onClick={() => setShowBanIp(true)}>
            <Ban className="h-4 w-4" /> Ban IP
          </Button>
        )}
      </div>

      {/* Modals */}
      {showAdd && <AddRuleModal onClose={() => setShowAdd(false)} />}
      {unbanTarget && <UnbanIpModal jail={unbanTarget} onClose={() => setUnbanTarget(null)} />}
      {showBanIp && jails && (
        <BanIpModal jails={jails} onClose={() => setShowBanIp(false)} />
      )}
      {showReset && <ResetConfirmModal onClose={() => setShowReset(false)} />}

      <ConfirmDialog
        open={deleteRuleTarget !== null}
        title="Delete Firewall Rule"
        message={`This will permanently delete firewall rule #${deleteRuleTarget}. This may affect network access to your server.`}
        variant="danger"
        onConfirm={() => { if (deleteRuleTarget !== null) deleteRule.mutate(deleteRuleTarget); setDeleteRuleTarget(null); }}
        onCancel={() => setDeleteRuleTarget(null)}
      />

      {/* ── Rules Tab ──────────────────────────────────────────────────────── */}
      {tab === 'rules' && (
        <div className="space-y-6">
          {/* Presets */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">Quick Presets</h3>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset.mutate(p.key as Parameters<typeof applyPreset.mutate>[0])}
                  disabled={applyPreset.isPending}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {!rules?.length ? (
            <EmptyState icon={Flame} title="No firewall rules" description="Add a firewall rule to get started." />
          ) : (
            <ResponsiveTable>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Enabled</th>
                    <th className="px-4 py-3 text-left font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">Action</th>
                    <th className="px-4 py-3 text-left font-medium">Direction</th>
                    <th className="px-4 py-3 text-left font-medium">From</th>
                    <th className="px-4 py-3 text-left font-medium">Rule</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.number} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <ToggleSwitch
                          enabled={r.enabled !== false}
                          onChange={() =>
                            toggleRule.mutate({
                              ruleNumber: r.number,
                              enabled: r.enabled === false,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{r.number}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.action === 'allow'
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{r.direction}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.from || 'Any'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.rule}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteRuleTarget(r.number)} className="hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </div>
      )}

      {/* ── Fail2Ban Tab ───────────────────────────────────────────────────── */}
      {tab === 'fail2ban' &&
        (jailsLoading ? (
          <LoadingPage />
        ) : !jails?.length ? (
          <EmptyState icon={Shield} title="No Fail2Ban jails" description="Fail2Ban is not configured or has no active jails." />
        ) : (
          <div className="space-y-4">
            {jails.map((j) => (
              <div key={j.name} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-red-500/10 p-2">
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium">{j.name}</div>
                      <div className="text-sm text-muted-foreground">{j.bannedCount} banned IP(s)</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setUnbanTarget(j)}>
                    <Unlock className="h-4 w-4" /> Unban
                  </Button>
                </div>
                {j.bannedIps.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {j.bannedIps.map((ip) => (
                      <span key={ip} className="rounded-full bg-red-500/10 px-3 py-1 font-mono text-xs text-red-500">
                        {ip}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No banned IPs</p>
                )}
              </div>
            ))}
          </div>
        ))}

      {/* ── Logs Tab ───────────────────────────────────────────────────────── */}
      {tab === 'logs' && <Fail2BanLogViewer />}

      {/* ── Activity Tab ───────────────────────────────────────────────────── */}
      {tab === 'activity' && <LoginActivityTab />}

      {/* ── SSH Tab ────────────────────────────────────────────────────────── */}
      {tab === 'ssh' && <SshSettingsTab />}
    </div>
  );
}

// ─── Fail2Ban Log Viewer ───────────────────────────────────────────────────────

function Fail2BanLogViewer() {
  const { data, isLoading, refetch } = useFail2banLogs(50);

  if (isLoading) return <LoadingPage />;

  const logLines = (data?.log || '').split('\n').filter(Boolean);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Fail2Ban Logs</h3>
          <span className="text-xs text-muted-foreground">(last 50 lines)</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      <div className="max-h-[500px] overflow-auto bg-background p-4">
        {logLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No log entries available.</p>
        ) : (
          <pre className="space-y-1 font-mono text-xs leading-relaxed">
            {logLines.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')
                    ? 'text-red-400'
                    : line.toLowerCase().includes('ban')
                    ? 'text-yellow-400'
                    : line.toLowerCase().includes('unban')
                    ? 'text-green-400'
                    : 'text-muted-foreground'
                }`}
              >
                {line}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Login Activity Tab ────────────────────────────────────────────────────────

function LoginActivityTab() {
  const { data: auditData, isLoading } = useAuditLog({ perPage: 100 });

  if (isLoading) return <LoadingPage />;

  const loginEntries = (auditData?.data || []).filter(
    (e: AuditEntry) =>
      e.action?.toLowerCase().includes('login') ||
      e.action?.toLowerCase().includes('logout') ||
      e.action?.toLowerCase().includes('auth')
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Recent Login Activity</h3>
        <span className="text-xs text-muted-foreground">({loginEntries.length} entries)</span>
      </div>
      {loginEntries.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={Activity} title="No login activity" description="No recent login or logout events found." />
        </div>
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">IP Address</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {loginEntries.map((entry) => {
                const isSuccess =
                  entry.action?.toLowerCase().includes('success') ||
                  entry.action?.toLowerCase().includes('login');
                const isFailure =
                  entry.action?.toLowerCase().includes('fail') ||
                  entry.action?.toLowerCase().includes('invalid');
                return (
                  <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isFailure
                            ? 'bg-red-500/10 text-red-500'
                            : isSuccess
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-blue-500/10 text-blue-500'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.ip || '—'}</td>
                    <td className="px-4 py-3 text-xs">{entry.userId || '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                      {entry.details || entry.userAgent || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </div>
  );
}

// ─── SSH Settings Tab ──────────────────────────────────────────────────────────

function SshSettingsTab() {
  const { data, isLoading } = useSshSettings();
  const updateSsh = useUpdateSshSettings();
  const [form, setForm] = useState({
    port: 22,
    permitRootLogin: false,
    passwordAuth: true,
    pubkeyAuth: true,
  });
  const [initialized, setInitialized] = useState(false);

  // Sync server data → local form once
  if (!initialized && data) {
    setForm({
      port: data.port ?? 22,
      permitRootLogin: data.permitRootLogin ?? false,
      passwordAuth: data.passwordAuth ?? true,
      pubkeyAuth: data.pubkeyAuth ?? true,
    });
    setInitialized(true);
  }

  if (isLoading) return <LoadingPage />;

  const handleSave = () => {
    updateSsh.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Terminal className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">SSH Configuration</h3>
            <p className="text-xs text-muted-foreground">Manage SSH daemon settings</p>
          </div>
        </div>
        <div className="space-y-5 p-4">
          {/* Port */}
          <div>
            <Label htmlFor="ssh-port" className="mb-1">SSH Port</Label>
            <Input
              id="ssh-port"
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
              className="max-w-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Changing the SSH port will require updating your firewall rules.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Root Login</span>
                <p className="text-xs text-muted-foreground">Allow SSH login as root user</p>
              </div>
              <ToggleSwitch
                enabled={form.permitRootLogin}
                onChange={() => setForm({ ...form, permitRootLogin: !form.permitRootLogin })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Password Authentication</span>
                <p className="text-xs text-muted-foreground">Allow SSH login with password</p>
              </div>
              <ToggleSwitch
                enabled={form.passwordAuth}
                onChange={() => setForm({ ...form, passwordAuth: !form.passwordAuth })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Public Key Authentication</span>
                <p className="text-xs text-muted-foreground">Allow SSH login with public keys</p>
              </div>
              <ToggleSwitch
                enabled={form.pubkeyAuth}
                onChange={() => setForm({ ...form, pubkeyAuth: !form.pubkeyAuth })}
              />
            </div>
          </div>

          {updateSsh.error && (
            <p className="text-sm text-destructive">{String(updateSsh.error)}</p>
          )}

          <Button
            onClick={handleSave}
            disabled={updateSsh.isPending}
          >
            {updateSsh.isPending ? 'Saving...' : 'Save SSH Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
