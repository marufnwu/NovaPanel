/**
 * ResourcesTab - Databases, Backups, Apps
 */

import { Database, Archive, AppWindow } from 'lucide-react';
import { DatabasesSection } from '../../../components/sites/DatabasesSection';
import { BackupsSection } from '../../../components/sites/BackupsSection';
import { AppsSection } from '../../../components/sites/AppsSection';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import {
  useWebsiteDatabases,
  useWebsiteBackups,
  useWebsiteApps,
} from '../../../api/hooks/websites';
import type { Site } from '../../../api/hooks/sites';
import type { Website } from '../../../api/hooks/websites';

interface ResourcesTabProps {
  site: Site;
  siteId: string;
}

export function ResourcesTab({ site, siteId }: ResourcesTabProps) {
  const websiteId = site.websiteId || '';

  const { data: databases, isLoading: databasesLoading } = useWebsiteDatabases(websiteId);
  const { data: backups, isLoading: backupsLoading } = useWebsiteBackups(websiteId);
  const { data: apps, isLoading: appsLoading } = useWebsiteApps(websiteId);

  // Create a fake website object for sub-components
  const fakeWebsite: Website = {
    id: site.websiteId || siteId,
    name: site.name,
    systemUser: site.systemUser,
    documentRoot: site.documentRoot || '',
    phpVersion: site.phpVersion || '',
    phpHandler: site.phpHandler || '',
    webServer: site.webServer || '',
    status: site.status,
    diskUsedMb: null,
    bandwidthUsedMb: null,
    createdAt: site.createdAt,
  };

  return (
    <div className="space-y-6">
      {/* Databases Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Database className="h-4 w-4 text-primary" /> Databases
        </h3>
        {databasesLoading ? (
          <LoadingSpinner />
        ) : (
          <DatabasesSection
            website={fakeWebsite}
            databases={databases}
            isLoading={databasesLoading}
            isError={false}
          />
        )}
      </div>

      {/* Backups Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Archive className="h-4 w-4 text-primary" /> Backups
        </h3>
        {backupsLoading ? (
          <LoadingSpinner />
        ) : (
          <BackupsSection
            website={fakeWebsite}
            backups={backups}
            isLoading={backupsLoading}
            isError={false}
          />
        )}
      </div>

      {/* Installed Apps Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <AppWindow className="h-4 w-4 text-primary" /> Installed Apps
        </h3>
        {appsLoading ? (
          <LoadingSpinner />
        ) : (
          <AppsSection
            website={fakeWebsite}
            apps={apps}
            isLoading={appsLoading}
            isError={false}
          />
        )}
      </div>
    </div>
  );
}