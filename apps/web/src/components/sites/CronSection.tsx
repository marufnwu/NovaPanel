import { Clock } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import type { Website } from '../../api/hooks/websites';

export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  status: string;
}

export interface CronSectionProps {
  website: Website;
  cronJobs: CronJob[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function CronSection({ website, cronJobs, isLoading, isError }: CronSectionProps) {
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load cron jobs.</p>;

  if (!cronJobs?.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No cron jobs"
        description="No cron jobs are configured for this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Schedule</th>
            <th className="px-4 py-2 text-left font-medium">Command</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {cronJobs.map((job) => (
            <tr key={job.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{job.schedule}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground max-w-xs truncate">{job.command}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  job.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {job.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
