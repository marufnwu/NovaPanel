import { useServerStats, useServiceStatuses, type ServiceStatusItem } from '../api/hooks/stats';
import { Cpu, HardDrive, Activity, Server } from 'lucide-react';

const KEY_SERVICES = ['nginx', 'apache2', 'mariadb', 'postgresql', 'named', 'postfix'];

function formatPercent(n: number | undefined) {
  return n !== undefined ? `${Math.round(n)}%` : '—';
}

export function StatusBar() {
  const { data: stats } = useServerStats();
  const { data: services } = useServiceStatuses();

  const cpu = stats?.cpu.usage;
  const ram = stats?.memory.usagePercent;
  const disk = stats?.disk.usagePercent;

  const keyServices = services?.filter((s) => KEY_SERVICES.includes(s.name)) ?? [];
  const failedServices = keyServices.filter((s) => s.status !== 'running');

  return (
    <div className="flex h-7 items-center gap-4 border-t border-border bg-muted/50 px-4 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Cpu className="h-3 w-3" />
        <span>CPU</span>
        <span className="font-medium text-foreground">{formatPercent(cpu)}</span>
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <HardDrive className="h-3 w-3" />
        <span>RAM</span>
        <span className="font-medium text-foreground">{formatPercent(ram)}</span>
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Activity className="h-3 w-3" />
        <span>Disk</span>
        <span className="font-medium text-foreground">{formatPercent(disk)}</span>
      </div>

      <div className="flex-1" />

      {failedServices.length > 0 && (
        <div className="flex items-center gap-1.5 text-red-500">
          <Server className="h-3 w-3" />
          <span>{failedServices.length} service{failedServices.length > 1 ? 's' : ''} down</span>
          <span className="font-mono text-[10px]">
            {failedServices.map((s) => s.displayName).join(', ')}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className={`h-1.5 w-1.5 rounded-full ${failedServices.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}
        />
        <span className="text-[10px]">
          {keyServices.filter((s) => s.status === 'running').length}/{keyServices.length} services
        </span>
      </div>
    </div>
  );
}