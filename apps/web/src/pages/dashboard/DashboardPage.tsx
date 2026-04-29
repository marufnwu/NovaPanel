import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useServerStats,
  useServiceStatuses,
  useDashboardSummary,
  useNetworkStats,
  useExpiringSslCerts,
  useRestartService,
  useDiskDetails,
} from '../../api/hooks/stats';
import { useAuditLog } from '../../api/hooks/audit';
import { useTunnelStatus } from '../../api/hooks/tunnel';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Globe,
  Shield,
  Database,
  Mail,
  FolderUp,
  Clock,
  Network,
  AlertTriangle,
  RefreshCw,
  Plus,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Server,
  Loader2,
  MoreVertical,
  Cloud,
  Download,
  Package,
  Zap,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';

// --- Helpers ---

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- Sub-components ---

function ProgressBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-2 h-2 w-full rounded-full bg-muted">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function SegmentedBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="mt-2 h-3 w-full rounded-full bg-muted overflow-hidden flex">
      {segments.map((seg, i) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        return (
          <div
            key={i}
            className={`h-full transition-all ${seg.color}`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${pct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

function ServiceCard({ svc, onRestart }: { svc: { name: string; displayName: string; status: string }; onRestart: (name: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const isRunning = svc.status === 'running';

  return (
    <div className="relative flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
        <div>
          <span className="text-sm font-medium">{svc.displayName}</span>
          <p className="text-[10px] text-muted-foreground">{svc.name}</p>
        </div>
      </div>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-8 z-20 w-36 rounded-md border border-border bg-card shadow-lg">
              <button
                onClick={() => { onRestart(svc.name); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Restart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- CPU Sparkline Graph ---

type TimeRange = '1h' | '6h' | '24h';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

const MAX_POINTS: Record<TimeRange, number> = {
  '1h': 720,   // every 5s for 1h
  '6h': 720,   // every 30s for 6h
  '24h': 576,  // every 150s for 24h
};

function CpuSparkline({ currentUsage }: { currentUsage: number }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [dataPoints, setDataPoints] = useState<{ timestamp: number; value: number }[]>([]);
  const prevValueRef = useRef(currentUsage);

  // Collect data points every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints(prev => {
        const now = Date.now();
        const maxPoints = MAX_POINTS[timeRange];
        const rangeMs = TIME_RANGE_MS[timeRange];
        const cutoff = now - rangeMs;

        // Use the latest value (polled every 5s by refetchInterval)
        const newPoint = { timestamp: now, value: prevValueRef.current };
        const filtered = prev.filter(p => p.timestamp > cutoff);
        const updated = [...filtered, newPoint];

        // Downsample if too many points
        if (updated.length > maxPoints) {
          const step = Math.ceil(updated.length / maxPoints);
          return updated.filter((_, i) => i % step === 0);
        }
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [timeRange]);

  // Update ref when currentUsage changes — guard against null/undefined
  useEffect(() => {
    const val = currentUsage;
    if (typeof val === 'number' && !isNaN(val) && val >= 0) {
      prevValueRef.current = val;
    }
  }, [currentUsage]);

  // Filter data for selected time range, skip null/undefined/NaN points
  const filteredData = dataPoints.filter(
    p => p.timestamp > Date.now() - TIME_RANGE_MS[timeRange]
      && typeof p.value === 'number'
      && !isNaN(p.value)
      && p.value >= 0
  );

  // SVG sparkline
  const width = 200;
  const height = 50;
  const padding = 2;

  const points = filteredData.length > 1
    ? filteredData.map((p, i) => {
        const x = padding + (i / (filteredData.length - 1)) * (width - 2 * padding);
        const y = height - padding - (p.value / 100) * (height - 2 * padding);
        return `${x},${y}`;
      }).join(' ')
    : '';

  const areaPoints = points
    ? `${padding},${height - padding} ${points} ${width - padding},${height - padding}`
    : '';

  return (
    <div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {(['1h', '6h', '24h'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-muted'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{filteredData.length} pts</span>
      </div>
      <div className="mt-1">
        {filteredData.length > 1 ? (
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
            {/* Grid lines */}
            {[25, 50, 75].map(yPct => {
              const y = height - padding - (yPct / 100) * (height - 2 * padding);
              return (
                <line key={yPct} x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeWidth={0.5} />
              );
            })}
            {/* Area fill */}
            <polygon points={areaPoints} fill="url(#cpuGradient)" opacity={0.3} />
            {/* Line */}
            <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
        ) : (
          <div className="flex items-center justify-center h-[50px] text-[10px] text-muted-foreground">
            Collecting data...
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Dashboard ---

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats, dataUpdatedAt } = useServerStats();
  const { data: services, isLoading: servicesLoading } = useServiceStatuses();
  const { data: summary } = useDashboardSummary();
  const { data: network } = useNetworkStats();
  const { data: expiringCerts } = useExpiringSslCerts();
  const { data: diskDetails } = useDiskDetails();
  const { data: auditEntries } = useAuditLog(1, 50);
  const { data: tunnelStatus } = useTunnelStatus();
  const restartService = useRestartService();
  const navigate = useNavigate();

  const [restartingService, setRestartingService] = useState<string | null>(null);

  // "Last updated" indicator
  const [lastUpdatedAgo, setLastUpdatedAgo] = useState<string>('');
  useEffect(() => {
    if (!dataUpdatedAt) return;
    const update = () => {
      const diff = Date.now() - dataUpdatedAt;
      const seconds = Math.floor(diff / 1000);
      if (seconds < 5) setLastUpdatedAgo('just now');
      else if (seconds < 60) setLastUpdatedAgo(`${seconds}s ago`);
      else if (seconds < 3600) setLastUpdatedAgo(`${Math.floor(seconds / 60)}m ago`);
      else setLastUpdatedAgo(`${Math.floor(seconds / 3600)}h ago`);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const handleRestart = (serviceName: string) => {
    setRestartingService(serviceName);
    restartService.mutate(serviceName, {
      onSettled: () => setRestartingService(null),
    });
  };

  // Filter failed login attempts from audit log
  const failedLogins = auditEntries?.filter(
    (entry: any) => entry.action?.toLowerCase().includes('login') && entry.action?.toLowerCase().includes('fail')
  ) || [];

  const recentFailedIps = failedLogins.slice(0, 5).map((entry: any) => ({
    ip: entry.ip || 'Unknown',
    timestamp: entry.timestamp,
  }));

  if (statsError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Server overview and resource usage" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-red-600 dark:text-red-400">Failed to load server stats. Please try again.</p>
          <button
            onClick={() => refetchStats()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return <LoadingSpinner />;
  }

  const stoppedServices = services?.filter((s) => s.status !== 'running') || [];
  const diskWarning = stats && stats.disk.usagePercent > 80;

  // RAM breakdown values
  const memTotal = stats?.memory.total ?? 0;
  const memUsed = stats?.memory.used ?? 0;
  const memCached = stats?.memory.cached ?? 0;
  const memAvailable = stats?.memory.available ?? 0;
  const memFree = Math.max(0, memAvailable - memCached);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Server overview and resource usage" />

      {/* Last updated indicator */}
      {lastUpdatedAgo && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last updated {lastUpdatedAgo}
        </div>
      )}

      {/* Warnings Panel */}
      {(stoppedServices.length > 0 || diskWarning || (expiringCerts && expiringCerts.length > 0)) && (
        <div className="space-y-3">
          {diskWarning && (
            <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-600">Disk usage is above 80%</p>
                <p className="text-xs text-muted-foreground">
                  {stats?.disk.usagePercent}% used — {formatBytes(stats?.disk.used ?? 0)} of {formatBytes(stats?.disk.total ?? 0)}
                </p>
              </div>
            </div>
          )}
          {stoppedServices.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600">
                  {stoppedServices.length} service{stoppedServices.length > 1 ? 's' : ''} stopped
                </p>
                <p className="text-xs text-muted-foreground">
                  {stoppedServices.map((s) => s.displayName).join(', ')}
                </p>
              </div>
            </div>
          )}
          {expiringCerts && expiringCerts.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
              <Shield className="h-5 w-5 shrink-0 text-orange-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-600">
                  {expiringCerts.length} SSL certificate{expiringCerts.length > 1 ? 's' : ''} expiring within 30 days
                </p>
                <div className="mt-1 space-y-0.5">
                  {expiringCerts.slice(0, 3).map((cert) => (
                    <p key={cert.id} className="text-xs text-muted-foreground">
                      {cert.domainName} — {cert.daysUntilExpiry} day{cert.daysUntilExpiry !== 1 ? 's' : ''} remaining
                    </p>
                  ))}
                  {expiringCerts.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{expiringCerts.length - 3} more</p>
                  )}
                </div>
              </div>
              <Link
                to="/ssl"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-500/10"
              >
                View SSL →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Top row: 4 stat tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* CPU with Sparkline */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">CPU Usage</p>
            <Cpu className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold">{stats?.cpu.usage ?? 0}%</div>
          <ProgressBar value={stats?.cpu.usage ?? 0} max={100} color="bg-blue-500" />
          <p className="mt-1 text-xs text-muted-foreground">
            {stats?.cpu.cores} cores · Load: {stats?.loadAvg?.map((l) => l.toFixed(1)).join(' / ')}
          </p>
          <CpuSparkline currentUsage={stats?.cpu.usage ?? 0} />
        </div>

        {/* RAM with Breakdown */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Memory</p>
            <MemoryStick className="h-5 w-5 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold">{stats?.memory.usagePercent ?? 0}%</div>
          <SegmentedBar
            segments={[
              { value: memUsed, color: 'bg-purple-500', label: 'Used' },
              { value: memCached, color: 'bg-blue-400', label: 'Cached' },
              { value: memFree, color: 'bg-green-400', label: 'Free' },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
              Used: {formatBytes(memUsed)}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
              Cached: {formatBytes(memCached)}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              Free: {formatBytes(memFree)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatBytes(memUsed)} / {formatBytes(memTotal)}
            {stats?.memory.swapTotal ? ` · Swap: ${formatBytes(stats.memory.swapUsed)}` : ''}
          </p>
        </div>

        {/* Disk — show per mount point if multiple */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Disk</p>
            <HardDrive className="h-5 w-5 text-orange-500" />
          </div>
          {diskDetails && diskDetails.length > 1 ? (
            <div className="mt-2 space-y-2">
              {diskDetails.slice(0, 4).map((mount) => (
                <div key={mount.mount}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate max-w-[120px]" title={mount.mount}>
                      {mount.mount}
                    </span>
                    <span className="text-xs text-muted-foreground">{mount.usagePercent}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full transition-all ${mount.usagePercent > 80 ? 'bg-red-500' : 'bg-orange-500'}`}
                      style={{ width: `${mount.usagePercent}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {formatBytes(mount.used)} / {formatBytes(mount.total)}
                  </p>
                </div>
              ))}
              {diskDetails.length > 4 && (
                <Link to="/monitoring" className="text-[10px] text-primary hover:underline">
                  +{diskDetails.length - 4} more mounts →
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="mt-2 text-2xl font-bold">{stats?.disk.usagePercent ?? 0}%</div>
              <ProgressBar
                value={stats?.disk.usagePercent ?? 0}
                max={100}
                color={(stats?.disk.usagePercent ?? 0) > 80 ? 'bg-red-500' : 'bg-orange-500'}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(stats?.disk.used ?? 0)} / {formatBytes(stats?.disk.total ?? 0)}
              </p>
            </>
          )}
        </div>

        {/* Uptime */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Uptime</p>
            <Activity className="h-5 w-5 text-green-500" />
          </div>
          <div className="mt-2 text-2xl font-bold">{formatUptime(stats?.uptime ?? 0)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats?.system?.hostname || '—'} · {stats?.system?.ips?.[0] || '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {stats?.system?.os} · {stats?.system?.kernel}
          </p>
        </div>
      </div>

      {/* Network I/O + Cloudflare Tunnel Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {network && (
          <>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Network In</p>
                <Network className="h-5 w-5 text-green-500" />
              </div>
              <div className="mt-2 text-2xl font-bold">{formatBytes(network.rxSec)}/s</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Total: {formatBytes(network.rxBytes)} · Interface: {network.interface}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Network Out</p>
                <Network className="h-5 w-5 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold">{formatBytes(network.txSec)}/s</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Total: {formatBytes(network.txBytes)} · Interface: {network.interface}
              </p>
            </div>
          </>
        )}

        {/* Cloudflare Tunnel Status Widget */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Cloudflare Tunnel</p>
            <Cloud className="h-5 w-5 text-orange-500" />
          </div>
          <div className="mt-3">
            {tunnelStatus ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${tunnelStatus.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">
                    {tunnelStatus.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {tunnelStatus.tunnels.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tunnelStatus.tunnels.length} tunnel{tunnelStatus.tunnels.length > 1 ? 's' : ''} configured
                  </p>
                )}
                <Link
                  to="/tunnels"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Manage tunnels <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium text-muted-foreground">Not configured</span>
                </div>
                <Link
                  to="/tunnels"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Set up tunnel <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Link to="/domains" className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Domains</span>
          </div>
          <p className="mt-1 text-xl font-bold">{summary?.activeDomains ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">{summary?.totalDomains ?? 0} total</p>
        </Link>

        <Link to="/mail" className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Mailboxes</span>
          </div>
          <p className="mt-1 text-xl font-bold">{summary?.totalMailboxes ?? 0}</p>
        </Link>

        <Link to="/databases" className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">Databases</span>
          </div>
          <p className="mt-1 text-xl font-bold">{summary?.totalDatabases ?? 0}</p>
        </Link>

        <Link to="/ftp" className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2">
            <FolderUp className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">FTP</span>
          </div>
          <p className="mt-1 text-xl font-bold">{summary?.totalFtpAccounts ?? 0}</p>
        </Link>

        <Link to="/cron" className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-sm text-muted-foreground">Cron Jobs</span>
          </div>
          <p className="mt-1 text-xl font-bold">{summary?.totalActiveCronJobs ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">active</p>
        </Link>
      </div>

      {/* Services Grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Services</h2>
          <span className="text-xs text-muted-foreground">
            {services?.filter((s) => s.status === 'running').length ?? 0} / {services?.length ?? 0} running
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {servicesLoading ? (
            <div className="col-span-full flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            services?.map((svc) => (
              <div key={svc.name} className="relative">
                <ServiceCard svc={svc} onRestart={handleRestart} />
                {restartingService === svc.name && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm">Restarting...</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom row: Recent Activity + Failed Logins + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-1 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link to="/audit" className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {auditEntries && auditEntries.length > 0 ? (
            <div className="divide-y divide-border">
              {auditEntries.slice(0, 10).map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-medium">{entry.action}</span>
                      {entry.resource && (
                        <span className="text-muted-foreground"> · {entry.resource}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.ip} · {timeAgo(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </div>

        {/* Recent Failed Login Attempts */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Failed Logins</h2>
            <div className="flex items-center gap-2">
              {failedLogins.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  {failedLogins.length}
                </span>
              )}
            </div>
          </div>
          {recentFailedIps.length > 0 ? (
            <div className="space-y-3">
              <div className="divide-y divide-border">
                {recentFailedIps.map((entry: { ip: string; timestamp: string }, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-red-500" />
                      <code className="text-xs font-mono">{entry.ip}</code>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
              <Link to="/audit" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View all in audit log <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <ShieldCheck className="h-8 w-8 text-green-500/50 mb-2" />
              <p className="text-sm text-muted-foreground">No failed login attempts</p>
              <p className="text-[10px] text-muted-foreground">Everything looks secure</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => navigate({ to: '/domains' })}
              className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4 text-blue-500" />
              Add Domain
            </button>
            <button
              onClick={() => navigate({ to: '/databases' })}
              className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4 text-purple-500" />
              New Database
            </button>
            <button
              onClick={() => navigate({ to: '/backups' })}
              className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Download className="h-4 w-4 text-green-500" />
              Create Backup
            </button>
            <button
              onClick={() => navigate({ to: '/installer' })}
              className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Package className="h-4 w-4 text-orange-500" />
              Install App
            </button>
            <button
              onClick={() => navigate({ to: '/terminal' })}
              className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Terminal className="h-4 w-4 text-gray-500" />
              Open Terminal
            </button>
          </div>
        </div>
      </div>

      {/* System Info Footer */}
      {stats?.system && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              {stats.system.hostname}
            </span>
            <span>OS: {stats.system.os}</span>
            <span>Kernel: {stats.system.kernel}</span>
            <span>Arch: {stats.system.arch}</span>
            {stats.system.ips.map((ip) => (
              <span key={ip}>IP: {ip}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
