import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useContainers,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
  useDeleteContainer,
  type Container,
} from '../../api/hooks/containers';
import { Icon } from '../../components/icons';

export function ContainersPage() {
  const queryClient = useQueryClient();
  const [projectId] = useState('default');
  const [deleteContainerId, setDeleteContainerId] = useState<string | null>(null);

  const { data: containers, isLoading } = useContainers(projectId);
  const startContainer = useStartContainer();
  const stopContainer = useStopContainer();
  const restartContainer = useRestartContainer();
  const deleteContainer = useDeleteContainer();

  const handleStart = async (id: string) => {
    try {
      await startContainer.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopContainer.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestart = async (id: string) => {
    try {
      await restartContainer.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteContainerId) return;
    try {
      await deleteContainer.mutateAsync(deleteContainerId);
      setDeleteContainerId(null);
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    } catch (err) {
      console.error(err);
    }
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
        <DataTable columns={columns} data={containers} rowKey={(c) => c.id} />
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
      />
    </div>
  );
}