import React, { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../icons';
import { useAccessLogs, useErrorLogs } from '../../api/hooks/logs';

interface LogAnalyticsProps {
  siteId: string;
  domainId?: string;
}

interface TimeRangeOption {
  label: string;
  value: '1h' | '6h' | '24h' | '7d' | '30d';
}

const TIME_RANGES: TimeRangeOption[] = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

interface ParsedLogEntry {
  ip: string;
  method: string;
  path: string;
  status: number;
  bytes: number;
  timestamp: Date;
  referrer?: string;
  userAgent?: string;
}

interface TopUrl {
  url: string;
  hits: number;
  bandwidth: string;
  avgResponseTime: string;
}

interface StatusCodeDistribution {
  code: number;
  count: number;
  percentage: number;
  label: string;
  color: string;
}

interface HourlyPattern {
  hour: number;
  requests: number;
  errors: number;
  avgResponseTime: number;
}

interface GeoLocation {
  country: string;
  countryCode: string;
  requests: number;
  percentage: number;
  flag: string;
}

interface TopReferrer {
  referrer: string;
  hits: number;
  percentage: number;
}

interface BotInfo {
  name: string;
  hits: number;
  percentage: number;
  userAgent: string;
}

// Known bot patterns
const KNOWN_BOTS = [
  { name: 'Googlebot', pattern: /googlebot/i },
  { name: 'Bingbot', pattern: /bingbot/i },
  { name: 'Slurp', pattern: /yahoo! slurp/i },
  { name: 'DuckDuckBot', pattern: /duckduckbot/i },
  { name: 'Baiduspider', pattern: /baiduspider/i },
  { name: 'YandexBot', pattern: /yandexbot/i },
  { name: 'Sogou', pattern: /sogou/i },
  { name: 'Exabot', pattern: /exabot/i },
  { name: 'Facebook', pattern: /facebookexternalhit/i },
  { name: 'Twitter', pattern: /twitterbot/i },
  { name: 'LinkedIn', pattern: /linkedinbot/i },
  { name: 'WhatsApp', pattern: /whatsapp/i },
  { name: 'Telegram', pattern: /telegram/i },
  { name: 'Chrome-Lighthouse', pattern: /lighthouse/i },
  { name: 'Puppeteer', pattern: /puppeteer/i },
  { name: 'Python-requests', pattern: /python-requests/i },
  { name: 'curl', pattern: /curl/i },
  { name: 'Wget', pattern: /wget/i },
  { name: 'Apache-HttpClient', pattern: /apache-httpclient/i },
  { name: 'Go-http-client', pattern: /go-http-client/i },
];

// Status code categories and colors
const STATUS_CODE_CONFIG: Record<number, { label: string; color: string }> = {
  200: { label: 'OK', color: 'var(--color-text-success)' },
  201: { label: 'Created', color: 'var(--color-text-success)' },
  204: { label: 'No Content', color: 'var(--color-text-success)' },
  301: { label: 'Moved Permanently', color: 'var(--color-text-info)' },
  302: { label: 'Found', color: 'var(--color-text-info)' },
  304: { label: 'Not Modified', color: 'var(--color-text-info)' },
  400: { label: 'Bad Request', color: 'var(--color-text-warning)' },
  401: { label: 'Unauthorized', color: 'var(--color-text-warning)' },
  403: { label: 'Forbidden', color: 'var(--color-text-warning)' },
  404: { label: 'Not Found', color: 'var(--color-text-warning)' },
  405: { label: 'Method Not Allowed', color: 'var(--color-text-warning)' },
  408: { label: 'Request Timeout', color: 'var(--color-text-warning)' },
  429: { label: 'Too Many Requests', color: 'var(--color-text-warning)' },
  500: { label: 'Internal Server Error', color: 'var(--color-text-danger)' },
  501: { label: 'Not Implemented', color: 'var(--color-text-danger)' },
  502: { label: 'Bad Gateway', color: 'var(--color-text-danger)' },
  503: { label: 'Service Unavailable', color: 'var(--color-text-danger)' },
  504: { label: 'Gateway Timeout', color: 'var(--color-text-danger)' },
};

// Country code to name and flag mapping
const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  US: { name: 'United States', flag: '🇺🇸' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  FR: { name: 'France', flag: '🇫🇷' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  CN: { name: 'China', flag: '🇨🇳' },
  IN: { name: 'India', flag: '🇮🇳' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  RU: { name: 'Russia', flag: '🇷🇺' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  DK: { name: 'Denmark', flag: '🇩🇰' },
  FI: { name: 'Finland', flag: '🇫🇮' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  PL: { name: 'Poland', flag: '🇵🇱' },
  CH: { name: 'Switzerland', flag: '🇨🇭' },
  AT: { name: 'Austria', flag: '🇦🇹' },
  BE: { name: 'Belgium', flag: '🇧🇪' },
  IE: { name: 'Ireland', flag: '🇮🇪' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
  KR: { name: 'South Korea', flag: '🇰🇷' },
  HK: { name: 'Hong Kong', flag: '🇭🇰' },
  TW: { name: 'Taiwan', flag: '🇹🇼' },
  MX: { name: 'Mexico', flag: '🇲🇽' },
  AR: { name: 'Argentina', flag: '🇦🇷' },
  ZA: { name: 'South Africa', flag: '🇿🇦' },
  AE: { name: 'UAE', flag: '🇦🇪' },
  NZ: { name: 'New Zealand', flag: '🇳🇿' },
  XX: { name: 'Unknown', flag: '🌐' },
};

// Parse nginx/apache combined log format
function parseLogLine(line: string): ParsedLogEntry | null {
  // Common nginx combined log format:
  // 192.168.1.1 - - [10/Oct/2020:13:55:36 +0000] "GET /path HTTP/1.1" 200 1234 "http://referrer.com" "User-Agent"
  
  const nginxRegex = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\d+|"[^"]*")\s+"([^"]*)"\s+"([^"]*)"/;
  const match = line.match(nginxRegex);
  
  if (!match) {
    // Try apache combined log format
    const apacheRegex = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\d+|"[^"]*")\s+"([^"]*)"\s+"([^"]*)"/;
    const apacheMatch = line.match(apacheRegex);
    if (!apacheMatch) return null;
    
    const [, ip, timestampStr, method, path, status, bytes, referrer, userAgent] = apacheMatch;
    return {
      ip,
      method,
      path,
      status: parseInt(status),
      bytes: parseInt(bytes) || 0,
      timestamp: parseApacheDate(timestampStr),
      referrer: referrer !== '-' ? referrer : undefined,
      userAgent: userAgent !== '-' ? userAgent : undefined,
    };
  }
  
  const [, ip, timestampStr, method, path, status, bytes, referrer, userAgent] = match;
  return {
    ip,
    method,
    path,
    status: parseInt(status),
    bytes: parseInt(bytes) || 0,
    timestamp: parseApacheDate(timestampStr),
    referrer: referrer !== '-' ? referrer : undefined,
    userAgent: userAgent !== '-' ? userAgent : undefined,
  };
}

function parseApacheDate(dateStr: string): Date {
  // Format: 10/Oct/2020:13:55:36 +0000
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const match = dateStr.match(/(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)/);
  if (!match) return new Date();
  const [, day, month, year, hour, min, sec] = match;
  return new Date(parseInt(year), months[month], parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function identifyBot(userAgent: string): { isBot: boolean; botName?: string } {
  for (const bot of KNOWN_BOTS) {
    if (bot.pattern.test(userAgent)) {
      return { isBot: true, botName: bot.name };
    }
  }
  // Simple heuristic: if no recognized bot and looks like a bot-like UA
  if (/bot|crawl|spider|scraper|fetch/i.test(userAgent)) {
    return { isBot: true, botName: 'Unknown Bot' };
  }
  return { isBot: false };
}

// Simple IP to country heuristic (in production, use MaxMind GeoIP or similar)
function ipToCountry(ip: string): { country: string; countryCode: string; flag: string } {
  // This is a simplified mock - in production, use actual GeoIP lookup
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { ...COUNTRY_MAP.XX, country: 'Local Network', countryCode: 'XX' };
  }
  
  // Pseudo-random but deterministic based on IP for demo
  const hash = ip.split('.').reduce((acc, octet) => acc + parseInt(octet), 0);
  const countries = Object.entries(COUNTRY_MAP);
  const index = hash % countries.length;
  return { country: countries[index][1].name, countryCode: countries[index][0], flag: countries[index][1].flag };
}

// Generate mock data for demonstration
function generateMockAnalytics(lineCount: number): {
  topUrls: TopUrl[];
  statusCodes: StatusCodeDistribution[];
  hourlyPattern: HourlyPattern[];
  geoDistribution: GeoLocation[];
  topReferrers: TopReferrer[];
  bots: BotInfo[];
  totalRequests: number;
  totalErrors: number;
  totalBandwidth: string;
  humanTraffic: number;
  botTraffic: number;
} {
  const topUrls: TopUrl[] = [
    { url: '/', hits: Math.floor(lineCount * 0.25), bandwidth: '1.2 GB', avgResponseTime: '45ms' },
    { url: '/api/users', hits: Math.floor(lineCount * 0.15), bandwidth: '890 MB', avgResponseTime: '120ms' },
    { url: '/products', hits: Math.floor(lineCount * 0.12), bandwidth: '2.1 GB', avgResponseTime: '89ms' },
    { url: '/assets/main.js', hits: Math.floor(lineCount * 0.10), bandwidth: '3.4 GB', avgResponseTime: '23ms' },
    { url: '/about', hits: Math.floor(lineCount * 0.08), bandwidth: '156 MB', avgResponseTime: '34ms' },
    { url: '/contact', hits: Math.floor(lineCount * 0.06), bandwidth: '89 MB', avgResponseTime: '28ms' },
    { url: '/blog/post-1', hits: Math.floor(lineCount * 0.05), bandwidth: '234 MB', avgResponseTime: '67ms' },
    { url: '/api/products', hits: Math.floor(lineCount * 0.04), bandwidth: '567 MB', avgResponseTime: '145ms' },
    { url: '/checkout', hits: Math.floor(lineCount * 0.03), bandwidth: '123 MB', avgResponseTime: '234ms' },
    { url: '/assets/styles.css', hits: Math.floor(lineCount * 0.02), bandwidth: '456 MB', avgResponseTime: '12ms' },
  ];

  const statusCodes: StatusCodeDistribution[] = [
    { code: 200, count: Math.floor(lineCount * 0.72), percentage: 72, label: 'OK', color: 'var(--color-text-success)' },
    { code: 301, count: Math.floor(lineCount * 0.08), percentage: 8, label: 'Redirect', color: 'var(--color-text-info)' },
    { code: 304, count: Math.floor(lineCount * 0.05), percentage: 5, label: 'Not Modified', color: 'var(--color-text-info)' },
    { code: 404, count: Math.floor(lineCount * 0.06), percentage: 6, label: 'Not Found', color: 'var(--color-text-warning)' },
    { code: 500, count: Math.floor(lineCount * 0.02), percentage: 2, label: 'Server Error', color: 'var(--color-text-danger)' },
    { code: 502, count: Math.floor(lineCount * 0.01), percentage: 1, label: 'Bad Gateway', color: 'var(--color-text-danger)' },
    { code: 429, count: Math.floor(lineCount * 0.03), percentage: 3, label: 'Rate Limited', color: 'var(--color-text-warning)' },
    { code: 403, count: Math.floor(lineCount * 0.02), percentage: 2, label: 'Forbidden', color: 'var(--color-text-warning)' },
  ];

  const hourlyPattern: HourlyPattern[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    requests: Math.floor(Math.random() * 5000) + 1000,
    errors: Math.floor(Math.random() * 50) + 5,
    avgResponseTime: Math.floor(Math.random() * 100) + 20,
  }));

  const geoDistribution: GeoLocation[] = [
    { country: 'United States', countryCode: 'US', requests: Math.floor(lineCount * 0.35), percentage: 35, flag: '🇺🇸' },
    { country: 'Germany', countryCode: 'DE', requests: Math.floor(lineCount * 0.15), percentage: 15, flag: '🇩🇪' },
    { country: 'United Kingdom', countryCode: 'GB', requests: Math.floor(lineCount * 0.12), percentage: 12, flag: '🇬🇧' },
    { country: 'Canada', countryCode: 'CA', requests: Math.floor(lineCount * 0.10), percentage: 10, flag: '🇨🇦' },
    { country: 'France', countryCode: 'FR', requests: Math.floor(lineCount * 0.08), percentage: 8, flag: '🇫🇷' },
    { country: 'Other', countryCode: 'XX', requests: Math.floor(lineCount * 0.20), percentage: 20, flag: '🌐' },
  ];

  const topReferrers: TopReferrer[] = [
    { referrer: 'https://www.google.com', hits: Math.floor(lineCount * 0.25), percentage: 45 },
    { referrer: 'https://www.bing.com', hits: Math.floor(lineCount * 0.08), percentage: 14 },
    { referrer: '(direct)', hits: Math.floor(lineCount * 0.12), percentage: 22 },
    { referrer: 'https://twitter.com', hits: Math.floor(lineCount * 0.05), percentage: 9 },
    { referrer: 'https://github.com', hits: Math.floor(lineCount * 0.04), percentage: 7 },
  ];

  const bots: BotInfo[] = [
    { name: 'Googlebot', hits: Math.floor(lineCount * 0.08), percentage: 30, userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    { name: 'Bingbot', hits: Math.floor(lineCount * 0.04), percentage: 15, userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
    { name: 'Unknown Bot', hits: Math.floor(lineCount * 0.03), percentage: 11, userAgent: 'Mozilla/5.0 (compatible; Bot/0.1)' },
    { name: 'Chrome-Lighthouse', hits: Math.floor(lineCount * 0.02), percentage: 7, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/Lighthouse' },
    { name: 'curl', hits: Math.floor(lineCount * 0.02), percentage: 7, userAgent: 'curl/7.68.0' },
  ];

  return {
    topUrls,
    statusCodes,
    hourlyPattern,
    geoDistribution,
    topReferrers,
    bots,
    totalRequests: lineCount,
    totalErrors: Math.floor(lineCount * 0.04),
    totalBandwidth: formatBytes(lineCount * 45000),
    humanTraffic: Math.floor(lineCount * 0.85),
    botTraffic: Math.floor(lineCount * 0.15),
  };
}

// SVG Bar Chart Component
interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  horizontal?: boolean;
}

function BarChart({ data, maxValue, height = 200, horizontal = false }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);
  
  if (horizontal) {
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-20 text-small text-foreground-secondary truncate">{item.label}</div>
            <div className="flex-1 h-6 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color || 'var(--color-text-info)' }}
              />
            </div>
            <div className="w-16 text-small text-right font-medium">{formatNumber(item.value)}</div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full bg-background-tertiary rounded-t relative" style={{ height: `${(item.value / max) * 100}%`, minHeight: 4 }}>
            <div
              className="absolute inset-0 rounded-t transition-all duration-300"
              style={{ backgroundColor: item.color || 'var(--color-text-info)' }}
            />
          </div>
          <div className="text-meta text-foreground-tertiary text-xs truncate w-full text-center">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// Status Code Pie Chart Component
interface PieChartProps {
  data: StatusCodeDistribution[];
  size?: number;
}

function PieChart({ data, size = 160 }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  let currentAngle = 0;
  
  const paths = data.map((item) => {
    const angle = (item.count / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    
    if (angle <= 0) return null;
    
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (startAngle + angle - 90) * (Math.PI / 180);
    
    const x1 = size / 2 + (size / 2 - 2) * Math.cos(startRad);
    const y1 = size / 2 + (size / 2 - 2) * Math.sin(startRad);
    const x2 = size / 2 + (size / 2 - 2) * Math.cos(endRad);
    const y2 = size / 2 + (size / 2 - 2) * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    if (angle >= 360) {
      return (
        <circle
          key={item.code}
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 2}
          fill={item.color}
          stroke="var(--color-background-primary)"
          strokeWidth="2"
        />
      );
    }
    
    return (
      <path
        key={item.code}
        d={`M ${size / 2} ${size / 2} L ${x1} ${y1} A ${size / 2 - 2} ${size / 2 - 2} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={item.color}
        stroke="var(--color-background-primary)"
        strokeWidth="2"
      />
    );
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
      </svg>
      <div className="space-y-1">
        {data.slice(0, 5).map((item) => (
          <div key={item.code} className="flex items-center gap-2 text-small">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-foreground-secondary">{item.code} {item.label}</span>
            <span className="text-foreground-tertiary">({item.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hourly Heatmap Component
interface HeatmapProps {
  data: HourlyPattern[];
  metric: 'requests' | 'errors';
}

function HourlyHeatmap({ data, metric }: HeatmapProps) {
  const max = Math.max(...data.map(d => d[metric]), 1);
  
  return (
    <div className="grid grid-cols-12 gap-1">
      {data.map((item) => {
        const intensity = item[metric] / max;
        return (
          <div
            key={item.hour}
            className="aspect-square rounded flex items-center justify-center text-xs relative group cursor-default"
            style={{
              backgroundColor: metric === 'requests' 
                ? `rgba(var(--color-text-info-rgb, 59, 130, 246), ${0.2 + intensity * 0.8})`
                : `rgba(var(--color-text-danger-rgb, 239, 68, 68), ${0.2 + intensity * 0.8})`,
            }}
            title={`${item.hour}:00 - ${metric}: ${formatNumber(item[metric])}`}
          >
            <span className="text-foreground-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
              {item.hour}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LogAnalytics({ siteId, domainId }: LogAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [activeSection, setActiveSection] = useState<'urls' | 'status' | 'hourly' | 'geo' | 'referrers' | 'bots'>('urls');
  
  // Calculate lines based on time range
  const lineConfig = useMemo(() => {
    switch (timeRange) {
      case '1h': return 1000;
      case '6h': return 5000;
      case '24h': return 20000;
      case '7d': return 100000;
      case '30d': return 500000;
    }
  }, [timeRange]);
  
  const lines = Math.min(lineConfig, 10000); // Cap at 10k for performance
  
  const { data: accessLogData, isLoading: accessLoading } = useAccessLogs(domainId, lines);
  const { data: errorLogData, isLoading: errorLoading } = useErrorLogs(domainId, lines);
  
  // Parse access logs
  const parsedLogs = useMemo(() => {
    if (!accessLogData?.log) return [];
    const lines = accessLogData.log.split('\n').filter(Boolean);
    return lines.map(parseLogLine).filter(Boolean) as ParsedLogEntry[];
  }, [accessLogData]);
  
  // Calculate analytics from parsed logs or use mock data
  const analytics = useMemo(() => {
    if (parsedLogs.length > 0) {
      // Real data processing
      const urlMap = new Map<string, { hits: number; bandwidth: number; responseTimes: number[] }>();
      const statusMap = new Map<number, number>();
      const hourlyMap = new Map<number, { requests: number; errors: number; responseTimes: number[] }>();
      const ipMap = new Map<string, number>();
      const referrerMap = new Map<string, number>();
      const botMap = new Map<string, { hits: number; userAgent: string }>();
      let totalBandwidth = 0;
      let humanTraffic = 0;
      let botTraffic = 0;
      
      parsedLogs.forEach(log => {
        // URL stats
        const urlStats = urlMap.get(log.path) || { hits: 0, bandwidth: 0, responseTimes: [] };
        urlStats.hits++;
        urlStats.bandwidth += log.bytes;
        urlMap.set(log.path, urlStats);
        totalBandwidth += log.bytes;
        
        // Status code stats
        statusMap.set(log.status, (statusMap.get(log.status) || 0) + 1);
        
        // Hourly pattern
        const hour = log.timestamp.getHours();
        const hourlyStats = hourlyMap.get(hour) || { requests: 0, errors: 0, responseTimes: [] };
        hourlyStats.requests++;
        if (log.status >= 400) hourlyStats.errors++;
        hourlyMap.set(hour, hourlyStats);
        
        // Geo distribution (based on IP)
        ipMap.set(log.ip, (ipMap.get(log.ip) || 0) + 1);
        
        // Referrers
        if (log.referrer) {
          referrerMap.set(log.referrer, (referrerMap.get(log.referrer) || 0) + 1);
        }
        
        // Bot detection
        if (log.userAgent) {
          const { isBot, botName } = identifyBot(log.userAgent);
          if (isBot) {
            const key = botName || 'Unknown Bot';
            const botStats = botMap.get(key) || { hits: 0, userAgent: log.userAgent };
            botStats.hits++;
            botMap.set(key, botStats);
            botTraffic++;
          } else {
            humanTraffic++;
          }
        } else {
          humanTraffic++;
        }
      });
      
      // Transform to output format
      const totalRequests = parsedLogs.length;
      const totalErrors = Array.from(statusMap.entries())
        .filter(([code]) => code >= 400)
        .reduce((sum, [, count]) => sum + count, 0);
      
      const topUrls: TopUrl[] = Array.from(urlMap.entries())
        .sort((a, b) => b[1].hits - a[1].hits)
        .slice(0, 10)
        .map(([url, stats]) => ({
          url,
          hits: stats.hits,
          bandwidth: formatBytes(stats.bandwidth),
          avgResponseTime: stats.responseTimes.length > 0
            ? `${Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)}ms`
            : 'N/A',
        }));
      
      const statusCodes: StatusCodeDistribution[] = Array.from(statusMap.entries())
        .map(([code, count]) => ({
          code,
          count,
          percentage: Math.round((count / totalRequests) * 100),
          label: STATUS_CODE_CONFIG[code]?.label || 'Unknown',
          color: STATUS_CODE_CONFIG[code]?.color || 'var(--color-text-info)',
        }))
        .sort((a, b) => b.count - a.count);
      
      const hourlyPattern: HourlyPattern[] = Array.from({ length: 24 }, (_, hour) => {
        const stats = hourlyMap.get(hour) || { requests: 0, errors: 0, responseTimes: [] };
        return {
          hour,
          requests: stats.requests,
          errors: stats.errors,
          avgResponseTime: stats.responseTimes.length > 0
            ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
            : 0,
        };
      });
      
      const geoDistribution: GeoLocation[] = Array.from(ipMap.entries())
        .slice(0, 6)
        .map(([ip, requests]) => {
          const geo = ipToCountry(ip);
          return { ...geo, requests, percentage: Math.round((requests / totalRequests) * 100) };
        })
        .sort((a, b) => b.requests - a.requests);
      
      const topReferrers: TopReferrer[] = Array.from(referrerMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([referrer, hits]) => ({
          referrer,
          hits,
          percentage: Math.round((hits / totalRequests) * 100),
        }));
      
      const bots: BotInfo[] = Array.from(botMap.entries())
        .sort((a, b) => b[1].hits - a[1].hits)
        .slice(0, 5)
        .map(([name, stats]) => ({
          name,
          hits: stats.hits,
          percentage: Math.round((stats.hits / totalRequests) * 100),
          userAgent: stats.userAgent,
        }));
      
      return {
        topUrls,
        statusCodes,
        hourlyPattern,
        geoDistribution,
        topReferrers,
        bots,
        totalRequests,
        totalErrors,
        totalBandwidth: formatBytes(totalBandwidth),
        humanTraffic,
        botTraffic,
      };
    }
    
    // Return mock data when no real logs available
    return generateMockAnalytics(lines);
  }, [parsedLogs, lines]);
  
  const isLoading = accessLoading || errorLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-page-title font-medium">Log Analytics</h3>
          <span className="text-small text-foreground-tertiary">
            {formatNumber(analytics.totalRequests)} requests
          </span>
        </div>
        <div className="flex gap-4">
          {/* Time Range Selector */}
          <div className="flex gap-1 bg-background-tertiary rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 text-small rounded-md transition-colors ${
                  timeRange === range.value
                    ? 'bg-foreground-primary text-background-primary'
                    : 'text-foreground-secondary hover:text-foreground-primary'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-background-secondary">
          <div className="text-small text-foreground-secondary mb-1">Total Requests</div>
          <div className="text-[24px] font-medium font-mono">{formatNumber(analytics.totalRequests)}</div>
          <div className="text-meta text-foreground-tertiary mt-1">
            {formatNumber(analytics.totalErrors)} errors ({analytics.totalErrors > 0 ? Math.round((analytics.totalErrors / analytics.totalRequests) * 100) : 0}%)
          </div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-small text-foreground-secondary mb-1">Bandwidth</div>
          <div className="text-[24px] font-medium font-mono">{analytics.totalBandwidth}</div>
          <div className="text-meta text-foreground-tertiary mt-1">
            {formatNumber(Math.round(analytics.totalRequests / (timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720)))} req/hr avg
          </div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-small text-foreground-secondary mb-1">Human Traffic</div>
          <div className="text-[24px] font-medium font-mono text-foreground-success">
            {formatNumber(analytics.humanTraffic)}
          </div>
          <div className="text-meta text-foreground-tertiary mt-1">
            {Math.round((analytics.humanTraffic / analytics.totalRequests) * 100)}% of total
          </div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-small text-foreground-secondary mb-1">Bot Traffic</div>
          <div className="text-[24px] font-medium font-mono text-foreground-warning">
            {formatNumber(analytics.botTraffic)}
          </div>
          <div className="text-meta text-foreground-tertiary mt-1">
            {Math.round((analytics.botTraffic / analytics.totalRequests) * 100)}% of total
          </div>
        </Card>
      </div>
      
      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-border-tertiary">
        {[
          { id: 'urls', label: 'Top URLs' },
          { id: 'status', label: 'Status Codes' },
          { id: 'hourly', label: 'Hourly Pattern' },
          { id: 'geo', label: 'Geography' },
          { id: 'referrers', label: 'Referrers' },
          { id: 'bots', label: 'Bots' },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
            className={`px-4 py-2 text-small border-b-2 transition-colors ${
              activeSection === section.id
                ? 'border-foreground-primary text-foreground-primary'
                : 'border-transparent text-foreground-secondary hover:text-foreground-primary'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
      
      {/* Content Sections */}
      {isLoading ? (
        <Card className="bg-background-secondary">
          <div className="flex items-center justify-center h-64">
            <Icon name="icon-refresh" size={24} className="animate-spin text-foreground-tertiary" />
            <span className="ml-2 text-foreground-secondary">Loading analytics...</span>
          </div>
        </Card>
      ) : (
        <>
          {/* Top URLs */}
          {activeSection === 'urls' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Top 10 URLs by Traffic" className="bg-background-secondary" action={
                <span className="text-meta text-foreground-tertiary">{analytics.topUrls.length} URLs</span>
              }>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analytics.topUrls.map((url, index) => (
                    <div key={url.url} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-meta text-foreground-tertiary w-5">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-small font-mono truncate" title={url.url}>{url.url}</div>
                          <div className="text-meta text-foreground-tertiary">{url.avgResponseTime} avg</div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-small font-medium">{formatNumber(url.hits)}</div>
                        <div className="text-meta text-foreground-tertiary">{url.bandwidth}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="URL Distribution" className="bg-background-secondary">
                <div className="h-64">
                  <BarChart
                    data={analytics.topUrls.slice(0, 8).map((url, i) => ({
                      label: url.url.length > 15 ? url.url.slice(0, 15) + '...' : url.url,
                      value: url.hits,
                      color: `hsl(${200 + i * 15}, 70%, 50%)`,
                    }))}
                    horizontal
                  />
                </div>
              </Card>
            </div>
          )}
          
          {/* Status Codes */}
          {activeSection === 'status' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Status Code Distribution" className="bg-background-secondary">
                <div className="flex items-center justify-center py-4">
                  <PieChart data={analytics.statusCodes} size={180} />
                </div>
              </Card>
              <Card title="Status Code Breakdown" className="bg-background-secondary">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {analytics.statusCodes.map((status) => (
                    <div key={status.code} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-small font-mono font-medium" style={{ color: status.color }}>
                          {status.code}
                        </span>
                        <span className="text-small text-foreground-secondary">{status.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-2 bg-background-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${status.percentage}%`, backgroundColor: status.color }}
                          />
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-small font-medium">{formatNumber(status.count)}</span>
                          <span className="text-meta text-foreground-tertiary ml-1">({status.percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          
          {/* Hourly Pattern */}
          {activeSection === 'hourly' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Requests by Hour" className="bg-background-secondary">
                <div className="mb-4">
                  <HourlyHeatmap data={analytics.hourlyPattern} metric="requests" />
                </div>
                <div className="flex justify-between text-meta text-foreground-tertiary">
                  <span>12AM</span>
                  <span>6AM</span>
                  <span>12PM</span>
                  <span>6PM</span>
                  <span>11PM</span>
                </div>
              </Card>
              <Card title="Errors by Hour" className="bg-background-secondary">
                <div className="mb-4">
                  <HourlyHeatmap data={analytics.hourlyPattern} metric="errors" />
                </div>
                <div className="flex justify-between text-meta text-foreground-tertiary">
                  <span>12AM</span>
                  <span>6AM</span>
                  <span>12PM</span>
                  <span>6PM</span>
                  <span>11PM</span>
                </div>
              </Card>
            </div>
          )}
          
          {/* Geographic Distribution */}
          {activeSection === 'geo' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Geographic Distribution" className="bg-background-secondary">
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {analytics.geoDistribution.map((geo) => (
                    <div key={geo.countryCode}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{geo.flag}</span>
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
              <Card title="Top Countries" className="bg-background-secondary">
                <div className="h-80">
                  <BarChart
                    data={analytics.geoDistribution.slice(0, 6).map((geo) => ({
                      label: geo.countryCode,
                      value: geo.requests,
                      color: 'var(--color-text-info)',
                    }))}
                    horizontal
                  />
                </div>
              </Card>
            </div>
          )}
          
          {/* Referrers */}
          {activeSection === 'referrers' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Top Referrers" className="bg-background-secondary">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analytics.topReferrers.map((ref, index) => (
                    <div key={ref.referrer} className="flex items-center justify-between py-2 border-b border-border-tertiary last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-meta text-foreground-tertiary w-5">{index + 1}</span>
                        <span className="text-small font-mono truncate" title={ref.referrer}>
                          {ref.referrer}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="w-20 h-2 bg-background-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground-info rounded-full"
                            style={{ width: `${ref.percentage}%` }}
                          />
                        </div>
                        <div className="text-right w-20">
                          <span className="text-small font-medium">{formatNumber(ref.hits)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Traffic Sources" className="bg-background-secondary">
                <div className="flex items-center justify-center py-8">
                  <PieChart
                    data={[
                      { code: 1, count: analytics.topReferrers[0]?.hits || 0, percentage: analytics.topReferrers[0]?.percentage || 0, label: 'Google', color: 'var(--color-text-info)' },
                      { code: 2, count: analytics.topReferrers[1]?.hits || 0, percentage: analytics.topReferrers[1]?.percentage || 0, label: 'Bing', color: 'var(--color-text-success)' },
                      { code: 3, count: analytics.topReferrers[2]?.hits || 0, percentage: analytics.topReferrers[2]?.percentage || 0, label: 'Direct', color: 'var(--color-text-warning)' },
                      { code: 4, count: (analytics.topReferrers[3]?.hits || 0) + (analytics.topReferrers[4]?.hits || 0), percentage: (analytics.topReferrers[3]?.percentage || 0) + (analytics.topReferrers[4]?.percentage || 0), label: 'Other', color: 'var(--color-text-danger)' },
                    ]}
                    size={160}
                  />
                </div>
              </Card>
            </div>
          )}
          
          {/* Bots */}
          {activeSection === 'bots' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Detected Bots & Crawlers" className="bg-background-secondary">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {analytics.bots.map((bot) => (
                    <div key={bot.name} className="p-3 bg-background-tertiary rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon name="icon-world" size={16} className="text-foreground-info" />
                          <span className="text-small font-medium">{bot.name}</span>
                        </div>
                        <span className="text-small font-medium">{formatNumber(bot.hits)}</span>
                      </div>
                      <div className="text-meta text-foreground-tertiary truncate mb-2" title={bot.userAgent}>
                        {bot.userAgent}
                      </div>
                      <div className="h-1.5 bg-background-primary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground-warning rounded-full"
                          style={{ width: `${bot.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Bot vs Human Traffic" className="bg-background-secondary">
                <div className="flex items-center justify-center py-8">
                  <PieChart
                    data={[
                      { code: 1, count: analytics.humanTraffic, percentage: Math.round((analytics.humanTraffic / analytics.totalRequests) * 100), label: 'Human', color: 'var(--color-text-success)' },
                      { code: 2, count: analytics.botTraffic, percentage: Math.round((analytics.botTraffic / analytics.totalRequests) * 100), label: 'Bot', color: 'var(--color-text-warning)' },
                    ]}
                    size={180}
                  />
                </div>
                <div className="mt-4 text-center text-small text-foreground-secondary">
                  {Math.round((analytics.botTraffic / analytics.totalRequests) * 100)}% of traffic is from bots and crawlers
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
