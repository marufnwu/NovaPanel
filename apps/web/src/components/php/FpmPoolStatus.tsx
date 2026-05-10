import { Activity } from 'lucide-react';
import { useFpmStatus } from '../../api/hooks/php';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface FpmPoolStatusProps {
  domainId: string;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function FpmPoolStatus({ domainId }: FpmPoolStatusProps) {
  const { data: status, isLoading } = useFpmStatus(domainId);

  if (isLoading) return <LoadingSpinner />;
  if (!status) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" /> PHP-FPM Pool Status
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">Active Processes</p>
          <p className="text-xl font-bold text-blue-500">{status.activeProcesses}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">Idle Processes</p>
          <p className="text-xl font-bold text-green-500">{status.idleProcesses}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">Total Processes</p>
          <p className="text-xl font-bold">{status.totalProcesses}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">Max Active Reached</p>
          <p className="text-xl font-bold text-orange-500">{status.maxActiveProcesses}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="flex justify-between rounded-md border border-border px-3 py-2">
          <span className="text-muted-foreground">Accepted Connections</span>
          <span className="font-medium">{status.acceptedConn.toLocaleString()}</span>
        </div>
        <div className="flex justify-between rounded-md border border-border px-3 py-2">
          <span className="text-muted-foreground">Listen Queue</span>
          <span className="font-medium">{status.listenQueue}</span>
        </div>
        <div className="flex justify-between rounded-md border border-border px-3 py-2">
          <span className="text-muted-foreground">Max Children Reached</span>
          <span className={`font-medium ${status.maxChildrenReached > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {status.maxChildrenReached}
          </span>
        </div>
        <div className="flex justify-between rounded-md border border-border px-3 py-2">
          <span className="text-muted-foreground">Slow Requests</span>
          <span className={`font-medium ${status.slowRequests > 0 ? 'text-orange-500' : 'text-green-500'}`}>
            {status.slowRequests}
          </span>
        </div>
        <div className="flex justify-between rounded-md border border-border px-3 py-2">
          <span className="text-muted-foreground">Process Manager</span>
          <span className="font-medium capitalize">{status.processManager}</span>
        </div>
        <div className="flex justify-between rounded-md border border-border px-3 py-2">
          <span className="text-muted-foreground">Uptime</span>
          <span className="font-medium">{formatDuration(status.startSince)}</span>
        </div>
      </div>
    </div>
  );
}