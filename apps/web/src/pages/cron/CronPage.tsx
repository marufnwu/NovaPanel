import { useState } from 'react';
import { useCronJobs, useCreateCronJob, useUpdateCronJob, useDeleteCronJob, useToggleCronJob, useRunCronJob, useCronHistory, type CronJob } from '../../api/hooks/cron';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { ActionDropdown } from '../../components/ui/ActionDropdown';
import { toast } from '../../lib/toast';
import { Clock, Plus, Trash2, Play, ToggleLeft, ToggleRight, Edit2, X, Terminal, History, Mail, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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

// --- Next Run Time Calculator ---
function getNextRunTime(schedule: string): Date | null {
  try {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minStr, hourStr, dayStr, monthStr, dowStr] = parts;

    const now = new Date();
    // Start from next minute
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    // Simple brute-force: check each minute for up to 1 year
    for (let i = 0; i < 525600; i++) {
      const d = new Date(candidate.getTime() + i * 60000);
      const min = d.getMinutes();
      const hour = d.getHours();
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const dow = d.getDay();

      if (matchesField(minStr, min, 0, 59) &&
          matchesField(hourStr, hour, 0, 23) &&
          matchesField(dayStr, day, 1, 31) &&
          matchesField(monthStr, month, 1, 12) &&
          matchesField(dowStr, dow, 0, 6)) {
        return d;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function matchesField(pattern: string, value: number, min: number, max: number): boolean {
  if (pattern === '*') return true;
  if (pattern.startsWith('*/')) {
    const step = parseInt(pattern.slice(2));
    if (isNaN(step) || step === 0) return false;
    return value % step === 0;
  }
  const parts = pattern.split(',');
  return parts.some((p) => {
    if (p.includes('-')) {
      const [start, end] = p.split('-').map(Number);
      return value >= start && value <= end;
    }
    return parseInt(p) === value;
  });
}

function formatNextRun(schedule: string): string {
  const next = getNextRunTime(schedule);
  if (!next) return 'Unknown';

  const now = new Date();
  const diffMs = next.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) {
    const remainingMins = diffMins % 60;
    return remainingMins > 0 ? `in ${diffHours}h ${remainingMins}m` : `in ${diffHours}h`;
  }
  if (diffDays === 1) return `tomorrow at ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `${next.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// --- Cron Job History ---
function CronJobHistory({ jobId }: { jobId: string }) {
  const { data: history, isLoading } = useCronHistory(jobId);

  if (isLoading) return <div className="px-4 py-3"><LoadingPage /></div>;

  if (!history || history.length === 0) {
    return <div className="px-4 py-3 text-sm text-muted-foreground">No run history available.</div>;
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Duration</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Exit Code</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Output Preview</th>
          </tr>
        </thead>
        <tbody>
          {history.slice(0, 20).map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {new Date(entry.startTime).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-xs font-mono">
                {entry.durationMs < 1000 ? `${entry.durationMs}ms` : `${(entry.durationMs / 1000).toFixed(1)}s`}
              </td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  entry.exitCode === 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {entry.exitCode}
                </span>
              </td>
              <td className="px-4 py-2 text-xs font-mono text-muted-foreground max-w-xs truncate">
                {entry.outputPreview || '(no output)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

function CreateJobModal({ onClose }: { onClose: () => void }) {
  const create = useCreateCronJob();
  const [schedule, setSchedule] = useState('*/5 * * * *');
  const [command, setCommand] = useState('');
  const [systemUser, setSystemUser] = useState('root');
  const [emailOnFailure, setEmailOnFailure] = useState(false);
  const [failureEmail, setFailureEmail] = useState('');

  const handleSubmit = () => {
    if (!command.trim()) return;
    create.mutate({
      schedule,
      command,
      systemUser,
      ...(emailOnFailure && failureEmail ? { emailOnFailure, failureEmail } : {}),
    } as any, {
      onSuccess: () => {
        onClose();
        setCommand('');
        setSchedule('*/5 * * * *');
      },
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <DialogHeader>
            <DialogTitle>Create Cron Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="schedule" className="mb-1">Schedule (cron expression)</Label>
              <Input id="schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="* * * * *" className="font-mono" />
            </div>
            <div>
              <Label className="mb-1 block">Presets</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <Button key={p.value} variant={schedule === p.value ? "default" : "outline"} size="xs" onClick={() => setSchedule(p.value)} className="rounded-full">
                    {p.label}
                  </Button>
                ))}
              </div>
              {schedule && (
                <div className="mt-2 space-y-1">
                  <div className="text-sm text-muted-foreground">{humanReadable(schedule)}</div>
                  <div className="text-xs text-primary">Next: {formatNextRun(schedule)}</div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="command" className="mb-1">Command</Label>
              <Input id="command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="/usr/bin/php /var/www/vhosts/example.com/httpdocs/cron.php" className="font-mono" />
            </div>
            <div>
              <Label htmlFor="systemUser" className="mb-1">Run as</Label>
              <select id="systemUser" value={systemUser} onChange={(e) => setSystemUser(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="root">root</option>
                <option value="www-data">www-data</option>
              </select>
            </div>

            {/* Email on Failure */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <Label className="flex items-center gap-2">
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
              </Label>
              {emailOnFailure && (
                <Input
                  value={failureEmail}
                  onChange={(e) => setFailureEmail(e.target.value)}
                  placeholder="admin@example.com"
                  type="email"
                />
              )}
            </div>

            {create.error && <p className="text-sm text-destructive">{String(create.error)}</p>}
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !command.trim()}>
              {create.isPending ? 'Creating...' : 'Create Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditJobModal({ job, onClose }: { job: CronJob; onClose: () => void }) {
  const update = useUpdateCronJob();
  const [schedule, setSchedule] = useState(job.schedule);
  const [command, setCommand] = useState(job.command);
  const [systemUser, setSystemUser] = useState(job.systemUser);
  const [emailOnFailure, setEmailOnFailure] = useState((job as any).emailOnFailure || false);
  const [failureEmail, setFailureEmail] = useState((job as any).failureEmail || '');

  const handleSubmit = () => {
    update.mutate({
      id: job.id,
      schedule,
      command,
      systemUser,
      ...(emailOnFailure ? { emailOnFailure, failureEmail } : {}),
    } as any, { onSuccess: onClose });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Cron Job</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-schedule" className="mb-1">Schedule</Label>
            <Input id="edit-schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="font-mono" />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button key={p.value} variant={schedule === p.value ? "default" : "outline"} size="xs" onClick={() => setSchedule(p.value)} className="rounded-full">
                {p.label}
              </Button>
            ))}
          </div>
          {schedule && (
            <div className="text-xs text-primary">Next: {formatNextRun(schedule)}</div>
          )}
          <div>
            <Label htmlFor="edit-command" className="mb-1">Command</Label>
            <Input id="edit-command" value={command} onChange={(e) => setCommand(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label htmlFor="edit-systemUser" className="mb-1">Run as</Label>
            <select id="edit-systemUser" value={systemUser} onChange={(e) => setSystemUser(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="root">root</option>
              <option value="www-data">www-data</option>
            </select>
          </div>

          {/* Email on Failure */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <Label className="flex items-center gap-2">
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
            </Label>
            {emailOnFailure && (
              <Input
                value={failureEmail}
                onChange={(e) => setFailureEmail(e.target.value)}
                placeholder="admin@example.com"
                type="email"
              />
            )}
          </div>

          {update.error && <p className="text-sm text-destructive">{String(update.error)}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>
            {update.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunResultModal({ result, exitCode, onClose }: { result: string; exitCode: number; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-primary" />
            Run Output — Exit Code: {exitCode}
          </DialogTitle>
        </DialogHeader>
        <pre className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-4 text-sm font-mono whitespace-pre-wrap">{result || '(no output)'}</pre>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CronPage() {
  const { data: jobs, isLoading, isError, refetch } = useCronJobs();
  const deleteJob = useDeleteCronJob();
  const toggle = useToggleCronJob();
  const run = useRunCronJob();
  const [showCreate, setShowCreate] = useState(false);
  const [editJob, setEditJob] = useState<CronJob | null>(null);
  const [runResult, setRunResult] = useState<{ result: string; exitCode: number } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);

  const toggleHistory = (jobId: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  };

  const handleRun = (job: CronJob) => {
    run.mutate(job.id, {
      onSuccess: (data) => setRunResult({ result: data.stdout + '\n' + data.stderr, exitCode: data.exitCode }),
      onError: () => toast.error('Failed to run job'),
    });
  };

  if (isLoading) return <LoadingPage />;

  if (isError) {
    return (
      <div>
        <PageHeader title="Cron Jobs" description="Manage scheduled tasks" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load cron jobs</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching cron jobs.</p>
          <Button
            onClick={() => refetch()}
            variant="destructive"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cron Jobs" description="Manage scheduled tasks" icon={Clock} actions={
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Add Job
        </Button>
      } />

      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} />}
      {editJob && <EditJobModal job={editJob} onClose={() => setEditJob(null)} />}
      {runResult && <RunResultModal result={runResult.result} exitCode={runResult.exitCode} onClose={() => setRunResult(null)} />}

      {!jobs?.length ? (
        <EmptyState icon={Clock} title="No cron jobs" description="Create your first scheduled task." />
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Schedule</th>
                <th className="px-4 py-3 text-left font-medium">Command</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Last Run</th>
                <th className="px-4 py-3 text-left font-medium">Next Run</th>
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
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {j.lastRun ? new Date(j.lastRun).toLocaleString() : '—'}
                    {j.lastStatus && (
                      <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs ${j.lastStatus === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {j.lastStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {j.isActive ? (
                      <span className="text-xs text-primary font-medium">{formatNextRun(j.schedule)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Paused</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon-sm" onClick={() => toggle.mutate(j.id)}>
                      {j.isActive ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <ActionDropdown
                        items={[
                          { label: j.isActive ? 'Pause' : 'Resume', icon: j.isActive ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />, onClick: () => toggle.mutate(j.id) },
                          { label: 'Run Now', icon: <Play className="h-3.5 w-3.5" />, onClick: () => handleRun(j) },
                          { label: 'Edit', icon: <Edit2 className="h-3.5 w-3.5" />, onClick: () => setEditJob(j) },
                          { label: 'View History', icon: <History className="h-3.5 w-3.5" />, onClick: () => toggleHistory(j.id) },
                          { label: 'Delete', icon: <Trash2 className="h-3.5 w-3.5" />, variant: 'danger', onClick: () => setDeleteTarget(j) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {/* Expandable History Sections */}
      {jobs && expandedHistory.size > 0 && (
        <div className="mt-4 space-y-3">
          {jobs.filter((j) => expandedHistory.has(j.id)).map((j) => (
            <div key={`history-${j.id}`} className="rounded-lg border border-border overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => toggleHistory(j.id)}
                className="flex w-full items-center justify-between bg-muted/50 px-4 py-2.5 h-auto rounded-none"
              >
                <div className="flex items-center gap-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Run History: <code className="text-xs text-muted-foreground">{j.command}</code></span>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </Button>
              <CronJobHistory jobId={j.id} />
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={() => {
          if (deleteTarget) deleteJob.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Cron Job"
        message="This will permanently delete this cron job. This cannot be undone."
        confirmText="Delete Job"
        variant="danger"
      />
    </div>
  );
}
