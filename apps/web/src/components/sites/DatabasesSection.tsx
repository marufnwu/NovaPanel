import { Database } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import type { Website } from '../../api/hooks/websites';

export interface Database {
  id: string;
  name: string;
  type: string;
  size: string;
}

export interface DatabasesSectionProps {
  website: Website;
  databases: Database[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function DatabasesSection({ website, databases, isLoading, isError }: DatabasesSectionProps) {
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load databases.</p>;

  if (!databases?.length) {
    return (
      <EmptyState
        icon={Database}
        title="No databases"
        description="No databases are associated with this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-left font-medium">Size</th>
          </tr>
        </thead>
        <tbody>
          {databases.map((db) => (
            <tr key={db.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-sm font-medium">{db.name}</td>
              <td className="px-4 py-2 text-muted-foreground">{db.type}</td>
              <td className="px-4 py-2 text-muted-foreground">{db.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
