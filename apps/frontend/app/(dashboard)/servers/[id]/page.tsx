'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  status: string;
  tags: string[];
  osInfo: { distro?: string; arch?: string; kernel?: string } | null;
  createdAt: string;
  tunnel: { id: string; name: string; status: string } | null;
}

interface Metrics {
  cpuPercent: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number | null;
  diskTotal: number | null;
  loadAvg: { '1m': number; '5m': number; '15m': number } | null;
  recordedAt: string;
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;

  const [server, setServer] = useState<Server | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; osInfo?: Record<string, string>; error?: string } | null>(null);

  const loadServer = useCallback(async () => {
    try {
      const data = await api.get<Server>(`/servers/${serverId}`);
      setServer(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await api.get<Metrics>(`/servers/${serverId}/metrics`);
      setMetrics(data);
    } catch {
      // metrics not available yet
    }
  }, [serverId]);

  useEffect(() => {
    loadServer();
  }, [loadServer]);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 10000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ connected: boolean; osInfo?: Record<string, string>; error?: string }>(
        `/servers/${serverId}/test-connection`,
      );
      setTestResult(result);
      if (result.connected) loadServer();
    } catch (err) {
      if (err instanceof ApiError) setTestResult({ connected: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleConnect() {
    try {
      await api.post(`/servers/${serverId}/connect`);
      loadServer();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove this server? Historical data will be kept.')) return;
    try {
      await api.delete(`/servers/${serverId}`);
      router.push('/servers');
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!server) return <div className="p-6 text-destructive">{error || 'Server not found'}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{server.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {server.username}@{server.host}:{server.port}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleTestConnection} disabled={testing} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button onClick={handleConnect} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
            Connect
          </button>
          <button onClick={handleDelete} className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">
            Remove
          </button>
        </div>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div className={`rounded-md p-3 text-sm ${testResult.connected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {testResult.connected ? (
            <span>Connected successfully. OS: {testResult.osInfo?.distro ?? 'detected'}</span>
          ) : (
            <span>Connection failed: {testResult.error}</span>
          )}
        </div>
      )}

      {/* Server Info */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Server Info</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2.5 h-2.5 rounded-full ${server.status === 'online' ? 'bg-green-500' : server.status === 'offline' ? 'bg-red-500' : 'bg-gray-400'}`} />
              <span className="capitalize">{server.status}</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Auth</span>
            <p className="mt-1 capitalize">{server.authType}</p>
          </div>
          {server.osInfo && (
            <>
              <div>
                <span className="text-muted-foreground">OS</span>
                <p className="mt-1">{server.osInfo.distro ?? 'Unknown'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Arch</span>
                <p className="mt-1">{server.osInfo.arch ?? 'Unknown'}</p>
              </div>
            </>
          )}
        </div>
        {server.tags.length > 0 && (
          <div className="flex gap-1 pt-1">
            {server.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        <h2 className="font-semibold">System Metrics</h2>
        {!metrics ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            No metrics available. Connect the server to start collecting metrics.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="CPU"
              value={`${metrics.cpuPercent.toFixed(1)}%`}
              sub={`Load: ${metrics.loadAvg?.['1m'].toFixed(2) ?? '-'}`}
            />
            <MetricCard
              label="RAM"
              value={formatBytes(metrics.ramUsed)}
              sub={`of ${formatBytes(metrics.ramTotal)}`}
            />
            <MetricCard
              label="Disk"
              value={metrics.diskUsed != null ? formatBytes(metrics.diskUsed) : '-'}
              sub={metrics.diskTotal != null ? `of ${formatBytes(metrics.diskTotal)}` : ''}
            />
            <MetricCard
              label="Load Average"
              value={metrics.loadAvg ? metrics.loadAvg['1m'].toFixed(2) : '-'}
              sub={`5m: ${metrics.loadAvg?.['5m'].toFixed(2) ?? '-'} / 15m: ${metrics.loadAvg?.['15m'].toFixed(2) ?? '-'}`}
            />
          </div>
        )}
      </div>

      {/* Firewall & Cron */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FirewallSection serverId={serverId} />
        <CronSection serverId={serverId} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${bytes} B`;
}

// ─── Firewall Section ───

interface FwRule {
  id: string;
  action: string;
  port: number | null;
  protocol: string;
  source: string;
  createdAt: string;
}

function FirewallSection({ serverId }: { serverId: string }) {
  const [rules, setRules] = useState<FwRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fwAction, setFwAction] = useState('allow');
  const [fwPort, setFwPort] = useState('');
  const [fwProtocol, setFwProtocol] = useState('tcp');
  const [fwSource, setFwSource] = useState('any');

  useEffect(() => { loadRules(); }, [serverId]);

  async function loadRules() {
    try {
      const res = await api.get<{ ok: boolean; data: FwRule[] }>(`/servers/${serverId}/firewall`);
      setRules(res.data);
    } catch {}
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/servers/${serverId}/firewall`, {
        action: fwAction,
        port: fwPort ? parseInt(fwPort) : undefined,
        protocol: fwProtocol,
        source: fwSource || 'any',
      });
      setShowForm(false);
      setFwPort('');
      loadRules();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function deleteRule(ruleId: string) {
    try {
      await api.delete(`/servers/${serverId}/firewall/${ruleId}`);
      loadRules();
    } catch {}
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Firewall</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-primary hover:underline">
          {showForm ? 'Cancel' : '+ Add Rule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addRule} className="space-y-2 border rounded-md p-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={fwAction} onChange={(e) => setFwAction(e.target.value)} className="rounded border border-input bg-background px-2 py-1.5 text-xs">
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
            <select value={fwProtocol} onChange={(e) => setFwProtocol(e.target.value)} className="rounded border border-input bg-background px-2 py-1.5 text-xs">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={fwPort} onChange={(e) => setFwPort(e.target.value)} placeholder="Port" className="rounded border border-input bg-background px-2 py-1.5 text-xs" />
            <input type="text" value={fwSource} onChange={(e) => setFwSource(e.target.value)} placeholder="Source (any)" className="rounded border border-input bg-background px-2 py-1.5 text-xs" />
          </div>
          <button type="submit" className="w-full rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground">Add</button>
        </form>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">No firewall rules configured.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between text-xs border-b pb-1.5">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 font-medium ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {rule.action}
                </span>
                <span className="font-mono">{rule.port || 'all'}/{rule.protocol}</span>
                <span className="text-muted-foreground">from {rule.source}</span>
              </div>
              <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive">x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cron Section ───

interface CronJob {
  id: string;
  expression: string;
  command: string;
  description: string | null;
  lastRunAt: string | null;
  lastOutput: string | null;
}

function CronSection({ serverId }: { serverId: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [cronExpr, setCronExpr] = useState('');
  const [cronCmd, setCronCmd] = useState('');
  const [cronDesc, setCronDesc] = useState('');

  useEffect(() => { loadJobs(); }, [serverId]);

  async function loadJobs() {
    try {
      const res = await api.get<{ ok: boolean; data: CronJob[] }>(`/servers/${serverId}/cron`);
      setJobs(res.data);
    } catch {}
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/servers/${serverId}/cron`, {
        expression: cronExpr,
        command: cronCmd,
        description: cronDesc || undefined,
      });
      setShowForm(false);
      setCronExpr('');
      setCronCmd('');
      setCronDesc('');
      loadJobs();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function deleteJob(jobId: string) {
    try {
      await api.delete(`/servers/${serverId}/cron/${jobId}`);
      loadJobs();
    } catch {}
  }

  async function runJob(jobId: string) {
    try {
      await api.post(`/servers/${serverId}/cron/${jobId}/run`);
      loadJobs();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Cron Jobs</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-primary hover:underline">
          {showForm ? 'Cancel' : '+ Add Job'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addJob} className="space-y-2 border rounded-md p-3">
          <input type="text" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} required placeholder="*/5 * * * *" className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-mono" />
          <input type="text" value={cronCmd} onChange={(e) => setCronCmd(e.target.value)} required placeholder="/usr/bin/php /var/www/site/artisan schedule:run" className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-mono" />
          <input type="text" value={cronDesc} onChange={(e) => setCronDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
          <button type="submit" className="w-full rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground">Create</button>
        </form>
      )}

      {jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No cron jobs configured.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {jobs.map((job) => (
            <div key={job.id} className="border rounded-md p-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-muted-foreground">{job.expression}</span>
                  <p className="font-mono truncate mt-0.5">{job.command}</p>
                  {job.description && <p className="text-muted-foreground mt-0.5">{job.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => runJob(job.id)} className="px-1.5 py-0.5 rounded border hover:bg-muted">Run</button>
                  <button onClick={() => deleteJob(job.id)} className="px-1.5 py-0.5 rounded border text-destructive hover:bg-destructive/10">x</button>
                </div>
              </div>
              {job.lastRunAt && (
                <p className="text-muted-foreground mt-1">Last run: {new Date(job.lastRunAt).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
