import { useState } from 'react';
import {
  useDomainCloudflareDns,
  useCreateDomainCloudflareDns,
  useDeleteDomainCloudflareDns,
  type DomainCloudflareDnsRecord,
} from '../../api/hooks/domains';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { EmptyState } from '../ui/EmptyState';
import { ResponsiveTable } from '../ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import { Globe, Plus, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { CloudflareDnsForm } from './CloudflareDnsForm';

interface DnsRecordListProps {
  domainId: string;
  domainName: string;
  compact?: boolean;
}

export function DnsRecordList({ domainId, domainName, compact = false }: DnsRecordListProps) {
  const { data: records, isLoading, refetch } = useDomainCloudflareDns(domainId);
  const createDns = useCreateDomainCloudflareDns(domainId);
  const deleteDns = useDeleteDomainCloudflareDns(domainId);
  const [showCreate, setShowCreate] = useState(false);
  const [newRecord, setNewRecord] = useState({ type: 'A', name: '', content: '', proxied: false, ttl: 1 });

  if (isLoading) return <LoadingSpinner />;

  const recordList = records?.records || [];

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {!compact && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{recordList.length} records</span>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Record
            </button>
          </div>
        </div>
      )}

      {recordList.length === 0 ? (
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
                {!compact && <th className="px-4 py-3 text-right text-xs font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {recordList.map((record) => (
                <tr key={record.id} className="border-b border-border hover:bg-accent/50">
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{record.type}</span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium">{record.name}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">{record.content}</td>
                  <td className="px-4 py-2">
                    {record.proxied ? <CheckCircle className="h-4 w-4 text-orange-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{record.ttl === 1 ? 'Auto' : `${record.ttl}s`}</td>
                  {!compact && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Delete this DNS record?')) {
                            deleteDns.mutate(record.id, {
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {showCreate && (
        <CloudflareDnsForm
          domainName={domainName}
          onSubmit={(record) => {
            createDns.mutate(record, {
              onSuccess: () => {
                setShowCreate(false);
                setNewRecord({ type: 'A', name: '', content: '', proxied: false, ttl: 1 });
                toast.success('DNS record created');
              },
              onError: (e: Error) => toast.error(e.message),
            });
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}