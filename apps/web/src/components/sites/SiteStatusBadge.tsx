import type { Site } from '../../api/hooks/sites';

interface SiteStatusBadgeProps {
  status: Site['status'];
}

export function SiteStatusBadge({ status }: SiteStatusBadgeProps) {
  const styles = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-orange-500/10 text-orange-500',
    pending: 'bg-yellow-500/10 text-yellow-500',
    error: 'bg-red-500/10 text-red-500',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
