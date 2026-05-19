import { Link, useMatchRoute, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Globe,
  Server,
  Code2,
  ShieldCheck,
  Network,
  Mail,
  Database,
  FolderUp,
  Cloud,
  FolderOpen,
  Terminal,
  Clock,
  Flame,
  Archive,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Bell,
  Package,
  Wrench,
  Layers,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { useServerFeatures } from '../../api/hooks/features';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  /** Feature flag key that must be true to show this item (optional) */
  feature?: 'nginx' | 'apache' | 'mysql' | 'postgresql' | 'postfix' | 'ftp' | 'docker';
}

interface BackLink {
  label: string;
  path: string;
}

interface NavGroupDef {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroupDef[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Web',
    items: [
      { label: 'Domains', path: '/domains', icon: Globe },
      { label: 'Sites', path: '/sites', icon: Layers },
      { label: 'Web Server', path: '/webserver', icon: Server, feature: 'nginx' },
      { label: 'PHP', path: '/php', icon: Code2 },
      { label: 'SSL', path: '/ssl', icon: ShieldCheck },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'DNS', path: '/dns', icon: Network },
      { label: 'Mail', path: '/mail', icon: Mail, feature: 'postfix' },
      { label: 'Databases', path: '/databases', icon: Database, feature: 'mysql' },
      { label: 'FTP', path: '/ftp', icon: FolderUp, feature: 'ftp' },
    ],
  },
  {
    title: 'Network',
    items: [
      { label: 'Cloudflare', path: '/cloudflare', icon: Cloud },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Files', path: '/files', icon: FolderOpen },
      { label: 'Terminal', path: '/terminal', icon: Terminal },
      { label: 'Cron', path: '/cron', icon: Clock },
      { label: 'Firewall', path: '/firewall', icon: Flame },
      { label: 'Logs', path: '/logs', icon: ScrollText },
      { label: 'Monitoring', path: '/monitoring', icon: Activity },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Backups', path: '/backups', icon: Archive },
      { label: 'Installer', path: '/installer', icon: Package },
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'Audit Log', path: '/audit', icon: ScrollText },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', path: '/settings', icon: Settings },
      { label: 'Server Settings', path: '/settings/server', icon: Wrench },
    ],
  },
];

// Back links shown when on a detail page within that section
const BACK_LINKS: BackLink[] = [
  { label: 'All Sites', path: '/sites' },
  { label: 'All Domains', path: '/domains' },
  { label: 'All Databases', path: '/databases' },
  { label: 'All Cron Jobs', path: '/cron' },
  { label: 'All FTP Accounts', path: '/ftp' },
  { label: 'Server Settings', path: '/settings/server' },
];

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

function getStoredCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Determine if the current route matches any back-link section.
 * Returns the back link to show, or null if not on a detail page.
 */
function getActiveBackLink(pathname: string, matchRoute: any): BackLink | null {
  for (const bl of BACK_LINKS) {
    if (pathname.startsWith(bl.path) && bl.path !== '/' && pathname !== bl.path) {
      if (matchRoute({ to: bl.path, fuzzy: true })) {
        return bl;
      }
    }
  }
  return null;
}

/**
 * Filter nav items based on available server features.
 * Items with no `feature` key are always shown.
 * Items with a `feature` key are only shown when that feature is detected.
 */
function getVisibleItems(group: NavGroupDef, features: Record<string, boolean> | null): NavItem[] {
  return group.items.filter(item => {
    if (!item.feature) return true;
    return features?.[item.feature] === true;
  });
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const matchRoute = useMatchRoute();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const { data: features, isLoading } = useServerFeatures();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  const activeBackLink = useMemo(
    () => getActiveBackLink(pathname, matchRoute),
    [pathname, matchRoute]
  );

  // While features are loading, show a collapsed skeleton state
  const isLoadingFeatures = isLoading;

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-primary">ServerForge</span>
        )}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
            collapsed ? 'mx-auto' : 'ml-auto'
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Back link */}
        {!collapsed && activeBackLink && (
          <div className="mb-3">
            <Link
              to={activeBackLink.path}
              className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              {activeBackLink.label}
            </Link>
          </div>
        )}

        {isLoadingFeatures ? (
          // Skeleton loader while features are being fetched
          <div className="space-y-3 px-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="space-y-1.5">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-8 w-full animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          navGroups.map((group) => {
            const visibleItems = getVisibleItems(group, features as unknown as Record<string, boolean> | null);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="mb-3">
                {!collapsed && (
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                )}
                {visibleItems.map((item) => {
                  const isActive = matchRoute({ to: item.path, fuzzy: item.path === '/' ? false : true });
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}