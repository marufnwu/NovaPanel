import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client';
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
  ExternalLink, Zap, Info, ChevronRight, Pause, Play, Mail,
  AlertTriangle, CheckCircle, XCircle, Search, Edit, Save, X,
  Waypoints, ArrowRight, Activity, Square, ToggleLeft, ToggleRight,
  FileText, Settings, Radio,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface LinkedZone {
  id: string;
  domainId: string | null;
  zoneId: string;
  zoneName: string;
  accountId: string | null;
  plan: string | null;
  status: string;
  sslMode: string;
  isPaused: boolean;
  nameservers: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number;
  comment?: string;
}

interface SslSettings {
  sslMode: string;
  alwaysUseHttps: boolean;
  automaticHttpsRewrites: boolean;
  minTlsVersion: string;
  http2: boolean;
  http3: boolean;
  hsts: any;
}

interface RedirectRule {
  id: string;
  ruleId: string | null;
  sourcePattern: string;
  destinationUrl: string;
  redirectType: string;
  isActive: boolean;
}

interface FirewallRule {
  id: string;
  action: string;
  description: string;
  paused: boolean;
  filter: { id: string; expression: string; paused: boolean };
}

type TopTab = 'overview' | 'tunnels' | 'domains';
type DomainTab = 'overview' | 'dns' | 'ssl' | 'settings' | 'firewall' | 'redirects' | 'mail' | 'wildcard';

// ============================================================
// Main Page Component
// ============================================================

export function CloudflarePage() {
  const [activeTab, setActiveTab] = useState<TopTab>('overview');
  const [selectedZone, setSelectedZone] = useState<LinkedZone | null>(null);
  const [domainTab, setDomainTab] = useState<DomainTab>('overview');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Centralized Cloudflare config — loaded once from settings.json on the server
  const { data: cloudflareConfig } = useCloudflareConfig();
  const cfConfig = cloudflareConfig && 'apiToken' in cloudflareConfig ? cloudflareConfig : null;
  const isConnected = !!(cfConfig?.apiToken);

  const handleSelectZone = (zone: LinkedZone) => {
    setSelectedZone(zone);
    setDomainTab('overview');
  };

  const handleBackFromZone = () => {
    setSelectedZone(null);
    setDomainTab('overview');
  };

  // Not yet configured — show unified setup card
  if (!isConnected) {
    return (
      <div>
        <PageHeader title="Cloudflare" description="Manage tunnels, domains, DNS, SSL, and security" />
        <CloudflareSetupCard onSetup={() => setShowSetup(true)} />
        {showSetup && <CloudflareSetupModal onClose={() => setShowSetup(false)} />}
      </div>
    );
  }

  // If a zone is selected, show zone detail (only in domains tab)
  if (selectedZone) {
    return (
      <div>
        <PageHeader title="Cloudflare" description="Manage tunnels, domains, DNS, SSL, and security" />
        <TopTabs activeTab="domains" onTabChange={(t) => { if (t !== 'domains') handleBackFromZone(); setActiveTab(t); }} isConnected={isConnected} onConnectDomain={() => setShowLinkModal(true)} />
        <ZoneDetail zone={selectedZone} onBack={handleBackFromZone} activeTab={domainTab} onTabChange={setDomainTab} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cloudflare" description="Manage tunnels, domains, DNS, SSL, and security" />
      <TopTabs activeTab={activeTab} onTabChange={setActiveTab} isConnected={isConnected} onConnectDomain={() => setShowLinkModal(true)} />
      <div className="mt-4">
        {activeTab === 'overview' && <OverviewSection />}
        {activeTab === 'tunnels' && <TunnelsSection onSetupTunnel={() => setShowSetup(true)} />}
        {activeTab === 'domains' && <DomainsSection onSelectZone={handleSelectZone} />}
      </div>

      {/* Connect Domain: reads token from server-side settings — no token entry needed */}
      {showLinkModal && <LinkZoneModal onClose={() => setShowLinkModal(false)} onLinked={() => setShowLinkModal(false)} />}
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
          Connect your Cloudflare account to manage tunnels, DNS, SSL, firewall, and security from this panel.
        </p>
        <div className="mx-auto max-w-lg grid gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
            </div>
            <h4 className="text-sm font-medium">Get API Token</h4>
            <p className="mt-1 text-xs text-muted-foreground">Create a Cloudflare API token with DNS and SSL permissions</p>
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
            <h4 className="text-sm font-medium">Manage Everything</h4>
            <p className="mt-1 text-xs text-muted-foreground">Control DNS, SSL, firewall, tunnels, and more</p>
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
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);

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

function TopTabs({ activeTab, onTabChange, isConnected, onConnectDomain }: { activeTab: TopTab; onTabChange: (t: TopTab) => void; isConnected: boolean; onConnectDomain?: () => void }) {
  const tabs: Array<{ id: TopTab; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: Cloud },
    { id: 'tunnels', label: 'Tunnels', icon: Waypoints },
    { id: 'domains', label: 'Domains', icon: Globe },
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
        {onConnectDomain && (
          <button onClick={onConnectDomain} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Connect Domain
          </button>
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
  const [zones, setZones] = useState<LinkedZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<LinkedZone[]>('/cloudflare/zones');
        setZones(data || []);
      } catch { /* ignore */ } finally { setZonesLoading(false); }
    })();
  }, []);

  if (tunnelLoading || zonesLoading) return <LoadingSpinner />;

  const tunnels = tunnelStatus?.tunnels || [];
  const activeTunnel = tunnels.find(t => t.status === 'active');
  const allRoutes = tunnelRoutes || [];
  const activeZones = zones.filter(z => !z.isPaused).length;

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
          label="Domains"
          value={zones.length}
          subtext={`${activeZones} active`}
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
          value={zones.filter(z => z.sslMode === 'strict' || z.sslMode === 'full').length}
          subtext={`of ${zones.length} domains`}
        />
      </div>

      {/* Two Column: Routes + Domains */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Routes */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground" /> Internet Access
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

        {/* Linked Domains */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Cloud className="h-4 w-4 text-muted-foreground" /> Linked Domains
            </h3>
            <span className="text-xs text-muted-foreground">{zones.length} total</span>
          </div>
          <div className="p-4">
            {zones.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No domains linked</p>
                <p className="text-xs text-muted-foreground mt-1">Connect a Cloudflare domain to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {zones.map(zone => (
                  <div key={zone.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/20">
                        <Cloud className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{zone.zoneName}</p>
                        <p className="text-xs text-muted-foreground">{zone.plan || 'Free'} plan</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        zone.sslMode === 'strict' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        zone.sslMode === 'full' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>{zone.sslMode}</span>
                    </div>
                  </div>
                ))}
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
// Domains Section (Zone List)
// ============================================================

function DomainsSection({ onSelectZone }: { onSelectZone: (z: LinkedZone) => void }) {
  const [zones, setZones] = useState<LinkedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<LinkedZone[]>('/cloudflare/zones');
      setZones(data || []);
    } catch { toast.error('Failed to load domains'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const handleUnlink = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this domain from Cloudflare management? DNS records will NOT be deleted from Cloudflare.')) return;
    setUnlinking(id);
    try {
      await api.delete(`/cloudflare/zones/${id}`);
      toast.success('Domain removed');
      fetchZones();
    } catch (error: any) { toast.error(error.message || 'Failed to remove domain'); } finally { setUnlinking(null); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setShowLinkModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Connect Domain
        </button>
        <button onClick={fetchZones} className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {zones.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <Cloud className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Connect Cloudflare</h3>
            <p className="mb-6 max-w-lg mx-auto text-sm text-muted-foreground">
              Link your Cloudflare domains to manage DNS, SSL, firewall, and caching from this panel.
            </p>
            <div className="mx-auto max-w-lg grid gap-4 sm:grid-cols-3 text-left">
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <h4 className="text-sm font-medium">Get API Token</h4>
                <p className="mt-1 text-xs text-muted-foreground">Create a Cloudflare API token with DNS and SSL permissions</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">2</span>
                </div>
                <h4 className="text-sm font-medium">Connect Domain</h4>
                <p className="mt-1 text-xs text-muted-foreground">Enter your API token and select which domain to manage</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">3</span>
                </div>
                <h4 className="text-sm font-medium">Manage Everything</h4>
                <p className="mt-1 text-xs text-muted-foreground">Control DNS, SSL, firewall, caching, and redirects</p>
              </div>
            </div>
            <button onClick={() => setShowLinkModal(true)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Connect Your First Domain
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Domain</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-medium">SSL</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Nameservers</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} onClick={() => onSelectZone(zone)} className="cursor-pointer border-b border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/20">
                        <Cloud className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <span className="font-medium">{zone.zoneName}</span>
                        {zone.domainId && <div className="text-xs text-muted-foreground">Connected to local domain</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      zone.plan === 'Pro' || zone.plan === 'Business' || zone.plan === 'Enterprise'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>{zone.plan || 'Free'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      zone.sslMode === 'strict' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      zone.sslMode === 'full' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      zone.sslMode === 'flexible' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>{zone.sslMode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {zone.isPaused ? <Pause className="h-3.5 w-3.5 text-yellow-500" /> : <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                      <span className="text-sm">{zone.isPaused ? 'Paused' : 'Active'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground font-mono max-w-[200px] truncate">
                      {zone.nameservers ? JSON.parse(zone.nameservers).slice(0, 1).join(', ') : '—'}
                      {zone.nameservers && JSON.parse(zone.nameservers).length > 1 && ` +${JSON.parse(zone.nameservers).length - 1}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={(e) => handleUnlink(zone.id, e)} disabled={unlinking === zone.id} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" /> {unlinking === zone.id ? 'Removing...' : 'Unlink'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showLinkModal && <LinkZoneModal onClose={() => setShowLinkModal(false)} onLinked={() => { setShowLinkModal(false); fetchZones(); }} />}
    </div>
  );
}

// ============================================================
// Zone Detail (Sub-page for a linked domain)
// ============================================================

function ZoneDetail({ zone, onBack, activeTab, onTabChange }: {
  zone: LinkedZone; onBack: () => void; activeTab: DomainTab; onTabChange: (t: DomainTab) => void;
}) {
  const tabs: Array<{ id: DomainTab; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'dns', label: 'DNS Records', icon: Server },
    { id: 'ssl', label: 'SSL/TLS', icon: Lock },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'redirects', label: 'Redirects', icon: RefreshCw },
    { id: 'wildcard', label: 'Wildcard', icon: AlertTriangle },
    { id: 'mail', label: 'Mail DNS', icon: Mail },
  ];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">← Back to Domains</button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{zone.zoneName}</span>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'overview' && <ZoneOverviewTab zone={zone} />}
        {activeTab === 'dns' && <DnsTab zoneDbId={zone.id} />}
        {activeTab === 'ssl' && <SslTab zoneDbId={zone.id} />}
        {activeTab === 'settings' && <SettingsTab zoneDbId={zone.id} />}
        {activeTab === 'firewall' && <FirewallTab zoneDbId={zone.id} />}
        {activeTab === 'redirects' && <RedirectsTab zoneDbId={zone.id} />}
        {activeTab === 'wildcard' && <WildcardTab zoneDbId={zone.id} zoneName={zone.zoneName} />}
        {activeTab === 'mail' && <MailTab zoneDbId={zone.id} />}
      </div>
    </div>
  );
}

// ============================================================
// Zone Overview Tab
// ============================================================

function ZoneOverviewTab({ zone }: { zone: LinkedZone }) {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: tunnelRoutes, isLoading: routesLoading } = useTunnelRoutes();
  const { data: tunnelStatus } = useTunnelStatus();

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/cloudflare/zones/${zone.id}/overview`);
        setOverview(data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [zone.id]);

  if (loading) return <LoadingSpinner />;

  const matchingRoutes = (tunnelRoutes || []).filter(
    (r) => r.hostname === zone.zoneName || r.hostname.endsWith(`.${zone.zoneName}`)
  );
  const isActive = tunnelStatus?.status === 'active';

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${
        zone.isPaused
          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-500/30 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
          : 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10 text-green-700 dark:text-green-400'
      }`}>
        {zone.isPaused ? <Pause className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
        <div>
          <div className="font-medium">{zone.isPaused ? 'Cloudflare Paused' : 'Cloudflare Active'}</div>
          <div className="text-sm opacity-80">{zone.isPaused ? 'DNS only mode — traffic is not proxied' : `"${zone.zoneName}" is active and protected`}</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{overview?.dnsRecordCount || 0}</div>
          <div className="text-xs text-muted-foreground">DNS Records</div>
        </div>
        <div className="rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{overview?.pageRuleCount || 0}</div>
          <div className="text-xs text-muted-foreground">Page Rules</div>
        </div>
        <div className="rounded-xl border border-border p-4 text-center">
          <div className={`text-sm font-bold capitalize ${
            overview?.sslMode === 'strict' ? 'text-green-600' :
            overview?.sslMode === 'full' ? 'text-blue-600' :
            overview?.sslMode === 'flexible' ? 'text-yellow-600' : 'text-red-600'
          }`}>{overview?.sslMode || 'unknown'}</div>
          <div className="text-xs text-muted-foreground">SSL Mode</div>
        </div>
        <div className="rounded-xl border border-border p-4 text-center">
          <div className="text-sm font-bold">{overview?.plan || 'Free'}</div>
          <div className="text-xs text-muted-foreground">Plan</div>
        </div>
      </div>

      {/* Details + Nameservers */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 font-semibold">Domain Details</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Zone ID</dt><dd className="font-mono text-xs bg-muted/50 rounded px-2 py-0.5">{overview?.zoneId || zone.zoneId}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{overview?.status || zone.status}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd>{overview?.plan || zone.plan || 'Free'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{overview?.createdAt ? new Date(overview.createdAt).toLocaleDateString() : '—'}</dd></div>
            {zone.domainId && <div className="flex justify-between"><dt className="text-muted-foreground">Linked Domain</dt><dd className="text-primary">Yes</dd></div>}
          </dl>
        </div>
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 font-semibold">Nameservers</h3>
          <div className="space-y-1.5">
            {(overview?.nameservers || []).map((ns: string) => (
              <div key={ns} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{ns}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 font-semibold">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={async () => {
            try { await api.post(`/cloudflare/zones/${zone.id}/cache/purge`, { purgeEverything: true }); toast.success('Cache purged'); }
            catch (e: any) { toast.error(e.message || 'Failed to purge cache'); }
          }} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
            <RefreshCw className="h-4 w-4" /> Purge Cache
          </button>
          <button onClick={async () => {
            const action = zone.isPaused ? 'unpause' : 'pause';
            try { await api.post(`/cloudflare/zones/${zone.id}/${action}`); toast.success(`Cloudflare ${action}d`); }
            catch (e: any) { toast.error(e.message); }
          }} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
            {zone.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {zone.isPaused ? 'Enable Proxy' : 'Disable Proxy'}
          </button>
          <VerifyButton zoneDbId={zone.id} zoneName={zone.zoneName} />
        </div>
      </div>

      {/* Tunnel Routes for this domain */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-muted-foreground" /> Tunnel Routes
          </h3>
        </div>
        {routesLoading ? <LoadingSpinner /> : matchingRoutes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tunnel routes found for this domain.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Tunnel {isActive ? 'Connected' : 'Disconnected'}</span>
            </div>
            {matchingRoutes.map((route) => (
              <div key={route.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                <div>
                  <p className="text-sm font-medium">{route.hostname}</p>
                  <p className="text-xs text-muted-foreground">{route.service}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  route.isActive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                }`}>{route.isActive ? 'Active' : 'Disabled'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DNS Tab
// ============================================================

function DnsTab({ zoneDbId }: { zoneDbId: string }) {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ records: DnsRecord[]; total_count: number }>(`/cloudflare/zones/${zoneDbId}/dns`);
      setRecords(data?.records || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [zoneDbId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = filter ? records.filter(r =>
    r.type.toLowerCase().includes(filter.toLowerCase()) ||
    r.name.toLowerCase().includes(filter.toLowerCase()) ||
    r.content.toLowerCase().includes(filter.toLowerCase())
  ) : records;

  const handleDelete = async (recordId: string) => {
    if (!confirm('Delete this DNS record?')) return;
    try { await api.delete(`/cloudflare/zones/${zoneDbId}/dns/${recordId}`); toast.success('DNS record deleted'); fetchRecords(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter records..." className="rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm" />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} records</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Record
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Content</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Proxied</th>
                <th className="px-4 py-3 text-left text-xs font-medium">TTL</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-b border-border hover:bg-accent/50">
                  <td className="px-4 py-2"><span className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{record.type}</span></td>
                  <td className="px-4 py-2 text-sm font-medium">{record.name}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">{record.content}</td>
                  <td className="px-4 py-2">{record.proxied ? <CheckCircle className="h-4 w-4 text-orange-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{record.ttl === 1 ? 'Auto' : `${record.ttl}s`}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(record.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && <CreateDnsRecordModal zoneDbId={zoneDbId} onClose={() => setShowCreate(false)} onCreated={fetchRecords} />}
    </div>
  );
}

function CreateDnsRecordModal({ zoneDbId, onClose, onCreated }: { zoneDbId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ type: 'A', name: '', content: '', proxied: false, ttl: 1, priority: undefined as number | undefined });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/cloudflare/zones/${zoneDbId}/dns`, form);
      toast.success('DNS record created');
      onCreated(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">Add DNS Record</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="@ or subdomain" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Content</label>
          <input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="IP address or hostname" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        {(form.type === 'A' || form.type === 'AAAA' || form.type === 'CNAME') && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.proxied} onChange={e => setForm({ ...form, proxied: e.target.checked })} className="rounded" /> Proxied through Cloudflare
          </label>
        )}
        {form.type === 'MX' && (
          <div>
            <label className="mb-1 block text-sm font-medium">Priority</label>
            <input type="number" value={form.priority || 10} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// SSL Tab
// ============================================================

function SslTab({ zoneDbId }: { zoneDbId: string }) {
  const [settings, setSettings] = useState<SslSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try { const data = await api.get<SslSettings>(`/cloudflare/zones/${zoneDbId}/ssl`); setSettings(data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [zoneDbId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try { await api.put(`/cloudflare/zones/${zoneDbId}/ssl`, settings); toast.success('SSL settings updated'); }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">SSL/TLS Encryption</h3>
        <div>
          <label className="mb-2 block text-sm font-medium">SSL Mode</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['off', 'flexible', 'full', 'strict'] as const).map(mode => (
              <button key={mode} onClick={() => setSettings({ ...settings!, sslMode: mode })} className={`rounded-lg border p-3 text-center text-sm transition-colors ${
                settings?.sslMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent'
              }`}>
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
          <ToggleSetting label="Always Use HTTPS" description="Redirect HTTP to HTTPS at edge" checked={settings?.alwaysUseHttps ?? false} onChange={v => setSettings({ ...settings!, alwaysUseHttps: v })} />
          <ToggleSetting label="Automatic HTTPS Rewrites" description="Rewrite HTTP links to HTTPS" checked={settings?.automaticHttpsRewrites ?? false} onChange={v => setSettings({ ...settings!, automaticHttpsRewrites: v })} />
          <ToggleSetting label="HTTP/2" checked={settings?.http2 ?? true} onChange={v => setSettings({ ...settings!, http2: v })} />
          <ToggleSetting label="HTTP/3 (QUIC)" checked={settings?.http3 ?? true} onChange={v => setSettings({ ...settings!, http3: v })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Minimum TLS Version</label>
          <select value={settings?.minTlsVersion || '1.2'} onChange={e => setSettings({ ...settings!, minTlsVersion: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {['1.0', '1.1', '1.2', '1.3'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save SSL Settings'}
        </button>
      </div>
      <div className="rounded-xl border border-border p-5 space-y-3">
        <h3 className="font-semibold">Origin CA Certificate</h3>
        <p className="text-sm text-muted-foreground">Generate a free Cloudflare Origin CA certificate for your server.</p>
        <button onClick={async () => {
          try { await api.post(`/cloudflare/zones/${zoneDbId}/ssl/origin-cert`, { hostnames: ['*'], validityDays: 5475 }); toast.success('Origin CA certificate generated'); }
          catch (e: any) { toast.error(e.message); }
        }} className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">
          <Lock className="h-4 w-4" /> Generate Origin Certificate
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Settings Tab
// ============================================================

function SettingsTab({ zoneDbId }: { zoneDbId: string }) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { const data = await api.get(`/cloudflare/zones/${zoneDbId}/settings`); setSettings(data); }
      catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [zoneDbId]);

  const handleSave = async () => {
    setSaving(true);
    try { await api.put(`/cloudflare/zones/${zoneDbId}/ssl`, settings); toast.success('Settings saved'); }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">Domain Settings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleSetting label="Email Obfuscation" description="Protect email addresses from scrapers" checked={settings?.emailObfuscation ?? true} onChange={v => setSettings({ ...settings, emailObfuscation: v })} />
          <ToggleSetting label="Hotlink Protection" description="Prevent other sites from using your images" checked={settings?.hotlinkProtection ?? false} onChange={v => setSettings({ ...settings, hotlinkProtection: v })} />
          <ToggleSetting label="Development Mode" description="Bypass cache for 3 hours" checked={settings?.developmentMode ?? false} onChange={v => setSettings({ ...settings, developmentMode: v })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Browser Cache TTL</label>
          <select value={settings?.browserCacheTtl || 14400} onChange={e => setSettings({ ...settings, browserCacheTtl: parseInt(e.target.value) })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value={0}>No cache</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={7200}>2 hours</option>
            <option value={14400}>4 hours</option>
            <option value={86400}>1 day</option>
            <option value={604800}>1 week</option>
            <option value={2678400}>1 month</option>
          </select>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Firewall Tab
// ============================================================

function FirewallTab({ zoneDbId }: { zoneDbId: string }) {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try { const data = await api.get<FirewallRule[]>(`/cloudflare/zones/${zoneDbId}/firewall`); setRules(data || []); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [zoneDbId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this firewall rule?')) return;
    try { await api.delete(`/cloudflare/zones/${zoneDbId}/firewall/${ruleId}`); toast.success('Rule deleted'); fetchRules(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>
      {loading ? <LoadingSpinner /> : rules.length === 0 ? (
        <EmptyState icon={Shield} title="No firewall rules" description="Add firewall rules to control access to your site." />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
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
                  <td className="px-4 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    rule.action === 'block' ? 'bg-red-100 text-red-700' :
                    rule.action === 'allow' ? 'bg-green-100 text-green-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{rule.action}</span></td>
                  <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">{rule.filter?.expression}</td>
                  <td className="px-4 py-2 text-sm">{rule.description}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(rule.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && <CreateFirewallRuleModal zoneDbId={zoneDbId} onClose={() => setShowCreate(false)} onCreated={fetchRules} />}
    </div>
  );
}

function CreateFirewallRuleModal({ zoneDbId, onClose, onCreated }: { zoneDbId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ action: 'block', expression: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try { await api.post(`/cloudflare/zones/${zoneDbId}/firewall`, form); toast.success('Firewall rule created'); onCreated(); onClose(); }
    catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">Add Firewall Rule</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Action</label>
          <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="block">Block</option><option value="allow">Allow</option><option value="challenge">Challenge (CAPTCHA)</option><option value="js_challenge">JS Challenge</option><option value="log">Log</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Expression</label>
          <input value={form.expression} onChange={e => setForm({ ...form, expression: e.target.value })} placeholder='e.g. (ip.src eq 192.168.1.1)' className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">Uses Cloudflare Wirefilter expression language</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Block bad IPs" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Redirects Tab
// ============================================================

function RedirectsTab({ zoneDbId }: { zoneDbId: string }) {
  const [rules, setRules] = useState<RedirectRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try { const data = await api.get<RedirectRule[]>(`/cloudflare/zones/${zoneDbId}/redirects`); setRules(data || []); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [zoneDbId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this redirect rule?')) return;
    try { await api.delete(`/cloudflare/zones/${zoneDbId}/redirects/${ruleId}`); toast.success('Redirect deleted'); fetchRules(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Redirect
        </button>
      </div>
      {loading ? <LoadingSpinner /> : rules.length === 0 ? (
        <EmptyState icon={RefreshCw} title="No redirect rules" description="Add redirect rules to forward URLs." />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
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
                  <td className="px-4 py-2"><span className="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{rule.redirectType}</span></td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(rule.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && <CreateRedirectModal zoneDbId={zoneDbId} onClose={() => setShowCreate(false)} onCreated={fetchRules} />}
    </div>
  );
}

function CreateRedirectModal({ zoneDbId, onClose, onCreated }: { zoneDbId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ sourcePattern: '', destinationUrl: '', redirectType: '301' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try { await api.post(`/cloudflare/zones/${zoneDbId}/redirects`, form); toast.success('Redirect rule created'); onCreated(); onClose(); }
    catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">Add Redirect Rule</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Source Pattern</label>
          <input value={form.sourcePattern} onChange={e => setForm({ ...form, sourcePattern: e.target.value })} placeholder="www.example.com/*" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Destination URL</label>
          <input value={form.destinationUrl} onChange={e => setForm({ ...form, destinationUrl: e.target.value })} placeholder="https://example.com/$1" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select value={form.redirectType} onChange={e => setForm({ ...form, redirectType: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="301">301 (Permanent)</option>
            <option value="302">302 (Temporary)</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Mail Tab
// ============================================================

function MailTab({ zoneDbId }: { zoneDbId: string }) {
  const [applying, setApplying] = useState<string | null>(null);

  const providers = [
    { id: 'google', name: 'Google Workspace', description: 'Gmail for business', records: '5 MX + SPF' },
    { id: 'microsoft', name: 'Microsoft 365', description: 'Outlook for business', records: 'MX + SPF + CNAME + SRV' },
    { id: 'zoho', name: 'Zoho Mail', description: 'Free business email', records: '2 MX + SPF + CNAME' },
  ];

  const handleApply = async (provider: string) => {
    if (!confirm(`Apply ${provider} mail DNS records?`)) return;
    setApplying(provider);
    try {
      const result = await api.post<{ applied: number }>(`/cloudflare/zones/${zoneDbId}/mail-preset`, { provider });
      toast.success(`${provider} mail records applied (${result?.applied || 0} records)`);
    } catch (e: any) { toast.error(e.message); } finally { setApplying(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-5">
        <h3 className="mb-2 font-semibold">Mail DNS Presets</h3>
        <p className="mb-4 text-sm text-muted-foreground">Automatically configure DNS records for external mail providers.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h4 className="font-medium">{provider.name}</h4>
              </div>
              <p className="text-sm text-muted-foreground">{provider.description}</p>
              <p className="text-xs text-muted-foreground">Records: {provider.records}</p>
              <button onClick={() => handleApply(provider.id)} disabled={applying === provider.id} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {applying === provider.id ? 'Applying...' : 'Apply Preset'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Verify Button
// ============================================================

function VerifyButton({ zoneDbId, zoneName }: { zoneDbId: string; zoneName: string }) {
  const [verifying, setVerifying] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try { const data = await api.get<any>(`/cloudflare/zones/${zoneDbId}/verify-full`); setResults(data); }
    catch (e: any) { toast.error(e.message || 'Verification failed'); } finally { setVerifying(false); }
  };

  return (
    <>
      <button onClick={handleVerify} disabled={verifying} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
        {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        {verifying ? 'Verifying...' : 'Verify Setup'}
      </button>
      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResults(null)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Verification: {zoneName}</h3>
              <button onClick={() => setResults(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {Object.entries(results.checks || {}).map(([key, check]: [string, any]) => (
                <div key={key} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  {check.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                  <div>
                    <div className="text-sm font-medium capitalize">{key === 'http' ? 'HTTP Reachability' : key === 'dns' ? 'DNS Configuration' : key === 'tunnel' ? 'Tunnel Route' : key === 'ssl' ? 'SSL/TLS' : 'Domain Status'}</div>
                    <div className="text-xs text-muted-foreground">{check.details}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border p-3 text-center text-sm font-medium">
              {results.healthy
                ? <span className="text-green-600">✅ All checks passed</span>
                : <span className="text-amber-600">⚠️ Some checks need attention</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Wildcard Tab
// ============================================================

function WildcardTab({ zoneDbId, zoneName }: { zoneDbId: string; zoneName: string }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try { const data = await api.get<any>(`/cloudflare/zones/${zoneDbId}/wildcard`); setStatus(data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [zoneDbId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (status?.enabled) {
        await api.post(`/cloudflare/zones/${zoneDbId}/wildcard/disable`);
        toast.success('Wildcard subdomain disabled');
      } else {
        await api.post(`/cloudflare/zones/${zoneDbId}/wildcard/enable`, { domainId: '' });
        toast.success('Wildcard subdomain enabled');
      }
      fetchStatus();
    } catch (e: any) { toast.error(e.message || 'Failed to toggle wildcard'); } finally { setToggling(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Wildcard Subdomain</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enable <code className="rounded bg-muted px-1 py-0.5 text-xs">*.{zoneName}</code> to route all subdomains through Cloudflare Tunnel.
            </p>
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            status?.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
          }`}>
            {status?.enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {status?.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {!status?.canEnable && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-sm">
                <strong>Paid Plan Required</strong>
                <p className="mt-1 text-amber-700 dark:text-amber-300">Wildcard DNS proxying requires Cloudflare Pro plan or higher.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">DNS Record</div>
            <div className="mt-1 flex items-center gap-2">
              {status?.dnsRecord ? <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm">CNAME *.{zoneName} → tunnel</span></> : <><XCircle className="h-4 w-4 text-red-500" /><span className="text-sm">No wildcard CNAME</span></>}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">Tunnel Route</div>
            <div className="mt-1 flex items-center gap-2">
              {status?.tunnelRoute ? <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm">Route *.{zoneName} → localhost:80</span></> : <><XCircle className="h-4 w-4 text-red-500" /><span className="text-sm">No wildcard route</span></>}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button onClick={handleToggle} disabled={toggling || !status?.canEnable} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            status?.enabled ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-50`}>
            {toggling && <RefreshCw className="h-4 w-4 animate-spin" />}
            {status?.enabled ? 'Disable Wildcard' : 'Enable Wildcard'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Connect Domain Modal
// ============================================================

function LinkZoneModal({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  const { data: cloudflareConfig } = useCloudflareConfig();
  const cfConfig = cloudflareConfig && 'apiToken' in cloudflareConfig ? cloudflareConfig : null;
  const [step, setStep] = useState<'select' | 'linking'>('select');
  const [cfZones, setCfZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneFilter, setZoneFilter] = useState('');

  // Auto-load zones from server-stored token
  useEffect(() => {
    if (cfConfig?.apiToken) {
      (async () => {
        setLoading(true);
        try {
          const data = await api.post<{ zones: any[] }>('/cloudflare/zones/list', { apiToken: cfConfig.apiToken });
          setCfZones(data?.zones || []);
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
      })();
    }
  }, [cfConfig]);

  const handleLink = async (zone: any) => {
    setStep('linking');
    try {
      await api.post('/cloudflare/zones/link', { zoneId: zone.id, apiToken: cfConfig?.apiToken });
      toast.success(`"${zone.name}" connected successfully!`);
      onLinked();
    } catch (e: any) { toast.error(e.message); setStep('select'); }
  };

  const filteredZones = zoneFilter ? cfZones.filter(z => z.name.toLowerCase().includes(zoneFilter.toLowerCase())) : cfZones;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect Cloudflare Domain</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent text-muted-foreground">✕</button>
        </div>

        {step === 'select' && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center py-8">
                <LoadingSpinner />
                <span className="mt-3 text-sm text-muted-foreground">Loading your domains...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Using saved API token • {cfZones.length} domain{cfZones.length !== 1 ? 's' : ''} found</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} placeholder="Filter domains..." className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm" />
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {filteredZones.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No domains match</p>
                  ) : (
                    filteredZones.map((z) => (
                      <button key={z.id} onClick={() => handleLink(z)} className="w-full rounded-lg border border-input p-4 text-left hover:bg-accent hover:border-primary/50 transition-all group">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium group-hover:text-primary">{z.name}</div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${
                                z.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700'
                              }`}>{z.status}</span>
                              <span>{z.plan?.name || 'Free'} plan</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="flex justify-end">
                  <span className="text-xs text-muted-foreground">{filteredZones.length} of {cfZones.length} domains</span>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'linking' && (
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner />
            <span className="mt-3 text-sm">Connecting domain...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Toggle Setting Component
// ============================================================

function ToggleSetting({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer hover:bg-accent/50">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 rounded" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </label>
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
        <div className="mb-4">
          <h2 className="mb-2 text-lg font-semibold">Delete Tunnel</h2>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete tunnel <span className="font-medium">{tunnel.name}</span>? This cannot be undone.</p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleDelete} disabled={deleteTunnel.isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
            {deleteTunnel.isPending ? 'Deleting...' : 'Delete'}
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

  const handleSubmit = () => {
    if (!hostname.trim()) return;
    addRoute.mutate({ tunnelId: tunnel.id, hostname, service: 'http://localhost:8443' }, {
      onSuccess: () => { toast.success('Panel exposed successfully'); onClose(); },
      onError: (error: any) => { toast.error(error.message || 'Failed to expose panel'); },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Expose Panel via Tunnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a route to expose the NovaPanel web interface.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Public Hostname</label>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="panel.example.com" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Routes to <span className="font-mono">localhost:8443</span></p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={!hostname.trim() || addRoute.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <ExternalLink className="h-4 w-4" /> {addRoute.isPending ? 'Creating...' : 'Expose Panel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sync Routes Button
// ============================================================

function SyncRoutesButton({ tunnelId }: { tunnelId: string }) {
  const syncRoutes = useSyncTunnelRoutes();

  const handleSync = () => {
    syncRoutes.mutate(tunnelId, {
      onSuccess: (data) => { if (data.synced > 0) toast.success(`Synced ${data.synced} route(s)`); else toast.info('Routes already in sync'); },
      onError: (error: any) => toast.error(error.message || 'Failed to sync routes'),
    });
  };

  return (
    <button onClick={handleSync} disabled={syncRoutes.isPending} className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs hover:bg-accent/80 disabled:opacity-50" title="Sync routes from Cloudflare">
      <RefreshCw className={`h-3 w-3 ${syncRoutes.isPending ? 'animate-spin' : ''}`} /> Sync
    </button>
  );
}

// ============================================================
// Tunnel Card
// ============================================================

function TunnelCard({ tunnel, routes, onAddRoute, onToggle, onDelete, onEditRoute, onShowConfig, onDeleteTunnel }: {
  tunnel: CloudflareTunnel; routes: TunnelRoute[];
  onAddRoute: () => void; onToggle: (routeId: string) => void; onDelete: (routeId: string) => void;
  onEditRoute: (route: TunnelRoute) => void; onShowConfig: () => void; onDeleteTunnel: () => void;
}) {
  const start = useStartTunnel();
  const stop = useStopTunnel();
  const { data: tunnelInfo } = useTunnelInfo(tunnel.id);
  const { logs, isConnected: logsConnected, error: logsError } = useTunnelLogs(tunnel.id);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isRunning = tunnel.status === 'active';

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Waypoints className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{tunnel.name}</h3>
            <p className="text-xs text-muted-foreground">ID: {tunnel.tunnelId.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <Activity className="h-3 w-3" />
              <span>{tunnelInfo?.connections?.length || 0} conn</span>
            </div>
          )}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isRunning ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
          <button onClick={onShowConfig} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="View config"><FileText className="h-4 w-4" /></button>
          {isRunning ? (
            <button onClick={() => stop.mutate(undefined, { onError: (error: any) => toast.error(error.message) })} disabled={stop.isPending} className="rounded p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50" title="Stop"><Square className="h-4 w-4" /></button>
          ) : (
            <button onClick={() => start.mutate(undefined, { onError: (error: any) => toast.error(error.message) })} disabled={start.isPending} className="rounded p-1.5 text-green-500 hover:bg-green-500/10 disabled:opacity-50" title="Start"><Play className="h-4 w-4" /></button>
          )}
          <button onClick={onDeleteTunnel} className="rounded p-1.5 text-red-500 hover:bg-red-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Routes */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> Internet Access ({routes.length})</h4>
          <div className="flex items-center gap-2">
            <SyncRoutesButton tunnelId={tunnel.id} />
            <button onClick={onAddRoute} disabled={!isRunning} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50">
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </div>

        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No routes configured</p>
        ) : (
          <div className="space-y-2">
            {routes.map(route => (
              <div key={route.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{route.hostname}</p>
                  <p className="text-xs text-muted-foreground truncate">{route.service}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => onEditRoute(route)} className="rounded p-1 text-muted-foreground hover:bg-accent" title="Edit"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => onToggle(route.id)} className={`rounded p-1 ${route.isActive ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-accent'}`} title={route.isActive ? 'Disable' : 'Enable'}>
                    {route.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button onClick={() => onDelete(route.id)} className="rounded p-1 text-red-500 hover:bg-red-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs */}
      {isRunning && (
        <div className="border-t border-border pt-4 px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /> Live Logs</h4>
            <button onClick={() => setShowLogs(!showLogs)} className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs hover:bg-accent/80">{showLogs ? 'Hide' : 'Show'}</button>
          </div>
          {showLogs && (
            <div className="rounded-lg bg-muted p-4">
              {logsError ? (
                <div className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-4 w-4" /><span className="text-sm">{logsError}</span></div>
              ) : (
                <div ref={logsEndRef} className="max-h-48 overflow-y-auto rounded-lg bg-background p-3 font-mono text-xs">
                  {logs.length === 0 ? <p className="text-muted-foreground">Waiting for logs...</p> : logs.map((log, i) => (
                    <div key={i} className="py-0.5">
                      <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span>{log.data}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${logsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{logsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
