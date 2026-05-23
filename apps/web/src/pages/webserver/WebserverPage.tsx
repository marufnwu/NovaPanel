import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useWebserverStatus, useWebserverDomains, useVhostConfig, useUpdateVhost, type VhostConfig, type DomainOption } from '../../api/hooks/webserver';
import { Icon } from '../../components/icons';

export function WebserverPage() {
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useWebserverStatus();
  const { data: domains } = useWebserverDomains();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const { data: vhostConfig } = useVhostConfig(selectedDomain || '');
  const updateVhost = useUpdateVhost();

  const [showEditModal, setShowEditModal] = useState(false);
  const [forceHttps, setForceHttps] = useState(false);
  const [gzip, setGzip] = useState(true);
  const [hsts, setHsts] = useState(false);
  const [caching, setCaching] = useState(false);

  const handleSave = async () => {
    if (!selectedDomain) return;
    try {
      await updateVhost.mutateAsync({
        domain: selectedDomain,
        redirectHttpToHttps: forceHttps,
        gzipEnabled: gzip,
        hsts,
        browserCachingEnabled: caching,
      });
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['webserver'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (statusLoading) {
    return <PageSkeleton />;
  }

  const columns = [
    {
      key: 'name',
      label: 'Domain',
      render: (d: DomainOption) => <span className="font-mono font-medium">{d.name}</span>,
    },
    {
      key: 'webServer',
      label: 'Web Server',
    },
    {
      key: 'status',
      label: 'Status',
      render: (d: DomainOption) => <StatusBadge status={d.status === 'active' ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (d: DomainOption) => (
        <Button variant="ghost" size="small" onClick={() => {
          setSelectedDomain(d.name);
          if (vhostConfig) {
            setForceHttps(vhostConfig.redirectHttpToHttps);
            setGzip(vhostConfig.gzipEnabled);
            setHsts(vhostConfig.hsts);
            setCaching(vhostConfig.browserCachingEnabled);
          }
          setShowEditModal(true);
        }}>
          Configure
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Web Server</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Nginx">
          <div className="flex items-center justify-between">
            <StatusBadge status={status?.nginx?.status === 'running' ? 'running' : 'stopped'} />
            <Button variant="ghost" size="small" onClick={() => updateVhost.mutate({ domain: 'nginx', action: 'reload' } as any)}>
              Reload
            </Button>
          </div>
        </Card>
        <Card title="Apache">
          <div className="flex items-center justify-between">
            <StatusBadge status={status?.apache?.status === 'running' ? 'running' : 'stopped'} />
            <Button variant="ghost" size="small" onClick={() => updateVhost.mutate({ domain: 'apache', action: 'reload' } as any)}>
              Reload
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Domain Configurations">
        {domains && domains.length > 0 ? (
          <DataTable
            columns={columns}
            data={domains}
            rowKey={(d) => d.id}
          />
        ) : (
          <p className="text-small text-foreground-tertiary text-center py-8">No domains configured</p>
        )}
      </Card>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Configure ${selectedDomain}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={updateVhost.isPending}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-small">Force HTTPS</span>
            <Button variant={forceHttps ? 'primary' : 'default'} size="small" onClick={() => setForceHttps(!forceHttps)}>
              {forceHttps ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-small">Gzip Compression</span>
            <Button variant={gzip ? 'primary' : 'default'} size="small" onClick={() => setGzip(!gzip)}>
              {gzip ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-small">HSTS</span>
            <Button variant={hsts ? 'primary' : 'default'} size="small" onClick={() => setHsts(!hsts)}>
              {hsts ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-small">Browser Caching</span>
            <Button variant={caching ? 'primary' : 'default'} size="small" onClick={() => setCaching(!caching)}>
              {caching ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}