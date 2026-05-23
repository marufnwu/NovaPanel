import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { Button } from '@/components/ui/button';
import {
  useTokens,
  useCreateToken,
  useRevokeToken,
  useTokenUsage,
  type ApiToken,
  type CreatedApiToken,
} from '../../api/hooks/tokens';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  Download,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  { id: 'domains', label: 'Domains' },
  { id: 'databases', label: 'Databases' },
  { id: 'files', label: 'Files' },
  { id: 'ssl', label: 'SSL' },
  { id: 'backups', label: 'Backups' },
  { id: 'dns', label: 'DNS' },
  { id: 'mail', label: 'Mail' },
  { id: 'ftp', label: 'FTP' },
  { id: 'settings', label: 'Settings' },
];

const EXPIRY_OPTIONS = [
  { value: '30d' as const, label: '30 Days' },
  { value: '90d' as const, label: '90 Days' },
  { value: '1y' as const, label: '1 Year' },
  { value: 'never' as const, label: 'Never' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ─── Create Token Modal ─────────────────────────────────────────────────────

function CreateTokenModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (token: CreatedApiToken) => void;
}) {
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<'30d' | '90d' | '1y' | 'never'>('never');
  const [permissions, setPermissions] = useState<string[]>([]);
  const createToken = useCreateToken();

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const selectAll = () => setPermissions(ALL_PERMISSIONS.map((p) => p.id));
  const selectNone = () => setPermissions([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || permissions.length === 0) return;

    const result = await createToken.mutateAsync({
      name: name.trim(),
      expiresIn,
      permissions,
    });
    onCreated(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generate New API Token</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Token Name */}
          <div>
            <label className="mb-1 block text-sm font-medium">Token Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CI/CD Pipeline, Monitoring Script"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              A descriptive name to identify this token
            </p>
          </div>

          {/* Expiry */}
          <div>
            <label className="mb-1 block text-sm font-medium">Expiration</label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpiresIn(opt.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    expiresIn === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Permissions</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    permissions.includes(perm.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="rounded border-border"
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {createToken.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {createToken.error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || permissions.length === 0 || createToken.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {createToken.isPending ? 'Generating...' : 'Generate Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Token Created Modal (shows the raw token) ──────────────────────────────

function TokenCreatedModal({
  token,
  onClose,
}: {
  token: CreatedApiToken;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([token.token], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${token.name.replace(/\s+/g, '-').toLowerCase()}-api-token.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Check className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold">Token Created Successfully</h2>
        </div>

        <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
            <div className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Important:</strong> Copy this token now. You won't be able to see it again.
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">
            Token — <span className="text-muted-foreground">{token.name}</span>
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs font-mono">
              {token.token}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {copied ? (
                <><Check className="h-4 w-4 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4" /> Copy</>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
              title="Download as .txt file"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Expires:</span>{' '}
            {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
          </div>
          <div>
            <span className="text-muted-foreground">Permissions:</span>{' '}
            {token.permissions.join(', ')}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Revoke Confirmation Dialog ─────────────────────────────────────────────

function RevokeConfirmDialog({
  token,
  onConfirm,
  onCancel,
  isPending,
}: {
  token: ApiToken;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Revoke API Token</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Are you sure you want to revoke the token <strong>"{token.name}"</strong>?
          Any applications using this token will lose access immediately.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? 'Revoking...' : 'Revoke Token'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Token Usage Panel ───────────────────────────────────────────────────────

function TokenUsagePanel({ tokenId, tokenName }: { tokenId: string; tokenName: string }) {
  const { data: usage, isLoading } = useTokenUsage(tokenId);

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!usage || usage.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No usage recorded for this token yet.
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Method</th>
              <th className="px-3 py-2 text-left font-medium">Path</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {usage.slice(0, 20).map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      entry.method === 'GET'
                        ? 'bg-blue-500/10 text-blue-600'
                        : entry.method === 'POST'
                          ? 'bg-green-500/10 text-green-600'
                          : entry.method === 'PUT'
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : entry.method === 'DELETE'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {entry.method}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{entry.path}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs ${
                      entry.statusCode < 300
                        ? 'text-green-600'
                        : entry.statusCode < 400
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {entry.statusCode}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{entry.ipAddress || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatRelativeTime(entry.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {usage.length > 20 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Showing last 20 of {usage.length} entries
        </p>
      )}
    </div>
  );
}

// ─── Token Row ───────────────────────────────────────────────────────────────

function TokenRow({
  token,
  onRevoke,
}: {
  token: ApiToken;
  onRevoke: (token: ApiToken) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expired = isExpired(token.expiresAt);

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${expired ? 'text-muted-foreground' : 'text-primary'}`}>
          <Key className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{token.name}</span>
            {expired && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                Expired
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {formatRelativeTime(token.createdAt)}
            </span>
            <span>
              {token.expiresAt ? `Expires ${formatDate(token.expiresAt)}` : 'No expiry'}
            </span>
            <span>Last used {formatRelativeTime(token.lastUsedAt)}</span>
          </div>
        </div>

        {/* Permissions badges */}
        <div className="hidden items-center gap-1 lg:flex">
          {token.permissions.slice(0, 4).map((perm) => (
            <span
              key={perm}
              className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize"
            >
              {perm}
            </span>
          ))}
          {token.permissions.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{token.permissions.length - 4}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="View usage"
          >
            <Activity className="h-3.5 w-3.5" />
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onRevoke(token)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Revoke token"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded usage panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/20">
          <div className="px-4 py-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Recent API Calls — {token.name}
            </h4>
          </div>
          <TokenUsagePanel tokenId={token.id} tokenName={token.name} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ApiTokensPage() {
  const { data: tokens, isLoading } = useTokens();
  const revokeToken = useRevokeToken();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await revokeToken.mutateAsync(revokeTarget.id);
    setRevokeTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Tokens"
        description="Manage API tokens for programmatic access to the panel"
        icon={Key}
        actions={
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4 mr-1.5" />
            Generate Token
          </Button>
        }
      />

      {/* Info Banner */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium">About API Tokens</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              API tokens allow external applications to interact with the panel programmatically.
              Tokens are shown only once at creation — store them securely.
              Each token's permissions control which API endpoints it can access.
            </p>
          </div>
        </div>
      </div>

      {/* Token List */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner />
          </div>
        ) : !tokens || tokens.length === 0 ? (
          <div className="py-12 text-center">
            <Key className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-2 text-sm font-medium">No API tokens</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate a token to start using the API programmatically.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Generate Token
            </button>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="w-5" /> {/* icon space */}
                <span className="flex-1">Token</span>
                <span className="hidden lg:block">Permissions</span>
                <span>Actions</span>
              </div>
            </div>
            {/* Token rows */}
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                onRevoke={setRevokeTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      {showCreateModal && (
        <CreateTokenModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(token) => {
            setShowCreateModal(false);
            setCreatedToken(token);
          }}
        />
      )}

      {/* Token Created Modal */}
      {createdToken && (
        <TokenCreatedModal
          token={createdToken}
          onClose={() => setCreatedToken(null)}
        />
      )}

      {/* Revoke Confirmation */}
      {revokeTarget && (
        <RevokeConfirmDialog
          token={revokeTarget}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
          isPending={revokeToken.isPending}
        />
      )}
    </div>
  );
}
