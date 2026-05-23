import { useState } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useDomain, useSubdomains, useCreateSubdomain, useDeleteSubdomain, useAliases, useCreateAlias, useDeleteAlias, useRedirects, useCreateRedirect, useDeleteRedirect, type Subdomain, type DomainAlias, type DomainRedirect } from '../../api/hooks/domains';
import { Icon } from '../../components/icons';

export function DomainDetailPage() {
  const params = useParams({ from: '/domains/$domainId' });
  const search = useSearch({ from: '/domains/$domainId' });
  const domainId = params.domainId as string;
  const activeTab = (search as any)?.tab || 'overview';

  const { data: domain, isLoading } = useDomain(domainId);
  const { data: subdomains } = useSubdomains(domainId);
  const { data: aliases } = useAliases(domainId);
  const { data: redirects } = useRedirects(domainId);

  const queryClient = useQueryClient();
  const createSubdomain = useCreateSubdomain(domainId);
  const deleteSubdomain = useDeleteSubdomain(domainId);
  const createAlias = useCreateAlias(domainId);
  const deleteAlias = useDeleteAlias(domainId);
  const createRedirect = useCreateRedirect(domainId);
  const deleteRedirect = useDeleteRedirect(domainId);

  const [showAddSubdomain, setShowAddSubdomain] = useState(false);
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [showAddRedirect, setShowAddRedirect] = useState(false);
  const [newSubdomainName, setNewSubdomainName] = useState('');
  const [newAliasName, setNewAliasName] = useState('');
  const [redirectSource, setRedirectSource] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('');
  const [redirectType, setRedirectType] = useState<'301' | '302'>('301');

  const handleTabChange = (tabId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new Event('locationchange'));
  };

  const handleAddSubdomain = async () => {
    try {
      await createSubdomain.mutateAsync({ name: newSubdomainName });
      setShowAddSubdomain(false);
      setNewSubdomainName('');
      queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAlias = async () => {
    try {
      await createAlias.mutateAsync({ alias: newAliasName });
      setShowAddAlias(false);
      setNewAliasName('');
      queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRedirect = async () => {
    try {
      await createRedirect.mutateAsync({ sourcePath: redirectSource, targetUrl: redirectTarget, type: redirectType });
      setShowAddRedirect(false);
      setRedirectSource('');
      setRedirectTarget('');
      setRedirectType('301');
      queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!domain) {
    return <div className="text-center py-12">Domain not found</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'subdomains', label: 'Subdomains' },
    { id: 'aliases', label: 'Aliases' },
    { id: 'redirects', label: 'Redirects' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-page-title font-medium font-mono">{domain.name}</h1>
          <StatusBadge status={domain.status === 'active' ? 'active' : 'inactive'} />
        </div>
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="px-4 py-2.5 text-small transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab.id ? 500 : 400,
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <Card title="Domain Info">
            <div className="space-y-2 text-small">
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Type</span>
                <span className="capitalize">{domain.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Created</span>
                <span>{new Date(domain.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
          <Card title="SSL Status">
{domain.sslStatus === 'active' ? (
            <div className="space-y-2 text-small">
              <div className="flex justify-between">
                <span className="text-foreground-secondary">SSL Status</span>
                <StatusBadge status="active" />
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Auto Renew</span>
                <span>{domain.sslAutoRenew ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          ) : (
            <p className="text-small text-foreground-tertiary">No SSL certificate</p>
          )}
          </Card>
        </div>
      )}

      {activeTab === 'subdomains' && (
        <Card action={<Button size="small" onClick={() => setShowAddSubdomain(true)}>Add Subdomain</Button>}>
          {subdomains && subdomains.length > 0 ? (
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (s: Subdomain) => <span className="font-mono">{s.name}</span> },
                { key: 'documentRoot', label: 'Document Root', render: (s: Subdomain) => <span className="font-mono text-foreground-secondary">{s.documentRoot}</span> },
                { key: 'phpVersion', label: 'PHP' },
                {
                  key: 'actions',
                  label: '',
                  render: (s: Subdomain) => (
                    <Button variant="ghost" size="small" onClick={() => deleteSubdomain.mutate(s.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
                  ),
                },
              ]}
              data={subdomains}
              rowKey={(s) => s.id}
            />
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-4">No subdomains</p>
          )}
        </Card>
      )}

      {activeTab === 'aliases' && (
        <Card action={<Button size="small" onClick={() => setShowAddAlias(true)}>Add Alias</Button>}>
          {aliases && aliases.length > 0 ? (
            <DataTable
              columns={[
                { key: 'alias', label: 'Alias', render: (a: DomainAlias) => <span className="font-mono">{a.alias}</span> },
                { key: 'createdAt', label: 'Created', render: (a: DomainAlias) => new Date(a.createdAt).toLocaleDateString() },
                {
                  key: 'actions',
                  label: '',
                  render: (a: DomainAlias) => (
                    <Button variant="ghost" size="small" onClick={() => deleteAlias.mutate(a.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
                  ),
                },
              ]}
              data={aliases}
              rowKey={(a) => a.id}
            />
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-4">No aliases</p>
          )}
        </Card>
      )}

      {activeTab === 'redirects' && (
        <Card action={<Button size="small" onClick={() => setShowAddRedirect(true)}>Add Redirect</Button>}>
          {redirects && redirects.length > 0 ? (
            <DataTable
              columns={[
                { key: 'sourcePath', label: 'From', render: (r: DomainRedirect) => <span className="font-mono">{r.sourcePath}</span> },
                { key: 'targetUrl', label: 'To', render: (r: DomainRedirect) => <span className="font-mono text-foreground-secondary">{r.targetUrl}</span> },
                { key: 'type', label: 'Type', render: (r: DomainRedirect) => <span className="text-foreground-secondary">{r.type}</span> },
                {
                  key: 'actions',
                  label: '',
                  render: (r: DomainRedirect) => (
                    <Button variant="ghost" size="small" onClick={() => deleteRedirect.mutate(r.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
                  ),
                },
              ]}
              data={redirects}
              rowKey={(r) => r.id}
            />
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-4">No redirects</p>
          )}
        </Card>
      )}

      <Modal isOpen={showAddSubdomain} onClose={() => setShowAddSubdomain(false)} title="Add Subdomain"
        footer={<><Button variant="ghost" onClick={() => setShowAddSubdomain(false)}>Cancel</Button><Button variant="primary" onClick={handleAddSubdomain} loading={createSubdomain.isPending}>Add</Button></>}>
        <Input label="Subdomain Name" value={newSubdomainName} onChange={(e) => setNewSubdomainName(e.target.value)} placeholder="www" />
      </Modal>

      <Modal isOpen={showAddAlias} onClose={() => setShowAddAlias(false)} title="Add Alias"
        footer={<><Button variant="ghost" onClick={() => setShowAddAlias(false)}>Cancel</Button><Button variant="primary" onClick={handleAddAlias} loading={createAlias.isPending}>Add</Button></>}>
        <Input label="Alias Domain" value={newAliasName} onChange={(e) => setNewAliasName(e.target.value)} placeholder="alias.com" />
      </Modal>

      <Modal isOpen={showAddRedirect} onClose={() => setShowAddRedirect(false)} title="Add Redirect"
        footer={<><Button variant="ghost" onClick={() => setShowAddRedirect(false)}>Cancel</Button><Button variant="primary" onClick={handleAddRedirect} loading={createRedirect.isPending}>Add</Button></>}>
        <div className="space-y-4">
          <Input label="Source Path" value={redirectSource} onChange={(e) => setRedirectSource(e.target.value)} placeholder="/old-path" />
          <Input label="Target URL" value={redirectTarget} onChange={(e) => setRedirectTarget(e.target.value)} placeholder="https://example.com" />
          <div className="flex gap-2">
            <Button variant={redirectType === '301' ? 'primary' : 'default'} onClick={() => setRedirectType('301')}>301 Permanent</Button>
            <Button variant={redirectType === '302' ? 'primary' : 'default'} onClick={() => setRedirectType('302')}>302 Temporary</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}