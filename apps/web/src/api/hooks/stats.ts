import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; available: number; cached: number; buffered: number; swapTotal: number; swapUsed: number; usagePercent: number };
  disk: { total: number; used: number; available: number; usagePercent: number; mount: string };
  uptime: number;
  loadAvg: number[];
  system: { hostname: string; os: string; kernel: string; arch: string; ips: string[] };
}

export interface ServiceStatusItem {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'error';
}

export interface DashboardSummary {
  totalDomains: number;
  activeDomains: number;
  suspendedDomains: number;
  sslEnabledDomains: number;
  totalMailboxes: number;
  totalDatabases: number;
  totalFtpAccounts: number;
  totalActiveCronJobs: number;
  expiringSslCerts: number;
}

export interface NetworkStats {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxSec: number;
  txSec: number;
}

export interface DiskMount {
  fs: string;
  mount: string;
  total: number;
  used: number;
  available: number;
  usagePercent: number;
}

export interface ExpiringSslCert {
  id: string;
  domainId: string;
  domainName: string;
  issuer: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  state: string;
}

export interface DomainStats {
  domainId: string;
  domainName: string;
  diskUsedMb: number;
  status: string;
  sslEnabled: boolean;
  phpVersion: string;
}

export interface HistoricalDataPoint {
  timestamp: number;
  value: number;
}

export interface HistoricalData {
  cpu: HistoricalDataPoint[];
  memoryUsed: HistoricalDataPoint[];
  memoryTotal: HistoricalDataPoint[];
  networkRx: HistoricalDataPoint[];
  networkTx: HistoricalDataPoint[];
  diskRead: HistoricalDataPoint[];
  diskWrite: HistoricalDataPoint[];
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface AlertThresholds {
  cpuWarning: number;
  cpuCritical: number;
  ramWarning: number;
  ramCritical: number;
  diskWarning: number;
  diskCritical: number;
  enabled: boolean;
}

export function useServerStats() {
  return useQuery({
    queryKey: ['stats', 'server'],
    queryFn: () => api.get<ServerStats>('/stats/server'),
    refetchInterval: 30_000,
  });
}

export function useServiceStatuses() {
  return useQuery({
    queryKey: ['stats', 'services'],
    queryFn: () => api.get<ServiceStatusItem[]>('/stats/services'),
    refetchInterval: 60_000,
  });
}

export function useRestartService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceName: string) =>
      api.post<{ success: boolean; log?: string }>(`/stats/services/${serviceName}/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats', 'services'] });
    },
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/stats/summary'),
    refetchInterval: 30_000,
  });
}

export function useNetworkStats() {
  return useQuery({
    queryKey: ['stats', 'network'],
    queryFn: () => api.get<NetworkStats>('/stats/network'),
    refetchInterval: 10_000,
  });
}

export function useDiskDetails() {
  return useQuery({
    queryKey: ['stats', 'disk'],
    queryFn: () => api.get<DiskMount[]>('/stats/disk'),
    refetchInterval: 60_000,
  });
}

export function useExpiringSslCerts() {
  return useQuery({
    queryKey: ['stats', 'expiring-ssl'],
    queryFn: () => api.get<ExpiringSslCert[]>('/stats/expiring-ssl'),
    refetchInterval: 5 * 60_000,
  });
}

export function useProcesses(sortBy: 'cpu' | 'memory' = 'cpu', limit: number = 10) {
  return useQuery({
    queryKey: ['stats', 'processes', sortBy, limit],
    queryFn: () => api.get<ProcessInfo[]>(`/stats/processes?sortBy=${sortBy}&limit=${limit}`),
    refetchInterval: 30_000,
  });
}

export function useDomainStats(domainId: string) {
  return useQuery({
    queryKey: ['stats', 'domains', domainId],
    queryFn: () => api.get<DomainStats>(`/stats/domains/${domainId}`),
    enabled: !!domainId,
    refetchInterval: 60_000,
  });
}

// --- Disk I/O ---

export interface DiskIOStats {
  readBytesSec: number;
  writeBytesSec: number;
  readOpsSec: number;
  writeOpsSec: number;
}

export function useDiskIO() {
  return useQuery({
    queryKey: ['stats', 'disk-io'],
    queryFn: () => api.get<DiskIOStats>('/stats/disk-io'),
    refetchInterval: 10_000,
  });
}

// --- Per-Domain Bandwidth ---

export interface DomainBandwidthStats {
  domainId: string;
  domainName: string;
  incomingBytes: number;
  outgoingBytes: number;
  totalBytes: number;
}

export function useAllDomainBandwidth() {
  return useQuery({
    queryKey: ['stats', 'domain-bandwidth'],
    queryFn: () => api.get<DomainBandwidthStats[]>('/stats/domain-bandwidth'),
    refetchInterval: 60_000,
  });
}

// --- Open File Descriptors ---

export interface FdStats {
  openFd: number;
  maxFd: number;
  usagePercent: number;
}

export function useFdStats() {
  return useQuery({
    queryKey: ['stats', 'fd'],
    queryFn: () => api.get<FdStats>('/stats/fd'),
    refetchInterval: 30_000,
  });
}

// --- TCP Connections ---

export interface TcpConnectionStats {
  established: number;
  timeWait: number;
  closeWait: number;
  total: number;
}

export function useTcpConnections() {
  return useQuery({
    queryKey: ['stats', 'tcp-connections'],
    queryFn: () => api.get<TcpConnectionStats>('/stats/tcp-connections'),
    refetchInterval: 30_000,
  });
}
