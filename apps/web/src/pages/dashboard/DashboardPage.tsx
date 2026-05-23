import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { api } from '../../api/client';
import { Icon } from '../../components/icons';

interface ServerStats {
  cpu: number;
  ram: number;
  disk: number;
  uptime: number;
}

interface Site {
  id: string;
  name: string;
  status: string;
  domain: string;
  createdAt: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Service {
  name: string;
  status: 'running' | 'stopped' | 'pending';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useQuery<ServerStats>({
    queryKey: ['stats', 'server'],
    queryFn: () => api.get('/stats/server'),
  });

  const { data: sites, isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r: any) => r.items || []),
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['jobs', { limit: 5 }],
    queryFn: () => api.get('/jobs?limit=5').then((r: any) => r.items || []),
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => api.get('/services'),
  });

  const isLoading = statsLoading || sitesLoading || jobsLoading;

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Dashboard</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="CPU" value={stats?.cpu ?? 0} sub="%" />
        <StatCard label="RAM" value={stats?.ram ?? 0} sub="%" />
        <StatCard label="Disk" value={stats?.disk ?? 0} sub="%" />
        <StatCard
          label="Sites"
          value={sites?.length ?? 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Services">
          <div className="space-y-2">
            {services?.map((service) => (
              <div key={service.name} className="flex items-center justify-between">
                <span className="text-small">{service.name}</span>
                <StatusBadge status={service.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent Activity">
          <div className="space-y-2">
            {jobs?.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between">
                <span className="text-small">{job.type}</span>
                <StatusBadge status={job.status as any} />
              </div>
            ))}
            {(!jobs || jobs.length === 0) && (
              <p className="text-small text-foreground-tertiary">No recent activity</p>
            )}
          </div>
        </Card>
      </div>

      <Card title="Quick Actions">
        <div className="flex gap-2">
          <Button onClick={() => navigate({ to: '/sites' })}>
            <Icon name="icon-plus" size={16} />
            Create Site
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: '/terminal' })}>
            <Icon name="icon-terminal" size={16} />
            Open Terminal
          </Button>
        </div>
      </Card>
    </div>
  );
}