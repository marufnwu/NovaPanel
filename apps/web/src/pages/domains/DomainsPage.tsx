import { useState, useEffect } from 'react';
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
  useDomainCloudflareStatus,
  useDomainCloudflareZone,
  useDomainCloudflareDns,
  useCreateDomainCloudflareDns,
  useDeleteDomainCloudflareDns,
  useDomainCloudflareSsl,
  useUpdateDomainCloudflareSsl,
  useDomainCloudflareFirewall,
  useCreateDomainCloudflareFirewall,
  useDeleteDomainCloudflareFirewall,
  useDomainCloudflareRedirects,
  useCreateDomainCloudflareRedirect,
  useDeleteDomainCloudflareRedirect,
  useCreateDomainCloudflareRoute,
  useDeleteDomainCloudflareRoute,
  type DomainCloudflareDnsRecord,
  type DomainCloudflareSsl,
  type DomainCloudflareFirewallRule,
  type DomainCloudflareRedirectRule,
} from '../../api/hooks/domains';
import type { CreateDomainInput } from '../../api/hooks/domains';
import { useWebsites, useAttachDomain } from '../../api/hooks/websites';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import { useServerContext } from '../../api/hooks/settings';
import { useTunnelRoutes, useCloudflareConfig, useTunnelStatus } from '../../api/hooks/tunnel';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import {
  Globe, Plus, Trash2, Ban, CheckCircle, X, FolderOpen, ExternalLink,
  Search, Shield, Server, ChevronRight, ArrowLeft, Link2, ArrowRightLeft,
  Edit3, Activity, AlertTriangle, Unplug, Mail, FileText, Info, Cloud,
  Lock, RefreshCw, Zap, ToggleLeft, ToggleRight, XCircle, Waypoints, Save,
  Globe2,
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

// --- Domain Status Badge ---
function DomainStatusBadge({ domainId }: { domainId: string }) {
  const { data: status } = useDomainCloudflareStatus(domainId);

  if (!status) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  const config = {
    live: { label: 'Live', className: 'bg-green-500/10 text-green-500' },
    local: { label: 'Local', className: 'bg-gray-500/10 text-gray-500' },
    down: { label: 'Down', className: 'bg-red-500/10 text-red-500' },
    redirect: { label: 'Redirect', className: 'bg-blue-500/10 text-blue-500' },
    suspended: { label: 'Suspended', className: 'bg-orange-500/10 text-orange-500' },
  };

  const { label, className } = config[status.overall] || config.local;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

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
  const phpVersions = (phpData?.versions?.length
    ? phpData.versions.map((v: any) => typeof v === 'string' ? v : v.version)
    : DEFAULT_PHP_VERSIONS);
  const { data: cloudflareConfig } = useCloudflareConfig();
  const { data: tunnelStatus } = useTunnelStatus();
  const cfConfig = cloudflareConfig && 'apiToken' in cloudflareConfig ? cloudflareConfig : null;
  const hasCloudflareConfig = !!(cfConfig?.apiToken);
  const hasActiveTunnel = tunnelStatus?.processRunning && tunnelStatus?.tunnels?.length > 0;
  const showMakePublic = hasCloudflareConfig && hasActiveTunnel;
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
    // Cloudflare auto-public
    makePublic: showMakePublic,
    tunnelId: '',
  });

  const { data: websites } = useWebsites();

  // Set default tunnel when cloudflare config loads
  useEffect(() => {
    if (showMakePublic && !form.tunnelId && tunnelStatus?.tunnels?.length) {
      const activeTunnel = tunnelStatus.tunnels.find(t => t.status === 'active');
      if (activeTunnel) {
        setForm(f => ({ ...f, tunnelId: activeTunnel.id }));
      }
    }
  }, [showMakePublic, tunnelStatus]);

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
      // Cloudflare auto-public
      makePublic: showMakePublic ? form.makePublic : undefined,
      tunnelId: showMakePublic && form.makePublic && form.tunnelId ? form.tunnelId : undefined,
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

        {/* Cloudflare Auto-Public Section */}
        {showMakePublic && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 space-y-3 dark:border-orange-800 dark:bg-orange-900/20">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Internet Access</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.makePublic}
                onChange={(e) => setForm({ ...form, makePublic: e.target.checked })}
                className="h-4 w-4 rounded border-input text-primary"
              />
              <span className="text-sm">Make this domain publicly accessible via Cloudflare Tunnel</span>
            </label>
            {form.makePublic && (
              <div className="pl-6 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tunnel</label>
                  <select
                    value={form.tunnelId}
                    onChange={(e) => setForm({ ...form, tunnelId: e.target.value })}
                    className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="">Auto-select tunnel</option>
                    {tunnelStatus?.tunnels?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>SSL mode: Full (HTTPS, self-signed certificate OK)</span>
                </div>
              </div>
            )}
            {!hasActiveTunnel && (
              <div className="flex items-start gap-2 mt-2 text-xs text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>No tunnels configured. <a href="/cloudflare" className="underline">Create a tunnel</a> in Cloudflare → Tunnels to enable this feature.</span>
              </div>
            )}
          </div>
        )}

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
  const { data: serverContext } = useServerContext();
  const { data: tunnelRoutes } = useTunnelRoutes();
  const { data: subdomains } = useSubdomains(domain.id);
  const { data: aliases } = useAliases(domain.id);
  const { data: redirects } = useRedirects(domain.id);
  const { data: logStats } = useDomainLogStats(domain.id);
  const { data: websites } = useWebsites();
  const { data: cloudflareConfig } = useCloudflareConfig();
  const { data: cfZone } = useDomainCloudflareZone(domain.id);
  const { data: cfStatus } = useDomainCloudflareStatus(domain.id);
  const createSubdomain = useCreateSubdomain(domain.id);
  const createAlias = useCreateAlias(domain.id);
  const createRedirect = useCreateRedirect(domain.id);
  const deleteSubdomain = useDeleteSubdomain(domain.id);
  const deleteAlias = useDeleteAlias(domain.id);
  const deleteRedirect = useDeleteRedirect(domain.id);

  // Cloudflare hooks
  const { data: cfDnsRecords, refetch: refetchCfDns } = useDomainCloudflareDns(domain.id);
  const createCfDns = useCreateDomainCloudflareDns(domain.id);
  const deleteCfDns = useDeleteDomainCloudflareDns(domain.id);
  const { data: cfSsl, refetch: refetchCfSsl } = useDomainCloudflareSsl(domain.id);
  const updateCfSsl = useUpdateDomainCloudflareSsl(domain.id);
  const { data: cfFirewall, refetch: refetchCfFirewall } = useDomainCloudflareFirewall(domain.id);
  const createCfFirewall = useCreateDomainCloudflareFirewall(domain.id);
  const deleteCfFirewall = useDeleteDomainCloudflareFirewall(domain.id);
  const { data: cfRedirects, refetch: refetchCfRedirects } = useDomainCloudflareRedirects(domain.id);
  const createCfRedirect = useCreateDomainCloudflareRedirect(domain.id);
  const deleteCfRedirect = useDeleteDomainCloudflareRedirect(domain.id);
  const createCfRoute = useCreateDomainCloudflareRoute(domain.id);
  const deleteCfRoute = useDeleteDomainCloudflareRoute(domain.id);

  const cfConfig = cloudflareConfig && 'apiToken' in cloudflareConfig ? cloudflareConfig : null;
  const hasCloudflareConfig = !!(cfConfig?.apiToken);
  const hasLinkedZone = !!(cfZone && cfZone.zoneName);
  const showCloudflareTab = hasCloudflareConfig && hasLinkedZone;

  const [tab, setTab] = useState<'overview' | 'subdomains' | 'aliases' | 'redirects' | 'cloudflare'>('overview');
  const [cfSubTab, setCfSubTab] = useState<'dns' | 'ssl' | 'firewall' | 'redirects'>('dns');
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

  // Determine Open button behavior based on server context
  const hasPublicIp = serverContext?.hasPublicIp ?? true;
  const tunnelActive = serverContext?.tunnelActive ?? false;
  const tunnelUrl = serverContext?.tunnelUrl ?? null;

  // Check if this domain has a tunnel route
  const domainTunnelRoute = tunnelRoutes?.find(
    (r) => r.hostname === domain.name || r.hostname === `*.${domain.name}`
  );

  // Build Open button URL
  const getOpenUrl = () => {
    if (hasPublicIp) {
      return `http://${domain.name}`;
    }
    if (tunnelActive && domainTunnelRoute) {
      return `${tunnelUrl}/${domain.name}`;
    }
    return null;
  };

  const openUrl = getOpenUrl();

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
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>Not Externally Accessible</span>
            </div>
          )}
        </div>
        {!openUrl && hasPublicIp === false && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="flex-1">
              <p className="text-sm text-yellow-600">
                This domain is only accessible from your local network. Add a Cloudflare Tunnel route to make it publicly accessible.
              </p>
              <Link
                to="/cloudflare"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Set up tunnel <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
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
        {showCloudflareTab && (
          <button
            onClick={() => setTab('cloudflare')}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'cloudflare' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cloud className="h-3.5 w-3.5" /> Cloudflare
          </button>
        )}
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

          {/* Cloudflare Integration */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Cloud className="h-4 w-4 text-orange-500" /> Cloudflare Integration
            </h3>
            {domainTunnelRoute ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                    <span className="text-sm">Tunnel route: <code className="rounded bg-muted px-1 text-xs">{domain.name}</code> → <code className="rounded bg-muted px-1 text-xs">{domainTunnelRoute.service}</code></span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This domain is served through Cloudflare Tunnel. DNS, SSL, and caching are managed via Cloudflare.
                  </p>
                </div>
                <Link
                  to="/cloudflare"
                  className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
                >
                  <Cloud className="h-3.5 w-3.5" /> Manage in Cloudflare
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unplug className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No Cloudflare Tunnel route configured for this domain</p>
                </div>
                <Link
                  to="/cloudflare"
                  className="flex items-center gap-1.5 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <Cloud className="h-3.5 w-3.5" /> Set Up Cloudflare
                </Link>
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

      {/* Cloudflare Tab */}
      {tab === 'cloudflare' && (
        <div className="space-y-4">
          {/* Cloudflare Tab Sub-navigation */}
          <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
            {(['dns', 'ssl', 'firewall', 'redirects'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCfSubTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
                  cfSubTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'dns' ? 'DNS Records' : t === 'ssl' ? 'SSL/TLS' : t === 'firewall' ? 'Firewall' : 'Redirects'}
              </button>
            ))}
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap gap-2">
            {cfStatus?.hasTunnelRoute ? (
              <button
                onClick={() => deleteCfRoute.mutate(undefined, {
                  onSuccess: () => toast.success('Domain made private'),
                  onError: (e: Error) => toast.error(e.message || 'Failed to remove route'),
                })}
                disabled={deleteCfRoute.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400 disabled:opacity-50"
              >
                <Unplug className="h-4 w-4" /> Make Private
              </button>
            ) : (
              <button
                onClick={() => createCfRoute.mutate(undefined, {
                  onSuccess: () => toast.success('Domain made public'),
                  onError: (e: Error) => toast.error(e.message || 'Failed to create route'),
                })}
                disabled={createCfRoute.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" /> {createCfRoute.isPending ? 'Making Public...' : 'Make Public'}
              </button>
            )}
            <button
              onClick={() => setCfSubTab('ssl')}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-accent ${!cfSsl ? 'opacity-50' : ''}`}
            >
              <Shield className="h-4 w-4" /> Enable SSL
            </button>
            <button
              onClick={() => setCfSubTab('redirects')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" /> Setup Redirects
            </button>
          </div>

          {/* DNS Records Sub-tab */}
          {cfSubTab === 'dns' && (
            <DomainCfDnsTab
              domainId={domain.id}
              domainName={domain.name}
              records={cfDnsRecords?.records || []}
              loading={!cfDnsRecords}
              onRefresh={refetchCfDns}
              onCreate={createCfDns}
              onDelete={deleteCfDns}
            />
          )}

          {/* SSL/TLS Sub-tab */}
          {cfSubTab === 'ssl' && (
            <DomainCfSslTab
              domainId={domain.id}
              settings={cfSsl}
              loading={!cfSsl}
              onRefresh={refetchCfSsl}
              onUpdate={updateCfSsl}
            />
          )}

          {/* Firewall Sub-tab */}
          {cfSubTab === 'firewall' && (
            <DomainCfFirewallTab
              domainId={domain.id}
              rules={cfFirewall || []}
              loading={!cfFirewall}
              onRefresh={refetchCfFirewall}
              onCreate={createCfFirewall}
              onDelete={deleteCfFirewall}
            />
          )}

          {/* Redirects Sub-tab */}
          {cfSubTab === 'redirects' && (
            <DomainCfRedirectsTab
              domainId={domain.id}
              rules={cfRedirects || []}
              loading={!cfRedirects}
              onRefresh={refetchCfRedirects}
              onCreate={createCfRedirect}
              onDelete={deleteCfRedirect}
            />
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

// =========================================================================
// Cloudflare Tab Sub-Components
// =========================================================================

function DomainCfDnsTab({
  domainId,
  domainName,
  records,
  loading,
  onRefresh,
  onCreate,
  onDelete,
}: {
  domainId: string;
  domainName: string;
  records: DomainCloudflareDnsRecord[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: ReturnType<typeof useCreateDomainCloudflareDns>;
  onDelete: ReturnType<typeof useDeleteDomainCloudflareDns>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRecord, setNewRecord] = useState({ type: 'A', name: '', content: '', proxied: false, ttl: 1 });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{records.length} records</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Record
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={Globe} title="No DNS records" description="Add DNS records to manage your domain's DNS configuration." />
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Content</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Proxied</th>
                <th className="px-4 py-3 text-left text-xs font-medium">TTL</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-border hover:bg-accent/50">
                  <td className="px-4 py-2"><span className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{record.type}</span></td>
                  <td className="px-4 py-2 text-sm font-medium">{record.name}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">{record.content}</td>
                  <td className="px-4 py-2">{record.proxied ? <CheckCircle className="h-4 w-4 text-orange-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{record.ttl === 1 ? 'Auto' : `${record.ttl}s`}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Delete this DNS record?')) {
                          onDelete.mutate(record.id, {
                            onSuccess: () => toast.success('DNS record deleted'),
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }
                      }}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreate.mutate(newRecord, {
                onSuccess: () => { setShowCreate(false); setNewRecord({ type: 'A', name: '', content: '', proxied: false, ttl: 1 }); toast.success('DNS record created'); },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Add Record</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={newRecord.type}
                onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                value={newRecord.name}
                onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder="@ or subdomain"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Content</label>
              <input
                value={newRecord.content}
                onChange={(e) => setNewRecord({ ...newRecord, content: e.target.value })}
                placeholder="IP address or hostname"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {(newRecord.type === 'A' || newRecord.type === 'AAAA' || newRecord.type === 'CNAME') && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRecord.proxied}
                  onChange={(e) => setNewRecord({ ...newRecord, proxied: e.target.checked })}
                  className="rounded"
                />{' '}
                Proxied through Cloudflare
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={onCreate.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {onCreate.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DomainCfSslTab({
  domainId,
  settings,
  loading,
  onRefresh,
  onUpdate,
}: {
  domainId: string;
  settings: DomainCloudflareSsl | undefined;
  loading: boolean;
  onRefresh: () => void;
  onUpdate: ReturnType<typeof useUpdateDomainCloudflareSsl>;
}) {
  const [localSettings, setLocalSettings] = useState<DomainCloudflareSsl | null>(null);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  if (loading) return <LoadingSpinner />;
  if (!localSettings) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">SSL/TLS Encryption</h3>
        <div>
          <label className="mb-2 block text-sm font-medium">SSL Mode</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['off', 'flexible', 'full', 'strict'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLocalSettings({ ...localSettings, sslMode: mode })}
                className={`rounded-lg border p-3 text-center text-sm transition-colors ${
                  localSettings?.sslMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent'
                }`}
              >
                <div className="font-medium capitalize">{mode}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {mode === 'off' && 'No encryption'}
                  {mode === 'flexible' && 'HTTP to server'}
                  {mode === 'full' && 'HTTPS, self-signed OK'}
                  {mode === 'strict' && 'HTTPS, valid cert required'}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleSetting label="Always Use HTTPS" description="Redirect HTTP to HTTPS at edge" checked={localSettings?.alwaysUseHttps ?? false} onChange={(v) => setLocalSettings({ ...localSettings!, alwaysUseHttps: v })} />
          <ToggleSetting label="Automatic HTTPS Rewrites" description="Rewrite HTTP links to HTTPS" checked={localSettings?.automaticHttpsRewrites ?? false} onChange={(v) => setLocalSettings({ ...localSettings!, automaticHttpsRewrites: v })} />
          <ToggleSetting label="HTTP/2" checked={localSettings?.http2 ?? true} onChange={(v) => setLocalSettings({ ...localSettings!, http2: v })} />
          <ToggleSetting label="HTTP/3 (QUIC)" checked={localSettings?.http3 ?? true} onChange={(v) => setLocalSettings({ ...localSettings!, http3: v })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Minimum TLS Version</label>
          <select
            value={localSettings?.minTlsVersion || '1.2'}
            onChange={(e) => setLocalSettings({ ...localSettings!, minTlsVersion: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {['1.0', '1.1', '1.2', '1.3'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button
          onClick={() => {
            onUpdate.mutate(localSettings, {
              onSuccess: () => toast.success('SSL settings updated'),
              onError: (e: Error) => toast.error(e.message),
            });
          }}
          disabled={onUpdate.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {onUpdate.isPending ? 'Saving...' : 'Save SSL Settings'}
        </button>
      </div>
    </div>
  );
}

function DomainCfFirewallTab({
  domainId,
  rules,
  loading,
  onRefresh,
  onCreate,
  onDelete,
}: {
  domainId: string;
  rules: DomainCloudflareFirewallRule[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: ReturnType<typeof useCreateDomainCloudflareFirewall>;
  onDelete: ReturnType<typeof useDeleteDomainCloudflareFirewall>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ action: 'block', expression: '', description: '' });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={Shield} title="No firewall rules" description="Add firewall rules to control access to your site." />
      ) : (
        <ResponsiveTable>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Expression</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border">
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.action === 'block' ? 'bg-red-100 text-red-700' :
                      rule.action === 'allow' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{rule.action}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">{rule.filter?.expression}</td>
                  <td className="px-4 py-2 text-sm">{rule.description}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Delete this firewall rule?')) {
                          onDelete.mutate(rule.id, {
                            onSuccess: () => toast.success('Firewall rule deleted'),
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }
                      }}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreate.mutate(newRule, {
                onSuccess: () => { setShowCreate(false); setNewRule({ action: 'block', expression: '', description: '' }); toast.success('Firewall rule created'); },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Add Firewall Rule</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Action</label>
              <select
                value={newRule.action}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="block">Block</option>
                <option value="allow">Allow</option>
                <option value="challenge">Challenge (CAPTCHA)</option>
                <option value="js_challenge">JS Challenge</option>
                <option value="log">Log</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expression</label>
              <input
                value={newRule.expression}
                onChange={(e) => setNewRule({ ...newRule, expression: e.target.value })}
                placeholder='e.g. (ip.src eq 192.168.1.1)'
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Uses Cloudflare Wirefilter expression language</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <input
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                placeholder="Block bad IPs"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={onCreate.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {onCreate.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DomainCfRedirectsTab({
  domainId,
  rules,
  loading,
  onRefresh,
  onCreate,
  onDelete,
}: {
  domainId: string;
  rules: DomainCloudflareRedirectRule[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: ReturnType<typeof useCreateDomainCloudflareRedirect>;
  onDelete: ReturnType<typeof useDeleteDomainCloudflareRedirect>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ sourcePattern: '', destinationUrl: '', redirectType: '301' });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Redirect
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={RefreshCw} title="No redirect rules" description="Add redirect rules to forward URLs." />
      ) : (
        <ResponsiveTable>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border">
                  <td className="px-4 py-2 text-sm font-mono">{rule.sourcePattern}</td>
                  <td className="px-4 py-2 text-sm font-mono">{rule.destinationUrl}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{rule.redirectType}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Delete this redirect rule?')) {
                          onDelete.mutate(rule.id, {
                            onSuccess: () => toast.success('Redirect deleted'),
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }
                      }}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreate.mutate(newRule, {
                onSuccess: () => { setShowCreate(false); setNewRule({ sourcePattern: '', destinationUrl: '', redirectType: '301' }); toast.success('Redirect rule created'); },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Add Redirect Rule</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Source Pattern</label>
              <input
                value={newRule.sourcePattern}
                onChange={(e) => setNewRule({ ...newRule, sourcePattern: e.target.value })}
                placeholder="www.example.com/*"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Destination URL</label>
              <input
                value={newRule.destinationUrl}
                onChange={(e) => setNewRule({ ...newRule, destinationUrl: e.target.value })}
                placeholder="https://example.com/$1"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={newRule.redirectType}
                onChange={(e) => setNewRule({ ...newRule, redirectType: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="301">301 (Permanent)</option>
                <option value="302">302 (Temporary)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={onCreate.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {onCreate.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Toggle Setting Component ---
function ToggleSetting({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer hover:bg-accent/50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 rounded" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </label>
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
  const { data: serverContext } = useServerContext();
  const { data: tunnelRoutes } = useTunnelRoutes();

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
                <p className="mt-2 text-sm text-green-600">
                  To make it accessible from the internet, set up a Cloudflare Tunnel route.
                </p>
                {createdDomain.documentRoot && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                    <FolderOpen className="h-4 w-4" />
                    <span className="font-mono text-xs">{createdDomain.documentRoot}</span>
                  </div>
                )}
                <Link
                  to="/cloudflare"
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-4 w-4" /> Set Up Tunnel
                </Link>
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
                <th className="px-4 py-3 text-left font-medium">Access</th>
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
                      {(() => {
                        const domainRoute = tunnelRoutes?.find(
                          (r) => r.hostname === d.name || r.hostname === `*.${d.name}`
                        );
                        return domainRoute ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" title="Cloudflare Tunnel active">
                            <Cloud className="h-2.5 w-2.5" /> CF
                          </span>
                        ) : null;
                      })()}
                      {(() => {
                        const hasPublicIp = serverContext?.hasPublicIp ?? true;
                        const tunnelActive = serverContext?.tunnelActive ?? false;
                        const tunnelUrl = serverContext?.tunnelUrl ?? null;
                        const domainRoute = tunnelRoutes?.find(
                          (r) => r.hostname === d.name || r.hostname === `*.${d.name}`
                        );
                        const openUrl = hasPublicIp
                          ? `http://${d.name}`
                          : (tunnelActive && domainRoute ? `${tunnelUrl}/${d.name}` : null);
                        return openUrl ? (
                          <a
                            href={openUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          !tunnelRoutes?.find((r) => r.hostname === d.name || r.hostname === `*.${d.name}`) ? (
                            <span className="text-muted-foreground" title="Not externally accessible">
                              <Info className="h-3.5 w-3.5" />
                            </span>
                          ) : null
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DomainStatusBadge domainId={d.id} />
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
