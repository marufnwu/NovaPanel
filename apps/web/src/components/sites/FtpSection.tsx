import { Users } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import type { Website } from '../../api/hooks/websites';

export interface FtpAccount {
  id: string;
  username: string;
  path: string;
  status: string;
}

export interface FtpSectionProps {
  website: Website;
  ftpAccounts: FtpAccount[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function FtpSection({ website, ftpAccounts, isLoading, isError }: FtpSectionProps) {
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <p className="text-sm text-destructive">Failed to load FTP accounts.</p>;

  if (!ftpAccounts?.length) {
    return (
      <EmptyState
        icon={Users}
        title="No FTP accounts"
        description="No FTP accounts are configured for this website."
      />
    );
  }

  return (
    <ResponsiveTable>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Username</th>
            <th className="px-4 py-2 text-left font-medium">Path</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {ftpAccounts.map((ftp) => (
            <tr key={ftp.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-sm font-medium">{ftp.username}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{ftp.path}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  ftp.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {ftp.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
