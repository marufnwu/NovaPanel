import { useState } from 'react';
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useRegenerateWebhookSecret,
  useWebhookDeliveries,
  type Webhook,
} from '../../api/hooks/webhooks';
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
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Copy,
  History,
  RefreshCw,
} from 'lucide-react';
import { toast } from '../../lib/toast';

const AVAILABLE_EVENTS = [
  'site.deployed', 'site.build_failed', 'domain.created', 'domain.deleted',
  'database.created', 'backup.completed', 'alert.triggered', 'user.login', 'user.logout',
];

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function WebhookModal({
  initial, onClose, onSubmit, isPending,
}: {
  initial?: Webhook;
  onClose: () => void;
  onSubmit: (data: { name: string; url: string; events: string[]; enabled: boolean; headers: Record<string, string> }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    events: initial?.events?.join('\n') ?? '',
    headers: Object.entries(initial?.headers ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
  });

  const handleSubmit = () => {
    const headers: Record<string, string> = {};
    for (const line of form.headers.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key) headers[key] = val;
      }
    }
    onSubmit({ name: form.name, url: form.url, events: form.events.split('\n').map((e) => e.trim()).filter(Boolean), enabled: true, headers });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label htmlFor="wh-name">Name</Label><Input id="wh-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production Webhook" /></div>
          <div><Label htmlFor="wh-url">URL</Label><Input id="wh-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://api.example.com/webhook" /></div>
          <div><Label htmlFor="wh-events">Events (one per line)</Label><textarea id="wh-events" value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} rows={5} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder={AVAILABLE_EVENTS.join('\n')} /></div>
          <div><Label htmlFor="wh-headers">Custom Headers (Key: Value per line)</Label><textarea id="wh-headers" value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder="Authorization: Bearer ..." /></div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim() || !form.url.trim()}>{isPending ? 'Saving...' : initial ? 'Update' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesModal({ webhookId, webhookName, onClose }: { webhookId: string; webhookName: string; onClose: () => void }) {
  const { data: deliveries, isLoading } = useWebhookDeliveries(webhookId);

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Delivery History — {webhookName}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !deliveries || deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No deliveries yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Response</TableHead><TableHead>Delivered</TableHead><TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium font-mono text-sm">{d.event}</TableCell>
                      <TableCell>{d.success ? <span className="flex items-center gap-1 text-green-500"><CheckCircle className="h-4 w-4" /> OK</span> : <span className="flex items-center gap-1 text-red-500"><XCircle className="h-4 w-4" /> Failed</span>}</TableCell>
                      <TableCell className="font-mono text-xs">{d.responseStatus ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-xs text-red-400 max-w-xs truncate">{d.error || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4"><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecretReveal({ secret }: { secret: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">{visible ? secret : '••••••••••••••••'}</code>
      <button onClick={() => setVisible(!visible)} className="text-muted-foreground hover:text-foreground">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      <button onClick={() => { navigator.clipboard.writeText(secret); toast.success('Secret copied'); }} className="text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
    </div>
  );
}

export function WebhooksPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';
  const { data: webhooks, isLoading } = useWebhooks(orgId);
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const regenerateSecret = useRegenerateWebhookSecret();

  const [showModal, setShowModal] = useState(false);
  const [editWebhook, setEditWebhook] = useState<Webhook | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewDeliveriesId, setViewDeliveriesId] = useState<string | null>(null);
  const [revealSecretId, setRevealSecretId] = useState<string | null>(null);

  const viewDeliveriesWebhook = webhooks?.find((w) => w.id === viewDeliveriesId);

  const handleCreate = (data: { name: string; url: string; events: string[]; enabled: boolean; headers: Record<string, string> }) => {
    createWebhook.mutate({ orgId, data }, { onSuccess: () => { toast.success('Webhook created'); setShowModal(false); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };
  const handleUpdate = (data: { name: string; url: string; events: string[]; enabled: boolean; headers: Record<string, string> }) => {
    if (!editWebhook) return;
    updateWebhook.mutate({ id: editWebhook.id, data }, { onSuccess: () => { toast.success('Webhook updated'); setEditWebhook(null); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };
  const handleDelete = () => {
    if (!deleteId) return;
    deleteWebhook.mutate(deleteId, { onSuccess: () => { toast.success('Webhook deleted'); setDeleteId(null); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };
  const handleRegenerate = (id: string) => {
    regenerateSecret.mutate(id, { onSuccess: (data) => { toast.success('Secret regenerated'); setRevealSecretId(id); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };
  const handleToggle = (webhook: Webhook) => {
    updateWebhook.mutate({ id: webhook.id, data: { enabled: !webhook.enabled } }, { onSuccess: () => toast.success('Webhook updated'), onError: (e: Error) => toast.error(e.message) });
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Webhooks" description="Configure outbound webhook subscriptions for system events" icon={WebhookIcon} />
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-2" /> Add Webhook</Button>
      </div>

      {showModal && <WebhookModal onClose={() => setShowModal(false)} onSubmit={handleCreate} isPending={createWebhook.isPending} />}
      {editWebhook && <WebhookModal initial={editWebhook} onClose={() => setEditWebhook(null)} onSubmit={handleUpdate} isPending={updateWebhook.isPending} />}
      {viewDeliveriesId && viewDeliveriesWebhook && <DeliveriesModal webhookId={viewDeliveriesId} webhookName={viewDeliveriesWebhook.name} onClose={() => setViewDeliveriesId(null)} />}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Webhook"
        message="This will permanently delete this webhook. Applications relying on it will stop receiving events."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {!webhooks || webhooks.length === 0 ? (
        <EmptyState icon={WebhookIcon} title="No webhooks" description="Create your first webhook to receive real-time event notifications." />
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`rounded p-2 ${webhook.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Globe className={`h-5 w-5 ${webhook.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="font-medium">{webhook.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{webhook.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch enabled={webhook.enabled} onChange={() => handleToggle(webhook)} />
                  <Button variant="ghost" size="icon-sm" onClick={() => setViewDeliveriesId(webhook.id)} title="Delivery history"><History className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditWebhook(webhook)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(webhook.id)} className="hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Subscribed Events</div>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((e) => <StatusBadge key={e} variant="neutral" className="font-mono text-xs">{e}</StatusBadge>)}
                  </div>
                </div>
                {webhook.secret && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Secret</div>
                    <SecretReveal secret={webhook.secret} />
                    <Button variant="ghost" size="sm" className="mt-1" onClick={() => handleRegenerate(webhook.id)}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}