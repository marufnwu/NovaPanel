import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { useProcesses, useStopProcess, useRestartProcess, useDeleteProcess, type ProcessInfo } from '../../api/hooks/processes';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

type StatusFilter = 'all' | 'online' | 'stopped' | 'errored';

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Running' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'errored', label: 'Errored' },
];

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatMemory(mb: number | undefined): string {
  if (!mb) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function ProcessesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteProcessName, setDeleteProcessName] = useState<string | null>(null);

  const { data: processes, isLoading, isError, error, refetch } = useProcesses();
  const stopProcess = useStopProcess();
  const restartProcess = useRestartProcess();
  const deleteProcess = useDeleteProcess();

  const handleStop = (name: string) => {
    stopProcess.mutate(name, {
      onSuccess: () => toast.success('Process stopped'),
      onError: (err) => toast.error(`Failed to stop process: ${err.message}`),
    });
  };

  const handleRestart = (name: string) => {
    restartProcess.mutate(name, {
      onSuccess: () => toast.success('Process restarted'),
      onError: (err) => toast.error(`Failed to restart process: ${err.message}`),
    });
  };

  const handleDelete = () => {
    if (!deleteProcessName) return;
    deleteProcess.mutate(deleteProcessName, {
      onSuccess: () => {
        toast.success('Process deleted');
        setDeleteProcessName(null);
      },
      onError: (err) => toast.error(`Failed to delete process: ${err.message}`),
    });
  };

  const getStatusBadge = (status: ProcessInfo['status']) => {
    switch (status.status) {
      case 'online':
        return <StatusBadge status="running" />;
      case 'stopped':
        return <StatusBadge status="stopped" />;
      case 'errored':
        return <StatusBadge status="error" />;
      case 'launching':
        return <StatusBadge status="pending" />;
      default:
        return <StatusBadge status="inactive" />;
    }
  };

  // Filter processes
  const filteredProcesses = (processes || []).filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (p: ProcessInfo) => (
        <div className="flex items-center gap-2">
          <Icon name="icon-box" size={16} className="text-foreground-info" />
          <span className="font-mono font-medium">{p.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: ProcessInfo) => getStatusBadge(p.status),
    },
    {
      key: 'cpu',
      label: 'CPU',
      render: (p: ProcessInfo) => (
        <span className="text-small">{p.status.cpuPercent != null ? `${p.status.cpuPercent.toFixed(1)}%` : '—'}</span>
      ),
    },
    {
      key: 'memory',
      label: 'Memory',
      render: (p: ProcessInfo) => (
        <span className="text-small">{formatMemory(p.status.memoryMb)}</span>
      ),
    },
    {
      key: 'restarts',
      label: 'Restarts',
      render: (p: ProcessInfo) => (
        <span className="text-small text-foreground-secondary">{p.status.restartCount}</span>
      ),
    },
    {
      key: 'uptime',
      label: 'Uptime',
      render: (p: ProcessInfo) => (
        <span className="text-small text-foreground-secondary">{formatUptime(p.status.uptime)}</span>
      ),
    },
    {
      key: 'pid',
      label: 'PID',
      render: (p: ProcessInfo) => (
        <span className="text-small font-mono text-foreground-secondary">{p.status.pid || '—'}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (p: ProcessInfo) => (
        <div className="flex gap-1">
          {p.status.running ? (
            <Button
              variant="ghost"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleStop(p.name);
              }}
              icon={<Icon name="icon-stop" size={15} />}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                // Would need start logic with config
              }}
              icon={<Icon name="icon-play" size={15} />}
            >
              Start
            </Button>
          )}
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleRestart(p.name);
            }}
            icon={<Icon name="icon-refresh-cw" size={15} />}
          >
            Restart
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteProcessName(p.name);
            }}
            icon={<Icon name="icon-trash" size={15} />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title font-medium">Process Manager</h1>
          <p className="text-small text-foreground-secondary mt-0.5">
            Manage PM2 processes
          </p>
        </div>
        <Button variant="default" size="small" onClick={() => refetch()} icon={<Icon name="icon-refresh-cw" size={15} />}>
          Refresh
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <Input
          placeholder="Search processes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="flex gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter.label}
            variant={statusFilter === filter.value ? 'primary' : 'default'}
            size="small"
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filteredProcesses.length > 0 ? (
        <Card>
          <DataTable columns={columns} data={filteredProcesses} rowKey={(p) => p.name} />
        </Card>
      ) : (
        <EmptyState
          icon="icon-box"
          title="No processes found"
          description={searchQuery || statusFilter !== 'all' ? 'No processes match your filters' : 'No PM2 processes are running'}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteProcessName}
        onClose={() => setDeleteProcessName(null)}
        onConfirm={handleDelete}
        title="Delete Process"
        description="This action cannot be undone. The process will be stopped and removed."
        confirmText="Delete"
        impact="high"
        loading={deleteProcess.isPending}
      />
    </div>
  );
}