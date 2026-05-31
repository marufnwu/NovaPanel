import { useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useContainer, useStartContainer, useStopContainer, useRestartContainer, useContainerLogs, type Container } from '../../api/hooks/containers';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function ContainerDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split('/containers/');
  const containerId = pathParts[1]?.split('/')[0] || '';
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'overview';

  if (!containerId) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-foreground-secondary">Container ID is required</p>
      </div>
    );
  }

  const queryClient = useQueryClient();

  const { data: container, isLoading, isError, error, refetch } = useContainer(containerId);
  const startContainer = useStartContainer();
  const stopContainer = useStopContainer();
  const restartContainer = useRestartContainer();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'logs', label: 'Logs' },
  ];

  const handleTabChange = (tabId: string) => {
    navigate({ search: { tab: tabId } } as any);
  };

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  if (!container) return <ErrorState message="Container not found" />;

  const isRunning = container.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-page-title font-medium font-mono">{container.name}</h1>
          <StatusBadge status={isRunning ? 'active' : 'inactive'} />
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <Button variant="ghost" size="small" onClick={() => stopContainer.mutate(containerId, { onSuccess: () => { toast.success('Container stopped'); queryClient.invalidateQueries({ queryKey: ['containers', containerId] }); }, onError: (err: any) => toast.error(`Failed to stop: ${err.message}`) })} loading={stopContainer.isPending} icon={<Icon name="icon-pause" size={15} />}>Stop</Button>
          ) : (
            <Button variant="ghost" size="small" onClick={() => startContainer.mutate(containerId, { onSuccess: () => { toast.success('Container started'); queryClient.invalidateQueries({ queryKey: ['containers', containerId] }); }, onError: (err: any) => toast.error(`Failed to start: ${err.message}`) })} loading={startContainer.isPending} icon={<Icon name="icon-play" size={15} />}>Start</Button>
          )}
          <Button variant="ghost" size="small" onClick={() => restartContainer.mutate(containerId, { onSuccess: () => { toast.success('Container restarted'); queryClient.invalidateQueries({ queryKey: ['containers', containerId] }); }, onError: (err: any) => toast.error(`Failed to restart: ${err.message}`) })} loading={restartContainer.isPending} icon={<Icon name="icon-refresh" size={15} />}>Restart</Button>
        </div>
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
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

      {activeTab === 'overview' && <OverviewTab container={container} />}
      {activeTab === 'logs' && <LogsTab containerId={containerId} />}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          // Delete handled at ContainersPage level
          setShowDeleteConfirm(false);
        }}
        title="Delete Container"
        description="This container and all its data will be permanently deleted."
        confirmText="Delete"
        impact="high"
      />
    </div>
  );
}

function OverviewTab({ container }: { container: Container }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card title="Container Info">
        <div className="space-y-2 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Name</span>
            <span>{container.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Type</span>
            <span className="capitalize">{container.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Image</span>
            <span className="font-mono text-small">{container.image || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Created</span>
            <span>{new Date(container.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </Card>
      <Card title="Resources">
        <div className="space-y-2 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">CPU Limit</span>
            <span>{(container as any).cpuLimit || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Memory Limit</span>
            <span>{(container as any).memoryLimit || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Replicas</span>
            <span>{(container as any).replicas ?? 1}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LogsTab({ containerId }: { containerId: string }) {
  const { data: logs, isLoading, isError, error, refetch } = useContainerLogs(containerId);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  return (
    <Card title="Container Logs">
      {logs ? (
        <pre className="text-meta font-mono text-small whitespace-pre-wrap">{(logs as any).logs || logs}</pre>
      ) : (
        <EmptyState icon="icon-document" title="No logs" description="Log output not available" />
      )}
    </Card>
  );
}
