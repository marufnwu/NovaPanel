import { useDomainCloudflareStatus } from '../../api/hooks/domains';

export interface DomainStatusBadgeProps {
  /** Pass domainId to fetch Cloudflare status and show overall status */
  domainId?: string;
  /** Alternatively pass status directly (overrides domainId lookup) */
  status?: 'active' | 'suspended' | 'local' | 'public' | 'tunnel';
}

export function DomainStatusBadge({ domainId, status: directStatus }: DomainStatusBadgeProps) {
  // If status prop is provided directly, use it
  if (directStatus !== undefined) {
    const config: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-green-500/10 text-green-500' },
      suspended: { label: 'Suspended', className: 'bg-red-500/10 text-red-500' },
      local: { label: 'Local', className: 'bg-gray-500/10 text-gray-500' },
      public: { label: 'Public', className: 'bg-green-500/10 text-green-500' },
      tunnel: { label: 'Tunnel', className: 'bg-orange-500/10 text-orange-500' },
    };
    const { label, className } = config[directStatus] || config.local;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  }

  // Fall back to fetching Cloudflare status by domainId
  if (!domainId) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  const { data: status } = useDomainCloudflareStatus(domainId);

  if (!status) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  const config = {
    live: { label: 'Live', className: 'bg-green-500/10 text-green-500' },
    local: { label: 'Local', className: 'bg-gray-500/10 text-gray-500' },
    down: { label: 'Down', className: 'bg-red-500/10 text-red-500' },
    redirect: { label: 'Redirect', className: 'bg-blue-500/10 text-blue-500' },
    suspended: { label: 'Suspended', className: 'bg-orange-500/10 text-orange-500' },
  };

  const { label, className } = config[status.overall] || config.local;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
