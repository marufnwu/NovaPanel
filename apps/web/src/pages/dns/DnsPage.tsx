import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDomains } from '../../api/hooks/domains';
import { ErrorState } from '../../components/ui/ErrorState';
import {
  useDnsZone,
  useCreateDnsRecord,
  useDeleteDnsRecord,
  useCloudflareConfig,
  useUpdateCloudflareConfig,
  useSyncCloudflareRecords,
  type DnsRecord,
} from '../../api/hooks/dns';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function DnsPage() {
  const queryClient = useQueryClient();
  const { data: domains, isLoading: domainsLoading, isError: domainsError, error: domainsErr, refetch: refetchDomains } = useDomains();
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const { data: dnsZone, isLoading, isError: dnsError, error: dnsErr, refetch: refetchDns } = useDnsZone(selectedDomainId || '');
  const createRecord = useCreateDnsRecord();
  const deleteRecord = useDeleteDnsRecord();

  const { data: cloudflareConfig } = useCloudflareConfig(selectedDomainId || '');
  const updateCloudflare = useUpdateCloudflareConfig();
  const syncCloudflare = useSyncCloudflareRecords();

  const [cloudflareOpen, setCloudflareOpen] = useState(false);

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [newRecordType, setNewRecordType] = useState('A');
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordValue, setNewRecordValue] = useState('');
  const [newRecordTtl, setNewRecordTtl] = useState(3600);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDomainId && domains && domains.length > 0) {
      setSelectedDomainId(domains[0].id);
    }
  }, [domains, selectedDomainId]);

  const handleAddRecord = async () => {
    if (!selectedDomainId || !newRecordName || !newRecordValue) return;
    createRecord.mutateAsync({
      domainId: selectedDomainId,
      type: newRecordType,
      name: newRecordName,
      value: newRecordValue,
      ttl: newRecordTtl,
    }, {
      onSuccess: () => {
        toast.success('DNS record added');
        setShowAddRecord(false);
        setNewRecordName('');
        setNewRecordValue('');
        queryClient.invalidateQueries({ queryKey: ['dns', selectedDomainId] });
      },
      onError: (err: any) => toast.error(`Failed to add DNS record: ${err.message}`),
    });
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecordId || !selectedDomainId) return;
    deleteRecord.mutateAsync({ domainId: selectedDomainId, recordId: deleteRecordId }, {
      onSuccess: () => {
        toast.success('DNS record deleted');
        setDeleteRecordId(null);
        queryClient.invalidateQueries({ queryKey: ['dns', selectedDomainId] });
      },
      onError: (err: any) => toast.error(`Failed to delete DNS record: ${err.message}`),
    });
  };

  const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA'];

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (record: DnsRecord) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded font-mono">
          {record.type}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (record: DnsRecord) => <span className="font-mono">{record.name}</span>,
    },
    {
      key: 'value',
      label: 'Value',
      render: (record: DnsRecord) => <span className="font-mono text-foreground-secondary">{record.value}</span>,
    },
    {
      key: 'ttl',
      label: 'TTL',
      render: (record: DnsRecord) => <span className="text-foreground-tertiary">{record.ttl}s</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (record: DnsRecord) => record.priority ?? '—',
    },
    {
      key: 'actions',
      label: '',
      render: (record: DnsRecord) => (
        <Button
          variant="ghost"
          size="small"
          onClick={() => setDeleteRecordId(record.id)}
          icon={<Icon name="icon-trash" size={15} />}
        >
          Delete
        </Button>
      ),
    },
  ];

  if (domainsLoading) {
    return <PageSkeleton />;
  }
  if (domainsError) return <ErrorState message={domainsErr?.message} onRetry={refetchDomains} />;
  if (dnsError && selectedDomainId) return <ErrorState message={dnsErr?.message} onRetry={refetchDns} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">DNS</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowAddRecord(true)} disabled={!selectedDomainId}>
          Add Record
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <label className="text-meta font-medium mb-1 block">Select Domain</label>
          <div className="flex flex-wrap gap-2">
            {domains?.map((domain) => (
              <Button
                key={domain.id}
                variant={selectedDomainId === domain.id ? 'primary' : 'default'}
                onClick={() => setSelectedDomainId(domain.id)}
                size="small"
              >
                {domain.name}
              </Button>
            ))}
          </div>
        </div>

        {selectedDomainId && dnsZone && dnsZone.records.length > 0 ? (
          <DataTable
            columns={columns}
            data={dnsZone.records}
            rowKey={(record) => record.id}
            emptyState={
              <EmptyState
                icon="icon-dns"
                title="No DNS records"
                description="Add your first DNS record"
                action={{ label: 'Add Record', onClick: () => setShowAddRecord(true) }}
              />
            }
          />
        ) : (
          <p className="text-small text-foreground-tertiary text-center py-8">
            {selectedDomainId ? 'No DNS records for this domain' : 'Select a domain to manage DNS records'}
          </p>
        )}
      </Card>

      {selectedDomainId && (
        <Card className="p-0">
          <button
            onClick={() => setCloudflareOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon name="icon-cloud" size={18} className="text-foreground-secondary" />
              <span className="text-card-title font-medium">Cloudflare</span>
            </div>
            <Icon
              name="icon-chevron-down"
              size={16}
              className={`text-foreground-secondary transition-transform ${cloudflareOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {cloudflareOpen && (
            <div className="px-4 pb-4 border-t border-border-tertiary pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-small font-medium">Enable Cloudflare DNS</span>
                </div>
                <input
                  type="checkbox"
                  checked={cloudflareConfig?.enabled ?? false}
                  onChange={(e) => {
                    if (!selectedDomainId) return;
                    updateCloudflare.mutate(
                      { domainId: selectedDomainId, enabled: e.target.checked },
                      {
                        onSuccess: () => toast.success('Cloudflare DNS updated'),
                        onError: (err) => toast.error(`Failed to update: ${err.message}`),
                      }
                    );
                  }}
                  className="accent-foreground-info"
                />
              </div>
              {cloudflareConfig?.lastSyncAt && (
                <p className="text-small text-foreground-tertiary mt-2">
                  Last synced: {new Date(cloudflareConfig.lastSyncAt).toLocaleString()}
                </p>
              )}
              <Button
                variant="default"
                size="small"
                loading={syncCloudflare.isPending}
                onClick={() => {
                  if (!selectedDomainId) return;
                  syncCloudflare.mutate(selectedDomainId, {
                    onSuccess: () => toast.success('Cloudflare records synced'),
                    onError: (err) => toast.error(`Failed to sync: ${err.message}`),
                  });
                }}
                className="mt-3"
              >
                Sync with Cloudflare
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal
        isOpen={showAddRecord}
        onClose={() => setShowAddRecord(false)}
        title="Add DNS Record"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddRecord(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddRecord} loading={createRecord.isPending}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-meta font-medium mb-1 block">Type</label>
            <div className="flex flex-wrap gap-2">
              {recordTypes.map((type) => (
                <Button
                  key={type}
                  variant={newRecordType === type ? 'primary' : 'default'}
                  onClick={() => setNewRecordType(type)}
                  size="small"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
          <Input
            label="Name"
            value={newRecordName}
            onChange={(e) => setNewRecordName(e.target.value)}
            placeholder="@ or subdomain"
          />
          <Input
            label="Value"
            value={newRecordValue}
            onChange={(e) => setNewRecordValue(e.target.value)}
            placeholder="IP address or hostname"
          />
          <Input
            label="TTL"
            type="number"
            value={newRecordTtl}
            onChange={(e) => setNewRecordTtl(parseInt(e.target.value) || 3600)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteRecordId}
        onClose={() => setDeleteRecordId(null)}
        onConfirm={handleDeleteRecord}
        title="Delete DNS Record"
        description="This record will be removed from your DNS zone."
        confirmText="Delete"
        impact="medium"
        loading={deleteRecord.isPending}
      />
    </div>
  );
}