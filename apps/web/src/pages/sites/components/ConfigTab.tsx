/**
 * ConfigTab - Web server, PHP, SSL configuration
 */

import { useState } from 'react';
import { Terminal, Code2, Shield, Clock, Save, Loader2 } from 'lucide-react';
import { PhpContent } from '../../../components/php/PhpContent';
import { CronSection } from '../../../components/sites/CronSection';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { toast } from '../../../lib/toast';
import { useUpdateWebsite } from '../../../api/hooks/websites';
import { useWebsiteCron } from '../../../api/hooks/websites';
import type { Site } from '../../../api/hooks/sites';
import type { Website } from '../../../api/hooks/websites';

interface ConfigTabProps {
  site: Site;
  siteId: string;
}

export function ConfigTab({ site, siteId }: ConfigTabProps) {
  const [savingWebConfig, setSavingWebConfig] = useState(false);

  // Web server configuration state
  const [phpVersion, setPhpVersion] = useState(site.phpVersion || '');
  const [phpHandler, setPhpHandler] = useState(site.phpHandler || 'php-fpm');
  const [webServer, setWebServer] = useState(site.webServer || 'nginx');
  const [documentRoot, setDocumentRoot] = useState(site.documentRoot || '');

  const updateWebsite = useUpdateWebsite();
  const { data: cronJobs, isLoading: cronLoading } = useWebsiteCron(site.websiteId || '');

  const handleSaveWebConfig = async () => {
    if (!site.websiteId) {
      toast.error('No website associated with this site');
      return;
    }

    setSavingWebConfig(true);
    try {
      await updateWebsite.mutateAsync({
        id: site.websiteId,
        phpVersion,
        phpHandler,
        webServer,
        documentRoot,
      });
      toast.success('Web server configuration saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSavingWebConfig(false);
    }
  };

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
      {/* Web Server Settings */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Terminal className="h-4 w-4 text-primary" /> Web Server Settings
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">PHP Version</label>
            <select
              value={phpVersion}
              onChange={(e) => setPhpVersion(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Server default</option>
              <option value="8.1">PHP 8.1</option>
              <option value="8.2">PHP 8.2</option>
              <option value="8.3">PHP 8.3</option>
              <option value="8.4">PHP 8.4</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">PHP Handler</label>
            <select
              value={phpHandler}
              onChange={(e) => setPhpHandler(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="php-fpm">PHP-FPM</option>
              <option value="cgi">CGI</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Web Server</label>
            <select
              value={webServer}
              onChange={(e) => setWebServer(e.target.value as typeof webServer)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="nginx">Nginx</option>
              <option value="apache">Apache</option>
              <option value="nginx+apache">Nginx + Apache</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Document Root</label>
            <input
              type="text"
              value={documentRoot}
              onChange={(e) => setDocumentRoot(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveWebConfig}
            disabled={savingWebConfig || !site.websiteId}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingWebConfig ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* PHP Settings */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Code2 className="h-4 w-4 text-primary" /> PHP Settings
        </h3>
        <PhpContent domain={site.name} />
      </div>

      {/* SSL Certificate */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Shield className="h-4 w-4 text-primary" /> SSL Certificate
        </h3>
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div className="flex items-center gap-3">
            <Shield className={`h-8 w-8 ${site.sslEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
            <div>
              <p className="font-medium">{site.sslEnabled ? 'SSL Enabled' : 'SSL Disabled'}</p>
              <p className="text-sm text-muted-foreground">
                {site.sslEnabled
                  ? 'Your site is served over HTTPS'
                  : 'HTTPS is not configured for this site'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              Renew
            </button>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              Replace
            </button>
          </div>
        </div>
      </div>

      {/* Scheduled Tasks (Cron) */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4 text-primary" /> Scheduled Tasks (Cron)
        </h3>
        <CronSection
          website={fakeWebsite}
          cronJobs={cronJobs}
          isLoading={cronLoading}
          isError={false}
        />
      </div>
    </div>
  );
}