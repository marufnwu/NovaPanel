import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { api } from '../../api/client';

interface ServerStats {
  cpu: number;
  ram: number;
  disk: number;
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

  return (
    <div className="space-y-6">
      <h1 className="text-page-title font-medium">Monitoring</h1>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="px-4 py-2.5 text-small transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab.id ? 500 : 400,
              }}
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
              value={stats?.cpu ?? 0}
              sub="%"
              className={getColor(stats?.cpu ?? 0).replace('text-foreground-', '')}
            />
            <StatCard
              label="RAM"
              value={stats?.ram ?? 0}
              sub="%"
              className={getColor(stats?.ram ?? 0).replace('text-foreground-', '')}
            />
            <StatCard
              label="Disk"
              value={stats?.disk ?? 0}
              sub="%"
              className={getColor(stats?.disk ?? 0).replace('text-foreground-', '')}
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
                        width: `${stats?.cpu ?? 0}%`,
                        backgroundColor: stats && stats.cpu >= 90 ? 'var(--color-text-danger)' : stats && stats.cpu >= 70 ? 'var(--color-text-warning)' : 'var(--color-text-success)',
                      }}
                    />
                  </div>
                  <span className="text-small font-mono">{stats?.cpu ?? 0}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-small">RAM Usage</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${stats?.ram ?? 0}%`,
                        backgroundColor: stats && stats.ram >= 90 ? 'var(--color-text-danger)' : stats && stats.ram >= 70 ? 'var(--color-text-warning)' : 'var(--color-text-success)',
                      }}
                    />
                  </div>
                  <span className="text-small font-mono">{stats?.ram ?? 0}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-small">Disk Usage</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${stats?.disk ?? 0}%`,
                        backgroundColor: stats && stats.disk >= 90 ? 'var(--color-text-danger)' : stats && stats.disk >= 70 ? 'var(--color-text-warning)' : 'var(--color-text-success)',
                      }}
                    />
                  </div>
                  <span className="text-small font-mono">{stats?.disk ?? 0}%</span>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'alerts' && (
        <Card title="Alert Rules">
          <p className="text-small text-foreground-tertiary text-center py-8">No alert rules configured</p>
        </Card>
      )}

      {activeTab === 'metrics' && (
        <Card title="System Metrics">
          <p className="text-small text-foreground-tertiary text-center py-8">Metrics coming soon</p>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card title="Alert History">
          <p className="text-small text-foreground-tertiary text-center py-8">No alert history</p>
        </Card>
      )}
    </div>
  );
}