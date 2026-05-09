import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Shield } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import type { DomainCloudflareFirewallRule } from '../../api/hooks/domains';

export interface DomainCfFirewallTabProps {
  domainId: string;
  rules: DomainCloudflareFirewallRule[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: {
    mutate: (
      data: { action: string; expression: string; description: string },
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

export function DomainCfFirewallTab({
  domainId,
  rules,
  loading,
  onRefresh,
  onCreate,
  onDelete,
}: DomainCfFirewallTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ action: 'block', expression: '', description: '' });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={Shield} title="No firewall rules" description="Add firewall rules to control access to your site." />
      ) : (
        <ResponsiveTable>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Expression</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border">
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.action === 'block' ? 'bg-red-100 text-red-700' :
                      rule.action === 'allow' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{rule.action}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">{rule.filter?.expression}</td>
                  <td className="px-4 py-2 text-sm">{rule.description}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Delete this firewall rule?')) {
                          onDelete.mutate(rule.id, {
                            onSuccess: () => toast.success('Firewall rule deleted'),
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
                onSuccess: () => { setShowCreate(false); setNewRule({ action: 'block', expression: '', description: '' }); toast.success('Firewall rule created'); },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Add Firewall Rule</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Action</label>
              <select
                value={newRule.action}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="block">Block</option>
                <option value="allow">Allow</option>
                <option value="challenge">Challenge (CAPTCHA)</option>
                <option value="js_challenge">JS Challenge</option>
                <option value="log">Log</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expression</label>
              <input
                value={newRule.expression}
                onChange={(e) => setNewRule({ ...newRule, expression: e.target.value })}
                placeholder='e.g. (ip.src eq 192.168.1.1)'
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Uses Cloudflare Wirefilter expression language</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <input
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                placeholder="Block bad IPs"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
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
