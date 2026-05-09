import { Archive } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import type { Website } from '../../api/hooks/websites';

export interface Backup {
  id: string;
  name: string;
  date?: string;
  size: string;
  status: string;
}

export interface BackupsSectionProps {
  website: Website;
  backups: Backup[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function BackupsSection({ website, backups, isLoading, isError }: BackupsSectionProps) {
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load backups.</p>;

  if (!backups?.length) {
    return (
      <EmptyState
        icon={Archive}
        title="No backups"
        description="No backups are available for this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-left font-medium">Size</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup) => (
            <tr key={backup.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{backup.name}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {backup.date ? new Date(backup.date).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{backup.size}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  backup.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                  backup.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {backup.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
