import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useServiceStatuses, useRestartService } from '../../api/hooks/stats';
import { toast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

interface ServiceStatusItem {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
}

export function ServicesPage() {
  const { data: services, isLoading, isError, error, refetch } = useServiceStatuses();
  const restartService = useRestartService();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-medium">Services</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border-tertiary animate-pulse bg-background-primary" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-medium">Services</h1>
        </div>
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  const serviceList = services || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title font-medium">Services</h1>
          <p className="text-small text-foreground-secondary mt-0.5">
            Manage system services
          </p>
        </div>
      </div>

      {serviceList.length === 0 ? (
        <EmptyState
          icon="icon-server"
          title="No services found"
          description="No services are configured on this server"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceList.map((service) => (
            <ServiceCard
              key={service.name}
              service={service}
              isRestarting={pendingAction === service.name}
              onRestart={() => {
                setPendingAction(service.name);
                restartService.mutate(service.name, {
                  onSuccess: () => {
                    toast.success(`${service.displayName} restarted successfully`);
                  },
                  onError: (err) => {
                    toast.error(`Failed to restart ${service.displayName}: ${err.message}`);
                  },
                  onSettled: () => setPendingAction(null),
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  isRestarting,
  onRestart,
}: {
  service: ServiceStatusItem;
  isRestarting: boolean;
  onRestart: () => void;
}) {
  const canRestart = service.status === 'running' || service.status === 'stopped';

  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-medium">{service.displayName}</h3>
          <p className="text-small text-foreground-secondary mt-0.5">{service.name}</p>
        </div>
        <StatusBadge status={service.status} />
      </div>
      <div className="flex gap-2">
        <Button
          variant="default"
          size="small"
          loading={isRestarting}
          disabled={!canRestart || isRestarting}
          onClick={onRestart}
        >
          Restart
        </Button>
      </div>
    </Card>
  );
}