import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  useParams,
} from '@tanstack/react-router';
import { PageErrorBoundary } from './components/ui/PageErrorBoundary';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { DomainsPage } from './pages/domains/DomainsPage';
import { WebserverPage } from './pages/webserver/WebserverPage';
import { PhpPage } from './pages/php/PhpPage';
import { SslPage } from './pages/ssl/SslPage';
import { DnsPage } from './pages/dns/DnsPage';
import { MailPage } from './pages/mail/MailPage';
import { DatabasesPage } from './pages/databases/DatabasesPage';
import { FtpPage } from './pages/ftp/FtpPage';
import { FilesPage } from './pages/files/FilesPage';
import { TerminalPage } from './pages/terminal/TerminalPage';
import { CronPage } from './pages/cron/CronPage';
import { FirewallPage } from './pages/firewall/FirewallPage';
import { LogsPage } from './pages/logs/LogsPage';
import { BackupsPage } from './pages/backups/BackupsPage';
import { AuditPage } from './pages/audit/AuditPage';
import { ProfilePage } from './pages/settings/ProfilePage';
import { ServerSettingsPage } from './pages/settings/ServerSettingsPage';
import { ApiTokensPage } from './pages/settings/ApiTokensPage';
import { MonitoringPage } from './pages/monitoring/MonitoringPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { InstallerPage } from './pages/installer/InstallerPage';
import { SitesPage } from './pages/sites/SitesPage';
import { SiteDetailPage } from './pages/sites/SiteDetailPage';
import { DatabaseDetailPage } from './pages/databases/DatabaseDetailPage';
import { CloudflarePage } from './pages/cloudflare/CloudflarePage';
import { ResetPasswordPage } from './pages/reset-password/ResetPasswordPage';
import { SecurityPage } from './pages/security/SecurityPage';
import { StoragePage } from './pages/storage/StoragePage';
import { ContainersPage } from './pages/containers/ContainersPage';
import { BillingPage } from './pages/billing/BillingPage';
import { WebhooksPage } from './pages/webhooks/WebhooksPage';
import { PluginsPage } from './pages/plugins/PluginsPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { RegistriesPage } from './pages/registries/RegistriesPage';
import { JobsPage } from './pages/jobs/JobsPage';
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { ServicesPage } from './pages/services/ServicesPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

// Protected layout route (no path, uses id)
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AuthGuard,
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: DashboardPage,
});

const domainsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/domains',
  component: DomainsPage,
});

const sitesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/sites',
  component: SitesPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/projects',
  component: ProjectsPage,
});

const registriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/registries',
  component: RegistriesPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/jobs',
  component: JobsPage,
});

const organizationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/organizations',
  component: OrganizationsPage,
});

const servicesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/services',
  component: ServicesPage,
});

const siteDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/sites/$id',
  component: function SiteDetailWrapper() {
    const { id } = useParams({ from: '/protected/sites/$id' });
    return (
      <PageErrorBoundary title="Site detail crashed">
        <SiteDetailPage />
      </PageErrorBoundary>
    );
  },
});

const webserverRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/webserver',
  component: WebserverPage,
});

const phpRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/php',
  component: PhpPage,
});

const sslRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/ssl',
  component: SslPage,
});

const dnsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/dns',
  component: DnsPage,
});

const mailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/mail',
  component: MailPage,
});

const databasesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/databases',
  component: DatabasesPage,
});

const databaseDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/databases/$id',
  component: function DatabaseDetailWrapper() {
    const { id } = useParams({ from: '/protected/databases/$id' });
    return (
      <PageErrorBoundary title="Database detail crashed">
        <DatabaseDetailPage databaseId={id} />
      </PageErrorBoundary>
    );
  },
});

const ftpRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/ftp',
  component: FtpPage,
});

const filesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/files',
  component: FilesPage,
});

const terminalRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/terminal',
  component: function TerminalWrapper() {
    return (
      <PageErrorBoundary title="Terminal crashed">
        <TerminalPage />
      </PageErrorBoundary>
    );
  },
});

const cronRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/cron',
  component: CronPage,
});

const firewallRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/firewall',
  component: FirewallPage,
});

const logsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/logs',
  component: LogsPage,
});

const backupsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/backups',
  component: BackupsPage,
});

const auditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/audit',
  component: AuditPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings',
  component: ProfilePage,
});

const apiTokensRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings/api-tokens',
  component: ApiTokensPage,
});

const serverSettingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings/server',
  component: ServerSettingsPage,
});

const monitoringRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/monitoring',
  component: function MonitoringWrapper() {
    return (
      <PageErrorBoundary title="Monitoring crashed">
        <MonitoringPage />
      </PageErrorBoundary>
    );
  },
});

const notificationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const installerRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/installer',
  component: InstallerPage,
});

const cloudflareRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/cloudflare',
  component: CloudflarePage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
});

const securityRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/security',
  component: SecurityPage,
});

const storageRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/storage',
  component: StoragePage,
});

const containersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/containers',
  component: ContainersPage,
});

const billingRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/billing',
  component: BillingPage,
});

const webhooksRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/webhooks',
  component: WebhooksPage,
});

const pluginsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/plugins',
  component: PluginsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  resetPasswordRoute,
  protectedRoute.addChildren([
    indexRoute,
    domainsRoute,
    sitesRoute,
    projectsRoute,
    registriesRoute,
    jobsRoute,
    organizationsRoute,
    servicesRoute,
    siteDetailRoute,
    webserverRoute,
    phpRoute,
    sslRoute,
    dnsRoute,
    mailRoute,
    databasesRoute,
    databaseDetailRoute,
    ftpRoute,
    cloudflareRoute,
    filesRoute,
    terminalRoute,
    cronRoute,
    firewallRoute,
    logsRoute,
    backupsRoute,
    auditRoute,
    settingsRoute,
    serverSettingsRoute,
    apiTokensRoute,
    monitoringRoute,
    notificationsRoute,
    installerRoute,
    securityRoute,
    storageRoute,
    containersRoute,
    billingRoute,
    webhooksRoute,
    pluginsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

// Type safety for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
