import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useDomains,
  useCreateDomain,
  useDeleteDomain,
  useUpdateDomain,
  useSuspendDomain,
  useActivateDomain,
  useSubdomains,
  useAliases,
  useRedirects,
  useCreateSubdomain,
  useCreateAlias,
  useCreateRedirect,
  useDeleteSubdomain,
  useDeleteAlias,
  useDeleteRedirect,
  useBulkSuspendDomains,
  useBulkActivateDomains,
  useBulkDeleteDomains,
  useDomainLogStats,
} from '../../api/hooks/domains';
import type { CreateDomainInput } from '../../api/hooks/domains';
import { useWebsites, useAttachDomain } from '../../api/hooks/websites';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import {
  Globe, Plus, Trash2, Ban, CheckCircle, X, FolderOpen, ExternalLink,
  Search, Shield, Server, ChevronRight, ArrowLeft, Link2, ArrowRightLeft,
  Edit3, Activity, AlertTriangle, Unplug, Mail, FileText,
} from 'lucide-react';
import type { ApiError } from '../../api/client';
import type { Domain } from '../../api/hooks/domains';
import { toast } from '../../lib/toast';

const PHP_HANDLERS = [
  { value: 'php-fpm', label: 'PHP-FPM' },
  { value: 'cgi', label: 'CGI' },
  { value: 'disabled', label: 'Disabled' },
];
const WEBSERVER_TYPES = [
  { value: 'nginx', label: 'Nginx Only' },
  { value: 'apache', label: 'Apache Only' },
  { value: 'nginx+apache', label: 'Nginx + Apache' },
];

// --- Link Website Modal ---
function LinkWebsiteModal({ domainId, onClose }: { domainId: string; onClose: () => void }) {
  const { data: websites, isLoading } = useWebsites();
  const attachDomain = useAttachDomain();
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('');

  const handleSubmit = () => {
    if (!selectedWebsiteId) return;
    attachDomain.mutate(
      { websiteId: selectedWebsiteId, domainId },
      {
        onSuccess: () => {
          toast.success('Domain linked to website successfully');
          onClose();
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to link domain'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Link to Website</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Select an existing website to link this domain to. The domain will serve content from the selected website.
        </p>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <select
            value={selectedWebsiteId}
            onChange={(e) => setSelectedWebsiteId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">— Select a website —</option>
            {websites?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        )}
        {attachDomain.error && (
          <p className="mt-2 text-sm text-destructive">{(attachDomain.error as ApiError).message || String(attachDomain.error)}</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!selectedWebsiteId || attachDomain.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {attachDomain.isPending ? 'Linking...' : 'Link Website'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Create Domain Form ---
function CreateDomainForm({ onSubmit, onCancel, isLoading, error }: {
  onSubmit: (data: CreateDomainInput) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: ApiError | null;
}) {
  const { data: phpData, isLoading: phpLoading } = usePhpVersions();
  const phpVersions = (phpData?.versions?.length ? phpData.versions : DEFAULT_PHP_VERSIONS);
  const [form, setForm] = useState({
    name: '',
    documentRoot: '',
    phpVersion: phpVersions[0] || '8.1',
    phpHandler: 'php-fpm',
    webServer: 'nginx+apache',
    createDns: true,
    createMail: true,
    websiteMode: 'create' as 'none' | 'create' | 'existing',
    websiteId: '',
  });

  const { data: websites } = useWebsites();

  const autoDocRoot = form.name ? `/var/www/vhosts/${form.name}/httpdocs` : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateDomainInput = {
      name: form.name,
      documentRoot: form.documentRoot || undefined,
      phpVersion: form.phpVersion,
      phpHandler: form.phpHandler,
      webServer: form.webServer,
      createDns: form.createDns,
      createMail: form.createMail,
      websiteMode: form.websiteMode,
      websiteId: form.websiteMode === 'existing' ? form.websiteId : undefined,
    };
    onSubmit(payload);
  };

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Create New Domain</h3>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Domain Name</label>
          <input
            placeholder="example.com"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoFocus
          />
        </div>

        {/* Website Mode Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium">Website Configuration</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50">
              <input
                type="radio"
                name="websiteMode"
                value="create"
                checked={form.websiteMode === 'create'}
                onChange={() => setForm({ ...form, websiteMode: 'create' })}
                className="h-4 w-4 border-input text-primary"
              />
              <div>
                <span className="text-sm font-medium">Create new website</span>
                <p className="text-xs text-muted-foreground">Automatically create a website and link this domain to it</p>
              </div>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50">
              <input
                type="radio"
                name="websiteMode"
                value="existing"
                checked={form.websiteMode === 'existing'}
                onChange={() => setForm({ ...form, websiteMode: 'existing' })}
                className="h-4 w-4 border-input text-primary"
              />
              <div>
                <span className="text-sm font-medium">Link to existing website</span>
                <p className="text-xs text-muted-foreground">Attach this domain to an already existing website</p>
              </div>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50">
              <input
                type="radio"
                name="websiteMode"
                value="none"
                checked={form.websiteMode === 'none'}
                onChange={() => setForm({ ...form, websiteMode: 'none' })}
                className="h-4 w-4 border-input text-primary"
              />
              <div>
                <span className="text-sm font-medium">No website (DNS only)</span>
                <p className="text-xs text-muted-foreground">Create the domain for DNS/mail only, without a website</p>
              </div>
            </label>
          </div>
        </div>

        {/* Website selector when linking to existing */}
        {form.websiteMode === 'existing' && (
          <div>
            <label className="mb-1 block text-sm font-medium">Select Website</label>
            <select
              value={form.websiteId}
              onChange={(e) => setForm({ ...form, websiteId: e.target.value })}
              className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            >
              <option value="">— Select a website —</option>
              {websites?.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Document root & web settings — only shown when creating a website */}
        {form.websiteMode === 'create' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Document Root</label>
              <input
                placeholder={autoDocRoot || '/var/www/vhosts/{domain}/httpdocs'}
                value={form.documentRoot}
                onChange={(e) => setForm({ ...form, documentRoot: e.target.value })}
                className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave empty for default: {autoDocRoot || '...'}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">PHP Version</label>
                <select
                  value={form.phpVersion}
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
                <label className="mb-1 block text-sm font-medium">PHP Handler</label>
                <select
                  value={form.phpHandler}
                  onChange={(e) => setForm({ ...form, phpHandler: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {PHP_HANDLERS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Web Server</label>
                <select
                  value={form.webServer}
                  onChange={(e) => setForm({ ...form, webServer: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {WEBSERVER_TYPES.map((ws) => (
                    <option key={ws.value} value={ws.value}>{ws.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.createDns}
              onChange={(e) => setForm({ ...form, createDns: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">Create DNS zone</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.createMail}
              onChange={(e) => setForm({ ...form, createMail: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">Enable mail domain</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!form.name || isLoading || (form.websiteMode === 'existing' && !form.websiteId)}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Domain'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Delete Confirmation ---
function DeleteConfirm({ domainName, onConfirm, onCancel, isLoading }: {
  domainName: string; onConfirm: () => void; onCancel: () => void; isLoading: boolean;
}) {
  const [typed, setTyped] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-destructive">Delete Domain</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently delete <strong>{domainName}</strong> and all associated DNS records, SSL certificates, and mail configuration.
        </p>
        <p className="mt-3 text-sm font-medium">
          Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{domainName}</code> to confirm:
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={domainName}
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={typed !== domainName || isLoading}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : 'Delete Domain'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Rename Domain Modal ---
function RenameDomainModal({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const updateDomain = useUpdateDomain();
  const [newName, setNewName] = useState(domain.name);

  const handleSubmit = () => {
    if (!newName.trim() || newName === domain.name) return;
    updateDomain.mutate({ id: domain.id, name: newName.trim() }, {
      onSuccess: () => { toast.success(`Domain renamed to ${newName.trim()}`); onClose(); },
      onError: (e: Error) => toast.error(e.message || 'Failed to rename domain'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Rename Domain</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Current Name</label>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-mono">{domain.name}</div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="new-domain.com"
              autoFocus
            />
          </div>
          {updateDomain.error && (
            <p className="text-sm text-destructive">{(updateDomain.error as ApiError).message || String(updateDomain.error)}</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={updateDomain.isPending || !newName.trim() || newName === domain.name}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateDomain.isPending ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Bulk Action Bar ---
function BulkActionBar({ selectedIds, onClear, onSuspend, onActivate, onDelete, isLoading }: {
  selectedIds: string[];
  onClear: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
  isLoading: boolean;
}) {
  if (selectedIds.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <div className="h-4 w-px bg-border" />
      <button
        onClick={onSuspend}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        <Ban className="h-3.5 w-3.5" /> Suspend
      </button>
      <button
        onClick={onActivate}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        <CheckCircle className="h-3.5 w-3.5" /> Activate
      </button>
      <button
        onClick={onDelete}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
      <div className="h-4 w-px bg-border" />
      <button onClick={onClear} className="rounded p-1 text-muted-foreground hover:bg-accent">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// --- Domain Detail Panel ---
function DomainDetail({ domain, onBack }: { domain: Domain; onBack: () => void }) {
  const { data: subdomains } = useSubdomains(domain.id);
  const { data: aliases } = useAliases(domain.id);
  const { data: redirects } = useRedirects(domain.id);
  const { data: logStats } = useDomainLogStats(domain.id);
  const { data: websites } = useWebsites();
  const createSubdomain = useCreateSubdomain(domain.id);
  const createAlias = useCreateAlias(domain.id);
  const createRedirect = useCreateRedirect(domain.id);
  const deleteSubdomain = useDeleteSubdomain(domain.id);
  const deleteAlias = useDeleteAlias(domain.id);
  const deleteRedirect = useDeleteRedirect(domain.id);

  const [tab, setTab] = useState<'overview' | 'subdomains' | 'aliases' | 'redirects'>('overview');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newRedirectSource, setNewRedirectSource] = useState('');
  const [newRedirectTarget, setNewRedirectTarget] = useState('');
  const [newRedirectType, setNewRedirectType] = useState<'301' | '302'>('301');
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Find linked website name
  const linkedWebsite = domain.websiteId
    ? websites?.find((w) => w.id === domain.websiteId)
    : null;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to domains
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{domain.name}</h2>
          <p className="text-sm text-muted-foreground">{domain.documentRoot}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            domain.status === 'active' ? 'bg-green-500/10 text-green-500' :
            domain.status === 'suspended' ? 'bg-red-500/10 text-red-500' :
            'bg-yellow-500/10 text-yellow-500'
          }`}>
            {domain.status}
          </span>
          <a
            href={`http://${domain.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['overview', 'subdomains', 'aliases', 'redirects'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Linked Website Section */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Server className="h-4 w-4 text-primary" /> Linked Website
            </h3>
            {domain.websiteId && linkedWebsite ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    This domain is linked to website: <strong>{linkedWebsite.name}</strong>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground font-mono">{linkedWebsite.documentRoot}</p>
                </div>
                <a
                  href={`/websites/${domain.websiteId}`}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View Website
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unplug className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">This domain has no linked website</p>
                </div>
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-1.5 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <Link2 className="h-3.5 w-3.5" /> Link to Website
                </button>
              </div>
            )}
          </div>

          {/* Domain Info Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">SSL</p>
              <p className="mt-1 flex items-center gap-1 text-lg font-semibold">
                <Shield className={`h-4 w-4 ${domain.sslEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                {domain.sslEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <Link to="/ssl" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Manage SSL <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">System User</p>
              <p className="mt-1 text-sm font-mono font-semibold">{domain.systemUser}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Disk Usage</p>
              <p className="mt-1 text-lg font-semibold">{domain.diskUsedMb ?? '—'} MB</p>
            </div>
          </div>

          {/* Quick Links to Domain Services */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Globe className="h-4 w-4 text-primary" /> Domain Services
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                to="/dns"
                className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">DNS Records</p>
                  <p className="text-xs text-muted-foreground">Manage DNS zone</p>
                </div>
              </Link>
              <Link
                to="/ssl"
                className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">SSL/TLS</p>
                  <p className="text-xs text-muted-foreground">Certificates & security</p>
                </div>
              </Link>
              <Link
                to="/mail"
                className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Mail</p>
                  <p className="text-xs text-muted-foreground">Email configuration</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Access Log Stats */}
          {logStats && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Activity className="h-4 w-4 text-primary" /> Access Log Statistics (This Week)
              </h3>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                  <p className="text-xl font-bold">{logStats.totalRequests.toLocaleString()}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Error Count</p>
                  <p className="text-xl font-bold text-red-500">{logStats.errorCount.toLocaleString()}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Error Rate</p>
                  <p className={`text-xl font-bold ${logStats.errorRate > 5 ? 'text-red-500' : logStats.errorRate > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {logStats.errorRate.toFixed(2)}%
                  </p>
                </div>
              </div>
              {logStats.topUrls && logStats.topUrls.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Top URLs</p>
                  <div className="space-y-1">
                    {logStats.topUrls.slice(0, 5).map((u, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-mono text-xs truncate max-w-md">{u.url}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{u.count.toLocaleString()} hits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subdomains Tab */}
      {tab === 'subdomains' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              value={newSubdomain}
              onChange={(e) => setNewSubdomain(e.target.value)}
              placeholder="Subdomain prefix (e.g., api)"
              className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => {
                if (newSubdomain) {
                  createSubdomain.mutate({ name: newSubdomain }, {
                    onSuccess: () => { setNewSubdomain(''); toast.success(`Subdomain ${newSubdomain}.${domain.name} created`); },
                    onError: (e: Error) => toast.error(e.message || 'Failed to create subdomain'),
                  });
                }
              }}
              disabled={!newSubdomain || createSubdomain.isPending}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {subdomains && subdomains.length > 0 ? (
            <ResponsiveTable>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Subdomain</th>
                    <th className="px-4 py-2 text-left font-medium">Document Root</th>
                    <th className="px-4 py-2 text-left font-medium">PHP</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subdomains.map((sub) => (
                    <tr key={sub.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{sub.name}.{domain.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{sub.documentRoot}</td>
                      <td className="px-4 py-2 text-muted-foreground">{sub.phpVersion}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => deleteSubdomain.mutate(sub.id, {
                            onSuccess: () => toast.success(`Subdomain deleted`),
                            onError: (e: Error) => toast.error(e.message || 'Failed to delete subdomain'),
                          })}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          ) : (
            <p className="text-sm text-muted-foreground">No subdomains</p>
          )}
        </div>
      )}

      {/* Aliases Tab */}
      {tab === 'aliases' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Alias domain (e.g., www.example.net)"
              className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => {
                if (newAlias) {
                  createAlias.mutate({ alias: newAlias }, {
                    onSuccess: () => { setNewAlias(''); toast.success(`Alias ${newAlias} created`); },
                    onError: (e: Error) => toast.error(e.message || 'Failed to create alias'),
                  });
                }
              }}
              disabled={!newAlias || createAlias.isPending}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {aliases && aliases.length > 0 ? (
            <ResponsiveTable>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Alias</th>
                    <th className="px-4 py-2 text-left font-medium">→ Target</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((alias) => (
                    <tr key={alias.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{alias.alias}</td>
                      <td className="px-4 py-2 text-muted-foreground">{domain.name}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => deleteAlias.mutate(alias.id, {
                            onSuccess: () => toast.success('Alias deleted'),
                            onError: (e: Error) => toast.error(e.message || 'Failed to delete alias'),
                          })}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          ) : (
            <p className="text-sm text-muted-foreground">No aliases</p>
          )}
        </div>
      )}

      {/* Redirects Tab */}
      {tab === 'redirects' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              value={newRedirectSource}
              onChange={(e) => setNewRedirectSource(e.target.value)}
              placeholder="/old-path"
              className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={newRedirectTarget}
              onChange={(e) => setNewRedirectTarget(e.target.value)}
              placeholder="https://example.com/new"
              className="flex-1 min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={newRedirectType}
              onChange={(e) => setNewRedirectType(e.target.value as '301' | '302')}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="301">301 Permanent</option>
              <option value="302">302 Temporary</option>
            </select>
            <button
              onClick={() => {
                if (newRedirectSource && newRedirectTarget) {
                  createRedirect.mutate(
                    { sourcePath: newRedirectSource, targetUrl: newRedirectTarget, type: newRedirectType },
                    {
                      onSuccess: () => { setNewRedirectSource(''); setNewRedirectTarget(''); toast.success('Redirect created'); },
                      onError: (e: Error) => toast.error(e.message || 'Failed to create redirect'),
                    }
                  );
                }
              }}
              disabled={!newRedirectSource || !newRedirectTarget || createRedirect.isPending}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {redirects && redirects.length > 0 ? (
            <ResponsiveTable>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Source</th>
                    <th className="px-4 py-2 text-left font-medium">Target</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {redirects.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{r.sourcePath}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.targetUrl}</td>
                      <td className="px-4 py-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.type}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => deleteRedirect.mutate(r.id, {
                            onSuccess: () => toast.success('Redirect deleted'),
                            onError: (e: Error) => toast.error(e.message || 'Failed to delete redirect'),
                          })}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          ) : (
            <p className="text-sm text-muted-foreground">No redirects</p>
          )}
        </div>
      )}

      {/* Link Website Modal */}
      {showLinkModal && (
        <LinkWebsiteModal
          domainId={domain.id}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

// --- Main Page ---
export function DomainsPage() {
  const [search, setSearch] = useState('');
  const { data: domains, isLoading, isError } = useDomains();
  const createDomain = useCreateDomain();
  const deleteDomain = useDeleteDomain();
  const suspendDomain = useSuspendDomain();
  const activateDomain = useActivateDomain();
  const bulkSuspend = useBulkSuspendDomains();
  const bulkActivate = useBulkActivateDomains();
  const bulkDelete = useBulkDeleteDomains();

  const [showCreate, setShowCreate] = useState(false);
  const [createdDomain, setCreatedDomain] = useState<{ name: string; documentRoot: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [renameTarget, setRenameTarget] = useState<Domain | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ open: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });
  const [suspendTarget, setSuspendTarget] = useState<Domain | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!domains) return;
    const filtered = domains.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkMutationLoading = bulkSuspend.isPending || bulkActivate.isPending || bulkDelete.isPending;

  if (isLoading) return <LoadingSpinner />;
  if (isError) return (
    <div>
      <PageHeader title="Domains" description="Manage your domains, subdomains, aliases and redirects" />
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load domains</h3>
        <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching domains. Please try again.</p>
      </div>
    </div>
  );

  // If a domain is selected, show detail view
  if (selectedDomain) {
    return <DomainDetail domain={selectedDomain} onBack={() => setSelectedDomain(null)} />;
  }

  // Filter domains by search
  const filtered = domains?.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreate = (data: CreateDomainInput) => {
    setCreatedDomain(null);
    createDomain.mutate(data, {
      onSuccess: (result: any) => {
        setShowCreate(false);
        setCreatedDomain({ name: data.name, documentRoot: result?.documentRoot || '' });
        toast.success(`Domain ${data.name} created successfully`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to create domain');
      },
    });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      const name = deleteTarget.name;
      deleteDomain.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null);
          toast.success(`Domain ${name} deleted`);
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to delete domain');
        },
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Manage your domains, subdomains, aliases and redirects"
        actions={
          <button
            onClick={() => { setShowCreate(!showCreate); setCreatedDomain(null); }}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Domain
          </button>
        }
      />

      {/* Success Banner */}
      {createdDomain && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">Domain Created Successfully!</h3>
                <p className="mt-1 text-sm text-green-700">
                  <strong>{createdDomain.name}</strong> is now active.
                </p>
                {createdDomain.documentRoot && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                    <FolderOpen className="h-4 w-4" />
                    <span className="font-mono text-xs">{createdDomain.documentRoot}</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setCreatedDomain(null)} className="text-green-600 hover:text-green-800">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <CreateDomainForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isLoading={createDomain.isPending}
          error={createDomain.error as ApiError | null}
        />
      )}

      {/* Search */}
      {domains && domains.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domains..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} domain{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Domains Table */}
      {!domains?.length ? (
        <EmptyState icon={Globe} title="No domains" description="Create your first domain to get started." />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No domains match your search.</p>
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Domain</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">SSL</th>
                <th className="px-4 py-3 text-left font-medium">Website</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className={`border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer ${
                    selectedIds.has(d.id) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedDomain(d)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.name}</span>
                      <a
                        href={`http://${d.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === 'active' ? 'bg-green-500/10 text-green-500' :
                      d.status === 'suspended' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize">{d.type || 'primary'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {d.sslEnabled ? (
                      <Shield className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.websiteId ? (
                      <a
                        href={`/websites/${d.websiteId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Server className="h-3 w-3" /> View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setRenameTarget(d)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Rename"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {d.status === 'active' ? (
                        <button
                          onClick={() => setSuspendTarget(d)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Suspend"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => activateDomain.mutate(d.id, {
                            onSuccess: () => toast.success(`${d.name} activated`),
                            onError: (e: Error) => toast.error(e.message || 'Failed to activate'),
                          })}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Activate"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(d)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSelectedDomain(d)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        onSuspend={() => {
          setConfirmDialog({
            open: true,
            title: 'Bulk Suspend Domains',
            message: `This will suspend ${selectedIds.size} domain(s). All associated websites will become unavailable.`,
            variant: 'warning',
            onConfirm: () => bulkSuspend.mutate(Array.from(selectedIds), {
              onSuccess: () => { clearSelection(); toast.success(`${selectedIds.size} domain(s) suspended`); },
              onError: (e: Error) => toast.error(e.message || 'Bulk suspend failed'),
            }),
          });
        }}
        onActivate={() => {
          setConfirmDialog({
            open: true,
            title: 'Bulk Activate Domains',
            message: `This will activate ${selectedIds.size} domain(s).`,
            variant: 'info',
            onConfirm: () => bulkActivate.mutate(Array.from(selectedIds), {
              onSuccess: () => { clearSelection(); toast.success(`${selectedIds.size} domain(s) activated`); },
              onError: (e: Error) => toast.error(e.message || 'Bulk activate failed'),
            }),
          });
        }}
        onDelete={() => {
          setConfirmDialog({
            open: true,
            title: 'Bulk Delete Domains',
            message: `This will permanently delete ${selectedIds.size} domain(s) and all associated DNS records, SSL certificates, and mail configuration. This cannot be undone.`,
            variant: 'danger',
            onConfirm: () => {
              const count = selectedIds.size;
              bulkDelete.mutate(Array.from(selectedIds), {
                onSuccess: () => { clearSelection(); toast.success(`${count} domain(s) deleted`); },
                onError: (e: Error) => toast.error(e.message || 'Bulk delete failed'),
              });
            },
          });
        }}
        isLoading={bulkMutationLoading}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirm
          domainName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteDomain.isPending}
        />
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <RenameDomainModal
          domain={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {/* Suspend Confirmation */}
      {suspendTarget && (
        <ConfirmDialog
          open={true}
          title="Suspend Domain"
          message={`This will suspend '${suspendTarget.name}' and take its website offline. Visitors will see an error page.`}
          variant="warning"
          onConfirm={() => {
            suspendDomain.mutate(suspendTarget.id, {
              onSuccess: () => toast.success(`${suspendTarget.name} suspended`),
              onError: (e: Error) => toast.error(e.message || 'Failed to suspend'),
            });
            setSuspendTarget(null);
          }}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

      {/* Generic Confirm Dialog for bulk actions */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
