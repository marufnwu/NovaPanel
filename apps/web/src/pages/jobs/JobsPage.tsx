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
import { useJobs, useCancelJob, type BackgroundJob, type JobStatus } from '../../api/hooks/jobs';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function JobsPage() {
  const queryClient = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>(undefined);

  const { data: jobs, isLoading, isError, error, refetch } = useJobs({ status: statusFilter });
  const cancelJob = useCancelJob();

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await cancelJob.mutateAsync(cancelId);
      setCancelId(null);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job cancelled');
    } catch (err: any) {
      toast.error(`Failed to cancel job: ${err.message}`);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '—';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diff = endTime - startTime;
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
    return `${(diff / 60000).toFixed(1)}m`;
  };

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (j: BackgroundJob) => (
        <div>
          <span className="font-medium">{j.type}</span>
          <p className="text-small text-foreground-tertiary capitalize">{j.status.replace('_', ' ')}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (j: BackgroundJob) => {
        const statusMap: Record<JobStatus, 'running' | 'stopped' | 'pending' | 'active' | 'inactive' | 'completed' | 'failed' | 'deploying' | 'restoring' | 'expired'> = {
          pending: 'pending',
          running: 'running',
          success: 'completed',
          failed: 'failed',
        };
        return <StatusBadge status={statusMap[j.status] || 'pending'} />;
      },
    },
    {
      key: 'attempts',
      label: 'Attempts',
      render: (j: BackgroundJob) => (
        <span className="text-foreground-secondary">
          {j.attempts}/{j.maxAttempts}
        </span>
      ),
    },
    {
      key: 'runAt',
      label: 'Scheduled',
      render: (j: BackgroundJob) => <span className="text-foreground-secondary text-small">{formatDate(j.runAt)}</span>,
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (j: BackgroundJob) => <span className="text-foreground-secondary">{formatDuration(j.startedAt, j.completedAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (j: BackgroundJob) => (
        <div className="flex gap-1">
          {(j.status === 'pending' || j.status === 'running') && (
            <Button
              variant="ghost"
              size="small"
              onClick={() => setCancelId(j.id)}
              icon={<Icon name="icon-x" size={15} />}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  const statusFilters: { value: JobStatus | undefined; label: string }[] = [
    { value: undefined, label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'running', label: 'Running' },
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Background Jobs</h1>
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

      {jobs && jobs.length > 0 ? (
        <Card>
          <DataTable
            columns={columns}
            data={jobs}
            rowKey={(j) => j.id}
          />
        </Card>
      ) : (
        <EmptyState
          icon="icon-jobs"
          title="No jobs"
          description="Background jobs will appear here"
        />
      )}

      <ConfirmDialog
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="Cancel Job"
        description="This job will be cancelled and won't execute."
        confirmText="Cancel Job"
        impact="medium"
        loading={cancelJob.isPending}
      />
    </div>
  );
}