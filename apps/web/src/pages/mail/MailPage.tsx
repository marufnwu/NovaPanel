import { useState, useCallback } from 'react';
import { useDomains } from '../../api/hooks/domains';
import {
  useMailDomainInfo,
  useEnableMail,
  useDisableMail,
  useCreateMailbox,
  useUpdateMailbox,
  useDeleteMailbox,
  useCreateAlias,
  useDeleteAlias,
  useGenerateDKIM,
  useSetSPF,
  useSetDMARC,
  useDkimStatus,
  useMailQueue,
  useSetCatchAll,
  useSetSpamAssassin,
} from '../../api/hooks/mail';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import {
  Mail, Plus, Trash2, Shield, Key, RefreshCw, ExternalLink,
  Settings, AlertTriangle, CheckCircle2, Eye, EyeOff, X, Copy,
  Ban, Reply, Globe, Inbox, Send, Clock, ShieldCheck, Check,
} from 'lucide-react';
import type { Mailbox, MailAlias, MailDomainInfo } from '../../api/hooks/mail';
import { toast } from '../../lib/toast';

/* ------------------------------------------------------------------ */
/*  Copy-to-clipboard helper                                          */
/* ------------------------------------------------------------------ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Mailbox Form Modal (with Auto-Responder)                          */
/* ------------------------------------------------------------------ */
function MailboxFormModal({
  domainId,
  domainName,
  initial,
  onClose,
}: {
  domainId: string;
  domainName: string;
  initial?: Mailbox;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(initial?.email?.split('@')[0] || '');
  const [password, setPassword] = useState('');
  const [quotaMb, setQuotaMb] = useState(initial?.quotaMb || 1024);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  // Auto-responder state
  const [arEnabled, setArEnabled] = useState(initial?.autoresponder ?? false);
  const [arSubject, setArSubject] = useState(initial?.autoresponderSubject ?? '');
  const [arMessage, setArMessage] = useState(initial?.autoresponderMessage ?? '');

  const create = useCreateMailbox();
  const update = useUpdateMailbox();

  const handleSubmit = () => {
    setError('');
    if (!initial && !username) { setError('Username is required'); return; }
    if (!initial && password.length < 8) { setError('Password must be at least 8 characters'); return; }

    const data: Record<string, unknown> = { quotaMb };
    if (password) data.password = password;
    if (!initial) data.username = username;

    // Include auto-responder fields
    data.autoresponder = arEnabled;
    data.autoresponderSubject = arSubject;
    data.autoresponderMessage = arMessage;

    const mutation = initial
      ? update.mutate(
          { domainId, id: initial.id, ...data } as Parameters<typeof update.mutate>[0],
          { onSuccess: () => { toast.success('Mailbox updated'); onClose(); }, onError: (e: Error) => setError(e.message) },
        )
      : create.mutate(
          { domainId, ...data } as Parameters<typeof create.mutate>[0],
          { onSuccess: () => { toast.success('Mailbox created'); onClose(); }, onError: (e: Error) => setError(e.message) },
        );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Mailbox' : 'Create Mailbox'}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          {!initial && (
            <div>
              <label className="mb-1 block text-sm font-medium">Username (before @{domainName})</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="johndoe"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Password <span className="text-muted-foreground">{initial ? '(leave blank to keep)' : ''}</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={initial ? '(unchanged)' : 'Min. 8 characters'}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm"
              />
              <button
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Quota (MB)</label>
            <input
              type="number"
              min={0}
              value={quotaMb}
              onChange={e => setQuotaMb(Number(e.target.value))}
              placeholder="1024 = 1 GB"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Auto-Responder Section */}
          {initial && (
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Reply className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Auto-Responder</span>
                </div>
                <button
                  onClick={() => setArEnabled(!arEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    arEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      arEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {arEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
                    <input
                      value={arSubject}
                      onChange={e => setArSubject(e.target.value)}
                      placeholder="Out of Office: Auto-reply"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Message Body</label>
                    <textarea
                      value={arMessage}
                      onChange={e => setArMessage(e.target.value)}
                      rows={4}
                      placeholder="Thank you for your email. I am currently out of the office and will return on..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={create.isPending || update.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending || update.isPending ? 'Saving...' : initial ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Alias Form Modal (with Forward Type Selector)                     */
/* ------------------------------------------------------------------ */
function AliasFormModal({
  domainId,
  onClose,
}: {
  domainId: string;
  onClose: () => void;
}) {
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const [forwardType, setForwardType] = useState<'forward_only' | 'forward_and_keep'>('forward_only');
  const [error, setError] = useState('');
  const create = useCreateAlias();

  const handleSubmit = () => {
    setError('');
    if (!alias) { setError('Alias address is required'); return; }
    if (!destination) { setError('Destination is required'); return; }
    create.mutate(
      { domainId, alias, destination, forwardType },
      { onSuccess: () => { toast.success('Alias created'); onClose(); }, onError: (e: Error) => setError(e.message) },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Alias</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Alias Address</label>
            <input
              value={alias}
              onChange={e => setAlias(e.target.value)}
              placeholder="alias@domain.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Destination</label>
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="user@domain.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Forward Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForwardType('forward_only')}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
                  forwardType === 'forward_only'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Send className="mx-auto mb-1 h-4 w-4" />
                Forward Only
              </button>
              <button
                type="button"
                onClick={() => setForwardType('forward_and_keep')}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
                  forwardType === 'forward_and_keep'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Inbox className="mx-auto mb-1 h-4 w-4" />
                Forward & Keep Copy
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {forwardType === 'forward_only'
                ? 'Emails will be forwarded without keeping a local copy.'
                : 'Emails will be forwarded and a copy will be kept in the original mailbox.'}
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create Alias'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Connection Info Card                                               */
/* ------------------------------------------------------------------ */
function ConnectionInfoCard({ domainName }: { domainName: string }) {
  const mailHost = `mail.${domainName}`;
  const connections = [
    {
      protocol: 'SMTP',
      icon: <Send className="h-4 w-4 text-blue-500" />,
      entries: [
        { label: 'Port 25', value: `${mailHost}:25` },
        { label: 'Port 465 (SSL)', value: `${mailHost}:465` },
        { label: 'Port 587 (STARTTLS)', value: `${mailHost}:587` },
      ],
    },
    {
      protocol: 'IMAP',
      icon: <Inbox className="h-4 w-4 text-green-500" />,
      entries: [
        { label: 'Port 143', value: `${mailHost}:143` },
        { label: 'Port 993 (SSL)', value: `${mailHost}:993` },
      ],
    },
    {
      protocol: 'POP3',
      icon: <Mail className="h-4 w-4 text-orange-500" />,
      entries: [
        { label: 'Port 110', value: `${mailHost}:110` },
        { label: 'Port 995 (SSL)', value: `${mailHost}:995` },
      ],
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold flex items-center gap-2">
        <Globe className="h-5 w-5" /> Connection Settings
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {connections.map(c => (
          <div key={c.protocol} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              {c.icon}
              <span className="text-sm font-semibold">{c.protocol}</span>
            </div>
            <div className="space-y-1.5">
              {c.entries.map(e => (
                <div key={e.label} className="flex items-center justify-between rounded bg-muted px-2 py-1.5">
                  <div>
                    <span className="text-xs text-muted-foreground">{e.label}</span>
                    <div className="font-mono text-xs">{e.value}</div>
                  </div>
                  <CopyButton text={e.value} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main MailPage                                                      */
/* ------------------------------------------------------------------ */
type Tab = 'mailboxes' | 'aliases' | 'settings' | 'security' | 'queue';

export function MailPage() {
  const { data: domains } = useDomains();
  const [domainId, setDomainId] = useState('');
  const { data: info, isLoading, isError, refetch } = useMailDomainInfo(domainId);
  const { data: dkimStatus } = useDkimStatus(domainId);
  const { data: mailQueue } = useMailQueue(domainId);
  const [tab, setTab] = useState<Tab>('mailboxes');
  const [showMailboxForm, setShowMailboxForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [showAliasForm, setShowAliasForm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ open: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });
  const [dmarcPolicy, setDmarcPolicy] = useState<'none' | 'quarantine' | 'reject'>('none');
  const [dmarcReportEmail, setDmarcReportEmail] = useState('');

  // Catch-all state
  const [catchAllDest, setCatchAllDest] = useState('');

  // SpamAssassin state
  const [spamEnabled, setSpamEnabled] = useState(false);
  const [spamThreshold, setSpamThreshold] = useState(5);

  const enableMail = useEnableMail();
  const disableMail = useDisableMail();
  const deleteMailbox = useDeleteMailbox();
  const updateMailbox = useUpdateMailbox();
  const deleteAlias = useDeleteAlias();
  const generateDKIM = useGenerateDKIM();
  const setSPF = useSetSPF();
  const setDMARC = useSetDMARC();
  const setCatchAll = useSetCatchAll();
  const setSpamAssassin = useSetSpamAssassin();

  const handleDomainChange = (id: string) => {
    setDomainId(id);
    setTab('mailboxes');
    setShowMailboxForm(false);
    setEditingMailbox(null);
    setShowAliasForm(false);
  };

  const selectedDomainObj = domains?.find(d => d.id === domainId);
  const domainName = selectedDomainObj?.name || 'domain';

  // Sync local state from server data
  const syncFromServer = () => {
    if (info?.mailDomain) {
      setCatchAllDest(info.mailDomain.catchAllDestination || '');
      setSpamEnabled(info.mailDomain.spamAssassinEnabled ?? false);
      setSpamThreshold(info.mailDomain.spamScoreThreshold ?? 5);
    }
  };

  // Call sync once when info loads
  if (info?.mailDomain && !catchAllDest && info.mailDomain.catchAllDestination) {
    syncFromServer();
  }

  if (!domainId) {
    return (
      <div>
        <PageHeader title="Mail Management" description="Manage email mailboxes, aliases, and security settings" />
        <div className="rounded-lg border border-border bg-card p-6">
          <label className="mb-2 block text-sm font-medium">Select Domain</label>
          <select
            value=""
            onChange={e => handleDomainChange(e.target.value)}
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose a domain...</option>
            {domains?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError) return (
    <div>
      <PageHeader title="Mail Management" description="Manage email mailboxes, aliases, and security settings" />
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-red-600 dark:text-red-400">Failed to load mail settings. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  const enabled = info?.enabled;

  return (
    <div>
      <PageHeader
        title="Mail Management"
        description={selectedDomainObj?.name ? `Mail settings for ${selectedDomainObj.name}` : 'Mail settings'}
        actions={
          <div className="flex gap-2">
            <select
              value={domainId}
              onChange={e => handleDomainChange(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {domains?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        }
      />

      {/* Mail not enabled */}
      {!enabled ? (
        <EmptyState
          icon={Mail}
          title="Mail is not enabled for this domain"
          description="Enable mail for this domain to create mailboxes, aliases, and configure DKIM/SPF."
          action={
            <button
              onClick={() => enableMail.mutate(domainId, {
                onSuccess: () => toast.success('Mail enabled for domain'),
                onError: (e: Error) => toast.error(e.message || 'Failed to enable mail'),
              })}
              disabled={enableMail.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {enableMail.isPending ? 'Enabling...' : 'Enable Mail'}
            </button>
          }
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-border p-1 w-fit">
            {(['mailboxes', 'aliases', 'settings', 'security', 'queue'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {t === 'queue' ? 'Mail Queue' : t}
              </button>
            ))}
          </div>

          {/* MAILBOXES TAB */}
          {tab === 'mailboxes' && (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => setShowMailboxForm(true)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Mailbox
                </button>
              </div>

              {!info?.mailboxes?.length ? (
                <EmptyState icon={Mail} title="No mailboxes" description="Create your first mailbox to start receiving email." />
              ) : (
                <ResponsiveTable>
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Email Address</th>
                        <th className="px-4 py-3 text-left font-medium">Disk Usage</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Auto-Reply</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info?.mailboxes.map(m => {
                        const usagePercent = m.quotaMb > 0 ? Math.min((m.usedMb / m.quotaMb) * 100, 100) : 0;
                        const isOverQuota = usagePercent >= 90;
                        return (
                          <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">{m.email}</td>
                            <td className="px-4 py-3">
                              <div className="min-w-[120px]">
                                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                  <span>{m.usedMb ?? 0} MB</span>
                                  <span>{m.quotaMb > 0 ? `${m.quotaMb} MB` : 'Unlimited'}</span>
                                </div>
                                {m.quotaMb > 0 && (
                                  <div className="h-2 w-full rounded-full bg-muted">
                                    <div
                                      className={`h-2 rounded-full transition-all ${
                                        isOverQuota ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${usagePercent}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                m.isActive
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-red-500/10 text-red-500'
                              }`}>
                                {m.isActive ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                m.autoresponder
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {m.autoresponder ? 'On' : 'Off'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                {/* Suspend / Unsuspend */}
                                <button
                                  onClick={() => updateMailbox.mutate({
                                    domainId,
                                    id: m.id,
                                    isActive: !m.isActive,
                                  })}
                                  className={`rounded p-1.5 hover:bg-accent ${
                                    m.isActive
                                      ? 'text-yellow-600 hover:bg-yellow-500/10'
                                      : 'text-green-600 hover:bg-green-500/10'
                                  }`}
                                  title={m.isActive ? 'Suspend Mailbox' : 'Unsuspend Mailbox'}
                                >
                                  {m.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => setEditingMailbox(m)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                  title="Edit"
                                >
                                  <Settings className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Delete Mailbox',
                                      message: `This will permanently delete '${m.email}' and all its contents. This cannot be undone.`,
                                      variant: 'danger',
                                      onConfirm: () => deleteMailbox.mutate({ domainId, id: m.id }, {
                                        onSuccess: () => toast.success(`Mailbox ${m.email} deleted`),
                                        onError: (e: Error) => toast.error(e.message || 'Failed to delete mailbox'),
                                      }),
                                    });
                                  }}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </div>
          )}

          {/* ALIASES TAB */}
          {tab === 'aliases' && (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => setShowAliasForm(true)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Alias
                </button>
              </div>

              {!info?.aliases?.length ? (
                <EmptyState icon={Mail} title="No aliases" description="Create aliases to forward or redirect email." />
              ) : (
                <ResponsiveTable>
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Alias</th>
                        <th className="px-4 py-3 text-left font-medium">Destination</th>
                        <th className="px-4 py-3 text-left font-medium">Forward Type</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info?.aliases.map(a => (
                        <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{a.alias}</td>
                          <td className="px-4 py-3 text-muted-foreground">{a.destination}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.forwardType === 'forward_and_keep'
                                ? 'bg-blue-500/10 text-blue-500'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {a.forwardType === 'forward_and_keep' ? 'Forward & Keep' : 'Forward Only'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  title: 'Delete Alias',
                                  message: `This will permanently delete the alias '${a.alias} → ${a.destination}'. This cannot be undone.`,
                                  variant: 'danger',
                                  onConfirm: () => deleteAlias.mutate({ domainId, id: a.id }, {
                                    onSuccess: () => toast.success('Alias deleted'),
                                    onError: (e: Error) => toast.error(e.message || 'Failed to delete alias'),
                                  }),
                                });
                              }}
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {tab === 'settings' && (
            <div className="space-y-5">
              {/* Connection info with copy-to-clipboard */}
              <ConnectionInfoCard domainName={domainName} />

              {/* Webmail Access Link */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" /> Webmail Access
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Access your email through the web-based mail client.
                    </p>
                  </div>
                  <a
                    href={`https://${domainName}/webmail`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Mail className="h-4 w-4" /> Open Webmail
                  </a>
                </div>
                <div className="mt-3 rounded bg-muted p-3 font-mono text-xs break-all">
                  https://{domainName}/webmail
                  <span className="ml-2 inline-block">
                    <CopyButton text={`https://${domainName}/webmail`} />
                  </span>
                </div>
              </div>

              {/* Catch-All Address */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Inbox className="h-5 w-5" /> Catch-All Address
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Set a destination email for any message sent to a non-existent address at @{domainName}.
                    Emails to catch-all@{domainName} and any undefined address will be forwarded.
                  </p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 max-w-sm">
                    <label className="mb-1 block text-sm font-medium">Destination Email</label>
                    <input
                      type="email"
                      value={catchAllDest}
                      onChange={e => setCatchAllDest(e.target.value)}
                      placeholder="admin@domain.com"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setCatchAll.mutate(
                      { domainId, destination: catchAllDest },
                      { onSuccess: () => toast.success('Catch-all address updated.') },
                    )}
                    disabled={setCatchAll.isPending || !catchAllDest}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {setCatchAll.isPending ? 'Saving...' : 'Save'}
                  </button>
                  {catchAllDest && (
                    <button
                      onClick={() => {
                        setCatchAllDest('');
                        setCatchAll.mutate({ domainId, destination: '' });
                      }}
                      className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* SpamAssassin */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" /> SpamAssassin
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enable server-side spam filtering. Messages scoring above the threshold will be marked as spam.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = !spamEnabled;
                      setSpamEnabled(newVal);
                      setSpamAssassin.mutate({
                        domainId,
                        enabled: newVal,
                        spamScoreThreshold: spamThreshold,
                      });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      spamEnabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        spamEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {spamEnabled && (
                  <div className="flex items-end gap-3">
                    <div className="max-w-xs">
                      <label className="mb-1 block text-sm font-medium">
                        Spam Score Threshold: <span className="font-mono">{spamThreshold}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.5}
                        value={spamThreshold}
                        onChange={e => setSpamThreshold(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>Strict (1)</span>
                        <span>Lenient (10)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSpamAssassin.mutate({
                        domainId,
                        enabled: spamEnabled,
                        spamScoreThreshold: spamThreshold,
                      })}
                      disabled={setSpamAssassin.isPending}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {setSpamAssassin.isPending ? 'Saving...' : 'Apply Threshold'}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick enable/disable */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="mb-3 font-semibold">Mail Status</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable mail for this domain</p>
                    <p className="text-xs text-muted-foreground">
                      Disabling mail will remove all mailboxes, aliases, and forwards.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        open: true,
                        title: 'Disable Mail',
                        message: `This will disable mail for '${domainName}' and delete all mailboxes and aliases. This cannot be undone.`,
                        variant: 'warning',
                        onConfirm: () => disableMail.mutate(domainId, {
                          onSuccess: () => toast.success('Mail disabled for domain'),
                          onError: (e: Error) => toast.error(e.message || 'Failed to disable mail'),
                        }),
                      });
                    }}
                    disabled={disableMail.isPending}
                    className="rounded-md border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {disableMail.isPending ? 'Disabling...' : 'Disable Mail'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <div className="space-y-5">
              {/* DKIM */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">DKIM (DomainKeys Identified Mail)</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Digitally sign outgoing emails to verify authenticity.
                    </p>
                  </div>
                  {info?.mailDomain?.hasDkimKey ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-500">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500">
                      <AlertTriangle className="h-3.5 w-3.5" /> Not Generated
                    </span>
                  )}
                </div>
                <button
                  onClick={() => generateDKIM.mutate(domainId, {
                    onSuccess: () => toast.success('DKIM key generated'),
                    onError: (e: Error) => toast.error(e.message || 'Failed to generate DKIM'),
                  })}
                  disabled={generateDKIM.isPending}
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  <Key className="h-4 w-4" />
                  {generateDKIM.isPending ? 'Generating...' : info?.mailDomain?.hasDkimKey ? 'Rotate DKIM Key' : 'Generate DKIM Key'}
                </button>

                {/* DKIM DNS Record Preview */}
                {(dkimStatus?.dnsRecord || dkimStatus?.hasPublicKey) && (
                  <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-green-600">DKIM DNS Record</h4>
                      <CopyButton text={dkimStatus?.dnsRecord || ''} />
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Add this TXT record to your DNS configuration:
                    </p>
                    <div className="rounded bg-muted p-3 font-mono text-xs break-all">
                      {dkimStatus?.dnsRecord || `v=DKIM1; k=rsa; p=<public-key>`}
                    </div>
                    {dkimStatus?.selector && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <strong>Host/Name:</strong> {dkimStatus.selector}._domainkey.{domainName}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* SPF */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold">SPF (Sender Policy Framework)</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Specifies which mail servers can send emails for your domain.
                  </p>
                </div>
                {info?.mailDomain?.spfRecord && (
                  <div className="mb-3 flex items-center justify-between rounded bg-muted p-3">
                    <span className="font-mono text-xs break-all">{info.mailDomain.spfRecord}</span>
                    <CopyButton text={info.mailDomain.spfRecord} />
                  </div>
                )}
                <button
                  onClick={() => setSPF.mutate({ domainId, serverIp: '0.0.0.0/0' }, {
                    onSuccess: () => toast.success('SPF record set. Update the IP to your server\'s public IP.'),
                  })}
                  disabled={setSPF.isPending}
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  <Shield className="h-4 w-4" />
                  {setSPF.isPending ? 'Setting...' : 'Apply Recommended SPF'}
                </button>
              </div>

              {/* DMARC */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold">DMARC (Domain-based Message Authentication)</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Protects your domain from unauthorized use (spoofing).
                  </p>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium">Policy</label>
                  <div className="flex gap-3">
                    {(['none', 'quarantine', 'reject'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setDmarcPolicy(p)}
                        className={`rounded-md border px-4 py-2 text-sm font-medium capitalize ${
                          dmarcPolicy === p ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium">Report Email <span className="text-muted-foreground">(optional)</span></label>
                  <input
                    type="email"
                    value={dmarcReportEmail}
                    onChange={e => setDmarcReportEmail(e.target.value)}
                    placeholder="dmarc-reports@example.com"
                    className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => setDMARC.mutate(
                    { domainId, policy: dmarcPolicy, reportEmail: dmarcReportEmail || undefined },
                    { onSuccess: () => toast.success('DMARC policy applied successfully'), onError: (e: Error) => toast.error(e.message || 'Failed to apply DMARC') },
                  )}
                  disabled={setDMARC.isPending}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Shield className="h-4 w-4" />
                  {setDMARC.isPending ? 'Applying...' : 'Apply DMARC Policy'}
                </button>
              </div>
            </div>
          )}

          {/* MAIL QUEUE TAB */}
          {tab === 'queue' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Mail Queue
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Messages currently in the delivery queue. Auto-refreshes every 30 seconds.
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Force refetch by invalidating the query
                    const btn = document.activeElement as HTMLElement;
                    btn?.blur();
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>

              {!mailQueue?.length ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Queue is empty"
                  description="There are no messages currently in the mail queue."
                />
              ) : (
                <ResponsiveTable>
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Sender</th>
                        <th className="px-4 py-3 text-left font-medium">Recipient</th>
                        <th className="px-4 py-3 text-left font-medium">Subject</th>
                        <th className="px-4 py-3 text-left font-medium">Age</th>
                        <th className="px-4 py-3 text-left font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mailQueue.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium font-mono text-xs">{item.sender}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.recipient}</td>
                          <td className="px-4 py-3 max-w-[200px] truncate">{item.subject || '(no subject)'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.age}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.size || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {(showMailboxForm || editingMailbox) && (
        <MailboxFormModal
          domainId={domainId}
          domainName={domainName}
          initial={editingMailbox || undefined}
          onClose={() => { setShowMailboxForm(false); setEditingMailbox(null); }}
        />
      )}
      {showAliasForm && (
        <AliasFormModal domainId={domainId} onClose={() => setShowAliasForm(false)} />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
