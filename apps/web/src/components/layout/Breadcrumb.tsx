import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '../../lib/utils';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  sites: 'Sites',
  databases: 'Databases',
  domains: 'Domains',
  ssl: 'SSL',
  dns: 'DNS',
  php: 'PHP',
  webserver: 'Web Server',
  firewall: 'Firewall',
  backups: 'Backups',
  monitoring: 'Monitoring',
  cron: 'Cron Jobs',
  mail: 'Mail',
  logs: 'Logs',
  files: 'Files',
  terminal: 'Terminal',
  containers: 'Containers',
  registries: 'Registries',
  webhooks: 'Webhooks',
  audit: 'Audit',
  billing: 'Billing',
  plugins: 'Plugins',
  installer: 'Installer',
  notifications: 'Notifications',
  security: 'Security',
  jobs: 'Jobs',
  ftp: 'FTP',
  organizations: 'Organizations',
  settings: 'Settings',
  services: 'Services',
  profile: 'Profile',
  'api-tokens': 'API Tokens',
};

export function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-small font-medium">Dashboard</span>;
  }

  return (
    <nav className="flex items-center gap-1 text-small">
      {segments.map((segment, index) => {
        const path = '/' + segments.slice(0, index + 1).join('/');
        const label = routeLabels[segment] || segment;
        const isLast = index === segments.length - 1;

        return (
          <div key={path} className="flex items-center gap-1">
            {!isLast ? (
              <>
                <Link to={path} className="text-foreground-secondary hover:text-foreground-primary">
                  {label}
                </Link>
                <span className="text-foreground-tertiary">/</span>
              </>
            ) : (
              <span className="text-foreground-primary font-medium">{label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}