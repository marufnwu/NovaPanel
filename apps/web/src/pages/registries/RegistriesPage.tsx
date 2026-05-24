import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useRegistries, useCreateRegistry, useDeleteRegistry, type Registry } from '../../api/hooks/registries';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function RegistriesPage() {
  const queryClient = useQueryClient();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const { data: registries, isLoading, isError, error, refetch } = useRegistries();
  const createRegistry = useCreateRegistry();
  const deleteRegistry = useDeleteRegistry();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  type RegistryProvider = 'dockerhub' | 'ghcr' | 'ecr' | 'gcr' | 'selfhosted';

  const [newProvider, setNewProvider] = useState<RegistryProvider>('dockerhub');
  const [newUrl, setNewUrl] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName) return;
    createRegistry.mutate(
      { orgId: activeOrgId ?? 'default', name: newName, provider: newProvider, url: newUrl },
      {
        onSuccess: () => {
          toast.success('Registry created');
          setShowCreateModal(false);
          setNewName('');
          setNewUrl('');
          queryClient.invalidateQueries({ queryKey: ['registries'] });
        },
        onError: (err) => toast.error(`Failed to create registry: ${err.message}`),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteRegistry.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Registry deleted');
        setDeleteId(null);
        queryClient.invalidateQueries({ queryKey: ['registries'] });
      },
      onError: (err) => toast.error(`Failed to delete registry: ${err.message}`),
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
      render: (r: Registry) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (r: Registry) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
          {r.provider}
        </span>
      ),
    },
    {
      key: 'url',
      label: 'URL',
      render: (r: Registry) => <span className="font-mono text-foreground-secondary">{r.url || '—'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r: Registry) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (r: Registry) => (
        <Button variant="ghost" size="small" onClick={() => setDeleteId(r.id)} icon={<Icon name="icon-trash" size={15} />}>
          Delete
        </Button>
      ),
    },
  ];

  const providers = [
    { id: 'dockerhub', label: 'Docker Hub' },
    { id: 'ghcr', label: 'GitHub Container Registry' },
    { id: 'ecr', label: 'Amazon ECR' },
    { id: 'gcr', label: 'Google Container Registry' },
    { id: 'selfhosted', label: 'Self-hosted' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Registries</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          Add Registry
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={registries || []}
        rowKey={(r) => r.id}
        emptyState={
          <EmptyState
            icon="icon-box"
            title="No registries"
            description="Add a container registry to manage your images"
            action={{ label: 'Add Registry', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Registry"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createRegistry.isPending}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-registry" />
          <div>
            <label className="text-meta font-medium mb-1 block">Provider</label>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <Button key={p.id} variant={newProvider === p.id ? 'primary' : 'default'} size="small" onClick={() => setNewProvider(p.id as RegistryProvider)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          {newProvider === 'selfhosted' && (
            <Input label="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://registry.example.com" />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Registry"
        description="This registry will be removed."
        confirmText="Delete"
        impact="medium"
        loading={deleteRegistry.isPending}
      />
    </div>
  );
}