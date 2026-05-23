import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { usePlugins, useTogglePlugin, useDeletePlugin, type Plugin } from '../../api/hooks/plugins';
import { Icon } from '../../components/icons';

export function PluginsPage() {
  const queryClient = useQueryClient();
  const { data: plugins, isLoading } = usePlugins();
  const togglePlugin = useTogglePlugin();
  const deletePlugin = useDeletePlugin();

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleToggle = async (id: string) => {
    try {
      await togglePlugin.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePlugin.mutateAsync(deleteId);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

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
          <Button variant="ghost" size="small" onClick={() => handleToggle(p.id)} icon={<Icon name="icon-refresh" size={15} />}>
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
      />
    </div>
  );
}