import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useBackups,
  useCreateBackup,
  useRestoreBackup,
  useDeleteBackup,
  useDownloadBackup,
  type Backup,
} from '../../api/hooks/backup';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function BackupsPage() {
  const queryClient = useQueryClient();
  const {
    data: backups,
    isLoading,
    isError,
    error,
    refetch,
  } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();
  const downloadBackup = useDownloadBackup();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'files' | 'database'>('full');
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'filename',
      label: 'Filename',
      render: (b: Backup) => <span className="font-mono text-small">{b.filename}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (b: Backup) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
          {b.type}
        </span>
      ),
    },
    {
      key: 'sizeBytes',
      label: 'Size',
      render: (b: Backup) => formatBytes(b.sizeBytes),
    },
    {
      key: 'status',
      label: 'Status',
      render: (b: Backup) => <StatusBadge status={b.status} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (b: Backup) => new Date(b.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (b: Backup) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-refresh" size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              setRestoreTarget(b);
            }}
          >
            Restore
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-download" size={15} />}
            loading={downloadBackup.isPending}
            onClick={(e) => {
              e.stopPropagation();
              downloadBackup.mutate({ id: b.id, filename: b.filename }, {
                onSuccess: () => toast.success('Download started'),
                onError: (err) => toast.error(`Failed to download: ${err.message}`),
              });
            }}
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-trash" size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(b);
            }}
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
        <h1 className="text-page-title font-medium">Backups</h1>
        <Button
          icon={<Icon name="icon-backup" size={16} />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Backup
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={backups || []}
        rowKey={(b) => b.id}
        emptyState={
          <EmptyState
            icon="icon-backup"
            title="No backups yet"
            description="Create your first backup to protect your data"
            action={{ label: 'Create Backup', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createBackup.isPending}
              onClick={() => {
                createBackup.mutate(
                  { type: backupType },
                  {
                    onSuccess: () => {
                      toast.success('Backup created');
                      setShowCreateModal(false);
                    },
                    onError: (err) => toast.error(`Failed to create backup: ${err.message}`),
                  }
                );
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={backupType === 'full' ? 'primary' : 'default'}
              onClick={() => setBackupType('full')}
            >
              Full
            </Button>
            <Button
              variant={backupType === 'files' ? 'primary' : 'default'}
              onClick={() => setBackupType('files')}
            >
              Files
            </Button>
            <Button
              variant={backupType === 'database' ? 'primary' : 'default'}
              onClick={() => setBackupType('database')}
            >
              Database
            </Button>
          </div>
          <p className="text-small text-foreground-secondary">
            {backupType === 'full' && 'Backup all files and databases'}
            {backupType === 'files' && 'Backup all files only'}
            {backupType === 'database' && 'Backup all databases only'}
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (!restoreTarget) return;
          restoreBackup.mutate(
            { id: restoreTarget.id },
            {
              onSuccess: () => {
                toast.success('Backup restore started');
                setRestoreTarget(null);
              },
              onError: (err) => toast.error(`Failed to restore: ${err.message}`),
            }
          );
        }}
        title="Restore Backup"
        description={`Restore "${restoreTarget?.filename}"? This will overwrite current data. This cannot be undone.`}
        confirmText="Restore"
        impact="high"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteBackup.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success('Backup deleted');
              setDeleteTarget(null);
            },
            onError: (err) => toast.error(`Failed to delete backup: ${err.message}`),
          });
        }}
        title="Delete Backup"
        description="This backup will be permanently deleted."
        confirmText="Delete"
        impact="high"
      />
    </div>
  );
}