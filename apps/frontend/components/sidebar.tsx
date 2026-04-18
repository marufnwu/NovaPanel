'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Servers', href: '/servers' },
  { label: 'Sites', href: '/sites' },
  { label: 'Domains', href: '/domains' },
  { label: 'Monitoring', href: '/monitoring' },
  { label: 'Audit Log', href: '/audit' },
  { label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar h-screen flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-bold">NovaDash</h2>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.disabled ? '#' : item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === item.href
                ? 'bg-sidebar-accent font-medium'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              item.disabled && 'opacity-40 pointer-events-none',
            )}
          >
            {item.label}
            {item.disabled && (
              <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">Soon</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-sidebar-accent"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
