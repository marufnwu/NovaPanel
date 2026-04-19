'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';

interface Site {
  id: string;
  serverId: string;
  name: string;
  domain: string;
  stackType: string;
  port: number | null;
  status: string;
  gitUrl: string | null;
  createdAt: string;
  server: { id: string; name: string; status: string };
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<Site[]>('/sites').then(setSites).catch((err) => {
      if (err instanceof ApiError) setError(err.message);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const filtered = sites.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sites</h1>
          <p className="text-muted-foreground mt-1">{sites.length} site{sites.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/sites/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          New Site
        </Link>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {sites.length > 0 && (
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sites..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">{search ? 'No sites match your search.' : 'No sites yet. Create your first site to get started.'}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`} className="rounded-lg border bg-card p-4 hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{site.name}</div>
                  <div className="text-sm text-muted-foreground">{site.domain} &middot; {site.stackType}</div>
                  <div className="text-xs text-muted-foreground mt-1">Server: {site.server.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    site.status === 'live' ? 'bg-green-100 text-green-700' :
                    site.status === 'provisioning' ? 'bg-yellow-100 text-yellow-700' :
                    site.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {site.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
