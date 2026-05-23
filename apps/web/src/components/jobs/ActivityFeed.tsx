import { useState, useMemo, useEffect } from 'react';
import { useJobNotifications, type JobNotification } from './JobNotificationProvider';
import { useJobs, type BackgroundJob } from '../../api/hooks/jobs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, XCircle, Loader2, Clock, Trash2, ExternalLink, BarChart3 } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const STATUS_CONFIG: Record<string, { icon: typeof Loader2; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-blue-500', label: 'Queued' },
  running: { icon: Loader2, color: 'text-blue-500 animate-spin', label: 'Running' },
  done: { icon: CheckCircle2, color: 'text-green-500', label: 'Done' },
  success: { icon: CheckCircle2, color: 'text-green-500', label: 'Done' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: 'Cancelled' },
};

function jobNotificationFromApiJob(job: BackgroundJob): JobNotification {
  let status: JobNotification['status'] = 'queued';
  if (job.status === 'pending') status = 'queued';
  else if (job.status === 'running') status = 'running';
  else if (job.status === 'success') status = 'done';
  else if (job.status === 'failed') status = 'failed';
  return {
    jobId: job.id,
    type: job.type,
    status,
    message: `${job.type} — ${job.status}`,
    progress: job.status === 'running' && job.result ? (job.result.progress as number) : undefined,
    timestamp: job.completedAt || job.startedAt || job.createdAt,
  };
}

function JobItem({ job, onDismiss }: { job: JobNotification; onDismiss: () => void }) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
      <div className={`mt-0.5 rounded-full p-1.5 bg-muted ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{job.message}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color} bg-muted/50`}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(job.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {job.progress !== undefined && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ActivityFeed() {
  const { jobs: wsJobs, dismissJob, clearAllJobs, runningCount } = useJobNotifications();
  const [open, setOpen] = useState(false);
  const [seenJobIds, setSeenJobIds] = useState<Set<string>>(new Set());

  const { data: apiJobs } = useJobs({ limit: 50 });

  const allJobs = useMemo(() => {
    const result: JobNotification[] = [...wsJobs];
    for (const job of apiJobs || []) {
      if (!seenJobIds.has(job.id)) {
        result.push(jobNotificationFromApiJob(job));
      }
    }
    const unique = result.reduce((acc, job) => {
      if (!acc.find(j => j.jobId === job.jobId)) acc.push(job);
      return acc;
    }, [] as JobNotification[]);
    return unique.slice(0, 50);
  }, [wsJobs, apiJobs, seenJobIds]);

  useEffect(() => {
    if (open) {
      setSeenJobIds(prev => {
        const next = new Set(prev);
        for (const job of wsJobs) next.add(job.jobId);
        return next;
      });
    }
  }, [open, wsJobs]);

  const failedJobs = allJobs.filter(j => j.status === 'failed');
  const recentJobs = allJobs.slice(0, 20);
  const failedCount = failedJobs.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        onClick={() => setOpen(true)}
        title="Activity Feed"
      >
        <BarChart3 className="h-4 w-4" />
        {failedCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {failedCount > 9 ? '9+' : failedCount}
          </span>
        )}
        {!failedCount && runningCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {runningCount > 9 ? '9+' : runningCount}
          </span>
        )}
      </Button>

      <SheetContent side="right" className="w-96 flex flex-col p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Activity Feed</h3>
            <p className="text-xs text-muted-foreground">{allJobs.length} job(s)</p>
          </div>
          <div className="flex items-center gap-1">
            {allJobs.length > 0 && (
              <button
                onClick={clearAllJobs}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {failedJobs.length > 0 && (
          <div className="border-b border-border bg-red-500/5 px-4 py-2">
            <p className="text-xs text-red-600 font-medium">
              {failedJobs.length} failed job{failedJobs.length > 1 ? 's' : ''} — check the Jobs page for details
            </p>
            <Link
              to="/jobs"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all jobs <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground">Background job updates will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentJobs.map((job) => (
                <JobItem
                  key={job.jobId}
                  job={job}
                  onDismiss={() => dismissJob(job.jobId)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}