import { useState } from 'react';
import {
  useInstallerApps,
  useInstallApp,
  useUninstallApp,
  useUpdateApp,
  useInstallLogs,
  useInstalledApps,
  useAppConfigs,
  useSetAppConfig,
  useDeleteAppConfig,
  useCheckPath,
  type AppDefinition,
  type InstalledApp,
} from '../../api/hooks/installer';
import { useDatabases } from '../../api/hooks/databases';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  Download,
  Trash2,
  RefreshCw,
  Settings,
  X,
  Search,
  Terminal,
  ExternalLink,
  Copy,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Database,
  Eye,
  EyeOff,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  cms: 'bg-purple-100 text-purple-700 border-purple-200',
  blog: 'bg-green-100 text-green-700 border-green-200',
  ecommerce: 'bg-orange-100 text-orange-700 border-orange-200',
  collaboration: 'bg-blue-100 text-blue-700 border-blue-200',
  development: 'bg-gray-100 text-gray-700 border-gray-200',
  analytics: 'bg-pink-100 text-pink-700 border-pink-200',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

function getStatusBadge(status: string): { color: string; text: string } {
  switch (status) {
    case 'installing': return { color: 'bg-yellow-100 text-yellow-700', text: 'Installing' };
    case 'ready':      return { color: 'bg-green-100 text-green-700', text: 'Ready' };
    case 'error':      return { color: 'bg-red-100 text-red-700', text: 'Error' };
    default:           return { color: 'bg-gray-100 text-gray-700', text: status };
  }
}

// Admin URL patterns for known apps
function getAdminUrl(app: InstalledApp): string | null {
  if (app.adminUrl) return app.adminUrl;
  const domain = app.domain || app.domainId || '';
  const path = app.installPath || '';
  const base = domain ? `https://${domain}` : '';
  const appName = app.appName?.toLowerCase() || '';

  if (appName.includes('wordpress')) return `${base}/wp-admin/`;
  if (appName.includes('joomla')) return `${base}/administrator/`;
  if (appName.includes('drupal')) return `${base}/admin`;
  if (appName.includes('magento')) return `${base}/admin`;
  if (appName.includes('prestashop')) return `${base}/admin`;
  if (appName.includes('nextcloud')) return `${base}/`;
  if (appName.includes('phpmyadmin')) return `${base}${path}`;
  if (appName.includes('laravel')) return `${base}/admin`;
  return base ? `${base}/admin/` : null;
}

// ── Post-Install Checklist ──────────────────────────────────────────────────

function PostInstallChecklist({ app, onClose }: { app: InstalledApp; onClose: () => void }) {
  const adminUrl = getAdminUrl(app);
  const [copied, setCopied] = useState(false);
  const [checklist, setChecklist] = useState({
    appInstalled: true,
    databaseConfigured: !!app.databaseName,
    adminSetup: false,
    sslConfigured: false,
    backupsConfigured: false,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleItem = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-green-600">✅ Installation Complete!</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          <strong>{app.appName}</strong> has been installed successfully. Complete the following steps to finish setup:
        </p>

        <div className="space-y-3">
          <button
            onClick={() => toggleItem('appInstalled')}
            className="flex w-full items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-left"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            <div>
              <div className="text-sm font-medium">Application installed</div>
              <div className="text-xs text-muted-foreground">{app.installPath}</div>
            </div>
          </button>

          <button
            onClick={() => toggleItem('databaseConfigured')}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
              checklist.databaseConfigured
                ? 'border-green-200 bg-green-50'
                : 'border-border bg-card'
            }`}
          >
            {checklist.databaseConfigured ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-medium">Database configured</div>
              <div className="text-xs text-muted-foreground">
                {app.databaseName ? `${app.databaseName} (${app.databaseUser})` : 'No database'}
              </div>
            </div>
          </button>

          {adminUrl && (
            <button
              onClick={() => toggleItem('adminSetup')}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                checklist.adminSetup
                  ? 'border-green-200 bg-green-50'
                  : 'border-border bg-card'
              }`}
            >
              {checklist.adminSetup ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">Complete setup at admin URL</div>
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={adminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    {adminUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={e => { e.stopPropagation(); handleCopy(adminUrl); }}
                    className="rounded p-0.5 hover:bg-accent"
                  >
                    {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </button>
          )}

          <button
            onClick={() => toggleItem('sslConfigured')}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
              checklist.sslConfigured
                ? 'border-green-200 bg-green-50'
                : 'border-border bg-card'
            }`}
          >
            {checklist.sslConfigured ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-medium">Configure SSL for secure admin access</div>
              <div className="text-xs text-muted-foreground">Go to SSL page to enable HTTPS</div>
            </div>
          </button>

          <button
            onClick={() => toggleItem('backupsConfigured')}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
              checklist.backupsConfigured
                ? 'border-green-200 bg-green-50'
                : 'border-border bg-card'
            }`}
          >
            {checklist.backupsConfigured ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-medium">Set up automatic backups</div>
              <div className="text-xs text-muted-foreground">Go to Backups page to create a schedule</div>
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WordPress Features Card ──────────────────────────────────────────────────

function WordPressFeatures({ app }: { app: InstalledApp }) {
  const adminUrl = getAdminUrl(app);
  const domain = app.domain || app.domainId || '';

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-blue-700">WordPress Management</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => window.open(`/terminal?command=wp%20--path=${app.installPath}`, '_blank')}
          className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          <Terminal className="h-3.5 w-3.5" /> Run WP-CLI
        </button>
        {adminUrl && (
          <a
            href={`${adminUrl}plugins.php`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Manage Plugins
          </a>
        )}
        {adminUrl && (
          <a
            href={`${adminUrl}themes.php`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Manage Themes
          </a>
        )}
      </div>
    </div>
  );
}

// ── Install Modal ────────────────────────────────────────────────────────────

function InstallModal({
  app,
  onClose,
  onInstall,
}: {
  app: AppDefinition;
  onClose: () => void;
  onInstall: (data: {
    appId: string;
    domain: string;
    path: string;
    adminEmail: string;
    adminPassword: string;
    databaseOption?: 'auto' | 'existing';
    databaseId?: string;
  }) => void;
}) {
  const { data: databases } = useDatabases();
  const checkPath = useCheckPath();

  const [domain, setDomain] = useState('');
  const [path, setPath] = useState(app.installPath || '');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Database selection
  const [databaseOption, setDatabaseOption] = useState<'auto' | 'existing'>('auto');
  const [databaseId, setDatabaseId] = useState('');

  // Path check
  const [pathWarning, setPathWarning] = useState(false);
  const [pathFiles, setPathFiles] = useState<string[]>([]);

  const selectedDb = databases?.find((db: any) => db.id === databaseId);

  const handlePathBlur = () => {
    if (!path) return;
    checkPath.mutate(
      { path },
      {
        onSuccess: (result) => {
          if (result.exists && !result.isEmpty) {
            setPathWarning(true);
            setPathFiles(result.files.slice(0, 5));
          } else {
            setPathWarning(false);
            setPathFiles([]);
          }
        },
      },
    );
  };

  const handleSubmit = () => {
    onInstall({
      appId: app.id,
      domain,
      path,
      adminEmail,
      adminPassword,
      databaseOption,
      databaseId: databaseOption === 'existing' ? databaseId : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Install {app.name}</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Domain</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Install Path</label>
            <input
              value={path}
              onChange={(e) => { setPath(e.target.value); setPathWarning(false); }}
              onBlur={handlePathBlur}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="/var/www/html"
            />
            {/* Existing install detection */}
            {pathWarning && (
              <div className="mt-2 rounded-md border border-yellow-300 bg-yellow-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
                  <AlertTriangle className="h-4 w-4" />
                  Target directory is not empty
                </div>
                <p className="mt-1 text-xs text-yellow-600">
                  Existing files may be overwritten. Found: {pathFiles.join(', ')}{pathFiles.length >= 5 ? '...' : ''}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setPathWarning(false)}
                    className="rounded-md bg-yellow-500 px-3 py-1 text-xs text-white hover:bg-yellow-600"
                  >
                    Continue anyway
                  </button>
                  <button
                    onClick={() => { setPath(''); setPathWarning(false); }}
                    className="rounded-md border border-yellow-400 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-100"
                  >
                    Change path
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Admin Email</label>
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="admin@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Admin Password</label>
            <div className="relative">
              <input type={showAdminPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10" />
              <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Database Selection */}
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Database</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="databaseOption"
                  checked={databaseOption === 'auto'}
                  onChange={() => setDatabaseOption('auto')}
                  className="h-4 w-4 border-input"
                />
                <div>
                  <div className="text-sm font-medium">Auto-create new database</div>
                  <div className="text-xs text-muted-foreground">
                    A new database and user will be created automatically
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="databaseOption"
                  checked={databaseOption === 'existing'}
                  onChange={() => setDatabaseOption('existing')}
                  className="h-4 w-4 border-input"
                />
                <div>
                  <div className="text-sm font-medium">Use existing database</div>
                  <div className="text-xs text-muted-foreground">
                    Select from your existing databases
                  </div>
                </div>
              </label>
            </div>

            {databaseOption === 'existing' && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Select Database</label>
                  <select
                    value={databaseId}
                    onChange={e => setDatabaseId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Choose database...</option>
                    {databases?.map((db: any) => (
                      <option key={db.id} value={db.id}>
                        {db.name} ({db.engine})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedDb && (
                  <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                    <div><span className="text-muted-foreground">Database:</span> <span className="font-mono">{selectedDb.name}</span></div>
                    <div><span className="text-muted-foreground">Engine:</span> {selectedDb.engine}</div>
                    <div className="text-yellow-600 mt-1">
                      ⚠️ The app will use this database's existing credentials
                    </div>
                  </div>
                )}
              </div>
            )}

            {databaseOption === 'auto' && (
              <div className="mt-3 rounded-md bg-muted p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Database name:</span> <span className="font-mono">{domain ? domain.replace(/\./g, '_') + '_db' : '(auto-generated)'}</span></div>
                <div><span className="text-muted-foreground">Username:</span> <span className="font-mono">{domain ? domain.replace(/\./g, '_') + '_user' : '(auto-generated)'}</span></div>
                <div><span className="text-muted-foreground">Password:</span> <span className="font-mono">(auto-generated)</span></div>
              </div>
            )}
          </div>

          {app.requirements.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Requirements</p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {app.requirements.map((req: string, i: number) => <li key={i}>{req}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!domain || !adminEmail || (databaseOption === 'existing' && !databaseId)}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Logs Modal ───────────────────────────────────────────────────────────────

function LogsModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { data: logs, isLoading } = useInstallLogs(appId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Installation Logs</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto rounded-md bg-black p-3 font-mono text-xs text-green-400">
          {isLoading ? (
            <LoadingSpinner />
          ) : !logs || logs.length === 0 ? (
            <p className="text-gray-500">No logs available</p>
          ) : (
            logs.map((log: any, i: number) => (
              <div key={i} className={log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-green-400'}>
                [{log.level?.toUpperCase() || 'INFO'}] {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Config Modal ─────────────────────────────────────────────────────────────

function ConfigModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { data: configs, isLoading } = useAppConfigs(appId);
  const setConfig = useSetAppConfig();
  const deleteConfig = useDeleteAppConfig();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (!newKey || !newValue) return;
    setConfig.mutate({ appId, configKey: newKey, configValue: newValue }, { onSuccess: () => { setNewKey(''); setNewValue(''); } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Configuration</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {isLoading ? <LoadingSpinner /> : (
          <div className="space-y-2">
            {configs && configs.map((cfg: any) => (
              <div key={cfg.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <span className="font-mono text-xs font-medium">{cfg.configKey}</span>
                <span className="flex-1 truncate text-muted-foreground">{cfg.configValue}</span>
                <button onClick={() => deleteConfig.mutate({ appId, configKey: cfg.configKey })} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key" className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs" />
              <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs" />
              <button onClick={handleAdd} className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function InstallerPage() {
  const { data: apps, isLoading: appsLoading } = useInstallerApps();
  const { data: installed, isLoading: installedLoading } = useInstalledApps();
  const install = useInstallApp();
  const uninstall = useUninstallApp();
  const update = useUpdateApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [logsAppId, setLogsAppId] = useState('');
  const [configAppId, setConfigAppId] = useState('');

  // Post-install checklist
  const [recentlyInstalled, setRecentlyInstalled] = useState<InstalledApp | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);

  // Admin URL copy state
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredApps = (apps ?? []).filter((app: AppDefinition) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set((apps ?? []).map((a: AppDefinition) => a.category)))];

  const handleInstall = (data: {
    appId: string;
    domain: string;
    path: string;
    adminEmail: string;
    adminPassword: string;
    databaseOption?: 'auto' | 'existing';
    databaseId?: string;
  }) => {
    install.mutate(data, {
      onSuccess: (result) => {
        // Show post-install checklist
        if (result) {
          setRecentlyInstalled(result);
          setShowChecklist(true);
        }
      },
    });
  };

  const handleUninstall = (appId: string) => {
    if (confirm('Are you sure you want to uninstall this app?')) {
      uninstall.mutate({ appId });
    }
  };

  const handleUpdate = (appId: string) => {
    update.mutate({ appId });
  };

  const handleCopyUrl = (url: string, appId: number) => {
    navigator.clipboard.writeText(url);
    setCopiedId(appId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      <PageHeader title="Application Installer" description="Install and manage web applications" />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applications..."
            className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Installed Apps */}
      <h2 className="mb-3 text-lg font-semibold">Installed Apps</h2>
      {installedLoading ? <LoadingSpinner /> : !installed || installed.length === 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">No apps installed yet.</p>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {installed.map((app: InstalledApp) => {
            const badge = getStatusBadge(app.status);
            const adminUrl = getAdminUrl(app);
            const isWordPress = app.appName?.toLowerCase().includes('wordpress');

            return (
              <div key={app.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{app.appName}</h3>
                    <p className="text-xs text-muted-foreground">{app.domain || app.domainId || 'No domain'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>{badge.text}</span>
                </div>

                {/* Admin URL Display */}
                {adminUrl && app.status === 'ready' && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={adminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-xs text-primary hover:underline"
                    >
                      {adminUrl}
                    </a>
                    <button
                      onClick={() => handleCopyUrl(adminUrl, app.id)}
                      className="shrink-0 rounded p-0.5 hover:bg-accent"
                    >
                      {copiedId === app.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )}

                {/* WordPress-specific features */}
                {isWordPress && app.status === 'ready' && (
                  <WordPressFeatures app={app} />
                )}

                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleUpdate(app.appId)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                    <RefreshCw className="h-3 w-3" /> Update
                  </button>
                  <button onClick={() => { setLogsAppId(app.appId); setShowLogs(true); }} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                    <Terminal className="h-3 w-3" /> Logs
                  </button>
                  <button onClick={() => { setConfigAppId(app.appId); setShowConfig(true); }} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                    <Settings className="h-3 w-3" /> Config
                  </button>
                  <button onClick={() => handleUninstall(app.appId)} className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Apps */}
      <h2 className="mb-3 text-lg font-semibold">Available Applications</h2>
      {appsLoading ? <LoadingSpinner /> : filteredApps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app: AppDefinition) => (
            <div key={app.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{app.name}</h3>
                  <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${getCategoryColor(app.category)}`}>
                    {app.category}
                  </span>
                </div>
                <Download className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 flex-1 text-xs text-muted-foreground">{app.description}</p>
              <button
                onClick={() => { setSelectedApp(app); setShowInstall(true); }}
                className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Install
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedApp && showInstall && (
        <InstallModal app={selectedApp} onClose={() => setShowInstall(false)} onInstall={handleInstall} />
      )}
      {showLogs && logsAppId && (
        <LogsModal appId={logsAppId} onClose={() => setShowLogs(false)} />
      )}
      {showConfig && configAppId && (
        <ConfigModal appId={configAppId} onClose={() => setShowConfig(false)} />
      )}
      {showChecklist && recentlyInstalled && (
        <PostInstallChecklist
          app={recentlyInstalled}
          onClose={() => { setShowChecklist(false); setRecentlyInstalled(null); }}
        />
      )}
    </div>
  );
}
