import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; available: number; cached?: number; buffered?: number; usagePercent?: number };
  disk: { total: number; used: number; available: number; usagePercent?: number; mount?: string };
  uptime: number;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'pending';
}

export function StatusBar() {
  const { data: stats } = useQuery<ServerStats>({
    queryKey: ['stats', 'server'],
    queryFn: () => api.get('/stats/server'),
    refetchInterval: 15000,
  });

  const { data: services } = useQuery<ServiceStatus[]>({
    queryKey: ['stats', 'services'],
    queryFn: () => api.get('/stats/services'),
    refetchInterval: 30000,
  });

  const getColor = (value: number) => {
    if (value >= 90) return 'var(--color-text-danger)';
    if (value >= 70) return 'var(--color-text-warning)';
    return 'var(--color-text-success)';
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="h-9 flex items-center px-6 bg-background-secondary border-b border-border-tertiary text-small gap-6">
      {stats && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-foreground-secondary">CPU</span>
            <span style={{ color: getColor(stats.cpu.usage) }}>{stats.cpu.usage}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground-secondary">RAM</span>
            <span style={{ color: getColor(stats.memory.usagePercent ?? 0) }}>{stats.memory.usagePercent ?? 0}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground-secondary">Disk</span>
            <span style={{ color: getColor(stats.disk.usagePercent ?? 0) }}>{stats.disk.usagePercent ?? 0}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground-secondary">Uptime</span>
            <span>{formatUptime(stats.uptime)}</span>
          </div>
        </>
      )}
      <div className="flex-1" />
      {services && (
        <div className="flex items-center gap-3">
          {services.map((service) => (
            <div key={service.name} className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${service.status === 'running' ? 'bg-foreground-success' : service.status === 'pending' ? 'bg-foreground-warning dot-pulse' : 'bg-foreground-danger'}`}
              />
              <span className="text-foreground-secondary">{service.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}