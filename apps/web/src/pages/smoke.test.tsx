import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '../../test/memory-router';

const pages = [
  { name: 'DashboardPage', path: '/dashboard' },
  { name: 'LoginPage', path: '/login' },
  { name: 'SitesPage', path: '/sites' },
  { name: 'SiteDetailPage', path: '/sites/site-123' },
  { name: 'DatabasesPage', path: '/databases' },
  { name: 'DatabaseDetailPage', path: '/databases/db-123' },
  { name: 'DomainsPage', path: '/domains' },
  { name: 'DomainDetailPage', path: '/domains/domain-123' },
  { name: 'CronPage', path: '/cron' },
  { name: 'InstallerPage', path: '/installer' },
  { name: 'ServicesPage', path: '/services' },
  { name: 'FirewallPage', path: '/firewall' },
  { name: 'BackupsPage', path: '/backups' },
  { name: 'TerminalPage', path: '/terminal' },
  { name: 'FilesPage', path: '/files' },
  { name: 'DnsPage', path: '/dns' },
  { name: 'SslPage', path: '/ssl' },
  { name: 'MailPage', path: '/mail' },
  { name: 'FtpPage', path: '/ftp' },
  { name: 'MonitoringPage', path: '/monitoring' },
  { name: 'LogsPage', path: '/logs' },
  { name: 'ContainersPage', path: '/containers' },
  { name: 'JobsPage', path: '/jobs' },
  { name: 'AuditPage', path: '/audit' },
  { name: 'ServerSettingsPage', path: '/settings' },
  { name: 'SecurityPage', path: '/security' },
  { name: 'NotificationsPage', path: '/notifications' },
  { name: 'WebhooksPage', path: '/webhooks' },
  { name: 'ApiTokensPage', path: '/settings/api-tokens' },
  { name: 'PluginsPage', path: '/plugins' },
  { name: 'BillingPage', path: '/billing' },
  { name: 'OrganizationsPage', path: '/organizations' },
  { name: 'ProfilePage', path: '/settings/profile' },
  { name: 'WebserverPage', path: '/webserver' },
  { name: 'PhpPage', path: '/php' },
  { name: 'RegistriesPage', path: '/registries' },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar">sidebar</aside>,
}));

vi.mock('@/components/layout/Topbar', () => ({
  Topbar: () => <header data-testid="topbar">topbar</header>,
}));

vi.mock('@/components/layout/StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar">status-bar</div>,
}));

vi.mock('@/components/layout/Breadcrumb', () => ({
  Breadcrumb: () => <nav data-testid="breadcrumb">breadcrumb</nav>,
}));

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet">Content</div>,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => (to: string) => { console.log('navigate to:', to); },
  useParams: () => ({ siteId: 'site-123', databaseId: 'db-123', domainId: 'domain-123' }),
  useSearch: () => ({}),
}));

describe('Page smoke tests', () => {
  pages.forEach(({ name, path }) => {
    it(`${name} renders without crashing at ${path}`, async () => {
      let Component: React.ComponentType | null = null;

      switch (name) {
        case 'DashboardPage':
          const { DashboardPage } = await import('@/pages/dashboard/DashboardPage');
          Component = DashboardPage;
          break;
        case 'LoginPage':
          const { LoginPage } = await import('@/pages/login/LoginPage');
          Component = LoginPage;
          break;
        case 'SitesPage':
          const { SitesPage } = await import('@/pages/sites/SitesPage');
          Component = SitesPage;
          break;
        case 'SiteDetailPage':
          const { SiteDetailPage } = await import('@/pages/sites/SiteDetailPage');
          Component = SiteDetailPage;
          break;
        case 'DatabasesPage':
          const { DatabasesPage } = await import('@/pages/databases/DatabasesPage');
          Component = DatabasesPage;
          break;
        case 'DatabaseDetailPage':
          const { DatabaseDetailPage } = await import('@/pages/databases/DatabaseDetailPage');
          Component = DatabaseDetailPage;
          break;
        case 'DomainsPage':
          const { DomainsPage } = await import('@/pages/domains/DomainsPage');
          Component = DomainsPage;
          break;
        case 'DomainDetailPage':
          const { DomainDetailPage } = await import('@/pages/domains/DomainDetailPage');
          Component = DomainDetailPage;
          break;
        case 'CronPage':
          const { CronPage } = await import('@/pages/cron/CronPage');
          Component = CronPage;
          break;
        case 'InstallerPage':
          const { InstallerPage } = await import('@/pages/installer/InstallerPage');
          Component = InstallerPage;
          break;
        case 'ServicesPage':
          const { ServicesPage } = await import('@/pages/services/ServicesPage');
          Component = ServicesPage;
          break;
        case 'FirewallPage':
          const { FirewallPage } = await import('@/pages/firewall/FirewallPage');
          Component = FirewallPage;
          break;
        case 'BackupsPage':
          const { BackupsPage } = await import('@/pages/backups/BackupsPage');
          Component = BackupsPage;
          break;
        case 'TerminalPage':
          const { TerminalPage } = await import('@/pages/terminal/TerminalPage');
          Component = TerminalPage;
          break;
        case 'FilesPage':
          const { FilesPage } = await import('@/pages/files/FilesPage');
          Component = FilesPage;
          break;
        case 'DnsPage':
          const { DnsPage } = await import('@/pages/dns/DnsPage');
          Component = DnsPage;
          break;
        case 'SslPage':
          const { SslPage } = await import('@/pages/ssl/SslPage');
          Component = SslPage;
          break;
        case 'MailPage':
          const { MailPage } = await import('@/pages/mail/MailPage');
          Component = MailPage;
          break;
        case 'FtpPage':
          const { FtpPage } = await import('@/pages/ftp/FtpPage');
          Component = FtpPage;
          break;
        case 'MonitoringPage':
          const { MonitoringPage } = await import('@/pages/monitoring/MonitoringPage');
          Component = MonitoringPage;
          break;
        case 'LogsPage':
          const { LogsPage } = await import('@/pages/logs/LogsPage');
          Component = LogsPage;
          break;
        case 'ContainersPage':
          const { ContainersPage } = await import('@/pages/containers/ContainersPage');
          Component = ContainersPage;
          break;
        case 'JobsPage':
          const { JobsPage } = await import('@/pages/jobs/JobsPage');
          Component = JobsPage;
          break;
        case 'AuditPage':
          const { AuditPage } = await import('@/pages/audit/AuditPage');
          Component = AuditPage;
          break;
        case 'ServerSettingsPage':
          const { ServerSettingsPage } = await import('@/pages/settings/ServerSettingsPage');
          Component = ServerSettingsPage;
          break;
        case 'SecurityPage':
          const { SecurityPage } = await import('@/pages/security/SecurityPage');
          Component = SecurityPage;
          break;
        case 'NotificationsPage':
          const { NotificationsPage } = await import('@/pages/notifications/NotificationsPage');
          Component = NotificationsPage;
          break;
        case 'WebhooksPage':
          const { WebhooksPage } = await import('@/pages/webhooks/WebhooksPage');
          Component = WebhooksPage;
          break;
        case 'ApiTokensPage':
          const { ApiTokensPage } = await import('@/pages/settings/ApiTokensPage');
          Component = ApiTokensPage;
          break;
        case 'PluginsPage':
          const { PluginsPage } = await import('@/pages/plugins/PluginsPage');
          Component = PluginsPage;
          break;
        case 'BillingPage':
          const { BillingPage } = await import('@/pages/billing/BillingPage');
          Component = BillingPage;
          break;
        case 'OrganizationsPage':
          const { OrganizationsPage } = await import('@/pages/organizations/OrganizationsPage');
          Component = OrganizationsPage;
          break;
        case 'ProfilePage':
          const { ProfilePage } = await import('@/pages/settings/ProfilePage');
          Component = ProfilePage;
          break;
        case 'WebserverPage':
          const { WebserverPage } = await import('@/pages/webserver/WebserverPage');
          Component = WebserverPage;
          break;
        case 'PhpPage':
          const { PhpPage } = await import('@/pages/php/PhpPage');
          Component = PhpPage;
          break;
        case 'RegistriesPage':
          const { RegistriesPage } = await import('@/pages/registries/RegistriesPage');
          Component = RegistriesPage;
          break;
      }

      if (Component) {
        const { container } = render(<Component />, { wrapper: createWrapper() });
        expect(container).toBeTruthy();
      }
    });
  });
});