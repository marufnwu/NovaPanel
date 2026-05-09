/**
 * DangerTab - Suspend and delete site actions
 */

import { useState } from 'react';
import { Trash2, Ban, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '../../../lib/toast';
import { useSuspendSite, useActivateSite, useDeleteSite } from '../../../api/hooks/sites';
import type { Site } from '../../../api/hooks/sites';

interface DangerTabProps {
  site: Site;
  siteId: string;
  onDeleted: () => void;
}

export function DangerTab({ site, siteId, onDeleted }: DangerTabProps) {
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const suspendSite = useSuspendSite(siteId);
  const activateSite = useActivateSite(siteId);
  const deleteSite = useDeleteSite(siteId);

  const handleSuspend = async () => {
    try {
      await suspendSite.mutateAsync(siteId);
      toast.success('Site suspended');
      setShowSuspendConfirm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to suspend site');
    }
  };

  const handleActivate = async () => {
    try {
      await activateSite.mutateAsync(siteId);
      toast.success('Site activated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate site');
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== site.name) {
      toast.error('Domain name does not match');
      return;
    }

    try {
      await deleteSite.mutateAsync(siteId);
      toast.success('Site deleted');
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete site');
    }
  };

  return (
    <div className="space-y-4">
      {/* Suspend / Activate Section */}
      {site.status === 'active' ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-800/30 dark:bg-yellow-900/10 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-yellow-700 dark:text-yellow-400">
            <Ban className="h-4 w-4" /> Suspend Site
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Suspending a site will temporarily disable it. You can reactivate it at any time.
          </p>
          {!showSuspendConfirm ? (
            <button
              onClick={() => setShowSuspendConfirm(true)}
              className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-200 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            >
              <Ban className="h-4 w-4" /> Suspend Site
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Are you sure you want to suspend this site?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSuspendConfirm(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={suspendSite.isPending}
                  className="flex items-center gap-2 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                >
                  {suspendSite.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Suspending...
                    </>
                  ) : (
                    <>Confirm Suspend</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Ban className="h-4 w-4 text-green-500" /> Site Suspended
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            This site is currently suspended. Reactivate it to make it accessible again.
          </p>
          <button
            onClick={handleActivate}
            disabled={activateSite.isPending}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {activateSite.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reactivating...
              </>
            ) : (
              <>Reactivate Site</>
            )}
          </button>
        </div>
      )}

      {/* Delete Site Section */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-destructive">
          <Trash2 className="h-4 w-4" /> Delete Site
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete this site, all associated domains, DNS records, SSL certificates,
          and website data. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4" /> Delete Site
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">This action is irreversible</p>
                <p className="text-muted-foreground mt-1">
                  All site data, DNS records, SSL certificates, and mail configuration will be permanently deleted.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{site.name}</code> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={site.name}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== site.name || deleteSite.isPending}
                className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteSite.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Delete Site
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}