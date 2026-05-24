import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import {
  useFtpAccounts,
  useFtpSettings,
  useCreateFtpAccount,
  useUpdateFtpAccount,
  useChangeFtpPassword,
  useDeleteFtpAccount,
  useUpdateFtpSettings,
} from '../../api/hooks/ftp';
import { useDomains } from '../../api/hooks/domains';
import { toast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/icons';
import type { FtpAccount } from '../../api/hooks/ftp';

interface FtpPageProps {
  domainId?: string;
  hideDomainSelector?: boolean;
}

export function FtpPage({ domainId, hideDomainSelector = false }: FtpPageProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>(domainId || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<FtpAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FtpAccount | null>(null);

  const { data: domains, isLoading: domainsLoading } = useDomains();
  const effectiveDomainId = domainId || selectedDomainId;
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
    error: accountsErr,
    refetch: refetchAccounts,
  } = useFtpAccounts(effectiveDomainId);
  const { data: settings, isLoading: settingsLoading } = useFtpSettings();

  const createMutation = useCreateFtpAccount();
  const deleteMutation = useDeleteFtpAccount();
  const passwordMutation = useChangeFtpPassword();
  const settingsMutation = useUpdateFtpSettings();

  const isLoading = domainsLoading || (!!effectiveDomainId && accountsLoading) || settingsLoading;

  if (isLoading) return <PageSkeleton />;

  const domainOptions = domains?.map((d) => ({ value: d.id, label: d.name })) || [];

  const columns = [
    {
      key: 'username',
      label: 'Username',
      render: (acc: FtpAccount) => <span className="font-medium">{acc.username}</span>,
    },
    {
      key: 'homeDir',
      label: 'Home Directory',
      render: (acc: FtpAccount) => (
        <span className="text-foreground-secondary font-mono text-small">{acc.homeDir}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (acc: FtpAccount) => <StatusBadge status={acc.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'lastLoginAt',
      label: 'Last Login',
      render: (acc: FtpAccount) =>
        acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString() : 'Never',
    },
    {
      key: 'actions',
      label: '',
      render: (acc: FtpAccount) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setShowPasswordModal(acc);
            }}
          >
            <Icon name="icon-key" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(acc);
            }}
          >
            <Icon name="icon-trash" size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title font-medium">FTP Accounts</h1>
          <p className="text-small text-foreground-secondary mt-0.5">
            Manage FTP accounts per domain
          </p>
        </div>
        <Button
          icon={<Icon name="icon-plus" size={16} />}
          onClick={() => setShowCreateModal(true)}
          disabled={!effectiveDomainId}
        >
          Create Account
        </Button>
      </div>

      {/* Domain selector */}
      {!hideDomainSelector && (
        <Card>
          <div className="flex items-center gap-4">
            <label className="text-meta font-medium whitespace-nowrap">Domain:</label>
            <select
              value={selectedDomainId}
              onChange={(e) => setSelectedDomainId(e.target.value)}
              className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
            >
              <option value="">Select a domain</option>
              {domainOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Accounts table */}
      {!effectiveDomainId ? (
        <EmptyState
          icon="icon-folder"
          title="Select a domain"
          description="Choose a domain above to view its FTP accounts"
        />
      ) : accountsError ? (
        <ErrorState
          message={accountsErr?.message}
          onRetry={refetchAccounts}
        />
      ) : (
        <DataTable
          columns={columns}
          data={accounts || []}
          rowKey={(acc) => acc.id}
          emptyState={
            <EmptyState
              icon="icon-folder"
              title="No FTP accounts"
              description="No FTP accounts found for this domain"
              action={{
                label: 'Create Account',
                onClick: () => setShowCreateModal(true),
              }}
            />
          }
        />
      )}

      {/* FTP Settings */}
      <Card title="FTP Settings">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium">Port</span>
            <span className="text-small text-foreground-secondary">{settings?.port ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium">Passive Ports</span>
            <span className="text-small text-foreground-secondary">
              {settings?.passivePortMin ?? '—'} – {settings?.passivePortMax ?? '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium">Max Connections/IP</span>
            <span className="text-small text-foreground-secondary">
              {settings?.maxConnectionsPerIp ?? '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium">Anonymous Access</span>
            <span className="text-small text-foreground-secondary">
              {settings?.anonymousEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </Card>

      {/* Create Account Modal */}
      <CreateFtpAccountModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        domainId={effectiveDomainId}
        mutation={createMutation}
      />

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          isOpen={!!showPasswordModal}
          onClose={() => setShowPasswordModal(null)}
          account={showPasswordModal}
          mutation={passwordMutation}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success('FTP account deleted');
              setDeleteTarget(null);
            },
            onError: (err) => toast.error(`Failed to delete: ${err.message}`),
          });
        }}
        title="Delete FTP Account"
        description={`Delete account "${deleteTarget?.username}"? This cannot be undone.`}
        confirmText="Delete"
        impact="medium"
      />
    </div>
  );
}

function CreateFtpAccountModal({
  isOpen,
  onClose,
  domainId,
  mutation,
}: {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  mutation: ReturnType<typeof useCreateFtpAccount>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [homeDir, setHomeDir] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { domainId, username, password, homeDir },
      {
        onSuccess: () => {
          toast.success('FTP account created');
          onClose();
          setUsername('');
          setPassword('');
          setHomeDir('');
        },
        onError: (err) => toast.error(`Failed to create account: ${err.message}`),
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create FTP Account"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
            disabled={!username || !password}
          >
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. webuser"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Strong password"
          required
        />
        <Input
          label="Home Directory"
          value={homeDir}
          onChange={(e) => setHomeDir(e.target.value)}
          placeholder="e.g. /var/www/example.com"
        />
      </form>
    </Modal>
  );
}

function ChangePasswordModal({
  isOpen,
  onClose,
  account,
  mutation,
}: {
  isOpen: boolean;
  onClose: () => void;
  account: FtpAccount;
  mutation: ReturnType<typeof useChangeFtpPassword>;
}) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { id: account.id, password },
      {
        onSuccess: () => {
          toast.success('Password updated for ' + account.username);
          onClose();
          setPassword('');
        },
        onError: (err) => toast.error(`Failed to update password: ${err.message}`),
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Change Password — ${account.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
            disabled={!password}
          >
            Update Password
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New strong password"
          required
        />
      </form>
    </Modal>
  );
}
