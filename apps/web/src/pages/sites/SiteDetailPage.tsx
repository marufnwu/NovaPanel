import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useSite,
  useSiteDeployments,
  useSiteBuild,
  useSiteDeploy,
  useSiteStop,
  useSiteDomains,
  type Site,
} from '../../api/hooks/sites';
import { useCreateDatabase, useDeleteDatabase } from '../../api/hooks/databases';
import { useIssueLetsEncrypt } from '../../api/hooks/ssl';
import { useCreateCronJob, useRunCronJob, useToggleCronJob, useDeleteCronJob } from '../../api/hooks/cron';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function SiteDetailPage() {
  const params = useParams({ from: '/sites/$siteId' });
  const search = useSearch({ from: '/sites/$siteId' });
  const siteId = params.siteId as string;
  const activeTab = (search as any)?.tab || 'overview';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: site, isLoading, isError, error, refetch } = useSite(siteId);

  const siteBuild = useSiteBuild();
  const siteDeploy = useSiteDeploy();
  const siteStop = useSiteStop();

  const [showCreateDb, setShowCreateDb] = useState(false);
  const [showIssueCert, setShowIssueCert] = useState(false);
  const [showAddCron, setShowAddCron] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  if (!site) return <ErrorState message="Site not found" />;

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
          <Button
            variant="default"
            icon={<Icon name="icon-play" size={15} />}
            loading={siteBuild.isPending}
            onClick={() => {
              siteBuild.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`Build started for ${site.name}`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                },
                onError: (err) => toast.error(`Build failed: ${err.message}`),
              });
            }}
          >
            Build
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="icon-upload" size={15} />}
            loading={siteDeploy.isPending}
            onClick={() => {
              siteDeploy.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`Deploy started for ${site.name}`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'deployments'] });
                },
                onError: (err) => toast.error(`Deploy failed: ${err.message}`),
              });
            }}
          >
            Deploy
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="icon-stop" size={15} />}
            loading={siteStop.isPending}
            onClick={() => {
              siteStop.mutate(siteId, {
                onSuccess: () => {
                  toast.success(`${site.name} stopped`);
                  queryClient.invalidateQueries({ queryKey: ['sites', siteId] });
                },
                onError: (err) => toast.error(`Failed to stop: ${err.message}`),
              });
            }}
          >
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

      <TabContent tab={activeTab} siteId={siteId} siteName={site.name} queryClient={queryClient} onAddCron={() => setShowAddCron(true)} onIssueCert={() => setShowIssueCert(true)} onCreateDb={() => setShowCreateDb(true)} navigate={navigate} />
    </div>
  );
}

function TabContent({
  tab,
  siteId,
  siteName,
  queryClient,
  onAddCron,
  onIssueCert,
  onCreateDb,
  navigate,
}: {
  tab: string;
  siteId: string;
  siteName: string;
  queryClient: any;
  onAddCron: () => void;
  onIssueCert: () => void;
  onCreateDb: () => void;
  navigate: any;
}) {
  switch (tab) {
    case 'overview':
      return <OverviewTab siteId={siteId} />;
    case 'deployments':
      return <DeploymentsTab siteId={siteId} />;
    case 'database':
      return <DatabaseTab siteId={siteId} siteName={siteName} onCreateDb={onCreateDb} queryClient={queryClient} navigate={navigate} />;
    case 'ssl':
      return <SslTab siteId={siteId} siteName={siteName} onIssueCert={onIssueCert} queryClient={queryClient} />;
    case 'dns':
      return <DnsTab siteId={siteId} />;
    case 'php':
      return <PhpTab siteId={siteId} />;
    case 'webserver':
      return <WebserverTab siteId={siteId} />;
    case 'logs':
      return <LogsTab siteId={siteId} />;
    case 'cron':
      return <CronTab siteId={siteId} siteName={siteName} onAddCron={onAddCron} queryClient={queryClient} />;
    default:
      return <OverviewTab siteId={siteId} />;
  }
}

function OverviewTab({ siteId }: { siteId: string }) {
  const { data: site } = useSite(siteId);

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
            <span>{site?.runtime?.includes('php') ? (site.runtime.match(/php[\s-]*([\d.]+)/i)?.[1] || '8.2') : '—'}</span>
          </div>
        </div>
      </Card>
      <Card title="Domain">
        <div className="space-y-2 text-small">
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
  const { data: deployments } = useSiteDeployments(siteId);

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

function DatabaseTab({ siteId, siteName, onCreateDb, queryClient, navigate }: { siteId: string; siteName: string; onCreateDb: () => void; queryClient: any; navigate: any }) {
  const [dbName, setDbName] = useState('');
  const [dbEngine, setDbEngine] = useState<'mariadb' | 'postgresql'>('mariadb');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteDbId, setDeleteDbId] = useState<string | null>(null);
  const createDb = useCreateDatabase();
  const deleteDb = useDeleteDatabase();

  const handleCreateDb = async () => {
    if (!dbName) return;
    try {
      await createDb.mutateAsync({ projectId: siteId, name: dbName, type: dbEngine });
      toast.success(`Database "${dbName}" created`);
      setShowCreate(false);
      setDbName('');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'database'] });
    } catch (err: any) {
      toast.error(`Failed to create database: ${err.message}`);
    }
  };

  const { data: database } = useQuery({
    queryKey: ['sites', siteId, 'database'],
    queryFn: () => api.get(`/sites/${siteId}/database`),
  });

  if (!database && !showCreate) {
    return (
      <Card title="Database">
        <div className="text-center py-6">
          <p className="text-small text-foreground-secondary mb-4">No database attached</p>
          <Button onClick={() => setShowCreate(true)}>Create Database</Button>
        </div>
      </Card>
    );
  }

  if (showCreate) {
    return (
      <Card title="Create Database">
        <div className="space-y-4">
          <Input label="Database Name" value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="my_database" />
          <div>
            <label className="text-meta font-medium mb-1 block">Engine</label>
            <div className="flex gap-2">
              <Button variant={dbEngine === 'mariadb' ? 'primary' : 'default'} size="small" onClick={() => setDbEngine('mariadb')}>MariaDB</Button>
              <Button variant={dbEngine === 'postgresql' ? 'primary' : 'default'} size="small" onClick={() => setDbEngine('postgresql')}>PostgreSQL</Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateDb} loading={createDb.isPending}>Create</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="Database" action={<Button size="small" onClick={() => setShowCreate(true)} icon={<Icon name="icon-plus" size={15} />}>Add</Button>}>
        <div className="space-y-3 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Name</span>
            <span>{(database as any).name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Engine</span>
            <span>{(database as any).engine}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="default" size="small" onClick={() => navigate({ to: '/databases/$databaseId', params: { databaseId: (database as any).id } })}>View Database</Button>
            <Button variant="ghost" size="small" onClick={() => setDeleteDbId((database as any).id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
          </div>
        </div>
      </Card>
      <ConfirmDialog
        isOpen={!!deleteDbId}
        onClose={() => setDeleteDbId(null)}
        onConfirm={() => {
          if (!deleteDbId) return;
          deleteDb.mutate(deleteDbId, {
            onSuccess: () => {
              toast.success('Database deleted');
              setDeleteDbId(null);
              queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'database'] });
            },
            onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
          });
        }}
        title="Delete Database"
        description="This database and all its data will be permanently deleted."
        confirmText="Delete"
        impact="high"
        loading={deleteDb.isPending}
      />
    </>
  );
}

function SslTab({ siteId, siteName, onIssueCert, queryClient }: { siteId: string; siteName: string; onIssueCert: () => void; queryClient: any }) {
  const [showIssue, setShowIssue] = useState(false);
  const [certEmail, setCertEmail] = useState('');
  const issueCert = useIssueLetsEncrypt();
  const { data: siteDomains } = useSiteDomains(siteId);
  const primaryDomain = siteDomains?.[0];

  const handleIssueCert = async () => {
    if (!primaryDomain?.id) return;
    try {
      await issueCert.mutateAsync({
        domainId: primaryDomain.id,
        email: certEmail,
        challengeType: 'http-01',
      });
      toast.success('SSL certificate issuance started');
      setShowIssue(false);
      setCertEmail('');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'ssl'] });
    } catch (err: any) {
      toast.error(`Failed to issue certificate: ${err.message}`);
    }
  };

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
          <Button onClick={() => setShowIssue(true)}>Issue Certificate</Button>
        </div>
      )}
      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue SSL Certificate"
        footer={<><Button variant="ghost" onClick={() => setShowIssue(false)}>Cancel</Button><Button variant="primary" onClick={handleIssueCert} loading={issueCert.isPending}>Issue</Button></>}>
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">Issue a Let's Encrypt certificate for <span className="font-mono">{siteName}</span></p>
          <Input label="Email" type="email" value={certEmail} onChange={(e) => setCertEmail(e.target.value)} placeholder="admin@example.com" required />
        </div>
      </Modal>
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

function CronTab({ siteId, siteName, onAddCron, queryClient }: { siteId: string; siteName: string; onAddCron: () => void; queryClient: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [cronSchedule, setCronSchedule] = useState('');
  const [cronCommand, setCronCommand] = useState('');
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const createCron = useCreateCronJob();
  const runCron = useRunCronJob();
  const toggleCron = useToggleCronJob();
  const deleteCron = useDeleteCronJob();

  const handleCreateCron = async () => {
    if (!cronSchedule || !cronCommand) return;
    try {
      await createCron.mutateAsync({ schedule: cronSchedule, command: cronCommand });
      toast.success('Cron job created');
      setShowAdd(false);
      setCronSchedule('');
      setCronCommand('');
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cron'] });
    } catch (err: any) {
      toast.error(`Failed to create cron job: ${err.message}`);
    }
  };

  const { data: cronJobs } = useQuery({
    queryKey: ['sites', siteId, 'cron'],
    queryFn: () => api.get(`/sites/${siteId}/cron`).then((r: any) => r.items || []),
  });

  if (showAdd) {
    return (
      <Card title="Add Cron Job">
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">Adding cron job for <span className="font-mono">{siteName}</span></p>
          <Input label="Schedule (cron expression)" value={cronSchedule} onChange={(e) => setCronSchedule(e.target.value)} placeholder="*/5 * * * *" />
          <Input label="Command" value={cronCommand} onChange={(e) => setCronCommand(e.target.value)} placeholder="/usr/bin/php /var/www/artisan schedule:run" />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateCron} loading={createCron.isPending}>Create</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="Cron Jobs" action={<Button size="small" onClick={() => setShowAdd(true)} icon={<Icon name="icon-plus" size={15} />}>Add Job</Button>}>
        {cronJobs && cronJobs.length > 0 ? (
          <div className="space-y-2">
            {cronJobs.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                <div>
                  <span className="text-small font-medium">{job.name}</span>
                  <span className="text-meta text-foreground-tertiary ml-2 font-mono">{job.schedule}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="small" onClick={() => runCron.mutate(job.id, { onSuccess: () => toast.success('Cron job started'), onError: (err: any) => toast.error(`Failed to run: ${err.message}`) })} loading={runCron.isPending} icon={<Icon name="icon-play" size={15} />}>Run</Button>
                  <Button variant="ghost" size="small" onClick={() => toggleCron.mutate(job.id, { onSuccess: () => { toast.success('Cron job toggled'); queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cron'] }); }, onError: (err: any) => toast.error(`Failed to toggle: ${err.message}`) })} loading={toggleCron.isPending} icon={<Icon name="icon-refresh" size={15} />}>Toggle</Button>
                  <Button variant="ghost" size="small" onClick={() => setDeleteJobId(job.id)} icon={<Icon name="icon-trash" size={15} />} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-small text-foreground-secondary mb-4">No cron jobs configured</p>
            <Button onClick={() => setShowAdd(true)}>Add Cron Job</Button>
          </div>
        )}
      </Card>
      <ConfirmDialog
        isOpen={!!deleteJobId}
        onClose={() => setDeleteJobId(null)}
        onConfirm={() => {
          if (!deleteJobId) return;
          deleteCron.mutate(deleteJobId, {
            onSuccess: () => {
              toast.success('Cron job deleted');
              setDeleteJobId(null);
              queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cron'] });
            },
            onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
          });
        }}
        title="Delete Cron Job"
        description="This cron job will be permanently deleted."
        confirmText="Delete"
        impact="medium"
        loading={deleteCron.isPending}
      />
    </>
  );
}