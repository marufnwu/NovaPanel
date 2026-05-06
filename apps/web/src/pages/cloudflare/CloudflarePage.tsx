import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { Link } from '@tanstack/react-router';
import { useTunnelRoutes, useTunnelStatus } from '../../api/hooks/tunnel';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../lib/toast';
import {
  Cloud, Plus, Trash2, Globe, Shield, Lock, Server, RefreshCw,
  ExternalLink, Zap, Info, ChevronRight, Pause, Play, Mail,
  AlertTriangle, CheckCircle, XCircle, Search, Edit, Save, X,
  Waypoints, ArrowRight,
} from 'lucide-react';

// --- Types ---

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

type Tab = 'overview' | 'dns' | 'ssl' | 'settings' | 'firewall' | 'redirects' | 'mail' | 'wildcard';

// --- Main Component ---

export function CloudflarePage() {
  const [zones, setZones] = useState<LinkedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<LinkedZone | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showLinkModal, setShowLinkModal] = useState(false);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<LinkedZone[]>('/cloudflare/zones');
      setZones(data || []);
    } catch (error: any) {
      toast.error('Failed to load Cloudflare domains');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Cloudflare" description="Connect your Cloudflare domains to manage DNS, SSL, security, and caching from this panel" />

      {!selectedZone ? (
        <ZoneList
          zones={zones}
          onSelect={setSelectedZone}
          onLink={() => setShowLinkModal(true)}
          onRefresh={fetchZones}
        />
      ) : (
        <ZoneDetail
          zone={selectedZone}
          onBack={() => { setSelectedZone(null); setActiveTab('overview'); }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      {showLinkModal && (
        <LinkZoneModal
          onClose={() => setShowLinkModal(false)}
          onLinked={() => { setShowLinkModal(false); fetchZones(); }}
        />
      )}
    </div>
  );
}

// --- Zone List ---

function ZoneList({ zones, onSelect, onLink, onRefresh }: {
  zones: LinkedZone[];
  onSelect: (z: LinkedZone) => void;
  onLink: () => void;
  onRefresh: () => void;
}) {
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const handleUnlink = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this domain from Cloudflare management? DNS records will NOT be deleted from Cloudflare.')) return;
    setUnlinking(id);
    try {
      await api.delete(`/cloudflare/zones/${id}`);
      toast.success('Domain removed');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove domain');
    } finally {
      setUnlinking(null);
    }
  };

  // Summary stats
  const activeZones = zones.filter(z => !z.isPaused).length;
  const pausedZones = zones.filter(z => z.isPaused).length;
  const strictZones = zones.filter(z => z.sslMode === 'strict' || z.sslMode === 'full').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onLink} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Connect Domain
        </button>
        <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {zones.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <Cloud className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Connect Cloudflare</h3>
            <p className="mb-4 max-w-lg mx-auto text-sm text-muted-foreground">
              Cloudflare provides DNS management, SSL certificates, DDoS protection, and a CDN for your domains. Connect your Cloudflare account to manage everything from this panel.
            </p>
            <div className="mx-auto max-w-lg">
              <div className="grid gap-4 sm:grid-cols-3 text-left">
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
                  </div>
                  <h4 className="text-sm font-medium">Get API Token</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Go to Cloudflare dashboard and create an API token with DNS and SSL permissions</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">2</span>
                  </div>
                  <h4 className="text-sm font-medium">Connect Your Domain</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Enter your API token and select which domain to manage</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">3</span>
                  </div>
                  <h4 className="text-sm font-medium">Manage Everything</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Control DNS, SSL, firewall, caching, redirects, and mail settings</p>
                </div>
              </div>
            </div>
            <button onClick={onLink} className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Connect Your First Domain
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Domains</span>
              </div>
              <div className="mt-1 text-2xl font-bold">{zones.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-green-600">{activeZones}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Pause className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Paused</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-yellow-600">{pausedZones}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Secure SSL</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-600">{strictZones}</div>
            </div>
          </div>

          {/* Domain Table */}
          <div className="rounded-lg border border-border">
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
                  <tr key={zone.id} onClick={() => onSelect(zone)} className="cursor-pointer border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900/20">
                          <Cloud className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                          <span className="font-medium">{zone.zoneName}</span>
                          {zone.domainId && (
                            <div className="text-xs text-muted-foreground">Connected to local domain</div>
                          )}
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
        </>
      )}
    </div>
  );
}

// --- Domain Detail ---

function ZoneDetail({ zone, onBack, activeTab, onTabChange }: {
  zone: LinkedZone;
  onBack: () => void;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'dns', label: 'DNS Records', icon: Server },
    { id: 'ssl', label: 'SSL/TLS', icon: Lock },
    { id: 'settings', label: 'Settings', icon: Zap },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'redirects', label: 'Redirects', icon: RefreshCw },
    { id: 'wildcard', label: 'Wildcard', icon: AlertTriangle },
    { id: 'mail', label: 'Mail DNS', icon: Mail },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Back to Domains</button>
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
        {activeTab === 'overview' && <OverviewTab zone={zone} />}
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

// --- Overview Tab ---

function OverviewTab({ zone }: { zone: LinkedZone }) {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/cloudflare/zones/${zone.id}/overview`);
        setOverview(data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [zone.id]);

  if (loading) return <LoadingSpinner />;

  const statusColor = overview?.status === 'active'
    ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
    : 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`flex items-center gap-3 rounded-lg border p-4 ${statusColor}`}>
        {zone.isPaused ? <Pause className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
        <div>
          <div className="font-medium">{zone.isPaused ? 'Cloudflare Paused' : 'Cloudflare Active'}</div>
          <div className="text-sm opacity-80">{zone.isPaused ? 'DNS only mode — traffic is not protected by Cloudflare' : `"${zone.zoneName}" is active and protected by Cloudflare`}</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold">{overview?.dnsRecordCount || 0}</div>
          <div className="text-xs text-muted-foreground">DNS Records</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold">{overview?.pageRuleCount || 0}</div>
          <div className="text-xs text-muted-foreground">Page Rules</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className={`text-sm font-bold capitalize ${
            overview?.sslMode === 'strict' ? 'text-green-600' :
            overview?.sslMode === 'full' ? 'text-blue-600' :
            overview?.sslMode === 'flexible' ? 'text-yellow-600' : 'text-red-600'
          }`}>{overview?.sslMode || 'unknown'}</div>
          <div className="text-xs text-muted-foreground">SSL Mode</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-sm font-bold">{overview?.plan || 'Free'}</div>
          <div className="text-xs text-muted-foreground">Plan</div>
        </div>
      </div>

      {/* Domain Details + Nameservers */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-3 font-semibold">Domain Details</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Cloudflare Zone ID</dt><dd className="font-mono text-xs bg-muted/50 rounded px-2 py-0.5">{overview?.zoneId || zone.zoneId}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>{overview?.status || zone.status}</span></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd>{overview?.plan || zone.plan}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{overview?.createdAt ? new Date(overview.createdAt).toLocaleDateString() : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Activated</dt><dd>{overview?.activatedAt ? new Date(overview.activatedAt).toLocaleDateString() : '—'}</dd></div>
            {zone.domainId && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Linked Domain</dt><dd className="text-primary">Yes</dd></div>
            )}
          </dl>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-3 font-semibold">Nameservers</h3>
          <div className="space-y-1.5">
            {(overview?.nameservers || []).map((ns: string) => (
              <div key={ns} className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{ns}</span>
              </div>
            ))}
            {(overview?.originalNameservers || []).length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Original Nameservers</p>
                {overview.originalNameservers.map((ns: string) => (
                  <div key={ns} className="flex items-center gap-2 rounded bg-muted/30 px-3 py-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{ns}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 font-semibold">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={async () => {
            try { await api.post(`/cloudflare/zones/${zone.id}/cache/purge`, { purgeEverything: true }); toast.success('Cache purged successfully'); }
            catch (e: any) { toast.error(e.message || 'Failed to purge cache'); }
          }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors">
            <RefreshCw className="h-4 w-4" /> Purge Cache
          </button>
          <button onClick={async () => {
            const action = zone.isPaused ? 'unpause' : 'pause';
            try { await api.post(`/cloudflare/zones/${zone.id}/${action}`); toast.success(`Cloudflare ${action}d`); }
            catch (e: any) { toast.error(e.message); }
          }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors">
            {zone.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {zone.isPaused ? 'Enable Proxy' : 'Disable Proxy'}
          </button>
          <VerifyButton zoneDbId={zone.id} zoneName={zone.zoneName} />
        </div>
      </div>

      {/* Tunnel Status */}
      <TunnelStatusCard zoneName={zone.zoneName} />
    </div>
  );
}

/**
 * Shows tunnel routes that serve this domain, with link to Tunnels page.
 */
function TunnelStatusCard({ zoneName }: { zoneName: string }) {
  const { data: tunnelRoutes, isLoading } = useTunnelRoutes();
  const { data: tunnelStatus } = useTunnelStatus();

  // Find routes matching this domain (exact or subdomain)
  const matchingRoutes = (tunnelRoutes || []).filter(
    (r) => r.hostname === zoneName || r.hostname.endsWith(`.${zoneName}`)
  );

  const isActive = tunnelStatus?.status === 'active';

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-muted-foreground" />
          Tunnel Routes
        </h3>
        <Link
          to="/tunnels"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Manage Tunnels <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : matchingRoutes.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          <p>No tunnel routes found for this domain.</p>
          <Link to="/tunnels" className="text-primary hover:underline text-xs mt-1 inline-block">
            Set up a tunnel →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Tunnel {isActive ? 'Connected' : 'Disconnected'}</span>
          </div>
          {matchingRoutes.map((route) => (
            <div key={route.id} className="flex items-center justify-between rounded-md border border-border p-2">
              <div>
                <p className="text-sm font-medium">{route.hostname}</p>
                <p className="text-xs text-muted-foreground">{route.service}</p>
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                route.isActive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
              }`}>
                {route.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- DNS Tab ---

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
    try {
      await api.delete(`/cloudflare/zones/${zoneDbId}/dns/${recordId}`);
      toast.success('DNS record deleted');
      fetchRecords();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter records..." className="rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm" />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} records</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Record
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-lg border border-border overflow-x-auto">
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

      {showCreate && (
        <CreateDnsRecordModal zoneDbId={zoneDbId} onClose={() => setShowCreate(false)} onCreated={fetchRecords} />
      )}
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
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">Add DNS Record</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="@ or subdomain" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Content</label>
          <input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="IP address or hostname" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        {(form.type === 'A' || form.type === 'AAAA' || form.type === 'CNAME') && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.proxied} onChange={e => setForm({ ...form, proxied: e.target.checked })} className="rounded" /> Proxied through Cloudflare
          </label>
        )}
        {form.type === 'MX' && (
          <div>
            <label className="mb-1 block text-sm font-medium">Priority</label>
            <input type="number" value={form.priority || 10} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- SSL Tab ---

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
    try {
      await api.put(`/cloudflare/zones/${zoneDbId}/ssl`, settings);
      toast.success('SSL settings updated');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="font-semibold">SSL/TLS Encryption</h3>
        <div>
          <label className="mb-2 block text-sm font-medium">SSL Mode</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['off', 'flexible', 'full', 'strict'] as const).map(mode => (
              <button key={mode} onClick={() => setSettings({ ...settings!, sslMode: mode })} className={`rounded-md border p-3 text-center text-sm transition-colors ${
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
          <select value={settings?.minTlsVersion || '1.2'} onChange={e => setSettings({ ...settings!, minTlsVersion: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {['1.0', '1.1', '1.2', '1.3'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save SSL Settings'}
        </button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="font-semibold">Origin CA Certificate</h3>
        <p className="text-sm text-muted-foreground">Generate a free Cloudflare Origin CA certificate for your server. Only works when traffic is proxied through Cloudflare.</p>
        <button onClick={async () => {
          try {
            const result = await api.post(`/cloudflare/zones/${zoneDbId}/ssl/origin-cert`, { hostnames: ['*'], validityDays: 5475 });
            toast.success('Origin CA certificate generated (15 year validity)');
            // In a real implementation, show the cert + key for download
          } catch (e: any) { toast.error(e.message); }
        }} className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">
          <Lock className="h-4 w-4" /> Generate Origin Certificate
        </button>
      </div>
    </div>
  );
}

// --- Settings Tab ---

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
    try {
      await api.put(`/cloudflare/zones/${zoneDbId}/ssl`, settings);
      toast.success('Settings saved');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="font-semibold">Domain Settings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleSetting label="Email Obfuscation" description="Protect email addresses from scrapers" checked={settings?.emailObfuscation ?? true} onChange={v => setSettings({ ...settings, emailObfuscation: v })} />
          <ToggleSetting label="Hotlink Protection" description="Prevent other sites from using your images" checked={settings?.hotlinkProtection ?? false} onChange={v => setSettings({ ...settings, hotlinkProtection: v })} />
          <ToggleSetting label="Development Mode" description="Bypass cache for 3 hours" checked={settings?.developmentMode ?? false} onChange={v => setSettings({ ...settings, developmentMode: v })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Browser Cache TTL</label>
          <select value={settings?.browserCacheTtl || 14400} onChange={e => setSettings({ ...settings, browserCacheTtl: parseInt(e.target.value) })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
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
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// --- Firewall Tab ---

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
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {loading ? <LoadingSpinner /> : rules.length === 0 ? (
        <EmptyState icon={Shield} title="No firewall rules" description="Add firewall rules to control access to your site." />
      ) : (
        <div className="rounded-lg border border-border">
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

      {showCreate && (
        <CreateFirewallRuleModal zoneDbId={zoneDbId} onClose={() => setShowCreate(false)} onCreated={fetchRules} />
      )}
    </div>
  );
}

function CreateFirewallRuleModal({ zoneDbId, onClose, onCreated }: { zoneDbId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ action: 'block', expression: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/cloudflare/zones/${zoneDbId}/firewall`, form);
      toast.success('Firewall rule created');
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">Add Firewall Rule</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Action</label>
          <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="block">Block</option>
            <option value="allow">Allow</option>
            <option value="challenge">Challenge (CAPTCHA)</option>
            <option value="js_challenge">JS Challenge</option>
            <option value="log">Log</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Expression</label>
          <input value={form.expression} onChange={e => setForm({ ...form, expression: e.target.value })} placeholder='e.g. (ip.src eq 192.168.1.1)' className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">Uses Cloudflare Wirefilter expression language</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Block bad IPs" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Redirects Tab ---

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
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Redirect
        </button>
      </div>

      {loading ? <LoadingSpinner /> : rules.length === 0 ? (
        <EmptyState icon={RefreshCw} title="No redirect rules" description="Add redirect rules to forward URLs." />
      ) : (
        <div className="rounded-lg border border-border">
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

      {showCreate && (
        <CreateRedirectModal zoneDbId={zoneDbId} onClose={() => setShowCreate(false)} onCreated={fetchRules} />
      )}
    </div>
  );
}

function CreateRedirectModal({ zoneDbId, onClose, onCreated }: { zoneDbId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ sourcePattern: '', destinationUrl: '', redirectType: '301' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/cloudflare/zones/${zoneDbId}/redirects`, form);
      toast.success('Redirect rule created');
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">Add Redirect Rule</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Source Pattern</label>
          <input value={form.sourcePattern} onChange={e => setForm({ ...form, sourcePattern: e.target.value })} placeholder="www.example.com/*" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Destination URL</label>
          <input value={form.destinationUrl} onChange={e => setForm({ ...form, destinationUrl: e.target.value })} placeholder="https://example.com/$1" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select value={form.redirectType} onChange={e => setForm({ ...form, redirectType: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="301">301 (Permanent)</option>
            <option value="302">302 (Temporary)</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Mail Tab ---

function MailTab({ zoneDbId }: { zoneDbId: string }) {
  const [applying, setApplying] = useState<string | null>(null);

  const providers = [
    { id: 'google', name: 'Google Workspace', description: 'Gmail for business', records: '5 MX + SPF' },
    { id: 'microsoft', name: 'Microsoft 365', description: 'Outlook for business', records: 'MX + SPF + CNAME + SRV' },
    { id: 'zoho', name: 'Zoho Mail', description: 'Free business email', records: '2 MX + SPF + CNAME' },
  ];

  const handleApply = async (provider: string) => {
    if (!confirm(`Apply ${provider} mail DNS records? This will add MX and SPF records to your Cloudflare domain.`)) return;
    setApplying(provider);
    try {
      const result = await api.post<{ applied: number }>(`/cloudflare/zones/${zoneDbId}/mail-preset`, { provider });
      toast.success(`${provider} mail records applied (${result?.applied || 0} records)`);
    } catch (e: any) { toast.error(e.message); } finally { setApplying(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 font-semibold">Mail DNS Presets</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Automatically configure DNS records for external mail providers. Records are created via Cloudflare API.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h4 className="font-medium">{provider.name}</h4>
              </div>
              <p className="text-sm text-muted-foreground">{provider.description}</p>
              <p className="text-xs text-muted-foreground">Records: {provider.records}</p>
              <button onClick={() => handleApply(provider.id)} disabled={applying === provider.id} className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {applying === provider.id ? 'Applying...' : 'Apply Preset'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Verify Button & Modal ---

function VerifyButton({ zoneDbId, zoneName }: { zoneDbId: string; zoneName: string }) {
  const [verifying, setVerifying] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const data = await api.get<any>(`/cloudflare/zones/${zoneDbId}/verify-full`);
      setResults(data);
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <button onClick={handleVerify} disabled={verifying} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
        {verifying ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        {verifying ? 'Verifying...' : 'Verify Setup'}
      </button>
      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResults(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Verification: {zoneName}</h3>
              <button onClick={() => setResults(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {Object.entries(results.checks || {}).map(([key, check]: [string, any]) => (
                <div key={key} className="flex items-start gap-3 rounded-md border border-border p-3">
                  {check.ok
                    ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                  <div>
                    <div className="text-sm font-medium capitalize">{key === 'http' ? 'HTTP Reachability' : key === 'dns' ? 'DNS Configuration' : key === 'tunnel' ? 'Tunnel Route' : key === 'ssl' ? 'SSL/TLS' : 'Domain Status'}</div>
                    <div className="text-xs text-muted-foreground">{check.details}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-border p-3 text-center text-sm font-medium">
              {results.healthy
                ? <span className="text-green-600">✅ All checks passed — domain is fully configured</span>
                : <span className="text-amber-600">⚠️ Some checks need attention</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Wildcard Tab ---

function WildcardTab({ zoneDbId, zoneName }: { zoneDbId: string; zoneName: string }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<any>(`/cloudflare/zones/${zoneDbId}/wildcard`);
      setStatus(data);
    } catch { /* ignore */ } finally { setLoading(false); }
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
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle wildcard');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Wildcard Subdomain</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enable <code className="rounded bg-muted px-1 py-0.5 text-xs">*.{zoneName}</code> to automatically route all subdomains through Cloudflare Tunnel.
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
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-sm">
                <strong className="text-amber-800 dark:text-amber-200">Paid Plan Required</strong>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Wildcard DNS proxying requires a Cloudflare Pro plan or higher. Current plan: <strong>{status?.planName || 'Free'}</strong>.
                  Upgrade your plan in the Cloudflare Dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">DNS Record</div>
            <div className="mt-1 flex items-center gap-2">
              {status?.dnsRecord
                ? <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm">CNAME *.{zoneName} → tunnel</span></>
                : <><XCircle className="h-4 w-4 text-red-500" /><span className="text-sm">No wildcard CNAME</span></>}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">Tunnel Route</div>
            <div className="mt-1 flex items-center gap-2">
              {status?.tunnelRoute
                ? <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm">Route *.{zoneName} → localhost:80</span></>
                : <><XCircle className="h-4 w-4 text-red-500" /><span className="text-sm">No wildcard route</span></>}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleToggle}
            disabled={toggling || !status?.canEnable}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              status?.enabled
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            } disabled:opacity-50`}
          >
            {toggling && <RefreshCw className="h-4 w-4 animate-spin" />}
            {status?.enabled ? 'Disable Wildcard' : 'Enable Wildcard'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h4 className="font-medium">How Wildcard Subdomains Work</h4>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>When enabled, any subdomain request will automatically route through Cloudflare Tunnel:</p>
          <ul className="list-inside list-disc space-y-1 ml-2">
            <li><code className="rounded bg-muted px-1 text-xs">anything.{zoneName}</code> → <code className="rounded bg-muted px-1 text-xs">http://localhost:80</code></li>
            <li>Nginx handles the request based on <code className="rounded bg-muted px-1 text-xs">server_name</code></li>
            <li>Unmatched subdomains get the default server block</li>
            <li>No need to create individual DNS records for each subdomain</li>
          </ul>
          <p className="mt-2 text-amber-600 dark:text-amber-400">
            ⚠️ Note: Requires Cloudflare Pro plan or higher for proxied wildcard DNS.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Connect Domain Modal ---

function LinkZoneModal({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  const [step, setStep] = useState<'token' | 'validating' | 'select' | 'linking'>('token');
  const [apiToken, setApiToken] = useState('');
  const [cfZones, setCfZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ valid: boolean; status: string; type: string } | null>(null);
  const [zoneFilter, setZoneFilter] = useState('');

  const handleValidateAndFetch = async () => {
    setLoading(true);
    try {
      // First validate the token
      const validateData = await api.post<{ valid: boolean; status: string; type: string }>('/tunnel/validate-token', { apiToken });
      setTokenInfo(validateData);

      // Then fetch zones
      const data = await api.post<{ zones: any[]; total_count: number }>('/cloudflare/zones/list', { apiToken });
      const zones = data?.zones || [];

      if (zones.length === 0) {
        toast.error('No domains found for this API token. Make sure your token has Zone:Read permission.');
        setStep('token');
      } else {
        setCfZones(zones);
        setStep('select');
      }
    } catch (e: any) {
      toast.error(e.message || 'Invalid API token or insufficient permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (zone: any) => {
    setStep('linking');
    try {
      await api.post('/cloudflare/zones/link', { zoneId: zone.id, apiToken });
      toast.success(`"${zone.name}" connected successfully! SSL auto-configured.`);
      onLinked();
    } catch (e: any) {
      toast.error(e.message || 'Failed to connect domain');
      setStep('select');
    }
  };

  const filteredZones = zoneFilter
    ? cfZones.filter(z => z.name.toLowerCase().includes(zoneFilter.toLowerCase()))
    : cfZones;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect Cloudflare Domain</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent text-muted-foreground">✕</button>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {['token', 'validating'].includes(step) && (
            <div className="flex items-center gap-2 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</div>
              <span className="font-medium">Enter API Token</span>
              <div className="h-px flex-1 bg-border" />
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">2</div>
              <span className="text-muted-foreground">Select Domain</span>
            </div>
          )}
          {['select', 'linking'].includes(step) && (
            <div className="flex items-center gap-2 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">✓</div>
              <span className="text-green-600">Token Valid</span>
              <div className="h-px flex-1 bg-border" />
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</div>
              <span className="font-medium">Select Domain</span>
            </div>
          )}
        </div>

        {step === 'token' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Cloudflare API Token</label>
              <input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="cfat_..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="mt-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Required permissions:</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>Zone → Zone → Read</li>
                  <li>Zone → DNS → Edit</li>
                  <li>Zone → Zone Settings → Read & Edit</li>
                  <li>Zone → SSL and Certificates → Edit</li>
                </ul>
                <p className="mt-2">
                  Create token at: <span className="font-mono text-primary">dash.cloudflare.com/profile/api-tokens</span>
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleValidateAndFetch} disabled={!apiToken || loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? <><LoadingSpinner /> Validating...</> : <><CheckCircle className="h-4 w-4" /> Validate & Continue</>}
              </button>
            </div>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-3">
            {tokenInfo && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-900/20 p-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span>Token verified ({tokenInfo.type} token) • {cfZones.length} domain{cfZones.length !== 1 ? 's' : ''} found</span>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} placeholder="Filter domains..." className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm" />
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {filteredZones.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No domains match your filter</p>
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
                      <div className="text-right">
                        {z.name_servers && z.name_servers.length > 0 && (
                          <div className="text-xs font-mono text-muted-foreground">
                            {z.name_servers[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => { setStep('token'); setTokenInfo(null); }} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
              <span className="text-xs text-muted-foreground">{filteredZones.length} of {cfZones.length} domains</span>
            </div>
          </div>
        )}

        {step === 'linking' && (
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner />
            <span className="mt-3 text-sm">Connecting domain and auto-configuring SSL...</span>
            <span className="mt-1 text-xs text-muted-foreground">This may take a few seconds</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Shared Components ---

function ToggleSetting({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-input p-3 cursor-pointer hover:bg-accent/50">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 rounded" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </label>
  );
}
