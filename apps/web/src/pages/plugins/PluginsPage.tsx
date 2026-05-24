import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { usePlugins, useTogglePlugin, useDeletePlugin, type Plugin } from '../../api/hooks/plugins';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function PluginsPage() {
  const queryClient = useQueryClient();
  const { data: plugins, isLoading, isError, error, refetch } = usePlugins();
  const togglePlugin = useTogglePlugin();
  const deletePlugin = useDeletePlugin();

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    togglePlugin.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['plugins'] });
        toast.success('Plugin updated');
      },
      onError: (err) => toast.error(`Failed to update plugin: ${err.message}`),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deletePlugin.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Plugin deleted');
        setDeleteId(null);
        queryClient.invalidateQueries({ queryKey: ['plugins'] });
      },
      onError: (err) => toast.error(`Failed to delete plugin: ${err.message}`),
    });
  };

  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (p: Plugin) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: 'version',
      label: 'Version',
      render: (p: Plugin) => <span className="font-mono text-foreground-secondary">{p.version}</span>,
    },
    {
      key: 'author',
      label: 'Author',
      render: (p: Plugin) => p.author || '—',
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (p: Plugin) => <StatusBadge status={p.enabled ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (p: Plugin) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="small" onClick={() => handleToggle(p.id)} icon={<Icon name="icon-refresh" size={15} />} loading={togglePlugin.isPending}>
            {p.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="ghost" size="small" onClick={() => setDeleteId(p.id)} icon={<Icon name="icon-trash" size={15} />}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Plugins</h1>
      </div>

      <DataTable
        columns={columns}
        data={plugins || []}
        rowKey={(p) => p.id}
        emptyState={
          <EmptyState
            icon="icon-puzzle"
            title="No plugins"
            description="No plugins are currently installed"
          />
        }
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Plugin"
        description="This plugin will be permanently removed."
        confirmText="Delete"
        impact="medium"
        loading={deletePlugin.isPending}
      />
    </div>
  );
}