import { useState, useMemo, useCallback } from 'react';
import { useDomains } from '../../api/hooks/domains';
import { useServerContext } from '../../api/hooks/settings';
import {
  useDnsZone,
  useCreateDnsRecord,
  useUpdateDnsRecord,
  useDeleteDnsRecord,
  useImportZone,
  useExportZone,
  useResetDnsZone,
  useRawZone,
  usePropagationCheck,
  useUpdateSoaRecord,
  useCloudflareConfig,
  useUpdateCloudflareConfig,
  useSyncCloudflareRecords,
} from '../../api/hooks/dns';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import {
  Network, Plus, Trash2, Upload, Download, RotateCcw, Eye, RefreshCw,
  Globe, Edit3, Save, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Cloud, RefreshCcw, Settings, Info,
} from 'lucide-react';
import type { DnsRecord, DnsZone } from '../../api/hooks/dns';

/* ------------------------------------------------------------------ */
/*  Helpers                                                          */
/* ------------------------------------------------------------------ */
const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'] as const;
type RecordType = typeof RECORD_TYPES[number];

const TYPE_ORDER: RecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'];

function groupRecords(records: DnsRecord[]) {
  const grouped: Partial<Record<RecordType, DnsRecord[]>> = {};
  for (const r of records) {
    const t = r.type as RecordType;
    if (!grouped[t]) grouped[t] = [];
    grouped[t]!.push(r);
  }
  return TYPE_ORDER.filter(t => grouped[t]?.length).map(t => ({
    type: t,
    records: grouped[t]!,
  }));
}

function isValidIPv4(ip: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(p => parseInt(p) <= 255);
}

function isValidIPv6(ip: string) {
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
}

/* ------------------------------------------------------------------ */
/*  Add/Edit Record Form                                             */
/* ------------------------------------------------------------------ */
function RecordForm({
  domainId,
  initial,
  onSubmit,
  onCancel,
}: {
  domainId: string;
  initial?: DnsRecord;
  onSubmit: (data: { type: string; name: string; value: string; ttl: number; priority?: number }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(initial?.type || 'A');
  const [name, setName] = useState(initial?.name || '');
  const [value, setValue] = useState(initial?.value || '');
  const [ttl, setTtl] = useState(initial?.ttl || 3600);
  const [priority, setPriority] = useState(initial?.priority || 10);

  const needsPriority = type === 'MX' || type === 'SRV';
  const needsHostname = ['CNAME', 'MX', 'NS', 'SRV'].includes(type);
  const needsIP = type === 'A' || type === 'AAAA';

  const validate = () => {
    if (needsIP) {
      if (type === 'A' && !isValidIPv4(value)) return 'Invalid IPv4 address';
      if (type === 'AAAA' && !isValidIPv6(value)) return 'Invalid IPv6 address';
    }
    if (needsHostname && value && !value.match(/^[\w.-]+$/)) return 'Invalid hostname format';
    if (ttl < 60) return 'TTL must be at least 60 seconds';
    if (needsPriority && (priority < 0 || priority > 65535)) return 'Priority must be 0–65535';
    return '';
  };

  const err = validate();
  const create = useCreateDnsRecord();
  const update = useUpdateDnsRecord();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = () => {
    const data = {
      type,
      name: name || '@',
      value: type === 'TXT' ? `"${value}"` : value,
      ttl,
      ...(needsPriority ? { priority } : {}),
    };
    if (initial) {
      update.mutate({ domainId, recordId: initial.id, ...data }, {
        onSuccess: () => onSubmit(data),
        onError: (e: any) => toast.error(e.message || 'Failed to update record'),
      });
    } else {
      create.mutate({ domainId, ...data }, {
        onSuccess: () => onSubmit(data),
        onError: (e: any) => toast.error(e.message || 'Failed to create record'),
      });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Edit3 className="h-4 w-4" />
        {initial ? 'Edit Record' : 'Add Record'}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as RecordType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="@ for root"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Value / Target</label>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={needsIP ? '192.0.2.1' : 'hostname or value'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {needsPriority ? (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
            <input
              type="number"
              min={0}
              max={65535}
              value={priority}
              onChange={e => setPriority(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : <div />}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">TTL</label>
          <input
            type="number"
            min={60}
            value={ttl}
            onChange={e => setTtl(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending || !!err}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? 'Saving...' : initial ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Import Zone Modal                                                */
/* ------------------------------------------------------------------ */
function ImportModal({ onClose }: { onClose: () => void }) {
  const domains = useDomains();
  const importZone = useImportZone();
  const [domainId, setDomainId] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ imported?: number; error?: string } | null>(null);

  const handleImport = () => {
    if (!domainId || !text) return;
    importZone.mutate(
      { domainId, bindFormat: text },
      {
        onSuccess: (data: any) => setResult({ imported: data.data?.imported }),
        onError: (err: any) => setResult({ error: err.message }),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Import BIND Zone</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Domain</label>
          <select
            value={domainId}
            onChange={e => setDomainId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select domain...</option>
            {domains.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">BIND Zone Text</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={12}
            placeholder="$ORIGIN example.com.&#10;$TTL 3600&#10;@ IN SOA ns1.example.com. admin@example.com. (...&#10;@ IN A 192.0.2.1&#10;www IN A 192.0.2.1"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        {result?.imported !== undefined && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            Successfully imported {result.imported} records.
          </div>
        )}
        {result?.error && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {result.error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={!domainId || !text || importZone.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importZone.isPending ? 'Importing...' : 'Import Zone'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Raw Zone Modal                                                   */
/* ------------------------------------------------------------------ */
function RawZoneModal({ domainId }: { domainId: string }) {
  const { data } = useRawZone(domainId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Raw Zone File</h3>
          <button onClick={() => window.location.reload()} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        {data?.content ? (
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-xs">{data.content}</pre>
        ) : <LoadingSpinner />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Propagation Check Modal                                          */
/* ------------------------------------------------------------------ */
function PropagationModal({ domainId, onClose, canServePublicDns, primaryIp }: {
  domainId: string;
  onClose: () => void;
  canServePublicDns: boolean;
  primaryIp: string;
}) {
  const { data: results, isLoading, refetch } = usePropagationCheck(domainId);

  // Check if any result has errors (expected for private IPs)
  const hasErrors = results?.some((r: any) => r.error || !r.aMatches);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">DNS Propagation Check</h3>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Warning for private IPs */}
        {!canServePublicDns && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div>
              <p className="text-sm text-yellow-700">
                Your DNS zone uses a private IP address ({primaryIp}). External DNS propagation cannot complete because public DNS resolvers cannot reach your server. For public DNS, use Cloudflare Tunnel with CNAME records.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : results ? (
          <>
            {/* Contextual message for expected failures */}
            {!canServePublicDns && hasErrors && (
              <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                <p className="text-sm text-yellow-700">
                  As expected — DNS records with private IPs cannot propagate to public resolvers. Consider using Cloudflare Tunnel for public access.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {results.map((r: any, i: number) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{r.resolver}</span>
                      <span className="text-xs text-muted-foreground">({r.ip})</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`flex items-center gap-1 ${r.aMatches ? 'text-green-500' : 'text-red-500'}`}>
                        {r.aMatches ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        A record
                      </span>
                      <span className={`flex items-center gap-1 ${r.mxMatches ? 'text-green-500' : 'text-yellow-500'}`}>
                        {r.mxMatches ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        MX record
                      </span>
                      {r.latencyMs > 0 && (
                        <span className="text-muted-foreground">{r.latencyMs}ms</span>
                      )}
                    </div>
                  </div>
                  {r.error ? (
                    <p className="text-xs text-destructive">{r.error}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">A records:</span>{' '}
                        {r.aRecords.length > 0 ? r.aRecords.join(', ') : '(none)'}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">MX records:</span>{' '}
                        {r.mxRecords.length > 0 ? r.mxRecords.join(', ') : '(none)'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SOA Record Editor                                                 */
/* ------------------------------------------------------------------ */
function SoaRecordEditor({ domainId, zone }: { domainId: string; zone: NonNullable<DnsZone['zone']> }) {
  const updateSoa = useUpdateSoaRecord();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    primaryNs: zone.primaryNs,
    adminEmail: zone.adminEmail,
    serial: zone.serial,
    refresh: zone.refresh,
    retry: zone.retry,
    expire: zone.expire,
    minimumTtl: zone.minimumTtl,
  });
  const [initialized, setInitialized] = useState(false);

  if (!initialized) {
    setForm({
      primaryNs: zone.primaryNs,
      adminEmail: zone.adminEmail,
      serial: zone.serial,
      refresh: zone.refresh,
      retry: zone.retry,
      expire: zone.expire,
      minimumTtl: zone.minimumTtl,
    });
    setInitialized(true);
  }

  const handleSave = () => {
    updateSoa.mutate({ domainId, ...form }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setEditing(!editing)}
        className="flex w-full items-center justify-between bg-muted/50 px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-purple-500">
            SOA
          </span>
          <span className="text-sm text-muted-foreground">Start of Authority Record</span>
        </div>
        {editing ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {editing && (
        <div className="p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Primary NS</label>
              <input
                value={form.primaryNs}
                onChange={(e) => setForm({ ...form, primaryNs: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Admin Email</label>
              <input
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Serial</label>
              <input
                type="number"
                value={form.serial}
                onChange={(e) => setForm({ ...form, serial: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Refresh (s)</label>
              <input
                type="number"
                value={form.refresh}
                onChange={(e) => setForm({ ...form, refresh: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Retry (s)</label>
              <input
                type="number"
                value={form.retry}
                onChange={(e) => setForm({ ...form, retry: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Expire (s)</label>
              <input
                type="number"
                value={form.expire}
                onChange={(e) => setForm({ ...form, expire: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Minimum TTL (s)</label>
              <input
                type="number"
                value={form.minimumTtl}
                onChange={(e) => setForm({ ...form, minimumTtl: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateSoa.isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {updateSoa.isPending ? 'Saving...' : 'Save SOA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  External DNS Mode (Cloudflare)                                    */
/* ------------------------------------------------------------------ */
function ExternalDnsSection({ domainId }: { domainId: string }) {
  const { data: cfConfig, isLoading } = useCloudflareConfig(domainId);
  const updateCf = useUpdateCloudflareConfig();
  const syncRecords = useSyncCloudflareRecords();
  const [showSettings, setShowSettings] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (cfConfig && !initialized) {
    setApiToken(cfConfig.apiToken || '');
    setZoneId(cfConfig.zoneId || '');
    setInitialized(true);
  }

  const isEnabled = cfConfig?.enabled ?? false;

  const handleToggle = () => {
    updateCf.mutate({ domainId, enabled: !isEnabled });
  };

  const handleSave = () => {
    updateCf.mutate({ domainId, apiToken, zoneId });
  };

  const handleSync = () => {
    syncRecords.mutate(domainId);
  };

  if (isLoading) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-orange-500" />
          <div>
            <span className="text-sm font-medium">External DNS (Cloudflare)</span>
            <p className="text-xs text-muted-foreground">Manage DNS via Cloudflare API</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isEnabled ? 'bg-green-500' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {isEnabled && !showSettings && (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs text-muted-foreground">
            {cfConfig?.zoneName && <span>Zone: <strong>{cfConfig.zoneName}</strong> · </span>}
            {cfConfig?.lastSyncAt && <span>Last sync: {new Date(cfConfig.lastSyncAt).toLocaleString()}</span>}
          </div>
          <button
            onClick={handleSync}
            disabled={syncRecords.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${syncRecords.isPending ? 'animate-spin' : ''}`} />
            {syncRecords.isPending ? 'Syncing...' : 'Sync Records'}
          </button>
        </div>
      )}

      {showSettings && (
        <div className="p-4 space-y-4 border-t border-border">
          <div>
            <label className="mb-1 block text-sm font-medium">Cloudflare API Token</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Enter your Cloudflare API token"
              className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Create an API token at Cloudflare Dashboard → My Profile → API Tokens
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Cloudflare Zone ID</label>
            <input
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              placeholder="Enter the Cloudflare zone ID"
              className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateCf.isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {updateCf.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={handleSync}
              disabled={syncRecords.isPending}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${syncRecords.isPending ? 'animate-spin' : ''}`} />
              {syncRecords.isPending ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main DnsPage                                                    */
/* ------------------------------------------------------------------ */
export function DnsPage() {
  const { data: domains } = useDomains();
  const { data: serverContext } = useServerContext();
  const [selectedDomain, setSelectedDomain] = useState('');
  const { data: zone, isLoading: zoneLoading, isError: zoneError, refetch: refetchZone } = useDnsZone(selectedDomain);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showPropagation, setShowPropagation] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(TYPE_ORDER));
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ open: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });

  const deleteRecord = useDeleteDnsRecord();
  const resetZone = useResetDnsZone();
  const exportZone = useExportZone(selectedDomain);

  const selectedDomainObj = domains?.find(d => d.id === selectedDomain);
  const grouped = useMemo(() => zone?.records ? groupRecords(zone.records) : [], [zone?.records]);

  const canServePublicDns = serverContext?.canServePublicDns ?? true;
  const primaryIp = serverContext?.primaryIp ?? '';

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const handleDeleteRecord = (record: DnsRecord) => {
    if (record.isSystem) {
      toast.error('System records cannot be deleted.');
      return;
    }
    setConfirmDialog({
      open: true,
      title: 'Delete DNS Record',
      message: `This will permanently delete the ${record.type} record "${record.name}". This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => deleteRecord.mutate({ domainId: selectedDomain, recordId: record.id }),
    });
  };

  const handleReset = () => {
    resetZone.mutate(selectedDomain, {
      onSuccess: () => setConfirmReset(false),
      onError: (e: any) => toast.error(e.message || 'Failed to reset zone'),
    });
  };

  const handleExport = () => {
    const content = exportZone.data?.content;
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDomainObj?.name || 'zone'}.zone`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="DNS Management"
        description="Manage DNS zones and records for your domains"
      />

      {/* Domain selector */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={selectedDomain}
          onChange={e => { setSelectedDomain(e.target.value); setShowAdd(false); setEditingRecord(null); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select domain...</option>
          {domains?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {selectedDomain && zone && (
          <>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Record
            </button>
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Import
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button onClick={() => setShowRaw(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Eye className="h-3.5 w-3.5" /> Raw Zone
            </button>
            <button onClick={() => setShowPropagation(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Globe className="h-3.5 w-3.5" /> Propagation Check
            </button>
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">Reset zone to defaults?</span>
                <button onClick={handleReset} disabled={resetZone.isPending} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                  {resetZone.isPending ? 'Resetting...' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmReset(false)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10">
                <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
              </button>
            )}
          </>
        )}
      </div>

      {/* Zone info bar */}
      {selectedDomain && zone?.zone && (
        <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Primary NS:</span>{' '}
            {zone.zone.primaryNs}
          </span>
          <span>
            <span className="font-medium text-foreground">Serial:</span>{' '}
            {zone.zone.serial}
          </span>
          <span>
            <span className="font-medium text-foreground">TTL:</span>{' '}
            {zone.zone.ttl}s
          </span>
          <span>
            <span className="font-medium text-foreground">Records:</span>{' '}
            {zone.records.length}
          </span>
        </div>
      )}

      {/* SOA Record Editor */}
      {selectedDomain && zone?.zone && (
        <SoaRecordEditor domainId={selectedDomain} zone={zone.zone} />
      )}

      {/* External DNS Mode (Cloudflare) */}
      {selectedDomain && (
        <ExternalDnsSection domainId={selectedDomain} />
      )}

      {/* Add/Edit form */}
      {(showAdd || editingRecord) && (
        <div className="mb-4">
          <RecordForm
            domainId={selectedDomain}
            initial={editingRecord || undefined}
            onSubmit={() => { setShowAdd(false); setEditingRecord(null); }}
            onCancel={() => { setShowAdd(false); setEditingRecord(null); }}
          />
        </div>
      )}

      {/* Records */}
      {selectedDomain && zoneLoading && <LoadingSpinner />}

      {selectedDomain && zoneError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-600 dark:text-red-400">Failed to load DNS records.</p>
          <button
            onClick={() => refetchZone()}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {selectedDomain && !zoneLoading && !zoneError && zone && !zone.zone && (
        <EmptyState
          icon={Network}
          title="DNS zone has not been created for this domain"
          description="Create a DNS zone to start managing DNS records for this domain."
          action={
            <button
              onClick={() => resetZone.mutate(selectedDomain, {
                onSuccess: () => toast.success('DNS zone created'),
                onError: (e: any) => toast.error(e.message || 'Failed to create DNS zone'),
              })}
              disabled={resetZone.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {resetZone.isPending ? 'Creating...' : 'Create DNS Zone'}
            </button>
          }
        />
      )}

      {selectedDomain && zone && zone.zone && grouped.length > 0 ? (
        <div className="space-y-3">
          {grouped.map(({ type, records }) => (
            <div key={type} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggleGroup(type)}
                className="flex w-full items-center justify-between bg-muted/50 px-4 py-2.5 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary">
                    {type}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {records.length} record{records.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {expandedGroups.has(type) ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {expandedGroups.has(type) && (
                <ResponsiveTable>
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">TTL</th>
                      {(type === 'MX' || type === 'SRV') && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Priority</th>
                      )}
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{r.name}</span>
                          {r.isSystem && (
                            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              system
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-md truncate">{r.value}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.ttl}s</td>
                        {(type === 'MX' || type === 'SRV') && (
                          <td className="px-4 py-2.5 text-muted-foreground">{r.priority ?? '—'}</td>
                        )}
                        <td className="px-4 py-2.5 text-right">
                          {!r.isSystem && (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => setEditingRecord(r)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                title="Edit"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(r)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </ResponsiveTable>
              )}
            </div>
          ))}
        </div>
      ) : selectedDomain && zone && zone.zone && grouped.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No DNS records found"
          description='Click "Add Record" to create your first DNS record.'
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Record
            </button>
          }
        />
      ) : !selectedDomain ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <Globe className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Select a domain to manage its DNS records.</p>
        </div>
      ) : null}

      {/* Modals */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showRaw && selectedDomain && <RawZoneModal domainId={selectedDomain} />}
      {showPropagation && selectedDomain && (
        <PropagationModal
          domainId={selectedDomain}
          onClose={() => setShowPropagation(false)}
          canServePublicDns={canServePublicDns}
          primaryIp={primaryIp}
        />
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
