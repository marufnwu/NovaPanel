import { useState } from 'react';
import { 
  useSites, 
  useCreateSite, 
  useDeleteSite, 
  useSuspendSite, 
  useActivateSite,
  type Site,
  type RuntimeConfig,
} from '../../api/hooks/sites';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Globe, Plus, Trash2, Ban, CheckCircle, 
  Server, MoreVertical, HardDrive, Loader2 
} from 'lucide-react';
import { toast } from '../../lib/toast';

const RUNTIMES = [
  { value: 'php', label: 'PHP' },
  { value: 'node', label: 'Node.js' },
  { value: 'python', label: 'Python' },
  { value: 'static', label: 'Static' },
];

const PHP_VERSIONS = ['8.1', '8.2', '8.3'];
const NODE_VERSIONS = ['18', '20', '22'];
const PYTHON_VERSIONS = ['3.10', '3.11', '3.12'];

function StatusBadge({ status }: { status: Site['status'] }) {
  const variant = status === 'active' ? 'default' : 'destructive';
  return <Badge variant={variant}>{status}</Badge>;
}

function RuntimeBadge({ config }: { config: RuntimeConfig }) {
  const label = config.runtime === 'php' 
    ? `PHP ${config.phpVersion || config.version || '?'}`
    : config.runtime === 'node'
    ? `Node ${config.nodeVersion || config.version || '?'}`
    : config.runtime === 'python'
    ? `Python ${config.pythonVersion || config.version || '?'}`
    : config.runtime?.toUpperCase() || 'Unknown';
  
  return <Badge variant="secondary">{label}</Badge>;
}

function CreateSiteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createSite = useCreateSite();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<{
    name: string;
    runtime: RuntimeConfig['runtime'];
    phpVersion: string;
    nodeVersion: string;
    nodeBuildCommand: string;
    nodeStartCommand: string;
    pythonVersion: string;
    pythonStartCommand: string;
    primaryDomain: string;
  }>({
    name: '',
    runtime: 'php' as RuntimeConfig['runtime'],
    phpVersion: '8.2',
    nodeVersion: '20',
    nodeBuildCommand: '',
    nodeStartCommand: '',
    pythonVersion: '3.11',
    pythonStartCommand: '',
    primaryDomain: '',
  });

  const buildRuntimeConfig = (): RuntimeConfig => {
    const base: RuntimeConfig = {
      schemaVersion: 1,
      runtime: form.runtime,
    };
    if (form.runtime === 'php') return { ...base, phpVersion: form.phpVersion, version: form.phpVersion };
    if (form.runtime === 'node') return { ...base, nodeVersion: form.nodeVersion, version: form.nodeVersion, buildCommand: form.nodeBuildCommand || undefined, startCommand: form.nodeStartCommand || undefined };
    if (form.runtime === 'python') return { ...base, pythonVersion: form.pythonVersion, version: form.pythonVersion, startCommand: form.pythonStartCommand || undefined };
    return base;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createSite.mutate(
      { name: form.name, runtime: buildRuntimeConfig(), primaryDomain: form.primaryDomain || undefined },
      {
        onSuccess: () => { toast.success(`Site "${form.name}" created`); onClose(); },
        onError: (err: Error) => toast.error(err.message || 'Failed to create site'),
      }
    );
  };

  const canNext = step === 1 ? form.name.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Site</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            {['Name', 'Runtime', 'Domain'].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i + 1 === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                <span className={i + 1 === step ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
                {i < 2 && <span className="text-muted-foreground">›</span>}
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="site-name">Site Name</Label>
                  <Input id="site-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-awesome-site" />
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Runtime</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {RUNTIMES.map((r) => (
                      <Button key={r.value} type="button" variant={form.runtime === r.value ? 'default' : 'outline'} onClick={() => setForm({ ...form, runtime: r.value as RuntimeConfig['runtime'] })}>
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {form.runtime === 'php' && (
                  <div>
                    <Label>PHP Version</Label>
                    <select value={form.phpVersion} onChange={(e) => setForm({ ...form, phpVersion: e.target.value })} className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      {PHP_VERSIONS.map(v => <option key={v} value={v}>PHP {v}</option>)}
                    </select>
                  </div>
                )}
                {form.runtime === 'node' && (
                  <>
                    <div><Label>Node.js Version</Label>
                      <select value={form.nodeVersion} onChange={(e) => setForm({ ...form, nodeVersion: e.target.value })} className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        {NODE_VERSIONS.map(v => <option key={v} value={v}>Node {v}</option>)}
                      </select>
                    </div>
                    <div><Label>Build Command</Label><Input className="mt-2" value={form.nodeBuildCommand} onChange={(e) => setForm({ ...form, nodeBuildCommand: e.target.value })} placeholder="npm run build" /></div>
                    <div><Label>Start Command</Label><Input className="mt-2" value={form.nodeStartCommand} onChange={(e) => setForm({ ...form, nodeStartCommand: e.target.value })} placeholder="npm start" /></div>
                  </>
                )}
                {form.runtime === 'python' && (
                  <>
                    <div><Label>Python Version</Label>
                      <select value={form.pythonVersion} onChange={(e) => setForm({ ...form, pythonVersion: e.target.value })} className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        {PYTHON_VERSIONS.map(v => <option key={v} value={v}>Python {v}</option>)}
                      </select>
                    </div>
                    <div><Label>Start Command</Label><Input className="mt-2" value={form.pythonStartCommand} onChange={(e) => setForm({ ...form, pythonStartCommand: e.target.value })} placeholder="gunicorn app:app" /></div>
                  </>
                )}
                {form.runtime === 'static' && <p className="text-sm text-muted-foreground">Static sites are served directly by nginx.</p>}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Primary Domain (optional)</Label>
                  <Input className="mt-2" value={form.primaryDomain} onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })} placeholder="example.com" />
                  <p className="mt-1 text-xs text-muted-foreground">Add your domain after creating the site from the Domains page.</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            <div className="flex-1" />
            {step < 3 ? (
              <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button type="submit" disabled={createSite.isPending || !form.name.trim()}>
                {createSite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {createSite.isPending ? 'Creating...' : 'Create Site'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SitesPage() {
  const { data: sites, isLoading } = useSites();
  const deleteSite = useDeleteSite();
  const suspendSite = useSuspendSite();
  const activateSite = useActivateSite();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteSite.mutate(id, {
      onSuccess: () => { toast.success('Site deleted'); setDeleteId(null); },
      onError: () => toast.error('Failed to delete site'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-6 my-6">
      <PageHeader
        title="Sites"
        description="Manage your sites and applications"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Site
          </Button>
        }
      />

      {sites?.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No sites yet"
          description="Create your first site to get started."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Site
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Disk</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sites || []).map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {site.name}
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={site.status} /></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">—</span></TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <HardDrive className="h-3 w-3" />{site.diskUsedMb} MB
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {site.status === 'active' ? (
                        <Button variant="outline" size="icon" onClick={() => suspendSite.mutate(site.id, { onSuccess: () => toast.success('Site suspended'), onError: () => toast.error('Failed') })}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="icon" onClick={() => activateSite.mutate(site.id, { onSuccess: () => toast.success('Site activated'), onError: () => toast.error('Failed') })}>
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={() => setDeleteId(site.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateSiteModal open={showCreate} onClose={() => setShowCreate(false)} />

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Site"
        message="This will permanently delete the site and all associated data. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
