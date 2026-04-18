'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';

interface CfAccount {
  id: string;
  name: string;
  email: string | null;
  accountId: string | null;
  createdAt: string;
}

interface Zone {
  id: string;
  zoneId: string;
  zoneName: string;
  sslMode: string | null;
  plan: string | null;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  managedByPanel: boolean;
}

export default function DomainsPage() {
  const [accounts, setAccounts] = useState<CfAccount[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [adding, setAdding] = useState(false);

  // Add record form
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordType, setRecordType] = useState('CNAME');
  const [recordName, setRecordName] = useState('');
  const [recordContent, setRecordContent] = useState('');
  const [recordProxied, setRecordProxied] = useState(true);
  const [addingRecord, setAddingRecord] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.get<CfAccount[]>('/cf-accounts');
      setAccounts(data);

      if (data.length > 0) {
        const domainsData = await api.get<any>('/domains');
        const allZones: Zone[] = [];
        for (const account of domainsData) {
          if (account.zones) allZones.push(...account.zones);
        }
        setZones(allZones);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/cf-accounts', { name: accountName, apiToken });
      setShowAddAccount(false);
      setAccountName('');
      setApiToken('');
      loadData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleSyncZones(accountId: string) {
    try {
      await api.post(`/cf-accounts/${accountId}/sync-zones`);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function loadRecords(zoneId: string) {
    setSelectedZone(zoneId);
    try {
      const data = await api.get<DnsRecord[]>(`/domains/${zoneId}/records`);
      setRecords(data);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedZone) return;
    setAddingRecord(true);
    try {
      await api.post(`/domains/${selectedZone}/records`, {
        type: recordType,
        name: recordName,
        content: recordContent,
        proxied: recordProxied,
      });
      setShowAddRecord(false);
      setRecordName('');
      setRecordContent('');
      loadRecords(selectedZone);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    } finally {
      setAddingRecord(false);
    }
  }

  async function handleDeleteRecord(recordId: string) {
    if (!selectedZone || !confirm('Delete this DNS record?')) return;
    try {
      await api.delete(`/domains/${selectedZone}/records/${recordId}`);
      loadRecords(selectedZone);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domains & DNS</h1>
          <p className="text-muted-foreground mt-1">{accounts.length} Cloudflare account{accounts.length !== 1 ? 's' : ''} connected</p>
        </div>
        <button
          onClick={() => setShowAddAccount(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Cloudflare Account
        </button>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {/* Add Account Form */}
      {showAddAccount && (
        <form onSubmit={handleAddAccount} className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Connect Cloudflare Account</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Account Name</label>
            <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="My Cloudflare" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Token</label>
            <input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Cloudflare API token" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={adding} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
              {adding ? 'Connecting...' : 'Connect'}
            </button>
            <button type="button" onClick={() => setShowAddAccount(false)} className="text-sm text-muted-foreground">Cancel</button>
          </div>
        </form>
      )}

      {/* Accounts */}
      {accounts.map((account) => (
        <div key={account.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">{account.name}</h3>
              <p className="text-xs text-muted-foreground">{account.email || 'No email'} &middot; {account.accountId || 'No account ID'}</p>
            </div>
            <button onClick={() => handleSyncZones(account.id)} className="rounded-md border border-input px-3 py-1 text-sm hover:bg-muted">
              Sync Zones
            </button>
          </div>
        </div>
      ))}

      {/* Zones */}
      {zones.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Zones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => loadRecords(zone.id)}
                className={`rounded-lg border bg-card p-4 text-left hover:border-primary transition-colors ${selectedZone === zone.id ? 'border-primary ring-1 ring-primary' : ''}`}
              >
                <div className="font-medium">{zone.zoneName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  SSL: {zone.sslMode || 'N/A'} &middot; {zone.plan || 'Free'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DNS Records */}
      {selectedZone && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">DNS Records</h2>
            <button onClick={() => setShowAddRecord(true)} className="rounded-md border border-input px-3 py-1 text-sm hover:bg-muted">
              Add Record
            </button>
          </div>

          {showAddRecord && (
            <form onSubmit={handleAddRecord} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" value={recordName} onChange={(e) => setRecordName(e.target.value)} required placeholder="name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input type="text" value={recordContent} onChange={(e) => setRecordContent(e.target.value)} required placeholder="value" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={recordProxied} onChange={(e) => setRecordProxied(e.target.checked)} /> Proxied</label>
                  <button type="submit" disabled={addingRecord} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">{addingRecord ? '...' : 'Add'}</button>
                </div>
              </div>
            </form>
          )}

          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Content</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground w-16">Proxy</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{record.type}</td>
                    <td className="px-4 py-2">{record.name}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-xs">{record.content}</td>
                    <td className="px-4 py-2">{record.proxied ? '🟠' : '⚪'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => handleDeleteRecord(record.id)} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No Cloudflare accounts connected. Add your CF API token to manage domains and tunnels.</p>
        </div>
      )}
    </div>
  );
}
