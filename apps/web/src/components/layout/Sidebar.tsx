import { Link, useMatchRoute } from '@tanstack/react-router';
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
  Waypoints,
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Web',
    items: [
      { label: 'Sites', path: '/sites', icon: Globe },
      { label: 'Web Server', path: '/webserver', icon: Server },
      { label: 'PHP', path: '/php', icon: Code2 },
      { label: 'SSL', path: '/ssl', icon: ShieldCheck },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'DNS', path: '/dns', icon: Network },
      { label: 'Mail', path: '/mail', icon: Mail },
      { label: 'Databases', path: '/databases', icon: Database },
      { label: 'FTP', path: '/ftp', icon: FolderUp },
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

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

function getStoredCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const matchRoute = useMatchRoute();

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

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
        {navGroups.map((group) => (
          <div key={group.title} className="mb-3">
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
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
        ))}
      </nav>
    </aside>
  );
}
