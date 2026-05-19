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
import { Modal } from '../../components/ui/Modal';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { 
  Globe, Plus, Trash2, Ban, CheckCircle, 
  Server, MoreVertical, HardDrive 
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
  const styles = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-orange-500/10 text-orange-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function RuntimeBadge({ config }: { config: RuntimeConfig }) {
  const label = config.runtime === 'php' 
    ? `PHP ${config.phpVersion || config.version || '?'}`
    : config.runtime === 'node'
    ? `Node ${config.nodeVersion || config.version || '?'}`
    : config.runtime === 'python'
    ? `Python ${config.pythonVersion || config.version || '?'}`
    : config.runtime?.toUpperCase() || 'Unknown';
  
  return (
    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500">
      {label}
    </span>
  );
}

interface CreateSiteModalProps {
  onClose: () => void;
}

function CreateSiteModal({ onClose }: CreateSiteModalProps) {
  const createSite = useCreateSite();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    runtime: 'php' as RuntimeConfig['runtime'],
    // PHP
    phpVersion: '8.2',
    // Node
    nodeVersion: '20',
    nodeBuildCommand: '',
    nodeStartCommand: '',
    nodePort: 3000,
    // Python
    pythonVersion: '3.11',
    venvPath: 'venv',
    pythonStartCommand: '',
    pythonPort: 8000,
    // Domain
    primaryDomain: '',
  });

  const buildRuntimeConfig = (): RuntimeConfig => {
    const base = {
      schemaVersion: 1,
      runtime: form.runtime,
      version: form.runtime === 'php' ? form.phpVersion 
           : form.runtime === 'node' ? form.nodeVersion
           : form.runtime === 'python' ? form.pythonVersion
           : undefined,
    };

    if (form.runtime === 'php') {
      return { ...base, phpVersion: form.phpVersion };
    }
    if (form.runtime === 'node') {
      return { 
        ...base, 
        nodeVersion: form.nodeVersion,
        buildCommand: form.nodeBuildCommand || undefined,
        startCommand: form.nodeStartCommand || undefined,
      };
    }
    if (form.runtime === 'python') {
      return { 
        ...base, 
        pythonVersion: form.pythonVersion,
        venvPath: form.venvPath || undefined,
        startCommand: form.pythonStartCommand || undefined,
      };
    }
    return base;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    createSite.mutate(
      {
        name: form.name,
        runtime: buildRuntimeConfig(),
        primaryDomain: form.primaryDomain || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Site "${form.name}" created successfully`);
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to create site');
        },
      }
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Site Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="my-awesome-site"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Runtime</label>
              <div className="grid grid-cols-2 gap-2">
                {RUNTIMES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, runtime: r.value as RuntimeConfig['runtime'] })}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      form.runtime === r.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background hover:bg-accent'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {form.runtime === 'php' && (
              <div>
                <label className="mb-1 block text-sm font-medium">PHP Version</label>
                <select
                  value={form.phpVersion}
                  onChange={(e) => setForm({ ...form, phpVersion: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PHP_VERSIONS.map((v) => <option key={v} value={v}>PHP {v}</option>)}
                </select>
              </div>
            )}

            {form.runtime === 'node' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Node.js Version</label>
                  <select
                    value={form.nodeVersion}
                    onChange={(e) => setForm({ ...form, nodeVersion: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {NODE_VERSIONS.map((v) => <option key={v} value={v}>Node {v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Build Command</label>
                  <input
                    type="text"
                    value={form.nodeBuildCommand}
                    onChange={(e) => setForm({ ...form, nodeBuildCommand: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="npm run build"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Command</label>
                  <input
                    type="text"
                    value={form.nodeStartCommand}
                    onChange={(e) => setForm({ ...form, nodeStartCommand: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="npm start"
                  />
                </div>
              </>
            )}

            {form.runtime === 'python' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Python Version</label>
                  <select
                    value={form.pythonVersion}
                    onChange={(e) => setForm({ ...form, pythonVersion: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {PYTHON_VERSIONS.map((v) => <option key={v} value={v}>Python {v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Command</label>
                  <input
                    type="text"
                    value={form.pythonStartCommand}
                    onChange={(e) => setForm({ ...form, pythonStartCommand: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="gunicorn app:app"
                  />
                </div>
              </>
            )}

            {form.runtime === 'static' && (
              <p className="text-sm text-muted-foreground">
                Static sites are served directly by nginx without any application server.
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Primary Domain (optional)</label>
              <input
                type="text"
                value={form.primaryDomain}
                onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="example.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Add your domain after creating the site from the Domains page
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Create New Site" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                s === step ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                {s}
              </span>
              <span className={s === step ? 'font-medium' : 'text-muted-foreground'}>
                {s === 1 ? 'Name' : s === 2 ? 'Runtime' : 'Domain'}
              </span>
              {s < 3 && <span className="text-muted-foreground">›</span>}
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          {renderStep()}
        </div>

        <div className="flex justify-between border-t pt-4">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
            >
              Back
            </button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={createSite.isPending || !form.name.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createSite.isPending ? 'Creating...' : 'Create Site'}
            </button>
          )}
        </div>
      </form>
    </Modal>
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
      onSuccess: () => {
        toast.success('Site deleted');
        setDeleteId(null);
      },
      onError: () => toast.error('Failed to delete site'),
    });
  };

  const handleSuspend = (id: string) => {
    suspendSite.mutate(id, {
      onSuccess: () => toast.success('Site suspended'),
      onError: () => toast.error('Failed to suspend site'),
    });
  };

  const handleActivate = (id: string) => {
    activateSite.mutate(id, {
      onSuccess: () => toast.success('Site activated'),
      onError: () => toast.error('Failed to activate site'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-6 my-6">
      <PageHeader
        title="Sites"
        description="Manage your sites and applications"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Site
          </button>
        }
      />

      {sites?.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No sites yet"
          description="Create your first site to get started with the new architecture."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Site
            </button>
          }
        />
      ) : (
        <ResponsiveTable>
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Runtime</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Disk</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(sites || []).map((site) => (
              <tr key={site.id} className="border-b hover:bg-muted/50">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    {site.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={site.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">—</span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <HardDrive className="h-3 w-3" />
                    {site.diskUsedMb} MB
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {site.status === 'active' ? (
                      <button
                        onClick={() => handleSuspend(site.id)}
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Ban className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(site.id)}
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                      >
                        <CheckCircle className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(site.id)}
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      )}

      {showCreate && <CreateSiteModal onClose={() => setShowCreate(false)} />}

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