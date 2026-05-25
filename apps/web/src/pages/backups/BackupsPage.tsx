import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  useBackupSchedules,
  useDeleteBackupSchedule,
  useToggleBackupSchedule,
  useRunBackupNow,
  type Backup,
  type BackupSchedule,
} from '../../api/hooks/backup';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';
import { BackupScheduleModal } from './BackupScheduleModal';
import { describeCron } from './CronBuilder';

type TabId = 'backups' | 'schedules';

const TABS: { id: TabId; label: string }[] = [
  { id: 'backups', label: 'Backups' },
  { id: 'schedules', label: 'Scheduled Backups' },
];

export function BackupsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('backups');

  // Backup hooks
  const {
    data: backups,
    isLoading: isLoadingBackups,
    isError: isErrorBackups,
    error: backupsError,
    refetch: refetchBackups,
  } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();
  const downloadBackup = useDownloadBackup();

  // Schedule hooks
  const {
    data: schedules,
    isLoading: isLoadingSchedules,
    isError: isErrorSchedules,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useBackupSchedules();
  const deleteSchedule = useDeleteBackupSchedule();
  const toggleSchedule = useToggleBackupSchedule();
  const runBackupNow = useRunBackupNow();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'files' | 'database'>('full');
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<BackupSchedule | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<BackupSchedule | null>(null);

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  const backupColumns = [
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

  const scheduleColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (s: BackupSchedule) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="text-small text-foreground-secondary capitalize">{s.resourceType}</div>
        </div>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (s: BackupSchedule) => (
        <div>
          <div className="font-mono text-small">{s.cronExpression}</div>
          <div className="text-meta text-foreground-secondary">{describeCron(s.cronExpression)}</div>
        </div>
      ),
    },
    {
      key: 'destination',
      label: 'Destination',
      render: (s: BackupSchedule) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
          {s.storageBackend}
        </span>
      ),
    },
    {
      key: 'lastRun',
      label: 'Last Run',
      render: (s: BackupSchedule) => formatDate(s.lastRunAt),
    },
    {
      key: 'nextRun',
      label: 'Next Run',
      render: (s: BackupSchedule) => formatDate(s.nextRunAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (s: BackupSchedule) => (
        <StatusBadge status={s.enabled ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (s: BackupSchedule) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-play" size={15} />}
            loading={runBackupNow.isPending}
            onClick={(e) => {
              e.stopPropagation();
              runBackupNow.mutate(s.id, {
                onSuccess: () => toast.success('Backup started'),
                onError: (err) => toast.error(`Failed to run backup: ${err.message}`),
              });
            }}
          >
            Run
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-edit" size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              setEditSchedule(s);
              setShowScheduleModal(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-refresh" size={15} />}
            loading={toggleSchedule.isPending}
            onClick={(e) => {
              e.stopPropagation();
              toggleSchedule.mutate(s.id, {
                onSuccess: () => toast.success(`Schedule ${s.enabled ? 'disabled' : 'enabled'}`),
                onError: (err) => toast.error(`Failed to toggle: ${err.message}`),
              });
            }}
          >
            {s.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-trash" size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteScheduleTarget(s);
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
        {activeTab === 'backups' ? (
          <Button
            icon={<Icon name="icon-backup" size={16} />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Backup
          </Button>
        ) : (
          <Button
            icon={<Icon name="icon-plus" size={16} />}
            onClick={() => {
              setEditSchedule(null);
              setShowScheduleModal(true);
            }}
          >
            Add Schedule
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-small transition-colors relative ${
                activeTab === tab.id
                  ? 'text-foreground-primary font-medium'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'backups' ? (
        isLoadingBackups ? (
          <PageSkeleton />
        ) : isErrorBackups ? (
          <ErrorState message={backupsError?.message} onRetry={refetchBackups} />
        ) : (
          <DataTable
            columns={backupColumns}
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
        )
      ) : isLoadingSchedules ? (
        <PageSkeleton />
      ) : isErrorSchedules ? (
        <ErrorState message={schedulesError?.message} onRetry={refetchSchedules} />
      ) : (
        <DataTable
          columns={scheduleColumns}
          data={schedules || []}
          rowKey={(s) => s.id}
          emptyState={
            <EmptyState
              icon="icon-clock"
              title="No backup schedules"
              description="Create a schedule to automatically backup your data"
              action={{
                label: 'Add Schedule',
                onClick: () => {
                  setEditSchedule(null);
                  setShowScheduleModal(true);
                },
              }}
            />
          }
        />
      )}

      {/* Create Backup Modal */}
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

      {/* Restore Backup Dialog */}
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

      {/* Delete Backup Dialog */}
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

      {/* Schedule Modal */}
      <BackupScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setEditSchedule(null);
        }}
        schedule={editSchedule}
      />

      {/* Delete Schedule Dialog */}
      <ConfirmDialog
        isOpen={!!deleteScheduleTarget}
        onClose={() => setDeleteScheduleTarget(null)}
        onConfirm={() => {
          if (!deleteScheduleTarget) return;
          deleteSchedule.mutate(deleteScheduleTarget.id, {
            onSuccess: () => {
              toast.success('Schedule deleted');
              setDeleteScheduleTarget(null);
            },
            onError: (err) => toast.error(`Failed to delete schedule: ${err.message}`),
          });
        }}
        title="Delete Schedule"
        description={`Delete "${deleteScheduleTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        impact="high"
      />
    </div>
  );
}