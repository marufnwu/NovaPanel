import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import {
  useTokens,
  useCreateToken,
  useRevokeToken,
  useTokenUsage,
} from '../../api/hooks/tokens';
import { toast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/icons';
import type { ApiToken, CreatedApiToken } from '../../api/hooks/tokens';

export function ApiTokensPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState<CreatedApiToken | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiToken | null>(null);
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null);

  const { data: tokens, isLoading, isError, error, refetch } = useTokens();
  const createMutation = useCreateToken();
  const revokeMutation = useRevokeToken();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (tok: ApiToken) => <span className="font-medium">{tok.name}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (tok: ApiToken) => new Date(tok.createdAt).toLocaleDateString(),
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (tok: ApiToken) =>
        tok.expiresAt ? new Date(tok.expiresAt).toLocaleDateString() : 'Never',
    },
    {
      key: 'lastUsedAt',
      label: 'Last Used',
      render: (tok: ApiToken) =>
        tok.lastUsedAt ? new Date(tok.lastUsedAt).toLocaleString() : 'Never',
    },
    {
      key: 'actions',
      label: '',
      render: (tok: ApiToken) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedTokenId(expandedTokenId === tok.id ? null : tok.id);
            }}
          >
            <Icon name="icon-clipboard" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(tok);
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
          <h1 className="text-page-title font-medium">API Tokens</h1>
          <p className="text-small text-foreground-secondary mt-0.5">
            Manage personal access tokens
          </p>
        </div>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          Create Token
        </Button>
      </div>

      {(!tokens || tokens.length === 0) ? (
        <EmptyState
          icon="icon-key"
          title="No API tokens"
          description="Create your first API token to authenticate programmatic access"
          action={{
            label: 'Create Token',
            onClick: () => setShowCreateModal(true),
          }}
        />
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={tokens}
            rowKey={(tok) => tok.id}
            emptyState={
              <EmptyState
                icon="icon-key"
                title="No API tokens"
                description="Create your first API token"
                action={{ label: 'Create Token', onClick: () => setShowCreateModal(true) }}
              />
            }
          />

          {/* Usage panel */}
          {expandedTokenId && (
            <TokenUsagePanel tokenId={expandedTokenId} />
          )}
        </div>
      )}

      {/* Create Token Modal */}
      <CreateTokenModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mutation={createMutation}
        onTokenCreated={(token) => {
          setShowCreateModal(false);
          setShowTokenModal(token);
        }}
      />

      {/* Token Created — show once */}
      {showTokenModal && (
        <TokenCreatedModal
          isOpen={!!showTokenModal}
          onClose={() => {
            setShowTokenModal(null);
            refetch();
          }}
          token={showTokenModal}
        />
      )}

      {/* Revoke Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          revokeMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success('Token revoked');
              setDeleteTarget(null);
            },
            onError: (err) => toast.error(`Failed to revoke token: ${err.message}`),
          });
        }}
        title="Revoke Token"
        description={`Revoke token "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Revoke"
        impact="medium"
      />
    </div>
  );
}

function CreateTokenModal({
  isOpen,
  onClose,
  mutation,
  onTokenCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  mutation: ReturnType<typeof useCreateToken>;
  onTokenCreated: (token: CreatedApiToken) => void;
}) {
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<'30d' | '90d' | '1y' | 'never'>('never');
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(
      { name: name.trim(), expiresIn, permissions: [] },
      {
        onSuccess: (data) => {
          onTokenCreated(data as CreatedApiToken);
          setName('');
          setExpiresIn('never');
        },
        onError: (err) => toast.error(`Failed to create token: ${err.message}`),
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create API Token"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create Token
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Token Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Production API Key"
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-meta font-medium">Expires In</label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
          >
            <option value="never">Never</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

function TokenCreatedModal({
  isOpen,
  onClose,
  token,
}: {
  isOpen: boolean;
  onClose: () => void;
  token: CreatedApiToken;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Token Created"
      size="medium"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-small text-foreground-secondary">
          Copy this token now. It will not be shown again.
        </p>
        <div className="flex items-center gap-2 p-3 rounded-md border border-border-tertiary bg-background-tertiary">
          <code className="flex-1 text-small font-mono break-all">{token.token}</code>
          <Button
            variant="ghost"
            size="small"
            onClick={handleCopy}
          >
            <Icon name={copied ? 'icon-check' : 'icon-copy'} size={14} />
          </Button>
        </div>
        <p className="text-meta text-foreground-warning">
          This is the only time you can see this token. Store it securely.
        </p>
      </div>
    </Modal>
  );
}

function TokenUsagePanel({ tokenId }: { tokenId: string }) {
  const { data: usage, isLoading } = useTokenUsage(tokenId);

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl border border-border-tertiary">
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    );
  }

  const entries = usage || [];

  return (
    <div className="p-4 rounded-xl border border-border-tertiary space-y-3">
      <h4 className="text-meta font-medium">Recent API Usage</h4>
      {entries.length === 0 ? (
        <p className="text-small text-foreground-secondary">No recent usage recorded</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-tertiary">
              <th className="text-left text-meta text-foreground-tertiary">Time</th>
              <th className="text-left text-meta text-foreground-tertiary">Method</th>
              <th className="text-left text-meta text-foreground-tertiary">Path</th>
              <th className="text-left text-meta text-foreground-tertiary">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border-tertiary last:border-0">
                <td className="py-2 text-small text-foreground-secondary">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="py-2 text-small">
                  <span className="font-mono">{entry.method}</span>
                </td>
                <td className="py-2 text-small font-mono">{entry.path}</td>
                <td className="py-2 text-small">{entry.statusCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}