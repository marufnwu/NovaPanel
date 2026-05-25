import React, { useMemo } from 'react';
import { useMetrics, type Metric } from '../../api/hooks/monitoring';
import { Card } from '../ui/Card';

interface ResourceGraphsProps {
  siteId: string;
}

interface TimeRangeOption {
  label: string;
  value: '1h' | '6h' | '24h' | '7d';
}

const TIME_RANGES: TimeRangeOption[] = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface SparklineProps {
  data: Metric[];
  color: string;
  maxValue?: number;
  height?: number;
}

function Sparkline({ data, color, maxValue, height = 40 }: SparklineProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-meta text-foreground-tertiary" style={{ height }}>
        No data
      </div>
    );
  }

  const values = data.map((d: Metric) => d.value);
  const max = maxValue ?? Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  
  const polylinePoints = values.map((v: number, i: number) => {
    const x = (i / (values.length - 1 || 1)) * 280;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 280 ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${polylinePoints} 280,${height}`}
        fill={`url(#gradient-${color.replace('#', '')})`}
      />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface MetricCardProps {
  title: string;
  icon: string;
  data: Metric[];
  currentValue: number | null;
  unit: string;
  color: string;
  maxValue?: number;
  isLoading?: boolean;
}

function MetricCard({ title, icon, data, currentValue, unit, color, maxValue, isLoading }: MetricCardProps) {
  const displayValue = currentValue !== null && currentValue !== undefined;
  
  return (
    <Card className="bg-background-secondary">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground-secondary" style={{ color }}>{icon}</span>
          <span className="text-small font-medium">{title}</span>
        </div>
        {isLoading && (
          <span className="text-meta text-foreground-tertiary">Loading...</span>
        )}
      </div>
      <div className="mb-2">
        <span className="text-[24px] font-medium font-mono">
          {displayValue ? (Number.isInteger(currentValue) ? currentValue : currentValue?.toFixed(1)) : '—'}
        </span>
        <span className="text-small text-foreground-secondary ml-1">{unit}</span>
      </div>
      <div className="h-[40px]">
        <Sparkline data={data} color={color} maxValue={maxValue} />
      </div>
    </Card>
  );
}

interface NetworkGraphProps {
  data: Metric[];
  isLoading?: boolean;
}

function NetworkGraph({ data, isLoading }: NetworkGraphProps) {
  const { rxData, txData, maxValue } = useMemo(() => {
    const rx = (data ?? []).filter((d: Metric) => d.name === 'network_rx');
    const tx = (data ?? []).filter((d: Metric) => d.name === 'network_tx');
    const allValues = [...rx.map((d: Metric) => d.value), ...tx.map((d: Metric) => d.value)];
    return {
      rxData: rx,
      txData: tx,
      maxValue: Math.max(...allValues, 1),
    };
  }, [data]);

  const formatRate = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const currentRx = rxData.length > 0 ? rxData[rxData.length - 1].value : null;
  const currentTx = txData.length > 0 ? txData[txData.length - 1].value : null;

  return (
    <Card title="Network I/O" className="bg-background-secondary">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-foreground-info" />
            <span className="text-small text-foreground-secondary">RX</span>
            <span className="text-small font-mono">
              {currentRx !== null ? formatRate(currentRx) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-foreground-success" />
            <span className="text-small text-foreground-secondary">TX</span>
            <span className="text-small font-mono">
              {currentTx !== null ? formatRate(currentTx) : '—'}
            </span>
          </div>
        </div>
        {isLoading && (
          <span className="text-meta text-foreground-tertiary">Loading...</span>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-meta text-foreground-tertiary">Download</span>
          </div>
          <div className="h-[40px]">
            <Sparkline data={rxData} color="var(--color-text-info)" maxValue={maxValue} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-meta text-foreground-tertiary">Upload</span>
          </div>
          <div className="h-[40px]">
            <Sparkline data={txData} color="var(--color-text-success)" maxValue={maxValue} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ResourceGraphs({ siteId }: ResourceGraphsProps) {
  const [timeRange, setTimeRange] = React.useState<'1h' | '6h' | '24h' | '7d'>('1h');
  
  const timeRangeParams = useMemo(() => {
    const now = new Date();
    let from: Date;
    
    switch (timeRange) {
      case '1h':
        from = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        from = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }
    
    return {
      from: from.toISOString(),
      to: now.toISOString(),
      limit: 100,
    };
  }, [timeRange]);

  const { data: metrics, isLoading: metricsLoading } = useMetrics({
    from: timeRangeParams.from,
    to: timeRangeParams.to,
    limit: timeRangeParams.limit,
  });

  const cpuMetrics = useMemo(() => 
    (metrics ?? []).filter((m: Metric) => m.name === 'cpu_usage').slice(-20),
  [metrics]);

  const memoryMetrics = useMemo(() => 
    (metrics ?? []).filter((m: Metric) => m.name === 'memory_usage').slice(-20),
  [metrics]);

  const diskMetrics = useMemo(() => 
    (metrics ?? []).filter((m: Metric) => m.name === 'disk_usage').slice(-20),
  [metrics]);

  const networkMetrics = useMemo(() => 
    (metrics ?? []).filter((m: Metric) => m.name === 'network_rx' || m.name === 'network_tx').slice(-40),
  [metrics]);

  const currentCpu = cpuMetrics.length > 0 ? cpuMetrics[cpuMetrics.length - 1].value : null;
  const currentMemory = memoryMetrics.length > 0 ? memoryMetrics[memoryMetrics.length - 1].value : null;
  const currentDisk = diskMetrics.length > 0 ? diskMetrics[diskMetrics.length - 1].value : null;

  const hasAnyData = cpuMetrics.length > 0 || memoryMetrics.length > 0 || diskMetrics.length > 0 || networkMetrics.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-small font-medium">Resource Usage</h3>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1 text-small rounded transition-colors ${
                timeRange === range.value
                  ? 'bg-foreground-primary text-background-primary'
                  : 'bg-background-tertiary text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {!hasAnyData && !metricsLoading ? (
        <Card className="bg-background-secondary">
          <div className="text-center py-8">
            <p className="text-small text-foreground-secondary mb-2">No resource data available</p>
            <p className="text-meta text-foreground-tertiary">
              Metrics are collected periodically. Data will appear here once available.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            title="CPU"
            icon="⚡"
            data={cpuMetrics}
            currentValue={currentCpu}
            unit="%"
            color="var(--color-text-info)"
            maxValue={100}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Memory"
            icon="💾"
            data={memoryMetrics}
            currentValue={currentMemory}
            unit="%"
            color="var(--color-text-success)"
            maxValue={100}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Disk"
            icon="💿"
            data={diskMetrics}
            currentValue={currentDisk}
            unit="%"
            color="var(--color-text-warning)"
            maxValue={100}
            isLoading={metricsLoading}
          />
          <NetworkGraph data={networkMetrics} isLoading={metricsLoading} />
        </div>
      )}
    </div>
  );
}