import { useState } from 'react';
import {
  useWebsites,
  useCreateWebsite,
  useDeleteWebsite,
  useSuspendWebsite,
  useActivateWebsite,
  type Website,
  type CreateWebsiteInput,
} from '../../api/hooks/websites';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import {
  Globe, Plus, Trash2, Ban, CheckCircle, X, Server,
  MoreVertical, Edit3, HardDrive, AlertTriangle,
} from 'lucide-react';
import type { ApiError } from '../../api/client';
import { toast } from '../../lib/toast';

const WEBSERVER_TYPES = [
  { value: 'nginx', label: 'Nginx' },
  { value: 'apache', label: 'Apache' },
  { value: 'nginx+apache', label: 'Nginx + Apache' },
];

// --- Status Badge ---
function StatusBadge({ status }: { status: Website['status'] }) {
  const styles = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-orange-500/10 text-orange-500',
    error: 'bg-red-500/10 text-red-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

// --- Create Website Modal ---
function CreateWebsiteModal({ onClose }: { onClose: () => void }) {
  const createWebsite = useCreateWebsite();
  const { data: phpData, isLoading: phpLoading } = usePhpVersions();
  const phpVersions = (phpData?.versions?.length ? phpData.versions : DEFAULT_PHP_VERSIONS);
  const [form, setForm] = useState<CreateWebsiteInput>({
    name: '',
    phpVersion: phpVersions[0] || '8.1',
    webServer: 'nginx',
  });

  const autoDocRoot = form.name ? `/var/www/vhosts/${form.name}/httpdocs` : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    createWebsite.mutate(
      {
        ...form,
        documentRoot: form.documentRoot || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Website "${form.name}" created successfully`);
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to create website');
        },
      },
    );
  };

  return (
    <Modal open={true} onClose={onClose} title="Create Website" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {createWebsite.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error:</strong> {(createWebsite.error as ApiError).message || String(createWebsite.error)}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Website Name</label>
          <input
            placeholder="my-website"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoFocus
          />
          <p className="mt-1 text-xs text-muted-foreground">A unique name to identify this website</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Document Root</label>
          <input
            placeholder={autoDocRoot || '/var/www/vhosts/{name}/httpdocs'}
            value={form.documentRoot || ''}
            onChange={(e) => setForm({ ...form, documentRoot: e.target.value })}
            className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty for default: {autoDocRoot || '...'}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">PHP Version</label>
            <select
              value={form.phpVersion || phpVersions[0] || '8.1'}
              onChange={(e) => setForm({ ...form, phpVersion: e.target.value })}
              disabled={phpLoading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {phpLoading ? (
                <option value="">Loading versions...</option>
              ) : phpVersions.length === 0 ? (
                <option value="">No PHP versions installed</option>
              ) : (
                phpVersions.map((v) => (
                  <option key={v} value={v}>PHP {v}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Web Server</label>
            <select
              value={form.webServer || 'nginx'}
              onChange={(e) => setForm({ ...form, webServer: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {WEBSERVER_TYPES.map((ws) => (
                <option key={ws.value} value={ws.value}>{ws.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || createWebsite.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createWebsite.isPending ? 'Creating...' : 'Create Website'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Action Dropdown ---
function ActionDropdown({
  website,
  onEdit,
  onSuspend,
  onActivate,
  onDelete,
}: {
  website: Website;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
            {website.status === 'active' ? (
              <button
                onClick={() => { setOpen(false); onSuspend(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Ban className="h-3.5 w-3.5" /> Suspend
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); onActivate(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <CheckCircle className="h-3.5 w-3.5" /> Activate
              </button>
            )}
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Page ---
export function WebsitesPage() {
  const { data: websites, isLoading, isError, refetch } = useWebsites();
  const deleteWebsite = useDeleteWebsite();
  const suspendWebsite = useSuspendWebsite();
  const activateWebsite = useActivateWebsite();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Website | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Website | null>(null);
  const [activateTarget, setActivateTarget] = useState<Website | null>(null);

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div>
        <PageHeader title="Websites" description="Manage your websites" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load websites</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching websites. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    deleteWebsite.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(`Website "${name}" deleted`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to delete website');
      },
    });
  };

  const handleSuspend = () => {
    if (!suspendTarget) return;
    const name = suspendTarget.name;
    suspendWebsite.mutate(suspendTarget.id, {
      onSuccess: () => {
        setSuspendTarget(null);
        toast.success(`Website "${name}" suspended`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to suspend website');
      },
    });
  };

  const handleActivate = () => {
    if (!activateTarget) return;
    const name = activateTarget.name;
    activateWebsite.mutate(activateTarget.id, {
      onSuccess: () => {
        setActivateTarget(null);
        toast.success(`Website "${name}" activated`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to activate website');
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Websites"
        description="Manage your websites, configurations, and resources"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Website
          </button>
        }
      />

      {!websites?.length ? (
        <EmptyState
          icon={Globe}
          title="No websites"
          description="Create your first website to get started."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create Website
            </button>
          }
        />
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">PHP Version</th>
                <th className="px-4 py-3 text-left font-medium">Web Server</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Disk Usage</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {websites.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer"
                  onClick={() => {
                    // Navigation will be wired in Phase 8 when router is updated
                    // For now, this is a placeholder
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{w.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate max-w-xs">
                      {w.documentRoot}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.phpVersion || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.webServer || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {w.diskUsedMb != null ? `${w.diskUsedMb} MB` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ActionDropdown
                        website={w}
                        onEdit={() => {
                          // Edit will be handled via detail page navigation
                        }}
                        onSuspend={() => setSuspendTarget(w)}
                        onActivate={() => setActivateTarget(w)}
                        onDelete={() => setDeleteTarget(w)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {/* Create Website Modal */}
      {showCreate && <CreateWebsiteModal onClose={() => setShowCreate(false)} />}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Website"
          message={`This will permanently delete "${deleteTarget.name}" and all associated configuration. This action cannot be undone.`}
          variant="danger"
          requireTyping={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Suspend Confirmation */}
      {suspendTarget && (
        <ConfirmDialog
          open={true}
          title="Suspend Website"
          message={`This will suspend "${suspendTarget.name}". All associated domains will become unavailable and visitors will see an error page.`}
          variant="warning"
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

      {/* Activate Confirmation */}
      {activateTarget && (
        <ConfirmDialog
          open={true}
          title="Activate Website"
          message={`This will activate "${activateTarget.name}" and bring it back online.`}
          variant="info"
          onConfirm={handleActivate}
          onCancel={() => setActivateTarget(null)}
        />
      )}
    </div>
  );
}
