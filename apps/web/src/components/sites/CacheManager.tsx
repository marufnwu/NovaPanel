import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { PageSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { api } from '../../api/client';
import { toast } from '../../lib/toast';
import { Icon } from '../icons';

interface CacheManagerProps {
  siteId: string;
  siteName: string;
  domainId?: string;
}

type CacheType = 'opcache' | 'redis' | 'memcached';
type TabId = 'overview' | 'opcache' | 'redis' | 'memcached' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'opcache', label: 'OPcache' },
  { id: 'redis', label: 'Redis' },
  { id: 'memcached', label: 'Memcached' },
  { id: 'settings', label: 'Settings' },
];

// Cache types configuration
const CACHE_TYPES: { id: CacheType; label: string; icon: 'icon-box' | 'icon-database' | 'icon-server' }[] = [
  { id: 'opcache', label: 'OPcache', icon: 'icon-box' },
  { id: 'redis', label: 'Redis', icon: 'icon-database' },
  { id: 'memcached', label: 'Memcached', icon: 'icon-server' },
];

// Eviction policies for Redis
const REDIS_EVICTION_POLICIES = [
  { value: 'volatile-lru', label: 'volatile-lru' },
  { value: 'allkeys-lru', label: 'allkeys-lru' },
  { value: 'volatile-lfu', label: 'volatile-lfu' },
  { value: 'allkeys-lfu', label: 'allkeys-lfu' },
  { value: 'volatile-random', label: 'volatile-random' },
  { value: 'allkeys-random', label: 'allkeys-random' },
  { value: 'noeviction', label: 'noeviction' },
];

// Cache warming presets
const WARMING_PRESETS = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'top-pages', label: 'Top 10 Pages' },
  { value: 'all-pages', label: 'All Pages' },
  { value: 'custom', label: 'Custom URLs' },
];

// Types
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsed: number;
  memoryMax: number;
  keysCount: number;
  uptime: number;
  lastCleared: string | null;
}

interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxMemory: string;
  evictionPolicy: string;
  persistent: boolean;
  compress: boolean;
}

interface CacheStatus {
  connected: boolean;
  version: string | null;
  status: 'running' | 'stopped' | 'unknown';
}

interface CacheHistoryPoint {
  timestamp: number;
  hitRate: number;
  memory: number;
  hits: number;
  misses: number;
}

export interface SiteCacheData {
  opcache: {
    status: CacheStatus;
    stats: CacheStats;
    config: CacheConfig;
  };
  redis: {
    status: CacheStatus;
    stats: CacheStats;
    config: CacheConfig;
  };
  memcached: {
    status: CacheStatus;
    stats: CacheStats;
    config: CacheConfig;
  };
}

// API Functions
async function fetchCacheStats(siteId: string, type: CacheType): Promise<CacheStats> {
  const response = await api.get<CacheStats>(`/sites/${siteId}/cache/${type}/stats`);
  return response;
}

async function fetchCacheStatus(siteId: string, type: CacheType): Promise<CacheStatus> {
  const response = await api.get<CacheStatus>(`/sites/${siteId}/cache/${type}/status`);
  return response;
}

async function fetchCacheConfig(siteId: string, type: CacheType): Promise<CacheConfig> {
  const response = await api.get<CacheConfig>(`/sites/${siteId}/cache/${type}/config`);
  return response;
}

async function fetchAllCacheData(siteId: string): Promise<SiteCacheData> {
  const response = await api.get<SiteCacheData>(`/sites/${siteId}/cache`);
  return response;
}

async function purgeCache(siteId: string, type: CacheType): Promise<void> {
  await api.post(`/sites/${siteId}/cache/${type}/purge`);
}

async function warmCache(siteId: string, type: CacheType, preset: string, customUrls?: string[]): Promise<void> {
  await api.post(`/sites/${siteId}/cache/${type}/warm`, { preset, urls: customUrls });
}

async function updateCacheConfig(siteId: string, type: CacheType, config: Partial<CacheConfig>): Promise<void> {
  await api.put(`/sites/${siteId}/cache/${type}/config`, config);
}

async function toggleCache(siteId: string, type: CacheType, enabled: boolean): Promise<void> {
  await api.post(`/sites/${siteId}/cache/${type}/${enabled ? 'enable' : 'disable'}`);
}

// Hooks
export function useSiteCacheData(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId, 'cache'],
    queryFn: () => fetchAllCacheData(siteId),
    enabled: !!siteId,
    refetchInterval: 30000,
  });
}

export function useCacheStats(siteId: string, type: CacheType) {
  return useQuery({
    queryKey: ['sites', siteId, 'cache', type, 'stats'],
    queryFn: () => fetchCacheStats(siteId, type),
    enabled: !!siteId,
    refetchInterval: 10000,
  });
}

export function useCacheStatus(siteId: string, type: CacheType) {
  return useQuery({
    queryKey: ['sites', siteId, 'cache', type, 'status'],
    queryFn: () => fetchCacheStatus(siteId, type),
    enabled: !!siteId,
    refetchInterval: 5000,
  });
}

export function useCacheConfig(siteId: string, type: CacheType) {
  return useQuery({
    queryKey: ['sites', siteId, 'cache', type, 'config'],
    queryFn: () => fetchCacheConfig(siteId, type),
    enabled: !!siteId,
  });
}

export function usePurgeCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, type }: { siteId: string; type: CacheType }) => purgeCache(siteId, type),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'cache'] });
      toast.success(`${variables.type} cache purged successfully`);
    },
    onError: (err: any, variables) => {
      toast.error(`Failed to purge ${variables.type} cache: ${err.message}`);
    },
  });
}

export function useWarmCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, type, preset, customUrls }: { siteId: string; type: CacheType; preset: string; customUrls?: string[] }) =>
      warmCache(siteId, type, preset, customUrls),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'cache'] });
      toast.success(`${variables.type} cache warming started`);
    },
    onError: (err: any, variables) => {
      toast.error(`Failed to warm ${variables.type} cache: ${err.message}`);
    },
  });
}

export function useUpdateCacheConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, type, config }: { siteId: string; type: CacheType; config: Partial<CacheConfig> }) =>
      updateCacheConfig(siteId, type, config),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'cache'] });
      toast.success('Cache configuration updated');
    },
    onError: (err: any, variables) => {
      toast.error(`Failed to update ${variables.type} cache config: ${err.message}`);
    },
  });
}

export function useToggleCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, type, enabled }: { siteId: string; type: CacheType; enabled: boolean }) =>
      toggleCache(siteId, type, enabled),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sites', variables.siteId, 'cache'] });
      toast.success(`${variables.type} cache ${variables.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (err: any, variables) => {
      toast.error(`Failed to ${variables.enabled ? 'enable' : 'disable'} ${variables.type} cache: ${err.message}`);
    },
  });
}

// Main Component
export function CacheManager({ siteId, siteName, domainId }: CacheManagerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [purgeTarget, setPurgeTarget] = useState<CacheType | null>(null);
  const [warmTarget, setWarmTarget] = useState<CacheType | null>(null);
  const [warmPreset, setWarmPreset] = useState<string>('homepage');
  const [customUrls, setCustomUrls] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<CacheType | null>(null);

  // Fetch cache data
  const { data: cacheData, isLoading, isError, error, refetch } = useSiteCacheData(siteId);

  // Mutations
  const purgeCache = usePurgeCache();
  const warmCache = useWarmCache();
  const updateConfig = useUpdateCacheConfig();
  const toggleCache = useToggleCache();

  // Generate mock data for demo (when API not available)
  const mockCacheData: SiteCacheData = useMemo(() => ({
    opcache: {
      status: { connected: true, version: '8.2.0', status: 'running' },
      stats: {
        hits: 125430,
        misses: 3210,
        hitRate: 97.5,
        memoryUsed: 64 * 1024 * 1024,
        memoryMax: 128 * 1024 * 1024,
        keysCount: 0,
        uptime: 86400,
        lastCleared: null,
      },
      config: { enabled: true, ttl: 3600, maxMemory: '128M', evictionPolicy: 'noeviction', persistent: true, compress: false },
    },
    redis: {
      status: { connected: true, version: '7.0.0', status: 'running' },
      stats: {
        hits: 892340,
        misses: 12450,
        hitRate: 98.6,
        memoryUsed: 256 * 1024 * 1024,
        memoryMax: 512 * 1024 * 1024,
        keysCount: 15432,
        uptime: 259200,
        lastCleared: '2026-05-24T10:00:00Z',
      },
      config: { enabled: true, ttl: 7200, maxMemory: '512M', evictionPolicy: 'volatile-lru', persistent: true, compress: true },
    },
    memcached: {
      status: { connected: true, version: '1.6.0', status: 'running' },
      stats: {
        hits: 456780,
        misses: 8900,
        hitRate: 98.1,
        memoryUsed: 512 * 1024 * 1024,
        memoryMax: 1024 * 1024 * 1024,
        keysCount: 28934,
        uptime: 172800,
        lastCleared: '2026-05-23T15:30:00Z',
      },
      config: { enabled: true, ttl: 3600, maxMemory: '1G', evictionPolicy: 'LRU', persistent: false, compress: true },
    },
  }), []);

  const displayData = cacheData || mockCacheData;

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (!displayData) return null;
    const { opcache, redis, memcached } = displayData;
    return {
      totalHits: opcache.stats.hits + redis.stats.hits + memcached.stats.hits,
      totalMisses: opcache.stats.misses + redis.stats.misses + memcached.stats.misses,
      avgHitRate: (opcache.stats.hitRate + redis.stats.hitRate + memcached.stats.hitRate) / 3,
      memoryUsed: opcache.stats.memoryUsed + redis.stats.memoryUsed + memcached.stats.memoryUsed,
      memoryMax: opcache.stats.memoryMax + redis.stats.memoryMax + memcached.stats.memoryMax,
      activeCaches: [opcache, redis, memcached].filter(c => c.status.connected).length,
    };
  }, [displayData]);

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Handle purge
  const handlePurge = (type: CacheType) => {
    purgeCache.mutate({ siteId, type });
    setPurgeTarget(null);
  };

  // Handle warm
  const handleWarm = () => {
    if (!warmTarget) return;
    const urls = warmPreset === 'custom' ? customUrls.split('\n').filter(u => u.trim()) : undefined;
    warmCache.mutate({ siteId, type: warmTarget, preset: warmPreset, customUrls: urls });
    setWarmTarget(null);
    setCustomUrls('');
  };

  // Handle toggle
  const handleToggle = (type: CacheType, enabled: boolean) => {
    toggleCache.mutate({ siteId, type, enabled });
  };

  // Handle config save
  const handleConfigSave = (type: CacheType, config: Partial<CacheConfig>) => {
    updateConfig.mutate({ siteId, type, config });
    setShowConfigModal(null);
  };

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      {overallStats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-background-secondary">
            <div className="text-meta text-foreground-secondary mb-1">Total Hits</div>
            <div className="text-lg font-medium">{overallStats.totalHits.toLocaleString()}</div>
          </Card>
          <Card className="bg-background-secondary">
            <div className="text-meta text-foreground-secondary mb-1">Avg Hit Rate</div>
            <div className={`text-lg font-medium ${overallStats.avgHitRate >= 95 ? 'text-foreground-success' : overallStats.avgHitRate >= 85 ? 'text-foreground-warning' : 'text-foreground-danger'}`}>
              {overallStats.avgHitRate.toFixed(1)}%
            </div>
          </Card>
          <Card className="bg-background-secondary">
            <div className="text-meta text-foreground-secondary mb-1">Memory Used</div>
            <div className="text-lg font-medium">{formatBytes(overallStats.memoryUsed)}</div>
          </Card>
          <Card className="bg-background-secondary">
            <div className="text-meta text-foreground-secondary mb-1">Active Caches</div>
            <div className="text-lg font-medium">{overallStats.activeCaches} / 3</div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-small transition-colors relative ${
                activeTab === tab.id
                  ? 'text-foreground-primary font-medium'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && displayData && (
        <OverviewTab
          cacheData={displayData}
          onPurge={setPurgeTarget}
          onWarm={setWarmTarget}
          onToggle={handleToggle}
          onConfigure={setShowConfigModal}
          purgeCache={purgeCache}
          warmCache={warmCache}
          toggleCache={toggleCache}
        />
      )}

      {activeTab === 'opcache' && displayData && (
        <CacheTypeTab
          type="opcache"
          data={displayData.opcache}
          onPurge={() => setPurgeTarget('opcache')}
          onWarm={() => { setWarmTarget('opcache'); setWarmPreset('homepage'); }}
          onToggle={(enabled) => handleToggle('opcache', enabled)}
          onConfigure={() => setShowConfigModal('opcache')}
          purgeCache={purgeCache}
          warmCache={warmCache}
        />
      )}

      {activeTab === 'redis' && displayData && (
        <CacheTypeTab
          type="redis"
          data={displayData.redis}
          onPurge={() => setPurgeTarget('redis')}
          onWarm={() => { setWarmTarget('redis'); setWarmPreset('homepage'); }}
          onToggle={(enabled) => handleToggle('redis', enabled)}
          onConfigure={() => setShowConfigModal('redis')}
          purgeCache={purgeCache}
          warmCache={warmCache}
        />
      )}

      {activeTab === 'memcached' && displayData && (
        <CacheTypeTab
          type="memcached"
          data={displayData.memcached}
          onPurge={() => setPurgeTarget('memcached')}
          onWarm={() => { setWarmTarget('memcached'); setWarmPreset('homepage'); }}
          onToggle={(enabled) => handleToggle('memcached', enabled)}
          onConfigure={() => setShowConfigModal('memcached')}
          purgeCache={purgeCache}
          warmCache={warmCache}
        />
      )}

      {activeTab === 'settings' && displayData && (
        <SettingsTab
          cacheData={displayData}
          onSaveConfig={handleConfigSave}
          updateConfig={updateConfig}
        />
      )}

      {/* Purge Confirmation */}
      <ConfirmDialog
        isOpen={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        title={`Purge ${purgeTarget} Cache`}
        description={`This will clear all cached data for ${purgeTarget}. This action cannot be undone.`}
        confirmText="Purge"
        impact="high"
        loading={purgeCache.isPending}
        onConfirm={() => purgeTarget && handlePurge(purgeTarget)}
      />

      {/* Warm Cache Modal */}
      <Modal
        isOpen={!!warmTarget}
        onClose={() => { setWarmTarget(null); setCustomUrls(''); }}
        title={`Warm ${warmTarget} Cache`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setWarmTarget(null); setCustomUrls(''); }}>Cancel</Button>
            <Button variant="primary" loading={warmCache.isPending} onClick={handleWarm}>
              Start Warming
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">
            Preload cache with frequently accessed data to improve response times.
          </p>
          <div>
            <label className="text-meta font-medium block mb-2">Warming Preset</label>
            <div className="flex flex-wrap gap-2">
              {WARMING_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={warmPreset === preset.value ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setWarmPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          {warmPreset === 'custom' && (
            <div>
              <label className="text-meta font-medium block mb-2">Custom URLs (one per line)</label>
              <textarea
                value={customUrls}
                onChange={(e) => setCustomUrls(e.target.value)}
                placeholder="/&#10;/about&#10;/products"
                className="w-full h-32 px-3 py-2 text-small rounded-md border border-border-tertiary bg-background-secondary text-foreground-primary placeholder:text-foreground-tertiary font-mono resize-none"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Config Modal */}
      {showConfigModal && displayData && (
        <ConfigModal
          type={showConfigModal}
          config={displayData[showConfigModal].config}
          onSave={(config) => handleConfigSave(showConfigModal, config)}
          onClose={() => setShowConfigModal(null)}
          isPending={updateConfig.isPending}
        />
      )}
    </div>
  );
}

// Overview Tab Component
interface OverviewTabProps {
  cacheData: SiteCacheData;
  onPurge: (type: CacheType) => void;
  onWarm: (type: CacheType) => void;
  onToggle: (type: CacheType, enabled: boolean) => void;
  onConfigure: (type: CacheType) => void;
  purgeCache: ReturnType<typeof usePurgeCache>;
  warmCache: ReturnType<typeof useWarmCache>;
  toggleCache: ReturnType<typeof useToggleCache>;
}

function OverviewTab({ cacheData, onPurge, onWarm, onToggle, onConfigure }: OverviewTabProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Cache Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CACHE_TYPES.map((cache) => {
          const data = cacheData[cache.id];
          const isEnabled = data.config.enabled;
          const memoryPercent = (data.stats.memoryUsed / data.stats.memoryMax) * 100;

          return (
            <Card key={cache.id} className="bg-background-secondary">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    data.status.connected ? 'bg-foreground-success/10' : 'bg-foreground-danger/10'
                  }`}>
                    <Icon name={cache.icon} size={20} className={data.status.connected ? 'text-foreground-success' : 'text-foreground-danger'} />
                  </div>
                  <div>
                    <h3 className="font-medium">{cache.label}</h3>
                    <StatusBadge status={data.status.connected ? 'active' : 'inactive'} />
                  </div>
                </div>
                <button
                  onClick={() => onToggle(cache.id, !isEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isEnabled ? 'bg-foreground-success' : 'bg-background-tertiary'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-small mb-1">
                    <span className="text-foreground-secondary">Hit Rate</span>
                    <span className={`font-medium ${data.stats.hitRate >= 95 ? 'text-foreground-success' : data.stats.hitRate >= 85 ? 'text-foreground-warning' : 'text-foreground-danger'}`}>
                      {data.stats.hitRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        data.stats.hitRate >= 95 ? 'bg-foreground-success' : data.stats.hitRate >= 85 ? 'bg-foreground-warning' : 'bg-foreground-danger'
                      }`}
                      style={{ width: `${data.stats.hitRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-small mb-1">
                    <span className="text-foreground-secondary">Memory</span>
                    <span className="font-medium">{formatBytes(data.stats.memoryUsed)} / {formatBytes(data.stats.memoryMax)}</span>
                  </div>
                  <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        memoryPercent < 70 ? 'bg-foreground-info' : memoryPercent < 90 ? 'bg-foreground-warning' : 'bg-foreground-danger'
                      }`}
                      style={{ width: `${memoryPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="text-center p-2 bg-background-tertiary rounded">
                    <div className="text-small font-medium">{data.stats.hits.toLocaleString()}</div>
                    <div className="text-meta text-foreground-tertiary">Hits</div>
                  </div>
                  <div className="text-center p-2 bg-background-tertiary rounded">
                    <div className="text-small font-medium">{data.stats.keysCount.toLocaleString()}</div>
                    <div className="text-meta text-foreground-tertiary">Keys</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-border-tertiary">
                <Button
                  variant="ghost"
                  size="small"
                  className="flex-1"
                  icon={<Icon name="icon-refresh" size={14} />}
                  onClick={() => onWarm(cache.id)}
                >
                  Warm
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  className="flex-1"
                  icon={<Icon name="icon-trash" size={14} />}
                  onClick={() => onPurge(cache.id)}
                >
                  Purge
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  className="flex-1"
                  icon={<Icon name="icon-settings" size={14} />}
                  onClick={() => onConfigure(cache.id)}
                >
                  Config
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Cache Hit Ratio Chart */}
      <Card title="Cache Hit Ratio Over Time">
        <CacheHitRatioChart cacheData={cacheData} />
      </Card>
    </div>
  );
}

// Cache Type Tab Component
interface CacheTypeTabProps {
  type: CacheType;
  data: SiteCacheData['opcache'];
  onPurge: () => void;
  onWarm: () => void;
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  purgeCache: ReturnType<typeof usePurgeCache>;
  warmCache: ReturnType<typeof useWarmCache>;
}

function CacheTypeTab({ type, data, onPurge, onWarm, onToggle, onConfigure, purgeCache, warmCache }: CacheTypeTabProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const memoryPercent = (data.stats.memoryUsed / data.stats.memoryMax) * 100;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              data.status.connected ? 'bg-foreground-success/10' : 'bg-foreground-danger/10'
            }`}>
              <Icon
                name={type === 'opcache' ? 'icon-box' : type === 'redis' ? 'icon-database' : 'icon-server'}
                size={24}
                className={data.status.connected ? 'text-foreground-success' : 'text-foreground-danger'}
              />
            </div>
            <div>
              <h2 className="text-lg font-medium capitalize">{type} Cache</h2>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${data.status.connected ? 'bg-foreground-success' : 'bg-foreground-danger'}`} />
                <span className="text-small text-foreground-secondary">
                  {data.status.connected ? `Connected - ${data.status.version || 'Unknown version'}` : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={data.config.enabled ? 'default' : 'primary'}
              onClick={() => onToggle(!data.config.enabled)}
            >
              {data.config.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Hit Rate</div>
          <div className={`text-2xl font-medium ${data.stats.hitRate >= 95 ? 'text-foreground-success' : data.stats.hitRate >= 85 ? 'text-foreground-warning' : 'text-foreground-danger'}`}>
            {data.stats.hitRate.toFixed(1)}%
          </div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Total Hits</div>
          <div className="text-2xl font-medium">{data.stats.hits.toLocaleString()}</div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Keys Count</div>
          <div className="text-2xl font-medium">{data.stats.keysCount.toLocaleString()}</div>
        </Card>
        <Card className="bg-background-secondary">
          <div className="text-meta text-foreground-secondary mb-1">Uptime</div>
          <div className="text-2xl font-medium">{formatUptime(data.stats.uptime)}</div>
        </Card>
      </div>

      {/* Memory Usage */}
      <Card title="Memory Usage">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground-secondary">Used</span>
            <span className="font-medium">{formatBytes(data.stats.memoryUsed)}</span>
          </div>
          <div className="h-4 bg-background-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                memoryPercent < 70 ? 'bg-foreground-info' : memoryPercent < 90 ? 'bg-foreground-warning' : 'bg-foreground-danger'
              }`}
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-small text-foreground-secondary">
            <span>0</span>
            <span>{formatBytes(data.stats.memoryMax)}</span>
          </div>
        </div>
      </Card>

      {/* Configuration */}
      <Card title="Current Configuration">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-meta text-foreground-tertiary">TTL</div>
            <div className="font-medium">{data.config.ttl}s</div>
          </div>
          <div className="space-y-1">
            <div className="text-meta text-foreground-tertiary">Max Memory</div>
            <div className="font-medium">{data.config.maxMemory}</div>
          </div>
          <div className="space-y-1">
            <div className="text-meta text-foreground-tertiary">Eviction Policy</div>
            <div className="font-medium">{data.config.evictionPolicy}</div>
          </div>
          <div className="space-y-1">
            <div className="text-meta text-foreground-tertiary">Compression</div>
            <div className="font-medium">{data.config.compress ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <Card>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={<Icon name="icon-refresh" size={16} />}
            loading={warmCache.isPending}
            onClick={onWarm}
          >
            Warm Cache
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="icon-trash" size={16} />}
            loading={purgeCache.isPending}
            onClick={onPurge}
          >
            Purge Cache
          </Button>
          <Button
            variant="default"
            icon={<Icon name="icon-settings" size={16} />}
            onClick={onConfigure}
          >
            Configure
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Settings Tab Component
interface SettingsTabProps {
  cacheData: SiteCacheData;
  onSaveConfig: (type: CacheType, config: Partial<CacheConfig>) => void;
  updateConfig: ReturnType<typeof useUpdateCacheConfig>;
}

function SettingsTab({ cacheData, onSaveConfig, updateConfig }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      {CACHE_TYPES.map((cache) => {
        const data = cacheData[cache.id];
        return (
          <Card key={cache.id} title={`${cache.label} Settings`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border-tertiary">
                <div>
                  <div className="font-medium">Enable {cache.label}</div>
                  <div className="text-small text-foreground-secondary">Turn cache on or off</div>
                </div>
                <button
                  onClick={() => onSaveConfig(cache.id, { enabled: !data.config.enabled })}
                  disabled={updateConfig.isPending}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    data.config.enabled ? 'bg-foreground-success' : 'bg-background-tertiary'
                  } ${updateConfig.isPending ? 'opacity-50' : ''}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    data.config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 py-3 border-b border-border-tertiary">
                <div>
                  <div className="text-small font-medium mb-1">TTL (seconds)</div>
                  <div className="text-foreground-secondary">{data.config.ttl}s</div>
                </div>
                <div>
                  <div className="text-small font-medium mb-1">Max Memory</div>
                  <div className="text-foreground-secondary">{data.config.maxMemory}</div>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">Compression</div>
                  <div className="text-small text-foreground-secondary">Compress cached data to save space</div>
                </div>
                <button
                  onClick={() => onSaveConfig(cache.id, { compress: !data.config.compress })}
                  disabled={updateConfig.isPending}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    data.config.compress ? 'bg-foreground-success' : 'bg-background-tertiary'
                  } ${updateConfig.isPending ? 'opacity-50' : ''}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    data.config.compress ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Config Modal Component
interface ConfigModalProps {
  type: CacheType;
  config: CacheConfig;
  onSave: (config: Partial<CacheConfig>) => void;
  onClose: () => void;
  isPending: boolean;
}

function ConfigModal({ type, config, onSave, onClose, isPending }: ConfigModalProps) {
  const [ttl, setTtl] = useState(config.ttl.toString());
  const [maxMemory, setMaxMemory] = useState(config.maxMemory);
  const [evictionPolicy, setEvictionPolicy] = useState(config.evictionPolicy);
  const [persistent, setPersistent] = useState(config.persistent);
  const [compress, setCompress] = useState(config.compress);

  const handleSave = () => {
    onSave({
      ttl: parseInt(ttl) || config.ttl,
      maxMemory,
      evictionPolicy,
      persistent,
      compress,
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Configure ${type} Cache`}
      size="large"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isPending} onClick={handleSave}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="TTL (seconds)"
            type="number"
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            placeholder="3600"
          />
          <Input
            label="Max Memory"
            value={maxMemory}
            onChange={(e) => setMaxMemory(e.target.value)}
            placeholder="512M"
          />
        </div>

        {type === 'redis' && (
          <div>
            <label className="text-meta font-medium block mb-2">Eviction Policy</label>
            <div className="flex flex-wrap gap-2">
              {REDIS_EVICTION_POLICIES.map((policy) => (
                <Button
                  key={policy.value}
                  variant={evictionPolicy === policy.value ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setEvictionPolicy(policy.value)}
                >
                  {policy.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Persistent Connections</div>
              <div className="text-small text-foreground-secondary">Keep connections alive</div>
            </div>
            <button
              onClick={() => setPersistent(!persistent)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                persistent ? 'bg-foreground-success' : 'bg-background-tertiary'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                persistent ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Compression</div>
              <div className="text-small text-foreground-secondary">Compress cached data</div>
            </div>
            <button
              onClick={() => setCompress(!compress)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                compress ? 'bg-foreground-success' : 'bg-background-tertiary'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                compress ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Cache Hit Ratio Chart Component
interface CacheHitRatioChartProps {
  cacheData: SiteCacheData;
}

function CacheHitRatioChart({ cacheData }: CacheHitRatioChartProps) {
  const [chartData, setChartData] = useState<CacheHistoryPoint[]>([]);

  // Simulate real-time chart data
  useEffect(() => {
    const generateDataPoint = (): CacheHistoryPoint => {
      const baseHitRate = (cacheData.opcache.stats.hitRate + cacheData.redis.stats.hitRate + cacheData.memcached.stats.hitRate) / 3;
      const variance = 2;
      return {
        timestamp: Date.now(),
        hitRate: Math.max(0, Math.min(100, baseHitRate + (Math.random() * variance * 2 - variance))),
        memory: cacheData.opcache.stats.memoryUsed + cacheData.redis.stats.memoryUsed + cacheData.memcached.stats.memoryUsed,
        hits: cacheData.redis.stats.hits,
        misses: cacheData.redis.stats.misses,
      };
    };

    // Initialize with some historical data
    const initialData: CacheHistoryPoint[] = [];
    for (let i = 20; i >= 0; i--) {
      const point = generateDataPoint();
      point.timestamp = Date.now() - i * 5000;
      initialData.push(point);
    }
    setChartData(initialData);

    // Update every 5 seconds
    const interval = setInterval(() => {
      setChartData(prev => {
        const newData = [...prev.slice(1), generateDataPoint()];
        return newData;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [cacheData]);

  const maxMemory = cacheData.opcache.stats.memoryMax + cacheData.redis.stats.memoryMax + cacheData.memcached.stats.memoryMax;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex gap-4 text-small">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-foreground-info" />
          <span className="text-foreground-secondary">Hit Rate (%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-foreground-success" />
          <span className="text-foreground-secondary">Memory Usage</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48 bg-background-secondary rounded-lg overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          {[100, 75, 50, 25, 0].map((value) => (
            <div key={value} className="flex items-center gap-2">
              <span className="text-meta text-foreground-tertiary w-12">{value}%</span>
              <div className="flex-1 border-t border-border-tertiary" />
            </div>
          ))}
        </div>

        {/* Hit rate line */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="var(--color-foreground-info)"
            strokeWidth="2"
            points={chartData.map((point, index) => {
              const x = (index / (chartData.length - 1)) * 100;
              const y = 100 - point.hitRate;
              return `${x}%,${y}%`;
            }).join(' ')}
          />
        </svg>

        {/* Memory usage line (normalized to percentage of max) */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="var(--color-foreground-success)"
            strokeWidth="2"
            strokeDasharray="4"
            points={chartData.map((point, index) => {
              const x = (index / (chartData.length - 1)) * 100;
              const y = 100 - (point.memory / maxMemory) * 100;
              return `${x}%,${y}%`;
            }).join(' ')}
          />
        </svg>
      </div>

      {/* Current values */}
      <div className="flex justify-between text-small">
        <div>
          <span className="text-foreground-secondary">Current Hit Rate: </span>
          <span className="font-medium">
            {chartData.length > 0 ? chartData[chartData.length - 1].hitRate.toFixed(1) : '—'}%
          </span>
        </div>
        <div>
          <span className="text-foreground-secondary">Memory: </span>
          <span className="font-medium">
            {chartData.length > 0 ? formatBytes(chartData[chartData.length - 1].memory) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
