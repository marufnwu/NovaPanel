/**
 * SiteDetailPage - Full implementation with all tabs
 *
 * Displays a single site's details with tab navigation:
 * Overview, Domains, Files, Config, Resources, Danger
 */

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSite } from '../../api/hooks/sites';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  Globe,
  ArrowLeft,
  ExternalLink,
  Server,
  Shield,
  FolderOpen,
  Database,
  Terminal,
  Trash2,
  AlertTriangle,
  Cloud,
  ChevronRight,
  Globe2,
} from 'lucide-react';

// Tab content components
import { OverviewTab } from './components/OverviewTab';
import { DomainsTab } from './components/DomainsTab';
import { FilesTab } from './components/FilesTab';
import { ConfigTab } from './components/ConfigTab';
import { ResourcesTab } from './components/ResourcesTab';
import { DangerTab } from './components/DangerTab';

// --- Tab definitions ---

type TabId = 'overview' | 'domains' | 'files' | 'config' | 'resources' | 'danger';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <Server className="h-4 w-4" /> },
  { id: 'domains', label: 'Domains', icon: <Globe className="h-4 w-4" /> },
  { id: 'files', label: 'Files', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'config', label: 'Config', icon: <Terminal className="h-4 w-4" /> },
  { id: 'resources', label: 'Resources', icon: <Database className="h-4 w-4" /> },
  { id: 'danger', label: 'Danger Zone', icon: <Trash2 className="h-4 w-4" /> },
];

// --- Main Component ---

export function SiteDetailPage({ siteId: siteIdProp }: { siteId?: string }) {
  const siteId = siteIdProp;
  const { data: site, isLoading, error } = useSite(siteId ?? '');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate({ to: '/sites' })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sites
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <strong>Error loading site:</strong> {(error as Error)?.message || 'Site not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate({ to: '/sites' })}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Sites
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{site.name}</h1>
              {site.isOrphanWebsite && (
                <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3" /> Orphan
                </span>
              )}
            </div>
            {site.isOrphanWebsite && site.inferredDomainName && (
              <p className="text-sm text-muted-foreground">
                Domain name inferred from document root: {site.inferredDomainName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              site.status === 'active'
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {site.status}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              site.accessType === 'public'
                ? 'bg-green-500/10 text-green-500'
                : site.accessType === 'tunnel'
                ? 'bg-orange-500/10 text-orange-500'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {site.accessType === 'public' && <Globe2 className="h-3 w-3" />}
            {site.accessType === 'tunnel' && <Cloud className="h-3 w-3" />}
            {site.accessType === 'local' && <Server className="h-3 w-3" />}
            {site.accessType}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab site={site} siteId={siteId || ''} />}
      {activeTab === 'domains' && <DomainsTab site={site} siteId={siteId || ''} />}
      {activeTab === 'files' && <FilesTab site={site} siteId={siteId || ''} />}
      {activeTab === 'config' && <ConfigTab site={site} siteId={siteId || ''} />}
      {activeTab === 'resources' && <ResourcesTab site={site} siteId={siteId || ''} />}
      {activeTab === 'danger' && siteId && <DangerTab site={site} siteId={siteId} onDeleted={() => navigate({ to: '/sites' })} />}
    </div>
  );
}
