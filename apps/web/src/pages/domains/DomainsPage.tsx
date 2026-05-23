import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDomains, useCreateDomain, useDeleteDomain, type Domain } from '../../api/hooks/domains';
import { Icon } from '../../components/icons';

export function DomainsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: domains, isLoading } = useDomains(search);
  const createDomain = useCreateDomain();
  const deleteDomain = useDeleteDomain();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      await createDomain.mutateAsync({ name: newDomainName, type: 'apex', skipDnsVerification: false });
      setShowCreateModal(false);
      setNewDomainName('');
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDomain.mutateAsync(deleteId);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const getDomainType = (domain: Domain) => {
    if (domain.type === 'apex') return 'Apex';
    if (domain.type === 'subdomain') return 'Subdomain';
    if (domain.type === 'wildcard') return 'Wildcard';
    return domain.type;
  };

  const getSslStatus = (domain: Domain) => {
    if (domain.sslStatus === 'active') return 'active';
    if (domain.sslStatus === 'expired') return 'expired';
    return 'inactive';
  };

  const columns = [
    {
      key: 'name',
      label: 'Domain',
      render: (domain: Domain) => <span className="font-mono font-medium">{domain.name}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (domain: Domain) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded">
          {getDomainType(domain)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (domain: Domain) => <StatusBadge status={domain.status === 'active' ? 'active' : 'inactive'} />,
    },
    {
      key: 'ssl',
      label: 'SSL',
      render: (domain: Domain) => <StatusBadge status={getSslStatus(domain)} />,
    },
    {
      key: 'siteId',
      label: 'Site',
      render: (domain: Domain) => domain.siteId ? (
        <Button variant="ghost" size="small" onClick={(e) => { e.stopPropagation(); navigate({ to: '/sites/$siteId', params: { siteId: domain.siteId } }); }}>
          View Site
        </Button>
      ) : '—',
    },
    {
      key: 'actions',
      label: '',
      render: (domain: Domain) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: '/domains/$domainId', params: { domainId: domain.id } });
            }}
            icon={<Icon name="icon-arrow-right" size={15} />}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(domain.id);
            }}
            icon={<Icon name="icon-trash" size={15} />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Domains</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          Add Domain
        </Button>
      </div>

      <div className="max-w-[300px]">
        <Input
          placeholder="Search domains..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={domains || []}
        rowKey={(domain) => domain.id}
        onRowClick={(domain) => navigate({ to: '/domains/$domainId', params: { domainId: domain.id } })}
        emptyState={
          <EmptyState
            icon="icon-world"
            title="No domains yet"
            description="Add your first domain to get started"
            action={{ label: 'Add Domain', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Domain"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createDomain.isPending}>
              Add
            </Button>
          </>
        }
      >
        <Input
          label="Domain Name"
          value={newDomainName}
          onChange={(e) => setNewDomainName(e.target.value)}
          placeholder="example.com"
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Domain"
        description="This action cannot be undone. All associated records will be deleted."
        confirmText="Delete"
        impact="high"
      />
    </div>
  );
}