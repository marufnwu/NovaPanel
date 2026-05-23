import { Link, useMatchRoute, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Globe,
  Layers,
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
  Activity,
  Archive,
  Bell,
  BarChart3,
  ScrollText,
  Settings,
  Key,
  Wrench,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowLeft,
  ShieldAlert,
  HardDrive,
  Box,
  CreditCard,
  Webhook,
  Package,
  Container,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { useServerFeatures } from '../../api/hooks/features';
import { useOrganizations, useSwitchOrganization } from '../../api/hooks/organizations';
import type { Organization } from '../../api/hooks/organizations';
import { useAuthStore } from '../../store/auth.store';

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
    title: 'Apps',
    items: [
      { label: 'Projects', path: '/projects', icon: FolderOpen },
      { label: 'Installer', path: '/installer', icon: Package },
    ],
  },
  {
    title: 'Server',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Services', path: '/services', icon: Server },
      { label: 'Monitoring', path: '/monitoring', icon: Activity },
    ],
  },
  {
    title: 'Domains',
    items: [
      { label: 'Domains', path: '/domains', icon: Globe },
      { label: 'Sites', path: '/sites', icon: Layers },
      { label: 'SSL', path: '/ssl', icon: ShieldCheck },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Files', path: '/files', icon: FolderOpen },
      { label: 'Terminal', path: '/terminal', icon: Terminal },
      { label: 'Cron', path: '/cron', icon: Clock },
      { label: 'Backups', path: '/backups', icon: Archive },
      { label: 'Firewall', path: '/firewall', icon: Flame },
      { label: 'Security', path: '/security', icon: ShieldAlert },
      { label: 'Storage', path: '/storage', icon: HardDrive },
      { label: 'Containers', path: '/containers', icon: Box },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Profile', path: '/settings', icon: Settings },
      { label: 'API Tokens', path: '/settings/api-tokens', icon: Key },
      { label: 'Server Settings', path: '/settings/server', icon: Wrench },
      { label: 'Audit Log', path: '/audit', icon: ScrollText },
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'Jobs', path: '/jobs', icon: BarChart3 },
      { label: 'Webhooks', path: '/webhooks', icon: Webhook },
      { label: 'Plugins', path: '/plugins', icon: Package },
      { label: 'Billing', path: '/billing', icon: CreditCard },
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

function OrganizationSwitcher() {
  const { organizations, activeOrgId, setActiveOrg } = useAuthStore();
  const { data: orgs } = useOrganizations();
  const switchOrg = useSwitchOrganization();
  const [open, setOpen] = useState(false);

  const allOrgs = orgs || organizations || [];
  const activeOrg = allOrgs.find((o: Organization) => o.id === activeOrgId) || allOrgs[0];

  if (allOrgs.length === 0) {
    return (
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          No organizations
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-3 py-3">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 truncate text-left font-medium">{activeOrg?.name || 'Select Org'}</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover shadow-md">
              {allOrgs.map((org: Organization) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setActiveOrg(org.id);
                    switchOrg.mutate(org.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate text-left">{org.name}</span>
                  {org.id === activeOrgId && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
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
          <span className="text-lg font-bold text-primary">NovaPanel</span>
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

      {/* Organization Switcher */}
      {!collapsed && <OrganizationSwitcher />}

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