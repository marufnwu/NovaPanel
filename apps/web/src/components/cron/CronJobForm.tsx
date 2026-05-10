import { useState } from 'react';
import { Clock, Plus, X, Mail } from 'lucide-react';
import type { CronJob } from '../../api/hooks/cron';

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 3 AM', value: '0 3 * * *' },
  { label: 'Every Sunday at midnight', value: '0 0 * * 0' },
  { label: 'First of month', value: '0 0 1 * *' },
];

function humanReadable(schedule: string): string {
  const [min, hour, day, month, dow] = schedule.split(' ');
  if (schedule === '* * * * *') return 'Every minute';
  if (schedule === '*/5 * * * *') return 'Every 5 minutes';
  if (schedule === '*/15 * * * *') return 'Every 15 minutes';
  if (schedule === '0 * * * *') return 'Every hour at minute 0';
  if (min === '0' && hour === '*') return 'Every hour';
  if (hour === '0' && min === '0') return 'Every day at midnight';
  if (hour === '3' && min === '0') return 'Every day at 3:00 AM';
  if (dow === '0' && min === '0' && hour === '0') return 'Every Sunday at midnight';
  if (day === '1' && min === '0' && hour === '0') return 'First day of every month at midnight';
  if (hour !== '*' && min !== '*') return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return schedule;
}

interface CronJobFormProps {
  mode: 'create' | 'edit';
  initialData?: CronJob;
  onSubmit: (data: { schedule: string; command: string; systemUser: string; emailOnFailure?: boolean; failureEmail?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function CronJobForm({ mode, initialData, onSubmit, onCancel, isPending }: CronJobFormProps) {
  const [schedule, setSchedule] = useState(initialData?.schedule || '*/5 * * * *');
  const [command, setCommand] = useState(initialData?.command || '');
  const [systemUser, setSystemUser] = useState(initialData?.systemUser || 'root');
  const [emailOnFailure, setEmailOnFailure] = useState((initialData as any)?.emailOnFailure || false);
  const [failureEmail, setFailureEmail] = useState((initialData as any)?.failureEmail || '');

  const handleSubmit = () => {
    if (!command.trim()) return;
    onSubmit({
      schedule,
      command,
      systemUser,
      ...(emailOnFailure && failureEmail ? { emailOnFailure, failureEmail } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{mode === 'create' ? 'Create Cron Job' : 'Edit Cron Job'}</h3>
          <button onClick={onCancel} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Schedule (cron expression)</label>
            <input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="* * * * *"
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Presets</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSchedule(p.value)}
                  className={`rounded-full px-3 py-1 text-xs ${schedule === p.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {schedule && (
              <div className="mt-2 space-y-1">
                <div className="text-sm text-muted-foreground">{humanReadable(schedule)}</div>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Command</label>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="/usr/bin/php /var/www/vhosts/example.com/httpdocs/cron.php"
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Run as</label>
            <select
              value={systemUser}
              onChange={(e) => setSystemUser(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="root">root</option>
              <option value="www-data">www-data</option>
            </select>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailOnFailure}
                onChange={(e) => setEmailOnFailure(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Send email on failure</span>
              </div>
            </label>
            {emailOnFailure && (
              <input
                value={failureEmail}
                onChange={(e) => setFailureEmail(e.target.value)}
                placeholder="admin@example.com"
                type="email"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            type="submit"
            disabled={isPending || !command.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? (mode === 'create' ? 'Creating...' : 'Saving...') : (mode === 'create' ? 'Create Job' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  );
}