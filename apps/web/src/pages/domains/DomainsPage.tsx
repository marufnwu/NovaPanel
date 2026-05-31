import { useState, useEffect } from 'react';
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
import { ErrorState } from '../../components/ui/ErrorState';
import { useDomains, useCreateDomain, useDeleteDomain, useVerifyDomainDns, type Domain } from '../../api/hooks/domains';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function DomainsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const { data: domains, isLoading, isError, error, refetch } = useDomains(debouncedSearch);
  const createDomain = useCreateDomain();
  const deleteDomain = useDeleteDomain();
  const verifyDns = useVerifyDomainDns();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dnsCheckResult, setDnsCheckResult] = useState<{ pointsToServer: boolean; resolvesTo: string[]; error?: string; errorCode?: string; nameservers?: string[]; nameserverAddresses?: Record<string, string[]>; serverIp?: string } | null>(null);

  const handleCheckDns = async () => {
    if (!newDomainName) return;
    setDnsCheckResult(null);
    try {
      const result = await verifyDns.mutateAsync(newDomainName);
      setDnsCheckResult({
        pointsToServer: result.pointsToServer,
        resolvesTo: result.resolvesTo,
        error: result.error,
        errorCode: result.errorCode,
        nameservers: result.nameservers,
        nameserverAddresses: result.nameserverAddresses,
        serverIp: result.serverIp,
      });
    } catch (err: any) {
      setDnsCheckResult({
        pointsToServer: false,
        resolvesTo: [],
        error: err.message || 'DNS check failed',
      });
    }
  };

  const handleCreate = async () => {
    if (!newDomainName) return;
    createDomain.mutateAsync(
      { name: newDomainName, type: 'apex' },
      {
        onSuccess: () => {
          toast.success('Domain created successfully');
          setShowCreateModal(false);
          setNewDomainName('');
          setDnsCheckResult(null);
          queryClient.invalidateQueries({ queryKey: ['domains'] });
        },
        onError: (err: any) => toast.error(`Failed to create domain: ${err.message}`),
      }
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteDomain.mutateAsync(deleteId, {
      onSuccess: () => {
        toast.success('Domain deleted successfully');
        setDeleteId(null);
        queryClient.invalidateQueries({ queryKey: ['domains'] });
      },
      onError: (err: any) => toast.error(`Failed to delete domain: ${err.message}`),
    });
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Domain Name"
                value={newDomainName}
                onChange={(e) => {
                  setNewDomainName(e.target.value);
                  setDnsCheckResult(null);
                }}
                placeholder="example.com"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="default"
                onClick={handleCheckDns}
                loading={verifyDns.isPending}
                disabled={!newDomainName}
              >
                Check DNS
              </Button>
            </div>
          </div>

          <p className="text-small text-foreground-secondary mb-3">Your domain's A record must point to this server's IP address before adding it. Set the A record at your registrar first, then check DNS here.</p>

          {dnsCheckResult && (
            <div className={`p-3 rounded-lg border ${
              dnsCheckResult.pointsToServer
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              {dnsCheckResult.pointsToServer ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <Icon name="icon-check-circle" size={16} />
                    <span className="text-sm font-medium">Domain points to server</span>
                  </div>
                  {dnsCheckResult.nameservers && dnsCheckResult.nameservers.length > 0 && (
                    <div className="ml-6 mt-2 p-2 bg-green-500/5 rounded text-xs space-y-1">
                      <p className="font-medium text-green-600">Nameservers and their A records for this domain:</p>
                      {dnsCheckResult.nameservers.map((ns: string) => {
                        const addresses = dnsCheckResult.nameserverAddresses?.[ns] || [];
                        const hasAddress = addresses.length > 0;
                        return (
                          <div key={ns} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${hasAddress ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span className="font-mono">{ns}</span>
                            {hasAddress ? (
                              <span className="text-green-600">→ {addresses.join(', ')}</span>
                            ) : (
                              <span className="text-yellow-500">→ no A record</span>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-foreground-secondary mt-1">Domain resolves to {dnsCheckResult.resolvesTo.join(', ')} — ready to add.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <Icon name="icon-x-circle" size={16} />
                    <span className="text-sm font-medium">DNS verification failed</span>
                  </div>
                  {dnsCheckResult.error && (
                    <p className="text-xs text-red-500/80 ml-6">{dnsCheckResult.error}</p>
                  )}
                  {dnsCheckResult.errorCode === 'A_RECORD_WRONG' && (
                    <div className="space-y-2">
                      <div className="ml-6 mt-2 p-2 bg-red-500/5 rounded text-xs">
                        <p className="font-medium text-red-600">Action needed:</p>
                        <p>Update your domain's A record at your registrar to point to the server IP.</p>
                      </div>
                      {dnsCheckResult.nameservers && dnsCheckResult.nameservers.length > 0 && (
                        <div className="ml-6 mt-2 p-2 bg-red-500/5 rounded text-xs space-y-1">
                          <p className="font-medium text-red-600">Nameservers and their A records for this domain:</p>
                          {dnsCheckResult.nameservers.map((ns: string) => {
                            const addresses = dnsCheckResult.nameserverAddresses?.[ns] || [];
                            const hasAddress = addresses.length > 0;
                            return (
                              <div key={ns} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hasAddress ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="font-mono">{ns}</span>
                                {hasAddress ? (
                                  <span className="text-green-600">→ {addresses.join(', ')}</span>
                                ) : (
                                  <span className="text-red-500">→ no A record</span>
                                )}
                              </div>
                            );
                          })}
                          <p className="text-foreground-secondary mt-1">Your A record is pointing to {dnsCheckResult.resolvesTo.join(', ')} but should point to {dnsCheckResult.serverIp}.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {dnsCheckResult.errorCode === 'NO_A_RECORD' && (
                    <div className="space-y-2">
                      <div className="ml-6 mt-2 p-2 bg-yellow-500/5 rounded text-xs">
                        <p className="font-medium text-yellow-600">Action needed:</p>
                        <p>Add an A record at your registrar pointing to the server IP.</p>
                      </div>
                      {dnsCheckResult.nameservers && dnsCheckResult.nameservers.length > 0 && (
                        <div className="ml-6 mt-2 p-2 bg-yellow-500/5 rounded text-xs space-y-1">
                          <p className="font-medium text-yellow-600">Nameservers found:</p>
                          {dnsCheckResult.nameservers.map((ns: string) => {
                            const addresses = dnsCheckResult.nameserverAddresses?.[ns] || [];
                            const hasAddress = addresses.length > 0;
                            return (
                              <div key={ns} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hasAddress ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="font-mono">{ns}</span>
                                {hasAddress ? (
                                  <span className="text-green-600">→ {addresses.join(', ')}</span>
                                ) : (
                                  <span className="text-red-500">→ no A record</span>
                                )}
                              </div>
                            );
                          })}
                          <p className="text-foreground-secondary mt-1">None of your nameservers have an A record for this domain. The A record must be added at your registrar.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {dnsCheckResult.errorCode === 'NO_NS_RECORDS' && (
                    <div className="ml-6 mt-2 p-2 bg-yellow-500/5 rounded text-xs">
                      <p className="font-medium text-yellow-600">Action needed:</p>
                      <p>Set nameservers at your registrar. If already set, wait for DNS propagation (up to 48 hours).</p>
                    </div>
                  )}
                  {dnsCheckResult.resolvesTo.length > 0 && (
                    <p className="text-xs text-red-500/80 ml-6">
                      Currently resolves to: {dnsCheckResult.resolvesTo.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Domain"
        description="This action cannot be undone. All associated records will be deleted."
        confirmText="Delete"
        impact="high"
        loading={deleteDomain.isPending}
      />
    </div>
  );
}