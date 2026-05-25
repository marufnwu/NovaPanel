import { Link, useLocation } from '@tanstack/react-router';
import { Icon } from '../icons';
import { cn } from '../../lib/utils';

const navigationGroups = [
  {
    label: 'Websites',
    items: [
      { label: 'Sites', icon: 'icon-host' as const, path: '/sites' },
      { label: 'Databases', icon: 'icon-database' as const, path: '/databases' },
      { label: 'Domains', icon: 'icon-world' as const, path: '/domains' },
      { label: 'SSL', icon: 'icon-lock' as const, path: '/ssl' },
    ],
  },
  {
    label: 'Email',
    items: [
      { label: 'Mail', icon: 'icon-mail' as const, path: '/mail' },
      { label: 'FTP', icon: 'icon-upload' as const, path: '/ftp' },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Firewall', icon: 'icon-shield' as const, path: '/firewall' },
      { label: 'SSL', icon: 'icon-lock' as const, path: '/ssl' },
      { label: 'Fail2Ban', icon: 'icon-shield-check' as const, path: '/security' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Services', icon: 'icon-server' as const, path: '/services' },
      { label: 'Process Manager', icon: 'icon-box' as const, path: '/processes' },
      { label: 'Terminal', icon: 'icon-terminal' as const, path: '/terminal' },
      { label: 'Containers', icon: 'icon-box' as const, path: '/containers' },
      { label: 'Backups', icon: 'icon-backup' as const, path: '/backups' },
    ],
  },
  {
    label: 'Scheduler',
    items: [
      { label: 'Cron Jobs', icon: 'icon-clock' as const, path: '/cron' },
      { label: 'Jobs', icon: 'icon-list' as const, path: '/jobs' },
    ],
  },
  {
    label: 'Logs & Monitoring',
    items: [
      { label: 'Monitoring', icon: 'icon-chart' as const, path: '/monitoring' },
      { label: 'Logs', icon: 'icon-file-text' as const, path: '/logs' },
      { label: 'Audit', icon: 'icon-clipboard' as const, path: '/audit' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Server Settings', icon: 'icon-settings' as const, path: '/settings' },
      { label: 'Security', icon: 'icon-shield-check' as const, path: '/security' },
      { label: 'Profile', icon: 'icon-user' as const, path: '/settings/profile' },
      { label: 'API Tokens', icon: 'icon-key' as const, path: '/settings/api-tokens' },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-[220px] flex-shrink-0 bg-background-secondary border-r border-border-tertiary flex flex-col">
      <div className="h-12 flex items-center px-4 border-b border-border-tertiary">
        <span className="text-card-title font-medium">NovaPanel</span>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-4 mb-1">
              <span className="text-section-label text-foreground-tertiary uppercase tracking-wide">
                {group.label}
              </span>
            </div>
            <ul>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 text-small transition-colors',
                        'hover:bg-background-tertiary'
                      )}
                      style={{ borderLeftWidth: '2px', borderLeftColor: isActive ? 'var(--color-text-info)' : 'transparent', borderLeftStyle: 'solid' }}
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}