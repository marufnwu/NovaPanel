import { createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { SitesPage } from './pages/sites/SitesPage';
import { SiteDetailPage } from './pages/sites/SiteDetailPage';
import { DatabasesPage } from './pages/databases/DatabasesPage';
import { DatabaseDetailPage } from './pages/databases/DatabaseDetailPage';
import { DomainsPage } from './pages/domains/DomainsPage';
import { DomainDetailPage } from './pages/domains/DomainDetailPage';
import { SslPage } from './pages/ssl/SslPage';
import { DnsPage } from './pages/dns/DnsPage';
import { PhpPage } from './pages/php/PhpPage';
import { WebserverPage } from './pages/webserver/WebserverPage';
import { FirewallPage } from './pages/firewall/FirewallPage';
import { BackupsPage } from './pages/backups/BackupsPage';
import { MonitoringPage } from './pages/monitoring/MonitoringPage';
import { CronPage } from './pages/cron/CronPage';
import { MailPage } from './pages/mail/MailPage';
import { LogsPage } from './pages/logs/LogsPage';
import { FilesPage } from './pages/files/FilesPage';
import { TerminalPage } from './pages/terminal/TerminalPage';
import { ContainersPage } from './pages/containers/ContainersPage';
import { ContainerDetailPage } from './pages/containers/ContainerDetailPage';
import { RegistriesPage } from './pages/registries/RegistriesPage';
import { WebhooksPage } from './pages/webhooks/WebhooksPage';
import { AuditPage } from './pages/audit/AuditPage';
import { BillingPage } from './pages/billing/BillingPage';
import { PluginsPage } from './pages/plugins/PluginsPage';
import { InstallerPage } from './pages/installer/InstallerPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SecurityPage } from './pages/security/SecurityPage';
import { JobsPage } from './pages/jobs/JobsPage';
import { FtpPage } from './pages/ftp/FtpPage';
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { ServerSettingsPage } from './pages/settings/ServerSettingsPage';
import { ProfilePage } from './pages/settings/ProfilePage';
import { ApiTokensPage } from './pages/settings/ApiTokensPage';
import { ServicesPage } from './pages/services/ServicesPage';
import { ProcessesPage } from './pages/processes/ProcessesPage';
import { Navigate } from '@tanstack/react-router';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/dashboard" />,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const sitesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sites',
  component: SitesPage,
});

const siteDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sites/$siteId',
  component: SiteDetailPage,
});

const databasesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/databases',
  component: DatabasesPage,
});

const databaseDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/databases/$databaseId',
  component: DatabaseDetailPage,
});

const domainsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/domains',
  component: DomainsPage,
});

const domainDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/domains/$domainId',
  component: DomainDetailPage,
});

const sslRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ssl',
  component: SslPage,
});

const dnsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dns',
  component: DnsPage,
});

const phpRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/php',
  component: PhpPage,
});

const webserverRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/webserver',
  component: WebserverPage,
});

const firewallRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/firewall',
  component: FirewallPage,
});

const backupsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/backups',
  component: BackupsPage,
});

const monitoringRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/monitoring',
  component: MonitoringPage,
});

const cronRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/cron',
  component: CronPage,
});

const mailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/mail',
  component: MailPage,
});

const logsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/logs',
  component: LogsPage,
});

const filesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/files',
  component: FilesPage,
});

const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terminal',
  component: TerminalPage,
});

const containersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/containers',
  component: ContainersPage,
});

const containerDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/containers/$containerId',
  component: ContainerDetailPage,
});

const registriesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/registries',
  component: RegistriesPage,
});

const webhooksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/webhooks',
  component: WebhooksPage,
});

const auditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/audit',
  component: AuditPage,
});

const billingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/billing',
  component: BillingPage,
});

const pluginsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/plugins',
  component: PluginsPage,
});

const installerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/installer',
  component: InstallerPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const securityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/security',
  component: SecurityPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/jobs',
  component: JobsPage,
});

const ftpRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ftp',
  component: FtpPage,
});

const organizationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/organizations',
  component: OrganizationsPage,
});

const serverSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: ServerSettingsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings/profile',
  component: ProfilePage,
});

const apiTokensRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings/api-tokens',
  component: ApiTokensPage,
});

const servicesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/services',
  component: ServicesPage,
});

const processesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/processes',
  component: ProcessesPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  appRoute.addChildren([
    dashboardRoute,
    sitesRoute,
    siteDetailRoute,
    databasesRoute,
    databaseDetailRoute,
    domainsRoute,
    domainDetailRoute,
    sslRoute,
    dnsRoute,
    phpRoute,
    webserverRoute,
    firewallRoute,
    backupsRoute,
    monitoringRoute,
    cronRoute,
    mailRoute,
    logsRoute,
    filesRoute,
    containersRoute,
    containerDetailRoute,
    registriesRoute,
    webhooksRoute,
    auditRoute,
    billingRoute,
    pluginsRoute,
    installerRoute,
    notificationsRoute,
    securityRoute,
    jobsRoute,
    ftpRoute,
    organizationsRoute,
    serverSettingsRoute,
    profileRoute,
    apiTokensRoute,
    servicesRoute,
    processesRoute,
  ]),
  terminalRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface FileRouteTypes {
    root: typeof rootRoute;
  }
}