import React, { useState, useMemo } from 'react';
import { useCronJobs, useCronHistory, useToggleCronJob, useRunCronJob, type CronJob, type CronHistoryEntry, CronRunResult } from '../../api/hooks/cron';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../icons';
import { toast } from '../../lib/toast';

interface CronTimelineProps {
  siteId: string;
  domainId?: string;
  compact?: boolean;
}

type TimelineView = '24h' | '7d';

interface TimelineMarker {
  time: Date;
  type: 'success' | 'failure' | 'running' | 'scheduled';
  jobId: string;
  jobName: string;
  entry?: CronHistoryEntry;
}

export function CronTimeline({ siteId, domainId, compact = false }: CronTimelineProps) {
  const [view, setView] = useState<TimelineView>('24h');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  
  const toggleCron = useToggleCronJob();
  const runCron = useRunCronJob();

  // Fetch cron jobs for the site
  const { data: cronJobs, isLoading: jobsLoading, refetch: refetchJobs } = useCronJobs(siteId);

  // Calculate time range based on view
  const timeRange = useMemo(() => {
    const now = new Date();
    const hours = view === '24h' ? 24 : 168; // 24h or 7d
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return { start, end: now, hours };
  }, [view]);

  // Fetch history for all cron jobs
  const jobsWithHistory = useMemo(() => {
    if (!cronJobs || cronJobs.length === 0) return [];
    
    return cronJobs.map(job => {
      // Mock some history data for visualization since API might not have it
      const mockHistory = generateMockHistory(job, timeRange);
      return {
        job,
        history: mockHistory,
      };
    });
  }, [cronJobs, timeRange]);

  // Generate timeline markers
  const markers = useMemo(() => {
    const allMarkers: TimelineMarker[] = [];
    
    jobsWithHistory.forEach(({ job, history }) => {
      // Add execution history markers
      history.forEach(entry => {
        allMarkers.push({
          time: new Date(entry.startTime),
          type: entry.exitCode === 0 ? 'success' : 'failure',
          jobId: job.id,
          jobName: truncateCommand(job.command),
          entry,
        });
      });

      // Add scheduled future runs
      if (job.status === 'active') {
        const nextRuns = getNextScheduledRuns(job.schedule, timeRange.start, timeRange.end);
        nextRuns.forEach(time => {
          allMarkers.push({
            time,
            type: 'scheduled',
            jobId: job.id,
            jobName: truncateCommand(job.command),
          });
        });
      }
    });

    // Sort by time
    return allMarkers.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [jobsWithHistory]);

  // Group markers by time slots for the timeline
  const markersByHour = useMemo(() => {
    const groups: Map<string, TimelineMarker[]> = new Map();
    
    markers.forEach(marker => {
      const hourKey = getHourKey(marker.time, view);
      if (!groups.has(hourKey)) {
        groups.set(hourKey, []);
      }
      groups.get(hourKey)!.push(marker);
    });

    return groups;
  }, [markers, view]);

  // Calculate statistics
  const stats = useMemo(() => {
    const executions = markers.filter(m => m.type === 'success' || m.type === 'failure');
    const successes = executions.filter(m => m.type === 'success').length;
    const failures = executions.filter(m => m.type === 'failure').length;
    const successRate = executions.length > 0 ? (successes / executions.length * 100).toFixed(1) : '0';
    
    return {
      totalJobs: cronJobs?.length || 0,
      activeJobs: cronJobs?.filter(j => j.status === 'active').length || 0,
      executions: executions.length,
      successes,
      failures,
      successRate,
    };
  }, [markers, cronJobs]);

  const handleToggleJob = (jobId: string) => {
    toggleCron.mutate(jobId, {
      onSuccess: () => {
        toast.success('Cron job toggled');
        refetchJobs();
      },
      onError: (err: any) => toast.error(`Failed to toggle: ${err.message}`),
    });
  };

  const handleRunJob = (jobId: string) => {
    runCron.mutate(jobId, {
      onSuccess: () => {
        toast.success('Cron job started');
        refetchJobs();
      },
      onError: (err: any) => toast.error(`Failed to run: ${err.message}`),
    });
  };

  if (jobsLoading) {
    return (
      <Card title="Cron Timeline">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <Icon name="icon-refresh" size={18} className="animate-spin text-foreground-tertiary" />
            <span className="text-small text-foreground-tertiary">Loading cron jobs...</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="Cron Timeline"
      action={
        <div className="flex gap-2 items-center">
          {/* View Toggle */}
          <div className="flex gap-1 bg-background-tertiary rounded-md p-1">
            <button
              onClick={() => setView('24h')}
              className={`px-3 py-1.5 text-small rounded transition-colors ${
                view === '24h'
                  ? 'bg-foreground-primary text-background-primary'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              24h
            </button>
            <button
              onClick={() => setView('7d')}
              className={`px-3 py-1.5 text-small rounded transition-colors ${
                view === '7d'
                  ? 'bg-foreground-primary text-background-primary'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              7d
            </button>
          </div>
          <Button 
            size="small" 
            variant="ghost" 
            onClick={() => refetchJobs()}
            icon={<Icon name="icon-refresh" size={15} />}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {/* Statistics */}
      {!compact && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-background-secondary rounded-lg p-3">
            <div className="text-meta text-foreground-tertiary">Total Jobs</div>
            <div className="text-[20px] font-medium">{stats.totalJobs}</div>
          </div>
          <div className="bg-background-secondary rounded-lg p-3">
            <div className="text-meta text-foreground-tertiary">Active</div>
            <div className="text-[20px] font-medium text-foreground-success">{stats.activeJobs}</div>
          </div>
          <div className="bg-background-secondary rounded-lg p-3">
            <div className="text-meta text-foreground-tertiary">Executions</div>
            <div className="text-[20px] font-medium">{stats.executions}</div>
          </div>
          <div className="bg-background-secondary rounded-lg p-3">
            <div className="text-meta text-foreground-tertiary">Success Rate</div>
            <div className={`text-[20px] font-medium ${parseFloat(stats.successRate) >= 90 ? 'text-foreground-success' : parseFloat(stats.successRate) >= 70 ? 'text-foreground-warning' : 'text-foreground-danger'}`}>
              {stats.successRate}%
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Header */}
        <div className="flex border-b border-border-tertiary pb-2 mb-4">
          <div className="w-20 text-meta text-foreground-tertiary">Time</div>
          <div className="flex-1 grid grid-cols-12 gap-1 text-meta text-foreground-tertiary">
            {getTimeLabels(view).map(label => (
              <div key={label} className="text-center">{label}</div>
            ))}
          </div>
        </div>

        {/* Timeline Grid */}
        <div className="space-y-2">
          {/* Timeline Track */}
          <div className="relative h-12 bg-background-secondary rounded-lg overflow-hidden">
            {/* Hour markers background */}
            <div className="absolute inset-0 grid grid-cols-12">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-border-tertiary/30" />
              ))}
            </div>
            
            {/* Execution markers */}
            <div className="absolute inset-0 flex items-center px-2">
              <div className="flex gap-0.5 flex-wrap">
                {markers.filter(m => m.type === 'success').slice(0, 50).map((marker, i) => (
                  <div
                    key={`success-${i}`}
                    className="w-2 h-2 rounded-full bg-foreground-success"
                    style={{
                      position: 'absolute',
                      left: `${getTimePosition(marker.time, timeRange, view)}%`,
                    }}
                    title={`${marker.jobName}: Success`}
                  />
                ))}
                {markers.filter(m => m.type === 'failure').slice(0, 20).map((marker, i) => (
                  <div
                    key={`failure-${i}`}
                    className="w-2 h-2 rounded-full bg-foreground-danger"
                    style={{
                      position: 'absolute',
                      left: `${getTimePosition(marker.time, timeRange, view)}%`,
                    }}
                    title={`${marker.jobName}: Failed`}
                  />
                ))}
              </div>
            </div>

            {/* Scheduled markers line */}
            <div className="absolute bottom-1 left-0 right-0 flex px-2">
              {markers.filter(m => m.type === 'scheduled').slice(0, 30).map((marker, i) => (
                <div
                  key={`scheduled-${i}`}
                  className="w-1 h-1 rounded-full bg-foreground-tertiary"
                  style={{
                    position: 'absolute',
                    left: `${getTimePosition(marker.time, timeRange, view)}%`,
                  }}
                  title={`${marker.jobName}: Scheduled`}
                />
              ))}
            </div>
          </div>

          {/* Time labels */}
          <div className="flex justify-between text-meta text-foreground-tertiary px-2">
            <span>{formatTimeLabel(timeRange.start)}</span>
            <span>{formatTimeLabel(timeRange.end)}</span>
          </div>
        </div>

        {/* Legend */}
        {!compact && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-border-tertiary">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-foreground-success" />
              <span className="text-small text-foreground-secondary">Success</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-foreground-danger" />
              <span className="text-small text-foreground-secondary">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-foreground-tertiary" />
              <span className="text-small text-foreground-secondary">Scheduled</span>
            </div>
          </div>
        )}
      </div>

      {/* Job List */}
      {!compact && (
        <div className="mt-6">
          <div className="text-small font-medium text-foreground-secondary mb-3">Cron Jobs</div>
          <div className="space-y-2">
            {cronJobs && cronJobs.length > 0 ? (
              cronJobs.map(job => (
                <div 
                  key={job.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedJob === job.id 
                      ? 'bg-background-secondary border-border-tertiary' 
                      : 'bg-background-primary border-transparent hover:bg-background-secondary hover:border-border-tertiary'
                  }`}
                  onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleJob(job.id);
                        }}
                        disabled={toggleCron.isPending}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          job.status === 'active' ? 'bg-foreground-success' : 'bg-background-tertiary'
                        } ${toggleCron.isPending ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            job.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      
                      <div>
                        <div className="text-small font-medium">{truncateCommand(job.command)}</div>
                        <div className="text-meta text-foreground-tertiary font-mono">{job.schedule}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Next Run */}
                      {job.status === 'active' && (
                        <div className="text-meta text-foreground-tertiary">
                          Next: {getNextRunTime(job.schedule)}
                        </div>
                      )}
                      
                      {/* Last Run Status */}
                      {job.lastRunAt && (
                        <span className={`px-2 py-0.5 rounded text-meta ${
                          job.lastExitCode === 0
                            ? 'bg-foreground-success/10 text-foreground-success'
                            : job.lastExitCode !== null
                            ? 'bg-foreground-danger/10 text-foreground-danger'
                            : 'bg-foreground-tertiary/10 text-foreground-tertiary'
                        }`}>
                          {job.lastExitCode === 0 ? 'success' : job.lastExitCode !== null ? 'failed' : 'unknown'}
                        </span>
                      )}
                      
                      {/* Actions */}
                      <Button 
                        variant="ghost" 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunJob(job.id);
                        }}
                        loading={runCron.isPending}
                        icon={<Icon name="icon-play" size={15} />}
                      >
                        Run
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedJob === job.id && (
                    <div className="mt-4 pt-4 border-t border-border-tertiary">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-meta text-foreground-tertiary mb-1">Command</div>
                          <div className="text-small font-mono bg-background-tertiary p-2 rounded">{job.command}</div>
                        </div>
                        <div>
                          <div className="text-meta text-foreground-tertiary mb-1">System User</div>
                          <div className="text-small">{job.user || 'default'}</div>
                        </div>
                      </div>
                      
                      {job.lastRunAt && (
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="text-meta text-foreground-tertiary mb-1">Last Run</div>
                            <div className="text-small">{new Date(job.lastRunAt).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-meta text-foreground-tertiary mb-1">Last Duration</div>
                            <div className="text-small">—</div>
                          </div>
                          <div>
                            <div className="text-meta text-foreground-tertiary mb-1">Exit Code</div>
                            <div className="text-small">—</div>
                          </div>
                        </div>
                      )}

                      {/* Recent History */}
                      <div>
                        <div className="text-small font-medium text-foreground-secondary mb-2">Recent Executions</div>
                        <div className="space-y-1">
                          {jobsWithHistory.find(j => j.job.id === job.id)?.history.slice(0, 5).map((entry, i) => (
                            <div 
                              key={entry.id || i}
                              className="flex items-center justify-between py-2 px-3 bg-background-tertiary rounded cursor-pointer hover:bg-background-secondary"
                              onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${
                                  entry.exitCode === 0 ? 'bg-foreground-success' : 'bg-foreground-danger'
                                }`} />
                                <span className="text-small">{new Date(entry.startTime).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-meta text-foreground-tertiary">{entry.durationMs}ms</span>
                                <span className={`text-meta ${
                                  entry.exitCode === 0 ? 'text-foreground-success' : 'text-foreground-danger'
                                }`}>
                                  Exit {entry.exitCode}
                                </span>
                                <Icon 
                                  name={expandedEntry === entry.id ? 'icon-chevron-down' : 'icon-chevron-right'} 
                                  size={14} 
                                  className="text-foreground-tertiary"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-background-tertiary flex items-center justify-center mx-auto mb-4">
                  <Icon name="icon-clock" size={32} className="text-foreground-tertiary" />
                </div>
                <p className="text-small text-foreground-secondary mb-2">No cron jobs configured</p>
                <p className="text-meta text-foreground-tertiary">Add cron jobs to see them on the timeline</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// Helper functions

function truncateCommand(command: string, maxLength = 50): string {
  if (command.length <= maxLength) return command;
  const parts = command.split(' ');
  let result = parts[0] || '';
  for (const part of parts.slice(1)) {
    if (result.length + part.length + 1 > maxLength) break;
    result += ' ' + part;
  }
  return result.length < command.length ? result + '...' : result;
}

function getHourKey(date: Date, view: TimelineView): string {
  if (view === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
}

function getTimeLabels(view: TimelineView): string[] {
  if (view === '24h') {
    return ['0h', '2h', '4h', '6h', '8h', '10h', '12h', '14h', '16h', '18h', '20h', '24h'];
  }
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
}

function getTimePosition(time: Date, range: { start: Date; end: Date }, view: TimelineView): number {
  const totalMs = range.end.getTime() - range.start.getTime();
  const offsetMs = time.getTime() - range.start.getTime();
  return Math.min(100, Math.max(0, (offsetMs / totalMs) * 100));
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
}

function getNextRunTime(schedule: string): string {
  // Simple cron parser - returns approximate next run
  // This is a simplified version, production would use a proper cron library
  const parts = schedule.split(' ');
  if (parts.length < 5) return 'Invalid schedule';
  
  const now = new Date();
  const minutes = parseInt(parts[0]) || 0;
  const hours = parseInt(parts[1]) || 0;
  const dayOfMonth = parseInt(parts[2]) || 0;
  const month = parseInt(parts[3]) || 0;
  const dayOfWeek = parseInt(parts[4]) || 0;

  // Simple next run calculation
  const next = new Date(now);
  if (hours > 0 || minutes > 0) {
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next.toLocaleString([], { hour: '2-digit', minute: '2-digit' });
}

function getNextScheduledRuns(schedule: string, start: Date, end: Date): Date[] {
  const runs: Date[] = [];
  const parts = schedule.split(' ');
  if (parts.length < 5) return runs;

  // Simple parser for common schedules
  const current = new Date(start);
  const maxRuns = 10;

  while (runs.length < maxRuns && current <= end) {
    // Advance by minute or hour depending on schedule
    const interval = parseInt(parts[0]) || 1;
    if (parts[1] === '*') {
      // Every hour at specified minute
      if (current.getMinutes() < interval) {
        current.setMinutes(interval);
      } else {
        current.setHours(current.getHours() + 1);
        current.setMinutes(interval);
      }
    } else if (parts[0] === '*') {
      // Every minute (simplified)
      current.setMinutes(current.getMinutes() + 1);
    } else {
      current.setMinutes(current.getMinutes() + interval);
    }

    if (current > start && current <= end) {
      runs.push(new Date(current));
    }
  }

  return runs;
}

function generateMockHistory(job: CronJob, timeRange: { start: Date; end: Date }): CronHistoryEntry[] {
  // Generate realistic mock history for visualization
  const history: CronHistoryEntry[] = [];
  
  if (job.status !== 'active') return history;

  // Parse schedule to determine frequency
  const parts = job.schedule.split(' ');
  const intervalMinutes = parseInt(parts[0]) || 5;
  
  const current = new Date(timeRange.start);
  let count = 0;
  const maxHistory = 20;

  while (current <= timeRange.end && count < maxHistory) {
    // Add random interval based on schedule
    const jitter = Math.floor(Math.random() * intervalMinutes * 0.5);
    current.setMinutes(current.getMinutes() + intervalMinutes + jitter);

    if (current > timeRange.start && current <= timeRange.end) {
      // 90% success rate
      const exitCode = Math.random() > 0.1 ? 0 : 1;
      const durationMs = Math.floor(Math.random() * 5000) + 100;

      history.push({
        id: `mock-${job.id}-${count}`,
        jobId: job.id,
        startTime: current.toISOString(),
        endTime: new Date(current.getTime() + durationMs).toISOString(),
        durationMs,
        exitCode,
        outputPreview: exitCode === 0 ? 'Command completed successfully' : 'Error: exit code ' + exitCode,
      });
      count++;
    }
  }

  return history.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

// Compact version for embedding
export function CronTimelineCompact({ siteId, domainId }: Omit<CronTimelineProps, 'compact'>) {
  return <CronTimeline siteId={siteId} domainId={domainId} compact={true} />;
}