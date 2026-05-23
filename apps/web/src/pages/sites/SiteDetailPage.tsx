import { useParams, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { api } from '../../api/client';
import { Icon } from '../../components/icons';

interface Site {
  id: string;
  name: string;
  runtime: string;
  status: string;
  domain: string;
  gitUrl?: string;
  createdAt: string;
}

export function SiteDetailPage() {
  const params = useParams({ from: '/sites/$siteId' });
  const search = useSearch({ from: '/sites/$siteId' });
  const siteId = params.siteId as string;
  const activeTab = (search as any)?.tab || 'overview';

  const { data: site, isLoading } = useQuery<Site>({
    queryKey: ['sites', siteId],
    queryFn: () => api.get(`/sites/${siteId}`),
    enabled: !!siteId,
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!site) {
    return <div>Site not found</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'deployments', label: 'Deployments' },
    { id: 'database', label: 'Database' },
    { id: 'ssl', label: 'SSL' },
    { id: 'dns', label: 'DNS' },
    { id: 'php', label: 'PHP' },
    { id: 'webserver', label: 'Webserver' },
    { id: 'logs', label: 'Logs' },
    { id: 'cron', label: 'Cron' },
  ];

  const handleTabChange = (tabId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new Event('locationchange'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-page-title font-medium">{site.name}</h1>
          <StatusBadge status={site.status as any} />
        </div>
        <div className="flex gap-2">
          <Button variant="default" icon={<Icon name="icon-play" size={15} />}>
            Build
          </Button>
          <Button variant="primary" icon={<Icon name="icon-upload" size={15} />}>
            Deploy
          </Button>
          <Button variant="danger" icon={<Icon name="icon-stop" size={15} />}>
            Stop
          </Button>
        </div>
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="px-4 py-2.5 text-small transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab.id ? 500 : 400,
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary"
                  style={{ backgroundColor: 'var(--color-text-primary)' }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      <TabContent tab={activeTab} siteId={siteId} />
    </div>
  );
}

function TabContent({ tab, siteId }: { tab: string; siteId: string }) {
  switch (tab) {
    case 'overview':
      return <OverviewTab siteId={siteId} />;
    case 'deployments':
      return <DeploymentsTab siteId={siteId} />;
    case 'database':
      return <DatabaseTab siteId={siteId} />;
    case 'ssl':
      return <SslTab siteId={siteId} />;
    case 'dns':
      return <DnsTab siteId={siteId} />;
    case 'php':
      return <PhpTab siteId={siteId} />;
    case 'webserver':
      return <WebserverTab siteId={siteId} />;
    case 'logs':
      return <LogsTab siteId={siteId} />;
    case 'cron':
      return <CronTab siteId={siteId} />;
    default:
      return <OverviewTab siteId={siteId} />;
  }
}

function OverviewTab({ siteId }: { siteId: string }) {
  const { data: site } = useQuery<Site>({
    queryKey: ['sites', siteId],
    queryFn: () => api.get(`/sites/${siteId}`),
    enabled: !!siteId,
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card title="Runtime">
        <div className="space-y-2 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Runtime</span>
            <span>{site?.runtime || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">PHP Version</span>
            <span>{site?.runtime?.includes('php') ? '8.2' : '—'}</span>
          </div>
        </div>
      </Card>
      <Card title="Domain">
        <div className="space-y-2 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Primary Domain</span>
            <span className="font-mono">{site?.domain || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Created</span>
            <span>{site?.createdAt ? new Date(site.createdAt).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DeploymentsTab({ siteId }: { siteId: string }) {
  const { data: deployments } = useQuery({
    queryKey: ['sites', siteId, 'deployments'],
    queryFn: () => api.get(`/sites/${siteId}/deployments`).then((r: any) => r.items || []),
  });

  return (
    <Card title="Deployment History">
      {deployments && deployments.length > 0 ? (
        <div className="space-y-2">
          {deployments.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
              <div>
                <span className="text-small font-medium">{d.commit || 'Manual deploy'}</span>
                <span className="text-meta text-foreground-tertiary ml-2">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-small text-foreground-tertiary">No deployments yet</p>
      )}
    </Card>
  );
}

function DatabaseTab({ siteId }: { siteId: string }) {
  const { data: database } = useQuery({
    queryKey: ['sites', siteId, 'database'],
    queryFn: () => api.get(`/sites/${siteId}/database`),
  });

  if (!database) {
    return (
      <Card title="Database">
        <div className="text-center py-6">
          <p className="text-small text-foreground-secondary mb-4">No database attached</p>
          <Button>Create Database</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Database">
      <div className="space-y-2 text-small">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Name</span>
          <span>{(database as any).name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Engine</span>
          <span>{(database as any).engine}</span>
        </div>
      </div>
    </Card>
  );
}

function SslTab({ siteId }: { siteId: string }) {
  const { data: ssl } = useQuery({
    queryKey: ['sites', siteId, 'ssl'],
    queryFn: () => api.get(`/sites/${siteId}/ssl`),
  });

  return (
    <Card title="SSL Certificate">
      {ssl ? (
        <div className="space-y-2 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Domain</span>
            <span className="font-mono">{(ssl as any).domain}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Expires</span>
            <span>{(ssl as any).expiresAt ? new Date((ssl as any).expiresAt).toLocaleDateString() : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Auto-renew</span>
            <span>{(ssl as any).autoRenew ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-small text-foreground-secondary mb-4">No SSL certificate</p>
          <Button>Issue Certificate</Button>
        </div>
      )}
    </Card>
  );
}

function DnsTab({ siteId }: { siteId: string }) {
  const { data: records } = useQuery({
    queryKey: ['sites', siteId, 'dns'],
    queryFn: () => api.get(`/sites/${siteId}/dns`).then((r: any) => r.items || []),
  });

  return (
    <Card title="DNS Records">
      {records && records.length > 0 ? (
        <div className="space-y-2">
          {records.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
              <div className="font-mono text-small">{r.type} {r.name}</div>
              <div className="font-mono text-small text-foreground-secondary">{r.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-small text-foreground-tertiary">No DNS records</p>
      )}
    </Card>
  );
}

function PhpTab({ siteId }: { siteId: string }) {
  const { data: phpConfig } = useQuery({
    queryKey: ['sites', siteId, 'php'],
    queryFn: () => api.get(`/sites/${siteId}/php`),
  });

  return (
    <Card title="PHP Configuration">
      <div className="space-y-2 text-small">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Version</span>
          <span>{(phpConfig as any)?.version || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Memory Limit</span>
          <span>{(phpConfig as any)?.memoryLimit || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Max Execution Time</span>
          <span>{(phpConfig as any)?.maxExecutionTime || '—'}</span>
        </div>
      </div>
    </Card>
  );
}

function WebserverTab({ siteId }: { siteId: string }) {
  const { data: config } = useQuery({
    queryKey: ['sites', siteId, 'webserver'],
    queryFn: () => api.get(`/sites/${siteId}/webserver`),
  });

  return (
    <Card title="Webserver Configuration">
      <div className="space-y-2 text-small">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Force HTTPS</span>
          <span>{(config as any)?.forceHttps ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Gzip</span>
          <span>{(config as any)?.gzip ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Caching</span>
          <span>{(config as any)?.caching || '—'}</span>
        </div>
      </div>
    </Card>
  );
}

function LogsTab({ siteId }: { siteId: string }) {
  const { data: logs } = useQuery({
    queryKey: ['sites', siteId, 'logs'],
    queryFn: () => api.get(`/sites/${siteId}/logs`),
  });

  return (
    <Card title="Access & Error Logs">
      <pre className="font-mono text-small bg-background-secondary p-3 rounded-md overflow-auto max-h-[400px]">
        {(logs as any) || 'No logs available'}
      </pre>
    </Card>
  );
}

function CronTab({ siteId }: { siteId: string }) {
  const { data: cronJobs } = useQuery({
    queryKey: ['sites', siteId, 'cron'],
    queryFn: () => api.get(`/sites/${siteId}/cron`).then((r: any) => r.items || []),
  });

  return (
    <Card title="Cron Jobs">
      {cronJobs && cronJobs.length > 0 ? (
        <div className="space-y-2">
          {cronJobs.map((job: any) => (
            <div key={job.id} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
              <div>
                <span className="text-small font-medium">{job.name}</span>
                <span className="text-meta text-foreground-tertiary ml-2 font-mono">{job.schedule}</span>
              </div>
              <StatusBadge status={job.active ? 'active' : 'inactive'} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-small text-foreground-secondary mb-4">No cron jobs configured</p>
          <Button>Add Cron Job</Button>
        </div>
      )}
    </Card>
  );
}