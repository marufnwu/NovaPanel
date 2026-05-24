import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useSites, useCreateSite, type Site } from '../../api/hooks/sites';
import { useDomains } from '../../api/hooks/domains';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function SitesPage() {
  const navigate = useNavigate();
  const { data: sites, isLoading, isError, error, refetch } = useSites();
  const createSite = useCreateSite();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (site: Site) => <span className="font-medium">{site.name}</span>,
    },
    { key: 'runtime', label: 'Runtime' },
    {
      key: 'status',
      label: 'Status',
      render: (site: Site) => <StatusBadge status={site.status as any} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (site: Site) => new Date(site.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (site: Site) => (
        <Button
          variant="ghost"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate({ to: '/sites/$siteId', params: { siteId: site.id } });
          }}
          icon={<Icon name="icon-arrow-right" size={15} />}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Sites</h1>
        <Button
          icon={<Icon name="icon-plus" size={16} />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Site
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={sites || []}
        rowKey={(site) => site.id}
        onRowClick={(site) => navigate({ to: '/sites/$siteId', params: { siteId: site.id } })}
        emptyState={
          <EmptyState
            icon="icon-host"
            title="No sites yet"
            description="Create your first site to get started"
            action={{ label: 'Create Site', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <CreateSiteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mutation={createSite}
        onCreated={(siteId) => {
          setShowCreateModal(false);
          navigate({ to: '/sites/$siteId', params: { siteId } });
        }}
      />
    </div>
  );
}

function CreateSiteModal({
  isOpen,
  onClose,
  mutation,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  mutation: ReturnType<typeof useCreateSite>;
  onCreated: (siteId: string) => void;
}) {
  const { data: domains } = useDomains();
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [runtime, setRuntime] = useState('php');
  const [phpVersion, setPhpVersion] = useState('8.2');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !domainId) return;
    mutation.mutate(
      { name, primaryDomain: domainId, runtime: { schemaVersion: 1, runtime: runtime as any, version: runtime === 'php' ? phpVersion : undefined } } as any,
      {
        onSuccess: (data) => {
          toast.success(`Site "${name}" created`);
          onCreated(data.id);
        },
        onError: (err) => toast.error(`Failed to create site: ${err.message}`),
      }
    );
  };

  const domainOptions = domains?.map((d) => ({ value: d.id, label: d.name })) || [];
  const runtimes = ['php', 'node', 'python', 'go', 'rust', 'docker', 'static'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Site"
      size="medium"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
            disabled={!name || !domainId}
          >
            Create Site
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Site Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. myapp"
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-meta font-medium">Domain</label>
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
          >
            <option value="">Select domain</option>
            {domainOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-meta font-medium">Runtime</label>
          <select
            value={runtime}
            onChange={(e) => setRuntime(e.target.value)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
          >
            {runtimes.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {runtime === 'php' && (
          <div className="flex flex-col gap-1">
            <label className="text-meta font-medium">PHP Version</label>
            <select
              value={phpVersion}
              onChange={(e) => setPhpVersion(e.target.value)}
              className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
            >
              {['8.1', '8.2', '8.3', '8.4'].map((v) => (
                <option key={v} value={v}>
                  PHP {v}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}