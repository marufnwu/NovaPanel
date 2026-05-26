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
import { useIssueLetsEncrypt, useRenewCertificate } from '../../api/hooks/ssl';
import { useMailAliases as useMailForwardAliases, useCreateAlias as useCreateMailForwardAlias, useDeleteAlias as useDeleteMailForwardAlias, useMailboxes, useCreateMailbox, useDeleteMailbox, useMailDomainInfo, useDkimStatus } from '../../api/hooks/mail';
import { FtpPage } from '../ftp/FtpPage';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function DomainDetailPage() {
  const params = useParams({ from: '/domains/$domainId' });
  const search = useSearch({ from: '/domains/$domainId' });
  const domainId = params.domainId as string;
  const activeTab = (search as any)?.tab || 'overview';

  const { data: domain, isLoading, isError, error, refetch } = useDomain(domainId);
  const { data: subdomains } = useSubdomains(domainId);
  const { data: aliases } = useDomainAliases(domainId);
  const { data: redirects } = useRedirects(domainId);

  const queryClient = useQueryClient();
  const createSubdomain = useCreateSubdomain(domainId);
  const deleteSubdomain = useDeleteSubdomain(domainId);
  const createAlias = useCreateDomainAlias(domainId);
  const deleteAlias = useDeleteDomainAlias(domainId);
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
  const [deleteSubdomainId, setDeleteSubdomainId] = useState<string | null>(null);
  const [deleteAliasId, setDeleteAliasId] = useState<string | null>(null);
  const [deleteRedirectId, setDeleteRedirectId] = useState<string | null>(null);
  const [deleteDomainId, setDeleteDomainId] = useState<string | null>(null);

  const deleteDomain = useDeleteDomainMutation();

  const { data: dnsZone } = useDnsZone(domainId);
  const issueCert = useIssueLetsEncrypt();
  const renewCert = useRenewCertificate();

  const { data: cloudflareZone } = useDomainCloudflareZone(domainId);
  const { data: cloudflareDns } = useDomainCloudflareDns(domainId);
  const { data: cloudflareSsl } = useDomainCloudflareSsl(domainId);
  const { data: cloudflareFirewall } = useDomainCloudflareFirewall(domainId);

  const { data: mailInfo } = useMailDomainInfo(domainId);
  const { data: mailboxes } = useMailboxes(domainId);
  const { data: mailAliases } = useMailForwardAliases(domainId);
  const { data: dkimStatus } = useDkimStatus(domainId);
  const createMailbox = useCreateMailbox();
  const deleteMailbox = useDeleteMailbox();
  const createMailAlias = useCreateMailForwardAlias();
  const deleteMailAlias = useDeleteMailForwardAlias();

  const { data: accessLog } = useDomainAccessLog(domainId);
  const { data: errorLog } = useDomainErrorLog(domainId);

  const { data: nameserversData, refetch: refetchNameservers } = useDomainNameservers(domainId);
  const updateNameservers = useUpdateDomainNameservers(domainId);
  const verifyNameservers = useVerifyDomainNameservers(domainId);

  const [showEditNameservers, setShowEditNameservers] = useState(false);
  const [editedNameservers, setEditedNameservers] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const openNameserverEditor = () => {
    setEditedNameservers(nameserversData?.nameservers || []);
    setShowEditNameservers(true);
    setVerifyResult(null);
  };

  const handleVerifyNameservers = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyNameservers.mutateAsync();
      setVerifyResult(result);
    } catch (err: any) {
      toast.error(`Verification failed: ${err.message}`);
    }
    setVerifying(false);
  };

  const handleSaveNameservers = async () => {
    try {
      await updateNameservers.mutateAsync(editedNameservers);
      toast.success('Nameservers updated');
      setShowEditNameservers(false);
      refetchNameservers();
    } catch (err: any) {
      toast.error(`Failed to update nameservers: ${err.message}`);
    }
  };

  const handleTabChange = (tabId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new Event('locationchange'));
  };

  const handleAddSubdomain = async () => {
    if (!newSubdomainName) return;
    createSubdomain.mutateAsync({ name: newSubdomainName }, {
      onSuccess: () => {
        toast.success('Subdomain created successfully');
        setShowAddSubdomain(false);
        setNewSubdomainName('');
        queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] });
      },
      onError: (err: any) => toast.error(`Failed to create subdomain: ${err.message}`),
    });
  };

  const handleAddAlias = async () => {
    if (!newAliasName) return;
    createAlias.mutateAsync({ alias: newAliasName }, {
      onSuccess: () => {
        toast.success('Alias created successfully');
        setShowAddAlias(false);
        setNewAliasName('');
        queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] });
      },
      onError: (err: any) => toast.error(`Failed to create alias: ${err.message}`),
    });
  };

  const handleAddRedirect = async () => {
    if (!redirectTarget) return;
    createRedirect.mutateAsync({ sourcePath: redirectSource, targetUrl: redirectTarget, type: redirectType }, {
      onSuccess: () => {
        toast.success('Redirect created successfully');
        setShowAddRedirect(false);
        setRedirectSource('');
        setRedirectTarget('');
        setRedirectType('301');
        queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] });
      },
      onError: (err: any) => toast.error(`Failed to create redirect: ${err.message}`),
    });
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
            <EmptyState icon="icon-shield" title="No SSL certificate" description="Add an SSL certificate to this domain" />
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
                    <Button variant="ghost" size="small" onClick={() => setDeleteSubdomainId(s.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
                  ),
                },
              ]}
              data={subdomains}
              rowKey={(s) => s.id}
            />
          ) : (
            <EmptyState icon="icon-world" title="No subdomains" description="Add subdomains to this domain" action={{ label: 'Add Subdomain', onClick: () => setShowAddSubdomain(true) }} />
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
                    <Button variant="ghost" size="small" onClick={() => setDeleteAliasId(a.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
                  ),
                },
              ]}
              data={aliases}
              rowKey={(a) => a.id}
            />
          ) : (
            <EmptyState icon="icon-world" title="No aliases" description="Add aliases to this domain" action={{ label: 'Add Alias', onClick: () => setShowAddAlias(true) }} />
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
                    <Button variant="ghost" size="small" onClick={() => setDeleteRedirectId(r.id)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
                  ),
                },
              ]}
              data={redirects}
              rowKey={(r) => r.id}
            />
          ) : (
            <EmptyState icon="icon-arrows-right" title="No redirects" description="Add redirects to this domain" action={{ label: 'Add Redirect', onClick: () => setShowAddRedirect(true) }} />
          )}
        </Card>
      )}

      {activeTab === 'dns' && (
        <Card title="DNS Records">
          {dnsZone?.records && dnsZone.records.length > 0 ? (
            <DataTable
              columns={[
                { key: 'type', label: 'Type', render: (r: any) => <span className="font-mono">{r.type}</span> },
                { key: 'name', label: 'Name', render: (r: any) => <span className="font-mono">{r.name}</span> },
                { key: 'value', label: 'Value', render: (r: any) => <span className="font-mono text-foreground-secondary">{r.value}</span> },
                { key: 'ttl', label: 'TTL' },
              ]}
              data={dnsZone.records}
              rowKey={(r: any) => r.id}
            />
          ) : (
            <EmptyState icon="icon-world" title="No DNS records" description="No DNS records found for this zone" />
          )}
        </Card>
      )}

      {activeTab === 'nameservers' && (
        <Card
          title="Nameservers"
          action={
            <div className="flex gap-2">
              <Button variant="default" size="small" onClick={handleVerifyNameservers} loading={verifying}>
                Verify
              </Button>
              <Button variant="primary" size="small" onClick={openNameserverEditor}>
                Edit
              </Button>
            </div>
          }
        >
          {nameserversData?.nameservers && nameserversData.nameservers.length > 0 ? (
            <div className="space-y-3">
              {verifyResult?.results ? (
                <div className="space-y-2 mb-4">
                  {verifyResult.results.map((r: DomainNameserverResult, i: number) => (
                    <div key={i} className={`p-3 rounded-lg border ${r.isResolvable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                      <div className="flex items-center gap-2">
                        {r.isResolvable ? (
                          <Icon name="icon-check-circle" size={16} className="text-green-600" />
                        ) : (
                          <Icon name="icon-x-circle" size={16} className="text-red-600" />
                        )}
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
            <EmptyState icon="icon-world" title="No nameservers set" description="Set nameservers to manage DNS delegation for this domain" />
          )}
        </Card>
      )}

      {activeTab === 'ssl' && (
        <Card title="SSL Certificate">
          {domain.sslStatus === 'active' ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Status</span>
                <StatusBadge status="active" />
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Auto Renew</span>
                <span>{domain.sslAutoRenew ? 'Enabled' : 'Disabled'}</span>
              </div>
              <Button variant="default" size="small" onClick={() => renewCert.mutate(domainId, { onSuccess: () => toast.success('Certificate renewed'), onError: (err: any) => toast.error(`Failed to renew: ${err.message}`) })} loading={renewCert.isPending}>Renew Certificate</Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-small text-foreground-secondary mb-4">No SSL certificate</p>
              <Button onClick={() => issueCert.mutate({ domainId, email: '', challengeType: 'http-01' }, { onSuccess: () => toast.success('Certificate issuance started'), onError: (err: any) => toast.error(`Failed to issue: ${err.message}`) })} loading={issueCert.isPending}>Issue Certificate</Button>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'mail' && (
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
      )}

      {activeTab === 'ftp' && (
        <FtpPage domainId={domainId} hideDomainSelector />
      )}

      {activeTab === 'cloudflare' && (
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
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">SSL Mode</span>
                  <span>{cloudflareSsl.sslMode || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Always Use HTTPS</span>
                  <span>{cloudflareSsl.alwaysUseHttps ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">HTTP2</span>
                  <span>{cloudflareSsl.http2 ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">HTTP3</span>
                  <span>{cloudflareSsl.http3 ? 'Yes' : 'No'}</span>
                </div>
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
      )}

      {activeTab === 'logs' && (
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

      <ConfirmDialog
        isOpen={!!deleteSubdomainId}
        onClose={() => setDeleteSubdomainId(null)}
        onConfirm={() => {
          if (!deleteSubdomainId) return;
          deleteSubdomain.mutate(deleteSubdomainId, {
            onSuccess: () => {
              toast.success('Subdomain deleted');
              setDeleteSubdomainId(null);
              queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'subdomains'] });
            },
            onError: (err: any) => toast.error(`Failed to delete subdomain: ${err.message}`),
          });
        }}
        title="Delete Subdomain"
        description="This subdomain will be removed from the domain."
        confirmText="Delete"
        impact="medium"
        loading={deleteSubdomain.isPending}
      />

      <ConfirmDialog
        isOpen={!!deleteAliasId}
        onClose={() => setDeleteAliasId(null)}
        onConfirm={() => {
          if (!deleteAliasId) return;
          deleteAlias.mutate(deleteAliasId, {
            onSuccess: () => {
              toast.success('Alias deleted');
              setDeleteAliasId(null);
              queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'aliases'] });
            },
            onError: (err: any) => toast.error(`Failed to delete alias: ${err.message}`),
          });
        }}
        title="Delete Alias"
        description="This alias will be removed from the domain."
        confirmText="Delete"
        impact="medium"
        loading={deleteAlias.isPending}
      />

      <ConfirmDialog
        isOpen={!!deleteRedirectId}
        onClose={() => setDeleteRedirectId(null)}
        onConfirm={() => {
          if (!deleteRedirectId) return;
          deleteRedirect.mutate(deleteRedirectId, {
            onSuccess: () => {
              toast.success('Redirect deleted');
              setDeleteRedirectId(null);
              queryClient.invalidateQueries({ queryKey: ['domains', domainId, 'redirects'] });
            },
            onError: (err: any) => toast.error(`Failed to delete redirect: ${err.message}`),
          });
        }}
        title="Delete Redirect"
        description="This redirect will be removed."
        confirmText="Delete"
        impact="medium"
        loading={deleteRedirect.isPending}
      />

      <Modal
        isOpen={showEditNameservers}
        onClose={() => setShowEditNameservers(false)}
        title="Edit Nameservers"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditNameservers(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveNameservers} loading={updateNameservers.isPending}>
              Save
            </Button>
          </>
        }
      >
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
                  {r.isResolvable ? (
                    <span>{r.hostname} → {r.resolvesTo.join(', ')}</span>
                  ) : (
                    <span>{r.hostname}: {r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button variant="default" size="small" onClick={handleVerifyNameservers} loading={verifying} disabled={editedNameservers.length === 0}>
            Verify Before Saving
          </Button>
        </div>
      </Modal>
    </div>
  );
}