import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  useParams,
  Navigate,
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
import { CloudflarePage } from './pages/cloudflare/CloudflarePage';
import { SitesPage } from './pages/sites/SitesPage';
import { SiteDetailPage } from './pages/sites/SiteDetailPage';
import { useWebsites } from './api/hooks/websites';
import { useSite } from './api/hooks/sites';

// --- Redirect Components ---

/** Simple redirect from /domains to /sites */
function DomainsRedirect() {
  return <Navigate to="/sites" />;
}

/** Redirect from /domains/:id to /sites or /sites/:siteId */
function DomainDetailRedirect() {
  const params = useParams({ from: '/protected/domains/$id' });
  const { data: site } = useSite(params.id);

  if (site) {
    return <Navigate to="/sites/$siteId" params={{ siteId: site.id }} />;
  }
  return <Navigate to="/sites" />;
}

/** Redirect from /websites to /sites */
function WebsitesRedirect() {
  return <Navigate to="/sites" />;
}

/** Redirect from /websites/:id to /sites/:siteId by finding the associated site */
function WebsiteDetailRedirect() {
  const params = useParams({ from: '/protected/websites/$id' });
  const { data: websites, isLoading } = useWebsites();

  // First, check if any domain has this websiteId attached
  // The useSite hook handles this by trying domain lookup first, then website lookup
  const { data: site } = useSite(params.id);

  if (!isLoading && site) {
    return <Navigate to="/sites/$siteId" params={{ siteId: site.id }} />;
  }

  // If still loading or no site found, redirect to /sites
  return <Navigate to="/sites" />;
}

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
  component: DomainsRedirect,
});

const domainDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/domains/$id',
  component: DomainDetailRedirect,
});

// Sites routes — unified view replacing /domains and /websites
const sitesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/sites',
  component: SitesPage,
});

const siteDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/sites/$siteId',
  component: function SiteDetailWrapper() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = useParams({ from: '/protected/sites/$siteId' } as any) as { siteId: string };
    return <SiteDetailPage siteId={params.siteId} />;
  },
});

const siteNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/sites/new',
  component: SitesPage, // Reuses SitesPage which shows the create modal
});

const websitesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/websites',
  component: WebsitesRedirect,
});

const websiteDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/websites/$id',
  component: WebsiteDetailRedirect,
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

const cloudflareRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/cloudflare',
  component: CloudflarePage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    indexRoute,
    domainsRoute,
    domainDetailRoute,
    sitesRoute,
    siteDetailRoute,
    siteNewRoute,
    websitesRoute,
    websiteDetailRoute,
    webserverRoute,
    phpRoute,
    sslRoute,
    dnsRoute,
    mailRoute,
    databasesRoute,
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
  ]),
]);

export const router = createRouter({ routeTree });

// Type safety for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
