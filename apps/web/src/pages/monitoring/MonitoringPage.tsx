import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api } from '../../api/client';
import {
  useMetrics,
  useAlertRules,
  useUpdateAlertRule,
  useAlertHistory,
  type Metric,
  type AlertRule,
  type AlertHistory,
} from '../../api/hooks/monitoring';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../lib/toast';

interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; available: number; cached?: number; buffered?: number; usagePercent?: number };
  disk: { total: number; used: number; available: number; usagePercent?: number; mount?: string };
  uptime: number;
}

export function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'metrics' | 'history'>('overview');

  const { data: stats, isLoading } = useQuery<ServerStats>({
    queryKey: ['stats', 'server'],
    queryFn: () => api.get('/stats/server'),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'history', label: 'History' },
  ];

  const getColor = (value: number) => {
    if (value >= 90) return 'text-foreground-danger';
    if (value >= 70) return 'text-foreground-warning';
    return 'text-foreground-success';
  };

  const cpuUsage = stats?.cpu?.usage ?? 0;
  const ramUsage = stats?.memory?.usagePercent ?? 0;
  const diskUsage = stats?.disk?.usagePercent ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-page-title font-medium">Monitoring</h1>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="CPU"
              value={cpuUsage}
              sub="%"
              className={getColor(cpuUsage).replace('text-foreground-', '')}
            />
            <StatCard
              label="RAM"
              value={ramUsage}
              sub="%"
              className={getColor(ramUsage).replace('text-foreground-', '')}
            />
            <StatCard
              label="Disk"
              value={diskUsage}
              sub="%"
              className={getColor(diskUsage).replace('text-foreground-', '')}
            />
            <StatCard
              label="Uptime"
              value={stats?.uptime ? `${Math.floor(stats.uptime / 86400)}d` : '—'}
            />
          </div>

          <Card title="Server Health">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-small">CPU Usage</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${cpuUsage}%`,
                        backgroundColor: cpuUsage >= 90 ? 'var(--color-text-danger)' : cpuUsage >= 70 ? 'var(--color-text-warning)' : 'var(--color-text-success)',
                      }}
                    />
                  </div>
                  <span className="text-small font-mono">{cpuUsage}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-small">RAM Usage</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${ramUsage}%`,
                        backgroundColor: ramUsage >= 90 ? 'var(--color-text-danger)' : ramUsage >= 70 ? 'var(--color-text-warning)' : 'var(--color-text-success)',
                      }}
                    />
                  </div>
                  <span className="text-small font-mono">{ramUsage}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-small">Disk Usage</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${diskUsage}%`,
                        backgroundColor: diskUsage >= 90 ? 'var(--color-text-danger)' : diskUsage >= 70 ? 'var(--color-text-warning)' : 'var(--color-text-success)',
                      }}
                    />
                  </div>
                  <span className="text-small font-mono">{diskUsage}%</span>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'alerts' && <AlertsTab />}
      {activeTab === 'metrics' && <MetricsTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

function AlertsTab() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const { data: rules, isLoading, isError, error, refetch } = useAlertRules(activeOrgId ?? '');
  const updateRule = useUpdateAlertRule();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const handleToggle = async (rule: AlertRule) => {
    updateRule.mutateAsync(
      { id: rule.id, data: { enabled: !rule.enabled } },
      {
        onSuccess: () => toast.success(rule.enabled ? 'Alert rule disabled' : 'Alert rule enabled'),
        onError: (err: any) => toast.error(`Failed to update alert rule: ${err.message}`),
      }
    );
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (r: AlertRule) => (
        <div>
          <span className="font-medium">{r.name}</span>
          <p className="text-small text-foreground-tertiary">{r.description}</p>
        </div>
      ),
    },
    {
      key: 'metric',
      label: 'Metric',
      render: (r: AlertRule) => <span className="text-foreground-secondary">{r.metric}</span>,
    },
    {
      key: 'condition',
      label: 'Condition',
      render: (r: AlertRule) => (
        <span className="font-mono text-small">
          {r.metric} {r.condition} {r.threshold}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (r: AlertRule) => (
        <StatusBadge status={r.enabled ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: AlertRule) => (
        <Button
          variant="ghost"
          size="small"
          onClick={() => handleToggle(r)}
        >
          {r.enabled ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  return (
    <Card title="Alert Rules">
      {rules && rules.length > 0 ? (
        <DataTable columns={columns} data={rules} rowKey={(r) => r.id} />
      ) : (
        <EmptyState
          icon="icon-bell"
          title="No alert rules"
          description="Alert rules will appear here"
        />
      )}
    </Card>
  );
}

function MetricsTab() {
  const { data: metrics, isLoading, isError, error, refetch } = useMetrics();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  return (
    <Card title="System Metrics">
      {metrics && metrics.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-tertiary">
              <th className="text-left text-small font-medium text-foreground-secondary pb-2">Name</th>
              <th className="text-left text-small font-medium text-foreground-secondary pb-2">Labels</th>
              <th className="text-right text-small font-medium text-foreground-secondary pb-2">Value</th>
              <th className="text-right text-small font-medium text-foreground-secondary pb-2">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: Metric) => (
              <tr key={m.id} className="border-b border-border-tertiary last:border-0">
                <td className="py-2 font-mono text-small">{m.name}</td>
                <td className="py-2 text-small text-foreground-secondary">
                  {Object.entries(m.labels).map(([k, v]) => `${k}=${v}`).join(', ') || '—'}
                </td>
                <td className="py-2 text-right font-mono text-small">{m.value}</td>
                <td className="py-2 text-right text-small text-foreground-secondary">
                  {new Date(m.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          icon="icon-chart"
          title="No metrics"
          description="Metrics will appear here"
        />
      )}
    </Card>
  );
}

function HistoryTab() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const { data: history, isLoading, isError, error, refetch } = useAlertHistory(activeOrgId ?? '');

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  return (
    <Card title="Alert History">
      {history && history.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-tertiary">
              <th className="text-left text-small font-medium text-foreground-secondary pb-2">Rule</th>
              <th className="text-left text-small font-medium text-foreground-secondary pb-2">Value</th>
              <th className="text-left text-small font-medium text-foreground-secondary pb-2">Triggered</th>
              <th className="text-left text-small font-medium text-foreground-secondary pb-2">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h: AlertHistory) => (
              <tr key={h.id} className="border-b border-border-tertiary last:border-0">
                <td className="py-2 font-medium text-small">{h.ruleName}</td>
                <td className="py-2 font-mono text-small">{h.value}</td>
                <td className="py-2 text-small text-foreground-secondary">
                  {new Date(h.triggeredAt).toLocaleString()}
                </td>
                <td className="py-2 text-small text-foreground-secondary">
                  {h.resolvedAt ? new Date(h.resolvedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          icon="icon-clock"
          title="No alert history"
          description="Alert history will appear here"
        />
      )}
    </Card>
  );
}