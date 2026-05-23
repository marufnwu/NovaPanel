import { useState } from 'react';
import { useServiceStatuses, useRestartService, type ServiceStatusItem } from '../../api/hooks/stats';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../lib/toast';
import { RefreshCw, RotateCcw, Server, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ServiceRow({ service, onRestart }: { service: ServiceStatusItem; onRestart: (name: string, displayName: string) => void }) {
  const isRunning = service.status === 'running';
  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium text-sm">{service.displayName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm font-mono">{service.name}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          isRunning ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        }`}>
          {isRunning ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {service.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onRestart(service.name, service.displayName)}
          disabled={!isRunning}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ml-auto"
          title={isRunning ? 'Restart service' : 'Service is not running'}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restart
        </button>
      </td>
    </tr>
  );
}

export function ServicesPage() {
  const { data: services, isLoading, isError, refetch } = useServiceStatuses();
  const restartService = useRestartService();
  const [restartTarget, setRestartTarget] = useState<{ name: string; displayName: string } | null>(null);

  const handleRestart = (name: string, displayName: string) => {
    setRestartTarget({ name, displayName });
  };

  const confirmRestart = () => {
    if (!restartTarget) return;
    restartService.mutate(restartTarget.name, {
      onSuccess: () => {
        toast.success(`${restartTarget.displayName} restarted successfully`);
        setRestartTarget(null);
      },
      onError: (e: Error) => {
        toast.error(e.message || `Failed to restart ${restartTarget.displayName}`);
        setRestartTarget(null);
      },
    });
  };

  if (isLoading) return <LoadingPage title="Loading services..." />;

  return (
    <div>
      <PageHeader
        title="Services"
        description="Monitor and manage system services"
        icon={Server}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={restartService.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${restartService.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load services. The monitoring service may be unavailable.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : !services?.length ? (
          <EmptyState
            icon={Server}
            title="No services found"
            description="No services are currently configured for monitoring."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc) => (
                  <ServiceRow key={svc.name} service={svc} onRestart={handleRestart} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={restartTarget !== null}
        title={`Restart ${restartTarget?.displayName || 'Service'}?`}
        message={`This will restart the ${restartTarget?.displayName} service. Active connections may be interrupted. This action cannot be undone.`}
        variant="warning"
        confirmText="Restart"
        onConfirm={confirmRestart}
        onCancel={() => setRestartTarget(null)}
      />
    </div>
  );
}