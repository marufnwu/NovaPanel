'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

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
  createdAt: string;
  server: { id: string; name: string; host: string; status: string };
  deploys: Array<{
    id: string;
    status: string;
    gitCommit: string | null;
    gitMessage: string | null;
    durationMs: number | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  const loadSite = useCallback(async () => {
    try {
      const data = await api.get<SiteDetail>(`/sites/${siteId}`);
      setSite(data);
    } catch {
      // site might not exist
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { loadSite(); }, [loadSite]);

  // Auto-poll when provisioning or deploy running
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
      setTimeout(() => loadSite(), 2000);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    } finally {
      setDeploying(false);
    }
  }

  async function handleRestart() {
    try {
      await api.post(`/sites/${siteId}/restart`);
      loadSite();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function handleStop() {
    try {
      await api.post(`/sites/${siteId}/stop`);
      loadSite();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this site? All server resources will be removed.')) return;
    try {
      await api.delete(`/sites/${siteId}`);
      router.push('/sites');
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
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

      {/* Deploy History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Deploy History</h2>
        {site.deploys.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No deploys yet</div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Commit</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Started</th>
                </tr>
              </thead>
              <tbody>
                {site.deploys.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${d.status === 'success' ? 'bg-green-100 text-green-700' : d.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{d.gitMessage || d.gitCommit?.slice(0, 7) || '-'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.durationMs ? `${(d.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(d.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
