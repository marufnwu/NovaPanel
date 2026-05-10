/**
 * FilesTab - File manager and FTP access
 */

import { FolderOpen, Users } from 'lucide-react';
import { FilesContent } from '../../../components/files/FilesContent';
import { FtpSection } from '../../../components/sites/FtpSection';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import {
  useWebsiteFtp,
} from '../../../api/hooks/websites';
import type { Site } from '../../../api/hooks/sites';
import type { Website } from '../../../api/hooks/websites';

interface FilesTabProps {
  site: Site;
  siteId: string;
}

export function FilesTab({ site, siteId }: FilesTabProps) {
  // Get FTP accounts for this website
  const { data: ftpAccounts, isLoading: ftpLoading } = useWebsiteFtp(site.websiteId || '');

  // Create a fake website object for FtpSection
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
      {/* File Manager Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <FolderOpen className="h-4 w-4 text-primary" /> File Manager
        </h3>
        <FilesContent initialPath={site.documentRoot || '/'} forcedWebsiteId={site.websiteId || undefined} />
      </div>

      {/* FTP Access Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-primary" /> FTP Access
        </h3>
        <FtpSection
          website={fakeWebsite}
          ftpAccounts={ftpAccounts}
          isLoading={ftpLoading}
          isError={false}
        />
      </div>
    </div>
  );
}