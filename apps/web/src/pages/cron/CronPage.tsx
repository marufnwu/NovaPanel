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
import { useCronJobs, useCreateCronJob, useDeleteCronJob, useToggleCronJob, useRunCronJob, type CronJob } from '../../api/hooks/cron';
import { Icon } from '../../components/icons';

export function CronPage() {
  const queryClient = useQueryClient();
  const { data: jobs, isLoading } = useCronJobs();
  const createCron = useCreateCronJob();
  const deleteCron = useDeleteCronJob();
  const toggleCron = useToggleCronJob();
  const runCron = useRunCronJob();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      await createCron.mutateAsync({ schedule: newSchedule, command: newCommand });
      setShowCreateModal(false);
      setNewSchedule('');
      setNewCommand('');
      queryClient.invalidateQueries({ queryKey: ['cron'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCron.mutateAsync(deleteId);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['cron'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const columns = [
    {
      key: 'command',
      label: 'Command',
      render: (j: CronJob) => <span className="font-mono text-small">{j.command}</span>,
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (j: CronJob) => <span className="font-mono text-small text-foreground-secondary">{j.schedule}</span>,
    },
    {
      key: 'systemUser',
      label: 'User',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (j: CronJob) => <StatusBadge status={j.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'lastRun',
      label: 'Last Run',
      render: (j: CronJob) => j.lastRun ? new Date(j.lastRun).toLocaleString() : 'Never',
    },
    {
      key: 'lastStatus',
      label: 'Last Status',
      render: (j: CronJob) => j.lastStatus ? (
        <StatusBadge status={j.lastStatus === 'success' ? 'active' : 'inactive'} />
      ) : '—',
    },
    {
      key: 'actions',
      label: '',
      render: (j: CronJob) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="small" onClick={() => runCron.mutate(j.id)} icon={<Icon name="icon-play" size={15} />}>
            Run
          </Button>
          <Button variant="ghost" size="small" onClick={() => toggleCron.mutate(j.id)} icon={<Icon name="icon-refresh" size={15} />}>
            Toggle
          </Button>
          <Button variant="ghost" size="small" onClick={() => setDeleteId(j.id)} icon={<Icon name="icon-trash" size={15} />}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Cron Jobs</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          Add Job
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={jobs || []}
        rowKey={(j) => j.id}
        emptyState={
          <EmptyState
            icon="icon-clock"
            title="No cron jobs"
            description="Schedule automated tasks with cron jobs"
            action={{ label: 'Add Job', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Cron Job"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createCron.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Schedule (cron expression)"
            value={newSchedule}
            onChange={(e) => setNewSchedule(e.target.value)}
            placeholder="* * * * *"
          />
          <Input
            label="Command"
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            placeholder="/usr/bin/php /path/to/script.php"
          />
          <p className="text-meta text-foreground-tertiary">
            Format: minute hour day month weekday command
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Cron Job"
        description="This cron job will be permanently deleted."
        confirmText="Delete"
        impact="medium"
      />
    </div>
  );
}