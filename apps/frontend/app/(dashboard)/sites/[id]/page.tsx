'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { useToast } from '@/components/toast';

interface SiteDetail {
  id: string;
  name: string;
  domain: string;
  stackType: string;
  port: number | null;
  status: string;
  rootPath: string | null;
  gitUrl: string | null;
  gitBranch: string | null;
  deployWebhookToken: string | null;
  createdAt: string;
  server: { id: string; name: string; host: string; status: string };
  deploys: Array<{
    id: string;
    status: string;
    gitCommit: string | null;
    gitMessage: string | null;
    logOutput: string | null;
    durationMs: number | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const siteId = params.id as string;

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [tab, setTab] = useState<'deploys' | 'env' | 'ssl' | 'logs' | 'backups' | 'webhook'>('deploys');

  const loadSite = useCallback(async () => {
    try {
      const data = await api.get<SiteDetail>(`/sites/${siteId}`);
      setSite(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { loadSite(); }, [loadSite]);

  useEffect(() => {
    const hasRunning = site?.deploys?.some((d) => d.status === 'running');
    if (site?.status === 'provisioning' || hasRunning) {
      const interval = setInterval(loadSite, 3000);
      return () => clearInterval(interval);
    }
  }, [site?.status, site?.deploys, loadSite]);

  async function handleDeploy() {
    setDeploying(true);
    try {
      await api.post(`/sites/${siteId}/deploy`);
      toast('Deploy triggered', 'success');
      setTimeout(() => loadSite(), 2000);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    } finally {
      setDeploying(false);
    }
  }

  async function handleRestart() {
    try {
      await api.post(`/sites/${siteId}/restart`);
      toast('Site restarted', 'success');
      loadSite();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function handleStop() {
    try {
      await api.post(`/sites/${siteId}/stop`);
      toast('Site stopped', 'success');
      loadSite();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this site? All server resources will be removed.')) return;
    try {
      await api.delete(`/sites/${siteId}`);
      router.push('/sites');
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!site) return <div className="p-6 text-destructive">Site not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{site.domain} &middot; {site.stackType}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDeploy} disabled={deploying} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
          <button onClick={handleRestart} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">Restart</button>
          <button onClick={handleStop} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">Stop</button>
          <button onClick={handleDelete} className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">Delete</button>
        </div>
      </div>

      {/* Status */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className={`mt-1 font-medium ${site.status === 'live' ? 'text-green-600' : site.status === 'error' ? 'text-red-600' : ''}`}>{site.status}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Server</span>
            <p className="mt-1">{site.server.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Port</span>
            <p className="mt-1">{site.port || '-'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Git</span>
            <p className="mt-1 truncate">{site.gitUrl ? `${site.gitBranch || 'main'}` : 'None'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Root</span>
            <p className="mt-1 font-mono text-xs">{site.rootPath || '-'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['deploys', 'env', 'ssl', 'logs', 'backups', 'webhook'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {{ deploys: 'Deploys', env: 'Env Vars', ssl: 'SSL', logs: 'Logs', backups: 'Backups', webhook: 'Webhook' }[t]}
          </button>
        ))}
      </div>

      {tab === 'deploys' && <DeploysTab deploys={site.deploys} />}
      {tab === 'env' && <EnvTab siteId={siteId} />}
      {tab === 'ssl' && <SSLTab siteId={siteId} domain={site.domain} />}
      {tab === 'logs' && <LogsTab siteId={siteId} />}
      {tab === 'backups' && <BackupsTab siteId={siteId} siteName={site.name} />}
      {tab === 'webhook' && <WebhookTab siteId={siteId} token={site.deployWebhookToken} />}
    </div>
  );
}

// ─── Deploys Tab ───

function DeploysTab({ deploys }: { deploys: SiteDetail['deploys'] }) {
  const [expandedDeploy, setExpandedDeploy] = useState<string | null>(null);

  if (deploys.length === 0) {
    return <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No deploys yet</div>;
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Commit</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Duration</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Started</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody>
          {deploys.map((d) => (
            <>
              <tr key={d.id} className="border-b cursor-pointer hover:bg-muted/30" onClick={() => setExpandedDeploy(expandedDeploy === d.id ? null : d.id)}>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.status === 'success' ? 'bg-green-100 text-green-700' : d.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{d.gitMessage || d.gitCommit?.slice(0, 7) || '-'}</td>
                <td className="px-4 py-2 text-muted-foreground">{d.durationMs ? `${(d.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                <td className="px-4 py-2 text-muted-foreground">{new Date(d.startedAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{d.logOutput ? '▼' : ''}</td>
              </tr>
              {expandedDeploy === d.id && d.logOutput && (
                <tr key={`${d.id}-log`}>
                  <td colSpan={5} className="px-4 py-3 bg-muted/20">
                    <pre className="text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">{d.logOutput}</pre>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Env Vars Tab ───

function EnvTab({ siteId }: { siteId: string }) {
  const { toast } = useToast();
  const [envVars, setEnvVars] = useState<Array<{ id: string; key: string; version: number }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [revealKey, setRevealKey] = useState<string | null>(null);

  useEffect(() => { loadEnv(); }, [siteId]);

  async function loadEnv() {
    try {
      const res = await api.get<{ ok: boolean; data: any[] }>(`/sites/${siteId}/env`);
      setEnvVars(res.data);
    } catch {}
  }

  async function addEnvVar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/sites/${siteId}/env`, { key: newKey, value: newValue });
      setNewKey('');
      setNewValue('');
      toast(`Set ${newKey}`, 'success');
      loadEnv();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function deleteEnvVar(key: string) {
    try {
      await api.delete(`/sites/${siteId}/env/${encodeURIComponent(key)}`);
      toast(`Removed ${key}`, 'success');
      loadEnv();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addEnvVar} className="flex gap-2">
        <input type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} required placeholder="KEY" className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} required placeholder="value" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Add</button>
      </form>

      {envVars.length === 0 ? (
        <p className="text-sm text-muted-foreground">No environment variables set.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Key</th>
                <th className="text-left px-4 py-2 font-medium">Version</th>
                <th className="text-left px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {envVars.map((ev) => (
                <tr key={ev.key} className="border-b">
                  <td className="px-4 py-2 font-mono text-xs">{ev.key}</td>
                  <td className="px-4 py-2 text-muted-foreground">v{ev.version}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => deleteEnvVar(ev.key)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SSL Tab ───

function SSLTab({ siteId, domain }: { siteId: string; domain: string }) {
  const { toast } = useToast();
  const [ssl, setSsl] = useState<{ sslMode: string | null; provider: string | null } | null>(null);

  useEffect(() => {
    api.get<{ ok: boolean; data: any }>(`/sites/${siteId}/ssl`).then((res) => setSsl(res.data)).catch(() => {});
  }, [siteId]);

  async function setSslMode(mode: string) {
    try {
      await api.put(`/sites/${siteId}/ssl`, { sslMode: mode });
      toast(`SSL mode set to ${mode}`, 'success');
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function installCertbot() {
    try {
      await api.post(`/sites/${siteId}/ssl/certbot`);
      toast('Let\'s Encrypt certificate installed', 'success');
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">Current SSL</h3>
        {!ssl ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Mode</span>
              <p className="mt-1 font-medium">{ssl.sslMode || 'None'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Provider</span>
              <p className="mt-1">{ssl.provider || 'None'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">Cloudflare SSL Mode</h3>
        <div className="flex flex-wrap gap-2">
          {['off', 'flexible', 'full', 'strict', 'full_strict'].map((mode) => (
            <button key={mode} onClick={() => setSslMode(mode)} className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted">
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">Let's Encrypt (Certbot)</h3>
        <p className="text-sm text-muted-foreground">Install a free SSL certificate directly on the server. Requires a public IP (no tunnel).</p>
        <button onClick={installCertbot} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          Install Certificate
        </button>
      </div>
    </div>
  );
}

// ─── Logs Tab ───

function LogsTab({ siteId }: { siteId: string }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState('');
  const [logType, setLogType] = useState('app');
  const [lines, setLines] = useState('100');

  useEffect(() => { loadLogs(); }, [logType]);

  async function loadLogs() {
    try {
      const res = await api.get<{ ok: boolean; data: { logs: string } }>(`/sites/${siteId}/logs?type=${logType}&lines=${lines}`);
      setLogs(res.data.logs);
    } catch {
      setLogs('Failed to load logs');
    }
  }

  async function copyLogs() {
    await navigator.clipboard.writeText(logs);
    toast('Copied to clipboard', 'success');
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select value={logType} onChange={(e) => setLogType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
          <option value="app">Application</option>
          <option value="nginx_access">Nginx Access</option>
          <option value="nginx_error">Nginx Error</option>
          <option value="deploy">Deploy</option>
        </select>
        <input type="number" value={lines} onChange={(e) => setLines(e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        <button onClick={loadLogs} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">Refresh</button>
        <button onClick={copyLogs} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">Copy</button>
      </div>
      <pre className="rounded-lg border bg-black text-green-400 p-4 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">{logs || 'No logs available'}</pre>
    </div>
  );
}

// ─── Backups Tab ───

function BackupsTab({ siteId, siteName }: { siteId: string; siteName: string }) {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Array<{ name: string; path: string; size: number }>>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadBackups(); }, [siteId]);

  async function loadBackups() {
    try {
      const res = await api.get<{ ok: boolean; data: any[] }>(`/sites/${siteId}/backups`);
      setBackups(res.data);
    } catch {}
  }

  async function createBackup() {
    setCreating(true);
    try {
      await api.post(`/sites/${siteId}/backup`);
      toast('Backup created', 'success');
      loadBackups();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function restoreBackup(path: string) {
    if (!confirm('Restore this backup? Current files will be overwritten.')) return;
    try {
      await api.post(`/sites/${siteId}/backups/restore`, { backupPath: path });
      toast('Backup restored', 'success');
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function deleteBackup(path: string) {
    try {
      await api.post(`/sites/${siteId}/backups/delete`, { backupPath: path });
      toast('Backup deleted', 'success');
      loadBackups();
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  function formatSize(bytes: number) {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={createBackup} disabled={creating} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>
      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No backups yet.</p>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div key={b.path} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="text-sm font-mono">{b.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(b.size)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => restoreBackup(b.path)} className="text-xs text-primary hover:underline">Restore</button>
                <button onClick={() => deleteBackup(b.path)} className="text-xs text-destructive hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Webhook Tab ───

function WebhookTab({ siteId, token }: { siteId: string; token: string | null }) {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  async function generateWebhook() {
    try {
      const res = await api.post<{ ok: boolean; data: { url: string; token: string } }>(`/sites/${siteId}/webhook`);
      setWebhookUrl(res.data.url);
      toast('Webhook created', 'success');
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function revokeWebhook() {
    try {
      await api.delete(`/sites/${siteId}/webhook`);
      setWebhookUrl(null);
      toast('Webhook revoked', 'success');
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
    }
  }

  async function copyUrl() {
    if (webhookUrl) {
      const fullUrl = `${window.location.origin}${webhookUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      toast('Copied to clipboard', 'success');
    }
  }

  const fullUrl = webhookUrl ? `${window.location.origin}${webhookUrl}` : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">Deploy Webhook</h3>
        <p className="text-sm text-muted-foreground">
          Generate a webhook URL to trigger automatic deploys from your CI/CD pipeline.
          Send a POST request to the URL to trigger a deploy.
        </p>

        {fullUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono truncate">{fullUrl}</code>
              <button onClick={copyUrl} className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted">Copy</button>
            </div>
            <button onClick={revokeWebhook} className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              Revoke Webhook
            </button>
          </div>
        ) : (
          <button onClick={generateWebhook} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Generate Webhook URL
          </button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="font-medium">Usage</h3>
        <pre className="rounded bg-muted p-3 text-xs font-mono">
{`# GitHub Actions
- name: Deploy
  run: curl -X POST ${fullUrl || 'https://your-panel.com/api/v1/hooks/deploy/TOKEN'}

# GitLab CI
deploy:
  script: curl -X POST ${fullUrl || 'https://your-panel.com/api/v1/hooks/deploy/TOKEN'}

# Generic
curl -X POST ${fullUrl || 'https://your-panel.com/api/v1/hooks/deploy/TOKEN'}`}
        </pre>
      </div>
    </div>
  );
}
