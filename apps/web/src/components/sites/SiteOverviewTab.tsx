import type { Website } from '../../api/hooks/websites';
import { SiteInfoGrid } from './SiteInfoGrid';
import { Activity, Globe } from 'lucide-react';

interface SiteOverviewTabProps {
  site: Website;
}

export function SiteOverviewTab({ site }: SiteOverviewTabProps) {
  return (
    <div className="space-y-6">
      <SiteInfoGrid site={site} />

      <div className="flex flex-wrap gap-3">
        <a
          href={`/php?domain=${encodeURIComponent(site.name)}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Activity className="h-4 w-4" /> PHP Settings
        </a>
        <a
          href={`http://${site.name}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Globe className="h-4 w-4" /> Open Website
        </a>
      </div>
    </div>
  );
}