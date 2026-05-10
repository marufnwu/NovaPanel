import { Link } from '@tanstack/react-router';
import { useSites, type Site } from '../../api/hooks/sites';
import { useServerStats } from '../../api/hooks/stats';
import { useNotifications, type Notification } from '../../api/hooks/notifications';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  Globe,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  HardDrive,
  Cpu,
  Activity,
  ArrowRight,
  Server,
  RefreshCw,
  X,
} from 'lucide-react';

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

// --- Site Status Card ---

function SiteStatusCard({ site }: { site: Site }) {
  const isUp = site.status === 'active';
  const needsAttention = site.status === 'error' || site.status === 'suspended';

  return (
    <Link
      to="/sites/$siteId"
      params={{ siteId: site.id }}
      className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Globe className={`h-5 w-5 ${isUp ? 'text-green-500' : needsAttention ? 'text-red-500' : 'text-yellow-500'}`} />
        </div>
        <div>
          <p className="font-medium group-hover:text-primary transition-colors">{site.name}</p>
          <p className="text-xs text-muted-foreground">
            {site.phpVersion ? `PHP ${site.phpVersion}` : '—'} · {site.webServer || '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Status badge */}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          isUp ? 'bg-green-500/10 text-green-500' :
          needsAttention ? 'bg-red-500/10 text-red-500' :
          'bg-yellow-500/10 text-yellow-500'
        }`}>
          {isUp ? (
            <><CheckCircle className="h-3 w-3" /> Up</>
          ) : needsAttention ? (
            <><AlertTriangle className="h-3 w-3" /> {site.status}</>
          ) : (
            <><Clock className="h-3 w-3" /> {site.status}</>
          )}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

// --- Attention Item ---

function AttentionItem({ notification }: { notification: Notification }) {
  const Icon = notification.type === 'ssl_expiry' ? Shield :
               notification.type === 'cron_failed' ? Clock :
               notification.type === 'disk_space_low' ? HardDrive :
               notification.type === 'service_down' ? Server :
               AlertTriangle;

  const colorClass = notification.type === 'ssl_expiry' ? 'text-yellow-500' :
                    notification.type === 'cron_failed' ? 'text-red-500' :
                    notification.type === 'disk_space_low' ? 'text-orange-500' :
                    notification.type === 'service_down' ? 'text-red-500' :
                    'text-muted-foreground';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`mt-0.5 rounded-full p-1.5 bg-muted ${colorClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notification.message}</p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(notification.createdAt)}</span>
    </div>
  );
}

// --- Server Health Summary ---

function ServerHealthSummary() {
  const { data: stats, isLoading, isError, refetch } = useServerStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-sm font-medium text-red-600">Failed to load server health</span>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  const cpuWarning = (stats?.cpu.usage ?? 0) > 80;
  const ramWarning = (stats?.memory.usagePercent ?? 0) > 80;
  const diskWarning = (stats?.disk.usagePercent ?? 0) > 80;
  const anyWarning = cpuWarning || ramWarning || diskWarning;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Server Health</h3>
        <span className="text-xs text-muted-foreground">
          {formatUptime(stats?.uptime ?? 0)} uptime
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* CPU */}
        <div className={`rounded-lg border p-3 ${cpuWarning ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border bg-card'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">CPU</span>
            <Cpu className={`h-4 w-4 ${cpuWarning ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          </div>
          <p className={`text-lg font-bold ${cpuWarning ? 'text-yellow-500' : ''}`}>
            {stats?.cpu.usage ?? 0}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {stats?.cpu.cores} cores
          </p>
        </div>

        {/* RAM */}
        <div className={`rounded-lg border p-3 ${ramWarning ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border bg-card'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Memory</span>
            <Activity className={`h-4 w-4 ${ramWarning ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          </div>
          <p className={`text-lg font-bold ${ramWarning ? 'text-yellow-500' : ''}`}>
            {stats?.memory.usagePercent ?? 0}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatBytes(stats?.memory.used ?? 0)} / {formatBytes(stats?.memory.total ?? 0)}
          </p>
        </div>

        {/* Disk */}
        <div className={`rounded-lg border p-3 ${diskWarning ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border bg-card'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Disk</span>
            <HardDrive className={`h-4 w-4 ${diskWarning ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          </div>
          <p className={`text-lg font-bold ${diskWarning ? 'text-yellow-500' : ''}`}>
            {stats?.disk.usagePercent ?? 0}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatBytes(stats?.disk.used ?? 0)} / {formatBytes(stats?.disk.total ?? 0)}
          </p>
        </div>
      </div>

      {anyWarning && (
        <p className="text-xs text-yellow-500 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          High resource usage detected — visit Monitoring for details
        </p>
      )}
    </div>
  );
}

// --- Main Dashboard ---

export function DashboardPage() {
  const { data: sites, isLoading: sitesLoading } = useSites();
  const { data: notificationsData, isLoading: notifLoading } = useNotifications(20, 0, { refetchInterval: 30_000 });

  const notifications = notificationsData?.notifications || [];

  // Filter attention-needed notifications
  const attentionItems = notifications.filter(n =>
    !n.isRead && [
      'ssl_expiry',
      'cron_failed',
      'disk_space_low',
      'service_down',
      'security_alert',
    ].includes(n.type)
  );

  // Recent events (read or recent unread, last 10)
  const recentEvents = notifications.slice(0, 10);

  // Site status counts
  const siteCounts = {
    total: sites?.length ?? 0,
    up: sites?.filter(s => s.status === 'active').length ?? 0,
    attention: sites?.filter(s => s.status === 'error' || s.status === 'suspended').length ?? 0,
    pending: sites?.filter(s => s.status === 'pending').length ?? 0,
  };

  if (sitesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Are my sites up? Is the server healthy? What needs attention?"
      />

      {/* Site Status Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Sites</h2>
            {siteCounts.total > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-green-600">
                  <CheckCircle className="h-3 w-3" /> {siteCounts.up} up
                </span>
                {siteCounts.attention > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">
                    <AlertTriangle className="h-3 w-3" /> {siteCounts.attention} down
                  </span>
                )}
                {siteCounts.pending > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-600">
                    <Clock className="h-3 w-3" /> {siteCounts.pending} pending
                  </span>
                )}
              </div>
            )}
          </div>
          <Link
            to="/sites"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {siteCounts.total === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Globe className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No sites yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a site to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites?.slice(0, 9).map((site) => (
              <SiteStatusCard key={site.id} site={site} />
            ))}
          </div>
        )}
        {siteCounts.total > 9 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            +{siteCounts.total - 9} more sites
          </p>
        )}
      </section>

      {/* Attention Required Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Attention Required</h2>
          {attentionItems.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {attentionItems.length}
            </span>
          )}
        </div>

        {notifLoading ? (
          <div className="flex justify-center rounded-lg border border-border bg-card p-6">
            <LoadingSpinner />
          </div>
        ) : attentionItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-500/60" />
            <p className="mt-2 text-sm font-medium text-green-600">All clear!</p>
            <p className="mt-1 text-xs text-muted-foreground">No issues need your attention</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {attentionItems.slice(0, 5).map((notification) => (
              <AttentionItem key={notification.id} notification={notification} />
            ))}
            {attentionItems.length > 5 && (
              <div className="p-3 text-center">
                <Link
                  to="/notifications"
                  className="text-xs text-primary hover:underline"
                >
                  View all {attentionItems.length} items
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Server Health Summary */}
      <section>
        <ServerHealthSummary />
      </section>

      {/* Recent Events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Events</h2>
          </div>
          <Link
            to="/notifications"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-6 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No recent events</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Event</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => {
                  const Icon = event.type === 'ssl_expiry' ? Shield :
                              event.type === 'cron_failed' ? Clock :
                              event.type === 'disk_space_low' ? HardDrive :
                              event.type === 'service_down' ? Server :
                              event.type === 'backup_complete' ? CheckCircle :
                              AlertTriangle;
                  return (
                    <tr key={event.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <Icon className={`h-4 w-4 ${
                          event.type === 'ssl_expiry' ? 'text-yellow-500' :
                          event.type === 'backup_complete' ? 'text-green-500' :
                          ['cron_failed', 'service_down', 'security_alert'].includes(event.type) ? 'text-red-500' :
                          'text-muted-foreground'
                        }`} />
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{event.message}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(event.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
