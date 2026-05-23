import { useState, useEffect } from 'react';
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
  useSiteCronJobs,
  useSiteDomains,
  type Site,
} from '../../api/hooks/sites';
import { usePhpVersion } from '../../api/hooks/settings';
import { useBreadcrumbOverride } from '../../lib/breadcrumb-store';
import { useVhostConfig } from '../../api/hooks/webserver';
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
  Database,
  ShieldCheck,
  Network,
  Code2,
  FileText,
  HardDrive,
  Trash2,
  Plus,
} from 'lucide-react';

type Tab = 'runtime' | 'deployments' | 'database' | 'ssl' | 'dns' | 'php' | 'webserver' | 'logs' | 'cron' | 'settings';

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

function PlaceholderTab({ title, icon: Icon, description }: { title: string; icon: typeof Database; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-1 font-medium text-lg">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground max-w-sm">{description}</p>
      <div className="rounded-md bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
        This feature uses existing API endpoints. Content loads here via scoped tabs.
      </div>
    </div>
  );
}

function DatabaseTab({ site }: { site: Site }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Database</h3>
          <p className="text-sm text-muted-foreground">Database configuration for this site</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
        <Database className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Database management is per-project</p>
        <p className="text-xs text-muted-foreground mt-1">Databases are shared across all sites in a project</p>
      </div>
    </div>
  );
}

function DNSTab({ site }: { site: Site }) {
  const { data: domains, isLoading } = useSiteDomains(site.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const siteDomains = (domains || []).filter((d: any) => d.siteId === site.id);

  if (siteDomains.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">DNS Records</h3>
            <p className="text-sm text-muted-foreground">Domains and DNS configuration for this site</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <Network className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No domains attached to this site</p>
          <p className="text-xs text-muted-foreground mt-1">Attach a domain from the Domains page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">DNS Records</h3>
          <p className="text-sm text-muted-foreground">{siteDomains.length} domain{siteDomains.length !== 1 ? 's' : ''} linked to this site</p>
        </div>
      </div>
      <div className="space-y-2">
        {siteDomains.map((domain: any) => (
          <div key={domain.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <Network className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{domain.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{domain.type} {domain.status === 'active' ? '' : `· ${domain.status}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {domain.proxyEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                  Proxy
                </span>
              )}
              {domain.forceHttps && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  HTTPS
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SSLTab({ site }: { site: Site }) {
  const { data: domains, isLoading } = useSiteDomains(site.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const siteDomains = (domains || []).filter((d: any) => d.siteId === site.id);

  if (siteDomains.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">SSL Certificates</h3>
            <p className="text-sm text-muted-foreground">SSL configuration for domains on this site</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No domains attached to this site</p>
          <p className="text-xs text-muted-foreground mt-1">SSL certificates are managed per-domain</p>
        </div>
      </div>
    );
  }

  const activeCerts = siteDomains.filter((d: any) => d.sslStatus === 'active').length;
  const pendingCerts = siteDomains.filter((d: any) => d.sslStatus === 'pending').length;
  const expiredCerts = siteDomains.filter((d: any) => d.sslStatus === 'expired').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SSL Certificates</h3>
          <p className="text-sm text-muted-foreground">SSL status for domains on this site</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md border border-green-500/30 bg-green-500/5 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeCerts}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCerts}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{expiredCerts}</p>
          <p className="text-xs text-muted-foreground">Expired</p>
        </div>
      </div>
      <div className="space-y-2">
        {siteDomains.map((domain: any) => (
          <div key={domain.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`h-4 w-4 ${domain.sslStatus === 'active' ? 'text-green-500' : domain.sslStatus === 'expired' ? 'text-red-500' : 'text-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium">{domain.name}</p>
                <p className="text-xs text-muted-foreground">SSL {domain.sslStatus}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {domain.forceHttps && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  Enforced
                </span>
              )}
              {domain.hstsEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                  HSTS
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhpTab({ site }: { site: Site }) {
  useBreadcrumbOverride(`/sites/${site.id}`, site.name);
  const { data: domains, isLoading } = useSiteDomains(site.id);
  const { data: phpVersionData } = usePhpVersion();

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const siteDomains = (domains || []).filter((d: any) => d.siteId === site.id);
  const globalPhpVersion = phpVersionData?.version || 'default';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PHP Configuration</h3>
          <p className="text-sm text-muted-foreground">PHP version and settings for this site</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              PHP Version
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Global Default</span>
              <span className="text-sm font-medium">{globalPhpVersion === 'default' ? 'System Default' : `PHP ${globalPhpVersion}`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Site Runtime</span>
              <span className="text-sm font-medium">{site.runtimeVersion || `PHP (via ${site.runtime})`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Container Runtime</span>
              <span className="text-sm font-medium capitalize">{site.runtime}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              PHP Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Per-Domain Config</span>
              <span className="text-xs text-muted-foreground">Available via domain settings</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {siteDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Domains Using This Site</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {siteDomains.map((domain: any) => (
                <div key={domain.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm font-medium">{domain.name}</span>
                  <span className="text-xs text-muted-foreground">PHP {globalPhpVersion === 'default' ? 'global' : globalPhpVersion}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WebserverTab({ site }: { site: Site }) {
  const { data: domains, isLoading } = useSiteDomains(site.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const siteDomains = (domains || []).filter((d: any) => d.siteId === site.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Web Server Configuration</h3>
          <p className="text-sm text-muted-foreground">Nginx/Apache settings for domains on this site</p>
        </div>
      </div>

      {siteDomains.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <HardDrive className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No domains attached to this site</p>
          <p className="text-xs text-muted-foreground mt-1">Attach a domain to configure web server settings</p>
        </div>
      ) : (
        <div className="space-y-4">
          {siteDomains.slice(0, 3).map((domain: any) => (
            <Card key={domain.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  {domain.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Force HTTPS</span>
                  <span className={domain.forceHttps ? 'text-green-600' : 'text-muted-foreground'}>{domain.forceHttps ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">HSTS</span>
                  <span className={domain.hstsEnabled ? 'text-green-600' : 'text-muted-foreground'}>{domain.hstsEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Proxy</span>
                  <span className={domain.proxyEnabled ? 'text-blue-600' : 'text-muted-foreground'}>{domain.proxyEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Custom Nginx</span>
                  <span className="text-muted-foreground">{domain.customNginxConfig ? 'Yes' : 'No'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {siteDomains.length > 3 && (
            <p className="text-sm text-muted-foreground text-center">And {siteDomains.length - 3} more domain{siteDomains.length - 3 !== 1 ? 's' : ''}...</p>
          )}
        </div>
      )}
    </div>
  );
}

function LogsTab({ site }: { site: Site }) {
  const { data: domains, isLoading } = useSiteDomains(site.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const siteDomains = (domains || []).filter((d: any) => d.siteId === site.id);

  if (siteDomains.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Application Logs</h3>
            <p className="text-sm text-muted-foreground">Access, error, and application logs</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <FileText className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No domains attached to this site</p>
          <p className="text-xs text-muted-foreground mt-1">Attach a domain to view logs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Application Logs</h3>
          <p className="text-sm text-muted-foreground">Access, error, and application logs</p>
        </div>
      </div>
      <div className="space-y-2">
        {siteDomains.map((domain: any) => (
          <div key={domain.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{domain.name}</p>
                <p className="text-xs text-muted-foreground">Web server logs</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Access · Error logs per domain
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CronTab({ site }: { site: Site }) {
  const { data: jobs, isLoading } = useSiteCronJobs(site.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const siteJobs = (jobs || []).filter((j: any) => j.siteId === site.id);

  if (siteJobs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Scheduled Jobs</h3>
            <p className="text-sm text-muted-foreground">Cron jobs configured for this site</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <Clock className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No cron jobs configured for this site</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scheduled Jobs</h3>
          <p className="text-sm text-muted-foreground">{siteJobs.length} cron job{siteJobs.length !== 1 ? 's' : ''} for this site</p>
        </div>
      </div>
      <div className="space-y-2">
        {siteJobs.map((job: any) => (
          <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${job.isActive !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <p className="text-sm font-medium">{job.name || 'Unnamed Job'}</p>
                <p className="text-xs text-muted-foreground font-mono">{job.schedule} — {job.command}</p>
              </div>
            </div>
            <div className="text-right">
              {job.lastRun && (
                <p className="text-xs text-muted-foreground">Last: {new Date(job.lastRun).toLocaleString()}</p>
              )}
              {job.lastStatus && (
                <p className={`text-xs font-medium ${job.lastStatus === 'success' ? 'text-green-600' : job.lastStatus === 'failed' ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {job.lastStatus}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
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

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'runtime', label: 'Overview', icon: Server },
    { key: 'deployments', label: 'Deployments', icon: GitBranch },
    { key: 'database', label: 'Database', icon: Database },
    { key: 'ssl', label: 'SSL', icon: ShieldCheck },
    { key: 'dns', label: 'DNS', icon: Network },
    { key: 'php', label: 'PHP', icon: Code2 },
    { key: 'webserver', label: 'Webserver', icon: HardDrive },
    { key: 'logs', label: 'Logs', icon: FileText },
    { key: 'cron', label: 'Cron', icon: Clock },
    { key: 'settings', label: 'Settings', icon: FileCode },
  ];

  return (
    <div className="mx-6 my-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {site.runtime?.toUpperCase() || 'Unknown'} • {site.gitBranch || 'main'} branch
            </p>
          </div>
          <StatusBadge status={site.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {/* TODO: Build */}}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <FileCode className="h-4 w-4" />
            Build
          </button>
          <button
            onClick={() => {/* TODO: Deploy */}}
            className="flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-sm hover:bg-primary/20 transition-colors"
          >
            <Play className="h-4 w-4" />
            Deploy
          </button>
          {site.status === 'active' && (
            <button
              onClick={() => {/* TODO: Stop */}}
              className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-t-md ${
              activeTab === tab.key
                ? 'bg-background text-foreground border border-border border-b-0 -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {activeTab === 'runtime' && <RuntimeTab site={site} />}
        {activeTab === 'deployments' && <DeploymentsTab site={site} />}
        {activeTab === 'database' && <DatabaseTab site={site} />}
        {activeTab === 'ssl' && <SSLTab site={site} />}
        {activeTab === 'dns' && <DNSTab site={site} />}
        {activeTab === 'php' && <PhpTab site={site} />}
        {activeTab === 'webserver' && <WebserverTab site={site} />}
        {activeTab === 'logs' && <LogsTab site={site} />}
        {activeTab === 'cron' && <CronTab site={site} />}
        {activeTab === 'settings' && <SettingsTab site={site} />}
      </div>
    </div>
  );
}