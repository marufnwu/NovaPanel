import { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { PageSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import {
  useBackups,
  useCreateBackup,
  useRestoreBackup,
  useDeleteBackup,
  useDownloadBackup,
  useVerifyBackup,
  useBackupSchedules,
  useCreateBackupSchedule,
  useUpdateBackupSchedule,
  useDeleteBackupSchedule,
  useToggleBackupSchedule,
  useRunBackupNow,
  useRemoteStorageConfig,
  useUpdateRemoteStorage,
  type Backup,
  type BackupSchedule,
  type RemoteStorageConfig,
} from '../../api/hooks/backup';
import { toast } from '../../lib/toast';
import { Icon } from '../icons';

interface BackupManagerProps {
  siteId: string;
  siteName: string;
  domainId?: string;
}

type TabId = 'backups' | 'schedules' | 'storage' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'backups', label: 'Backups' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'storage', label: 'Remote Storage' },
  { id: 'settings', label: 'Settings' },
];

const STORAGE_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 's3', label: 'Amazon S3' },
  { value: 'sftp', label: 'SFTP' },
];

const SCHEDULE_PRESETS = [
  { value: '0 2 * * *', label: 'Daily at 2 AM' },
  { value: '0 2 * * 0', label: 'Weekly on Sunday' },
  { value: '0 2 1 * *', label: 'Monthly on 1st' },
];

const RETENTION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

export function BackupManager({ siteId, siteName, domainId }: BackupManagerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('backups');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Backup | null>(null);
  const [editSchedule, setEditSchedule] = useState<BackupSchedule | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<BackupSchedule | null>(null);
  const [backupType, setBackupType] = useState<'full' | 'files' | 'database'>('full');

  // Fetch backups for this site
  const {
    data: backups,
    isLoading: isLoadingBackups,
    isError: isErrorBackups,
    error: backupsError,
    refetch: refetchBackups,
  } = useBackups(domainId, { refetchInterval: 30000 });

  // Fetch schedules
  const {
    data: schedules,
    isLoading: isLoadingSchedules,
    isError: isErrorSchedules,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useBackupSchedules();

  // Fetch storage config
  const {
    data: storageConfig,
    isLoading: isLoadingStorage,
    isError: isErrorStorage,
    error: storageError,
    refetch: refetchStorage,
  } = useRemoteStorageConfig();

  // Mutations
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();
  const downloadBackup = useDownloadBackup();
  const verifyBackup = useVerifyBackup();
  const createSchedule = useCreateBackupSchedule();
  const updateSchedule = useUpdateBackupSchedule();
  const deleteSchedule = useDeleteBackupSchedule();
  const toggleSchedule = useToggleBackupSchedule();
  const runBackupNow = useRunBackupNow();
  const updateRemoteStorage = useUpdateRemoteStorage();

  // Filter schedules for this site
  const siteSchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter(s => s.resourceId === siteId || s.resourceId === domainId);
  }, [schedules, siteId, domainId]);

  // Calculate backup statistics
  const backupStats = useMemo(() => {
    if (!backups || backups.length === 0) {
      return { lastBackup: null, totalSize: 0, count: 0, nextScheduled: null };
    }
    const completed = backups.filter(b => b.status === 'completed');
    const lastBackup = completed.length > 0
      ? completed.reduce((latest, b) => new Date(b.createdAt) > new Date(latest.createdAt) ? b : latest)
      : null;
    const totalSize = backups.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);
    const nextScheduled = siteSchedules.find(s => s.enabled)?.nextRunAt || null;
    return { lastBackup, totalSize, count: backups.length, nextScheduled };
  }, [backups, siteSchedules]);

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

  const handleCreateBackup = () => {
    createBackup.mutate(
      { type: backupType, domainId },
      {
        onSuccess: () => {
          toast.success('Backup started successfully');
          setShowCreateModal(false);
        },
        onError: (err) => toast.error(`Failed to create backup: ${err.message}`),
      }
    );
  };

  const handleRestore = (backup: Backup) => {
    restoreBackup.mutate(
      { id: backup.id },
      {
        onSuccess: () => {
          toast.success('Restore started. This may take a few minutes.');
          setRestoreTarget(null);
        },
        onError: (err) => toast.error(`Failed to restore: ${err.message}`),
      }
    );
  };

  const handleDelete = (backup: Backup) => {
    deleteBackup.mutate(backup.id, {
      onSuccess: () => {
        toast.success('Backup deleted');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    });
  };

  const handleDownload = (backup: Backup) => {
    downloadBackup.mutate(
      { id: backup.id, filename: backup.filename },
      {
        onSuccess: () => toast.success('Download started'),
        onError: (err) => toast.error(`Failed to download: ${err.message}`),
      }
    );
  };

  const handleVerify = (backup: Backup) => {
    verifyBackup.mutate(backup.id, {
      onSuccess: (result) => {
        if (result.valid) {
          toast.success('Backup verified successfully');
        } else {
          toast.error(`Backup verification failed: ${result.errors?.join(', ') || 'Unknown error'}`);
        }
        setVerifyTarget(null);
      },
      onError: (err) => toast.error(`Failed to verify: ${err.message}`),
    });
  };

  const handleToggleSchedule = (schedule: BackupSchedule) => {
    toggleSchedule.mutate(schedule.id, {
      onSuccess: () => toast.success(`Schedule ${schedule.enabled ? 'disabled' : 'enabled'}`),
      onError: (err) => toast.error(`Failed to toggle schedule: ${err.message}`),
    });
  };

  const handleRunNow = (schedule: BackupSchedule) => {
    runBackupNow.mutate(schedule.id, {
      onSuccess: () => toast.success('Backup started'),
      onError: (err) => toast.error(`Failed to run backup: ${err.message}`),
    });
  };

  const handleDeleteSchedule = (schedule: BackupSchedule) => {
    deleteSchedule.mutate(schedule.id, {
      onSuccess: () => {
        toast.success('Schedule deleted');
        setDeleteScheduleTarget(null);
      },
      onError: (err) => toast.error(`Failed to delete schedule: ${err.message}`),
    });
  };

  const backupColumns = [
    {
      key: 'filename',
      label: 'File',
      render: (b: Backup) => (
        <div>
          <div className="font-mono text-small truncate max-w-[200px]">{b.filename}</div>
          <div className="text-meta text-foreground-secondary capitalize">{b.type}</div>
        </div>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      render: (b: Backup) => formatBytes(b.sizeBytes),
    },
    {
      key: 'status',
      label: 'Status',
      render: (b: Backup) => <StatusBadge status={b.status} />,
    },
    {
      key: 'created',
      label: 'Created',
      render: (b: Backup) => formatDate(b.createdAt),
    },
    {
      key: 'actions',
      label: '',
      render: (b: Backup) => (
        <div className="flex gap-1">
          {b.status === 'completed' && (
            <>
              <Button
                variant="ghost"
                size="small"
                icon={<Icon name="icon-refresh" size={14} />}
                onClick={() => setRestoreTarget(b)}
              >
                Restore
              </Button>
              <Button
                variant="ghost"
                size="small"
                icon={<Icon name="icon-download" size={14} />}
                loading={downloadBackup.isPending}
                onClick={() => handleDownload(b)}
              >
                Download
              </Button>
              <Button
                variant="ghost"
                size="small"
                icon={<Icon name="icon-shield-check" size={14} />}
                loading={verifyBackup.isPending}
                onClick={() => setVerifyTarget(b)}
              >
                Verify
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-trash" size={14} />}
            onClick={() => setDeleteTarget(b)}
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
          <div className="text-meta text-foreground-secondary">{s.cronExpression}</div>
        </div>
      ),
    },
    {
      key: 'retention',
      label: 'Retention',
      render: (s: BackupSchedule) => `${s.retentionDays} days`,
    },
    {
      key: 'destination',
      label: 'Destination',
      render: (s: BackupSchedule) => (
        <span className="px-2 py-0.5 bg-background-secondary rounded text-small capitalize">
          {s.storageBackend}
        </span>
      ),
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
            icon={<Icon name="icon-play" size={14} />}
            loading={runBackupNow.isPending}
            onClick={() => handleRunNow(s)}
          >
            Run Now
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-edit" size={14} />}
            onClick={() => {
              setEditSchedule(s);
              setShowScheduleModal(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-refresh" size={14} />}
            loading={toggleSchedule.isPending}
            onClick={() => handleToggleSchedule(s)}
          >
            {s.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-trash" size={14} />}
            onClick={() => setDeleteScheduleTarget(s)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Last Backup</div>
          <div className="text-lg font-medium">
            {backupStats.lastBackup ? formatDate(backupStats.lastBackup.createdAt) : '—'}
          </div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Next Scheduled</div>
          <div className="text-lg font-medium">
            {backupStats.nextScheduled ? formatDate(backupStats.nextScheduled) : 'Not set'}
          </div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Total Size</div>
          <div className="text-lg font-medium">{formatBytes(backupStats.totalSize)}</div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Backup Count</div>
          <div className="text-lg font-medium">{backupStats.count}</div>
        </Card>
      </div>

      {/* One-click backup button */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          icon={<Icon name="icon-backup" size={16} />}
          loading={createBackup.isPending}
          onClick={() => setShowCreateModal(true)}
        >
          Create Backup
        </Button>
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
      {activeTab === 'backups' && (
        isLoadingBackups ? (
          <PageSkeleton />
        ) : isErrorBackups ? (
          <ErrorState message={backupsError?.message} onRetry={refetchBackups} />
        ) : backups && backups.length > 0 ? (
          <div className="space-y-4">
            {/* Desktop table view */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-border-tertiary">
              <table className="w-full">
                <thead className="bg-background-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">File</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Size</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Status</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Created</th>
                    <th className="px-4 py-3 text-right text-small font-medium text-foreground-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-tertiary">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-background-secondary/50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-small truncate max-w-[200px]">{backup.filename}</div>
                        <div className="text-meta text-foreground-secondary capitalize">{backup.type}</div>
                      </td>
                      <td className="px-4 py-3 text-small">{formatBytes(backup.sizeBytes)}</td>
                      <td className="px-4 py-3"><StatusBadge status={backup.status} /></td>
                      <td className="px-4 py-3 text-small">{formatDate(backup.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          {backup.status === 'completed' && (
                            <>
                              <Button
                                variant="ghost"
                                size="small"
                                icon={<Icon name="icon-refresh" size={14} />}
                                onClick={() => setRestoreTarget(backup)}
                              >
                                Restore
                              </Button>
                              <Button
                                variant="ghost"
                                size="small"
                                icon={<Icon name="icon-download" size={14} />}
                                loading={downloadBackup.isPending}
                                onClick={() => handleDownload(backup)}
                              >
                                Download
                              </Button>
                              <Button
                                variant="ghost"
                                size="small"
                                icon={<Icon name="icon-shield-check" size={14} />}
                                loading={verifyBackup.isPending}
                                onClick={() => setVerifyTarget(backup)}
                              >
                                Verify
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="small"
                            icon={<Icon name="icon-trash" size={14} />}
                            onClick={() => setDeleteTarget(backup)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {backups.map((backup) => (
                <Card key={backup.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono text-small truncate max-w-[150px]">{backup.filename}</div>
                    <StatusBadge status={backup.status} />
                  </div>
                  <div className="text-meta text-foreground-secondary mb-3">
                    {backup.type} • {formatBytes(backup.sizeBytes)} • {formatDate(backup.createdAt)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {backup.status === 'completed' && (
                      <>
                        <Button variant="ghost" size="small" onClick={() => setRestoreTarget(backup)}>
                          Restore
                        </Button>
                        <Button variant="ghost" size="small" onClick={() => handleDownload(backup)}>
                          Download
                        </Button>
                        <Button variant="ghost" size="small" onClick={() => setVerifyTarget(backup)}>
                          Verify
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="small" onClick={() => setDeleteTarget(backup)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon="icon-backup"
            title="No backups yet"
            description="Create your first backup to protect your site data"
            action={{ label: 'Create Backup', onClick: () => setShowCreateModal(true) }}
          />
        )
      )}

      {activeTab === 'schedules' && (
        isLoadingSchedules ? (
          <PageSkeleton />
        ) : isErrorSchedules ? (
          <ErrorState message={schedulesError?.message} onRetry={refetchSchedules} />
        ) : siteSchedules.length > 0 ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="default"
                icon={<Icon name="icon-plus" size={16} />}
                onClick={() => {
                  setEditSchedule(null);
                  setShowScheduleModal(true);
                }}
              >
                Add Schedule
              </Button>
            </div>
            <div className="hidden md:block overflow-hidden rounded-lg border border-border-tertiary">
              <table className="w-full">
                <thead className="bg-background-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Schedule</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Retention</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Destination</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Next Run</th>
                    <th className="px-4 py-3 text-left text-small font-medium text-foreground-secondary">Status</th>
                    <th className="px-4 py-3 text-right text-small font-medium text-foreground-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-tertiary">
                  {siteSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-background-secondary/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{schedule.name}</div>
                        <div className="text-meta text-foreground-secondary font-mono">{schedule.cronExpression}</div>
                      </td>
                      <td className="px-4 py-3 text-small">{schedule.retentionDays} days</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-background-secondary rounded text-small capitalize">
                          {schedule.storageBackend}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-small">{formatDate(schedule.nextRunAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={schedule.enabled ? 'active' : 'inactive'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="small" icon={<Icon name="icon-play" size={14} />} loading={runBackupNow.isPending} onClick={() => handleRunNow(schedule)}>
                            Run
                          </Button>
                          <Button variant="ghost" size="small" icon={<Icon name="icon-edit" size={14} />} onClick={() => { setEditSchedule(schedule); setShowScheduleModal(true); }}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="small" icon={<Icon name="icon-refresh" size={14} />} loading={toggleSchedule.isPending} onClick={() => handleToggleSchedule(schedule)}>
                            {schedule.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="ghost" size="small" icon={<Icon name="icon-trash" size={14} />} onClick={() => setDeleteScheduleTarget(schedule)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="icon-clock"
            title="No backup schedules"
            description="Create a schedule to automatically backup your site"
            action={{ label: 'Add Schedule', onClick: () => { setEditSchedule(null); setShowScheduleModal(true); } }}
          />
        )
      )}

      {activeTab === 'storage' && (
        isLoadingStorage ? (
          <PageSkeleton />
        ) : isErrorStorage ? (
          <ErrorState message={storageError?.message} onRetry={refetchStorage} />
        ) : (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium">Remote Storage Configuration</h3>
                  <p className="text-small text-foreground-secondary">Configure where your backups should be stored</p>
                </div>
                <Button variant="default" onClick={() => setShowStorageModal(true)}>
                  Configure
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border-tertiary">
                  <span className="text-foreground-secondary">Current Storage Type</span>
                  <span className="font-medium capitalize">{storageConfig?.type || 'local'}</span>
                </div>
                {storageConfig?.type !== 'local' && (
                  <>
                    {storageConfig?.s3 && (
                      <>
                        <div className="flex justify-between py-2 border-b border-border-tertiary">
                          <span className="text-foreground-secondary">Endpoint</span>
                          <span className="font-mono text-small">{storageConfig.s3.endpoint}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border-tertiary">
                          <span className="text-foreground-secondary">Bucket</span>
                          <span className="font-mono text-small">{storageConfig.s3.bucket}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border-tertiary">
                          <span className="text-foreground-secondary">Region</span>
                          <span className="font-mono text-small">{storageConfig.s3.region}</span>
                        </div>
                      </>
                    )}
                    {storageConfig?.sftp && (
                      <>
                        <div className="flex justify-between py-2 border-b border-border-tertiary">
                          <span className="text-foreground-secondary">Host</span>
                          <span className="font-mono text-small">{storageConfig.sftp.host}:{storageConfig.sftp.port}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border-tertiary">
                          <span className="text-foreground-secondary">Path</span>
                          <span className="font-mono text-small">{storageConfig.sftp.path}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        )
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Backup Settings</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border-tertiary">
                <div>
                  <div className="font-medium">Auto-delete old backups</div>
                  <div className="text-small text-foreground-secondary">Automatically remove backups older than retention period</div>
                </div>
                <span className="text-foreground-secondary">Enabled</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-tertiary">
                <div>
                  <div className="font-medium">Compression</div>
                  <div className="text-small text-foreground-secondary">Compress backups to save storage space</div>
                </div>
                <span className="text-foreground-secondary">Enabled</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-tertiary">
                <div>
                  <div className="font-medium">Encryption</div>
                  <div className="text-small text-foreground-secondary">Encrypt backups with AES-256</div>
                </div>
                <span className="text-foreground-secondary">Optional</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div>
                  <div className="font-medium">Notifications</div>
                  <div className="text-small text-foreground-secondary">Get notified when backups complete or fail</div>
                </div>
                <span className="text-foreground-secondary">Enabled</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Create Backup Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createBackup.isPending} onClick={handleCreateBackup}>
              Create Backup
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-meta font-medium block mb-2">Backup Type</label>
            <div className="flex flex-wrap gap-2">
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
                Files Only
              </Button>
              <Button
                variant={backupType === 'database' ? 'primary' : 'default'}
                onClick={() => setBackupType('database')}
              >
                Database Only
              </Button>
            </div>
          </div>
          <p className="text-small text-foreground-secondary">
            {backupType === 'full' && 'Backup all files and databases'}
            {backupType === 'files' && 'Backup all website files'}
            {backupType === 'database' && 'Backup all databases'}
          </p>
        </div>
      </Modal>

      {/* Create/Edit Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setEditSchedule(null);
        }}
        schedule={editSchedule}
        siteId={siteId}
        siteName={siteName}
        domainId={domainId}
        onSave={() => {
          setShowScheduleModal(false);
          setEditSchedule(null);
          refetchSchedules();
        }}
      />

      {/* Storage Configuration Modal */}
      <StorageModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        currentConfig={storageConfig}
        onSave={() => {
          setShowStorageModal(false);
          refetchStorage();
        }}
      />

      {/* Restore Confirmation */}
      <ConfirmDialog
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title="Restore Backup"
        description={`Are you sure you want to restore this backup? This will overwrite current data with the backup from ${restoreTarget ? formatDate(restoreTarget.createdAt) : ''}.`}
        confirmText="Restore"
        impact="high"
        loading={restoreBackup.isPending}
        onConfirm={() => restoreTarget && handleRestore(restoreTarget)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Backup"
        description="This backup will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        impact="high"
        loading={deleteBackup.isPending}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />

      {/* Verify Confirmation */}
      <ConfirmDialog
        isOpen={!!verifyTarget}
        onClose={() => setVerifyTarget(null)}
        title="Verify Backup"
        description={`Verify the integrity of backup "${verifyTarget?.filename}". This may take a few minutes.`}
        confirmText="Verify"
        impact="low"
        loading={verifyBackup.isPending}
        onConfirm={() => verifyTarget && handleVerify(verifyTarget)}
      />

      {/* Delete Schedule Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteScheduleTarget}
        onClose={() => setDeleteScheduleTarget(null)}
        title="Delete Schedule"
        description={`Delete the backup schedule "${deleteScheduleTarget?.name}"? This won't delete existing backups.`}
        confirmText="Delete"
        impact="medium"
        loading={deleteSchedule.isPending}
        onConfirm={() => deleteScheduleTarget && handleDeleteSchedule(deleteScheduleTarget)}
      />
    </div>
  );
}

// Schedule Modal Component
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: BackupSchedule | null;
  siteId: string;
  siteName: string;
  domainId?: string;
  onSave: () => void;
}

function ScheduleModal({ isOpen, onClose, schedule, siteId, siteName, domainId, onSave }: ScheduleModalProps) {
  const isEdit = !!schedule;
  const createSchedule = useCreateBackupSchedule();
  const updateSchedule = useUpdateBackupSchedule();

  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [storageBackend, setStorageBackend] = useState('local');
  const [retentionDays, setRetentionDays] = useState(30);
  const [enabled, setEnabled] = useState(true);

  useState(() => {
    if (schedule) {
      setName(schedule.name);
      setCronExpression(schedule.cronExpression);
      setStorageBackend(schedule.storageBackend);
      setRetentionDays(schedule.retentionDays);
      setEnabled(schedule.enabled);
    } else {
      setName(`${siteName} Backup`);
      setCronExpression('0 2 * * *');
      setStorageBackend('local');
      setRetentionDays(30);
      setEnabled(true);
    }
  });

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (isEdit && schedule) {
        await updateSchedule.mutateAsync({
          id: schedule.id,
          name: name.trim(),
          cronExpression,
          retentionDays,
          storageBackend,
          enabled,
        });
        toast.success('Schedule updated');
      } else {
        await createSchedule.mutateAsync({
          name: name.trim(),
          cronExpression,
          resourceType: 'site',
          retentionDays,
          storageBackend,
          enabled,
        });
        toast.success('Schedule created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Backup Schedule' : 'Create Backup Schedule'}
      size="large"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={createSchedule.isPending || updateSchedule.isPending}
          >
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Daily Backup"
        />

        <div>
          <label className="text-meta font-medium block mb-2">Schedule</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SCHEDULE_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={cronExpression === preset.value ? 'primary' : 'default'}
                size="small"
                onClick={() => setCronExpression(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Input
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="0 2 * * *"
            className="font-mono"
          />
        </div>

        <div>
          <label className="text-meta font-medium block mb-2">Destination</label>
          <div className="flex flex-wrap gap-2">
            {STORAGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={storageBackend === opt.value ? 'primary' : 'default'}
                size="small"
                onClick={() => setStorageBackend(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-meta font-medium block mb-2">Retention</label>
          <div className="flex flex-wrap gap-2">
            {RETENTION_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={retentionDays === opt.value ? 'primary' : 'default'}
                size="small"
                onClick={() => setRetentionDays(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-foreground-info' : 'bg-background-secondary'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-small text-foreground-primary">
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
    </Modal>
  );
}

// Storage Configuration Modal
interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig?: RemoteStorageConfig;
  onSave: () => void;
}

function StorageModal({ isOpen, onClose, currentConfig, onSave }: StorageModalProps) {
  const updateRemoteStorage = useUpdateRemoteStorage();
  const [storageType, setStorageType] = useState<'local' | 's3' | 'sftp'>(currentConfig?.type || 'local');

  // S3 fields
  const [s3Endpoint, setS3Endpoint] = useState(currentConfig?.s3?.endpoint || '');
  const [s3Bucket, setS3Bucket] = useState(currentConfig?.s3?.bucket || '');
  const [s3AccessKey, setS3AccessKey] = useState(currentConfig?.s3?.accessKey || '');
  const [s3SecretKey, setS3SecretKey] = useState(currentConfig?.s3?.secretKey || '');
  const [s3Region, setS3Region] = useState(currentConfig?.s3?.region || 'us-east-1');

  // SFTP fields
  const [sftpHost, setSftpHost] = useState(currentConfig?.sftp?.host || '');
  const [sftpPort, setSftpPort] = useState(currentConfig?.sftp?.port || 22);
  const [sftpUser, setSftpUser] = useState(currentConfig?.sftp?.user || '');
  const [sftpPassword, setSftpPassword] = useState(currentConfig?.sftp?.password || '');
  const [sftpPath, setSftpPath] = useState(currentConfig?.sftp?.path || '/backups');

  const handleSave = async () => {
    let config: RemoteStorageConfig;

    if (storageType === 'local') {
      config = { type: 'local' };
    } else if (storageType === 's3') {
      if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
        toast.error('All S3 fields are required');
        return;
      }
      config = {
        type: 's3',
        s3: {
          endpoint: s3Endpoint,
          bucket: s3Bucket,
          accessKey: s3AccessKey,
          secretKey: s3SecretKey,
          region: s3Region,
        },
      };
    } else {
      if (!sftpHost || !sftpUser || !sftpPassword) {
        toast.error('Host, user, and password are required for SFTP');
        return;
      }
      config = {
        type: 'sftp',
        sftp: {
          host: sftpHost,
          port: sftpPort,
          user: sftpUser,
          path: sftpPath,
          authType: 'password',
          password: sftpPassword,
        },
      };
    }

    try {
      await updateRemoteStorage.mutateAsync(config);
      toast.success('Storage configuration saved');
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save storage configuration');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Remote Storage"
      size="large"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={updateRemoteStorage.isPending} onClick={handleSave}>
            Save Configuration
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="text-meta font-medium block mb-2">Storage Type</label>
          <div className="flex flex-wrap gap-2">
            {STORAGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={storageType === opt.value ? 'primary' : 'default'}
                onClick={() => setStorageType(opt.value as 'local' | 's3' | 'sftp')}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {storageType === 's3' && (
          <div className="space-y-4">
            <Input
              label="Endpoint"
              value={s3Endpoint}
              onChange={(e) => setS3Endpoint(e.target.value)}
              placeholder="https://s3.amazonaws.com"
            />
            <Input
              label="Bucket"
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              placeholder="my-backups"
            />
            <Input
              label="Region"
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
              placeholder="us-east-1"
            />
            <Input
              label="Access Key"
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
            <Input
              label="Secret Key"
              type="password"
              value={s3SecretKey}
              onChange={(e) => setS3SecretKey(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        )}

        {storageType === 'sftp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Host"
                value={sftpHost}
                onChange={(e) => setSftpHost(e.target.value)}
                placeholder="backup.example.com"
              />
              <Input
                label="Port"
                type="number"
                value={sftpPort}
                onChange={(e) => setSftpPort(parseInt(e.target.value) || 22)}
                placeholder="22"
              />
            </div>
            <Input
              label="Username"
              value={sftpUser}
              onChange={(e) => setSftpUser(e.target.value)}
              placeholder="backup_user"
            />
            <Input
              label="Password"
              type="password"
              value={sftpPassword}
              onChange={(e) => setSftpPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Input
              label="Path"
              value={sftpPath}
              onChange={(e) => setSftpPath(e.target.value)}
              placeholder="/backups"
            />
          </div>
        )}

        {storageType === 'local' && (
          <p className="text-foreground-secondary">Backups will be stored locally on the server.</p>
        )}
      </div>
    </Modal>
  );
}
