/**
 * SitesPage - Unified Sites List View
 *
 * Replaces the separate DomainsPage and WebsitesPage with a unified interface
 * that merges domain and website data into a single Sites concept.
 */

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useSites,
  useBulkSuspendSites,
  useBulkActivateSites,
  useBulkDeleteSites,
  type Site,
} from '../../api/hooks/sites';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { BulkActionBar } from '../../components/sites/BulkActionBar';
import { DomainStatusBadge } from '../../components/sites/DomainStatusBadge';
import { AddSiteModal } from './components/AddSiteModal';
import {
  Globe,
  Plus,
  Trash2,
  Ban,
  CheckCircle,
  Search,
  ExternalLink,
  Server,
  AlertTriangle,
  ChevronRight,
  Globe2,
} from 'lucide-react';

// --- Helpers ---

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// --- Site Row Component ---

function SiteRow({
  site,
  selected,
  onToggle,
  onNavigate,
}: {
  site: Site;
  selected: boolean;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  return (
    <tr
      className={`border-b border-border hover:bg-accent/50 transition-colors ${
        selected ? 'bg-primary/5' : ''
      }`}
    >
      {/* Checkbox */}
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(site.id)}
          className="h-4 w-4 rounded border-input text-primary"
        />
      </td>

      {/* Domain name + badges */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate(site.id)}
                className="text-sm font-medium text-primary hover:underline text-left"
              >
                {site.name}
              </button>
              {site.isOrphanWebsite && (
                <span
                  title="Website exists without a domain. The domain name was inferred from the document root path."
                  className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-600"
                >
                  <AlertTriangle className="h-3 w-3" /> Orphan
                </span>
              )}
            </div>
            {site.isOrphanWebsite && site.inferredDomainName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Inferred: {site.inferredDomainName}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <DomainStatusBadge status={site.status} />
      </td>

      {/* Access type */}
      <td className="px-4 py-3">
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
          {site.accessType === 'tunnel' && <Server className="h-3 w-3" />}
          {site.accessType === 'local' && <Server className="h-3 w-3" />}
          {site.accessType}
        </span>
      </td>

      {/* Web server + PHP */}
      <td className="px-4 py-3">
        <div className="text-sm">
          {site.webServer ? (
            <span className="font-medium capitalize">{site.webServer.replace('+', ' + ')}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        {site.phpVersion && (
          <p className="text-xs text-muted-foreground">PHP {site.phpVersion}</p>
        )}
      </td>

      {/* Disk + Bandwidth */}
      <td className="px-4 py-3">
        <div className="text-sm">
          {site.diskUsage > 0 ? (
            formatBytes(site.diskUsage)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        {site.bandwidth > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatBytes(site.bandwidth)} BW
          </p>
        )}
      </td>

      {/* Subdomains / Aliases / Redirects */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {site.subdomains.length > 0 && (
            <span title={`${site.subdomains.length} subdomain(s)`}>
              {site.subdomains.length} sub
            </span>
          )}
          {site.aliases.length > 0 && (
            <span title={`${site.aliases.length} alias(es)`}>
              {site.aliases.length} alias
            </span>
          )}
          {site.redirects.length > 0 && (
            <span title={`${site.redirects.length} redirect(s)`}>
              {site.redirects.length} redirect
            </span>
          )}
          {site.cloudflareZone && (
            <span
              title={`Cloudflare zone: ${site.cloudflareZone.id}`}
              className="text-orange-500"
            >
              CF
            </span>
          )}
          {site.subdomains.length === 0 &&
            site.aliases.length === 0 &&
            site.redirects.length === 0 &&
            !site.cloudflareZone && (
              <span className="text-muted-foreground">—</span>
            )}
        </div>
      </td>

      {/* Created */}
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {formatDate(site.createdAt)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <Link
          to="/sites/$siteId"
          params={{ siteId: site.id }}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
        >
          Manage <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}

// --- Delete Confirmation Dialog ---

function DeleteConfirmDialog({
  siteNames,
  onConfirm,
  onCancel,
  isLoading,
}: {
  siteNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const firstName = siteNames[0];
  const isMulti = siteNames.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-destructive">
          {isMulti ? `Delete ${siteNames.length} Sites` : 'Delete Site'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isMulti ? (
            <>
              This will permanently delete <strong>{siteNames.length} sites</strong> and all
              associated data including domains, websites, DNS records, and SSL certificates.
            </>
          ) : (
            <>
              This will permanently delete <strong>{firstName}</strong> and all associated DNS
              records, SSL certificates, and mail configuration.
            </>
          )}
        </p>
        {isMulti && (
          <div className="mt-3 max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
            <ul className="list-inside list-disc text-sm">
              {siteNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        {!isMulti && (
          <>
            <p className="mt-3 text-sm font-medium">
              Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{firstName}</code> to
              confirm:
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={firstName}
              autoFocus
            />
          </>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMulti && typed !== firstName}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export function SitesPage() {
  const { data: sites, isLoading, error } = useSites();
  const bulkSuspend = useBulkSuspendSites();
  const bulkActivate = useBulkActivateSites();
  const bulkDelete = useBulkDeleteSites();
  const navigate = useNavigate();

  // Add site modal state - show when navigating to /sites/new
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);

  const filteredSites = sites
    ? sites.filter((s) =>
        searchQuery
          ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.systemUser.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
    : [];

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!sites) return;
    if (selectedIds.size === filteredSites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSites.map((s) => s.id)));
    }
  };

  const handleBulkSuspend = () => {
    bulkSuspend.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkActivate = () => {
    bulkActivate.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkDelete = () => {
    if (!sites) return;
    const names = filteredSites
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.name);
    setDeleteTarget(names);
  };

  const confirmBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        setDeleteTarget(null);
      },
    });
  };

  const handleNavigate = (id: string) => {
    navigate({ to: '/sites/$siteId', params: { siteId: id } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Manage your domains, websites, and DNS from one unified view"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Site
          </button>
        }
      />

      {/* Search + filters bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredSites.length} site{filteredSites.length !== 1 ? 's' : ''}
          {selectedIds.size > 0 && (
            <span className="ml-2 font-medium text-primary">{selectedIds.size} selected</span>
          )}
        </div>
      </div>

      {/* Main table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <strong>Error loading sites:</strong> {(error as Error).message}
        </div>
      ) : filteredSites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites found"
          description={
            searchQuery
              ? 'No sites match your searchQuery. Try a different term.'
              : 'Get started by creating your first site with a domain and optional website.'
          }
          action={
            !searchQuery ? (
              <Link
                to="/sites/new"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Create Site
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredSites.length && filteredSites.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-input text-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Domain / Site
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Access
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Web Server
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Usage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  selected={selectedIds.has(site.id)}
                  onToggle={handleToggle}
                  onNavigate={handleNavigate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onSuspend={handleBulkSuspend}
        onActivate={handleBulkActivate}
        onDelete={handleBulkDelete}
        isLoading={bulkSuspend.isPending || bulkActivate.isPending || bulkDelete.isPending}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          siteNames={deleteTarget}
          onConfirm={confirmBulkDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={bulkDelete.isPending}
        />
      )}

      {/* Add Site Modal */}
      <AddSiteModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
