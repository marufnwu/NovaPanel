import { Outlet, useRouterState } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from '../StatusBar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { Breadcrumb, type BreadcrumbItem } from '../ui/Breadcrumb';
import { getBreadcrumbOverrides } from '../../lib/breadcrumb-store';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setOverrides(getBreadcrumbOverrides());
    const handleChange = () => setOverrides(new Map(getBreadcrumbOverrides()));
    // Poll every 500ms for changes (simple approach without global state)
    const interval = setInterval(handleChange, 500);
    return () => clearInterval(interval);
  }, []);

  const breadcrumbs: BreadcrumbItem[] = buildBreadcrumbs(pathname, overrides);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar as Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <button
              className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-background/80 backdrop-blur-md border border-border shadow-sm lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            />
          }
        />
        <SheetContent side="left" className="w-[280px] p-0 border-r sidebar">
          <div className="flex h-full flex-col">
            <Sidebar />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <div className="px-6 py-3 border-b border-border bg-background/50">
          <Breadcrumb items={breadcrumbs} />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}

function buildBreadcrumbs(pathname: string, overrides: Map<string, string>): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  if (segments.length === 0) {
    return [{ label: 'Dashboard', href: '/' }];
  }

  const routeLabels: Record<string, string> = {
    domains: 'Domains',
    sites: 'Sites',
    'site-detail': 'Site Detail',
    projects: 'Projects',
    registries: 'Registries',
    jobs: 'Jobs',
    organizations: 'Organizations',
    services: 'Services',
    webserver: 'Webserver',
    php: 'PHP',
    ssl: 'SSL',
    dns: 'DNS',
    mail: 'Mail',
    databases: 'Databases',
    'database-detail': 'Database',
    ftp: 'FTP',
    files: 'Files',
    terminal: 'Terminal',
    cron: 'Cron',
    firewall: 'Firewall',
    logs: 'Logs',
    backups: 'Backups',
    audit: 'Audit Log',
    settings: 'Settings',
    'api-tokens': 'API Tokens',
    server: 'Server Settings',
    monitoring: 'Monitoring',
    notifications: 'Notifications',
    installer: 'Installer',
    cloudflare: 'Cloudflare',
    security: 'Security',
    storage: 'Storage',
    containers: 'Containers',
    billing: 'Billing',
    webhooks: 'Webhooks',
    plugins: 'Plugins',
  };

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += '/' + segment;

    if (i === segments.length - 1) {
      if (segment.startsWith('$')) {
        const parentSegment = segments[i - 1];
        const parentLabel = routeLabels[parentSegment] || parentSegment;
        const override = overrides.get(currentPath);
        crumbs.push({ label: override || parentLabel });
      } else {
        const override = overrides.get(currentPath);
        crumbs.push({ label: override || routeLabels[segment] || segment });
      }
    } else {
      crumbs.push({ label: routeLabels[segment] || segment, href: currentPath });
    }
  }

  return crumbs;
}