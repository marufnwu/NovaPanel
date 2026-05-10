import type { Website } from '../../api/hooks/websites';
import { SiteStatusBadge } from './SiteStatusBadge';

interface SiteInfoGridProps {
  site: Website;
}

export function SiteInfoGrid({ site }: SiteInfoGridProps) {
  const infoItems = [
    { label: 'Name', value: site.name },
    { label: 'System User', value: site.systemUser, mono: true },
    { label: 'Document Root', value: site.documentRoot, mono: true },
    { label: 'PHP Version', value: site.phpVersion || '—' },
    { label: 'PHP Handler', value: site.phpHandler || '—' },
    { label: 'Web Server', value: site.webServer || '—' },
    { label: 'Status', value: <SiteStatusBadge status={site.status} /> },
    {
      label: 'Disk Usage',
      value: site.diskUsedMb != null ? `${site.diskUsedMb} MB` : '—',
    },
    {
      label: 'Bandwidth',
      value: site.bandwidthUsedMb != null ? `${site.bandwidthUsedMb} MB` : '—',
    },
    {
      label: 'Created',
      value: site.createdAt ? new Date(site.createdAt).toLocaleDateString() : '—',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {infoItems.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <p className={`mt-1 text-sm font-semibold ${item.mono ? 'font-mono' : ''}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}