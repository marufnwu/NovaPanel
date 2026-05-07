import { useState } from 'react';
import {
  useWebsite,
  useUpdateWebsite,
  useDeleteWebsite,
  useSuspendWebsite,
  useActivateWebsite,
  useAttachDomain,
  useDetachDomain,
  useWebsiteFtp,
  useWebsiteCron,
  useWebsiteBackups,
  useWebsiteDatabases,
  useWebsiteApps,
  type Website,
  type UpdateWebsiteInput,
} from '../../api/hooks/websites';
import { useDomains, type Domain } from '../../api/hooks/domains';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import {
  Server, Trash2, Ban, CheckCircle, Edit3, HardDrive,
  Globe, FolderOpen, Users, Clock, Database, Archive,
  AppWindow, Link2, Unlink, AlertTriangle, Plus,
} from 'lucide-react';
import type { ApiError } from '../../api/client';
import { toast } from '../../lib/toast';

// Extended Domain type that includes websiteId from the API response
interface DomainWithWebsite extends Domain {
  websiteId?: string | null;
}

const WEBSERVER_TYPES = [
  { value: 'nginx', label: 'Nginx' },
  { value: 'apache', label: 'Apache' },
  { value: 'nginx+apache', label: 'Nginx + Apache' },
];

type TabId = 'overview' | 'domains' | 'files' | 'ftp' | 'cron' | 'databases' | 'backups' | 'apps';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Server },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'ftp', label: 'FTP', icon: Users },
  { id: 'cron', label: 'Cron', icon: Clock },
  { id: 'databases', label: 'Databases', icon: Database },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'apps', label: 'Apps', icon: AppWindow },
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

// --- Edit Website Modal ---
function EditWebsiteModal({ website, onClose }: { website: Website; onClose: () => void }) {
  const updateWebsite = useUpdateWebsite();
  const { data: phpData, isLoading: phpLoading } = usePhpVersions();
  const phpVersions = (phpData?.versions?.length
    ? phpData.versions.map((v: any) => typeof v === 'string' ? v : v.version)
    : DEFAULT_PHP_VERSIONS);
  const [form, setForm] = useState<UpdateWebsiteInput>({
    name: website.name,
    phpVersion: website.phpVersion,
    webServer: website.webServer,
    documentRoot: website.documentRoot,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: UpdateWebsiteInput = {};
    if (form.name && form.name !== website.name) changes.name = form.name;
    if (form.phpVersion && form.phpVersion !== website.phpVersion) changes.phpVersion = form.phpVersion;
    if (form.webServer && form.webServer !== website.webServer) changes.webServer = form.webServer;
    if (form.documentRoot && form.documentRoot !== website.documentRoot) changes.documentRoot = form.documentRoot;

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    updateWebsite.mutate(
      { id: website.id, ...changes },
      {
        onSuccess: () => {
          toast.success(`Website "${form.name || website.name}" updated`);
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to update website');
        },
      },
    );
  };

  return (
    <Modal open={true} onClose={onClose} title="Edit Website" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {updateWebsite.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error:</strong> {(updateWebsite.error as ApiError).message || String(updateWebsite.error)}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Website Name</label>
          <input
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Document Root</label>
          <input
            value={form.documentRoot || ''}
            onChange={(e) => setForm({ ...form, documentRoot: e.target.value })}
            className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
            disabled={updateWebsite.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateWebsite.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Attach Domain Modal ---
function AttachDomainModal({ websiteId, onClose }: { websiteId: string; onClose: () => void }) {
  const { data: allDomains } = useDomains();
  const attachDomain = useAttachDomain();
  const [selectedDomainId, setSelectedDomainId] = useState('');

  // Filter to domains not attached to any website
  const availableDomains = (allDomains as DomainWithWebsite[] | undefined)?.filter(
    (d) => !d.websiteId,
  ) || [];

  const handleAttach = () => {
    if (!selectedDomainId) return;
    attachDomain.mutate(
      { websiteId, domainId: selectedDomainId },
      {
        onSuccess: () => {
          toast.success('Domain attached successfully');
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to attach domain');
        },
      },
    );
  };

  return (
    <Modal open={true} onClose={onClose} title="Attach Domain" size="md">
      <div className="space-y-4 p-6">
        {attachDomain.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error:</strong> {(attachDomain.error as ApiError).message || String(attachDomain.error)}
          </div>
        )}

        {availableDomains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No unattached domains available. Create a new domain first.
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Select Domain</label>
              <select
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— Select a domain —</option>
                {availableDomains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleAttach}
            disabled={!selectedDomainId || attachDomain.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {attachDomain.isPending ? 'Attaching...' : 'Attach Domain'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Overview Tab ---
function OverviewTab({ website }: { website: Website }) {
  const infoItems = [
    { label: 'Name', value: website.name },
    { label: 'System User', value: website.systemUser, mono: true },
    { label: 'Document Root', value: website.documentRoot, mono: true },
    { label: 'PHP Version', value: website.phpVersion || '—' },
    { label: 'PHP Handler', value: website.phpHandler || '—' },
    { label: 'Web Server', value: website.webServer || '—' },
    { label: 'Status', value: <StatusBadge status={website.status} /> },
    {
      label: 'Disk Usage',
      value: website.diskUsedMb != null ? `${website.diskUsedMb} MB` : '—',
    },
    {
      label: 'Bandwidth',
      value: website.bandwidthUsedMb != null ? `${website.bandwidthUsedMb} MB` : '—',
    },
    {
      label: 'Created',
      value: website.createdAt ? new Date(website.createdAt).toLocaleDateString() : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {infoItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className={`mt-1 text-sm font-semibold ${item.mono ? 'font-mono' : ''}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Domains Tab ---
function DomainsTab({ website }: { website: Website }) {
  const { data: allDomains, isLoading } = useDomains();
  const detachDomain = useDetachDomain();
  const [showAttach, setShowAttach] = useState(false);
  const [detachTarget, setDetachTarget] = useState<DomainWithWebsite | null>(null);

  // Filter domains attached to this website
  const attachedDomains = (allDomains as DomainWithWebsite[] | undefined)?.filter(
    (d) => d.websiteId === website.id,
  ) || [];

  const handleDetach = () => {
    if (!detachTarget) return;
    detachDomain.mutate(
      { websiteId: website.id, domainId: detachTarget.id },
      {
        onSuccess: () => {
          setDetachTarget(null);
          toast.success(`Domain "${detachTarget.name}" detached`);
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to detach domain');
        },
      },
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {attachedDomains.length} domain{attachedDomains.length !== 1 ? 's' : ''} attached
        </h3>
        <button
          onClick={() => setShowAttach(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Attach Domain
        </button>
      </div>

      {attachedDomains.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No domains attached"
          description="Attach a domain to this website to serve content."
        />
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Domain</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attachedDomains.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{(d as any).type || 'primary'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === 'active' ? 'bg-green-500/10 text-green-500' :
                      d.status === 'suspended' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setDetachTarget(d)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Detach domain"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {/* Attach Domain Modal */}
      {showAttach && (
        <AttachDomainModal websiteId={website.id} onClose={() => setShowAttach(false)} />
      )}

      {/* Detach Confirmation */}
      {detachTarget && (
        <ConfirmDialog
          open={true}
          title="Detach Domain"
          message={`This will detach "${detachTarget.name}" from this website. The domain will remain in the system but won't serve this website's content.`}
          variant="warning"
          onConfirm={handleDetach}
          onCancel={() => setDetachTarget(null)}
        />
      )}
    </div>
  );
}

// --- Files Tab (Placeholder) ---
function FilesTab({ website }: { website: Website }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">File Manager</h3>
            <p className="text-sm text-muted-foreground">
              Manage files for this website
            </p>
          </div>
        </div>
        <div className="mt-4">
          <a
            href={`/files?websiteId=${website.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FolderOpen className="h-4 w-4" /> Open File Manager
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Document root: <code className="rounded bg-muted px-1.5 py-0.5">{website.documentRoot}</code>
        </p>
      </div>
    </div>
  );
}

// --- FTP Tab ---
function FtpTab({ websiteId }: { websiteId: string }) {
  const { data: ftpAccounts, isLoading, isError } = useWebsiteFtp(websiteId);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load FTP accounts.</p>;

  if (!ftpAccounts?.length) {
    return (
      <EmptyState
        icon={Users}
        title="No FTP accounts"
        description="No FTP accounts are configured for this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Username</th>
            <th className="px-4 py-2 text-left font-medium">Path</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {ftpAccounts.map((ftp) => (
            <tr key={ftp.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-sm font-medium">{ftp.username}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{ftp.path}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  ftp.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {ftp.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

// --- Cron Tab ---
function CronTab({ websiteId }: { websiteId: string }) {
  const { data: cronJobs, isLoading, isError } = useWebsiteCron(websiteId);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load cron jobs.</p>;

  if (!cronJobs?.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No cron jobs"
        description="No cron jobs are configured for this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Schedule</th>
            <th className="px-4 py-2 text-left font-medium">Command</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {cronJobs.map((job) => (
            <tr key={job.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{job.schedule}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground max-w-xs truncate">{job.command}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  job.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {job.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

// --- Databases Tab ---
function DatabasesTab({ websiteId }: { websiteId: string }) {
  const { data: databases, isLoading, isError } = useWebsiteDatabases(websiteId);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load databases.</p>;

  if (!databases?.length) {
    return (
      <EmptyState
        icon={Database}
        title="No databases"
        description="No databases are associated with this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-left font-medium">Size</th>
          </tr>
        </thead>
        <tbody>
          {databases.map((db) => (
            <tr key={db.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-sm font-medium">{db.name}</td>
              <td className="px-4 py-2 text-muted-foreground">{db.type}</td>
              <td className="px-4 py-2 text-muted-foreground">{db.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

// --- Backups Tab ---
function BackupsTab({ websiteId }: { websiteId: string }) {
  const { data: backups, isLoading, isError } = useWebsiteBackups(websiteId);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load backups.</p>;

  if (!backups?.length) {
    return (
      <EmptyState
        icon={Archive}
        title="No backups"
        description="No backups are available for this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-left font-medium">Size</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup) => (
            <tr key={backup.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{backup.name}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {backup.date ? new Date(backup.date).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{backup.size}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  backup.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                  backup.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {backup.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

// --- Apps Tab ---
function AppsTab({ websiteId }: { websiteId: string }) {
  const { data: apps, isLoading, isError } = useWebsiteApps(websiteId);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load apps.</p>;

  if (!apps?.length) {
    return (
      <EmptyState
        icon={AppWindow}
        title="No apps installed"
        description="No applications are installed on this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">App</th>
            <th className="px-4 py-2 text-left font-medium">Version</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{app.appName}</td>
              <td className="px-4 py-2 text-muted-foreground">{app.version}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  app.status === 'active' ? 'bg-green-500/10 text-green-500' :
                  app.status === 'installing' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {app.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

// --- Main Detail Page ---
export function WebsiteDetailPage({ websiteId }: { websiteId: string }) {
  const { data: website, isLoading, isError } = useWebsite(websiteId);
  const deleteWebsite = useDeleteWebsite();
  const suspendWebsite = useSuspendWebsite();
  const activateWebsite = useActivateWebsite();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showActivate, setShowActivate] = useState(false);

  if (isLoading) return <LoadingSpinner />;

  if (isError || !website) {
    return (
      <div>
        <PageHeader title="Website Not Found" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load website</h3>
          <p className="mt-1 text-sm text-muted-foreground">The website could not be found or an error occurred.</p>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    deleteWebsite.mutate(website.id, {
      onSuccess: () => {
        toast.success(`Website "${website.name}" deleted`);
        // Navigation back to list will be handled by router in Phase 8
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to delete website');
      },
    });
  };

  const handleSuspend = () => {
    suspendWebsite.mutate(website.id, {
      onSuccess: () => {
        setShowSuspend(false);
        toast.success(`Website "${website.name}" suspended`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to suspend website');
      },
    });
  };

  const handleActivate = () => {
    activateWebsite.mutate(website.id, {
      onSuccess: () => {
        setShowActivate(false);
        toast.success(`Website "${website.name}" activated`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to activate website');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Websites', href: '/websites' },
        { label: website.name },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{website.name}</h1>
            <StatusBadge status={website.status} />
          </div>
          <p className="mt-1 text-sm font-mono text-muted-foreground">{website.documentRoot}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          {website.status === 'active' ? (
            <button
              onClick={() => setShowSuspend(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Ban className="h-4 w-4" /> Suspend
            </button>
          ) : (
            <button
              onClick={() => setShowActivate(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <CheckCircle className="h-4 w-4" /> Activate
            </button>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab website={website} />}
      {activeTab === 'domains' && <DomainsTab website={website} />}
      {activeTab === 'files' && <FilesTab website={website} />}
      {activeTab === 'ftp' && <FtpTab websiteId={website.id} />}
      {activeTab === 'cron' && <CronTab websiteId={website.id} />}
      {activeTab === 'databases' && <DatabasesTab websiteId={website.id} />}
      {activeTab === 'backups' && <BackupsTab websiteId={website.id} />}
      {activeTab === 'apps' && <AppsTab websiteId={website.id} />}

      {/* Edit Modal */}
      {showEdit && (
        <EditWebsiteModal website={website} onClose={() => setShowEdit(false)} />
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <ConfirmDialog
          open={true}
          title="Delete Website"
          message={`This will permanently delete "${website.name}" and all associated configuration. This action cannot be undone.`}
          variant="danger"
          requireTyping={website.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {/* Suspend Confirmation */}
      {showSuspend && (
        <ConfirmDialog
          open={true}
          title="Suspend Website"
          message={`This will suspend "${website.name}". All associated domains will become unavailable.`}
          variant="warning"
          onConfirm={handleSuspend}
          onCancel={() => setShowSuspend(false)}
        />
      )}

      {/* Activate Confirmation */}
      {showActivate && (
        <ConfirmDialog
          open={true}
          title="Activate Website"
          message={`This will activate "${website.name}" and bring it back online.`}
          variant="info"
          onConfirm={handleActivate}
          onCancel={() => setShowActivate(false)}
        />
      )}
    </div>
  );
}
