import { Globe, Server, HardDrive, Activity } from 'lucide-react';
import type { Site } from '../../api/hooks/sites';
import { SiteStatusBadge } from './SiteStatusBadge';

interface SiteCardProps {
  site: Site;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  onSuspend?: () => void;
  onActivate?: () => void;
}

export function SiteCard({ site, selected, onClick, onSelect }: SiteCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border bg-card p-5 hover:border-primary/50 transition-colors cursor-pointer ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="h-4 w-4 rounded border-input text-primary"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="rounded bg-primary/10 p-2">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">{site.name}</h3>
            <p className="text-sm text-muted-foreground">{site.documentRoot}</p>
          </div>
        </div>
        <SiteStatusBadge status={site.status} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Server className="h-3.5 w-3.5" />
          <span>PHP {site.phpVersion || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5" />
          <span>{site.diskUsedMb ? `${site.diskUsedMb} MB` : '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          <span>{site.bandwidthUsedMb ? `${site.bandwidthUsedMb} MB` : '—'}</span>
        </div>
      </div>
    </div>
  );
}
