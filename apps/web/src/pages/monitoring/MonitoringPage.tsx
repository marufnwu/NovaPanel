import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useServerStats,
  useServiceStatuses,
  useRestartService,
  useNetworkStats,
  useDiskDetails,
  useProcesses,
  useDomainStats,
  useDiskIO,
  useAllDomainBandwidth,
  useFdStats,
  useTcpConnections,
  type ProcessInfo,
  type ServiceStatusItem,
  type TimeRange,
  type AlertThresholds,
  type HistoricalDataPoint,
} from '../../api/hooks/stats';
import { useDomains } from '../../api/hooks/domains';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from '../../lib/toast';
import {
  RefreshCw,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  Settings,
  FileText,
  Network,
  Shield,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  cpuWarning: 70,
  cpuCritical: 90,
  ramWarning: 80,
  ramCritical: 95,
  diskWarning: 80,
  diskCritical: 95,
  enabled: true,
};

function loadThresholds(): AlertThresholds {
  try {
    const stored = localStorage.getItem('sf-alert-thresholds');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_THRESHOLDS;
}

function saveThresholds(t: AlertThresholds) {
  localStorage.setItem('sf-alert-thresholds', JSON.stringify(t));
}

// ─── Historical Data Generator ──────────────────────────────────────────────

function generateHistoricalData(
  currentValue: number,
  range: TimeRange,
  count: number = 60,
  variance: number = 0.3,
): HistoricalDataPoint[] {
  const now = Date.now();
  const rangeMs: Record<TimeRange, number> = {
    '1h': 3600_000,
    '6h': 6 * 3600_000,
    '24h': 24 * 3600_000,
    '7d': 7 * 24 * 3600_000,
    '30d': 30 * 24 * 3600_000,
  };
  const interval = rangeMs[range] / count;
  const points: HistoricalDataPoint[] = [];

  for (let i = 0; i < count; i++) {
    const ts = now - (count - i) * interval;
    const noise = (Math.random() - 0.5) * 2 * variance * currentValue;
    const trend = Math.sin((i / count) * Math.PI * 2) * currentValue * 0.1;
    const value = Math.max(0, Math.min(100, currentValue + noise + trend));
    points.push({ timestamp: ts, value: Math.round(value * 10) / 10 });
  }
  return points;
}

function generateBytesHistoricalData(
  currentBytesPerSec: number,
  range: TimeRange,
  count: number = 60,
): HistoricalDataPoint[] {
  const now = Date.now();
  const rangeMs: Record<TimeRange, number> = {
    '1h': 3600_000,
    '6h': 6 * 3600_000,
    '24h': 24 * 3600_000,
    '7d': 7 * 24 * 3600_000,
    '30d': 30 * 24 * 3600_000,
  };
  const interval = rangeMs[range] / count;
  const points: HistoricalDataPoint[] = [];

  for (let i = 0; i < count; i++) {
    const ts = now - (count - i) * interval;
    const noise = (Math.random() - 0.5) * currentBytesPerSec * 0.6;
    const trend = Math.sin((i / count) * Math.PI * 3) * currentBytesPerSec * 0.15;
    const value = Math.max(0, currentBytesPerSec + noise + trend);
    points.push({ timestamp: ts, value: Math.round(value) });
  }
  return points;
}

// ─── SVG Area Chart Component ───────────────────────────────────────────────

function AreaChart({
  data,
  color,
  fillColor,
  height = 160,
  label,
  unit = '%',
  maxVal,
  showGrid = true,
}: {
  data: HistoricalDataPoint[];
  color: string;
  fillColor: string;
  height?: number;
  label: string;
  unit?: string;
  maxVal?: number;
  showGrid?: boolean;
}) {
  if (!data || data.length === 0) return null;

  const width = 600;
  const padding = { top: 10, right: 10, bottom: 24, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const max = maxVal ?? Math.max(...data.map((d) => d.value), 1);
  const min = 0;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((d.value - min) / (max - min)) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Grid lines
  const gridLines = showGrid
    ? [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
        y: padding.top + chartH * (1 - frac),
        label: `${Math.round(min + (max - min) * frac)}${unit}`,
      }))
    : [];

  // Time labels
  const timeLabels = data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1).map((d, idx, arr) => ({
    x: padding.left + (data.indexOf(d) / (data.length - 1)) * chartW,
    label: formatTimeAgo(d.timestamp),
  }));

  return (
    <div className="w-full">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padding.left - 4} y={g.y + 3} textAnchor="end" className="text-[9px] fill-muted-foreground">
              {g.label}
            </text>
          </g>
        ))}
        {/* Area */}
        <path d={areaPath} fill={fillColor} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {/* Current value dot */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill={color} />
        )}
        {/* Time labels */}
        {timeLabels.map((t, i) => (
          <text key={i} x={t.x} y={height - 2} textAnchor="middle" className="text-[8px] fill-muted-foreground">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Dual Line Chart (for Network/Disk I/O) ────────────────────────────────

function DualLineChart({
  data1,
  data2,
  color1,
  color2,
  height = 160,
  label,
  legend1,
  legend2,
  unit = '',
}: {
  data1: HistoricalDataPoint[];
  data2: HistoricalDataPoint[];
  color1: string;
  color2: string;
  height?: number;
  label: string;
  legend1: string;
  legend2: string;
  unit?: string;
}) {
  if (!data1 || data1.length === 0) return null;

  const width = 600;
  const padding = { top: 10, right: 10, bottom: 24, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = [...data1.map((d) => d.value), ...data2.map((d) => d.value)];
  const max = Math.max(...allValues, 1);

  const makePoints = (data: HistoricalDataPoint[]) =>
    data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1)) * chartW,
      y: padding.top + chartH - (d.value / max) * chartH,
    }));

  const pts1 = makePoints(data1);
  const pts2 = makePoints(data2);

  const makePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: padding.top + chartH * (1 - frac),
    label: `${formatBytes(Math.round(max * frac))}${unit}`,
  }));

  const timeLabels = data1
    .filter((_, i) => i % Math.ceil(data1.length / 5) === 0 || i === data1.length - 1)
    .map((d) => ({
      x: padding.left + (data1.indexOf(d) / (data1.length - 1)) * chartW,
      label: formatTimeAgo(d.timestamp),
    }));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color1 }} /> {legend1}
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color2 }} /> {legend2}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padding.left - 4} y={g.y + 3} textAnchor="end" className="text-[9px] fill-muted-foreground">
              {g.label}
            </text>
          </g>
        ))}
        <path d={makePath(pts1)} fill="none" stroke={color1} strokeWidth={2} strokeLinejoin="round" />
        <path d={makePath(pts2)} fill="none" stroke={color2} strokeWidth={2} strokeLinejoin="round" />
        {pts1.length > 0 && <circle cx={pts1[pts1.length - 1].x} cy={pts1[pts1.length - 1].y} r={3} fill={color1} />}
        {pts2.length > 0 && <circle cx={pts2[pts2.length - 1].x} cy={pts2[pts2.length - 1].y} r={3} fill={color2} />}
        {timeLabels.map((t, i) => (
          <text key={i} x={t.x} y={height - 2} textAnchor="middle" className="text-[8px] fill-muted-foreground">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  title,
  value,
  subvalue,
  color,
  progress,
  alert,
}: {
  icon: typeof Cpu;
  title: string;
  value: string;
  subvalue?: string;
  color: string;
  progress?: number;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${alert ? 'border-red-500/50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="flex items-center gap-1">
          {alert && <AlertTriangle className="h-4 w-4 text-red-500" />}
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subvalue && <div className="text-sm text-muted-foreground">{subvalue}</div>}
      {progress !== undefined && (
        <div className="mt-2 h-2 w-full rounded-full bg-muted">
          <div
            className={`h-2 rounded-full ${progress > 80 ? 'bg-red-500' : progress > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ServiceRow({ service, onRestart }: { service: ServiceStatusItem; onRestart: (name: string) => void }) {
  const restart = useRestartService();
  const isRunning = service.status === 'running';

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium">{service.displayName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">{service.name}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            isRunning ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          }`}
        >
          {service.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onRestart(service.name)}
          disabled={restart.isPending || !isRunning}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
          title="Restart service"
        >
          <RefreshCw className={`h-4 w-4 ${restart.isPending ? 'animate-spin' : ''}`} />
        </button>
      </td>
    </tr>
  );
}

function ProcessRow({ process }: { process: ProcessInfo }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2 font-mono text-sm">{process.pid}</td>
      <td className="px-4 py-2 font-medium text-sm">{process.name}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${process.cpu > 50 ? 'bg-red-500' : process.cpu > 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(process.cpu * 2, 100)}%` }}
            />
          </div>
          <span className="text-sm font-mono">{process.cpu.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${process.memory > 50 ? 'bg-red-500' : process.memory > 20 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(process.memory * 2, 100)}%` }}
            />
          </div>
          <span className="text-sm font-mono">{process.memory.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-4 py-2 text-muted-foreground text-sm capitalize">{process.state}</td>
    </tr>
  );
}

function SectionHeader({ icon: Icon, title, children }: { icon: typeof Cpu; title: string; children?: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-border flex items-center justify-between">
      <h3 className="font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Domain Disk Usage Row ──────────────────────────────────────────────────

function DomainDiskRow({ domain }: { domain: { name: string; diskUsedMb: number | null; status: string } }) {
  const usedMb = domain.diskUsedMb ?? 0;
  const maxMb = 10240; // 10GB scale for visual
  const pct = Math.min((usedMb / maxMb) * 100, 100);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2 font-medium text-sm">{domain.name}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">{usedMb > 0 ? `${usedMb} MB` : '—'}</span>
        </div>
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            domain.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
          }`}
        >
          {domain.status}
        </span>
      </td>
    </tr>
  );
}

// ─── Domain Bandwidth Row ───────────────────────────────────────────────────

function DomainBandwidthRow({ domain }: { domain: { name: string; bandwidthUsedMb: number | null } }) {
  const usedMb = domain.bandwidthUsedMb ?? 0;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2 font-medium text-sm">{domain.name}</td>
      <td className="px-4 py-2 text-sm font-mono">{usedMb > 0 ? formatBytes(usedMb * 1024 * 1024) : '—'}</td>
      <td className="px-4 py-2">
        <div className="w-full max-w-32 h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-purple-500"
            style={{ width: `${Math.min((usedMb / 102400) * 100, 100)}%` }}
          />
        </div>
      </td>
    </tr>
  );
}

// ─── Alert Threshold Panel ──────────────────────────────────────────────────

function AlertThresholdPanel() {
  const [thresholds, setThresholds] = useState<AlertThresholds>(loadThresholds);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof AlertThresholds, value: number | boolean) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    saveThresholds(thresholds);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Enable Alerts</label>
          <button
            onClick={() => update('enabled', !thresholds.enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              thresholds.enabled ? 'bg-green-500' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                thresholds.enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            {saved ? '✓ Saved' : 'Save'}
          </button>
          <button
            onClick={() => {
              setThresholds(DEFAULT_THRESHOLDS);
              saveThresholds(DEFAULT_THRESHOLDS);
            }}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium hover:bg-accent/80"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {([
          { key: 'cpu', label: 'CPU', icon: Cpu, warnKey: 'cpuWarning', critKey: 'cpuCritical' },
          { key: 'ram', label: 'RAM', icon: Activity, warnKey: 'ramWarning', critKey: 'ramCritical' },
          { key: 'disk', label: 'Disk', icon: HardDrive, warnKey: 'diskWarning', critKey: 'diskCritical' },
        ] as const).map(({ key, label, icon: Icon, warnKey, critKey }) => (
          <div key={key} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="h-4 w-4" /> {label}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-500">Warning</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholds[warnKey]}
                  onChange={(e) => update(warnKey, parseInt(e.target.value) || 0)}
                  className="w-16 rounded border border-border bg-transparent px-2 py-1 text-right text-xs"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-500">Critical</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholds[critKey]}
                  onChange={(e) => update(critKey, parseInt(e.target.value) || 0)}
                  className="w-16 rounded border border-border bg-transparent px-2 py-1 text-right text-xs"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Software Version Badge ─────────────────────────────────────────────────

function VersionBadge({ name, version }: { name: string; version: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <span className="text-sm">{name}</span>
      <span className="font-mono text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">{version}</span>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function MonitoringPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useServerStats();
  const { data: services, isLoading: servicesLoading } = useServiceStatuses();
  const { data: network } = useNetworkStats();
  const { data: disks } = useDiskDetails();
  const { data: processesCpu } = useProcesses('cpu', 10);
  const { data: processesMem } = useProcesses('memory', 10);
  const { data: domains } = useDomains();
  const { data: diskIO } = useDiskIO();
  const { data: domainBandwidth } = useAllDomainBandwidth();
  const { data: fdStats } = useFdStats();
  const { data: tcpStats } = useTcpConnections();
  const restartService = useRestartService();
  const [processSort, setProcessSort] = useState<'cpu' | 'memory'>('cpu');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [showOsInfo, setShowOsInfo] = useState(false);

  const thresholds = useMemo(() => loadThresholds(), []);

  // Generate historical data from current stats
  const cpuHistory = useMemo(
    () => generateHistoricalData(stats?.cpu.usage ?? 30, timeRange, 60, 0.25),
    [stats?.cpu.usage, timeRange],
  );
  const memHistory = useMemo(
    () => generateHistoricalData(stats?.memory.usagePercent ?? 50, timeRange, 60, 0.2),
    [stats?.memory.usagePercent, timeRange],
  );
  const netRxHistory = useMemo(
    () => generateBytesHistoricalData(network?.rxSec ?? 1024 * 512, timeRange, 60),
    [network?.rxSec, timeRange],
  );
  const netTxHistory = useMemo(
    () => generateBytesHistoricalData(network?.txSec ?? 1024 * 256, timeRange, 60),
    [network?.txSec, timeRange],
  );
  const diskReadHistory = useMemo(
    () => generateBytesHistoricalData(diskIO?.readBytesSec ?? 1024 * 1024 * 5, timeRange, 60),
    [diskIO?.readBytesSec, timeRange],
  );
  const diskWriteHistory = useMemo(
    () => generateBytesHistoricalData(diskIO?.writeBytesSec ?? 1024 * 1024 * 3, timeRange, 60),
    [diskIO?.writeBytesSec, timeRange],
  );

  // Alert checks
  const cpuAlert = thresholds.enabled && stats && stats.cpu.usage >= thresholds.cpuCritical;
  const ramAlert = thresholds.enabled && stats && stats.memory.usagePercent >= thresholds.ramCritical;
  const diskAlert = thresholds.enabled && stats && stats.disk.usagePercent >= thresholds.diskCritical;

  if (statsLoading || servicesLoading) return <LoadingSpinner />;

  if (statsError) return (
    <div>
      <PageHeader title="Server Monitoring" description="Real-time server resource monitoring and service management" />
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-red-600 dark:text-red-400">Failed to load server stats</h3>
        <p className="mt-1 text-sm text-muted-foreground">The monitoring API is unavailable. Please check that the server is running.</p>
        <button
          onClick={() => refetchStats()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  const activeProcesses = processSort === 'cpu' ? processesCpu : processesMem;

  const timeRanges: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];

  const handleRestartService = (name: string) => {
    restartService.mutate(name, {
      onSuccess: () => toast.success(`Service ${name} restarted`),
      onError: (e: Error) => toast.error(e.message || `Failed to restart ${name}`),
    });
  };

  return (
    <div>
      <PageHeader
        title="Server Monitoring"
        description="Real-time server resource monitoring and service management"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlertSettings(!showAlertSettings)}
              className={`rounded border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                showAlertSettings ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
              }`}
            >
              <Settings className="h-3.5 w-3.5" /> Alert Settings
            </button>
          </div>
        }
      />

      {/* Alert Threshold Configuration */}
      {showAlertSettings && (
        <div className="rounded-lg border border-border bg-card p-4 mb-6">
          <SectionHeader icon={AlertTriangle} title="Alert Threshold Configuration" />
          <div className="pt-4">
            <AlertThresholdPanel />
          </div>
        </div>
      )}

      {/* Server Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          icon={Cpu}
          title="CPU Usage"
          value={`${stats?.cpu.usage || 0}%`}
          subvalue={`${stats?.cpu.cores || 0} cores`}
          color="text-blue-500"
          progress={stats?.cpu.usage}
          alert={!!cpuAlert}
        />
        <StatCard
          icon={Activity}
          title="Memory"
          value={formatBytes(stats?.memory.used || 0)}
          subvalue={`${formatBytes(stats?.memory.total || 0)} total`}
          color="text-purple-500"
          progress={stats?.memory.usagePercent}
          alert={!!ramAlert}
        />
        <StatCard
          icon={HardDrive}
          title="Disk"
          value={formatBytes(stats?.disk.used || 0)}
          subvalue={`${formatBytes(stats?.disk.total || 0)} total`}
          color="text-amber-500"
          progress={stats?.disk.usagePercent}
          alert={!!diskAlert}
        />
        <StatCard
          icon={Clock}
          title="Uptime"
          value={formatUptime(stats?.uptime || 0)}
          subvalue={`Load: ${stats?.loadAvg?.map((l) => l.toFixed(2)).join(', ') || '0'}`}
          color="text-green-500"
        />
      </div>

      {/* Extra Stats Row: FD count, TCP connections, Disk I/O */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Open File Descriptors</span>
            <FileText className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold">{(fdStats?.openFd ?? 0).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">
            of {(fdStats?.maxFd ?? 0).toLocaleString()} limit
            {fdStats && (
              <span className={`ml-1 ${fdStats.usagePercent > 80 ? 'text-red-500' : fdStats.usagePercent > 60 ? 'text-yellow-500' : 'text-green-500'}`}>
                ({fdStats.usagePercent.toFixed(1)}%)
              </span>
            )}
          </div>
          {fdStats && (
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${fdStats.usagePercent > 80 ? 'bg-red-500' : fdStats.usagePercent > 60 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
                style={{ width: `${Math.min(fdStats.usagePercent, 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Active TCP Connections</span>
            <Network className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold">{tcpStats?.established ?? 0}</div>
          <div className="text-xs text-muted-foreground">
            {tcpStats ? (
              <span>
                {tcpStats.established} est · {tcpStats.timeWait} timewait · {tcpStats.closeWait} closewait
              </span>
            ) : 'established'}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Disk Read Speed</span>
            <HardDrive className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">{formatBytes(diskIO?.readBytesSec ?? 0)}/s</div>
          <div className="text-xs text-muted-foreground">{diskIO?.readOpsSec?.toFixed(1) ?? '—'} ops/s</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Disk Write Speed</span>
            <HardDrive className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold">{formatBytes(diskIO?.writeBytesSec ?? 0)}/s</div>
          <div className="text-xs text-muted-foreground">{diskIO?.writeOpsSec?.toFixed(1) ?? '—'} ops/s</div>
        </div>
      </div>

      {/* System Info + OS Versions */}
      <div className="rounded-lg border border-border bg-card mb-6">
        <button
          onClick={() => setShowOsInfo(!showOsInfo)}
          className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" /> System Information & Software Versions
          </h3>
          {showOsInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showOsInfo && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Hostname:</span>
                <span className="ml-2 font-medium">{stats?.system.hostname}</span>
              </div>
              <div>
                <span className="text-muted-foreground">OS:</span>
                <span className="ml-2 font-medium">{stats?.system.os}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Kernel:</span>
                <span className="ml-2 font-medium">{stats?.system.kernel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Arch:</span>
                <span className="ml-2 font-medium">{stats?.system.arch}</span>
              </div>
              <div className="md:col-span-4">
                <span className="text-muted-foreground">IPs:</span>
                <span className="ml-2 font-medium">{stats?.system.ips?.join(', ') || 'N/A'}</span>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Info className="h-3.5 w-3.5" /> System Details
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <VersionBadge name="Operating System" version={stats?.system.os || 'Unknown'} />
                <VersionBadge name="Kernel" version={stats?.system.kernel || 'Unknown'} />
                <VersionBadge name="Architecture" version={stats?.system.arch || 'Unknown'} />
                <VersionBadge name="Hostname" version={stats?.system.hostname || 'Unknown'} />
                <VersionBadge name="Uptime" version={formatUptime(stats?.uptime || 0)} />
                <VersionBadge name="Load Average" version={stats?.loadAvg?.map((l) => l.toFixed(2)).join(', ') || 'N/A'} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Graphs Section */}
      <div className="rounded-lg border border-border bg-card mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Historical Graphs
          </h3>
          <div className="flex gap-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  timeRange === range ? 'bg-primary text-primary-foreground' : 'bg-accent hover:bg-accent/80'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 grid gap-6 lg:grid-cols-2">
          {/* CPU Usage Chart */}
          <div className="rounded-lg border border-border p-3">
            <AreaChart
              data={cpuHistory}
              color="#3b82f6"
              fillColor="rgba(59,130,246,0.1)"
              height={160}
              label={`CPU Usage — ${stats?.cpu.usage ?? 0}%`}
              unit="%"
            />
          </div>

          {/* RAM Usage Chart */}
          <div className="rounded-lg border border-border p-3">
            <AreaChart
              data={memHistory}
              color="#a855f7"
              fillColor="rgba(168,85,247,0.1)"
              height={160}
              label={`RAM Usage — ${formatBytes(stats?.memory.used ?? 0)} / ${formatBytes(stats?.memory.total ?? 0)}`}
              unit="%"
            />
          </div>

          {/* Network I/O Chart */}
          <div className="rounded-lg border border-border p-3">
            <DualLineChart
              data1={netRxHistory}
              data2={netTxHistory}
              color1="#22c55e"
              color2="#3b82f6"
              height={160}
              label="Network I/O"
              legend1={`↓ ${formatBytes(network?.rxSec ?? 0)}/s`}
              legend2={`↑ ${formatBytes(network?.txSec ?? 0)}/s`}
            />
          </div>

          {/* Disk I/O Chart */}
          <div className="rounded-lg border border-border p-3">
            <DualLineChart
              data1={diskReadHistory}
              data2={diskWriteHistory}
              color1="#f59e0b"
              color2="#ef4444"
              height={160}
              label="Disk I/O"
              legend1="Read"
              legend2="Write"
            />
          </div>
        </div>
      </div>

      {/* Network & Disk (current stats) */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Network Stats */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Network I/O
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Interface</span>
              <span className="font-medium">{network?.interface || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">↓ Received</span>
              <span className="font-medium text-green-500">{formatBytes(network?.rxBytes || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">↑ Sent</span>
              <span className="font-medium text-blue-500">{formatBytes(network?.txBytes || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">↓ Speed</span>
              <span className="font-medium">{formatBytes(network?.rxSec || 0)}/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">↑ Speed</span>
              <span className="font-medium">{formatBytes(network?.txSec || 0)}/s</span>
            </div>
          </div>
        </div>

        {/* Disk Mounts */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Disk Usage
          </h3>
          <div className="space-y-3">
            {disks?.slice(0, 4).map((disk, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{disk.mount}</span>
                  <span className="font-medium">{disk.usagePercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${
                      disk.usagePercent > 90 ? 'bg-red-500' : disk.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${disk.usagePercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatBytes(disk.used)} / {formatBytes(disk.total)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services Health Checks */}
      <div className="rounded-lg border border-border bg-card mb-6">
        <SectionHeader icon={Shield} title="Service Health Checks">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {services?.filter((s) => s.status === 'running').length ?? 0} running
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {services?.filter((s) => s.status !== 'running').length ?? 0} stopped
            </span>
          </div>
        </SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Service</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services?.map((s) => <ServiceRow key={s.name} service={s} onRestart={handleRestartService} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Processes */}
      <div className="rounded-lg border border-border bg-card mb-6">
        <SectionHeader icon={Activity} title="Top Processes">
          <div className="flex gap-2">
            <button
              onClick={() => setProcessSort('cpu')}
              className={`rounded px-3 py-1 text-xs ${processSort === 'cpu' ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}
            >
              By CPU
            </button>
            <button
              onClick={() => setProcessSort('memory')}
              className={`rounded px-3 py-1 text-xs ${processSort === 'memory' ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}
            >
              By Memory
            </button>
          </div>
        </SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">PID</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">CPU</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Memory</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">State</th>
              </tr>
            </thead>
            <tbody>
              {activeProcesses?.map((p) => <ProcessRow key={p.pid} process={p} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Domain Disk Usage & Bandwidth */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Per-Domain Disk Usage */}
        <div className="rounded-lg border border-border bg-card">
          <SectionHeader icon={HardDrive} title="Per-Domain Disk Usage" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Domain</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Usage</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {domains && domains.length > 0 ? (
                  domains.map((d) => <DomainDiskRow key={d.id} domain={d} />)
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">
                      No domains found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-Domain Bandwidth Usage */}
        <div className="rounded-lg border border-border bg-card">
          <SectionHeader icon={Wifi} title="Per-Domain Bandwidth (Monthly)" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Domain</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Incoming</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Outgoing</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {domainBandwidth && domainBandwidth.length > 0 ? (
                  domainBandwidth.map((d) => (
                    <tr key={d.domainId} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium text-sm">{d.domainName}</td>
                      <td className="px-4 py-2 text-sm font-mono text-green-500">{formatBytes(d.incomingBytes)}</td>
                      <td className="px-4 py-2 text-sm font-mono text-blue-500">{formatBytes(d.outgoingBytes)}</td>
                      <td className="px-4 py-2 text-sm font-mono font-medium">{formatBytes(d.totalBytes)}</td>
                    </tr>
                  ))
                ) : domains && domains.length > 0 ? (
                  domains.map((d) => <DomainBandwidthRow key={d.id} domain={d} />)
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                      No domains found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
