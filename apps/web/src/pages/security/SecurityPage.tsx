import { useState } from 'react';
import {
  useWafRules,
  useCreateWafRule,
  useUpdateWafRule,
  useDeleteWafRule,
  useIpAllowlists,
  useCreateIpAllowlist,
  useUpdateIpAllowlist,
  useDeleteIpAllowlist,
  type WafRule,
  type IpAllowlist,
} from '../../api/hooks/security';
import { useAuthStore } from '../../store/auth.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingPage } from '../../components/design-system/LoadingPage';
import { StatusBadge } from '../../components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  Plus,
  Trash2,
  Pencil,
  X,
  ShieldAlert,
  Globe,
  Loader2,
  Ban,
  Check,
} from 'lucide-react';
import { toast } from '../../lib/toast';

type TabKey = 'waf' | 'ip';

const WAF_TYPES = [
  { value: 'rate_limit', label: 'Rate Limit' },
  { value: 'geo_block', label: 'Geo Block' },
  { value: 'owasp', label: 'OWASP' },
  { value: 'bot', label: 'Bot Protection' },
  { value: 'custom', label: 'Custom' },
] as const;

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

function WafRuleModal({
  initial,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: WafRule;
  onClose: () => void;
  onSubmit: (data: { name: string; type: WafRule['type']; enabled?: boolean; priority?: number; config?: Record<string, unknown> }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? ('rate_limit' as WafRule['type']),
    enabled: initial?.enabled ?? true,
    priority: initial?.priority ?? 0,
    rate: '',
    windowSecs: '',
  });

  const handleSubmit = () => {
    const config: Record<string, unknown> = {};
    if (form.type === 'rate_limit') {
      config.rate = form.rate ? parseInt(form.rate) : 100;
      config.windowSecs = form.windowSecs ? parseInt(form.windowSecs) : 60;
    }
    onSubmit({ name: form.name, type: form.type, enabled: form.enabled, priority: form.priority, config: Object.keys(config).length ? config : undefined });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit WAF Rule' : 'Create WAF Rule'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="waf-name">Name</Label>
            <Input id="waf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Block high traffic" />
          </div>
          <div>
            <Label>Type</Label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as WafRule['type'] })}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {WAF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {form.type === 'rate_limit' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="waf-rate">Rate (req/s)</Label>
                <Input id="waf-rate" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="100" />
              </div>
              <div>
                <Label htmlFor="waf-window">Window (secs)</Label>
                <Input id="waf-window" type="number" value={form.windowSecs} onChange={(e) => setForm({ ...form, windowSecs: e.target.value })} placeholder="60" />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="waf-priority">Priority</Label>
            <Input id="waf-priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Enabled</span>
            <ToggleSwitch enabled={form.enabled} onChange={() => setForm({ ...form, enabled: !form.enabled })} />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending ? 'Saving...' : initial ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IpAllowlistModal({
  initial,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: IpAllowlist;
  onClose: () => void;
  onSubmit: (data: { name: string; ips: string[]; type: 'allow' | 'block' }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    ips: initial?.ips?.join('\n') ?? '',
    type: initial?.type ?? 'allow' as 'allow' | 'block',
  });

  const handleSubmit = () => {
    const ips = form.ips.split('\n').map((ip) => ip.trim()).filter(Boolean);
    onSubmit({ name: form.name, ips, type: form.type });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit IP Allowlist' : 'Create IP Allowlist'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ip-name">Name</Label>
            <Input id="ip-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Admin IPs" />
          </div>
          <div>
            <Label>Type</Label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'allow' | 'block' })}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ip-list">IP Addresses (one per line)</Label>
            <textarea
              id="ip-list"
              value={form.ips}
              onChange={(e) => setForm({ ...form, ips: e.target.value })}
              placeholder="192.168.1.100&#10;10.0.0.0/8"
              rows={5}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim() || !form.ips.trim()}>
            {isPending ? 'Saving...' : initial ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';

  const { data: wafRules, isLoading: wafLoading } = useWafRules(projectId);
  const { data: ipAllowlists, isLoading: ipLoading } = useIpAllowlists(projectId);

  const createWaf = useCreateWafRule();
  const updateWaf = useUpdateWafRule();
  const deleteWaf = useDeleteWafRule();
  const createIp = useCreateIpAllowlist();
  const updateIp = useUpdateIpAllowlist();
  const deleteIp = useDeleteIpAllowlist();

  const [tab, setTab] = useState<TabKey>('waf');
  const [showWafModal, setShowWafModal] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [editWaf, setEditWaf] = useState<WafRule | null>(null);
  const [editIp, setEditIp] = useState<IpAllowlist | null>(null);
  const [deleteWafId, setDeleteWafId] = useState<string | null>(null);
  const [deleteIpId, setDeleteIpId] = useState<string | null>(null);

  const handleCreateWaf = (data: { name: string; type: WafRule['type']; enabled?: boolean; priority?: number; config?: Record<string, unknown> }) => {
    createWaf.mutate(
      { projectId, data },
      {
        onSuccess: () => { toast.success('WAF rule created'); setShowWafModal(false); },
        onError: (e: Error) => toast.error(e.message || 'Failed to create WAF rule'),
      }
    );
  };

  const handleUpdateWaf = (data: { name: string; type: WafRule['type']; enabled?: boolean; priority?: number; config?: Record<string, unknown> }) => {
    if (!editWaf) return;
    updateWaf.mutate(
      { id: editWaf.id, data },
      {
        onSuccess: () => { toast.success('WAF rule updated'); setEditWaf(null); },
        onError: (e: Error) => toast.error(e.message || 'Failed to update WAF rule'),
      }
    );
  };

  const handleDeleteWaf = () => {
    if (!deleteWafId) return;
    deleteWaf.mutate(deleteWafId, {
      onSuccess: () => { toast.success('WAF rule deleted'); setDeleteWafId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed to delete WAF rule'),
    });
  };

  const handleCreateIp = (data: { name: string; ips: string[]; type: 'allow' | 'block' }) => {
    createIp.mutate(
      { projectId, data },
      {
        onSuccess: () => { toast.success('IP allowlist created'); setShowIpModal(false); },
        onError: (e: Error) => toast.error(e.message || 'Failed to create IP allowlist'),
      }
    );
  };

  const handleUpdateIp = (data: { name: string; ips: string[]; type: 'allow' | 'block' }) => {
    if (!editIp) return;
    updateIp.mutate(
      { id: editIp.id, data },
      {
        onSuccess: () => { toast.success('IP allowlist updated'); setEditIp(null); },
        onError: (e: Error) => toast.error(e.message || 'Failed to update IP allowlist'),
      }
    );
  };

  const handleDeleteIp = () => {
    if (!deleteIpId) return;
    deleteIp.mutate(deleteIpId, {
      onSuccess: () => { toast.success('IP allowlist deleted'); setDeleteIpId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed to delete IP allowlist'),
    });
  };

  if (wafLoading || ipLoading) return <LoadingPage />;

  const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
    { key: 'waf', label: 'WAF Rules', icon: ShieldAlert },
    { key: 'ip', label: 'IP Allowlists', icon: Globe },
  ];

  return (
    <div>
      <PageHeader
        title="Security"
        description="Manage WAF rules and IP access control"
        icon={Shield}
      />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TABS.map((t) => (
            <Button key={t.key} variant={tab === t.key ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t.key)}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          ))}
        </div>

        {tab === 'waf' && (
          <Button onClick={() => setShowWafModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Rule
          </Button>
        )}
        {tab === 'ip' && (
          <Button onClick={() => setShowIpModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Allowlist
          </Button>
        )}
      </div>

      {showWafModal && (
        <WafRuleModal
          onClose={() => setShowWafModal(false)}
          onSubmit={handleCreateWaf}
          isPending={createWaf.isPending}
        />
      )}
      {editWaf && (
        <WafRuleModal
          initial={editWaf}
          onClose={() => setEditWaf(null)}
          onSubmit={handleUpdateWaf}
          isPending={updateWaf.isPending}
        />
      )}
      {showIpModal && (
        <IpAllowlistModal
          onClose={() => setShowIpModal(false)}
          onSubmit={handleCreateIp}
          isPending={createIp.isPending}
        />
      )}
      {editIp && (
        <IpAllowlistModal
          initial={editIp}
          onClose={() => setEditIp(null)}
          onSubmit={handleUpdateIp}
          isPending={updateIp.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteWafId}
        title="Delete WAF Rule"
        message="This will permanently delete this WAF rule. This may affect your site's security configuration."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteWaf}
        onCancel={() => setDeleteWafId(null)}
      />

      <ConfirmDialog
        open={!!deleteIpId}
        title="Delete IP Allowlist"
        message="This will permanently delete this IP allowlist. Affected sites will lose the IP restrictions."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteIp}
        onCancel={() => setDeleteIpId(null)}
      />

      {/* WAF Rules Tab */}
      {tab === 'waf' && (
        wafRules?.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No WAF rules" description="Create your first WAF rule to protect your sites." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wafRules?.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <ToggleSwitch
                        enabled={rule.enabled}
                        onChange={() => updateWaf.mutate({ id: rule.id, data: { enabled: !rule.enabled } }, { onSuccess: () => toast.success('Rule updated'), onError: (e: Error) => toast.error(e.message) })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <StatusBadge variant="neutral">{rule.type.replace('_', ' ')}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rule.priority}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {rule.type === 'rate_limit' && rule.config ? `${(rule.config as Record<string, unknown>).rate}r/s / ${(rule.config as Record<string, unknown>).windowSecs}s` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditWaf(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteWafId(rule.id)} className="hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* IP Allowlists Tab */}
      {tab === 'ip' && (
        ipAllowlists?.length === 0 ? (
          <EmptyState icon={Globe} title="No IP allowlists" description="Create your first IP allowlist to control access." />
        ) : (
          <div className="space-y-4">
            {ipAllowlists?.map((list) => (
              <div key={list.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className={`rounded p-2 ${list.type === 'allow' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {list.type === 'allow' ? <Check className="h-4 w-4 text-green-500" /> : <Ban className="h-4 w-4 text-red-500" />}
                    </div>
                    <div>
                      <div className="font-medium">{list.name}</div>
                      <div className="text-sm text-muted-foreground">{list.ips.length} IP(s)</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditIp(list)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteIpId(list.id)} className="hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{list.ips.join('\n')}</pre>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}