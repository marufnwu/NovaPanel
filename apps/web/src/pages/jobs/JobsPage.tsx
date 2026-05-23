import { useState } from 'react';
import {
  useJobs,
  useJob,
  useCancelJob,
  useRefreshJobs,
  type BackgroundJob,
} from '../../api/hooks/jobs';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  RefreshCw,
  XCircle,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '../../lib/toast';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/10 text-gray-400',
  running: 'bg-blue-500/10 text-blue-500',
  success: 'bg-green-500/10 text-green-500',
  failed: 'bg-red-500/10 text-red-500',
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  success: CheckCircle,
  failed: AlertTriangle,
};

const TYPE_LABELS: Record<string, string> = {
  nginx_config_regenerate: 'Nginx Config',
  nginx_reload: 'Nginx Reload',
  pm2_restart: 'PM2 Restart',
  pm2_stop: 'PM2 Stop',
  ssl_provision: 'SSL Provision',
  deployment_build: 'Deployment Build',
  deployment_rollback: 'Deployment Rollback',
  metric_collect: 'Metric Collection',
  alert_evaluate: 'Alert Evaluation',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function JobDetailModal({ job, onClose }: { job: BackgroundJob; onClose: () => void }) {
  const Icon = STATUS_ICONS[job.status] ?? Clock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`rounded p-2 ${STATUS_COLORS[job.status]}`}>
              <Icon className={`h-5 w-5 ${job.status === 'running' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-semibold">{TYPE_LABELS[job.type] ?? job.type}</h3>
              <p className="text-sm text-muted-foreground font-mono">{job.id}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>✕</Button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">Status</div>
            <Badge className={STATUS_COLORS[job.status]}>{job.status}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">Attempts</div>
            <div>{job.attempts} / {job.maxAttempts}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">Run At</div>
            <div>{new Date(job.runAt).toLocaleString()}</div>
          </div>
          {job.startedAt && (
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">Started</div>
              <div>{new Date(job.startedAt).toLocaleString()}</div>
            </div>
          )}
          {job.completedAt && (
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">Completed</div>
              <div>{new Date(job.completedAt).toLocaleString()}</div>
            </div>
          )}
          {job.error && (
            <div className="rounded border border-red-500/20 bg-red-500/5 p-3">
              <div className="text-muted-foreground mb-1">Error</div>
              <div className="text-red-400 font-mono text-xs">{job.error}</div>
            </div>
          )}
          {job.result && (
            <div className="rounded border border-border bg-muted/30 p-3">
              <div className="text-muted-foreground mb-1">Result</div>
              <pre className="text-xs font-mono overflow-auto">{JSON.stringify(job.result, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

export function JobsPage() {
  const { data: jobs, isLoading } = useJobs({ limit: 50 });
  const cancelJob = useCancelJob();
  const refreshJobs = useRefreshJobs();
  const [viewJob, setViewJob] = useState<BackgroundJob | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const handleCancel = () => {
    if (!cancelId) return;
    cancelJob.mutate(cancelId, {
      onSuccess: () => { toast.success('Job cancelled'); setCancelId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed'),
    });
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader
        title="Background Jobs"
        icon={BarChart3}
      />

      <div className="mb-6 flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={() => refreshJobs()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <ConfirmDialog
        open={!!cancelId}
        title="Cancel Job"
        message="This will stop the job if it's currently running. This cannot be undone."
        confirmText="Cancel Job"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />

      {viewJob && (
        <JobDetailModal job={viewJob} onClose={() => setViewJob(null)} />
      )}

      {!jobs || jobs.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No jobs"
          description="Background tasks will appear here when jobs are queued."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Run At</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const Icon = STATUS_ICONS[job.status] ?? Clock;
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge className={STATUS_COLORS[job.status]}>
                        <Icon className={`h-3 w-3 mr-1 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium font-mono text-sm">
                      {TYPE_LABELS[job.type] ?? job.type}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.attempts}/{job.maxAttempts}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(job.runAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.completedAt ? timeAgo(job.completedAt) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-red-400 max-w-xs truncate">
                      {job.error ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setViewJob(job)} title="View details">
                          🔍
                        </Button>
                        {(job.status === 'pending' || job.status === 'running') && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setCancelId(job.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}