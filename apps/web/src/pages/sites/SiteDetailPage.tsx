import { useParams } from '@tanstack/react-router';
import { 
  useSite, 
  useStartSiteProcess, 
  useStopSiteProcess, 
  useRestartSiteProcess,
  type SiteWithDetails,
} from '../../api/hooks/sites';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  ArrowLeft, 
  Globe, 
  Server, 
  Play, 
  Square, 
  RotateCw,
  HardDrive,
  Network,
  Calendar,
  User,
  Folder,
} from 'lucide-react';
import { toast } from '../../lib/toast';

function StatusBadge({ status }: { status: SiteWithDetails['status'] }) {
  const styles = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-orange-500/10 text-orange-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function RuntimeBadge({ site }: { site: SiteWithDetails }) {
  const config = site.runtime?.runtimeConfig;
  if (!config) return null;

  const label = config.runtime === 'php' 
    ? `PHP ${config.phpVersion || config.version || '?'}`
    : config.runtime === 'node'
    ? `Node ${config.nodeVersion || config.version || '?'}`
    : config.runtime === 'python'
    ? `Python ${config.pythonVersion || config.version || '?'}`
    : config.runtime?.toUpperCase() || 'Unknown';
  
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

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

interface ProcessButtonProps {
  onClick: () => void;
  disabled: boolean;
  variant: 'start' | 'stop' | 'restart';
  children: React.ReactNode;
}

function ProcessButton({ onClick, disabled, variant, children }: ProcessButtonProps) {
  const baseStyles = 'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50';
  const variants = {
    start: 'border-input bg-background',
    stop: 'border-destructive/30 text-destructive hover:bg-destructive/10',
    restart: 'border-input bg-background',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function SiteDetailPage() {
  const siteId = useParams({ from: '/protected/sites/$id' });
  const { data: site, isLoading, error } = useSite(siteId.id);
  const startProcess = useStartSiteProcess();
  const stopProcess = useStopSiteProcess();
  const restartProcess = useRestartSiteProcess();

  const handleStart = () => {
    startProcess.mutate(siteId.id, {
      onSuccess: () => toast.success('Process started'),
      onError: () => toast.error('Failed to start process'),
    });
  };

  const handleStop = () => {
    stopProcess.mutate(siteId.id, {
      onSuccess: () => toast.success('Process stopped'),
      onError: () => toast.error('Failed to stop process'),
    });
  };

  const handleRestart = () => {
    restartProcess.mutate(siteId.id, {
      onSuccess: () => toast.success('Process restarted'),
      onError: () => toast.error('Failed to restart process'),
    });
  };

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

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isProcessRunning = site.process?.pid !== undefined && site.process?.pid > 0;

  return (
    <div className="mx-6 my-6 space-y-6">
      <PageHeader
        title={site.name}
        actions={<StatusBadge status={site.status} />}
      />

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
              <span className="text-sm text-muted-foreground">Type</span>
              <RuntimeBadge site={site} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Web Server</span>
              <span className="text-sm font-medium uppercase">
                {site.runtime?.webServer || '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Process
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Manager</span>
              <span className="text-sm font-medium uppercase">
                {site.process?.processManager || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-sm font-medium ${isProcessRunning ? 'text-green-500' : 'text-muted-foreground'}`}>
                {isProcessRunning ? `Running (PID ${site.process?.pid})` : 'Stopped'}
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <ProcessButton
                onClick={handleStart}
                disabled={isProcessRunning || startProcess.isPending}
                variant="start"
              >
                <Play className="h-3 w-3" />
                Start
              </ProcessButton>
              <ProcessButton
                onClick={handleStop}
                disabled={!isProcessRunning || stopProcess.isPending}
                variant="stop"
              >
                <Square className="h-3 w-3" />
                Stop
              </ProcessButton>
              <ProcessButton
                onClick={handleRestart}
                disabled={!isProcessRunning || restartProcess.isPending}
                variant="restart"
              >
                <RotateCw className="h-3 w-3" />
                Restart
              </ProcessButton>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Domains
          </CardTitle>
        </CardHeader>
        <CardContent>
          {site.domains?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No domains attached</p>
          ) : (
            <div className="space-y-2">
              {(site.domains ?? []).map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{domain.name}</span>
                    {domain.role === 'primary' && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Primary
                      </span>
                    )}
                    {domain.sslEnabled && (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
                        SSL
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Site Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="System User"
              value={site.systemUser}
            />
            <InfoRow
              icon={<Folder className="h-4 w-4" />}
              label="Home Directory"
              value={site.homeDir}
            />
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Created"
              value={formatDate(site.createdAt)}
            />
            <InfoRow
              icon={<HardDrive className="h-4 w-4" />}
              label="Disk Usage"
              value={`${site.diskUsedMb} MB`}
            />
            <InfoRow
              icon={<Network className="h-4 w-4" />}
              label="Bandwidth Used"
              value={`${site.bandwidthUsedMb} MB`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}