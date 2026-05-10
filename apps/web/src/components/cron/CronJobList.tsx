import { Clock, Play, ToggleLeft, ToggleRight, Edit2, Trash2, History } from 'lucide-react';
import type { CronJob } from '../../api/hooks/cron';

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

function formatNextRun(schedule: string): string {
  // Simple implementation - could be enhanced
  return 'Scheduled';
}

interface CronJobListProps {
  jobs: CronJob[];
  onToggle: (jobId: string) => void;
  onRun: (job: CronJob) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (job: CronJob) => void;
  onShowHistory: (jobId: string) => void;
}

export function CronJobList({ jobs, onToggle, onRun, onEdit, onDelete, onShowHistory }: CronJobListProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Schedule</th>
            <th className="px-4 py-3 text-left font-medium">Command</th>
            <th className="px-4 py-3 text-left font-medium">User</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="font-mono text-xs">{j.schedule}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{humanReadable(j.schedule)}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground max-w-xs truncate font-mono text-xs">{j.command}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{j.systemUser}</td>
              <td className="px-4 py-3">
                <button onClick={() => onToggle(j.id)} className="text-muted-foreground hover:text-foreground">
                  {j.isActive ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <ToggleRight className="h-5 w-5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ToggleLeft className="h-5 w-5" /> Paused
                    </span>
                  )}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onShowHistory(j.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Run History"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onRun(j)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Run now"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onEdit(j)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(j)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}