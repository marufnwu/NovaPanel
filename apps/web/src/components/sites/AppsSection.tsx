import { AppWindow } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import type { Website } from '../../api/hooks/websites';

export interface InstalledApp {
  id: string;
  appName: string;
  version: string;
  status: string;
}

export interface AppsSectionProps {
  website: Website;
  apps: InstalledApp[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function AppsSection({ website, apps, isLoading, isError }: AppsSectionProps) {
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load apps.</p>;

  if (!apps?.length) {
    return (
      <EmptyState
        icon={AppWindow}
        title="No apps installed"
        description="No applications are installed on this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">App</th>
            <th className="px-4 py-2 text-left font-medium">Version</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{app.appName}</td>
              <td className="px-4 py-2 text-muted-foreground">{app.version}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  app.status === 'active' ? 'bg-green-500/10 text-green-500' :
                  app.status === 'installing' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {app.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
