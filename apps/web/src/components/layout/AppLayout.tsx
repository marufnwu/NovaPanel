import { Outlet, useRouterState } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Breadcrumb, BreadcrumbItem } from '../ui/Breadcrumb';
import { CommandPalette } from '../CommandPalette';
import { useMemo, useState, useEffect } from 'react';

// Map of path segments to readable labels
const PATH_LABELS: Record<string, string> = {
  '': 'Home',
  sites: 'Sites',
  domains: 'Domains',
  webserver: 'Web Server',
  php: 'PHP',
  ssl: 'SSL',
  dns: 'DNS',
  mail: 'Mail',
  databases: 'Databases',
  ftp: 'FTP',
  tunnels: 'Tunnels',
  files: 'Files',
  terminal: 'Terminal',
  cron: 'Cron',
  firewall: 'Firewall',
  logs: 'Logs',
  backups: 'Backups',
  audit: 'Audit Log',
  settings: 'Settings',
  server: 'Server Settings',
  'api-tokens': 'API Tokens',
  monitoring: 'Monitoring',
  notifications: 'Notifications',
  installer: 'Installer',
  cloudflare: 'Cloudflare',
};

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Home', href: '/' }];
  }

  const items: BreadcrumbItem[] = [];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    const label = PATH_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    const isLast = i === segments.length - 1;

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}

export function AppLayout() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const breadcrumbItems = useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  // Global keyboard listener for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        {/* Breadcrumb bar */}
        <div className="border-b border-border bg-card px-6 py-2">
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
