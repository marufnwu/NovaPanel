import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  useParams,
} from '@tanstack/react-router';
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
import { TunnelsPage } from './pages/tunnels/TunnelsPage';
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
import { WebsitesPage } from './pages/websites/WebsitesPage';
import { WebsiteDetailPage } from './pages/websites/WebsiteDetailPage';

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

const websitesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/websites',
  component: WebsitesPage,
});

const websiteDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/websites/$id',
  component: function WebsiteDetailWrapper() {
    const { id } = useParams({ from: '/protected/websites/$id' });
    return <WebsiteDetailPage websiteId={id} />;
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

const ftpRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/ftp',
  component: FtpPage,
});

const tunnelsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/tunnels',
  component: TunnelsPage,
});

const filesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/files',
  component: FilesPage,
});

const terminalRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/terminal',
  component: TerminalPage,
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
  component: MonitoringPage,
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    indexRoute,
    domainsRoute,
    websitesRoute,
    websiteDetailRoute,
    webserverRoute,
    phpRoute,
    sslRoute,
    dnsRoute,
    mailRoute,
    databasesRoute,
    ftpRoute,
    tunnelsRoute,
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
  ]),
]);

export const router = createRouter({ routeTree });

// Type safety for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
