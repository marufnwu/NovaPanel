import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDomains } from '../../api/hooks/domains';
import { useDnsZone, useCreateDnsRecord, useDeleteDnsRecord, type DnsRecord } from '../../api/hooks/dns';
import { Icon } from '../../components/icons';

export function DnsPage() {
  const queryClient = useQueryClient();
  const { data: domains } = useDomains();
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const { data: dnsZone, isLoading } = useDnsZone(selectedDomainId || '');
  const createRecord = useCreateDnsRecord();
  const deleteRecord = useDeleteDnsRecord();

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [newRecordType, setNewRecordType] = useState('A');
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordValue, setNewRecordValue] = useState('');
  const [newRecordTtl, setNewRecordTtl] = useState(3600);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  const handleAddRecord = async () => {
    if (!selectedDomainId) return;
    try {
      await createRecord.mutateAsync({
        domainId: selectedDomainId,
        type: newRecordType,
        name: newRecordName,
        value: newRecordValue,
        ttl: newRecordTtl,
      });
      setShowAddRecord(false);
      setNewRecordName('');
      setNewRecordValue('');
      queryClient.invalidateQueries({ queryKey: ['dns', selectedDomainId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecordId || !selectedDomainId) return;
    try {
      await deleteRecord.mutateAsync({ domainId: selectedDomainId, recordId: deleteRecordId });
      setDeleteRecordId(null);
      queryClient.invalidateQueries({ queryKey: ['dns', selectedDomainId] });
    } catch (err) {
      console.error(err);
    }
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

  if (!selectedDomainId && domains && domains.length > 0) {
    setSelectedDomainId(domains[0].id);
  }

  if (isLoading) {
    return <PageSkeleton />;
  }

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
      />
    </div>
  );
}