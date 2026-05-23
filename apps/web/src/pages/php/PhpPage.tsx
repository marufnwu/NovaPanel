import { useState } from 'react';
import {
  usePhpVersions,
  DEFAULT_PHP_VERSIONS,
  usePhpDomains,
  usePhpConfig,
  useSetPhpVersion,
  useUpdatePoolSettings,
  useUpdatePhpLimits,
  useUpdatePhpSecurity,
  useRestartFpm,
  useInstallPhp,
  usePhpIni,
  useUpdatePhpIni,
  usePhpInfo,
  useFpmStatus,
} from '../../api/hooks/php';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Code2, Download, RefreshCw, Save, CheckCircle, Info, Activity, Plus, Trash2, X, Eye, AlertTriangle } from 'lucide-react';

const DANGEROUS_FUNCTIONS = [
  'exec', 'system', 'passthru', 'popen', 'proc_open',
  'shell_exec', 'eval', 'base64_decode', 'show_source',
];

// --- php.ini Editor ---
function PhpIniEditor({ domainId }: { domainId: string }) {
  const { data: iniData, isLoading } = usePhpIni(domainId);
  const updateIni = useUpdatePhpIni();
  const [directives, setDirectives] = useState<{ key: string; value: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Initialize directives from fetched data
  if (iniData && !initialized) {
    const parsed = iniData.directives && iniData.directives.length > 0
      ? iniData.directives
      : parseIniContent(iniData.content);
    setDirectives(parsed);
    setInitialized(true);
  }

  const handleSave = () => {
    const content = directives
      .filter((d) => d.key.trim())
      .map((d) => `${d.key} = ${d.value}`)
      .join('\n');
    updateIni.mutate({ domainId, content });
  };

  const addDirective = () => {
    if (!newKey.trim()) return;
    setDirectives([...directives, { key: newKey.trim(), value: newValue }]);
    setNewKey('');
    setNewValue('');
  };

  const removeDirective = (index: number) => {
    setDirectives(directives.filter((_, i) => i !== index));
  };

  const updateDirective = (index: number, field: 'key' | 'value', val: string) => {
    setDirectives(directives.map((d, i) => (i === index ? { ...d, [field]: val } : d)));
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold flex items-center gap-2">
        <Code2 className="h-4 w-4" /> Custom php.ini Directives
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Add custom PHP directives for this domain. These override the default PHP configuration.
      </p>

      {/* Existing directives */}
      {directives.length > 0 && (
        <div className="mb-4 rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Directive</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {directives.map((d, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      value={d.key}
                      onChange={(e) => updateDirective(i, 'key', e.target.value)}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs hover:border-input focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={d.value}
                      onChange={(e) => updateDirective(i, 'value', e.target.value)}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs hover:border-input focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeDirective(i)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new directive */}
      <div className="flex gap-2 mb-4">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="directive_name"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
        />
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
        />
        <button
          onClick={addDirective}
          disabled={!newKey.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={updateIni.isPending}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" /> {updateIni.isPending ? 'Saving...' : 'Save php.ini'}
      </button>
      {updateIni.isSuccess && (
        <span className="ml-3 inline-flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" /> Saved
        </span>
      )}
    </div>
  );
}

function parseIniContent(content: string): { key: string; value: string }[] {
  if (!content) return [];
  return content
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith(';') && !line.trim().startsWith('#'))
    .map((line) => {
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) return null;
      return { key: line.slice(0, eqIndex).trim(), value: line.slice(eqIndex + 1).trim() };
    })
    .filter((d): d is { key: string; value: string } => d !== null);
}

// --- phpinfo Modal ---
function PhpInfoModal({ domainId, onClose }: { domainId: string; onClose: () => void }) {
  const { data, isLoading } = usePhpInfo(domainId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[85vh] rounded-lg border border-border bg-card shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" /> phpinfo() Output
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <LoadingPage />
          ) : data?.html ? (
            <div dangerouslySetInnerHTML={{ __html: data.html }} className="phpinfo-output" />
          ) : (
            <p className="text-sm text-muted-foreground">No PHP info available for this domain.</p>
          )}
        </div>
        <div className="flex justify-end border-t border-border px-6 py-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Close</button>
        </div>
      </div>
    </div>
  );
}

// --- FPM Pool Status Display ---
function FpmPoolStatusDisplay({ domainId }: { domainId: string }) {
  const { data: status, isLoading } = useFpmStatus(domainId);

  if (isLoading) return <LoadingPage />;
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

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// --- Main PHP Page ---
export function PhpPage() {
  const { data: versionsData, isLoading: versionsLoading, isError: versionsError, refetch: refetchVersions } = usePhpVersions();
  const { data: domains } = usePhpDomains();
  const [selectedDomain, setSelectedDomain] = useState('');
  const { data: config, isLoading: configLoading, isError: configError, refetch: refetchConfig } = usePhpConfig(selectedDomain);
  const setVersion = useSetPhpVersion();
  const updatePool = useUpdatePoolSettings();
  const updateLimits = useUpdatePhpLimits();
  const updateSecurity = useUpdatePhpSecurity();
  const restartFpm = useRestartFpm();
  const install = useInstallPhp();

  const [saved, setSaved] = useState(false);
  const [showPhpInfo, setShowPhpInfo] = useState(false);

  const versions: string[] = versionsData?.versions?.length
    ? versionsData.versions.map((v: any) => typeof v === 'string' ? v : v.version)
    : (versionsError ? DEFAULT_PHP_VERSIONS : []);

  const selectedDomainObj = domains?.find((d) => d.name === selectedDomain);
  const selectedDomainId = selectedDomainObj?.id || '';

  const handleDomainSelect = (name: string) => {
    setSelectedDomain(name);
    setSaved(false);
  };

  if (versionsLoading) return <LoadingPage />;

  if (versionsError) return (
    <div className="space-y-6">
      <PageHeader title="PHP Settings" description="Manage PHP versions and per-domain PHP configuration" icon={Code2} />
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-red-600 dark:text-red-400">Failed to load PHP settings. Please try again.</p>
        <button
          onClick={() => refetchVersions()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="PHP Settings" description="Manage PHP versions and per-domain PHP configuration" icon={Code2} />

      {/* Installed PHP Versions */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-lg font-semibold">Installed PHP Versions</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {versions.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">No PHP versions detected on this system.</p>
          ) : (
            versions.map((v: string) => (
              <div key={v} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">PHP {v}</span>
                </div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-500">
                  installed
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Domain Selector */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-lg font-semibold">Per-Domain PHP Configuration</h3>
        <select
          value={selectedDomain}
          onChange={(e) => handleDomainSelect(e.target.value)}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select a domain...</option>
          {domains?.map((d) => (
            <option key={d.id} value={d.name}>{d.name} (PHP {d.phpVersion})</option>
          ))}
        </select>
      </div>

      {/* Domain Config */}
      {selectedDomain && configLoading && <LoadingPage />}

      {selectedDomain && configError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-600 dark:text-red-400">Failed to load PHP configuration for this domain.</p>
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
          icon={Code2}
          title="No PHP configuration"
          description="No PHP configuration exists for this domain. Select a different domain or create a new site."
        />
      )}

      {selectedDomain && !configLoading && config && (
        <div className="space-y-6">
          {/* PHP Version & Handler */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">PHP Version & Handler</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Version</label>
                <select
                  value={config.phpVersion}
                  onChange={(e) => {
                    const d = domains?.find((d) => d.name === selectedDomain);
                    if (d) setVersion.mutate({ domainId: d.id, phpVersion: e.target.value });
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {versions.map((v) => (
                    <option key={v} value={v}>PHP {v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Handler</label>
                <select
                  value={config.phpHandler}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled
                >
                  <option value="php-fpm">PHP-FPM</option>
                  <option value="cgi">CGI</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>

          {/* FPM Pool Status */}
          <FpmPoolStatusDisplay domainId={selectedDomainId} />

          {/* Custom php.ini Editor */}
          <PhpIniEditor domainId={selectedDomainId} />

          {/* FPM Pool Settings */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">PHP-FPM Process Manager</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const d = domains?.find((d) => d.name === selectedDomain);
              if (!d) return;
              updatePool.mutate({
                domainId: d.id,
                pm: formData.get('pm'),
                maxChildren: parseInt(formData.get('maxChildren') as string) || 5,
                startServers: parseInt(formData.get('startServers') as string) || 2,
                minSpareServers: parseInt(formData.get('minSpareServers') as string) || 1,
                maxSpareServers: parseInt(formData.get('maxSpareServers') as string) || 3,
                requestTerminateTimeout: parseInt(formData.get('requestTerminateTimeout') as string) || 300,
              });
            }}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">PM Mode</label>
                  <select name="pm" defaultValue={config.poolSettings.pm} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="dynamic">Dynamic</option>
                    <option value="static">Static</option>
                    <option value="ondemand">On Demand</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Children</label>
                  <input name="maxChildren" type="number" defaultValue={config.poolSettings.maxChildren} min={1} max={500} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Start Servers</label>
                  <input name="startServers" type="number" defaultValue={config.poolSettings.startServers} min={1} max={200} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Spare Servers</label>
                  <input name="minSpareServers" type="number" defaultValue={config.poolSettings.minSpareServers} min={1} max={200} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Spare Servers</label>
                  <input name="maxSpareServers" type="number" defaultValue={config.poolSettings.maxSpareServers} min={1} max={200} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Request Timeout (s)</label>
                  <input name="requestTerminateTimeout" type="number" defaultValue={config.poolSettings.requestTerminateTimeout} min={0} max={3600} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={updatePool.isPending} className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {updatePool.isPending ? 'Saving...' : 'Save Pool Settings'}
              </button>
            </form>
          </div>

          {/* PHP Limits */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">PHP Limits</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const d = domains?.find((d) => d.name === selectedDomain);
              if (!d) return;
              updateLimits.mutate({
                domainId: d.id,
                memoryLimit: formData.get('memoryLimit') as string,
                maxExecutionTime: parseInt(formData.get('maxExecutionTime') as string) || 300,
                maxInputTime: parseInt(formData.get('maxInputTime') as string) || 300,
                uploadMaxFilesize: formData.get('uploadMaxFilesize') as string,
                postMaxSize: formData.get('postMaxSize') as string,
                maxFileUploads: parseInt(formData.get('maxFileUploads') as string) || 20,
              });
            }}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Memory Limit</label>
                  <input name="memoryLimit" type="text" defaultValue={config.limits.memoryLimit} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Execution Time (s)</label>
                  <input name="maxExecutionTime" type="number" defaultValue={config.limits.maxExecutionTime} min={0} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Input Time (s)</label>
                  <input name="maxInputTime" type="number" defaultValue={config.limits.maxInputTime} min={0} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload Max Filesize</label>
                  <input name="uploadMaxFilesize" type="text" defaultValue={config.limits.uploadMaxFilesize} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Post Max Size</label>
                  <input name="postMaxSize" type="text" defaultValue={config.limits.postMaxSize} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Max File Uploads</label>
                  <input name="maxFileUploads" type="number" defaultValue={config.limits.maxFileUploads} min={1} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={updateLimits.isPending} className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {updateLimits.isPending ? 'Saving...' : 'Save Limits'}
              </button>
            </form>
          </div>

          {/* Security */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Security</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked={config.security.openBasedir}
                  onChange={(e) => {
                    const d = domains?.find((d) => d.name === selectedDomain);
                    if (d) updateSecurity.mutate({ domainId: d.id, openBasedir: e.target.checked });
                  }}
                  className="h-4 w-4 rounded border-input"
                />
                <div>
                  <span className="text-sm font-medium">open_basedir restriction</span>
                  <p className="text-xs text-muted-foreground">Restrict PHP file access to document root</p>
                </div>
              </label>

              <div>
                <p className="mb-2 text-sm font-medium">Disable Dangerous Functions</p>
                <div className="flex flex-wrap gap-2">
                  {DANGEROUS_FUNCTIONS.map((fn) => {
                    const isDisabled = config.security.disabledFunctions.includes(fn);
                    return (
                      <button
                        key={fn}
                        type="button"
                        onClick={() => {
                          const d = domains?.find((d) => d.name === selectedDomain);
                          if (!d) return;
                          const newFns = isDisabled
                            ? config.security.disabledFunctions.filter((f) => f !== fn)
                            : [...config.security.disabledFunctions, fn];
                          updateSecurity.mutate({ domainId: d.id, disabledFunctions: newFns });
                        }}
                        className={`rounded-md border px-2.5 py-1 text-xs font-mono transition-colors ${
                          isDisabled
                            ? 'border-red-300 bg-red-50 text-red-600'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {fn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const d = domains?.find((d) => d.name === selectedDomain);
                if (d) restartFpm.mutate(d.id);
              }}
              disabled={restartFpm.isPending}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {restartFpm.isPending ? 'Restarting...' : 'Restart FPM Pool'}
            </button>
            {restartFpm.isSuccess && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Restarted
              </span>
            )}
            <button
              onClick={() => setShowPhpInfo(true)}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Eye className="h-4 w-4" /> View phpinfo()
            </button>
          </div>
        </div>
      )}

      {/* phpinfo Modal */}
      {showPhpInfo && selectedDomainId && (
        <PhpInfoModal domainId={selectedDomainId} onClose={() => setShowPhpInfo(false)} />
      )}
    </div>
  );
}
