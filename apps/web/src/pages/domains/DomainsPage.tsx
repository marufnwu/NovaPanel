import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  useDomains, useCreateDomain, useDeleteDomain, useSuspendDomain,
  useActivateDomain, useMakePrimaryDomain, useBulkSuspendDomains,
  useBulkActivateDomains, useBulkDeleteDomains, useVerifyDomainDns,
  type Domain, type CreateDomainInput,
} from '../../api/hooks/domains';
import { useSites } from '../../api/hooks/sites';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Globe, Plus, Trash2, Ban, CheckCircle, ExternalLink, Server,
  Shield, ArrowUpDown, Search, Loader2, MoreVertical, AlertTriangle,
} from 'lucide-react';
import { toast } from '../../lib/toast';

const DOMAIN_TYPES = [
  { value: 'primary', label: 'Primary' },
  { value: 'addon', label: 'Addon' },
  { value: 'parked', label: 'Parked' },
  { value: 'subdomain', label: 'Subdomain' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'mail-only', label: 'Mail Only' },
];

function StatusBadge({ status }: { status: Domain['status'] }) {
  const variant = status === 'active' ? 'default' : status === 'suspended' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function TypeBadge({ type }: { type: Domain['type'] }) {
  return <Badge variant="outline">{type}</Badge>;
}

function CreateDomainModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createDomain = useCreateDomain();
  const { data: sites } = useSites();
  const verifyDns = useVerifyDomainDns();
  const [form, setForm] = useState<CreateDomainInput & { key: number }>({ name: '', type: 'primary', key: 0 });
  const [dnsStatus, setDnsStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createDomain.mutate(
      { ...form, skipDnsVerification: true },
      {
        onSuccess: () => { toast.success(`Domain "${form.name}" created`); onClose(); setForm({ name: '', type: 'primary', key: form.key + 1 }); setDnsStatus(null); },
        onError: (err: any) => toast.error(err?.message || 'Failed to create domain'),
      }
    );
  };

  const checkDns = async () => {
    if (!form.name) return;
    setDnsStatus({ ok: false, msg: 'Checking...' });
    try {
      const result = await verifyDns.mutateAsync(form.name);
      setDnsStatus(result.pointsToServer ? { ok: true, msg: 'DNS points to this server ✓' } : { ok: false, msg: `DNS does NOT point to this server (found: ${result.resolvesTo.join(', ') || 'none'}). Use Cloudflare Tunnel instead.` });
    } catch { setDnsStatus({ ok: false, msg: 'DNS check failed' }); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add Domain</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Domain Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} placeholder="example.com" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DOMAIN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Attach to Site</Label>
              <Select value={form.siteId || ''} onValueChange={(v) => setForm({ ...form, siteId: v || undefined })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {sites?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type === 'redirect' && (
            <div>
              <Label>Redirect Target URL</Label>
              <Input value={form.redirectTarget || ''} onChange={(e) => setForm({ ...form, redirectTarget: e.target.value })} placeholder="https://other.com" className="mt-1" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={checkDns} disabled={!form.name || verifyDns.isPending}>
              {verifyDns.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Search className="mr-1 h-3 w-3" />}
              Check DNS
            </Button>
            {dnsStatus && <span className={`text-xs ${dnsStatus.ok ? 'text-green-500' : 'text-amber-500'}`}>{dnsStatus.msg}</span>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createDomain.isPending || !form.name}>
              {createDomain.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {createDomain.isPending ? 'Creating...' : 'Add Domain'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DomainsPage() {
  const { data: domains, isLoading } = useDomains();
  const { data: sites } = useSites();
  const deleteDomain = useDeleteDomain();
  const suspendDomain = useSuspendDomain();
  const activateDomain = useActivateDomain();
  const makePrimary = useMakePrimaryDomain();
  const bulkSuspend = useBulkSuspendDomains();
  const bulkActivate = useBulkActivateDomains();
  const bulkDelete = useBulkDeleteDomains();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);

  const handleDelete = (id: string) => {
    deleteDomain.mutate(id, {
      onSuccess: () => { toast.success('Domain deleted'); setDeleteId(null); },
      onError: () => toast.error('Failed to delete domain'),
    });
  };

  const getSiteName = (siteId?: string | null) => sites?.find(s => s.id === siteId)?.name;

  const columns: ColumnDef<Domain>[] = [
    { id: 'select', header: ({ table }) => (
      <input type="checkbox" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />
    ), cell: ({ row }) => (
      <input type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
    ), enableSorting: false },
    { accessorKey: 'name', header: 'Domain', cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {row.original.sslEnabled && <Shield className="h-3.5 w-3.5 text-green-500" />}
        <span className="font-medium">{row.original.name}</span>
        {row.original.type !== 'primary' && <TypeBadge type={row.original.type} />}
      </div>
    )},
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'siteId', header: 'Site', cell: ({ row }) => getSiteName(row.original.siteId) ? (
      <span className="text-sm text-muted-foreground">{getSiteName(row.original.siteId)}</span>
    ) : <span className="text-sm text-muted-foreground">—</span> },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        {row.original.status === 'active' ? (
          <Button variant="ghost" size="icon" onClick={() => suspendDomain.mutate(row.original.id, { onSuccess: () => toast.success('Suspended'), onError: () => toast.error('Failed') })}><Ban className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => activateDomain.mutate(row.original.id, { onSuccess: () => toast.success('Activated'), onError: () => toast.error('Failed') })}><CheckCircle className="h-3.5 w-3.5 text-green-500" /></Button>
        )}
        {row.original.type !== 'primary' && (
          <Button variant="ghost" size="icon" onClick={() => makePrimary.mutate(row.original.id, { onSuccess: () => toast.success('Promoted to primary'), onError: () => toast.error('Failed') })}><ArrowUpDown className="h-3.5 w-3.5" /></Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
    ), enableSorting: false },
  ];

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-6 my-6">
      <PageHeader
        title="Domains"
        description="Manage your domains, subdomains, aliases and redirects"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Domain
          </Button>
        }
      />

      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => { bulkSuspend.mutate(selectedIds, { onSuccess: () => toast.success('Suspended') }); setRowSelection({}); }}><Ban className="mr-1 h-3 w-3" /> Suspend</Button>
          <Button size="sm" variant="outline" onClick={() => { bulkActivate.mutate(selectedIds, { onSuccess: () => toast.success('Activated') }); setRowSelection({}); }}><CheckCircle className="mr-1 h-3 w-3" /> Activate</Button>
          <Button size="sm" variant="destructive" onClick={() => { bulkDelete.mutate(selectedIds, { onSuccess: () => { toast.success(`Deleted ${selectedIds.length} domains`); setRowSelection({}); } }); }}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
        </div>
      )}

      {!domains?.length ? (
        <EmptyState icon={Globe} title="No domains yet" description="Add your first domain to get started." action={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Add Domain</Button>} />
      ) : (
        <DataTable columns={columns} data={domains} searchKey="name" searchPlaceholder="Search domains..." />
      )}

      <CreateDomainModal open={showCreate} onClose={() => setShowCreate(false)} />
      <ConfirmDialog open={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} title="Delete Domain" message="This will remove the domain and its nginx configuration. This action cannot be undone." confirmText="Delete" variant="danger" />
    </div>
  );
}
