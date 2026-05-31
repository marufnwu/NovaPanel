import { useNavigate, useRouterState, useParams } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useSite,
  useSiteBuild,
  useSiteDeploy,
  useSiteStop,
  useSiteDomains,
  useSiteStats,
  useSiteHealth,
  useSiteLogs,
  useSuspendSite,
  useActivateSite,
  useSiteRestart,
  useClearCache,
  useAttachDomainToSite,
  useDetachDomainFromSite,
  useRunHealthCheck,
  type Site,
} from '../../api/hooks/sites';
import { useCreateDomain, useDeleteDomain, useDomainCloudflareStatus, useVerifyDomainDns, useCreateSubdomain, type Domain } from '../../api/hooks/domains';
import { useCreateDatabase, useDeleteDatabase } from '../../api/hooks/databases';
import { useIssueLetsEncrypt, useRenewCertificate, useToggleAutoRenew, useDownloadCert } from '../../api/hooks/ssl';
import { useCreateCronJob, useRunCronJob, useToggleCronJob, useDeleteCronJob } from '../../api/hooks/cron';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';
import { ResourceGraphs } from '../../components/monitoring/ResourceGraphs';
import { TrafficAnalytics } from '../../components/monitoring/TrafficAnalytics';
import { EnvVarsEditor } from '../../components/sites/EnvVarsEditor';
import { PhpConfigEditor } from '../../components/sites/PhpConfigEditor';
import { DeploymentSettingsEditor } from '../../components/sites/DeploymentSettings';
import { ActivityFeed } from '../../components/sites/ActivityFeed';
import { CronTimeline } from '../../components/sites/CronTimeline';
import { LogAnalytics } from '../../components/sites/LogAnalytics';
import { BackupManager } from '../../components/sites/BackupManager';
import { CacheManager } from '../../components/sites/CacheManager';

export function SiteDetailPage() {
  const params = useParams({ strict: false }) as { siteId?: string };
  const siteId = params.siteId || '';
  const search = useRouterState({ select: (s) => s.location.search }) as any;
  const activeTab = search?.tab || 'overview';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: site, isLoading, isError, error, refetch } = useSite(siteId);

  const siteBuild = useSiteBuild();
  const siteDeploy = useSiteDeploy();
  const siteStop = useSiteStop();
  const siteRestart = useSiteRestart();
  const suspendSite = useSuspendSite();
  const activateSite = useActivateSite();
  const clearCache = useClearCache();

  const [showCreateDb, setShowCreateDb] = useState(false);
  const [showIssueCert, setShowIssueCert] = useState(false);
  const [showAddCron, setShowAddCron] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  if (!site) return <ErrorState message="Site not found" />;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'domains', label: 'Domains' },
    { id: 'deployments', label: 'Deployments' },
    { id: 'traffic', label: 'Traffic' },
    { id: 'cache', label: 'Cache' },
    { id: 'envVars', label: 'Environment' },
    { id: 'php', label: 'PHP' },
    { id: 'settings', label: 'Settings' },
    { id: 'database', label: 'Database' },
    { id: 'backups', label: 'Backups' },
    { id: 'scheduler', label: 'Scheduler & Logs' },
    { id: 'logAnalytics', label: 'Log Analytics' },
    { id: 'cronTimeline', label: 'Cron Timeline' },
    { id: 'activity', label: 'Activity' },
  ];

  const handleTabChange = (tabId: string) => {
    navigate({ search: { tab: tabId } } as any);
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="bg-background-secondary border border-border-tertiary rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-page-title font-medium">{site.name}</h1>
            <StatusBadge status={site.status as any} />
          </div>
          <div className="flex gap-1">
            {/* Enable/Disable Toggle */}
            <Button
              variant={site.status === 'suspended' ? 'primary' : 'ghost'}
              size="small"
              loading={suspendSite.isPending || activateSite.isPending}
              onClick={() => {
                if (site.status === 'suspended') {
                  activateSite.mutate(siteId, {
                    onSuccess: () => {
                      toast.success(`${site.name} enabled`);
                      queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                    },
                    onError: (err: any) => toast.error(`Failed to enable: ${err.message}`),
                  });
                } else {
                  suspendSite.mutate(siteId, {
                    onSuccess: () => {
                      toast.success(`${site.name} disabled`);
                      queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                    },
                    onError: (err: any) => toast.error(`Failed to disable: ${err.message}`),
                  });
                }
              }}
              icon={<Icon name={site.status === 'suspended' ? 'icon-play' : 'icon-pause'} size={15} />}
            >
              {site.status === 'suspended' ? 'Enable' : 'Disable'}
            </Button>
            {/* SSL Button */}
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                navigate({ search: { tab: 'settings' } } as any);
              }}
              icon={<Icon name="icon-shield-check" size={15} />}
            >
              SSL
            </Button>
            {/* View Logs Button */}
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                navigate({ search: { tab: 'scheduler' } } as any);
              }}
              icon={<Icon name="icon-document" size={15} />}
            >
              Logs
            </Button>
          </div>
        </div>

        {/* Quick Action Buttons Row */}
        <div className="flex gap-2 flex-wrap">
          {/* Restart */}
          <Button
            variant="default"
            size="small"
            icon={<Icon name="icon-refresh-cw" size={15} />}
            loading={siteRestart.isPending}
            onClick={() => {
              siteRestart.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`${site.name} restarting`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'status'] });
                },
                onError: (err: any) => toast.error(`Failed to restart: ${err.message}`),
              });
            }}
          >
            Restart
          </Button>

          {/* Clear Cache */}
          <Button
            variant="default"
            size="small"
            icon={<Icon name="icon-refresh" size={15} />}
            loading={clearCache.isPending}
            onClick={() => {
              clearCache.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`Cache cleared for ${site.name}`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                },
                onError: (err: any) => toast.error(`Failed to clear cache: ${err.message}`),
              });
            }}
          >
            Clear Cache
          </Button>

          {/* Build */}
          <Button
            variant="default"
            size="small"
            icon={<Icon name="icon-play" size={15} />}
            loading={siteBuild.isPending}
            onClick={() => {
              siteBuild.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`Build started for ${site.name}`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                },
                onError: (err: any) => toast.error(`Build failed: ${err.message}`),
              });
            }}
          >
            Build
          </Button>

          {/* Deploy */}
          <Button
            variant="primary"
            size="small"
            icon={<Icon name="icon-upload" size={15} />}
            loading={siteDeploy.isPending}
            onClick={() => {
              siteDeploy.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`Deploy started for ${site.name}`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'deployments'] });
                },
                onError: (err) => toast.error(`Deploy failed: ${err.message}`),
              });
            }}
          >
            Deploy
          </Button>

          {/* Stop */}
          <Button
            variant="danger"
            size="small"
            icon={<Icon name="icon-stop" size={15} />}
            loading={siteStop.isPending}
            onClick={() => {
              siteStop.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`${site.name} stopped`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                },
                onError: (err) => toast.error(`Failed to stop: ${err.message}`),
              });
            }}
          >
            Stop
          </Button>
        </div>
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-4 py-2.5 text-small transition-colors relative',
                activeTab === tab.id
                  ? 'text-foreground-primary font-medium'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <TabContent tab={activeTab} siteId={siteId} siteName={site.name} queryClient={queryClient} onAddCron={() => setShowAddCron(true)} onIssueCert={() => setShowIssueCert(true)} onCreateDb={() => setShowCreateDb(true)} navigate={navigate} domainId={site.domains?.[0]?.id} domainName={site.domains?.[0]?.name || site.name} />
    </div>
  );
}

function TabContent({
  tab,
  siteId,
  siteName,
  queryClient,
  onAddCron,
  onIssueCert,
  onCreateDb,
  navigate,
  domainId,
  domainName,
}: {
  tab: string;
  siteId: string;
  siteName: string;
  queryClient: any;
  onAddCron: () => void;
  onIssueCert: () => void;
  onCreateDb: () => void;
  navigate: any;
  domainId?: string;
  domainName?: string;
}) {
  switch (tab) {
    case 'overview':
      return <OverviewTab siteId={siteId} />;
    case 'domains':
      return <DomainsTab siteId={siteId} siteName={siteName} queryClient={queryClient} />;
    case 'deployments':
      return <DeploymentsTab siteId={siteId} />;
    case 'traffic':
      return <TrafficTab siteId={siteId} />;
    case 'cache':
      return <CacheTab siteId={siteId} siteName={siteName} domainId={domainId} />;
    case 'envVars':
      return <EnvVarsTab siteId={siteId} />;
    case 'php':
      return <PhpTab siteId={siteId} domainId={domainId || siteId} domainName={domainName || siteName} />;
    case 'settings':
      return <SettingsTab siteId={siteId} siteName={siteName} onIssueCert={onIssueCert} queryClient={queryClient} />;
    case 'database':
      return <DatabaseTab siteId={siteId} siteName={siteName} onCreateDb={onCreateDb} queryClient={queryClient} navigate={navigate} />;
    case 'backups':
      return <BackupTab siteId={siteId} siteName={siteName} domainId={domainId} />;
    case 'scheduler':
      return <SchedulerTab siteId={siteId} siteName={siteName} onAddCron={onAddCron} queryClient={queryClient} />;
    case 'logAnalytics':
      return <LogAnalyticsTab siteId={siteId} domainId={domainId} />;
    case 'cronTimeline':
      return <CronTimelineTab siteId={siteId} domainId={domainId} />;
    case 'activity':
      return <ActivityTab siteId={siteId} siteName={siteName} />;
    default:
      return <OverviewTab siteId={siteId} />;
  }
}

function OverviewTab({ siteId }: { siteId: string }) {
  const { data: site } = useSite(siteId);
  const { data: stats } = useSiteStats(siteId);
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useSiteHealth(siteId);
  const runHealthCheck = useRunHealthCheck();

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-foreground-success';
      case 'unhealthy': return 'text-foreground-danger';
      case 'degraded': return 'text-foreground-warning';
      default: return 'text-foreground-tertiary';
    }
  };

  const getHealthBgColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-foreground-success/10 border-foreground-success/30';
      case 'unhealthy': return 'bg-foreground-danger/10 border-foreground-danger/30';
      case 'degraded': return 'bg-foreground-warning/10 border-foreground-warning/30';
      default: return 'bg-background-secondary border-border-tertiary';
    }
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-foreground-success';
    if (uptime >= 95) return 'text-foreground-warning';
    return 'text-foreground-danger';
  };

  const formatUptime = (value: number) => {
    return value >= 0 ? `${value.toFixed(2)}%` : '—';
  };

  const formatResponseTime = (ms: number) => {
    if (ms <= 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-tertiary mb-1">Visitors Today</div>
          <div className="text-[24px] font-medium">{stats?.visitorsToday ?? '—'}</div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-tertiary mb-1">Bandwidth</div>
          <div className="text-[24px] font-medium">{stats?.bandwidthToday ?? '—'}</div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-tertiary mb-1">Disk Usage</div>
          <div className="text-[24px] font-medium">{stats?.diskUsage ?? '—'}</div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-tertiary mb-1">Uptime</div>
          <div className="text-[24px] font-medium">{stats?.uptime ?? '—'}</div>
        </Card>
      </div>

      {/* Resource Usage Graphs */}
      <ResourceGraphs siteId={siteId} />

      {/* Health Status - Enhanced (UX-11) */}
      <Card 
        title="Health Status" 
        action={
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="small" 
              onClick={() => refetchHealth()} 
              icon={<Icon name="icon-refresh" size={15} />}
              loading={healthLoading}
            >
              Refresh
            </Button>
            <Button 
              variant="default" 
              size="small" 
              onClick={() => runHealthCheck.mutate(siteId, { onSuccess: () => toast.success('Health check initiated'), onError: (err: any) => toast.error(`Check failed: ${err.message}`) })}
              icon={<Icon name="icon-activity" size={15} />}
              loading={runHealthCheck.isPending}
            >
              Run Check
            </Button>
          </div>
        }
      >
        {healthLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-small text-foreground-tertiary">Loading health data...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Health Status Header */}
            <div className={`flex items-center justify-between p-4 rounded-lg border ${getHealthBgColor(health?.status ?? 'unknown')}`}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[24px] ${getHealthColor(health?.status ?? 'unknown')}`}>
                    {health?.status === 'healthy' ? '●' : health?.status === 'unhealthy' ? '○' : '◐'}
                  </span>
                  <span className="text-small font-medium capitalize">{health?.status ?? 'unknown'}</span>
                </div>
                {health?.consecutiveFailures && health.consecutiveFailures > 0 && (
                  <span className="px-2 py-0.5 bg-foreground-danger/20 text-foreground-danger text-meta rounded">
                    {health.consecutiveFailures} consecutive failure{health.consecutiveFailures > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-meta text-foreground-tertiary">
                <span>Last check: {health?.lastCheck ? new Date(health.lastCheck).toLocaleString() : '—'}</span>
                <span>Interval: {health?.checkInterval ? `${health.checkInterval}s` : '60s'}</span>
              </div>
            </div>

            {/* Uptime Stats */}
            <div>
              <div className="text-small font-medium text-foreground-secondary mb-3">Uptime Statistics</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-background-secondary rounded-lg p-3">
                  <div className="text-meta text-foreground-tertiary mb-1">Last 24 Hours</div>
                  <div className={`text-[20px] font-medium ${getUptimeColor(health?.uptime24h ?? -1)}`}>
                    {formatUptime(health?.uptime24h ?? -1)}
                  </div>
                </div>
                <div className="bg-background-secondary rounded-lg p-3">
                  <div className="text-meta text-foreground-tertiary mb-1">Last 7 Days</div>
                  <div className={`text-[20px] font-medium ${getUptimeColor(health?.uptime7d ?? -1)}`}>
                    {formatUptime(health?.uptime7d ?? -1)}
                  </div>
                </div>
                <div className="bg-background-secondary rounded-lg p-3">
                  <div className="text-meta text-foreground-tertiary mb-1">Last 30 Days</div>
                  <div className={`text-[20px] font-medium ${getUptimeColor(health?.uptime30d ?? -1)}`}>
                    {formatUptime(health?.uptime30d ?? -1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance & Error Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-small font-medium text-foreground-secondary mb-3">Performance</div>
                <div className="bg-background-secondary rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">Avg Response Time</span>
                    <span className={`font-medium ${(health?.avgResponseTime ?? 0) > 2000 ? 'text-foreground-danger' : (health?.avgResponseTime ?? 0) > 1000 ? 'text-foreground-warning' : 'text-foreground-success'}`}>
                      {formatResponseTime(health?.avgResponseTime ?? 0)}
                    </span>
                  </div>
                  {stats && (
                    <div className="flex justify-between items-center">
                      <span className="text-foreground-secondary">Requests/min</span>
                      <span className="font-medium">{stats.requestsPerMinute ?? '—'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-small font-medium text-foreground-secondary mb-3">Error Rates</div>
                <div className="bg-background-secondary rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">4xx Errors</span>
                    <span className={`font-medium ${(health?.errorRate4xx ?? 0) > 5 ? 'text-foreground-danger' : (health?.errorRate4xx ?? 0) > 1 ? 'text-foreground-warning' : 'text-foreground-success'}`}>
                      {(health?.errorRate4xx ?? 0) >= 0 ? `${(health?.errorRate4xx ?? 0).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-secondary">5xx Errors</span>
                    <span className={`font-medium ${(health?.errorRate5xx ?? 0) > 1 ? 'text-foreground-danger' : (health?.errorRate5xx ?? 0) > 0.1 ? 'text-foreground-warning' : 'text-foreground-success'}`}>
                      {(health?.errorRate5xx ?? 0) >= 0 ? `${(health?.errorRate5xx ?? 0).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Status */}
            <div>
              <div className="text-small font-medium text-foreground-secondary mb-3">Service Status</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex justify-between items-center p-3 bg-background-secondary rounded-lg">
                  <span className="text-foreground-secondary">Web Server</span>
                  <span className={health?.webServer === 'running' ? 'text-foreground-success' : 'text-foreground-danger'}>
                    {health?.webServer ?? 'unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-background-secondary rounded-lg">
                  <span className="text-foreground-secondary">PHP-FPM</span>
                  <span className={health?.phpFpm === 'running' ? 'text-foreground-success' : health?.phpFpm === 'not_applicable' ? 'text-foreground-tertiary' : 'text-foreground-danger'}>
                    {health?.phpFpm ?? 'unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-background-secondary rounded-lg">
                  <span className="text-foreground-secondary">Database</span>
                  <span className={health?.database === 'connected' ? 'text-foreground-success' : 'text-foreground-danger'}>
                    {health?.database ?? 'unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Failed Health Checks History */}
            {health?.failures && health.failures.length > 0 && (
              <div>
                <div className="text-small font-medium text-foreground-secondary mb-3">Recent Failures</div>
                <div className="bg-background-secondary rounded-lg overflow-hidden">
                  <table className="w-full text-small">
                    <thead>
                      <tr className="border-b border-border-tertiary">
                        <th className="text-left p-3 text-foreground-tertiary font-normal">Timestamp</th>
                        <th className="text-left p-3 text-foreground-tertiary font-normal">Error</th>
                        <th className="text-left p-3 text-foreground-tertiary font-normal">Response Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.failures.slice(0, 5).map((failure, i) => (
                        <tr key={i} className="border-b border-border-tertiary last:border-0">
                          <td className="p-3 text-foreground-secondary font-mono">{new Date(failure.timestamp).toLocaleString()}</td>
                          <td className="p-3 text-foreground-danger">{failure.error}</td>
                          <td className="p-3">{failure.responseCode ? <span className={`font-mono ${failure.responseCode >= 500 ? 'text-foreground-danger' : failure.responseCode >= 400 ? 'text-foreground-warning' : 'text-foreground-tertiary'}`}>{failure.responseCode}</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Last Successful Check */}
            {health?.lastSuccessfulCheck && (
              <div className="flex items-center gap-2 text-meta text-foreground-tertiary">
                <Icon name="icon-check-circle" size={16} className="text-foreground-success" />
                <span>Last successful check: {new Date(health.lastSuccessfulCheck).toLocaleString()}</span>
              </div>
            )}

            {/* Health Check URL Configuration */}
            {health?.healthCheckUrl && (
              <div className="flex items-center gap-2 pt-3 border-t border-border-tertiary">
                <span className="text-foreground-secondary text-small">Health check URL:</span>
                <code className="text-meta text-foreground-tertiary bg-background-tertiary px-2 py-1 rounded font-mono">
                  {health.healthCheckUrl}
                </code>
              </div>
            )}

            {/* Issues Detected */}
            {health?.issues && health.issues.length > 0 && (
              <div className="p-4 bg-foreground-danger/10 border border-foreground-danger/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="icon-alert-triangle" size={16} className="text-foreground-danger" />
                  <div className="text-small font-medium text-foreground-danger">Issues Detected</div>
                </div>
                <ul className="space-y-1">
                  {health.issues.map((issue, i) => <li key={i} className="text-small text-foreground-secondary flex items-start gap-2"><span className="text-foreground-danger">•</span>{issue}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Site Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Runtime">
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Runtime</span>
              <span>{site?.runtime || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">PHP Version</span>
              <span>{site?.runtime?.includes('php') ? (site.runtimeVersion || '8.2') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Source Type</span>
              <span className="capitalize">{site?.sourceType || '—'}</span>
            </div>
          </div>
        </Card>
        <Card title="Domain & SSL">
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Primary Domain</span>
              <span className="font-mono">{site?.domains?.[0]?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">SSL Status</span>
              <span className="text-foreground-tertiary">Not configured</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Created</span>
              <span>{site?.createdAt ? new Date(site.createdAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DeploymentsTab({ siteId }: { siteId: string }) {
  return <DeploymentSettingsEditor siteId={siteId} />;
}

function DatabaseTab({ siteId, siteName, onCreateDb, queryClient, navigate }: { siteId: string; siteName: string; onCreateDb: () => void; queryClient: any; navigate: any }) {
  const [dbName, setDbName] = useState('');
  const [dbEngine, setDbEngine] = useState<'mariadb' | 'postgresql'>('mariadb');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteDbId, setDeleteDbId] = useState<string | null>(null);
  const createDb = useCreateDatabase();
  const deleteDb = useDeleteDatabase();

  const handleCreateDb = async () => {
    if (!dbName) return;
    try {
      await createDb.mutateAsync({ name: dbName, type: dbEngine, siteId });
      toast.success(`Database "${dbName}" created`);
      setShowCreate(false);
      setDbName('');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'database'] });
    } catch (err: any) {
      toast.error(`Failed to create database: ${err.message}`);
    }
  };

  const { data: database } = useQuery({
    queryKey: ['sites', siteId, 'database'],
    queryFn: () => api.get(`/sites/${siteId}/database`),
  });

  if (!database && !showCreate) {
    return (
      <Card title="Database">
        <div className="text-center py-6">
          <p className="text-small text-foreground-secondary mb-4">No database attached</p>
          <Button onClick={() => setShowCreate(true)}>Create Database</Button>
        </div>
      </Card>
    );
  }

  if (showCreate) {
    return (
      <Card title="Create Database">
        <div className="space-y-4">
          <Input label="Database Name" value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="my_database" />
          <div>
            <label className="text-meta font-medium mb-1 block">Engine</label>
            <div className="flex gap-2">
              <Button variant={dbEngine === 'mariadb' ? 'primary' : 'default'} size="small" onClick={() => setDbEngine('mariadb')}>MariaDB</Button>
              <Button variant={dbEngine === 'postgresql' ? 'primary' : 'default'} size="small" onClick={() => setDbEngine('postgresql')}>PostgreSQL</Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateDb} loading={createDb.isPending}>Create</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="Database" action={<Button size="small" onClick={() => setShowCreate(true)} icon={<Icon name="icon-plus" size={15} />}>Add</Button>}>
        <div className="space-y-3 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Name</span>
            <span>{(database as any).name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Engine</span>
            <span>{(database as any).engine}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="default" size="small" onClick={() => navigate({ to: '/databases/$databaseId', params: { databaseId: (database as any).id } })}>View Database</Button>
            <Button variant="ghost" size="small" onClick={() => setDeleteDbId((database as any).id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
          </div>
        </div>
      </Card>
      <ConfirmDialog
        isOpen={!!deleteDbId}
        onClose={() => setDeleteDbId(null)}
        onConfirm={() => {
          if (!deleteDbId) return;
          deleteDb.mutate(deleteDbId, {
            onSuccess: () => {
              toast.success('Database deleted');
              setDeleteDbId(null);
              queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'database'] });
            },
            onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
          });
        }}
        title="Delete Database"
        description="This database and all its data will be permanently deleted."
        confirmText="Delete"
        impact="high"
        loading={deleteDb.isPending}
      />
    </>
  );
}

function SettingsTab({ siteId, siteName, onIssueCert, queryClient }: { siteId: string; siteName: string; onIssueCert: () => void; queryClient: any }) {
  const [showIssue, setShowIssue] = useState(false);
  const [certEmail, setCertEmail] = useState('');
  const issueCert = useIssueLetsEncrypt();
  const { data: siteDomains } = useSiteDomains(siteId);
  const primaryDomain = siteDomains?.[0];

  const handleIssueCert = async () => {
    if (!primaryDomain?.id) return;
    try {
      await issueCert.mutateAsync({
        domainId: primaryDomain.id,
        email: certEmail,
        challengeType: 'http-01',
      });
      toast.success('SSL certificate issuance started');
      setShowIssue(false);
      setCertEmail('');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'ssl'] });
    } catch (err: any) {
      toast.error(`Failed to issue certificate: ${err.message}`);
    }
  };

  const { data: ssl } = useQuery({
    queryKey: ['sites', siteId, 'ssl'],
    queryFn: () => api.get(`/sites/${siteId}/ssl`),
  });

  const renewCert = useRenewCertificate();
  const toggleAutoRenew = useToggleAutoRenew();
  const downloadCert = useDownloadCert();
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const handleRenewCert = async () => {
    if (!(ssl as any)?.domainId) return;
    try {
      await renewCert.mutateAsync((ssl as any).domainId);
      toast.success('SSL certificate renewal started');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'ssl'] });
    } catch (err: any) {
      toast.error(`Failed to renew certificate: ${err.message}`);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!(ssl as any)?.domainId) return;
    try {
      await toggleAutoRenew.mutateAsync({ domainId: (ssl as any).domainId, autoRenew: !(ssl as any).autoRenew });
      toast.success(`Auto-renew ${(ssl as any).autoRenew ? 'disabled' : 'enabled'}`);
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'ssl'] });
    } catch (err: any) {
      toast.error(`Failed to update auto-renew: ${err.message}`);
    }
  };

  const handleDownloadCert = async (file: 'cert' | 'key' | 'chain') => {
    if (!(ssl as any)?.domainId) return;
    try {
      const result = await downloadCert.mutateAsync({ domainId: (ssl as any).domainId, file });
      // Create a download link for the certificate content
      const blob = new Blob([result.pem], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(ssl as any).domain}_${file}.pem`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Certificate ${file} downloaded`);
      setShowDownloadMenu(false);
    } catch (err: any) {
      toast.error(`Failed to download certificate: ${err.message}`);
    }
  };

  const { data: records } = useQuery({
    queryKey: ['sites', siteId, 'dns'],
    queryFn: () => api.get(`/sites/${siteId}/dns`).then((r: any) => r.items || []),
  });

  const { data: phpConfig } = useQuery({
    queryKey: ['sites', siteId, 'php'],
    queryFn: () => api.get(`/sites/${siteId}/php`),
  });

  const { data: config } = useQuery({
    queryKey: ['sites', siteId, 'webserver'],
    queryFn: () => api.get(`/sites/${siteId}/webserver`),
  });

  return (
    <div className="space-y-6">
      {/* SSL Certificate */}
      <Card title="SSL Certificate">
        {ssl ? (
          <div className="space-y-4">
            {/* Status Header */}
            <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  (ssl as any).expiresAt && new Date((ssl as any).expiresAt) > new Date()
                    ? 'bg-foreground-success'
                    : 'bg-foreground-error'
                }`} />
                <span className="text-small font-medium">
                  {(ssl as any).expiresAt && new Date((ssl as any).expiresAt) > new Date()
                    ? 'Valid Certificate'
                    : 'Expired Certificate'}
                </span>
              </div>
              <div className="text-meta text-foreground-tertiary">
                {(ssl as any).expiresAt ? (
                  <>Expires {new Date((ssl as any).expiresAt).toLocaleDateString()}</>
                ) : 'No expiry date'}
              </div>
            </div>

            {/* Certificate Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-small">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Domain</span>
                  <span className="font-mono">{(ssl as any).domain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Issuer</span>
                  <span className="truncate max-w-[150px]">{(ssl as any).issuer || "Let's Encrypt"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Provider</span>
                  <span>{(ssl as any).type === 'letsencrypt' ? "Let's Encrypt" : (ssl as any).type === 'custom' ? 'Custom' : 'Self-Signed'}</span>
                </div>
              </div>
              <div className="space-y-2 text-small">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Valid From</span>
                  <span>{(ssl as any).issuedAt ? new Date((ssl as any).issuedAt).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Valid Until</span>
                  <span>{(ssl as any).expiresAt ? new Date((ssl as any).expiresAt).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Days Left</span>
                  <span className={(ssl as any).daysUntilExpiry !== null && (ssl as any).daysUntilExpiry < 30 ? 'text-foreground-error' : ''}>
                    {(ssl as any).daysUntilExpiry !== null ? (ssl as any).daysUntilExpiry : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Domains Covered */}
            {(ssl as any).sanDomains && (ssl as any).sanDomains.length > 0 && (
              <div className="p-3 bg-background-secondary rounded-lg">
                <div className="text-meta text-foreground-tertiary mb-2">Domains Covered</div>
                <div className="flex flex-wrap gap-2">
                  {(ssl as any).sanDomains.map((domain: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-background-tertiary rounded text-small font-mono">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-Renew Toggle */}
            <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-small">Auto-renew</span>
                <span className="text-meta text-foreground-tertiary">Automatically renew before expiry</span>
              </div>
              <button
                onClick={handleToggleAutoRenew}
                disabled={toggleAutoRenew.isPending}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  (ssl as any).autoRenew ? 'bg-foreground-success' : 'bg-background-tertiary'
                } ${toggleAutoRenew.isPending ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    (ssl as any).autoRenew ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="default"
                size="small"
                onClick={handleRenewCert}
                loading={renewCert.isPending}
                icon={<Icon name="icon-refresh" size={15} />}
              >
                Renew
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  icon={<Icon name="icon-download" size={15} />}
                >
                  Download
                </Button>
                {showDownloadMenu && (
                  <div className="absolute right-0 mt-1 w-36 bg-background-secondary border border-border-tertiary rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => handleDownloadCert('cert')}
                      className="w-full px-3 py-2 text-left text-small hover:bg-background-tertiary rounded-t-lg"
                    >
                      Certificate (.pem)
                    </button>
                    <button
                      onClick={() => handleDownloadCert('key')}
                      className="w-full px-3 py-2 text-left text-small hover:bg-background-tertiary"
                    >
                      Private Key
                    </button>
                    <button
                      onClick={() => handleDownloadCert('chain')}
                      className="w-full px-3 py-2 text-left text-small hover:bg-background-tertiary rounded-b-lg"
                    >
                      Full Chain
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="flex flex-col items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-background-tertiary flex items-center justify-center">
                <Icon name="icon-lock" size={20} className="text-foreground-tertiary" />
              </span>
              <p className="text-small text-foreground-secondary">No SSL certificate configured</p>
            </div>
            <Button onClick={() => setShowIssue(true)}>Issue Certificate</Button>
          </div>
        )}
      </Card>

      {/* PHP & Webserver */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="PHP Configuration">
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Version</span>
              <span>{(phpConfig as any)?.version || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Memory Limit</span>
              <span>{(phpConfig as any)?.memoryLimit || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Max Execution Time</span>
              <span>{(phpConfig as any)?.maxExecutionTime || '—'}</span>
            </div>
          </div>
        </Card>

        <Card title="Webserver Configuration">
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Force HTTPS</span>
              <span>{(config as any)?.forceHttps ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Gzip</span>
              <span>{(config as any)?.gzip ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Caching</span>
              <span>{(config as any)?.caching || '—'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* DNS Records */}
      <Card title="DNS Records">
        {records && records.length > 0 ? (
          <div className="space-y-2">
            {records.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                <div className="font-mono text-small">{r.type} {r.name}</div>
                <div className="font-mono text-small text-foreground-secondary">{r.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-foreground-tertiary">No DNS records</p>
        )}
      </Card>

      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue SSL Certificate"
        footer={<><Button variant="ghost" onClick={() => setShowIssue(false)}>Cancel</Button><Button variant="primary" onClick={handleIssueCert} loading={issueCert.isPending}>Issue</Button></>}>
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">Issue a Let's Encrypt certificate for <span className="font-mono">{siteName}</span></p>
          <Input label="Email" type="email" value={certEmail} onChange={(e) => setCertEmail(e.target.value)} placeholder="admin@example.com" required />
          <div className="p-3 bg-background-tertiary rounded-md">
            <div className="text-meta text-foreground-tertiary">Certificate will auto-renew 30 days before expiration</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SchedulerTab({ siteId, siteName, onAddCron, queryClient }: { siteId: string; siteName: string; onAddCron: () => void; queryClient: any }) {
  const { data: logs, refetch, isLoading, dataUpdatedAt } = useSiteLogs(siteId);
  const [logFilter, setLogFilter] = useState<'all' | 'access' | 'error'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warning' | 'info' | 'debug'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [cronSchedule, setCronSchedule] = useState('');
  const [cronCommand, setCronCommand] = useState('');
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const createCron = useCreateCronJob();
  const runCron = useRunCronJob();
  const toggleCron = useToggleCronJob();
  const deleteCron = useDeleteCronJob();

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const handleCreateCron = async () => {
    if (!cronSchedule || !cronCommand) return;
    try {
      await createCron.mutateAsync({ schedule: cronSchedule, command: cronCommand, siteId });
      toast.success('Cron job created');
      setShowAdd(false);
      setCronSchedule('');
      setCronCommand('');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cron'] });
    } catch (err: any) {
      toast.error(`Failed to create cron job: ${err.message}`);
    }
  };

  const { data: cronJobs } = useQuery({
    queryKey: ['sites', siteId, 'cron'],
    queryFn: () => api.get(`/sites/${siteId}/cron`).then((r: any) => r.data?.items || []),
  });

  // Parse and filter logs with enhanced filtering
  const parseLogLines = () => {
    const rawLogs = (logs as any)?.logs || (logs as any) || '';
    let lines = rawLogs.split('\n').filter((line: string) => line.trim());
    
    // Apply date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start).getTime();
      lines = lines.filter((line: string) => {
        const dateMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
        if (dateMatch) {
          const lineDate = new Date(dateMatch[1]).getTime();
          return lineDate >= startDate;
        }
        return true;
      });
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end).getTime();
      lines = lines.filter((line: string) => {
        const dateMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
        if (dateMatch) {
          const lineDate = new Date(dateMatch[1]).getTime();
          return lineDate <= endDate;
        }
        return true;
      });
    }

    // Apply log type filter
    if (logFilter === 'access') {
      lines = lines.filter((line: string) => line.match(/\d{3}\s+\d+/));
    } else if (logFilter === 'error') {
      lines = lines.filter((line: string) => line.toLowerCase().includes('error') || line.match(/\[\d{4}[-\d]+\s+\d{2}:\d{2}:\d{2}\]\s*\[error\]/i));
    }

    // Apply level filter
    if (levelFilter !== 'all') {
      lines = lines.filter((line: string) => {
        const lowerLine = line.toLowerCase();
        switch (levelFilter) {
          case 'error':
            return lowerLine.includes('error') || lowerLine.includes('fatal') || lowerLine.includes('crit');
          case 'warning':
            return lowerLine.includes('warn') && !lowerLine.includes('error');
          case 'info':
            return lowerLine.includes('info') && !lowerLine.includes('warn');
          case 'debug':
            return lowerLine.includes('debug') || lowerLine.includes('trace');
          default:
            return true;
        }
      });
    }

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      lines = lines.filter((line: string) => line.toLowerCase().includes(term));
    }

    return lines;
  };

  const filteredLogLines = parseLogLines();
  const logCount = filteredLogLines.length;
  const totalCount = ((logs as any)?.logs || (logs as any) || '').split('\n').filter((l: string) => l.trim()).length;
  
  // Format last updated time
  const lastUpdatedText = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';
  const dateRangeText = dateRange.start || dateRange.end 
    ? `${dateRange.start ? new Date(dateRange.start).toLocaleString() : 'start'} - ${dateRange.end ? new Date(dateRange.end).toLocaleString() : 'end'}`
    : 'All time';

  if (showAdd) {
    return (
      <Card title="Add Cron Job">
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">Adding cron job for <span className="font-mono">{siteName}</span></p>
          <Input label="Schedule (cron expression)" value={cronSchedule} onChange={(e) => setCronSchedule(e.target.value)} placeholder="*/5 * * * *" />
          <Input label="Command" value={cronCommand} onChange={(e) => setCronCommand(e.target.value)} placeholder="/usr/bin/php /var/www/artisan schedule:run" />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateCron} loading={createCron.isPending}>Create</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cron Jobs */}
      <Card title="Cron Jobs" action={<Button size="small" onClick={() => setShowAdd(true)} icon={<Icon name="icon-plus" size={15} />}>Add Job</Button>}>
        {cronJobs && cronJobs.length > 0 ? (
          <div className="space-y-2">
            {cronJobs.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                <div>
                  <span className="text-small font-medium">{job.name}</span>
                  <span className="text-meta text-foreground-tertiary ml-2 font-mono">{job.schedule}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="small" onClick={() => runCron.mutate(job.id, { onSuccess: () => toast.success('Cron job started'), onError: (err: any) => toast.error(`Failed to run: ${err.message}`) })} loading={runCron.isPending} icon={<Icon name="icon-play" size={15} />}>Run</Button>
                  <Button variant="ghost" size="small" onClick={() => toggleCron.mutate(job.id, { onSuccess: () => { toast.success('Cron job toggled'); queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cron'] }); }, onError: (err: any) => toast.error(`Failed to toggle: ${err.message}`) })} loading={toggleCron.isPending} icon={<Icon name="icon-refresh" size={15} />}>Toggle</Button>
                  <Button variant="ghost" size="small" onClick={() => setDeleteJobId(job.id)} icon={<Icon name="icon-trash" size={15} />} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-small text-foreground-secondary mb-4">No cron jobs configured</p>
            <Button onClick={() => setShowAdd(true)}>Add Cron Job</Button>
          </div>
        )}
      </Card>

      {/* Logs */}
      <Card title="Access & Error Logs" action={
        <div className="flex gap-2 items-center">
          <span className="text-meta text-foreground-tertiary">
            {logCount} / {totalCount} entries • {dateRangeText}
          </span>
          <select 
            value={logFilter} 
            onChange={(e) => setLogFilter(e.target.value as any)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary text-foreground-secondary"
          >
            <option value="all">All Logs</option>
            <option value="access">Access Logs</option>
            <option value="error">Error Logs</option>
          </select>
          <select 
            value={levelFilter} 
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary text-foreground-secondary"
          >
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <Button size="small" variant="ghost" onClick={() => refetch()} icon={<Icon name="icon-refresh" size={15} />}>
            Refresh
          </Button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`h-[34px] px-3 text-small rounded-md border transition-colors ${
              autoRefresh 
                ? 'border-foreground-success bg-foreground-success/10 text-foreground-success' 
                : 'border-border-tertiary bg-background-primary text-foreground-secondary'
            }`}
          >
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      }>
        {/* Search and Date Range Filters */}
        <div className="mb-4 space-y-3">
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="w-full h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-secondary placeholder:text-foreground-tertiary text-foreground-primary"
          />
          <div className="flex gap-2 items-center">
            <span className="text-meta text-foreground-tertiary">Date range:</span>
            <input 
              type="datetime-local" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="h-[34px] px-2 text-small rounded-md border border-border-tertiary bg-background-secondary text-foreground-primary"
            />
            <span className="text-meta text-foreground-tertiary">to</span>
            <input 
              type="datetime-local" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="h-[34px] px-2 text-small rounded-md border border-border-tertiary bg-background-secondary text-foreground-primary"
            />
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                className="text-meta text-foreground-secondary hover:text-foreground-primary"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-meta text-foreground-tertiary">
            Last updated: {lastUpdatedText}
            {autoRefresh && <span className="ml-2 text-foreground-success">• Auto-refreshing every 30s</span>}
          </span>
          {searchTerm && (
            <span className="text-meta text-foreground-secondary">
              Showing {logCount} of {totalCount} entries matching "{searchTerm}"
            </span>
          )}
        </div>
        <div className="relative">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-small text-foreground-tertiary">Loading logs...</span>
            </div>
          ) : filteredLogLines.length > 0 ? (
            <pre className="font-mono text-small bg-black text-foreground-secondary p-3 rounded-md overflow-auto max-h-[500px]">
              {filteredLogLines.join('\n')}
            </pre>
          ) : (
            <div className="text-center py-8">
              <p className="text-small text-foreground-secondary">No logs available</p>
              {searchTerm && (
                <p className="text-meta text-foreground-tertiary mt-1">Try adjusting your search or filters</p>
              )}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={!!deleteJobId}
        onClose={() => setDeleteJobId(null)}
        onConfirm={() => {
          if (!deleteJobId) return;
          deleteCron.mutate(deleteJobId, {
            onSuccess: () => {
              toast.success('Cron job deleted');
              setDeleteJobId(null);
              queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cron'] });
            },
            onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
          });
        }}
        title="Delete Cron Job"
        description="This cron job will be permanently deleted."
        confirmText="Delete"
        impact="medium"
        loading={deleteCron.isPending}
      />
    </div>
  );
}

function DomainsTab({ siteId, siteName, queryClient }: { siteId: string; siteName: string; queryClient: any }) {
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [showCreateSubdomain, setShowCreateSubdomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newAliasName, setNewAliasName] = useState('');
  const [subdomainPrefix, setSubdomainPrefix] = useState('');
  const [detachDomainId, setDetachDomainId] = useState<string | null>(null);
  const [deleteDomainId, setDeleteDomainId] = useState<string | null>(null);

  const { data: siteDomains, isLoading: domainsLoading, refetch: refetchDomains } = useSiteDomains(siteId);
  const attachDomain = useAttachDomainToSite();
  const detachDomain = useDetachDomainFromSite();
  const createDomain = useCreateDomain();
  const deleteDomain = useDeleteDomain();
  const createSubdomain = useCreateSubdomain(siteDomains?.[0]?.id || '');

  // Get parent domain name for subdomain preview
  const parentDomainName = siteDomains?.[0]?.name || 'example.com';
  const parentDomainId = siteDomains?.[0]?.id;

  const handleCreateSubdomain = async () => {
    if (!subdomainPrefix || !parentDomainId) return;
    try {
      const fullSubdomainName = `${subdomainPrefix}.${parentDomainName}`;
      const subdomain = await createSubdomain.mutateAsync({
        name: fullSubdomainName,
        documentRoot: `/var/www/${subdomainPrefix}`,
        websiteId: siteId,
      }) as any;
      toast.success(`Subdomain "${fullSubdomainName}" created`);
      setShowCreateSubdomain(false);
      setSubdomainPrefix('');
      // Subdomains created via the API are already linked, just refresh
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'domains'] });
      queryClient.invalidateQueries({ queryKey: ['domains', parentDomainId, 'subdomains'] });
    } catch (err: any) {
      toast.error(`Failed to create subdomain: ${err.message}`);
    }
  };

  const handleAttachDomain = async (domainId: string) => {
    try {
      await attachDomain.mutateAsync({ siteId, domainId });
      toast.success('Domain attached to site');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'domains'] });
    } catch (err: any) {
      toast.error(`Failed to attach domain: ${err.message}`);
    }
  };

  const handleDetachDomain = async (domainId: string) => {
    try {
      await detachDomain.mutateAsync({ siteId, domainId });
      toast.success('Domain detached from site');
      setDetachDomainId(null);
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'domains'] });
    } catch (err: any) {
      toast.error(`Failed to detach domain: ${err.message}`);
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomainName) return;
    try {
      const domain = await createDomain.mutateAsync({
        name: newDomainName,
        siteId,
        type: 'apex',
      });
      toast.success(`Domain "${newDomainName}" created`);
      setShowAddDomain(false);
      setNewDomainName('');
      // Auto-attach to site
      if (domain?.id) {
        await attachDomain.mutateAsync({ siteId, domainId: domain.id });
      }
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'domains'] });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    } catch (err: any) {
      toast.error(`Failed to create domain: ${err.message}`);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await deleteDomain.mutateAsync(domainId);
      toast.success('Domain deleted');
      setDeleteDomainId(null);
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'domains'] });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    } catch (err: any) {
      toast.error(`Failed to delete domain: ${err.message}`);
    }
  };

  const getSslStatusBadge = (sslStatus: string | undefined) => {
    switch (sslStatus) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-success/10 text-foreground-success text-meta">Active</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-warning/10 text-foreground-warning text-meta">Pending</span>;
      case 'expired':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-danger/10 text-foreground-danger text-meta">Expired</span>;
      case 'error':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-danger/10 text-foreground-danger text-meta">Error</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-tertiary/10 text-foreground-tertiary text-meta">Not Configured</span>;
    }
  };

  const getDnsStatusBadge = (domain: Domain) => {
    // Check if domain points to server based on dns verification
    if (domain.status === 'active') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-success/10 text-foreground-success text-meta">Verified</span>;
    }
    if (domain.status === 'pending') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-warning/10 text-foreground-warning text-meta">Pending</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-tertiary/10 text-foreground-tertiary text-meta">Unknown</span>;
  };

  return (
    <div className="space-y-6">
      {/* Domain List */}
      <Card
        title="Domains"
        action={
          <div className="flex gap-2">
            <Button size="small" variant="ghost" onClick={() => refetchDomains()} icon={<Icon name="icon-refresh" size={15} />}>
              Refresh
            </Button>
            <Button size="small" variant="ghost" onClick={() => setShowCreateSubdomain(true)} icon={<Icon name="icon-plus" size={15} />}>
              Subdomain
            </Button>
            <Button size="small" onClick={() => setShowAddDomain(true)} icon={<Icon name="icon-plus" size={15} />}>
              Add Domain
            </Button>
          </div>
        }
      >
        {domainsLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-small text-foreground-tertiary">Loading domains...</span>
          </div>
        ) : siteDomains && siteDomains.length > 0 ? (
          <div className="space-y-3">
            {siteDomains.map((domain: any) => (
              <div key={domain.id} className="border border-border-tertiary rounded-lg p-4 hover:bg-background-secondary transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background-tertiary">
                      <Icon name="icon-world" size={20} />
                    </div>
                    <div>
                      <div className="text-small font-medium font-mono">{domain.name}</div>
                      <div className="text-meta text-foreground-tertiary capitalize">{domain.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={domain.status} />
                  </div>
                </div>

                {/* Domain Status Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="flex flex-col">
                    <span className="text-meta text-foreground-tertiary">SSL</span>
                    {getSslStatusBadge(domain.sslStatus)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-meta text-foreground-tertiary">DNS</span>
                    {getDnsStatusBadge(domain)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-meta text-foreground-tertiary">Force HTTPS</span>
                    <span className={domain.forceHttps ? 'text-foreground-success' : 'text-foreground-tertiary'}>
                      {domain.forceHttps ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-meta text-foreground-tertiary">Proxy</span>
                    <span className={domain.proxyEnabled ? 'text-foreground-success' : 'text-foreground-tertiary'}>
                      {domain.proxyEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border-tertiary">
                  <Button variant="ghost" size="small" onClick={() => window.open(`https://${domain.name}`, '_blank')} icon={<Icon name="icon-external-link" size={15} />}>
                    Open Site
                  </Button>
                  <Button variant="ghost" size="small" onClick={() => setDetachDomainId(domain.id)} icon={<Icon name="icon-x" size={15} />}>
                    Detach
                  </Button>
                  <Button variant="ghost" size="small" onClick={() => setDeleteDomainId(domain.id)} icon={<Icon name="icon-trash" size={15} />} className="text-foreground-danger hover:text-foreground-danger">
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-background-tertiary mx-auto mb-4">
              <Icon name="icon-world" size={32} className="text-foreground-tertiary" />
            </div>
            <p className="text-small text-foreground-secondary mb-4">No domains attached to this site</p>
            <Button onClick={() => setShowAddDomain(true)}>Add Domain</Button>
          </div>
        )}
      </Card>

      {/* Add Domain Modal */}
      <Modal
        isOpen={showAddDomain}
        onClose={() => {
          setShowAddDomain(false);
          setNewDomainName('');
        }}
        title="Add Domain"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setShowAddDomain(false);
              setNewDomainName('');
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateDomain} loading={createDomain.isPending}>
              Create & Attach
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">
            Create and attach a new domain to <span className="font-mono">{siteName}</span>
          </p>
          <Input
            label="Domain Name"
            value={newDomainName}
            onChange={(e) => setNewDomainName(e.target.value)}
            placeholder="example.com"
          />
          <div className="p-3 bg-background-tertiary rounded-md">
            <div className="text-meta text-foreground-tertiary">
              DNS verification will be performed automatically. Make sure the domain is pointing to this server's IP.
            </div>
          </div>
        </div>
      </Modal>

      {/* Detach Confirmation */}
      <ConfirmDialog
        isOpen={!!detachDomainId}
        onClose={() => setDetachDomainId(null)}
        onConfirm={() => detachDomainId && handleDetachDomain(detachDomainId)}
        title="Detach Domain"
        description="This will remove the domain from this site but not delete it. The domain can be attached to another site later."
        confirmText="Detach"
        impact="medium"
        loading={detachDomain.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteDomainId}
        onClose={() => setDeleteDomainId(null)}
        onConfirm={() => deleteDomainId && handleDeleteDomain(deleteDomainId)}
        title="Delete Domain"
        description="This will permanently delete the domain and all associated configurations. This action cannot be undone."
        confirmText="Delete"
        impact="high"
        loading={deleteDomain.isPending}
      />

      {/* Create Subdomain Modal */}
      <Modal
        isOpen={showCreateSubdomain}
        onClose={() => {
          setShowCreateSubdomain(false);
          setSubdomainPrefix('');
        }}
        title="Quick Create Subdomain"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setShowCreateSubdomain(false);
              setSubdomainPrefix('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleCreateSubdomain} 
              loading={createSubdomain.isPending}
              disabled={!subdomainPrefix.trim()}
            >
              Create Subdomain
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">
            Create a subdomain and attach it to <span className="font-mono">{siteName}</span>
          </p>
          <div className="space-y-2">
            <Input
              label="Subdomain Prefix"
              value={subdomainPrefix}
              onChange={(e) => setSubdomainPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="blog"
            />
            {subdomainPrefix && (
              <div className="p-3 bg-background-tertiary rounded-md">
                <div className="text-meta text-foreground-secondary">Full subdomain:</div>
                <div className="text-small font-mono">{subdomainPrefix}.{parentDomainName}</div>
              </div>
            )}
          </div>
          <div className="p-3 bg-background-tertiary rounded-md">
            <div className="text-meta text-foreground-tertiary">
              Document root: <span className="font-mono">/var/www/{subdomainPrefix || '[prefix]'}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TrafficTab({ siteId }: { siteId: string }) {
  return <TrafficAnalytics siteId={siteId} />;
}

function PhpTab({ siteId, domainId, domainName }: { siteId: string; domainId: string; domainName: string }) {
  return <PhpConfigEditor siteId={siteId} domainName={domainName} domainId={domainId} />;
}

function EnvVarsTab({ siteId }: { siteId: string }) {
  return <EnvVarsEditor siteId={siteId} />;
}

function ActivityTab({ siteId, siteName }: { siteId: string; siteName: string }) {
  return <ActivityFeed siteId={siteId} siteName={siteName} />;
}

function LogAnalyticsTab({ siteId, domainId }: { siteId: string; domainId?: string }) {
  return <LogAnalytics siteId={siteId} domainId={domainId} />;
}

function CronTimelineTab({ siteId, domainId }: { siteId: string; domainId?: string }) {
  return <CronTimeline siteId={siteId} domainId={domainId} />;
}

function BackupTab({ siteId, siteName, domainId }: { siteId: string; siteName: string; domainId?: string }) {
  return <BackupManager siteId={siteId} siteName={siteName} domainId={domainId} />;
}

function CacheTab({ siteId, siteName, domainId }: { siteId: string; siteName: string; domainId?: string }) {
  return <CacheManager siteId={siteId} siteName={siteName} domainId={domainId} />;
}