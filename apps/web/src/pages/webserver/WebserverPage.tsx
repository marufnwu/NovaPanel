import { useState } from 'react';
import {
  useWebserverStatus,
  useWebserverDomains,
  useVhostConfig,
  useUpdateVhost,
  useTestConfig,
  useReloadServer,
  usePreviewConfig,
  useCustomErrorPages,
  useUpdateCustomErrorPages,
  useRateLimitConfig,
  useUpdateRateLimitConfig,
  type CustomErrorPage,
  type RateLimitConfig,
} from '../../api/hooks/webserver';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Server, RefreshCw, CheckCircle, X, Eye, Save, Globe,
  FileWarning, Gauge, AlertTriangle,
} from 'lucide-react';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </label>
  );
}

// --- Custom Error Pages Section ---
const ERROR_CODES = [404, 403, 500, 502] as const;

const DEFAULT_ERROR_PAGES: CustomErrorPage[] = ERROR_CODES.map((code) => ({
  code,
  enabled: false,
  content: `<!DOCTYPE html>
<html>
<head><title>Error ${code}</title></head>
<body>
<h1>Error ${code}</h1>
<p>The server encountered an error.</p>
</body>
</html>`,
  contentType: 'text/html' as const,
}));

function CustomErrorPagesSection({ domain }: { domain: string }) {
  const { data: errorPages, isLoading } = useCustomErrorPages(domain);
  const updateErrorPages = useUpdateCustomErrorPages();
  const [pages, setPages] = useState<CustomErrorPage[]>(DEFAULT_ERROR_PAGES);
  const [saved, setSaved] = useState(false);

  // Sync with server data
  useState(() => {
    if (errorPages && errorPages.length > 0) {
      setPages(errorPages);
    }
  });

  const handleToggle = (code: number) => {
    setPages((prev) =>
      prev.map((p) => (p.code === code ? { ...p, enabled: !p.enabled } : p))
    );
    setSaved(false);
  };

  const handleContentChange = (code: number, content: string) => {
    setPages((prev) =>
      prev.map((p) => (p.code === code ? { ...p, content } : p))
    );
    setSaved(false);
  };

  const handleSave = () => {
    updateErrorPages.mutate(
      { domain, errorPages: pages },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <FileWarning className="h-5 w-5 text-primary" /> Custom Error Pages
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Configure custom HTML error pages for HTTP error codes.
      </p>

      <div className="space-y-4">
        {pages.map((page) => (
          <div key={page.code} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium">
                  {page.code}
                </span>
                <span className="text-sm text-muted-foreground">
                  {page.code === 404 && 'Not Found'}
                  {page.code === 403 && 'Forbidden'}
                  {page.code === 500 && 'Internal Server Error'}
                  {page.code === 502 && 'Bad Gateway'}
                </span>
              </div>
              <label className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Enabled</span>
                <button
                  type="button"
                  onClick={() => handleToggle(page.code)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    page.enabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                      page.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>
            {page.enabled && (
              <textarea
                value={page.content}
                onChange={(e) => handleContentChange(page.code, e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                rows={6}
                placeholder={`<!-- Custom ${page.code} error page HTML -->`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateErrorPages.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {updateErrorPages.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Error Pages'}
        </button>
      </div>
    </div>
  );
}

// --- Rate Limiting Section ---
function RateLimitingSection({ domain }: { domain: string }) {
  const { data: rateLimitConfig, isLoading } = useRateLimitConfig(domain);
  const updateRateLimit = useUpdateRateLimitConfig();
  const [config, setConfig] = useState<RateLimitConfig>({
    enabled: false,
    requestsPerSecond: 100,
    burstSize: 50,
    timeoutSeconds: 10,
  });
  const [saved, setSaved] = useState(false);

  // Sync with server data
  useState(() => {
    if (rateLimitConfig) {
      setConfig(rateLimitConfig);
    }
  });

  const handleSave = () => {
    updateRateLimit.mutate(
      { domain, ...config },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Gauge className="h-5 w-5 text-primary" /> Request Rate Limiting
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Protect your server from excessive requests by configuring rate limits.
      </p>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Enable Rate Limiting</span>
            <p className="text-xs text-muted-foreground">Limit the number of requests per second</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfig({ ...config, enabled: !config.enabled });
              setSaved(false);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              config.enabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                config.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        {config.enabled && (
          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="flex items-center gap-3">
              <label className="w-40 text-sm text-muted-foreground">Requests per second:</label>
              <input
                type="number"
                value={config.requestsPerSecond}
                onChange={(e) => {
                  setConfig({ ...config, requestsPerSecond: parseInt(e.target.value) || 1 });
                  setSaved(false);
                }}
                className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                min={1}
                max={10000}
              />
              <span className="text-sm text-muted-foreground">req/s</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 text-sm text-muted-foreground">Burst size:</label>
              <input
                type="number"
                value={config.burstSize}
                onChange={(e) => {
                  setConfig({ ...config, burstSize: parseInt(e.target.value) || 1 });
                  setSaved(false);
                }}
                className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                min={1}
                max={10000}
              />
              <span className="text-sm text-muted-foreground">requests</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 text-sm text-muted-foreground">Timeout:</label>
              <input
                type="number"
                value={config.timeoutSeconds}
                onChange={(e) => {
                  setConfig({ ...config, timeoutSeconds: parseInt(e.target.value) || 1 });
                  setSaved(false);
                }}
                className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                min={1}
                max={300}
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateRateLimit.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {updateRateLimit.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Rate Limit'}
        </button>
      </div>
    </div>
  );
}

export function WebserverPage() {
  const { data: status, isLoading: statusLoading, isError: statusError, refetch: refetchStatus } = useWebserverStatus();
  const { data: domains } = useWebserverDomains();
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const { data: config, isLoading: configLoading, isError: configError, refetch: refetchConfig } = useVhostConfig(selectedDomain);
  const updateVhost = useUpdateVhost();
  const testConfig = useTestConfig();
  const reload = useReloadServer();

  const [form, setForm] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: preview } = usePreviewConfig(showPreview && config?.domainId ? config.domainId : '');

  // Sync form with loaded config
  const handleDomainSelect = (domain: string) => {
    setSelectedDomain(domain);
    setForm({});
    setSaved(false);
  };

  const currentConfig = config || {} as any;
  const getValue = (key: string) => form[key] !== undefined ? form[key] : (currentConfig as any)[key];

  const handleSave = () => {
    if (!selectedDomain) return;
    setSaved(false);
    updateVhost.mutate({ domain: selectedDomain, ...form }, {
      onSuccess: () => {
        setSaved(true);
        setForm({});
        setTimeout(() => setSaved(false), 3000);
      },
    });
  };

  if (statusLoading) return <LoadingSpinner />;

  if (statusError) return (
    <div className="space-y-6">
      <PageHeader title="Web Server" description="Nginx and Apache configuration" />
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-red-600 dark:text-red-400">Failed to load webserver status. Please try again.</p>
        <button
          onClick={() => refetchStatus()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Web Server" description="Nginx and Apache configuration" />

      {/* Server Status */}
      <div className="grid gap-4 md:grid-cols-2">
        {(['nginx', 'apache'] as const).map((server) => (
          <div key={server} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold capitalize">{server}</h3>
                  <p className="text-sm text-muted-foreground">
                    {(status as any)?.[server]?.status === 'running' ? '● Running' : '○ Stopped'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => testConfig.mutate(server)}
                  disabled={testConfig.isPending}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Test
                </button>
                <button
                  onClick={() => reload.mutate(server)}
                  disabled={reload.isPending}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reload
                </button>
              </div>
            </div>
            {testConfig.data && testConfig.variables === server && (
              <div className={`mt-3 rounded-md p-2 text-xs ${testConfig.data.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {testConfig.data.valid ? '✓ Config is valid' : `✗ ${testConfig.data.output}`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Domain Selector */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-lg font-semibold">Domain Configuration</h3>
        <select
          value={selectedDomain}
          onChange={(e) => handleDomainSelect(e.target.value)}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select a domain...</option>
          {domains?.map((d) => (
            <option key={d.id} value={d.name}>{d.name} ({d.webServer})</option>
          ))}
        </select>
      </div>

      {/* Domain Config Panels */}
      {selectedDomain && configLoading && <LoadingSpinner />}

      {selectedDomain && configError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-600 dark:text-red-400">Failed to load domain configuration.</p>
          <button
            onClick={() => refetchConfig()}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {selectedDomain && !configLoading && !configError && !config && (
        <EmptyState
          icon={Server}
          title="No webserver configuration"
          description="No webserver configuration exists for this domain. Save changes to create one."
        />
      )}

      {selectedDomain && !configLoading && config && (
        <div className="space-y-6">
          {/* Server Mode */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Server Mode</h3>
            <div className="flex gap-4">
              {(['nginx', 'apache', 'nginx+apache'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="webServer"
                    value={mode}
                    checked={getValue('webServer') === mode}
                    onChange={() => setForm({ ...form, webServer: mode })}
                    className="h-4 w-4 border-input text-primary"
                  />
                  <span className="text-sm">
                    {mode === 'nginx' ? 'Nginx Only' : mode === 'apache' ? 'Apache Only' : 'Nginx + Apache'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Performance */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Performance</h3>
            <Toggle
              label="Gzip Compression"
              checked={getValue('gzipEnabled')}
              onChange={(v) => setForm({ ...form, gzipEnabled: v })}
            />
            <Toggle
              label="Browser Caching"
              checked={getValue('browserCachingEnabled')}
              onChange={(v) => setForm({ ...form, browserCachingEnabled: v })}
            />
            <div className="mt-2 flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Static file expiry:</label>
              <input
                type="number"
                value={getValue('staticFileExpiryDays')}
                onChange={(e) => setForm({ ...form, staticFileExpiryDays: parseInt(e.target.value) || 0 })}
                className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                min={0}
                max={365}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Security</h3>
            <Toggle
              label="Hotlink Protection"
              checked={getValue('hotlinkProtection')}
              onChange={(v) => setForm({ ...form, hotlinkProtection: v })}
            />
            {getValue('hotlinkProtection') && (
              <div className="mt-2 ml-4">
                <label className="text-xs text-muted-foreground">Allowed domains (comma-separated)</label>
                <input
                  value={getValue('hotlinkAllowedDomains') || ''}
                  onChange={(e) => setForm({ ...form, hotlinkAllowedDomains: e.target.value })}
                  className="mt-1 w-full max-w-md rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  placeholder="example.com, cdn.example.com"
                />
              </div>
            )}
            <Toggle
              label="Directory Browsing"
              checked={getValue('directoryBrowsing')}
              onChange={(v) => setForm({ ...form, directoryBrowsing: v })}
            />
            <div className="mt-3 space-y-2">
              <label className="text-sm font-medium">IP Access Restriction</label>
              <select
                value={getValue('ipRestrictionMode')}
                onChange={(e) => setForm({ ...form, ipRestrictionMode: e.target.value })}
                className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="allow_all">Allow All</option>
                <option value="whitelist">Whitelist Only</option>
                <option value="blacklist">Blacklist</option>
              </select>
              {getValue('ipRestrictionMode') !== 'allow_all' && (
                <textarea
                  value={getValue('ipList') || ''}
                  onChange={(e) => setForm({ ...form, ipList: e.target.value })}
                  className="mt-1 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  rows={3}
                  placeholder="192.168.1.0/24&#10;10.0.0.1"
                />
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm font-medium">Max Upload Size:</label>
              <input
                type="number"
                value={getValue('maxUploadSizeMb')}
                onChange={(e) => setForm({ ...form, maxUploadSizeMb: parseInt(e.target.value) || 64 })}
                className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                min={1}
                max={1024}
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
          </div>

          {/* Reverse Proxy */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Reverse Proxy</h3>
            <Toggle
              label="Enable Reverse Proxy"
              checked={getValue('reverseProxyEnabled')}
              onChange={(v) => setForm({ ...form, reverseProxyEnabled: v })}
            />
            {getValue('reverseProxyEnabled') && (
              <div className="mt-2 ml-4">
                <label className="text-xs text-muted-foreground">Proxy Target URL</label>
                <input
                  value={getValue('reverseProxyTarget') || ''}
                  onChange={(e) => setForm({ ...form, reverseProxyTarget: e.target.value })}
                  className="mt-1 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  placeholder="http://localhost:3000"
                />
              </div>
            )}
          </div>

          {/* Custom Directives */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Custom Directives</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nginx Directives</label>
                <textarea
                  value={getValue('customNginxDirectives') || ''}
                  onChange={(e) => setForm({ ...form, customNginxDirectives: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  rows={8}
                  placeholder="# Custom Nginx directives&#10;location /custom {&#10;    # ...&#10;}"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Apache Directives</label>
                <textarea
                  value={getValue('customApacheDirectives') || ''}
                  onChange={(e) => setForm({ ...form, customApacheDirectives: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  rows={8}
                  placeholder="# Custom Apache directives&#10;<Directory /var/www/custom>&#10;    # ...&#10;</Directory>"
                />
              </div>
            </div>
          </div>

          {/* Custom Error Pages */}
          <CustomErrorPagesSection domain={selectedDomain} />

          {/* Request Rate Limiting */}
          <RateLimitingSection domain={selectedDomain} />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={updateVhost.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updateVhost.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Eye className="h-4 w-4" /> Preview Config
            </button>
          </div>

          {/* Preview Modal */}
          {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
              <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Nginx Config — {selectedDomain}</h3>
                  <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {preview?.config || 'Loading...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
