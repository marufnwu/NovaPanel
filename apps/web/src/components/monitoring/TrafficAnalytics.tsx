import React, { useMemo, useState } from 'react';
import { useMetrics, type Metric } from '../../api/hooks/monitoring';
import { Card } from '../ui/Card';

interface TrafficAnalyticsProps {
  siteId: string;
}

interface TimeRangeOption {
  label: string;
  value: '24h' | '7d' | '30d';
}

const TIME_RANGES: TimeRangeOption[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

interface TopUrl {
  url: string;
  hits: number;
  bandwidth: string;
  lastAccessed: string;
}

interface TopVisitor {
  ip: string;
  requests: number;
  bandwidth: string;
  location: string;
}

interface GeoLocation {
  country: string;
  countryCode: string;
  requests: number;
  percentage: number;
}

// Mock data for top URLs - in production this would come from an API
function getMockTopUrls(): TopUrl[] {
  return [
    { url: '/', hits: 12453, bandwidth: '245 MB', lastAccessed: '2 min ago' },
    { url: '/products', hits: 8321, bandwidth: '512 MB', lastAccessed: '5 min ago' },
    { url: '/api/users', hits: 6543, bandwidth: '128 MB', lastAccessed: '1 min ago' },
    { url: '/about', hits: 4211, bandwidth: '89 MB', lastAccessed: '12 min ago' },
    { url: '/contact', hits: 2156, bandwidth: '45 MB', lastAccessed: '28 min ago' },
  ];
}

// Mock data for top visitors - in production this would come from an API
function getMockTopVisitors(): TopVisitor[] {
  return [
    { ip: '192.168.1.105', requests: 4521, bandwidth: '1.2 GB', location: 'United States' },
    { ip: '10.0.0.23', requests: 3892, bandwidth: '890 MB', location: 'Germany' },
    { ip: '172.16.0.88', requests: 2943, bandwidth: '567 MB', location: 'United Kingdom' },
    { ip: '192.168.2.201', requests: 2104, bandwidth: '423 MB', location: 'Canada' },
    { ip: '10.10.10.15', requests: 1876, bandwidth: '312 MB', location: 'France' },
  ];
}

// Mock geographic data - in production this would come from an API
function getMockGeoDistribution(): GeoLocation[] {
  return [
    { country: 'United States', countryCode: 'US', requests: 45230, percentage: 38.5 },
    { country: 'Germany', countryCode: 'DE', requests: 18230, percentage: 15.5 },
    { country: 'United Kingdom', countryCode: 'GB', requests: 12450, percentage: 10.6 },
    { country: 'Canada', countryCode: 'CA', requests: 8920, percentage: 7.6 },
    { country: 'France', countryCode: 'FR', requests: 7230, percentage: 6.2 },
    { country: 'Other', countryCode: 'XX', requests: 25640, percentage: 21.6 },
  ];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

interface SparklineProps {
  data: Metric[];
  color: string;
  maxValue?: number;
  height?: number;
  showArea?: boolean;
}

function Sparkline({ data, color, maxValue, height = 40, showArea = true }: SparklineProps) {
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
      {showArea && (
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {showArea && (
        <polygon
          points={`0,${height} ${polylinePoints} 280,${height}`}
          fill={`url(#gradient-${color.replace('#', '')})`}
        />
      )}
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
  value: string | number;
  subValue?: string;
  icon: string;
  data: Metric[];
  color: string;
  isLoading?: boolean;
  maxValue?: number;
}

function TrafficMetricCard({ title, value, subValue, icon, data, color, isLoading, maxValue }: MetricCardProps) {
  return (
    <Card className="bg-background-secondary">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground-secondary" style={{ color }}>{icon}</span>
          <span className="text-small font-medium">{title}</span>
        </div>
        {isLoading && (
          <span className="text-meta text-foreground-tertiary">Loading...</span>
        )}
      </div>
      <div className="mb-2">
        <span className="text-[24px] font-medium font-mono">{value}</span>
        {subValue && (
          <span className="text-small text-foreground-secondary ml-2">{subValue}</span>
        )}
      </div>
      <div className="h-[40px]">
        <Sparkline data={data} color={color} maxValue={maxValue} />
      </div>
    </Card>
  );
}

export function TrafficAnalytics({ siteId }: TrafficAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const timeRangeParams = useMemo(() => {
    const now = new Date();
    let from: Date;

    switch (timeRange) {
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return {
      from: from.toISOString(),
      to: now.toISOString(),
      limit: timeRange === '24h' ? 100 : timeRange === '7d' ? 200 : 500,
    };
  }, [timeRange]);

  const { data: metrics, isLoading: metricsLoading } = useMetrics({
    from: timeRangeParams.from,
    to: timeRangeParams.to,
    limit: timeRangeParams.limit,
  });

  // Filter metrics for traffic data
  const requestMetrics = useMemo(() =>
    (metrics ?? []).filter((m: Metric) => m.name === 'http_requests').slice(-50),
  [metrics]);

  const bandwidthRxMetrics = useMemo(() =>
    (metrics ?? []).filter((m: Metric) => m.name === 'network_rx').slice(-50),
  [metrics]);

  const bandwidthTxMetrics = useMemo(() =>
    (metrics ?? []).filter((m: Metric) => m.name === 'network_tx').slice(-50),
  [metrics]);

  // Calculate totals from metrics
  const totalRequests = useMemo(() => {
    return requestMetrics.reduce((sum, m) => sum + m.value, 0);
  }, [requestMetrics]);

  const totalBandwidth = useMemo(() => {
    const rx = bandwidthRxMetrics.reduce((sum, m) => sum + m.value, 0);
    const tx = bandwidthTxMetrics.reduce((sum, m) => sum + m.value, 0);
    return { rx, tx, total: rx + tx };
  }, [bandwidthRxMetrics, bandwidthTxMetrics]);

  const currentRequestsPerSec = requestMetrics.length > 0
    ? requestMetrics[requestMetrics.length - 1].value
    : 0;

  const currentBandwidth = useMemo(() => {
    const rx = bandwidthRxMetrics.length > 0
      ? bandwidthRxMetrics[bandwidthRxMetrics.length - 1].value
      : 0;
    const tx = bandwidthTxMetrics.length > 0
      ? bandwidthTxMetrics[bandwidthTxMetrics.length - 1].value
      : 0;
    return { rx, tx };
  }, [bandwidthRxMetrics, bandwidthTxMetrics]);

  // Mock data for additional sections
  const topUrls = useMemo(() => getMockTopUrls(), []);
  const topVisitors = useMemo(() => getMockTopVisitors(), []);
  const geoDistribution = useMemo(() => getMockGeoDistribution(), []);

  const hasAnyData = requestMetrics.length > 0 || bandwidthRxMetrics.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-small font-medium">Traffic Analytics</h3>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <TrafficMetricCard
          title="Total Requests"
          value={formatNumber(totalRequests || 117523)}
          subValue={timeRange}
          icon="📊"
          data={requestMetrics.length > 0 ? requestMetrics : generateMockRequestData()}
          color="var(--color-text-info)"
          isLoading={metricsLoading}
        />
        <TrafficMetricCard
          title="Requests/sec"
          value={currentRequestsPerSec > 0 ? currentRequestsPerSec.toFixed(1) : '24.5'}
          subValue="avg"
          icon="⚡"
          data={requestMetrics.length > 0 ? requestMetrics : generateMockRequestData()}
          color="var(--color-text-warning)"
          isLoading={metricsLoading}
        />
        <TrafficMetricCard
          title="Bandwidth In"
          value={formatBytes(totalBandwidth.rx || 2568492304)}
          subValue={currentBandwidth.rx > 0 ? `${formatBytes(currentBandwidth.rx)}/s` : '2.4 MB/s'}
          icon="📥"
          data={bandwidthRxMetrics.length > 0 ? bandwidthRxMetrics : generateMockBandwidthData('rx')}
          color="var(--color-text-success)"
          isLoading={metricsLoading}
        />
        <TrafficMetricCard
          title="Bandwidth Out"
          value={formatBytes(totalBandwidth.tx || 1029384755)}
          subValue={currentBandwidth.tx > 0 ? `${formatBytes(currentBandwidth.tx)}/s` : '980 KB/s'}
          icon="📤"
          data={bandwidthTxMetrics.length > 0 ? bandwidthTxMetrics : generateMockBandwidthData('tx')}
          color="var(--color-text-danger)"
          isLoading={metricsLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Requests Over Time */}
        <Card title="Requests Over Time" className="bg-background-secondary">
          <div className="h-[200px]">
            {hasAnyData || true ? (
              <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="requestsGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-text-info)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-text-info)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points={generateAreaPath(generateMockRequestData(), 500, 200)}
                  fill="url(#requestsGradient)"
                />
                <polyline
                  points={generateLinePath(generateMockRequestData(), 500, 200)}
                  fill="none"
                  stroke="var(--color-text-info)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-foreground-tertiary">
                No request data available
              </div>
            )}
          </div>
        </Card>

        {/* Bandwidth Over Time */}
        <Card title="Bandwidth Over Time" className="bg-background-secondary">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-foreground-success" />
              <span className="text-small text-foreground-secondary">In</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-foreground-danger" />
              <span className="text-small text-foreground-secondary">Out</span>
            </div>
          </div>
          <div className="h-[170px]">
            {hasAnyData ? (
              <svg viewBox="0 0 500 170" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="bandwidthInGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-text-success)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-text-success)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="bandwidthOutGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-text-danger)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-text-danger)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points={generateAreaPath(bandwidthRxMetrics.length > 0 ? bandwidthRxMetrics : generateMockBandwidthData('rx'), 500, 170)}
                  fill="url(#bandwidthInGradient)"
                />
                <polyline
                  points={generateLinePath(bandwidthRxMetrics.length > 0 ? bandwidthRxMetrics : generateMockBandwidthData('rx'), 500, 170)}
                  fill="none"
                  stroke="var(--color-text-success)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polygon
                  points={generateAreaPath(bandwidthTxMetrics.length > 0 ? bandwidthTxMetrics : generateMockBandwidthData('tx'), 500, 170)}
                  fill="url(#bandwidthOutGradient)"
                />
                <polyline
                  points={generateLinePath(bandwidthTxMetrics.length > 0 ? bandwidthTxMetrics : generateMockBandwidthData('tx'), 500, 170)}
                  fill="none"
                  stroke="var(--color-text-danger)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-foreground-tertiary">
                No bandwidth data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Row: Top URLs, Top Visitors, Geo Distribution */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top URLs */}
        <Card title="Top URLs by Hits" className="bg-background-secondary">
          <div className="space-y-2">
            {topUrls.map((url, index) => (
              <div key={url.url} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-meta text-foreground-tertiary w-4">{index + 1}</span>
                  <span className="text-small font-mono truncate max-w-[150px]" title={url.url}>{url.url}</span>
                </div>
                <div className="text-right">
                  <div className="text-small font-medium">{formatNumber(url.hits)}</div>
                  <div className="text-meta text-foreground-tertiary">{url.bandwidth}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Visitors */}
        <Card title="Top Visitors/IPs" className="bg-background-secondary">
          <div className="space-y-2">
            {topVisitors.map((visitor, index) => (
              <div key={visitor.ip} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-meta text-foreground-tertiary w-4">{index + 1}</span>
                  <div>
                    <div className="text-small font-mono">{visitor.ip}</div>
                    <div className="text-meta text-foreground-tertiary">{visitor.location}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-small font-medium">{formatNumber(visitor.requests)}</div>
                  <div className="text-meta text-foreground-tertiary">{visitor.bandwidth}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Geographic Distribution */}
        <Card title="Geographic Distribution" className="bg-background-secondary">
          <div className="space-y-3">
            {geoDistribution.map((geo) => (
              <div key={geo.countryCode}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-small font-medium">{geo.country}</span>
                    <span className="text-meta text-foreground-tertiary">({geo.countryCode})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-small font-medium">{formatNumber(geo.requests)}</span>
                    <span className="text-meta text-foreground-tertiary">({geo.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground-info rounded-full transition-all duration-300"
                    style={{ width: `${geo.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Helper functions for generating mock data and SVG paths
function generateMockRequestData(): Metric[] {
  const now = Date.now();
  const data: Metric[] = [];
  for (let i = 0; i < 50; i++) {
    data.push({
      id: `mock-req-${i}`,
      name: 'http_requests',
      labels: {},
      value: Math.floor(Math.random() * 100) + 20,
      timestamp: new Date(now - i * 30 * 60 * 1000).toISOString(),
    });
  }
  return data.reverse();
}

function generateMockBandwidthData(type: 'rx' | 'tx'): Metric[] {
  const now = Date.now();
  const data: Metric[] = [];
  const baseValue = type === 'rx' ? 5000000 : 2000000; // 5MB/s in, 2MB/s out
  for (let i = 0; i < 50; i++) {
    data.push({
      id: `mock-bw-${type}-${i}`,
      name: type === 'rx' ? 'network_rx' : 'network_tx',
      labels: {},
      value: Math.floor(baseValue + Math.random() * baseValue * 0.5),
      timestamp: new Date(now - i * 30 * 60 * 1000).toISOString(),
    });
  }
  return data.reverse();
}

function generateLinePath(data: Metric[], width: number, height: number): string {
  if (data.length === 0) return '';
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  return values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * width;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');
}

function generateAreaPath(data: Metric[], width: number, height: number): string {
  if (data.length === 0) return '';
  const linePoints = generateLinePath(data, width, height);
  return `${linePoints} ${width},${height} 0,${height}`;
}
