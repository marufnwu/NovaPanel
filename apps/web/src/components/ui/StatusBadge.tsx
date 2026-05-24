import { cn } from '../../lib/utils';

type Status = 'running' | 'stopped' | 'pending' | 'deploying' | 'active' | 'inactive' | 'expired' | 'completed' | 'failed' | 'restoring' | 'error';

const statusConfig: Record<Status, { label: string; dotColor: string; textColor: string }> = {
  running: { label: 'Running', dotColor: 'bg-foreground-success', textColor: 'text-foreground-success' },
  stopped: { label: 'Stopped', dotColor: 'bg-foreground-danger', textColor: 'text-foreground-danger' },
  pending: { label: 'Pending', dotColor: 'bg-foreground-warning', textColor: 'text-foreground-warning' },
  deploying: { label: 'Deploying', dotColor: 'bg-foreground-info', textColor: 'text-foreground-info' },
  active: { label: 'Active', dotColor: 'bg-foreground-success', textColor: 'text-foreground-success' },
  inactive: { label: 'Inactive', dotColor: 'bg-foreground-tertiary', textColor: 'text-foreground-tertiary' },
  expired: { label: 'Expired', dotColor: 'bg-foreground-danger', textColor: 'text-foreground-danger' },
  completed: { label: 'Completed', dotColor: 'bg-foreground-success', textColor: 'text-foreground-success' },
  failed: { label: 'Failed', dotColor: 'bg-foreground-danger', textColor: 'text-foreground-danger' },
  restoring: { label: 'Restoring', dotColor: 'bg-foreground-warning', textColor: 'text-foreground-warning' },
  error: { label: 'Error', dotColor: 'bg-foreground-danger', textColor: 'text-foreground-danger' },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-[10px] py-[3px] rounded-full text-meta font-medium',
        config.textColor,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor, status === 'deploying' && 'dot-pulse')} />
      {config.label}
    </span>
  );
}