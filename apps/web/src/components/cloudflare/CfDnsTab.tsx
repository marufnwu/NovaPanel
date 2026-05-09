import { useState } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Globe } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import type { DomainCloudflareDnsRecord } from '../../api/hooks/domains';

export interface DomainCfDnsTabProps {
  domainId: string;
  domainName: string;
  records: DomainCloudflareDnsRecord[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: {
    mutate: (
      data: { type: string; name: string; content: string; proxied: boolean; ttl: number },
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

export function DomainCfDnsTab({
  domainId,
  domainName,
  records,
  loading,
  onRefresh,
  onCreate,
  onDelete,
}: DomainCfDnsTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRecord, setNewRecord] = useState({ type: 'A', name: '', content: '', proxied: false, ttl: 1 });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{records.length} records</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Record
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={Globe} title="No DNS records" description="Add DNS records to manage your domain's DNS configuration." />
      ) : (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Content</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Proxied</th>
                <th className="px-4 py-3 text-left text-xs font-medium">TTL</th>
                <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-border hover:bg-accent/50">
                  <td className="px-4 py-2"><span className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{record.type}</span></td>
                  <td className="px-4 py-2 text-sm font-medium">{record.name}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">{record.content}</td>
                  <td className="px-4 py-2">{record.proxied ? <CheckCircle className="h-4 w-4 text-orange-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{record.ttl === 1 ? 'Auto' : `${record.ttl}s`}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Delete this DNS record?')) {
                          onDelete.mutate(record.id, {
                            onSuccess: () => toast.success('DNS record deleted'),
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
              onCreate.mutate(newRecord, {
                onSuccess: () => { setShowCreate(false); setNewRecord({ type: 'A', name: '', content: '', proxied: false, ttl: 1 }); toast.success('DNS record created'); },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Add Record</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={newRecord.type}
                onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                value={newRecord.name}
                onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder="@ or subdomain"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Content</label>
              <input
                value={newRecord.content}
                onChange={(e) => setNewRecord({ ...newRecord, content: e.target.value })}
                placeholder="IP address or hostname"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {(newRecord.type === 'A' || newRecord.type === 'AAAA' || newRecord.type === 'CNAME') && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRecord.proxied}
                  onChange={(e) => setNewRecord({ ...newRecord, proxied: e.target.checked })}
                  className="rounded"
                />{' '}
                Proxied through Cloudflare
              </label>
            )}
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
