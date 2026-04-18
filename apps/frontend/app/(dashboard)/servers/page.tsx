'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  status: string;
  tags: string[];
  osInfo: { distro?: string; arch?: string } | null;
  createdAt: string;
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadServers() {
    try {
      const data = await api.get<Server[]>('/servers');
      setServers(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServers();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Remove this server? Historical data will be kept.')) return;
    try {
      await api.delete(`/servers/${id}`);
      setServers((s) => s.filter((srv) => srv.id !== id));
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading servers...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-muted-foreground mt-1">{servers.length} server{servers.length !== 1 ? 's' : ''} connected</p>
        </div>
        <Link
          href="/servers/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Server
        </Link>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {servers.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No servers yet. Add your first server to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <div key={server.id} className="rounded-lg border bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <StatusBadge status={server.status} />
                <div className="min-w-0">
                  <Link href={`/servers/${server.id}`} className="font-medium hover:underline">
                    {server.name}
                  </Link>
                  <p className="text-sm text-muted-foreground truncate">
                    {server.username}@{server.host}:{server.port}
                  </p>
                  {server.osInfo?.distro && (
                    <p className="text-xs text-muted-foreground">{server.osInfo.distro}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {server.tags.length > 0 && (
                  <div className="flex gap-1">
                    {server.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleDelete(server.id)}
                  className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${colors[status] || colors.unknown}`} />
      <span className="text-xs capitalize text-muted-foreground">{status}</span>
    </div>
  );
}
