import { useDomainCloudflareStatus } from '../../../api/hooks/domains';

export function DomainStatusBadge({ domainId }: { domainId: string }) {
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
