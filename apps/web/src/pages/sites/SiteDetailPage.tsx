import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import {
  useSite,
  useSiteSubdomains,
  useSiteAliases,
  useSiteRedirects,
  useSiteFtp,
  useSiteCron,
  useSiteDatabases,
  type Site,
  type SiteSubdomain,
  type SiteAlias,
  type SiteRedirect,
} from '../../api/hooks/sites';
import {
  useCreateSubdomain,
  useDeleteSubdomain,
  useCreateAlias,
  useDeleteAlias,
  useCreateRedirect,
  useDeleteRedirect,
  useDeleteDomain,
  useSuspendDomain,
  useActivateDomain,
  useDomainCloudflareFirewall,
  useDomainCloudflareRedirects,
  useCreateDomainCloudflareFirewall,
  useDeleteDomainCloudflareFirewall,
  useCreateDomainCloudflareRedirect,
  useDeleteDomainCloudflareRedirect,
} from '../../api/hooks/domains';
import {
  checkAliasAvailability,
  checkSubdomainAvailability,
  type DomainConflictResult,
} from '../../lib/domainConflicts';
import {
  useWebsiteFtp,
  useWebsiteCron,
  useWebsiteDatabases,
} from '../../api/hooks/websites';
import { useServerContext } from '../../api/hooks/settings';
import { useTunnelRoutes } from '../../api/hooks/tunnel';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { SiteStatusBadge } from '../../components/sites/SiteStatusBadge';
import { DnsRecordList } from '../../components/dns/DnsRecordList';
import { CloudflareSslPanel } from '../../components/ssl/CloudflareSslPanel';
import {
  Globe, ArrowLeft, ExternalLink, Server, Shield, Mail, Database as DbIcon,
  FolderUp, Clock, FileText, Settings, Trash2, AlertTriangle, Info,
  Plus, X, RefreshCw, CheckCircle, Ban, CheckCircle2, XCircle,
  ChevronRight, Link2, Unplug, Cloud, Zap, ChevronDown, ChevronUp,
  ArrowRight, Edit2, AlertCircle, Loader2,
} from 'lucide-react';
import type { ApiError } from '../../api/client';
import { toast } from '../../lib/toast';

const TABS = [
  'overview',
  'files',
  'domains',
  'database',
  'mail',
  'ftp',
  'cron',
  'ssl',
  'config',
  'danger',
] as const;

type Tab = typeof TABS[number];

interface SiteDetailPageProps {
  siteId: string;
}

export function SiteDetailPage({ siteId }: SiteDetailPageProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Site | null>(null);
  const [activateTarget, setActivateTarget] = useState<Site | null>(null);

  const { data: site, isLoading, isError, refetch } = useSite(siteId);
  const { data: serverContext } = useServerContext();
  const { data: tunnelRoutes } = useTunnelRoutes();
  const deleteDomain = useDeleteDomain();
  const suspendDomain = useSuspendDomain();
  const activateDomain = useActivateDomain();

  // Find tunnel route for this site
  const siteTunnelRoute = tunnelRoutes?.find(
    (r) => r.hostname === site?.name || r.hostname === `*.${site?.name}`
  );

  // Determine Open button URL
  const hasPublicIp = serverContext?.hasPublicIp ?? true;
  const tunnelActive = serverContext?.tunnelActive ?? false;
  const tunnelUrl = serverContext?.tunnelUrl ?? null;
  const getOpenUrl = () => {
    if (!site) return null;
    if (hasPublicIp) {
      return `http://${site.name}`;
    }
    if (tunnelActive && siteTunnelRoute) {
      return `${tunnelUrl}/${site.name}`;
    }
    return null;
  };
  const openUrl = getOpenUrl();

  const handleDelete = () => {
    if (!deleteTarget || !site) return;
    deleteDomain.mutate(site.id, {
      onSuccess: () => {
        toast.success(`Site "${deleteTarget.name}" deleted`);
        // Navigate back to sites list
        window.location.href = '/sites';
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to delete site');
      },
    });
  };

  const handleSuspend = () => {
    if (!suspendTarget || !site) return;
    suspendDomain.mutate(site.id, {
      onSuccess: () => {
        setSuspendTarget(null);
        toast.success(`Site "${suspendTarget.name}" suspended`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to suspend site');
      },
    });
  };

  const handleActivate = () => {
    if (!activateTarget || !site) return;
    activateDomain.mutate(site.id, {
      onSuccess: () => {
        setActivateTarget(null);
        toast.success(`Site "${activateTarget.name}" activated`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to activate site');
      },
    });
  };

  if (isLoading) return <LoadingSpinner />;

  if (isError || !site) {
    return (
      <div>
        <PageHeader title="Site" description="Manage your site" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load site</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching the site.</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/sites"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Sites
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{site.documentRoot}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SiteStatusBadge status={site.status} />
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Site
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Not Externally Accessible
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'ssl' ? 'SSL/TLS' : t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab site={site} />}
      {tab === 'files' && <FilesTab site={site} />}
      {tab === 'domains' && <DomainsTab site={site} />}
      {tab === 'database' && <DatabaseTab site={site} />}
      {tab === 'mail' && <MailTab site={site} />}
      {tab === 'ftp' && <FtpTab site={site} />}
      {tab === 'cron' && <CronTab site={site} />}
      {tab === 'ssl' && <SslTab site={site} />}
      {tab === 'config' && <ConfigTab site={site} />}
      {tab === 'danger' && (
        <DangerTab
          site={site}
          onDelete={() => setDeleteTarget(site)}
          onSuspend={() => setSuspendTarget(site)}
          onActivate={() => setActivateTarget(site)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Site"
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
          title="Suspend Site"
          message={`This will suspend "${suspendTarget.name}". All visitors will see an error page.`}
          variant="warning"
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

      {/* Activate Confirmation */}
      {activateTarget && (
        <ConfirmDialog
          open={true}
          title="Activate Site"
          message={`This will activate "${activateTarget.name}" and bring it back online.`}
          variant="info"
          onConfirm={handleActivate}
          onCancel={() => setActivateTarget(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ site }: { site: Site }) {
  return (
    <div className="space-y-6">
      {/* Quick Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">System User</p>
          <p className="mt-1 text-lg font-semibold font-mono">{site.systemUser || '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">PHP Version</p>
          <p className="mt-1 text-lg font-semibold">{site.phpVersion || '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Web Server</p>
          <p className="mt-1 text-lg font-semibold">{site.webServer || '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">SSL</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-semibold">
            <Shield className={`h-4 w-4 ${site.sslEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
            {site.sslEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>

      {/* Cloudflare Integration */}
      {site.hasCloudflare && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Cloud className="h-4 w-4 text-orange-500" /> Cloudflare Integration
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                <CheckCircle className="h-3 w-3" /> Active
              </span>
              <span className="text-sm">Tunnel route configured</span>
            </div>
            <Link
              to="/cloudflare"
              className="flex items-center gap-1.5 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <Cloud className="h-3.5 w-3.5" /> Manage in Cloudflare
            </Link>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4" /> Quick Actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            to="/files"
            className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">File Manager</p>
              <p className="text-xs text-muted-foreground">Browse and edit files</p>
            </div>
          </Link>
          <Link
            to="/databases"
            className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <DbIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Databases</p>
              <p className="text-xs text-muted-foreground">Manage databases</p>
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
              <p className="text-sm font-medium">SSL Certificates</p>
              <p className="text-xs text-muted-foreground">Manage SSL/TLS</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function FilesTab({ site }: { site: Site }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4" /> File Manager
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage files in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{site.documentRoot}</code>
        </p>
        <Link
          to="/files"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <FileText className="h-4 w-4" /> Open File Manager
        </Link>
      </div>
    </div>
  );
}

function DomainsTab({ site }: { site: Site }) {
  const { data: subdomains, refetch: refetchSubdomains } = useSiteSubdomains(site.id);
  const { data: aliases, refetch: refetchAliases } = useSiteAliases(site.id);
  const { data: redirects, refetch: refetchRedirects } = useSiteRedirects(site.id);
  const createSubdomain = useCreateSubdomain(site.id);
  const deleteSubdomain = useDeleteSubdomain(site.id);
  const createAlias = useCreateAlias(site.id);
  const deleteAlias = useDeleteAlias(site.id);
  const createRedirect = useCreateRedirect(site.id);
  const deleteRedirect = useDeleteRedirect(site.id);
  const { data: serverContext } = useServerContext();
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    primary: true,
    subdomains: true,
    aliases: true,
    redirects: true,
    cloudflare: false,
  });

  const [showChangePrimary, setShowChangePrimary] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newSubdocRoot, setNewSubdocRoot] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newRedirectSource, setNewRedirectSource] = useState('');
  const [newRedirectTarget, setNewRedirectTarget] = useState('');
  const [newRedirectType, setNewRedirectType] = useState<'301' | '302'>('301');
  
  // Cloudflare sub-tab
  const [cfSubTab, setCfSubTab] = useState<'dns' | 'ssl' | 'firewall' | 'redirects'>('dns');
  
  // DNS verification state for aliases
  const [aliasDnsStatus, setAliasDnsStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  
  // Domain conflict checking state
  const [aliasConflict, setAliasConflict] = useState<DomainConflictResult | null>(null);
  const [subdomainConflict, setSubdomainConflict] = useState<DomainConflictResult | null>(null);
  const [isCheckingAlias, setIsCheckingAlias] = useState(false);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check if Cloudflare is configured
  const hasCloudflare = serverContext?.tunnelConfigured || false;

  // Handle alias blur for conflict checking
  const handleAliasBlur = async () => {
    if (newAlias) {
      setIsCheckingAlias(true);
      try {
        const conflict = await checkAliasAvailability(newAlias);
        setAliasConflict(conflict);
      } catch (err) {
        console.error('Alias conflict check failed:', err);
        setAliasConflict(null);
      } finally {
        setIsCheckingAlias(false);
      }
    } else {
      setAliasConflict(null);
    }
  };

  // Handle subdomain blur for conflict checking
  const handleSubdomainBlur = async () => {
    if (newSubdomain) {
      setIsCheckingSubdomain(true);
      try {
        const conflict = await checkSubdomainAvailability(newSubdomain, site.name);
        setSubdomainConflict(conflict);
      } catch (err) {
        console.error('Subdomain conflict check failed:', err);
        setSubdomainConflict(null);
      } finally {
        setIsCheckingSubdomain(false);
      }
    } else {
      setSubdomainConflict(null);
    }
  };

  // Handle subdomain creation
  const handleAddSubdomain = () => {
    if (!newSubdomain) return;
    // Block if subdomain is already a separate site
    if (subdomainConflict && !subdomainConflict.available) {
      toast.error(subdomainConflict.reason || 'Subdomain is already in use');
      return;
    }
    const docRoot = newSubdocRoot || `/var/www/${site.name}/subdomains/${newSubdomain}`;
    createSubdomain.mutate(
      { name: newSubdomain, documentRoot: docRoot },
      {
        onSuccess: () => {
          setNewSubdomain('');
          setNewSubdocRoot('');
          refetchSubdomains();
          toast.success(`Subdomain ${newSubdomain}.${site.name} created`);
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  // Handle alias creation
  const handleAddAlias = () => {
    if (!newAlias) return;
    // Block if alias is already in use elsewhere
    if (aliasConflict && !aliasConflict.available) {
      toast.error(aliasConflict.reason || 'Alias is already in use');
      return;
    }
    createAlias.mutate(
      { alias: newAlias },
      {
        onSuccess: () => {
          setNewAlias('');
          setAliasDnsStatus('idle');
          setAliasConflict(null);
          refetchAliases();
          toast.success(`Alias ${newAlias} created`);
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  // Handle redirect creation
  const handleAddRedirect = () => {
    if (!newRedirectSource || !newRedirectTarget) return;
    createRedirect.mutate(
      { sourcePath: newRedirectSource, targetUrl: newRedirectTarget, type: newRedirectType },
      {
        onSuccess: () => {
          setNewRedirectSource('');
          setNewRedirectTarget('');
          refetchRedirects();
          toast.success('Redirect created');
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Primary Domain Section */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => toggleSection('primary')}
          className="flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Primary Domain</h3>
          </div>
          <div className="flex items-center gap-2">
            <SiteStatusBadge status={site.status} />
            {expandedSections.primary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
        
        {expandedSections.primary && (
          <div className="border-t border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-bold">{site.name}</p>
                <p className="text-sm text-muted-foreground font-mono mt-1">{site.documentRoot}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium">
                    <Server className="h-3 w-3" /> {site.webServer}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium">
                    <Shield className="h-3 w-3" /> PHP {site.phpVersion}
                  </span>
                  {site.sslEnabled && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
                      <CheckCircle className="h-3 w-3" /> SSL Active
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowChangePrimary(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" /> Change Primary Domain
              </button>
            </div>
            
            <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                This is the domain your site was created with and cannot be deleted. To change it, you would need to create a new site.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Subdomains Section */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => toggleSection('subdomains')}
          className="flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Subdomains</h3>
            {subdomains && subdomains.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{subdomains.length}</span>
            )}
          </div>
          {expandedSections.subdomains ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.subdomains && (
          <div className="border-t border-border p-4">
            {/* Add subdomain form */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 flex items-center gap-2">
                <input
                  value={newSubdomain}
                  onChange={(e) => setNewSubdomain(e.target.value)}
                  onBlur={handleSubdomainBlur}
                  placeholder="subdomain prefix"
                  className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <span className="text-muted-foreground text-sm">.{site.name}</span>
              </div>
              <input
                value={newSubdocRoot}
                onChange={(e) => setNewSubdocRoot(e.target.value)}
                placeholder={`/var/www/${site.name}/subdomains/{subdomain}`}
                className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={handleAddSubdomain}
                disabled={!newSubdomain || createSubdomain.isPending}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {/* Subdomain Conflict Status */}
            {subdomainConflict && !subdomainConflict.available && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-red-700 dark:text-red-400">
                      Subdomain already in use
                    </h5>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      {subdomainConflict.reason}
                      {subdomainConflict.siteName && (
                        <span> — {subdomainConflict.siteName}</span>
                      )}
                    </p>
                    {subdomainConflict.conflictType === 'site' && subdomainConflict.siteId && (
                      <Link
                        to="/sites/$siteId"
                        params={{ siteId: subdomainConflict.siteId }}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View site <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isCheckingSubdomain && newSubdomain && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking subdomain availability...</span>
              </div>
            )}

            {subdomains && subdomains.length > 0 ? (
              <div className="space-y-2">
                {subdomains.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{sub.name}.{site.name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{sub.documentRoot}</span>
                    </div>
                    <button
                      onClick={() => deleteSubdomain.mutate(sub.id, {
                        onSuccess: () => {
                          refetchSubdomains();
                          toast.success('Subdomain deleted');
                        },
                        onError: (e: Error) => toast.error(e.message),
                      })}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No subdomains configured</p>
            )}
          </div>
        )}
      </div>

      {/* Aliases Section */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => toggleSection('aliases')}
          className="flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Aliases</h3>
            {aliases && aliases.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{aliases.length}</span>
            )}
          </div>
          {expandedSections.aliases ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.aliases && (
          <div className="border-t border-border p-4">
            {/* Add alias form */}
            <div className="flex gap-3 mb-4">
              <input
                value={newAlias}
                onChange={(e) => {
                  setNewAlias(e.target.value);
                  setAliasDnsStatus('idle');
                  setAliasConflict(null);
                }}
                onBlur={handleAliasBlur}
                placeholder="www.example.com or example.net"
                className="flex-1 max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={handleAddAlias}
                disabled={!newAlias || createAlias.isPending}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {aliases && aliases.length > 0 ? (
              <div className="space-y-2">
                {aliases.map((alias) => (
                  <div key={alias.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{alias.alias}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-mono text-sm">→ {site.name}</span>
                    </div>
                    <button
                      onClick={() => deleteAlias.mutate(alias.id, {
                        onSuccess: () => {
                          refetchAliases();
                          toast.success('Alias deleted');
                        },
                        onError: (e: Error) => toast.error(e.message),
                      })}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No aliases configured</p>
            )}

            {/* Alias Conflict Status */}
            {aliasConflict && !aliasConflict.available && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-red-700 dark:text-red-400">
                      Alias already in use
                    </h5>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      {aliasConflict.reason}
                      {aliasConflict.siteName && (
                        <span> — {aliasConflict.siteName}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isCheckingAlias && newAlias && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking alias availability...</span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-3">
              <Info className="h-3.5 w-3.5 inline mr-1" />
              Aliases serve the same content as the primary domain. External domains will require DNS verification.
            </p>
          </div>
        )}
      </div>

      {/* Redirects Section */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => toggleSection('redirects')}
          className="flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Redirects</h3>
            {redirects && redirects.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{redirects.length}</span>
            )}
          </div>
          {expandedSections.redirects ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.redirects && (
          <div className="border-t border-border p-4">
            {/* Add redirect form */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                value={newRedirectSource}
                onChange={(e) => setNewRedirectSource(e.target.value)}
                placeholder="/old-page"
                className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <span className="self-center text-muted-foreground">→</span>
              <input
                value={newRedirectTarget}
                onChange={(e) => setNewRedirectTarget(e.target.value)}
                placeholder="https://..."
                className="flex-1 min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <select
                value={newRedirectType}
                onChange={(e) => setNewRedirectType(e.target.value as '301' | '302')}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="301">301</option>
                <option value="302">302</option>
              </select>
              <button
                onClick={handleAddRedirect}
                disabled={!newRedirectSource || !newRedirectTarget || createRedirect.isPending}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {redirects && redirects.length > 0 ? (
              <div className="space-y-2">
                {redirects.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-mono text-sm truncate">{r.sourcePath}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm text-muted-foreground truncate">{r.targetUrl}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${
                        r.type === '301' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'
                      }`}>{r.type}</span>
                    </div>
                    <button
                      onClick={() => deleteRedirect.mutate(r.id, {
                        onSuccess: () => {
                          refetchRedirects();
                          toast.success('Redirect deleted');
                        },
                        onError: (e: Error) => toast.error(e.message),
                      })}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10 ml-3"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No redirects configured</p>
            )}
          </div>
        )}
      </div>

      {/* Cloudflare Section - Conditional */}
      {hasCloudflare && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => toggleSection('cloudflare')}
            className="flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Cloudflare</h3>
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600">
                Zone Management
              </span>
            </div>
            {expandedSections.cloudflare ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {expandedSections.cloudflare && (
            <div className="border-t border-border">
              {/* Cloudflare sub-tabs */}
              <div className="flex gap-1 border-b border-border px-4 bg-muted/30">
                {(['dns', 'ssl', 'firewall', 'redirects'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCfSubTab(t)}
                    className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                      cfSubTab === t
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'dns' ? 'DNS Records' : t === 'ssl' ? 'SSL/TLS' : t === 'firewall' ? 'Firewall' : 'Redirects'}
                  </button>
                ))}
              </div>
              
              <div className="p-4">
                {cfSubTab === 'dns' && (
                  <DnsRecordList domainId={site.id} domainName={site.name} />
                )}
                {cfSubTab === 'ssl' && (
                  <CloudflareSslPanel domainId={site.id} />
                )}
                {cfSubTab === 'firewall' && (
                  <CloudflareFirewallSection domainId={site.id} />
                )}
                {cfSubTab === 'redirects' && (
                  <CloudflareRedirectsSection domainId={site.id} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Change Primary Domain Modal */}
      {showChangePrimary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Change Primary Domain</h2>
              <button onClick={() => setShowChangePrimary(false)} className="rounded p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Changing your primary domain is a significant operation. The new domain must:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Point to this server via DNS</li>
                <li>Have valid SSL configured</li>
                <li>Not be in use by another site</li>
              </ul>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
                <p className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  This will update your site configuration but won't migrate content or recreate SSL certificates.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowChangePrimary(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowChangePrimary(false);
                    toast.info('Domain change flow coming soon');
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cloudflare Firewall Section Component
function CloudflareFirewallSection({ domainId }: { domainId: string }) {
  const { data: rules, isLoading, refetch } = useDomainCloudflareFirewall(domainId);
  const createRule = useCreateDomainCloudflareFirewall(domainId);
  const deleteRule = useDeleteDomainCloudflareFirewall(domainId);
  
  const [showAdd, setShowAdd] = useState(false);
  const [newExpression, setNewExpression] = useState('');
  const [newAction, setNewAction] = useState('block');
  const [newDescription, setNewDescription] = useState('');

  const handleCreate = () => {
    if (!newExpression) return;
    createRule.mutate(
      { expression: newExpression, action: newAction, description: newDescription },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewExpression('');
          setNewAction('block');
          setNewDescription('');
          refetch();
          toast.success('Firewall rule created');
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage Cloudflare firewall rules for this domain's zone.</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Expression</label>
            <input
              value={newExpression}
              onChange={(e) => setNewExpression(e.target.value)}
              placeholder={"(http.request.uri.path contains \"/admin\")"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <select
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="block">Block</option>
              <option value="challenge">Challenge</option>
              <option value="js_challenge">JS Challenge</option>
              <option value="allow">Allow</option>
              <option value="log">Log</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Block admin access"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newExpression || createRule.isPending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createRule.isPending ? 'Creating...' : 'Create Rule'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules && rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium mr-2 ${
                  rule.action === 'block' ? 'bg-red-500/10 text-red-600' :
                  rule.action === 'allow' ? 'bg-green-500/10 text-green-600' :
                  'bg-yellow-500/10 text-yellow-600'
                }`}>
                  {rule.action}
                </span>
                <span className="text-sm font-mono text-muted-foreground">{rule.filter.expression}</span>
                {rule.description && (
                  <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteRule.mutate(rule.id, {
                  onSuccess: () => {
                    refetch();
                    toast.success('Rule deleted');
                  },
                  onError: (e: Error) => toast.error(e.message),
                })}
                className="rounded p-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No firewall rules configured</p>
      )}
    </div>
  );
}

// Cloudflare Redirects Section Component
function CloudflareRedirectsSection({ domainId }: { domainId: string }) {
  const { data: cfRedirects, isLoading, refetch } = useDomainCloudflareRedirects(domainId);
  const createRedirect = useCreateDomainCloudflareRedirect(domainId);
  const deleteRedirect = useDeleteDomainCloudflareRedirect(domainId);
  
  const [showAdd, setShowAdd] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [newDest, setNewDest] = useState('');
  const [newType, setNewType] = useState('302');

  const handleCreate = () => {
    if (!newSource || !newDest) return;
    createRedirect.mutate(
      { sourcePattern: newSource, destinationUrl: newDest, redirectType: newType },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewSource('');
          setNewDest('');
          setNewType('302');
          refetch();
          toast.success('Cloudflare redirect created');
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage Cloudflare page rules for this domain's zone.</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Redirect
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Source Pattern</label>
              <input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="/old-path/*"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Destination URL</label>
              <input
                value={newDest}
                onChange={(e) => setNewDest(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Redirect Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="301">301 Permanent</option>
              <option value="302">302 Temporary</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newSource || !newDest || createRedirect.isPending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createRedirect.isPending ? 'Creating...' : 'Create Redirect'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cfRedirects && cfRedirects.length > 0 ? (
        <div className="space-y-2">
          {cfRedirects.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="font-mono text-sm truncate">{r.sourcePattern}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm text-muted-foreground truncate">{r.destinationUrl}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${
                  r.redirectType === '301' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'
                }`}>{r.redirectType}</span>
              </div>
              <button
                onClick={() => deleteRedirect.mutate(r.id, {
                  onSuccess: () => {
                    refetch();
                    toast.success('Redirect deleted');
                  },
                  onError: (e: Error) => toast.error(e.message),
                })}
                className="rounded p-1.5 text-destructive hover:bg-destructive/10 ml-3"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No Cloudflare redirects configured</p>
      )}
    </div>
  );
}

function DatabaseTab({ site }: { site: Site }) {
  const { data: databases } = useSiteDatabases(site.website?.id || '');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <DbIcon className="h-4 w-4" /> Databases
        </h3>
        {databases && databases.length > 0 ? (
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
                    <td className="px-4 py-2 font-medium">{db.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{db.type}</td>
                    <td className="px-4 py-2 text-muted-foreground">{db.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        ) : (
          <EmptyState
            icon={DbIcon}
            title="No databases"
            description="This site has no databases yet."
          />
        )}
      </div>
      <Link
        to="/databases"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" /> Create Database
      </Link>
    </div>
  );
}

function MailTab({ site }: { site: Site }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Mail className="h-4 w-4" /> Mail Configuration
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage email settings for <strong>{site.name}</strong>
        </p>
        <Link
          to="/mail"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Mail className="h-4 w-4" /> Open Mail Settings
        </Link>
      </div>
    </div>
  );
}

function FtpTab({ site }: { site: Site }) {
  const { data: ftpAccounts } = useSiteFtp(site.website?.id || '');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <FolderUp className="h-4 w-4" /> FTP Accounts
        </h3>
        {ftpAccounts && ftpAccounts.length > 0 ? (
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
                {ftpAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{account.username}</td>
                    <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{account.path}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.status === 'active' ? 'bg-green-500/10 text-green-500' :
                        account.status === 'suspended' ? 'bg-red-500/10 text-red-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {account.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        ) : (
          <EmptyState
            icon={FolderUp}
            title="No FTP accounts"
            description="This site has no FTP accounts yet."
          />
        )}
      </div>
      <Link
        to="/ftp"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" /> Create FTP Account
      </Link>
    </div>
  );
}

function CronTab({ site }: { site: Site }) {
  const { data: cronJobs } = useSiteCron(site.website?.id || '');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4" /> Cron Jobs
        </h3>
        {cronJobs && cronJobs.length > 0 ? (
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
                    <td className="px-4 py-2 font-mono text-xs truncate max-w-xs">{job.command}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        job.status === 'active' ? 'bg-green-500/10 text-green-500' :
                        job.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        ) : (
          <EmptyState
            icon={Clock}
            title="No cron jobs"
            description="This site has no cron jobs yet."
          />
        )}
      </div>
      <Link
        to="/cron"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" /> Create Cron Job
      </Link>
    </div>
  );
}

function SslTab({ site }: { site: Site }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Shield className="h-4 w-4" /> SSL/TLS Certificates
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage SSL certificates for <strong>{site.name}</strong>
        </p>
        <Link
          to="/ssl"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Shield className="h-4 w-4" /> Manage SSL
        </Link>
      </div>
    </div>
  );
}

function ConfigTab({ site }: { site: Site }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Settings className="h-4 w-4" /> PHP Configuration
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          PHP {site.phpVersion} with {site.phpHandler} handler
        </p>
        <Link
          to="/php"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Settings className="h-4 w-4" /> Configure PHP
        </Link>
      </div>
    </div>
  );
}

function DangerTab({
  site,
  onDelete,
  onSuspend,
  onActivate,
}: {
  site: Site;
  onDelete: () => void;
  onSuspend: () => void;
  onActivate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          These actions are irreversible. Please be careful.
        </p>
        <div className="space-y-3">
          {site.status === 'active' ? (
            <button
              onClick={onSuspend}
              className="flex items-center gap-2 rounded-md border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-500/20"
            >
              <Ban className="h-4 w-4" /> Suspend Site
            </button>
          ) : (
            <button
              onClick={onActivate}
              className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-500/20"
            >
              <CheckCircle className="h-4 w-4" /> Activate Site
            </button>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4" /> Delete Site
          </button>
        </div>
      </div>
    </div>
  );
}
