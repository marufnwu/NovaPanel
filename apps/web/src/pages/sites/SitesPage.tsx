import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { api } from '../../api/client';
import { Icon } from '../../components/icons';
import { cn } from '../../lib/utils';

interface Site {
  id: string;
  name: string;
  runtime: string;
  status: string;
  domain: string;
  createdAt: string;
}

export function SitesPage() {
  const navigate = useNavigate();
  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r: any) => r.items || []),
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (site: Site) => (
        <span className="font-medium">{site.name}</span>
      ),
    },
    {
      key: 'runtime',
      label: 'Runtime',
    },
    {
      key: 'status',
      label: 'Status',
      render: (site: Site) => <StatusBadge status={site.status as any} />,
    },
    {
      key: 'domain',
      label: 'Domain',
      render: (site: Site) => site.domain || '—',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (site: Site) => new Date(site.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (site: Site) => (
        <Button
          variant="ghost"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate({ to: '/sites/$siteId', params: { siteId: site.id } });
          }}
          icon={<Icon name="icon-arrow-right" size={15} />}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Sites</h1>
        <Button icon={<Icon name="icon-plus" size={16} />}>
          Create Site
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={sites || []}
        rowKey={(site) => site.id}
        onRowClick={(site) => navigate({ to: '/sites/$siteId', params: { siteId: site.id } })}
        emptyState={
          <EmptyState
            icon="icon-host"
            title="No sites yet"
            description="Create your first site to get started"
            action={{
              label: 'Create Site',
              onClick: () => {},
            }}
          />
        }
      />
    </div>
  );
}