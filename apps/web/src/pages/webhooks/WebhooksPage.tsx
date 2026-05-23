import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useWebhooks, useCreateWebhook, useDeleteWebhook, useRegenerateWebhookSecret, type Webhook } from '../../api/hooks/webhooks';
import { Icon } from '../../components/icons';
import { useAuthStore } from '../../store/auth.store';

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';
  const { data: webhooks, isLoading } = useWebhooks(orgId);
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const regenerateSecret = useRegenerateWebhookSecret();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      await createWebhook.mutateAsync({ orgId, data: { name: newName, url: newUrl, events: ['*'] } });
      setShowCreateModal(false);
      setNewName('');
      setNewUrl('');
      queryClient.invalidateQueries({ queryKey: ['webhooks', orgId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteWebhook.mutateAsync(deleteId);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['webhooks', orgId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateSecret = async (id: string) => {
    try {
      await regenerateSecret.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['webhooks', orgId] });
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
      render: (w: Webhook) => <span className="font-medium">{w.name}</span>,
    },
    {
      key: 'url',
      label: 'URL',
      render: (w: Webhook) => <span className="font-mono text-small text-foreground-secondary">{w.url}</span>,
    },
    {
      key: 'events',
      label: 'Events',
      render: (w: Webhook) => <span className="text-small text-foreground-tertiary">{w.events.join(', ')}</span>,
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (w: Webhook) => <StatusBadge status={w.enabled ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (w: Webhook) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="small" onClick={() => handleRegenerateSecret(w.id)} icon={<Icon name="icon-refresh" size={15} />}>
            Secret
          </Button>
          <Button variant="ghost" size="small" onClick={() => setDeleteId(w.id)} icon={<Icon name="icon-trash" size={15} />}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Webhooks</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          Add Webhook
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={webhooks || []}
        rowKey={(w) => w.id}
        emptyState={
          <EmptyState
            icon="icon-webhook"
            title="No webhooks"
            description="Add a webhook to receive event notifications"
            action={{ label: 'Add Webhook', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Webhook"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createWebhook.isPending}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Webhook" />
          <Input label="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/webhook" />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Webhook"
        description="This webhook will be permanently deleted."
        confirmText="Delete"
        impact="medium"
      />
    </div>
  );
}