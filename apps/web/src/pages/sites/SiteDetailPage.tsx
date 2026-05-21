import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  useSite,
  useSiteDeployments,
  useSiteBuild,
  useSiteDeploy,
  useSiteLogs,
  useSiteStatus,
  useSiteStop,
  useSiteDockerfile,
  type Site,
} from '../../api/hooks/sites';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from '../../lib/toast';
import {
  Server,
  Calendar,
  User,
  Play,
  Square,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  FileCode,
  RefreshCw,
} from 'lucide-react';

type Tab = 'runtime' | 'deployments' | 'settings';

function StatusBadge({ status }: { status: Site['status'] }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-orange-500/10 text-orange-500',
    building: 'bg-blue-500/10 text-blue-500',
    deploying: 'bg-blue-500/10 text-blue-500',
    error: 'bg-red-500/10 text-red-500',
    stopped: 'bg-gray-500/10 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function RuntimeBadge({ site }: { site: Site }) {
  const label = site.runtime?.toUpperCase() || 'Unknown';
  return (
    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500">
      {label}
    </span>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

function DeploymentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'building':
    case 'deploying':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function RuntimeTab({ site }: { site: Site }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Runtime</span>
              <RuntimeBadge site={site} />
            </div>
            {site.runtimeVersion && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-medium">{site.runtimeVersion}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-medium">{site.status}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Site Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm font-medium">{new Date(site.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Auto Restart</span>
              <span className="text-sm font-medium">{site.autoRestart ? 'Enabled' : 'Disabled'}</span>
            </div>
            {site.port && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Port</span>
                <span className="text-sm font-medium">{site.port}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {site.gitRepo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Git Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Repository</span>
              <span className="text-sm font-mono truncate max-w-xs">{site.gitRepo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Branch</span>
              <span className="text-sm font-medium">{site.gitBranch || 'main'}</span>
            </div>
            {site.buildCommand && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Build Command</span>
                <span className="text-sm font-mono">{site.buildCommand}</span>
              </div>
            )}
            {site.startCommand && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Start Command</span>
                <span className="text-sm font-mono">{site.startCommand}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeploymentsTab({ site }: { site: Site }) {
  const { data: deployments, isLoading } = useSiteDeployments(site.id);
  const buildMutation = useSiteBuild();
  const deployMutation = useSiteDeploy();
  const stopMutation = useSiteStop();
  const logsQuery = useSiteLogs(site.id);
  const statusQuery = useSiteStatus(site.id);

  const handleBuild = () => {
    buildMutation.mutate(site.id, {
      onSuccess: () => toast.success('Build started'),
      onError: () => toast.error('Failed to start build'),
    });
  };

  const handleDeploy = () => {
    deployMutation.mutate(site.id, {
      onSuccess: () => toast.success('Deploy started'),
      onError: () => toast.error('Failed to start deploy'),
    });
  };

  const handleStop = () => {
    stopMutation.mutate(site.id, {
      onSuccess: () => toast.success('Site stopped'),
      onError: () => toast.error('Failed to stop site'),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Deployments</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={handleBuild}
              disabled={buildMutation.isPending}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {buildMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
              Build
            </button>
            <button
              onClick={handleDeploy}
              disabled={deployMutation.isPending}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {deployMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Deploy
            </button>
            {site.status === 'active' && (
              <button
                onClick={handleStop}
                disabled={stopMutation.isPending}
                className="flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deployments && deployments.length > 0 ? (
            <div className="space-y-2">
              {deployments.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <DeploymentStatusIcon status={d.status} />
                    <div>
                      <p className="text-sm font-medium">Deployment #{d.sequence}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.commitSha ? d.commitSha.slice(0, 7) : d.sourceType}
                        {d.commitMessage && ` — ${d.commitMessage.slice(0, 50)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{d.status}</p>
                    {d.durationMs && (
                      <p className="text-xs text-muted-foreground">{Math.round(d.durationMs / 1000)}s</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No deployments yet. Run a build to get started.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Container Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
              {logsQuery.data?.logs || 'No logs available'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Container Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusQuery.data ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Running</span>
                  <span className={`text-sm font-medium ${statusQuery.data.running ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {statusQuery.data.running ? 'Yes' : 'No'}
                  </span>
                </div>
                {statusQuery.data.containerId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Container ID</span>
                    <span className="text-xs font-mono">{statusQuery.data.containerId.slice(0, 12)}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Status unavailable</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsTab({ site }: { site: Site }) {
  const dockerfileQuery = useSiteDockerfile(site.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Generated Dockerfile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
            {dockerfileQuery.data?.dockerfile || 'Loading...'}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Replicas</span>
            <span className="text-sm font-medium">{site.replicas ?? 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Health Check</span>
            <span className="text-sm font-medium">{site.healthCheckPath || '/health'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Output Directory</span>
            <span className="text-sm font-medium">{site.outputDirectory || 'dist'}</span>
          </div>
          {site.memoryLimit && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Memory Limit</span>
              <span className="text-sm font-medium">{site.memoryLimit} MB</span>
            </div>
          )}
          {site.cpuLimit && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">CPU Limit</span>
              <span className="text-sm font-medium">{site.cpuLimit}%</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SiteDetailPage() {
  const siteId = useParams({ from: '/protected/sites/$id' });
  const { data: site, isLoading, error } = useSite(siteId.id);
  const [activeTab, setActiveTab] = useState<Tab>('runtime');

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">Failed to load site</p>
          <p className="text-sm text-muted-foreground">{error?.message || 'Site not found'}</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'runtime', label: 'Runtime' },
    { key: 'deployments', label: 'Deployments' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="mx-6 my-6 space-y-6">
      <PageHeader
        title={site.name}
        actions={<StatusBadge status={site.status} />}
      />

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'runtime' && <RuntimeTab site={site} />}
      {activeTab === 'deployments' && <DeploymentsTab site={site} />}
      {activeTab === 'settings' && <SettingsTab site={site} />}
    </div>
  );
}