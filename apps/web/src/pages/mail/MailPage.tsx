import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useMailDomainInfo,
  useMailboxes,
  useMailAliases,
  useDkimStatus,
  useCreateMailbox,
  useDeleteMailbox,
  useCreateAlias,
  useDeleteAlias,
  useGenerateDKIM,
  type Mailbox,
  type MailAlias,
  type DkimStatus,
} from '../../api/hooks/mail';
import { useDomains } from '../../api/hooks/domains';
import { Icon } from '../../components/icons';
import { cn } from '../../lib/utils';

const TABS = [
  { id: 'mailboxes', label: 'Mailboxes' },
  { id: 'aliases', label: 'Aliases' },
  { id: 'dkim', label: 'DKIM / SPF / DMARC' },
];

export function MailPage() {
  const queryClient = useQueryClient();
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('mailboxes');

  const [showCreateMailbox, setShowCreateMailbox] = useState(false);
  const [showCreateAlias, setShowCreateAlias] = useState(false);
  const [deleteMailboxId, setDeleteMailboxId] = useState<string | null>(null);
  const [deleteAliasId, setDeleteAliasId] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newQuotaMb, setNewQuotaMb] = useState('512');

  const [newAlias, setNewAlias] = useState('');
  const [newDestination, setNewDestination] = useState('');

  const { data: domains } = useDomains('');
  const { data: domainInfo, isLoading: infoLoading } = useMailDomainInfo(selectedDomainId);
  const { data: mailboxes, isLoading: mailboxesLoading } = useMailboxes(selectedDomainId);
  const { data: aliases, isLoading: aliasesLoading } = useMailAliases(selectedDomainId);
  const { data: dkimStatus, isLoading: dkimLoading } = useDkimStatus(selectedDomainId);

  const createMailbox = useCreateMailbox();
  const deleteMailbox = useDeleteMailbox();
  const createAlias = useCreateAlias();
  const deleteAlias = useDeleteAlias();
  const generateDkim = useGenerateDKIM();

  const handleCreateMailbox = async () => {
    try {
      await createMailbox.mutateAsync({
        domainId: selectedDomainId,
        username: newUsername,
        password: newPassword,
        quotaMb: parseInt(newQuotaMb) || 512,
      });
      setShowCreateMailbox(false);
      setNewUsername('');
      setNewPassword('');
      setNewQuotaMb('512');
      queryClient.invalidateQueries({ queryKey: ['mail'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMailbox = async () => {
    if (!deleteMailboxId) return;
    try {
      await deleteMailbox.mutateAsync({ domainId: selectedDomainId, id: deleteMailboxId });
      setDeleteMailboxId(null);
      queryClient.invalidateQueries({ queryKey: ['mail'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAlias = async () => {
    try {
      await createAlias.mutateAsync({
        domainId: selectedDomainId,
        alias: newAlias,
        destination: newDestination,
      });
      setShowCreateAlias(false);
      setNewAlias('');
      setNewDestination('');
      queryClient.invalidateQueries({ queryKey: ['mail'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAlias = async () => {
    if (!deleteAliasId) return;
    try {
      await deleteAlias.mutateAsync({ domainId: selectedDomainId, id: deleteAliasId });
      setDeleteAliasId(null);
      queryClient.invalidateQueries({ queryKey: ['mail'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateDkim = async () => {
    try {
      await generateDkim.mutateAsync(selectedDomainId);
      queryClient.invalidateQueries({ queryKey: ['mail'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTabChange = (tabId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url.toString());
    setActiveTab(tabId);
  };

  const domainOptions = domains?.map((d) => ({ value: d.id, label: d.name })) || [];

  if (!selectedDomainId && domainOptions.length > 0) {
    setSelectedDomainId(domainOptions[0].value);
  }

  const isLoading = infoLoading || (selectedDomainId && (mailboxesLoading || aliasesLoading || dkimLoading));

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Mail</h1>
      </div>

      <div className="max-w-[300px]">
        <label className="text-meta font-medium mb-1 block">Domain</label>
        <select
          value={selectedDomainId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDomainId(e.target.value)}
          className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary w-full"
        >
          {domainOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {selectedDomainId && (
        <>
          <div className="border-b border-border-tertiary">
            <nav className="flex gap-1">
              {TABS.map((tab) => (
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

          {activeTab === 'mailboxes' && (
            <Card
              action={
                <Button size="small" onClick={() => setShowCreateMailbox(true)} icon={<Icon name="icon-plus" size={15} />}>
                  Add Mailbox
                </Button>
              }
            >
              {mailboxes && mailboxes.length > 0 ? (
                <DataTable
                  columns={[
                    {
                      key: 'email',
                      label: 'Email',
                      render: (m: Mailbox) => <span className="font-mono font-medium">{m.email}</span>,
                    },
                    {
                      key: 'quota',
                      label: 'Quota',
                      render: (m: Mailbox) => (
                        <span className="text-foreground-secondary">
                          {m.usedMb} / {m.quotaMb} MB
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (m: Mailbox) => (
                        <div className="flex gap-2">
                          <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
                          {m.isSuspended && <StatusBadge status="inactive" />}
                        </div>
                      ),
                    },
                    {
                      key: 'autoresponder',
                      label: 'Autoresponder',
                      render: (m: Mailbox) => (
                        <StatusBadge status={m.autoresponder ? 'active' : 'inactive'} />
                      ),
                    },
                    {
                      key: 'actions',
                      label: '',
                      render: (m: Mailbox) => (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteMailboxId(m.id);
                          }}
                          icon={<Icon name="icon-trash" size={15} />}
                        >
                          Delete
                        </Button>
                      ),
                    },
                  ]}
                  data={mailboxes}
                  rowKey={(m) => m.id}
                />
              ) : (
                <EmptyState
                  icon="icon-mail"
                  title="No mailboxes"
                  description="Create your first mailbox to get started"
                  action={{ label: 'Add Mailbox', onClick: () => setShowCreateMailbox(true) }}
                />
              )}
            </Card>
          )}

          {activeTab === 'aliases' && (
            <Card
              action={
                <Button size="small" onClick={() => setShowCreateAlias(true)} icon={<Icon name="icon-plus" size={15} />}>
                  Add Alias
                </Button>
              }
            >
              {aliases && aliases.length > 0 ? (
                <DataTable
                  columns={[
                    {
                      key: 'alias',
                      label: 'Alias',
                      render: (a: MailAlias) => <span className="font-mono font-medium">{a.alias}</span>,
                    },
                    {
                      key: 'destination',
                      label: 'Destination',
                      render: (a: MailAlias) => (
                        <span className="font-mono text-foreground-secondary">{a.destination}</span>
                      ),
                    },
                    {
                      key: 'type',
                      label: 'Type',
                      render: (a: MailAlias) => (
                        <span className="text-foreground-secondary">
                          {a.forwardType === 'forward_and_keep' ? 'Forward & Keep' : 'Forward Only'}
                        </span>
                      ),
                    },
                    {
                      key: 'actions',
                      label: '',
                      render: (a: MailAlias) => (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteAliasId(a.id);
                          }}
                          icon={<Icon name="icon-trash" size={15} />}
                        >
                          Delete
                        </Button>
                      ),
                    },
                  ]}
                  data={aliases}
                  rowKey={(a) => a.id}
                />
              ) : (
                <EmptyState
                  icon="icon-mail"
                  title="No aliases"
                  description="Create your first alias to get started"
                  action={{ label: 'Add Alias', onClick: () => setShowCreateAlias(true) }}
                />
              )}
            </Card>
          )}

          {activeTab === 'dkim' && (
            <div className="space-y-4">
              <Card title="DKIM">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={dkimStatus?.hasPublicKey ? 'active' : 'inactive'} />
                      <span className="text-small">DKIM Key</span>
                    </div>
                    {!dkimStatus?.hasPublicKey && (
                      <Button size="small" onClick={handleGenerateDkim} loading={generateDkim.isPending}>
                        Generate DKIM
                      </Button>
                    )}
                  </div>
                  {dkimStatus?.dnsRecord && (
                    <div className="space-y-1">
                      <span className="text-small text-foreground-secondary">DNS Record</span>
                      <pre className="bg-background-secondary p-2 rounded text-meta font-mono break-all">
                        {dkimStatus.dnsRecord}
                      </pre>
                    </div>
                  )}
                  {dkimStatus?.selector && (
                    <div className="flex justify-between text-small">
                      <span className="text-foreground-secondary">Selector</span>
                      <span className="font-mono">{dkimStatus.selector}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card title="SPF">
                <div className="space-y-2">
                  {domainInfo?.mailDomain?.spfRecord ? (
                    <div className="space-y-1">
                      <span className="text-small text-foreground-secondary">SPF Record</span>
                      <pre className="bg-background-secondary p-2 rounded text-meta font-mono break-all">
                        {domainInfo.mailDomain.spfRecord}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-small text-foreground-tertiary">No SPF record configured</p>
                  )}
                </div>
              </Card>

              <Card title="DMARC">
                <div className="space-y-2">
                  {domainInfo?.mailDomain?.dmarcPolicy ? (
                    <div className="space-y-1">
                      <span className="text-small text-foreground-secondary">DMARC Policy</span>
                      <pre className="bg-background-secondary p-2 rounded text-meta font-mono break-all">
                        {domainInfo.mailDomain.dmarcPolicy}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-small text-foreground-tertiary">No DMARC policy configured</p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={showCreateMailbox}
        onClose={() => setShowCreateMailbox(false)}
        title="Add Mailbox"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateMailbox(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateMailbox} loading={createMailbox.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="user"
          />
          <Input
            label="Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="********"
          />
          <Input
            label="Quota (MB)"
            type="number"
            value={newQuotaMb}
            onChange={(e) => setNewQuotaMb(e.target.value)}
            placeholder="512"
          />
        </div>
      </Modal>

      <Modal
        isOpen={showCreateAlias}
        onClose={() => setShowCreateAlias(false)}
        title="Add Alias"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateAlias(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateAlias} loading={createAlias.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Alias"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder="alias@example.com"
          />
          <Input
            label="Destination"
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteMailboxId}
        onClose={() => setDeleteMailboxId(null)}
        onConfirm={handleDeleteMailbox}
        title="Delete Mailbox"
        description="This action cannot be undone. All emails in this mailbox will be deleted."
        confirmText="Delete"
        impact="high"
      />

      <ConfirmDialog
        isOpen={!!deleteAliasId}
        onClose={() => setDeleteAliasId(null)}
        onConfirm={handleDeleteAlias}
        title="Delete Alias"
        description="This action cannot be undone."
        confirmText="Delete"
        impact="high"
      />
    </div>
  );
}