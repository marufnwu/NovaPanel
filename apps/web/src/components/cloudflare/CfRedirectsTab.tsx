import { useState } from 'react';
import { Plus, Trash2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import type { DomainCloudflareRedirectRule } from '../../api/hooks/domains';

export interface DomainCfRedirectsTabProps {
  domainId: string;
  rules: DomainCloudflareRedirectRule[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: {
    mutate: (
      data: { sourcePattern: string; destinationUrl: string; redirectType: string },
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
    isPending: boolean;
  };
  onDelete: {
    mutate: (
      id: string,
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
  };
}

export function DomainCfRedirectsTab({
  domainId,
  rules,
  loading,
  onRefresh,
  onCreate,
  onDelete,
}: DomainCfRedirectsTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ sourcePattern: '', destinationUrl: '', redirectType: '301' });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Redirect
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={ArrowRightLeft} title="No redirect rules" description="Add redirect rules to forward URLs." />
      ) : (
        <ResponsiveTable>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border">
                  <td className="px-4 py-2 text-sm font-mono">{rule.sourcePattern}</td>
                  <td className="px-4 py-2 text-sm font-mono">{rule.destinationUrl}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{rule.redirectType}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Delete this redirect rule?')) {
                          onDelete.mutate(rule.id, {
                            onSuccess: () => toast.success('Redirect deleted'),
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }
                      }}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreate.mutate(newRule, {
                onSuccess: () => { setShowCreate(false); setNewRule({ sourcePattern: '', destinationUrl: '', redirectType: '301' }); toast.success('Redirect rule created'); },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Add Redirect Rule</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Source Pattern</label>
              <input
                value={newRule.sourcePattern}
                onChange={(e) => setNewRule({ ...newRule, sourcePattern: e.target.value })}
                placeholder="www.example.com/*"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Destination URL</label>
              <input
                value={newRule.destinationUrl}
                onChange={(e) => setNewRule({ ...newRule, destinationUrl: e.target.value })}
                placeholder="https://example.com/$1"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={newRule.redirectType}
                onChange={(e) => setNewRule({ ...newRule, redirectType: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="301">301 (Permanent)</option>
                <option value="302">302 (Temporary)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={onCreate.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {onCreate.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
