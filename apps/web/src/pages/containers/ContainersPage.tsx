import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useContainers,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
  useDeleteContainer,
  type Container,
} from '../../api/hooks/containers';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function ContainersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const [deleteContainerId, setDeleteContainerId] = useState<string | null>(null);

  const { data: containers, isLoading, isError, error, refetch } = useContainers();
  const startContainer = useStartContainer();
  const stopContainer = useStopContainer();
  const restartContainer = useRestartContainer();
  const deleteContainer = useDeleteContainer();

  const handleStart = (id: string) => {
    startContainer.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['containers'] });
        toast.success('Container started');
      },
      onError: (err) => toast.error(`Failed to start container: ${err.message}`),
    });
  };

  const handleStop = (id: string) => {
    stopContainer.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['containers'] });
        toast.success('Container stopped');
      },
      onError: (err) => toast.error(`Failed to stop container: ${err.message}`),
    });
  };

  const handleRestart = (id: string) => {
    restartContainer.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['containers'] });
        toast.success('Container restarted');
      },
      onError: (err) => toast.error(`Failed to restart container: ${err.message}`),
    });
  };

  const handleDelete = () => {
    if (!deleteContainerId) return;
    deleteContainer.mutate(deleteContainerId, {
      onSuccess: () => {
        toast.success('Container deleted');
        setDeleteContainerId(null);
        queryClient.invalidateQueries({ queryKey: ['containers'] });
      },
      onError: (err) => toast.error(`Failed to delete container: ${err.message}`),
    });
  };

  const getStatusBadge = (status: Container['status']) => {
    switch (status) {
      case 'running':
        return <StatusBadge status="running" />;
      case 'stopped':
        return <StatusBadge status="stopped" />;
      case 'restarting':
        return <StatusBadge status="pending" />;
      case 'exited':
        return <StatusBadge status="inactive" />;
      default:
        return <StatusBadge status="inactive" />;
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (c: Container) => (
        <div className="flex items-center gap-2">
          <Icon name="icon-box" size={16} className="text-foreground-info" />
          <span className="font-mono font-medium">{c.name}</span>
        </div>
      ),
    },
    {
      key: 'image',
      label: 'Image',
      render: (c: Container) => (
        <span className="text-foreground-secondary font-mono text-small">{c.image || '—'}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (c: Container) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">{c.type}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (c: Container) => getStatusBadge(c.status),
    },
    {
      key: 'created',
      label: 'Created',
      render: (c: Container) => (
        <span className="text-foreground-secondary text-small">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (c: Container) => (
        <div className="flex gap-1">
          {c.status === 'running' ? (
            <Button
              variant="ghost"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleStop(c.id);
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
                handleStart(c.id);
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
              handleRestart(c.id);
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
              setDeleteContainerId(c.id);
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
        <h1 className="text-page-title font-medium">Containers</h1>
      </div>

      {containers && containers.length > 0 ? (
        <DataTable columns={columns} data={containers} rowKey={(c) => c.id}
          onRowClick={(c) => navigate({ to: '/containers/$containerId', params: { containerId: c.id } })}
        />
      ) : (
        <EmptyState
          icon="icon-box"
          title="No containers"
          description="Create your first container to get started"
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteContainerId}
        onClose={() => setDeleteContainerId(null)}
        onConfirm={handleDelete}
        title="Delete Container"
        description="This action cannot be undone. All data associated with this container will be lost."
        confirmText="Delete"
        impact="high"
        loading={deleteContainer.isPending}
      />
    </div>
  );
}