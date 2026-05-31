import { useState } from 'react';
import { useNavigate, useRouterState, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useDomain, useSubdomains, useCreateSubdomain, useDeleteSubdomain,
  useAliases as useDomainAliases, useCreateAlias as useCreateDomainAlias, useDeleteAlias as useDeleteDomainAlias,
  useRedirects, useCreateRedirect, useDeleteRedirect,
  useDomainCloudflareZone, useDomainCloudflareDns, useDomainCloudflareSsl,
  useDomainCloudflareFirewall, useDomainCloudflareRedirects,
  useDomainAccessLog, useDomainErrorLog,
  useDeleteDomain as useDeleteDomainMutation,
  useDomainNameservers, useUpdateDomainNameservers, useVerifyDomainNameservers,
  type Subdomain, type DomainAlias, type DomainRedirect, type DomainNameserverResult,
} from '../../api/hooks/domains';
import { useDnsZone, useCreateDnsRecord, useDeleteDnsRecord } from '../../api/hooks/dns';
import { useIssueLetsEncrypt, useRenewCertificate, useToggleAutoRenew, useDownloadCert } from '../../api/hooks/ssl';
import { api } from '../../api/client';
import { useMailAliases as useMailForwardAliases, useCreateAlias as useCreateMailForwardAlias, useDeleteAlias as useDeleteMailForwardAlias, useMailboxes, useCreateMailbox, useDeleteMailbox, useMailDomainInfo, useDkimStatus } from '../../api/hooks/mail';
import { FtpPage } from '../ftp/FtpPage';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function DomainDetailPage() {
  const params = useParams({ strict: false }) as { domainId?: string };
  const domainId = params.domainId || '';
  const search = useRouterState({ select: (s) => s.location.search }) as any;
  const activeTab = search?.tab || 'overview';
  const navigate = useNavigate();

  if (!domainId) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-foreground-secondary">Domain ID is required</p>
      </div>
    );
  }

  const { data: domain, isLoading, isError, error, refetch } = useDomain(domainId);

  const queryClient = useQueryClient();

  const [showAddSubdomain, setShowAddSubdomain] = useState(false);
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [showAddRedirect, setShowAddRedirect] = useState(false);
  const [newSubdomainName, setNewSubdomainName] = useState('');
  const [newAliasName, setNewAliasName] = useState('');
  const [redirectSource, setRedirectSource] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('');
  const [redirectType, setRedirectType] = useState<'301' | '302'>('301');
  const [deleteSubdomainId, setDeleteSubdomainId] = useState<string | null>(null);
  const [deleteAliasId, setDeleteAliasId] = useState<string | null>(null);
  const [deleteRedirectId, setDeleteRedirectId] = useState<string | null>(null);

  const deleteDomain = useDeleteDomainMutation();

  const [showEditNameservers, setShowEditNameservers] = useState(false);
  const [editedNameservers, setEditedNameservers] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const [sslEmail, setSslEmail] = useState('');

  const handleTabChange = (tabId: string) => {
    navigate({ search: { tab: tabId } } as any);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  if (!domain) {
    return <div className="text-center py-12">Domain not found</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'subdomains', label: 'Subdomains' },
    { id: 'aliases', label: 'Aliases' },
    { id: 'redirects', label: 'Redirects' },
    { id: 'dns', label: 'DNS' },
    { id: 'nameservers', label: 'Nameservers' },
    { id: 'ssl', label: 'SSL' },
    { id: 'mail', label: 'Mail' },
    { id: 'ftp', label: 'FTP' },
    { id: 'cloudflare', label: 'Cloudflare' },
    { id: 'logs', label: 'Logs' },
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
              className={cn(
                'px-4 py-2.5 text-small transition-colors relative',
                activeTab === tab.id
                  ? 'text-foreground-primary font-medium'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab domain={domain} />}

      {activeTab === 'subdomains' && <SubdomainsTab domainId={domainId} domainName={domain.name} />}

      {activeTab === 'aliases' && <AliasesTab domainId={domainId} />}

      {activeTab === 'redirects' && <RedirectsTab domainId={domainId} />}

      {activeTab === 'dns' && <DnsTab domainId={domainId} />}

      {activeTab === 'nameservers' && <NameserversTab domainId={domainId} />}

      {activeTab === 'ssl' && <SslTab domainId={domainId} domain={domain} />}

      {activeTab === 'mail' && <MailTab domainId={domainId} />}

      {activeTab === 'ftp' && <FtpPage domainId={domainId} hideDomainSelector />}

      {activeTab === 'cloudflare' && <CloudflareTab domainId={domainId} />}

      {activeTab === 'logs' && <LogsTab domainId={domainId} />}
    </div>
  );
}

function OverviewTab({ domain }: { domain: any }) {
  return (
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
          <EmptyState icon="icon-shield" title="No SSL certificate" description="Add an SSL certificate to this domain" />
        )}
      </Card>
    </div>
  );
}

function SubdomainsTab({ domainId, domainName }: { domainId: string; domainName: string }) {
  const queryClient = useQueryClient();
  const { data: subdomains, isLoading } = useSubdomains(domainId);
  const createSubdomain = useCreateSubdomain(domainId);
  const deleteSubdomain = useDeleteSubdomain(domainId);
  const [showAdd, setShowAdd] = useState(false);
  const [newSubdomainName, setNewSubdomainName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newSubdomainName) return;
    try {
      await createSubdomain.mutateAsync({ name: newSubdomainName });
      toast.success('Subdomain created');
      setShowAdd(false);
      setNewSubdomainName('');
      queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <Card action={<Button size="small" onClick={() => setShowAdd(true)}>Add Subdomain</Button>}>
        {subdomains && subdomains.length > 0 ? (
          <DataTable
            columns={[
              { key: 'name', label: 'Name', render: (s: Subdomain) => <span className="font-mono">{s.name}</span> },
              { key: 'documentRoot', label: 'Document Root', render: (s: Subdomain) => <span className="font-mono text-foreground-secondary">{s.documentRoot}</span> },
              { key: 'phpVersion', label: 'PHP' },
              { key: 'actions', label: '', render: (s: Subdomain) => <Button variant="ghost" size="small" onClick={() => setDeleteId(s.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button> },
            ]}
            data={subdomains}
            rowKey={(s) => s.id}
          />
        ) : (
          <EmptyState icon="icon-world" title="No subdomains" description="Add subdomains to this domain" action={{ label: 'Add Subdomain', onClick: () => setShowAdd(true) }} />
        )}
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Subdomain"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" onClick={handleAdd} loading={createSubdomain.isPending}>Add</Button></>}>
        <Input label="Subdomain Name" value={newSubdomainName} onChange={(e) => setNewSubdomainName(e.target.value)} placeholder="www" />
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          deleteSubdomain.mutate(deleteId, { onSuccess: () => { toast.success('Subdomain deleted'); setDeleteId(null); queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] }); }, onError: (err: any) => toast.error(err.message) });
        }} title="Delete Subdomain" description="This subdomain will be removed." confirmText="Delete" impact="medium" loading={deleteSubdomain.isPending} />
    </>
  );
}

function AliasesTab({ domainId }: { domainId: string }) {
  const queryClient = useQueryClient();
  const { data: aliases, isLoading } = useDomainAliases(domainId);
  const createAlias = useCreateDomainAlias(domainId);
  const deleteAlias = useDeleteDomainAlias(domainId);
  const [showAdd, setShowAdd] = useState(false);
  const [newAliasName, setNewAliasName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newAliasName) return;
    try {
      await createAlias.mutateAsync({ alias: newAliasName });
      toast.success('Alias created');
      setShowAdd(false);
      setNewAliasName('');
      queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <Card action={<Button size="small" onClick={() => setShowAdd(true)}>Add Alias</Button>}>
        {aliases && aliases.length > 0 ? (
          <DataTable
            columns={[
              { key: 'alias', label: 'Alias', render: (a: DomainAlias) => <span className="font-mono">{a.alias}</span> },
              { key: 'createdAt', label: 'Created', render: (a: DomainAlias) => new Date(a.createdAt).toLocaleDateString() },
              { key: 'actions', label: '', render: (a: DomainAlias) => <Button variant="ghost" size="small" onClick={() => setDeleteId(a.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button> },
            ]}
            data={aliases}
            rowKey={(a) => a.id}
          />
        ) : (
          <EmptyState icon="icon-world" title="No aliases" description="Add aliases to this domain" action={{ label: 'Add Alias', onClick: () => setShowAdd(true) }} />
        )}
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Alias"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" onClick={handleAdd} loading={createAlias.isPending}>Add</Button></>}>
        <Input label="Alias Domain" value={newAliasName} onChange={(e) => setNewAliasName(e.target.value)} placeholder="alias.com" />
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          deleteAlias.mutate(deleteId, { onSuccess: () => { toast.success('Alias deleted'); setDeleteId(null); queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] }); }, onError: (err: any) => toast.error(err.message) });
        }} title="Delete Alias" description="This alias will be removed." confirmText="Delete" impact="medium" loading={deleteAlias.isPending} />
    </>
  );
}

function RedirectsTab({ domainId }: { domainId: string }) {
  const queryClient = useQueryClient();
  const { data: redirects, isLoading } = useRedirects(domainId);
  const createRedirect = useCreateRedirect(domainId);
  const deleteRedirect = useDeleteRedirect(domainId);
  const [showAdd, setShowAdd] = useState(false);
  const [redirectSource, setRedirectSource] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('');
  const [redirectType, setRedirectType] = useState<'301' | '302'>('301');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!redirectTarget) return;
    try {
      await createRedirect.mutateAsync({ sourcePath: redirectSource, targetUrl: redirectTarget, type: redirectType });
      toast.success('Redirect created');
      setShowAdd(false);
      setRedirectSource('');
      setRedirectTarget('');
      setRedirectType('301');
      queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <Card action={<Button size="small" onClick={() => setShowAdd(true)}>Add Redirect</Button>}>
        {redirects && redirects.length > 0 ? (
          <DataTable
            columns={[
              { key: 'sourcePath', label: 'From', render: (r: DomainRedirect) => <span className="font-mono">{r.sourcePath}</span> },
              { key: 'targetUrl', label: 'To', render: (r: DomainRedirect) => <span className="font-mono text-foreground-secondary">{r.targetUrl}</span> },
              { key: 'type', label: 'Type' },
              { key: 'actions', label: '', render: (r: DomainRedirect) => <Button variant="ghost" size="small" onClick={() => setDeleteId(r.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button> },
            ]}
            data={redirects}
            rowKey={(r) => r.id}
          />
        ) : (
          <EmptyState icon="icon-arrows-right" title="No redirects" description="Add redirects to this domain" action={{ label: 'Add Redirect', onClick: () => setShowAdd(true) }} />
        )}
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Redirect"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" onClick={handleAdd} loading={createRedirect.isPending}>Add</Button></>}>
        <div className="space-y-4">
          <Input label="Source Path" value={redirectSource} onChange={(e) => setRedirectSource(e.target.value)} placeholder="/old-path" />
          <Input label="Target URL" value={redirectTarget} onChange={(e) => setRedirectTarget(e.target.value)} placeholder="https://example.com" />
          <div className="flex gap-2">
            <Button variant={redirectType === '301' ? 'primary' : 'default'} onClick={() => setRedirectType('301')}>301 Permanent</Button>
            <Button variant={redirectType === '302' ? 'primary' : 'default'} onClick={() => setRedirectType('302')}>302 Temporary</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          deleteRedirect.mutate(deleteId, { onSuccess: () => { toast.success('Redirect deleted'); setDeleteId(null); queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] }); }, onError: (err: any) => toast.error(err.message) });
        }} title="Delete Redirect" description="This redirect will be removed." confirmText="Delete" impact="medium" loading={deleteRedirect.isPending} />
    </>
  );
}

function DnsTab({ domainId }: { domainId: string }) {
  const { data: dnsZone, isLoading, refetch } = useDnsZone(domainId);
  const createDnsRecord = useCreateDnsRecord();
  const deleteDnsRecord = useDeleteDnsRecord();
  const [showAdd, setShowAdd] = useState(false);
  const [newRecordType, setNewRecordType] = useState('A');
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordValue, setNewRecordValue] = useState('');
  const [newRecordTtl, setNewRecordTtl] = useState(3600);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  const handleAddRecord = async () => {
    if (!newRecordName || !newRecordValue) return;
    try {
      await createDnsRecord.mutateAsync({ domainId, type: newRecordType, name: newRecordName, value: newRecordValue, ttl: newRecordTtl });
      toast.success('DNS record created');
      setShowAdd(false);
      setNewRecordName('');
      setNewRecordValue('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecordId) return;
    try {
      await deleteDnsRecord.mutateAsync({ domainId, recordId: deleteRecordId });
      toast.success('DNS record deleted');
      setDeleteRecordId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <Card title="DNS Records" action={<Button size="small" onClick={() => setShowAdd(true)} icon={<Icon name="icon-plus" size={15} />}>Add Record</Button>}>
        {dnsZone?.records && dnsZone.records.length > 0 ? (
          <DataTable
            columns={[
              { key: 'type', label: 'Type', render: (r: any) => <span className="font-mono">{r.type}</span> },
              { key: 'name', label: 'Name', render: (r: any) => <span className="font-mono">{r.name}</span> },
              { key: 'value', label: 'Value', render: (r: any) => <span className="font-mono text-foreground-secondary">{r.value}</span> },
              { key: 'ttl', label: 'TTL' },
              { key: 'actions', label: '', render: (r: any) => <Button variant="ghost" size="small" onClick={() => setDeleteRecordId(r.id)} icon={<Icon name="icon-trash" size={15} />} /> },
            ]}
            data={dnsZone.records}
            rowKey={(r: any) => r.id}
          />
        ) : (
          <EmptyState icon="icon-world" title="No DNS records" description="Add DNS records to this domain" action={{ label: 'Add Record', onClick: () => setShowAdd(true) }} />
        )}
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add DNS Record"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" onClick={handleAddRecord} loading={createDnsRecord.isPending}>Add</Button></>}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-meta font-medium mb-1 block">Type</label>
              <select value={newRecordType} onChange={(e) => setNewRecordType(e.target.value)} className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary w-full">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <Input label="Name" value={newRecordName} onChange={(e) => setNewRecordName(e.target.value)} placeholder="@ or www" />
            </div>
          </div>
          <Input label="Value" value={newRecordValue} onChange={(e) => setNewRecordValue(e.target.value)} placeholder="192.168.1.1" />
          <Input label="TTL" type="number" value={newRecordTtl} onChange={(e) => setNewRecordTtl(parseInt(e.target.value) || 3600)} placeholder="3600" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteRecordId} onClose={() => setDeleteRecordId(null)}
        onConfirm={handleDeleteRecord} title="Delete DNS Record" description="This DNS record will be permanently deleted." confirmText="Delete" impact="medium" loading={deleteDnsRecord.isPending} />
    </>
  );
}

function NameserversTab({ domainId }: { domainId: string }) {
  const queryClient = useQueryClient();
  const { data: nameserversData, refetch: refetchNameservers } = useDomainNameservers(domainId);
  const updateNameservers = useUpdateDomainNameservers(domainId);
  const verifyNameservers = useVerifyDomainNameservers(domainId);
  const [showEdit, setShowEdit] = useState(false);
  const [editedNameservers, setEditedNameservers] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const openEditor = () => {
    setEditedNameservers(nameserversData?.nameservers || []);
    setShowEdit(true);
    setVerifyResult(null);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyNameservers.mutateAsync();
      setVerifyResult(result);
    } catch (err: any) {
      toast.error(err.message);
    }
    setVerifying(false);
  };

  const handleSave = async () => {
    try {
      await updateNameservers.mutateAsync(editedNameservers);
      toast.success('Nameservers updated');
      setShowEdit(false);
      refetchNameservers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Card
        title="Nameservers"
        action={<div className="flex gap-2"><Button variant="default" size="small" onClick={handleVerify} loading={verifying}>Verify</Button><Button variant="primary" size="small" onClick={openEditor}>Edit</Button></div>}
      >
        {nameserversData?.nameservers && nameserversData.nameservers.length > 0 ? (
          <div className="space-y-3">
            {verifyResult?.results ? (
              <div className="space-y-2 mb-4">
                {verifyResult.results.map((r: DomainNameserverResult, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border ${r.isResolvable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-center gap-2">
                      <Icon name={r.isResolvable ? 'icon-check-circle' : 'icon-x-circle'} size={16} className={r.isResolvable ? 'text-green-600' : 'text-red-600'} />
                      <span className="font-mono font-medium">{r.hostname}</span>
                    </div>
                    {r.isResolvable ? (
                      <p className="text-small text-green-600/80 ml-6">Resolves to: {r.resolvesTo.join(', ')}</p>
                    ) : (
                      <p className="text-small text-red-600/80 ml-6">{r.error}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-1">
              {nameserversData.nameservers.map((ns: string, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-background-secondary">
                  <span className="font-mono text-small">{ns}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-small text-foreground-secondary mb-3">Nameservers delegate DNS authority for your domain. Each nameserver hostname must have a valid glue record (A record) pointing to a public IP address. Verification is automatic when saving.</p>
            <EmptyState icon="icon-world" title="No nameservers set" description="Set nameservers to manage DNS delegation for this domain" />
          </div>
        )}
      </Card>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Nameservers"
        footer={<><Button variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button><Button variant="primary" onClick={handleSave} loading={updateNameservers.isPending}>Save</Button></>}>
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">Enter nameservers (one per line). Each will be verified for valid glue records before saving.</p>
          <textarea
            className="w-full h-32 px-3 py-2 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50 font-mono"
            value={editedNameservers.join('\n')}
            onChange={(e) => setEditedNameservers(e.target.value.split('\n').filter(ns => ns.trim()))}
            placeholder="ns1.example.com&#10;ns2.example.com"
          />
          {verifyResult && (
            <div className="space-y-2">
              <p className="text-small font-medium">Verification Results:</p>
              {verifyResult.results?.map((r: DomainNameserverResult, i: number) => (
                <div key={i} className={`p-2 rounded text-small ${r.isResolvable ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  {r.isResolvable ? <span>{r.hostname} → {r.resolvesTo.join(', ')}</span> : <span>{r.hostname}: {r.error}</span>}
                </div>
              ))}
            </div>
          )}
          <Button variant="default" size="small" onClick={handleVerify} loading={verifying} disabled={editedNameservers.length === 0}>Verify Before Saving</Button>
        </div>
      </Modal>
    </>
  );
}

function SslTab({ domainId, domain }: { domainId: string; domain: any }) {
  const queryClient = useQueryClient();
  const issueCert = useIssueLetsEncrypt();
  const renewCert = useRenewCertificate();
  const toggleAutoRenew = useToggleAutoRenew();
  const downloadCert = useDownloadCert();
  const [email, setEmail] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const { data: sslCert } = useQuery({
    queryKey: ['ssl', domainId],
    queryFn: () => api.get<any>(`/domains/${domainId}/ssl`),
  });

  const handleIssue = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }
    try {
      await issueCert.mutateAsync({ domainId, email, challengeType: 'http-01' });
      toast.success('Certificate issuance started');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRenew = async () => {
    try {
      await renewCert.mutateAsync(domainId);
      toast.success('Certificate renewal started');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleAutoRenew = async () => {
    try {
      await toggleAutoRenew.mutateAsync({ domainId, autoRenew: !domain.sslAutoRenew });
      toast.success(`Auto-renew ${!domain.sslAutoRenew ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['domains', domainId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownloadCert = async (file: 'cert' | 'key' | 'chain') => {
    try {
      const result = await downloadCert.mutateAsync({ domainId, file });
      const blob = new Blob([result.pem], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${domain.name}_${file}.pem`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Certificate ${file} downloaded`);
      setShowDownloadMenu(false);
    } catch (err: any) {
      toast.error(`Failed to download: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="SSL Certificate">
        {domain.sslStatus === 'active' && sslCert ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${sslCert.expiresAt && new Date(sslCert.expiresAt) > new Date() ? 'bg-foreground-success' : 'bg-foreground-error'}`} />
                <span className="text-small font-medium">
                  {sslCert.expiresAt && new Date(sslCert.expiresAt) > new Date() ? 'Valid Certificate' : 'Expired Certificate'}
                </span>
              </div>
              <div className="text-meta text-foreground-tertiary">
                {sslCert.expiresAt ? `Expires ${new Date(sslCert.expiresAt).toLocaleDateString()}` : 'No expiry date'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-small">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Domain</span>
                  <span className="font-mono">{domain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Issuer</span>
                  <span>{sslCert.issuer || "Let's Encrypt"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Provider</span>
                  <span>{sslCert.type === 'letsencrypt' ? "Let's Encrypt" : sslCert.type || 'Unknown'}</span>
                </div>
              </div>
              <div className="space-y-2 text-small">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Valid From</span>
                  <span>{sslCert.issuedAt ? new Date(sslCert.issuedAt).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Valid Until</span>
                  <span>{sslCert.expiresAt ? new Date(sslCert.expiresAt).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Days Left</span>
                  <span className={sslCert.daysUntilExpiry !== null && sslCert.daysUntilExpiry < 30 ? 'text-foreground-error' : ''}>
                    {sslCert.daysUntilExpiry !== null ? sslCert.daysUntilExpiry : '—'}
                  </span>
                </div>
              </div>
            </div>

            {sslCert.sanDomains && sslCert.sanDomains.length > 0 && (
              <div className="p-3 bg-background-secondary rounded-lg">
                <div className="text-meta text-foreground-tertiary mb-2">Domains Covered</div>
                <div className="flex flex-wrap gap-2">
                  {sslCert.sanDomains.map((d: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-background-tertiary rounded text-small font-mono">{d}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="default" size="small" onClick={handleRenew} loading={renewCert.isPending} icon={<Icon name="icon-refresh" size={15} />}>
                Renew
              </Button>
              <div className="relative">
                <Button variant="ghost" size="small" onClick={() => setShowDownloadMenu(!showDownloadMenu)} icon={<Icon name="icon-download" size={15} />}>
                  Download
                </Button>
                {showDownloadMenu && (
                  <div className="absolute right-0 mt-1 w-36 bg-background-secondary border border-border-tertiary rounded-lg shadow-lg z-10">
                    <button onClick={() => handleDownloadCert('cert')} className="w-full px-3 py-2 text-left text-small hover:bg-background-tertiary rounded-t-lg">Certificate (.pem)</button>
                    <button onClick={() => handleDownloadCert('key')} className="w-full px-3 py-2 text-left text-small hover:bg-background-tertiary">Private Key</button>
                    <button onClick={() => handleDownloadCert('chain')} className="w-full px-3 py-2 text-left text-small hover:bg-background-tertiary rounded-b-lg">Full Chain</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-small text-foreground-secondary">Enter your email to receive renewal notifications, then click Issue Certificate.</p>
            <Input label="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" type="email" />
            <Button onClick={handleIssue} loading={issueCert.isPending} disabled={!email}>Issue Certificate</Button>
          </div>
        )}
      </Card>

      <Card title="Certificate Settings">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-small font-medium">Auto-renewal</div>
              <div className="text-meta text-foreground-tertiary">Automatically renew before expiration</div>
            </div>
            <button
              onClick={handleToggleAutoRenew}
              disabled={toggleAutoRenew.isPending}
              className={`relative w-11 h-6 rounded-full transition-colors ${domain.sslAutoRenew ? 'bg-foreground-success' : 'bg-background-tertiary'} ${toggleAutoRenew.isPending ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${domain.sslAutoRenew ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MailTab({ domainId }: { domainId: string }) {
  const { data: mailboxes } = useMailboxes(domainId);
  const { data: mailAliases } = useMailForwardAliases(domainId);
  const { data: dkimStatus } = useDkimStatus(domainId);

  return (
    <div className="space-y-4">
      <Card title="Mailboxes">
        {mailboxes && mailboxes.length > 0 ? (
          <DataTable
            columns={[
              { key: 'username', label: 'Username', render: (m: any) => <span className="font-mono">{m.username}</span> },
              { key: 'quotaMb', label: 'Quota (MB)' },
              { key: 'isActive', label: 'Status', render: (m: any) => <StatusBadge status={m.isActive ? 'active' : 'inactive'} /> },
            ]}
            data={mailboxes}
            rowKey={(m: any) => m.id}
          />
        ) : (
          <EmptyState icon="icon-mail" title="No mailboxes" description="No mailboxes configured for this domain" />
        )}
      </Card>
      <Card title="Email Aliases / Forwards">
        {mailAliases && mailAliases.length > 0 ? (
          <DataTable
            columns={[
              { key: 'alias', label: 'Alias', render: (a: any) => <span className="font-mono">{a.alias || a.source}</span> },
              { key: 'destination', label: 'Forwards To', render: (a: any) => <span className="font-mono text-foreground-secondary">{a.destination}</span> },
            ]}
            data={mailAliases}
            rowKey={(a: any) => a.id}
          />
        ) : (
          <EmptyState icon="icon-arrows-right" title="No forwards" description="No email forwards configured" />
        )}
      </Card>
      <Card title="DKIM Status">
        {dkimStatus ? (
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">DKIM Enabled</span>
              <span>{dkimStatus.enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Has Public Key</span>
              <span>{dkimStatus.hasPublicKey ? 'Yes' : 'No'}</span>
            </div>
            {dkimStatus.dnsRecord && (
              <div className="flex justify-between">
                <span className="text-foreground-secondary">DNS Record</span>
                <span className="font-mono text-small">{dkimStatus.dnsRecord}</span>
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon="icon-shield" title="No DKIM configured" description="Mail authentication not yet configured" />
        )}
      </Card>
    </div>
  );
}

function CloudflareTab({ domainId }: { domainId: string }) {
  const { data: cloudflareZone } = useDomainCloudflareZone(domainId);
  const { data: cloudflareDns } = useDomainCloudflareDns(domainId);
  const { data: cloudflareSsl } = useDomainCloudflareSsl(domainId);
  const { data: cloudflareFirewall } = useDomainCloudflareFirewall(domainId);

  return (
    <div className="space-y-4">
      <Card title="Cloudflare Zone">
        {cloudflareZone ? (
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Zone</span>
              <span>{cloudflareZone.zoneName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Paused</span>
              <span>{cloudflareZone.isPaused ? 'Yes' : 'No'}</span>
            </div>
          </div>
        ) : (
          <EmptyState icon="icon-cloud" title="No Cloudflare zone" description="Cloudflare is not connected to this domain" />
        )}
      </Card>
      {cloudflareDns?.records && cloudflareDns.records.length > 0 && (
        <Card title="Cloudflare DNS">
          <DataTable
            columns={[
              { key: 'type', label: 'Type', render: (r: any) => <span className="font-mono">{r.type}</span> },
              { key: 'name', label: 'Name', render: (r: any) => <span className="font-mono">{r.name}</span> },
              { key: 'content', label: 'Content', render: (r: any) => <span className="font-mono text-foreground-secondary">{r.content}</span> },
            ]}
            data={cloudflareDns.records}
            rowKey={(r: any) => r.id}
          />
        </Card>
      )}
      {cloudflareSsl && (
        <Card title="Cloudflare SSL">
          <div className="space-y-2 text-small">
            <div className="flex justify-between"><span className="text-foreground-secondary">SSL Mode</span><span>{cloudflareSsl.sslMode || '—'}</span></div>
            <div className="flex justify-between"><span className="text-foreground-secondary">HTTP2</span><span>{cloudflareSsl.http2 ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-foreground-secondary">HTTP3</span><span>{cloudflareSsl.http3 ? 'Yes' : 'No'}</span></div>
          </div>
        </Card>
      )}
      {cloudflareFirewall && cloudflareFirewall.length > 0 && (
        <Card title="Cloudflare Firewall">
          <DataTable
            columns={[
              { key: 'description', label: 'Description', render: (r: any) => <span>{r.description}</span> },
              { key: 'action', label: 'Action', render: (r: any) => <StatusBadge status={r.action === 'allow' ? 'active' : 'inactive'} /> },
            ]}
            data={cloudflareFirewall}
            rowKey={(r: any) => r.id}
          />
        </Card>
      )}
    </div>
  );
}

function LogsTab({ domainId }: { domainId: string }) {
  const { data: accessLog } = useDomainAccessLog(domainId);
  const { data: errorLog } = useDomainErrorLog(domainId);

  return (
    <div className="space-y-4">
      <Card title="Access Log">
        {accessLog ? (
          <pre className="text-meta font-mono text-small whitespace-pre-wrap">{accessLog}</pre>
        ) : (
          <EmptyState icon="icon-document" title="No access log" description="Access log not available" />
        )}
      </Card>
      <Card title="Error Log">
        {errorLog ? (
          <pre className="text-meta font-mono text-small whitespace-pre-wrap">{errorLog}</pre>
        ) : (
          <EmptyState icon="icon-alert" title="No error log" description="Error log not available" />
        )}
      </Card>
    </div>
  );
}