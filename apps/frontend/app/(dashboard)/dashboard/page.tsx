'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface DashboardStats {
  servers: { total: number; online: number };
  sites: { total: number; live: number; provisioning: number; error: number };
  domains: number;
}

interface RecentSite {
  id: string;
  name: string;
  domain: string;
  status: string;
  stackType: string;
  createdAt: string;
}

interface RecentServer {
  id: string;
  name: string;
  host: string;
  status: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSites, setRecentSites] = useState<RecentSite[]>([]);
  const [recentServers, setRecentServers] = useState<RecentServer[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [servers, sites] = await Promise.all([
        api.get<RecentServer[]>('/servers'),
        api.get<any[]>('/sites'),
      ]);

      setRecentServers(servers.slice(0, 5));
      setRecentSites((sites as RecentSite[]).slice(0, 5));

      setStats({
        servers: {
          total: servers.length,
          online: servers.filter((s) => s.status === 'online').length,
        },
        sites: {
          total: (sites as RecentSite[]).length,
          live: (sites as RecentSite[]).filter((s) => s.status === 'live').length,
          provisioning: (sites as RecentSite[]).filter((s) => s.status === 'provisioning').length,
          error: (sites as RecentSite[]).filter((s) => s.status === 'error').length,
        },
        domains: 0,
      });

      // Try to load domain count
      try {
        const zones = await api.get<any[]>('/domains/zones');
        if (stats) setStats({ ...stats, domains: zones.length });
      } catch {}
    } catch {}
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'live': return 'bg-green-500';
      case 'offline':
      case 'down':
      case 'error': return 'bg-red-500';
      case 'provisioning': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.email}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Servers</div>
          <div className="text-3xl font-bold mt-2">{stats?.servers.total ?? '—'}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats ? `${stats.servers.online} online` : 'Loading...'}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Sites</div>
          <div className="text-3xl font-bold mt-2">{stats?.sites.total ?? '—'}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats ? `${stats.sites.live} live` : 'Loading...'}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Provisioning</div>
          <div className="text-3xl font-bold mt-2">{stats?.sites.provisioning ?? '—'}</div>
          <p className="text-xs text-muted-foreground mt-1">In progress</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Errors</div>
          <div className="text-3xl font-bold mt-2 text-red-600">{stats?.sites.error ?? '—'}</div>
          <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/servers/new" className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors">
          <div className="font-medium">+ Add Server</div>
          <p className="text-sm text-muted-foreground mt-1">Connect via SSH credentials or key</p>
        </Link>
        <Link href="/sites/new" className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors">
          <div className="font-medium">+ Create Site</div>
          <p className="text-sm text-muted-foreground mt-1">Auto-provision with stack driver</p>
        </Link>
        <Link href="/domains" className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors">
          <div className="font-medium">Manage Domains</div>
          <p className="text-sm text-muted-foreground mt-1">Cloudflare DNS & zones</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Servers */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Servers</h2>
            <Link href="/servers" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentServers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No servers yet</p>
          ) : (
            <div className="space-y-2">
              {recentServers.map((server) => (
                <Link key={server.id} href={`/servers/${server.id}`} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${statusColor(server.status)}`} />
                    <span className="text-sm">{server.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{server.host}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sites */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Sites</h2>
            <Link href="/sites" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentSites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No sites yet</p>
          ) : (
            <div className="space-y-2">
              {recentSites.map((site) => (
                <Link key={site.id} href={`/sites/${site.id}`} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${statusColor(site.status)}`} />
                    <span className="text-sm">{site.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{site.domain}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
