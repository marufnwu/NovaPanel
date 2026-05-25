import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CronBuilder } from './CronBuilder';
import { useCreateBackupSchedule, useUpdateBackupSchedule, type BackupSchedule } from '../../api/hooks/backup';
import { toast } from '../../lib/toast';

interface BackupScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: BackupSchedule | null;
}

const STORAGE_OPTIONS = [
  { value: 'local', label: 'Local Storage' },
  { value: 's3', label: 'Amazon S3' },
  { value: 'b2', label: 'Backblaze B2' },
  { value: 'wasabi', label: 'Wasabi' },
];

const RESOURCE_OPTIONS = [
  { value: 'site', label: 'Sites (Files)' },
  { value: 'database', label: 'Databases' },
  { value: 'container', label: 'Containers' },
  { value: 'config', label: 'Configuration' },
];

export function BackupScheduleModal({ isOpen, onClose, schedule }: BackupScheduleModalProps) {
  const isEdit = !!schedule;
  const createSchedule = useCreateBackupSchedule();
  const updateSchedule = useUpdateBackupSchedule();

  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [resourceType, setResourceType] = useState('site');
  const [storageBackend, setStorageBackend] = useState('local');
  const [retentionDays, setRetentionDays] = useState(30);
  const [enabled, setEnabled] = useState(true);
  const [cronError, setCronError] = useState<string | undefined>();

  // Reset form when modal opens/closes or schedule changes
  useEffect(() => {
    if (isOpen) {
      if (schedule) {
        setName(schedule.name);
        setCronExpression(schedule.cronExpression);
        setResourceType(schedule.resourceType);
        setStorageBackend(schedule.storageBackend);
        setRetentionDays(schedule.retentionDays);
        setEnabled(schedule.enabled);
      } else {
        setName('');
        setCronExpression('0 2 * * *');
        setResourceType('site');
        setStorageBackend('local');
        setRetentionDays(30);
        setEnabled(true);
      }
      setCronError(undefined);
    }
  }, [isOpen, schedule]);

  const validateCron = (cron: string): boolean => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      setCronError('Invalid cron expression: must have 5 or 6 fields');
      return false;
    }
    setCronError(undefined);
    return true;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!validateCron(cronExpression)) {
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
          resourceType,
          retentionDays,
          storageBackend,
          enabled,
        });
        toast.success('Schedule created');
      }
      onClose();
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
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
        {/* Name */}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Daily Backup"
        />

        {/* Cron Builder */}
        <div>
          <label className="text-meta font-medium block mb-2">Schedule</label>
          <CronBuilder
            value={cronExpression}
            onChange={(cron) => {
              setCronExpression(cron);
              validateCron(cron);
            }}
            error={cronError}
          />
        </div>

        {/* Resource Type - only show for new schedules */}
        {!isEdit && (
          <div>
            <label className="text-meta font-medium block mb-2">Backup Type</label>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResourceType(opt.value)}
                  className={`px-3 py-1.5 text-small rounded-md border transition-colors ${
                    resourceType === opt.value
                      ? 'bg-background-secondary border-foreground-info text-foreground-primary'
                      : 'bg-background-primary border-border-tertiary text-foreground-secondary hover:border-foreground-info'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Storage Backend */}
        <div>
          <label className="text-meta font-medium block mb-2">Destination</label>
          <div className="flex flex-wrap gap-2">
            {STORAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStorageBackend(opt.value)}
                className={`px-3 py-1.5 text-small rounded-md border transition-colors ${
                  storageBackend === opt.value
                    ? 'bg-background-secondary border-foreground-info text-foreground-primary'
                    : 'bg-background-primary border-border-tertiary text-foreground-secondary hover:border-foreground-info'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Retention Days */}
        <Input
          label="Retention (days)"
          type="number"
          min={1}
          max={365}
          value={retentionDays}
          onChange={(e) => setRetentionDays(parseInt(e.target.value, 10) || 30)}
        />

        {/* Enabled Toggle */}
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