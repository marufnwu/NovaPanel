'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

export default function NewSitePage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);

  const [name, setName] = useState('');
  const [serverId, setServerId] = useState('');
  const [stackType, setStackType] = useState('nodejs');
  const [domain, setDomain] = useState('');
  const [port, setPort] = useState('3000');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [envVars, setEnvVars] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Server[]>('/servers').then(setServers).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const parsedEnv: Record<string, string> = {};
      if (envVars.trim()) {
        for (const line of envVars.split('\n')) {
          const [key, ...rest] = line.split('=');
          if (key && rest.length > 0) {
            parsedEnv[key.trim()] = rest.join('=').trim();
          }
        }
      }

      await api.post('/sites', {
        name,
        serverId,
        stackType,
        domain,
        port: parseInt(port),
        gitUrl: gitUrl || null,
        gitBranch: gitBranch || null,
        envVars: parsedEnv,
      });
      router.push('/sites');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Site</h1>
        <p className="text-muted-foreground mt-1">NovaDash will provision everything automatically</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1.5">Site Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="My App" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Server</label>
          <select value={serverId} onChange={(e) => setServerId(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select server...</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Stack</label>
            <select value={stackType} onChange={(e) => setStackType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="nodejs">Node.js</option>
              <option value="php">PHP (Raw)</option>
              <option value="laravel">Laravel</option>
              <option value="python">Python</option>
              <option value="static" disabled>Static (coming soon)</option>
              <option value="docker" disabled>Docker (coming soon)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Port</label>
            <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Domain</label>
          <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="app.example.com" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Git Repository (optional)</label>
          <input type="text" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="https://github.com/user/repo" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Git Branch</label>
          <input type="text" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Environment Variables (KEY=value per line)</label>
          <textarea value={envVars} onChange={(e) => setEnvVars(e.target.value)} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" placeholder="NODE_ENV=production&#10;DB_HOST=localhost" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? 'Creating & provisioning...' : 'Create Site'}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted">Cancel</button>
        </div>
      </form>
    </div>
  );
}
