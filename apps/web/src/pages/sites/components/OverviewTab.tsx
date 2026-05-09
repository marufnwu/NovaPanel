/**
 * OverviewTab - Site overview with status cards
 */

import { Server, Globe2, Shield, HardDrive, Gauge, CheckCircle, XCircle } from 'lucide-react';
import type { Site } from '../../../api/hooks/sites';

interface OverviewTabProps {
  site: Site;
  siteId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function OverviewTab({ site }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Server className="h-4 w-4 text-primary" /> Status
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              {site.status === 'active' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm font-medium">Site Status</span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                site.status === 'active'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              {site.status}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Access</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                site.accessType === 'public'
                  ? 'bg-green-500/10 text-green-500'
                  : site.accessType === 'tunnel'
                  ? 'bg-orange-500/10 text-orange-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {site.accessType === 'public' && <Globe2 className="h-3 w-3" />}
              {site.accessType === 'tunnel' && <Server className="h-3 w-3" />}
              {site.accessType === 'local' && <Server className="h-3 w-3" />}
              {site.accessType}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">SSL</span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                site.sslEnabled
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {site.sslEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Usage Cards */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Gauge className="h-4 w-4 text-primary" /> Usage
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Disk Usage</span>
            </div>
            <span className="font-mono text-sm">
              {site.diskUsage > 0 ? formatBytes(site.diskUsage) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Bandwidth</span>
            </div>
            <span className="font-mono text-sm">
              {site.bandwidth > 0 ? formatBytes(site.bandwidth) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Info */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Server className="h-4 w-4 text-primary" /> Configuration
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {site.webServer && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Web Server</p>
              <p className="font-medium capitalize">{site.webServer.replace('+', ' + ')}</p>
            </div>
          )}
          {site.phpVersion && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">PHP Version</p>
              <p className="font-medium">{site.phpVersion}</p>
            </div>
          )}
          {site.phpHandler && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">PHP Handler</p>
              <p className="font-medium">{site.phpHandler}</p>
            </div>
          )}
          {site.documentRoot && (
            <div className="rounded-md border border-border p-3 sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Document Root</p>
              <p className="font-mono text-sm">{site.documentRoot}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cloudflare Zone Info */}
      {site.cloudflareZone && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4 text-orange-500" /> Cloudflare
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Zone Status</p>
              <p className="font-medium capitalize">{site.cloudflareZone.status}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">SSL Mode</p>
              <p className="font-medium capitalize">{site.cloudflareZone.sslStatus}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}