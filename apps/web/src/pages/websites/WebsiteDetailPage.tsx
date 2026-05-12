import { useState, useEffect } from 'react';
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
import {
  useDomains, useSubdomains, useMakePrimaryDomain, useVerifyDomainDns,
  useCreateDomain, useCreateSubdomain, useDeleteDomain, useDeleteSubdomain,
  useSuspendDomain, useActivateDomain,
  type Domain, type Subdomain, type DomainDnsVerification,
} from '../../api/hooks/domains';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { DomainTypeBadge } from '../domains/components/DomainTypeBadge';
import { Link } from '@tanstack/react-router';
import {
  Server, Trash2, Ban, CheckCircle, Edit3, HardDrive,
  Globe, FolderOpen, Users, Clock, Database, Archive,
  AppWindow, Link2, Unlink, AlertTriangle, Plus, Activity,
  ExternalLink, ChevronRight, Star, Copy, MoreHorizontal,
  ChevronDown, X, RefreshCw, CheckCircle2, XCircle, Info,
  Shield, Lock, Terminal,
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

type TabId = 'overview' | 'domains' | 'subdomains' | 'files' | 'ftp' | 'cron' | 'databases' | 'backups' | 'apps';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Server },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'subdomains', label: 'Subdomains', icon: Globe },
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

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`/php?domain=${encodeURIComponent(website.name)}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Activity className="h-4 w-4" /> PHP Settings
        </a>
        <a
          href={`http://${website.name}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Globe className="h-4 w-4" /> Open Website
        </a>
        <a
          href={`/files?websiteId=${website.id}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          <FolderOpen className="h-4 w-4" />
          Open File Manager
        </a>
        <a
          href={`/terminal?websiteId=${website.id}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          <Terminal className="h-4 w-4" />
          Open Terminal
        </a>
      </div>
    </div>
  );
}

// --- Domain Status Badge ---
function DomainStatusBadge({ status }: { status: Domain['status'] }) {
  const styles = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-orange-500/10 text-orange-500',
    pending: 'bg-yellow-500/10 text-yellow-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

// --- SSL Badge ---
function SslBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3 w-3" /> No SSL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
      <Shield className="h-3 w-3" /> SSL
    </span>
  );
}

// --- Copy Button ---
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// --- Domain Card Component ---
function DomainCard({
  domain,
  website,
  onMakePrimary,
  onSuspend,
  onActivate,
  onDelete,
  subdomains = [],
}: {
  domain: Domain;
  website: Website;
  onMakePrimary?: () => void;
  onSuspend?: () => void;
  onActivate?: () => void;
  onDelete?: () => void;
  subdomains?: Domain[];
}) {
  const [showSubdomains, setShowSubdomains] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header Row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h4 className="font-medium">{domain.name}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {domain.isPrimary && (
                <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> Primary
                </span>
              )}
              <DomainTypeBadge type={domain.type} />
              <SslBadge enabled={domain.sslEnabled} />
              <DomainStatusBadge status={domain.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
                  {onMakePrimary && (
                    <button
                      onClick={() => { onMakePrimary(); setDropdownOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Star className="h-4 w-4" /> Make Primary
                    </button>
                  )}
                  <button
                    onClick={() => { onSuspend?.(); setDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Ban className="h-4 w-4" /> Suspend
                  </button>
                  <button
                    onClick={() => { onActivate?.(); setDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <CheckCircle className="h-4 w-4" /> Activate
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => { onDelete?.(); setDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 space-y-2">
        {/* Document Root */}
        {domain.documentRoot && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Document Root:</span>
            <code className="flex-1 rounded bg-muted px-2 py-0.5 text-xs font-mono">{domain.documentRoot}</code>
            <CopyButton text={domain.documentRoot} />
          </div>
        )}

        {/* PHP Version */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">PHP:</span>
          <span className="text-sm">
            {domain.phpVersion || '—'}
            {!domain.phpVersion && <span className="text-xs text-muted-foreground"> (inherited)</span>}
          </span>
        </div>

        {/* Parked Domains under this primary */}
        {domain.isPrimary && subdomains.length > 0 && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Parked:</span>
              <span className="text-sm">{subdomains.map(d => d.name).join(', ')}</span>
            </div>
          </div>
        )}

        {/* Subdomains toggle */}
        {domain.isPrimary && subdomains.length > 0 && (
          <button
            onClick={() => setShowSubdomains(!showSubdomains)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showSubdomains ? 'rotate-180' : ''}`} />
            {subdomains.length} subdomain{subdomains.length !== 1 ? 's' : ''}
          </button>
        )}

        {showSubdomains && subdomains.length > 0 && (
          <div className="ml-4 space-y-1">
            {subdomains.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{sub.name}</span>
                <DomainStatusBadge status={sub.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Add Domain Dropdown Menu ---
function AddDomainDropdown({
  onAddPrimary,
  onAddAddon,
  onAddParked,
  onAddSubdomain,
}: {
  onAddPrimary: () => void;
  onAddAddon: () => void;
  onAddParked: () => void;
  onAddSubdomain: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" /> Add Domain <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
            <button
              onClick={() => { onAddPrimary(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
            >
              <Globe className="h-4 w-4" /> Primary Domain
            </button>
            <button
              onClick={() => { onAddAddon(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Addon Domain
            </button>
            <button
              onClick={() => { onAddParked(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
            >
              <Link2 className="h-4 w-4" /> Parked Domain
            </button>
            <button
              onClick={() => { onAddSubdomain(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
            >
              <Globe className="h-4 w-4" /> Subdomain
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Add Primary/Addon Domain Modal ---
function AddPrimaryOrAddonModal({
  website,
  mode,
  onClose,
}: {
  website: Website;
  mode: 'primary' | 'addon';
  onClose: () => void;
}) {
  const { data: phpData, isLoading: phpLoading } = usePhpVersions();
  const phpVersions = (phpData?.versions?.length
    ? phpData.versions.map((v: any) => typeof v === 'string' ? v : v.version)
    : DEFAULT_PHP_VERSIONS);
  const createDomain = useCreateDomain();
  const verifyDns = useVerifyDomainDns();

  const [form, setForm] = useState({
    name: '',
    documentRoot: '',
    phpVersion: '',
    phpHandler: 'php-fpm',
    webServer: 'nginx+apache',
    createDnsZone: true,
    skipDnsVerification: false,
  });

  const [dnsVerification, setDnsVerification] = useState<DomainDnsVerification | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const autoDocRoot = form.name ? `/var/www/vhosts/${form.name}/httpdocs` : '';

  const handleDomainBlur = async () => {
    if (form.name && !form.skipDnsVerification) {
      try {
        const result = await verifyDns.mutateAsync(form.name);
        setDnsVerification(result);
      } catch (err) {
        console.error('DNS verification failed:', err);
      }
    }
  };

  const handleSubmit = () => {
    createDomain.mutate(
      {
        name: form.name,
        documentRoot: form.documentRoot || undefined,
        phpVersion: form.phpVersion || undefined,
        phpHandler: form.phpHandler,
        webServer: form.webServer,
        createDnsZone: form.createDnsZone,
        skipDnsVerification: form.skipDnsVerification,
        websiteId: website.id,
        type: mode,
        websiteMode: 'existing',
      },
      {
        onSuccess: () => {
          toast.success(`${mode === 'primary' ? 'Primary' : 'Addon'} domain added`);
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to add domain');
        },
      },
    );
  };

  const isDnsReady = form.skipDnsVerification || (dnsVerification && dnsVerification.pointsToServer);

  return (
    <Modal open={true} onClose={onClose} title={mode === 'primary' ? 'Add Primary Domain' : 'Add Addon Domain'} size="lg">
      <div className="space-y-4 p-6">
        {createDomain.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error:</strong> {(createDomain.error as ApiError).message || String(createDomain.error)}
          </div>
        )}

        {/* Domain Name */}
        <div>
          <label className="mb-1 block text-sm font-medium">Domain Name</label>
          <div className="flex gap-2">
            <input
              placeholder="example.com"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setDnsVerification(null);
              }}
              onBlur={handleDomainBlur}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              type="button"
              onClick={handleDomainBlur}
              disabled={!form.name || verifyDns.isPending}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {verifyDns.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* DNS Verification Status */}
        {dnsVerification && (
          <div className={`rounded-lg border p-4 ${dnsVerification.pointsToServer
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            }`}>
            <div className="flex items-start gap-3">
              {dnsVerification.pointsToServer ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-medium ${dnsVerification.pointsToServer ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {dnsVerification.pointsToServer ? 'DNS Verified' : 'DNS Not Pointing to Server'}
                </h4>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p><strong>Domain:</strong> {dnsVerification.domain}</p>
                  <p><strong>Server IP:</strong> {dnsVerification.serverIp}</p>
                  {dnsVerification.resolvesTo.length > 0 ? (
                    <p><strong>Resolves to:</strong> {dnsVerification.resolvesTo.join(', ')}</p>
                  ) : (
                    <p className="text-red-600 dark:text-red-400">{dnsVerification.error || 'Could not resolve domain'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Skip DNS Verification */}
        {dnsVerification && !dnsVerification.pointsToServer && (
          <label className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50/50 p-3 cursor-pointer hover:bg-orange-100/50 dark:border-orange-800 dark:bg-orange-900/20 dark:hover:bg-orange-900/30">
            <input
              type="checkbox"
              checked={form.skipDnsVerification}
              onChange={(e) => setForm({ ...form, skipDnsVerification: e.target.checked })}
              className="h-4 w-4 rounded border-input text-primary"
            />
            <div>
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Skip DNS verification</span>
              <p className="text-xs text-muted-foreground">
                Only check this if you haven't configured DNS yet and want to proceed anyway.
              </p>
            </div>
          </label>
        )}

        {/* Document Root */}
        <div>
          <label className="mb-1 block text-sm font-medium">Document Root</label>
          <input
            placeholder={autoDocRoot || '/var/www/vhosts/{domain}/httpdocs'}
            value={form.documentRoot}
            onChange={(e) => setForm({ ...form, documentRoot: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty for default: {autoDocRoot || '...'}</p>
        </div>

        {/* PHP Version */}
        <div>
          <label className="mb-1 block text-sm font-medium">PHP Version</label>
          <select
            value={form.phpVersion}
            onChange={(e) => setForm({ ...form, phpVersion: e.target.value })}
            disabled={phpLoading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Inherit from website: {website.phpVersion || 'default'}</option>
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

        {/* PHP Handler */}
        <div>
          <label className="mb-1 block text-sm font-medium">PHP Handler</label>
          <select
            value={form.phpHandler}
            onChange={(e) => setForm({ ...form, phpHandler: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="php-fpm">PHP-FPM</option>
            <option value="cgi">CGI</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {/* Web Server */}
        <div>
          <label className="mb-1 block text-sm font-medium">Web Server</label>
          <select
            value={form.webServer}
            onChange={(e) => setForm({ ...form, webServer: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="nginx">Nginx</option>
            <option value="apache">Apache</option>
            <option value="nginx+apache">Nginx + Apache</option>
          </select>
        </div>

        {/* Create DNS Zone */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.createDnsZone}
            onChange={(e) => setForm({ ...form, createDnsZone: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm">Create DNS zone</span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name || createDomain.isPending || !isDnsReady}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createDomain.isPending ? 'Adding...' : 'Add Domain'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Add Parked Domain Modal ---
function AddParkedDomainModal({
  website,
  primaryDomain,
  onClose,
}: {
  website: Website;
  primaryDomain: Domain;
  onClose: () => void;
}) {
  const createDomain = useCreateDomain();
  const [form, setForm] = useState({ name: '' });

  const handleSubmit = () => {
    if (!form.name) return;
    createDomain.mutate(
      {
        name: form.name,
        websiteId: website.id,
        type: 'parked',
        parentDomainId: primaryDomain.id,
        websiteMode: 'existing',
        skipDnsVerification: true,
      },
      {
        onSuccess: () => {
          toast.success('Parked domain added');
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to add parked domain');
        },
      },
    );
  };

  return (
    <Modal open={true} onClose={onClose} title="Add Parked Domain" size="md">
      <div className="space-y-4 p-6">
        {createDomain.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error:</strong> {(createDomain.error as ApiError).message || String(createDomain.error)}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Domain Name</label>
          <input
            placeholder="parkeddomain.com"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              This domain will mirror <strong>{primaryDomain.name}</strong>'s content and share its SSL certificate.
            </p>
          </div>
        </div>

        {!primaryDomain.sslEnabled && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Enable SSL on <strong>{primaryDomain.name}</strong> first to cover parked domains.
              </p>
            </div>
          </div>
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
            onClick={handleSubmit}
            disabled={!form.name || createDomain.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createDomain.isPending ? 'Adding...' : 'Add Parked Domain'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Add Subdomain Modal ---
function AddSubdomainModal({
  website,
  parentDomain,
  onClose,
}: {
  website: Website;
  parentDomain: Domain;
  onClose: () => void;
}) {
  const createSubdomain = useCreateSubdomain(parentDomain.id);
  const [form, setForm] = useState({
    name: '',
    documentRoot: '',
    phpVersion: '',
    createDns: true,
  });

  const [error, setError] = useState<string | null>(null);

  const fqdn = form.name ? `${form.name}.${parentDomain.name}` : '';
  const autoDocRoot = form.name ? `/var/www/vhosts/${parentDomain.name}/subdomains/${form.name}` : '';

  const handleSubmit = () => {
    if (!form.name) return;

    // Basic validation
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$/.test(form.name)) {
      setError('Subdomain must start and end with alphanumeric characters');
      return;
    }

    createSubdomain.mutate(
      {
        name: form.name,
        documentRoot: form.documentRoot || undefined,
        phpVersion: form.phpVersion || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Subdomain ${fqdn} created`);
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to create subdomain');
        },
      },
    );
  };

  return (
    <Modal open={true} onClose={onClose} title="Add Subdomain" size="md">
      <div className="space-y-4 p-6">
        {createSubdomain.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error:</strong> {(createSubdomain.error as ApiError).message || String(createSubdomain.error)}
          </div>
        )}

        {/* Subdomain Prefix */}
        <div>
          <label className="mb-1 block text-sm font-medium">Subdomain Prefix</label>
          <input
            placeholder="api"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setError(null);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
          {form.name && !error && (
            <p className="mt-1 text-xs text-muted-foreground">
              Will create: <span className="font-mono">{fqdn}</span>
            </p>
          )}
        </div>

        {/* Parent Domain (shown if multiple domains) */}
        <div>
          <label className="mb-1 block text-sm font-medium">Parent Domain</label>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            {parentDomain.name}
          </div>
        </div>

        {/* Document Root */}
        <div>
          <label className="mb-1 block text-sm font-medium">Document Root</label>
          <input
            placeholder={autoDocRoot || '/var/www/vhosts/{domain}/subdomains/{prefix}'}
            value={form.documentRoot}
            onChange={(e) => setForm({ ...form, documentRoot: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty for default: {autoDocRoot || '...'}</p>
        </div>

        {/* PHP Version */}
        <div>
          <label className="mb-1 block text-sm font-medium">PHP Version</label>
          <select
            value={form.phpVersion}
            onChange={(e) => setForm({ ...form, phpVersion: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Inherit from website: {website.phpVersion || 'default'}</option>
            <option value="8.1">PHP 8.1</option>
            <option value="8.2">PHP 8.2</option>
            <option value="8.3">PHP 8.3</option>
          </select>
        </div>

        {/* Create DNS A Record */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.createDns}
            onChange={(e) => setForm({ ...form, createDns: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm">Create DNS A record</span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name || !!error || createSubdomain.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createSubdomain.isPending ? 'Creating...' : 'Add Subdomain'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Make Primary Confirm Dialog ---
function MakePrimaryConfirmDialog({
  domain,
  currentPrimary,
  parkedCount,
  onConfirm,
  onCancel,
}: {
  domain: Domain;
  currentPrimary: Domain;
  parkedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={true}
      title="Make Primary"
      message={
        <div className="space-y-3">
          <p>
            <strong>{domain.name}</strong> will become primary. <strong>{currentPrimary.name}</strong> will be demoted to addon.
          </p>
          {parkedCount > 0 && (
            <p className="text-yellow-600 dark:text-yellow-400">
              Parked domains will need their SSL certificate to be reissued.
            </p>
          )}
        </div>
      }
      variant="warning"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

// --- Delete Domain Confirm Dialog ---
function DeleteDomainConfirmDialog({
  domain,
  subdomainCount,
  onConfirm,
  onCancel,
  isLoading,
}: {
  domain: Domain;
  subdomainCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [typed, setTyped] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-destructive">Delete Domain</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Deleting <strong>{domain.name}</strong> will also delete:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {subdomainCount > 0 && <li>{subdomainCount} subdomain{subdomainCount !== 1 ? 's' : ''}</li>}
          <li>DNS records</li>
        </ul>
        <p className="mt-3 text-sm font-medium">
          Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{domain.name}</code> to confirm:
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={domain.name}
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={typed !== domain.name || isLoading}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : 'Delete Domain'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Domains Tab ---
function DomainsTab({ website }: { website: Website }) {
  const { data: allDomains, isLoading } = useDomains();
  const makePrimary = useMakePrimaryDomain();
  const suspendDomain = useSuspendDomain();
  const activateDomain = useActivateDomain();
  const deleteDomain = useDeleteDomain();

  // Modal states
  const [addMode, setAddMode] = useState<'primary' | 'addon' | 'parked' | 'subdomain' | null>(null);
  const [makePrimaryTarget, setMakePrimaryTarget] = useState<Domain | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const [selectedParkedParent, setSelectedParkedParent] = useState<Domain | null>(null);
  const [selectedSubdomainParent, setSelectedSubdomainParent] = useState<Domain | null>(null);

  // Filter domains attached to this website
  const attachedDomains = (allDomains as DomainWithWebsite[] | undefined)?.filter(
    (d) => d.websiteId === website.id,
  ) || [];

  // Group domains by type
  const primaryDomain = attachedDomains.find((d) => d.isPrimary);
  const addonDomains = attachedDomains.filter((d) => !d.isPrimary && d.type === 'addon');
  const parkedDomains = attachedDomains.filter((d) => d.type === 'parked');
  const subdomains = attachedDomains.filter((d) => d.type === 'subdomain');

  if (isLoading) return <LoadingSpinner />;

  const handleMakePrimary = () => {
    if (!makePrimaryTarget) return;
    makePrimary.mutate(makePrimaryTarget.id, {
      onSuccess: () => {
        setMakePrimaryTarget(null);
        toast.success(`${makePrimaryTarget.name} set as primary`);
      },
      onError: (e: Error) => toast.error(e.message || 'Failed to set as primary'),
    });
  };

  const handleSuspend = (domain: Domain) => {
    suspendDomain.mutate(domain.id, {
      onSuccess: () => toast.success(`${domain.name} suspended`),
      onError: (e: Error) => toast.error(e.message || 'Failed to suspend domain'),
    });
  };

  const handleActivate = (domain: Domain) => {
    activateDomain.mutate(domain.id, {
      onSuccess: () => toast.success(`${domain.name} activated`),
      onError: (e: Error) => toast.error(e.message || 'Failed to activate domain'),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteDomain.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(`Domain "${deleteTarget.name}" deleted`);
      },
      onError: (e: Error) => toast.error(e.message || 'Failed to delete domain'),
    });
  };

  // Empty state - no domains
  if (attachedDomains.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Globe}
          title="No domains attached"
          description="Attach a domain to this website to serve content."
        />
        <div>
          <AddDomainDropdown
            onAddPrimary={() => setAddMode('primary')}
            onAddAddon={() => setAddMode('addon')}
            onAddParked={() => setAddMode('parked')}
            onAddSubdomain={() => setAddMode('subdomain')}
          />
        </div>

        {/* Add Primary/Addon Modal */}
        {addMode === 'primary' && (
          <AddPrimaryOrAddonModal website={website} mode="primary" onClose={() => setAddMode(null)} />
        )}
        {addMode === 'addon' && (
          <AddPrimaryOrAddonModal website={website} mode="addon" onClose={() => setAddMode(null)} />
        )}
        {addMode === 'parked' && primaryDomain && (
          <AddParkedDomainModal
            website={website}
            primaryDomain={primaryDomain}
            onClose={() => setAddMode(null)}
          />
        )}
        {addMode === 'subdomain' && primaryDomain && (
          <AddSubdomainModal
            website={website}
            parentDomain={primaryDomain}
            onClose={() => setAddMode(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary Domain Section */}
      {primaryDomain && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            PRIMARY DOMAIN
          </h3>
          <DomainCard
            domain={primaryDomain}
            website={website}
            subdomains={subdomains.filter(s => s.parentDomainId === primaryDomain.id)}
            onSuspend={() => handleSuspend(primaryDomain)}
            onActivate={() => handleActivate(primaryDomain)}
            onDelete={() => setDeleteTarget(primaryDomain)}
          />
        </div>
      )}

      {/* Addon Domains Section */}
      {addonDomains.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ADDON DOMAINS
            </h3>
            <button
              onClick={() => setAddMode('addon')}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add Addon Domain
            </button>
          </div>
          <div className="space-y-3">
            {addonDomains.map((domain) => (
              <DomainCard
                key={domain.id}
                domain={domain}
                website={website}
                onMakePrimary={() => setMakePrimaryTarget(domain)}
                onSuspend={() => handleSuspend(domain)}
                onActivate={() => handleActivate(domain)}
                onDelete={() => setDeleteTarget(domain)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Parked Domains Section */}
      {parkedDomains.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              PARKED DOMAINS
            </h3>
            <button
              onClick={() => setAddMode('parked')}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add Parked Domain
            </button>
          </div>
          <div className="space-y-2">
            {parkedDomains.map((domain) => {
              const parent = allDomains?.find(d => d.id === domain.parentDomainId);
              return (
                <div key={domain.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{domain.name}</span>
                    <span className="text-xs text-muted-foreground">→ mirrors {parent?.name || 'primary'}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" /> shared
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDeleteTarget(domain)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subdomains Section (show if any subdomains exist) */}
      {subdomains.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SUBDOMAINS
            </h3>
            <button
              onClick={() => setAddMode('subdomain')}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add Subdomain
            </button>
          </div>
          <div className="space-y-2">
            {subdomains.map((domain) => {
              const parent = allDomains?.find(d => d.id === domain.parentDomainId);
              return (
                <div key={domain.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{domain.name}</span>
                    <span className="text-xs text-muted-foreground">under: {parent?.name || '—'}</span>
                    {domain.phpVersion && (
                      <span className="text-xs text-muted-foreground">PHP {domain.phpVersion}</span>
                    )}
                    <DomainStatusBadge status={domain.status} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSuspend(domain)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(domain)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Domain Dropdown */}
      <div className="flex justify-end">
        <AddDomainDropdown
          onAddPrimary={() => setAddMode('primary')}
          onAddAddon={() => setAddMode('addon')}
          onAddParked={() => setAddMode('parked')}
          onAddSubdomain={() => setAddMode('subdomain')}
        />
      </div>

      {/* Add Primary/Addon Modal */}
      {addMode === 'primary' && (
        <AddPrimaryOrAddonModal website={website} mode="primary" onClose={() => setAddMode(null)} />
      )}
      {addMode === 'addon' && (
        <AddPrimaryOrAddonModal website={website} mode="addon" onClose={() => setAddMode(null)} />
      )}
      {addMode === 'parked' && primaryDomain && (
        <AddParkedDomainModal
          website={website}
          primaryDomain={primaryDomain}
          onClose={() => setAddMode(null)}
        />
      )}
      {addMode === 'subdomain' && primaryDomain && (
        <AddSubdomainModal
          website={website}
          parentDomain={primaryDomain}
          onClose={() => setAddMode(null)}
        />
      )}

      {/* Make Primary Confirm Dialog */}
      {makePrimaryTarget && primaryDomain && (
        <MakePrimaryConfirmDialog
          domain={makePrimaryTarget}
          currentPrimary={primaryDomain}
          parkedCount={parkedDomains.length}
          onConfirm={handleMakePrimary}
          onCancel={() => setMakePrimaryTarget(null)}
        />
      )}

      {/* Delete Domain Confirm Dialog */}
      {deleteTarget && (
        <DeleteDomainConfirmDialog
          domain={deleteTarget}
          subdomainCount={subdomains.filter(s => s.parentDomainId === deleteTarget.id).length}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteDomain.isPending}
        />
      )}
    </div>
  );
}

// --- Subdomains Tab ---
interface SubdomainWithDomain extends Subdomain {
  domainName: string;
  domainId: string;
}

function SubdomainsTab({ website }: { website: Website }) {
  const { data: allDomains } = useDomains();

  // Filter domains attached to this website
  const attachedDomains = (allDomains as DomainWithWebsite[] | undefined)?.filter(
    (d) => d.websiteId === website.id,
  ) || [];

  // Fetch subdomains for each attached domain
  const subdomainDataMap = useSubdomainsForDomains(attachedDomains.map(d => d.id));

  // Flatten and combine subdomains with their domain info
  const allSubdomains: SubdomainWithDomain[] = [];
  attachedDomains.forEach((domain) => {
    const subdomains = subdomainDataMap[domain.id];
    if (subdomains?.length) {
      subdomains.forEach((sub) => {
        allSubdomains.push({
          ...sub,
          domainName: domain.name,
          domainId: domain.id,
        });
      });
    }
  });

  if (!allDomains) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {allSubdomains.length} subdomain{allSubdomains.length !== 1 ? 's' : ''} across {attachedDomains.length} domain{attachedDomains.length !== 1 ? 's' : ''}
        </h3>
      </div>

      {allSubdomains.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No subdomains"
          description="No subdomains have been created for the domains attached to this website."
        />
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Subdomain</th>
                <th className="px-4 py-2 text-left font-medium">Parent Domain</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Document Root</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allSubdomains.map((sub) => (
                <tr key={sub.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{sub.name}.{sub.domainName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{sub.domainName}</td>
                  <td className="px-4 py-2">
                    <DomainTypeBadge type="subdomain" />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{sub.documentRoot}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to="/domains"
                      search={(prev) => ({ ...prev, selectedDomainId: sub.domainId })}
                      className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      title="Manage in Domain Detail"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </div>
  );
}

// Helper hook to fetch subdomains for multiple domains
function useSubdomainsForDomains(domainIds: string[]) {
  const [subdomainMap, setSubdomainMap] = useState<Record<string, Subdomain[]>>({});

  useEffect(() => {
    if (domainIds.length === 0) {
      setSubdomainMap({});
      return;
    }

    // Fetch subdomains for each domain
    const fetchPromises = domainIds.map(async (domainId) => {
      try {
        const response = await fetch(`/api/v1/domains/${domainId}/subdomains`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('apiToken')}` },
        });
        const data = await response.json();
        return { domainId, subdomains: data.success ? data.data : [] };
      } catch {
        return { domainId, subdomains: [] };
      }
    });

    Promise.all(fetchPromises).then((results) => {
      const map: Record<string, Subdomain[]> = {};
      results.forEach(({ domainId, subdomains }) => {
        map[domainId] = subdomains;
      });
      setSubdomainMap(map);
    });
  }, [domainIds.join(',')]);

  return subdomainMap;
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

  // Initialize activeTab from URL hash, default to 'overview'
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.slice(1);
    const validTabs: TabId[] = ['overview', 'domains', 'subdomains', 'files', 'ftp', 'cron', 'databases', 'backups', 'apps'];
    return validTabs.includes(hash as TabId) ? hash as TabId : 'overview';
  });

  // Listen for hash changes to sync active tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validTabs: TabId[] = ['overview', 'domains', 'subdomains', 'files', 'ftp', 'cron', 'databases', 'backups', 'apps'];
      if (validTabs.includes(hash as TabId)) {
        setActiveTab(hash as TabId);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
              onClick={() => { setActiveTab(tab.id); window.location.hash = tab.id; }}
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
      {activeTab === 'subdomains' && <SubdomainsTab website={website} />}
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
