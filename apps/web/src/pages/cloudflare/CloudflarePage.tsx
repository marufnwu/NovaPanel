import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useTunnelStatus, useTunnelRoutes, useSetupTunnel, useStartTunnel, useStopTunnel,
  useAddTunnelRoute, useDeleteTunnelRoute, useToggleTunnelRoute, useEditTunnelRoute,
  useDeleteTunnel, useTunnelInfo, useTunnelConfig, useValidateToken, useFetchZones,
  useTunnelLogs, useSyncTunnelRoutes, useCloudflareConfig, useSetCloudflareConfig,
  CloudflareTunnel, TunnelRoute, CloudflareZone,
} from '../../api/hooks/tunnel';
import { useDomains } from '../../api/hooks/domains';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../lib/toast';
import {
  Cloud, Plus, Trash2, Globe, Shield, Lock, Server, RefreshCw,
  ExternalLink, Zap, Info, ChevronRight, Play, Mail,
  AlertTriangle, CheckCircle, XCircle, Search, Edit, Save, X,
  Waypoints, ArrowRight, Activity, Square, ToggleLeft, ToggleRight,
  FileText, Settings, Radio,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

type TopTab = 'overview' | 'tunnels';

// ============================================================
// Main Page Component
// ============================================================

export function CloudflarePage() {
  const [activeTab, setActiveTab] = useState<TopTab>('overview');
  const [showSetup, setShowSetup] = useState(false);

  // Centralized Cloudflare config — loaded once from settings.json on the server
  const { data: cloudflareConfig } = useCloudflareConfig();
  const cfConfig = cloudflareConfig && 'apiToken' in cloudflareConfig ? cloudflareConfig : null;
  const isConnected = !!(cfConfig?.apiToken);

  // Not yet configured — show unified setup card
  if (!isConnected) {
    return (
      <div>
        <PageHeader 
          title="Cloudflare" 
          description="Manage Cloudflare tunnel connections for private network access" 
        />
        <CloudflareSetupCard onSetup={() => setShowSetup(true)} />
        {showSetup && <CloudflareSetupModal onClose={() => setShowSetup(false)} />}
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="Cloudflare" 
        description="Manage Cloudflare tunnel connections for private network access" 
      />
      <TopTabs activeTab={activeTab} onTabChange={setActiveTab} isConnected={isConnected} />
      <div className="mt-4">
        {activeTab === 'overview' && <OverviewSection />}
        {activeTab === 'tunnels' && <TunnelsSection onSetupTunnel={() => setShowSetup(true)} />}
      </div>

      {showSetup && <CloudflareSetupModal onClose={() => { setShowSetup(false); }} />}
    </div>
  );
}

// ============================================================
// Unified Cloudflare Setup Card + Modal
// ============================================================

function CloudflareSetupCard({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
          <Cloud className="h-8 w-8 text-orange-500" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Connect Cloudflare</h3>
        <p className="mb-6 max-w-lg mx-auto text-sm text-muted-foreground">
          Connect your Cloudflare account to manage tunnel connections for secure private network access.
        </p>
        <div className="mx-auto max-w-lg grid gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
            </div>
            <h4 className="text-sm font-medium">Get API Token</h4>
            <p className="mt-1 text-xs text-muted-foreground">Create a Cloudflare API token with tunnel permissions</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">2</span>
            </div>
            <h4 className="text-sm font-medium">Enter Token</h4>
            <p className="mt-1 text-xs text-muted-foreground">Paste your API token below and connect your account</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">3</span>
            </div>
            <h4 className="text-sm font-medium">Setup Tunnels</h4>
            <p className="mt-1 text-xs text-muted-foreground">Create tunnels to expose your services via Cloudflare</p>
          </div>
        </div>
        <button onClick={onSetup} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Connect Cloudflare Account
        </button>
      </div>
    </div>
  );
}

function CloudflareSetupModal({ onClose }: { onClose: () => void }) {
  const setConfig = useSetCloudflareConfig();
  const validateToken = useValidateToken();
  const fetchZones = useFetchZones();
  const [step, setStep] = useState<'token' | 'account' | 'saving'>('token');
  const [form, setForm] = useState({ apiToken: '', accountId: '', zoneId: '' });
  const [validation, setValidation] = useState<{ valid?: boolean; email?: string; error?: string }>({});
  const [zones, setZones] = useState<CloudflareZone[]>([]);

  const handleValidateToken = async () => {
    if (!form.apiToken) return;
    validateToken.mutate(form.apiToken, {
      onSuccess: (data) => {
        setValidation({ valid: true, email: data.email });
        // If token has account-level access, fetch accounts
        if (data.type === 'account') {
          fetchZones.mutate({ apiToken: form.apiToken }, {
            onSuccess: (fetchedZones) => {
              setZones(fetchedZones);
              setStep('account');
            },
            onError: (e: any) => {
              setValidation(v => ({ ...v, error: e.message }));
              setStep('account');
            },
          });
        } else {
          setStep('account');
        }
      },
      onError: (error: any) => { setValidation({ valid: false, error: error.message || 'Invalid token' }); },
    });
  };

  const handleSubmit = async () => {
    if (!form.apiToken) return;
    setStep('saving');
    try {
      await setConfig.mutateAsync({ apiToken: form.apiToken, accountId: form.accountId });
      toast.success('Cloudflare connected successfully!');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save config');
      setStep('account');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Connect Cloudflare Account</h2>

        {step === 'token' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Cloudflare API Token</label>
              <input type="password" value={form.apiToken} onChange={(e) => setForm({ ...form, apiToken: e.target.value })} placeholder="cfat_xxxxxxxxxxxxx" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">Token needs Account - Cloudflare Tunnel - Edit and Zone - DNS - Edit permissions</p>
            </div>
            {validation.error && <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-500 text-sm"><AlertTriangle className="h-4 w-4" /><span>{validation.error}</span></div>}
            {validation.valid && validation.email && <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-500 text-sm"><CheckCircle className="h-4 w-4" /><span>Valid token for {validation.email}</span></div>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleValidateToken} disabled={!form.apiToken || validateToken.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {validateToken.isPending ? 'Validating...' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {step === 'account' && (
          <div className="space-y-4">
            {validation.valid && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" /> Token verified
              </div>
            )}
            {zones.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium">Select Account (required for tunnels)</label>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {zones.map(zone => (
                    <button key={zone.id} onClick={() => setForm({ ...form, accountId: zone.id })} className={`w-full rounded-lg border p-3 text-left text-sm ${form.accountId === zone.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
                      <div className="font-medium">{zone.name}</div>
                      <div className="text-xs text-muted-foreground">{zone.status}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setStep('token')} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Back</button>
              <button onClick={handleSubmit} disabled={!form.apiToken || setConfig.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {setConfig.isPending ? 'Saving...' : 'Connect'}
              </button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-muted-foreground">Connecting your Cloudflare account...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Top-Level Tab Navigation
// ============================================================

function TopTabs({ activeTab, onTabChange, isConnected }: { activeTab: TopTab; onTabChange: (t: TopTab) => void; isConnected: boolean }) {
  const tabs: Array<{ id: TopTab; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: Cloud },
    { id: 'tunnels', label: 'Tunnels', icon: Waypoints },
  ];

  return (
    <div className="flex items-center justify-between gap-4 overflow-x-auto border-b border-border pb-px">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pr-2">
        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
            <CheckCircle className="h-3 w-3" /> Cloudflare Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <XCircle className="h-3 w-3" /> Not Connected
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Overview Section (Dashboard)
// ============================================================

function OverviewSection() {
  const { data: tunnelStatus, isLoading: tunnelLoading } = useTunnelStatus();
  const { data: tunnelRoutes } = useTunnelRoutes();
  const { data: domains } = useDomains();

  if (tunnelLoading) return <LoadingSpinner />;

  const tunnels = tunnelStatus?.tunnels || [];
  const activeTunnel = tunnels.find(t => t.status === 'active');
  const allRoutes = tunnelRoutes || [];

  // Count domains with tunnel routes
  const domainsWithRoutes = domains?.filter(d => 
    allRoutes.some(r => r.hostname === d.name || r.hostname.endsWith(`.${d.name}`))
  ) || [];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`flex items-center gap-4 rounded-xl border p-5 ${
        tunnelStatus?.status === 'active'
          ? 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10'
          : 'border-yellow-200 bg-yellow-50 dark:border-yellow-500/30 dark:bg-yellow-500/10'
      }`}>
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
          tunnelStatus?.status === 'active'
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-yellow-100 dark:bg-yellow-900/30'
        }`}>
          <Radio className={`h-6 w-6 ${
            tunnelStatus?.status === 'active' ? 'text-green-600' : 'text-yellow-600'
          }`} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {tunnelStatus?.status === 'active' ? 'Internet Access: Active' : 'Internet Access: Inactive'}
          </h3>
          <p className="text-sm opacity-80">
            {tunnelStatus?.status === 'active'
              ? `${tunnelStatus.connectionCount} connections to Cloudflare edge • ${allRoutes.length} routes active`
              : 'No active tunnel — services are not exposed to the internet'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${tunnelStatus?.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
        </div>
      </div>

      {/* Domain Management Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Manage DNS, SSL, and redirects for your domains in the Domains section
            </p>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
              Go to <Link to="/sites" className="underline font-medium">Sites</Link> → select a domain → Cloudflare tab to manage domain-specific Cloudflare settings.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Waypoints className="h-5 w-5" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
          label="Tunnels"
          value={tunnels.length}
          subtext={activeTunnel ? `${activeTunnel.name} active` : 'No active tunnel'}
        />
        <StatCard
          icon={<Globe className="h-5 w-5" />}
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600"
          label="Connected Domains"
          value={domainsWithRoutes.length}
          subtext={`of ${domains?.length || 0} domains`}
        />
        <StatCard
          icon={<ArrowRight className="h-5 w-5" />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600"
          label="Routes"
          value={allRoutes.length}
          subtext={allRoutes.filter(r => r.isActive).length + ' active'}
        />
        <StatCard
          icon={<Lock className="h-5 w-5" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600"
          label="SSL Secured"
          value={allRoutes.filter(r => r.noTlsVerify === false).length}
          subtext="routes with TLS"
        />
      </div>

      {/* Two Column: Routes + Connected Domains */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Routes */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground" /> Internet Access Routes
            </h3>
            <span className="text-xs text-muted-foreground">{allRoutes.length} total</span>
          </div>
          <div className="p-4">
            {allRoutes.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No routes configured</p>
                <p className="text-xs text-muted-foreground mt-1">Set up a tunnel to create routes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allRoutes.slice(0, 5).map(route => (
                  <div key={route.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${route.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-sm font-medium">{route.hostname}</p>
                        <p className="text-xs text-muted-foreground">{route.service}</p>
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      route.isActive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {route.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                ))}
                {allRoutes.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{allRoutes.length - 5} more routes
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Connected Domains */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Cloud className="h-4 w-4 text-muted-foreground" /> Connected Domains
            </h3>
            <Link to="/sites" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-4">
            {domainsWithRoutes.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No domains connected via tunnel</p>
                <Link to="/sites" className="mt-1 text-xs text-primary hover:underline">
                  Go to Sites to connect a domain
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {domainsWithRoutes.slice(0, 5).map(domain => (
                  <div key={domain.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/20">
                        <Globe className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{domain.name}</p>
                        <p className="text-xs text-muted-foreground">{domain.documentRoot}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                      <CheckCircle className="h-3 w-3" /> Live
                    </span>
                  </div>
                ))}
                {domainsWithRoutes.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{domainsWithRoutes.length - 5} more domains
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, subtext }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: number; subtext: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

// ============================================================
// Tunnels Section
// ============================================================

function TunnelsSection({ onSetupTunnel }: { onSetupTunnel?: () => void }) {
  const { data: status, isLoading, isError, refetch } = useTunnelStatus();
  const { data: routes } = useTunnelRoutes();
  const { data: domains } = useDomains();
  const toggleRoute = useToggleTunnelRoute();
  const deleteRoute = useDeleteTunnelRoute();
  const addRoute = useAddTunnelRoute();
  const [showSetup, setShowSetup] = useState(false);
  const [showAddRoute, setShowAddRoute] = useState<CloudflareTunnel | null>(null);
  const [showEditRoute, setShowEditRoute] = useState<TunnelRoute | null>(null);
  const [showConfig, setShowConfig] = useState<CloudflareTunnel | null>(null);
  const [showDeleteTunnel, setShowDeleteTunnel] = useState<CloudflareTunnel | null>(null);
  const [showExposePanel, setShowExposePanel] = useState<CloudflareTunnel | null>(null);

  if (isLoading) return <LoadingSpinner />;

  if (isError) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10">
      <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
      <p className="mt-3 text-red-600 dark:text-red-400">Failed to load tunnel status</p>
      <button onClick={() => refetch()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );

  const tunnels = status?.tunnels || [];
  const activeTunnel = tunnels.find(t => t.status === 'active');

  const handleExposeDomain = (domainName: string) => {
    if (!activeTunnel) return;
    const domain = domains?.find(d => d.name === domainName);
    const service = domain?.sslEnabled ? 'https://localhost:443' : 'http://localhost:80';
    const noTlsVerify = domain?.sslEnabled ?? false;
    addRoute.mutate(
      { tunnelId: activeTunnel.id, hostname: domainName, service, noTlsVerify, domainId: domain?.id },
      { onError: (error: any) => toast.error(error.message || 'Failed to expose domain') },
    );
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center gap-2">
        {activeTunnel && (
          <button onClick={() => setShowExposePanel(activeTunnel)} className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10">
            <Zap className="h-4 w-4" /> Expose Panel
          </button>
        )}
        <button onClick={() => setShowSetup(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Setup Tunnel
        </button>
      </div>

      {/* Tunnel Status Summary */}
      {tunnels.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            status?.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            <Radio className={`h-5 w-5 ${status?.status === 'active' ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div className="flex-1">
            <p className="font-medium">{status?.status === 'active' ? 'Tunnel Running' : 'Tunnel Stopped'}</p>
            <p className="text-sm text-muted-foreground">
              {status?.status === 'active'
                ? `${status.connectionCount} edge connections • ${routes?.length || 0} routes`
                : 'Start the tunnel to expose services'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tunnels.map(t => (
              <span key={t.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                t.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${t.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tunnels.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="No tunnels configured"
          description="Create a Cloudflare tunnel to securely expose your local services to the internet without opening any ports."
          action={
            <button onClick={() => setShowSetup(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Setup Tunnel
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tunnels.map(tunnel => (
            <TunnelCard
              key={tunnel.id}
              tunnel={tunnel}
              routes={routes?.filter(r => r.tunnelId === tunnel.id) || []}
              onAddRoute={() => setShowAddRoute(tunnel)}
              onToggle={(routeId) => toggleRoute.mutate(routeId, { onError: (error: any) => toast.error(error.message || 'Failed to toggle route') })}
              onDelete={(routeId) => deleteRoute.mutate(routeId, { onError: (error: any) => toast.error(error.message || 'Failed to delete route') })}
              onEditRoute={(route) => setShowEditRoute(route)}
              onShowConfig={() => setShowConfig(tunnel)}
              onDeleteTunnel={() => setShowDeleteTunnel(tunnel)}
            />
          ))}
        </div>
      )}

      {/* Quick Expose Domains */}
      {activeTunnel && domains && domains.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Quick Expose Domains</h3>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Create tunnel routes for your domains with one click via tunnel <span className="font-medium">{activeTunnel.name}</span>.
            </p>
            {domains.map((domain) => {
              const existingRoute = routes?.find(r => r.hostname === domain.name);
              return (
                <div key={domain.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{domain.name}</p>
                      <p className="text-xs text-muted-foreground">{domain.documentRoot}</p>
                    </div>
                  </div>
                  {existingRoute ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
                      <CheckCircle className="h-3 w-3" /> Exposed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleExposeDomain(domain.name)}
                      disabled={addRoute.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Expose
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showSetup && <CloudflareSetupModal onClose={() => { setShowSetup(false); refetch(); }} />}
      {showAddRoute && <AddRouteModal tunnel={showAddRoute} onClose={() => setShowAddRoute(null)} />}
      {showEditRoute && <EditRouteModal route={showEditRoute} onClose={() => setShowEditRoute(null)} />}
      {showConfig && <ConfigPreviewModal tunnel={showConfig} onClose={() => setShowConfig(null)} />}
      {showDeleteTunnel && <DeleteTunnelModal tunnel={showDeleteTunnel} onClose={() => setShowDeleteTunnel(null)} />}
      {showExposePanel && <ExposePanelModal tunnel={showExposePanel} onClose={() => setShowExposePanel(null)} />}
    </div>
  );
}

// ============================================================
// Tunnel Card
// ============================================================

function TunnelCard({
  tunnel,
  routes,
  onAddRoute,
  onToggle,
  onDelete,
  onEditRoute,
  onShowConfig,
  onDeleteTunnel,
}: {
  tunnel: CloudflareTunnel;
  routes: TunnelRoute[];
  onAddRoute: () => void;
  onToggle: (routeId: string) => void;
  onDelete: (routeId: string) => void;
  onEditRoute: (route: TunnelRoute) => void;
  onShowConfig: () => void;
  onDeleteTunnel: () => void;
}) {
  const startTunnel = useStartTunnel();
  const stopTunnel = useStopTunnel();
  const [showRoutes, setShowRoutes] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Tunnel Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            tunnel.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            <Waypoints className={`h-5 w-5 ${tunnel.status === 'active' ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <p className="font-medium">{tunnel.name}</p>
            <p className="text-xs text-muted-foreground">
              {tunnel.status === 'active' ? 'Running' : 'Stopped'} • {routes.length} routes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            tunnel.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${tunnel.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
            {tunnel.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Routes Section */}
      <div className="border-b border-border">
        <button
          onClick={() => setShowRoutes(!showRoutes)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-accent/50"
        >
          <span className="font-medium">Routes ({routes.length})</span>
          <span className="text-xs text-muted-foreground">{showRoutes ? '▲' : '▼'}</span>
        </button>
        {showRoutes && (
          <div className="border-t border-border">
            {routes.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No routes configured
              </div>
            ) : (
              <div className="divide-y divide-border">
                {routes.map(route => (
                  <div key={route.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 rounded-full ${route.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{route.hostname}</p>
                        <p className="text-xs text-muted-foreground truncate">{route.service}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggle(route.id)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground"
                        title={route.isActive ? 'Disable' : 'Enable'}
                      >
                        {route.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => onEditRoute(route)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(route.id)}
                        className="rounded p-1 hover:bg-destructive/10 text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-3">
        {tunnel.status === 'active' ? (
          <button
            onClick={() => stopTunnel.mutate(undefined, { onError: (e: any) => toast.error(e.message) })}
            disabled={stopTunnel.isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
        ) : (
          <button
            onClick={() => startTunnel.mutate(undefined, { onError: (e: any) => toast.error(e.message) })}
            disabled={startTunnel.isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Start
          </button>
        )}
        <button
          onClick={onAddRoute}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Route
        </button>
        <button
          onClick={onShowConfig}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-accent"
          title="View Config"
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDeleteTunnel}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-destructive/10 text-destructive"
          title="Delete Tunnel"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Add Route Modal
// ============================================================

function AddRouteModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const addRoute = useAddTunnelRoute();
  const [form, setForm] = useState({ hostname: '', service: 'http://localhost:8080', noTlsVerify: false });

  const presets = [
    { label: 'HTTP', value: 'http://localhost:80' },
    { label: 'HTTPS', value: 'https://localhost:443' },
    { label: 'Custom', value: '' },
  ];

  const handleSubmit = () => {
    addRoute.mutate({ tunnelId: tunnel.id, hostname: form.hostname, service: form.service, noTlsVerify: form.noTlsVerify }, {
      onSuccess: () => { toast.success('Route added successfully'); onClose(); },
      onError: (error: any) => { toast.error(error.message || 'Failed to add route'); },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Make Domain Public</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Your Domain</label>
            <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="ssh.example.com" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Points To</label>
            <p className="mt-0.5 text-xs text-muted-foreground mb-2">Where traffic goes</p>
            <div className="flex gap-2 mb-2">
              {presets.map(p => (
                <button key={p.label} onClick={() => p.value && setForm({ ...form, service: p.value })} className={`rounded px-2 py-1 text-xs ${form.service === p.value ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="http://localhost:8080" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.noTlsVerify} onChange={(e) => setForm({ ...form, noTlsVerify: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Skip TLS verification (for self-signed certs)</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.hostname || !form.service || addRoute.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {addRoute.isPending ? 'Making Public...' : 'Make Public'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Edit Route Modal
// ============================================================

function EditRouteModal({ route, onClose }: { route: TunnelRoute; onClose: () => void }) {
  const editRoute = useEditTunnelRoute();
  const [form, setForm] = useState({ hostname: route.hostname, service: route.service, noTlsVerify: route.noTlsVerify ?? false });

  const handleSubmit = () => {
    editRoute.mutate({ routeId: route.id, hostname: form.hostname, service: form.service, noTlsVerify: form.noTlsVerify }, {
      onSuccess: () => { toast.success('Route updated'); onClose(); },
      onError: (error: any) => { toast.error(error.message || 'Failed to update route'); },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Edit Tunnel Route</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Public Hostname</label>
            <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Points To</label>
            <p className="mt-0.5 text-xs text-muted-foreground mb-2">Where traffic goes</p>
            <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="editNoTls" checked={form.noTlsVerify} onChange={(e) => setForm({ ...form, noTlsVerify: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <label htmlFor="editNoTls" className="text-sm font-medium">Skip TLS verification</label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.hostname || !form.service || editRoute.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {editRoute.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Config Preview Modal
// ============================================================

function ConfigPreviewModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const { data: config, isLoading } = useTunnelConfig(tunnel.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tunnel Configuration</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        {isLoading ? <LoadingSpinner /> : (
          <div className="rounded-lg bg-muted p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{config || 'No configuration available'}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Delete Tunnel Modal
// ============================================================

function DeleteTunnelModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const deleteTunnel = useDeleteTunnel();

  const handleDelete = () => {
    deleteTunnel.mutate(tunnel.id, {
      onSuccess: () => { toast.success('Tunnel deleted'); onClose(); },
      onError: (error: any) => { toast.error(error.message || 'Failed to delete tunnel'); },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Delete Tunnel</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete tunnel <strong>{tunnel.name}</strong>? This will remove all routes associated with this tunnel.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleDelete} disabled={deleteTunnel.isPending} className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
            {deleteTunnel.isPending ? 'Deleting...' : 'Delete Tunnel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Expose Panel Modal
// ============================================================

function ExposePanelModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const addRoute = useAddTunnelRoute();
  const [hostname, setHostname] = useState('');

  const handleExpose = () => {
    if (!hostname) return;
    addRoute.mutate(
      { tunnelId: tunnel.id, hostname, service: 'https://localhost:8732', noTlsVerify: true },
      {
        onSuccess: () => {
          toast.success(`Panel exposed at ${hostname}`);
          onClose();
        },
        onError: (error: any) => toast.error(error.message || 'Failed to expose panel'),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Expose Panel via Tunnel</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Make the NovaPanel control panel accessible through Cloudflare Tunnel at a specific hostname.
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Hostname</label>
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="panel.example.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">The hostname where the panel will be accessible</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleExpose}
            disabled={!hostname || addRoute.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {addRoute.isPending ? 'Exposing...' : 'Expose Panel'}
          </button>
        </div>
      </div>
    </div>
  );
}
