import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { useAuditLog, type AuditEntry } from '../../api/hooks/audit';

export function AuditPage() {
  const [filters, setFilters] = useState({ search: '', page: 1 });
  const { data, isLoading } = useAuditLog({ search: filters.search, perPage: 50 });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setFilters({ ...filters, search: formData.get('search') as string });
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const entries = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      key: 'timestamp',
      label: 'Time',
      render: (e: AuditEntry) => new Date(e.timestamp).toLocaleString(),
    },
    {
      key: 'action',
      label: 'Action',
      render: (e: AuditEntry) => <span className="font-medium">{e.action}</span>,
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (e: AuditEntry) => <span className="text-foreground-secondary">{e.resource || '—'}</span>,
    },
    {
      key: 'ip',
      label: 'IP',
      render: (e: AuditEntry) => <span className="font-mono text-small">{e.ip || '—'}</span>,
    },
    {
      key: 'details',
      label: 'Details',
      render: (e: AuditEntry) => (
        <span className="text-small text-foreground-tertiary truncate max-w-xs inline-block">
          {e.details || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Audit Log</h1>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="mb-4">
          <Input name="search" placeholder="Search audit log..." defaultValue={filters.search} />
        </form>

        {entries.length > 0 ? (
          <DataTable
            columns={columns}
            data={entries}
            rowKey={(e) => e.id}
          />
        ) : (
          <p className="text-small text-foreground-tertiary text-center py-8">No audit entries</p>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-small text-foreground-secondary">
              Showing page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="small" disabled={meta.page <= 1} onClick={() => setFilters({ ...filters, page: meta.page - 1 })}>
                Previous
              </Button>
              <Button variant="ghost" size="small" disabled={meta.page >= meta.totalPages} onClick={() => setFilters({ ...filters, page: meta.page + 1 })}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}