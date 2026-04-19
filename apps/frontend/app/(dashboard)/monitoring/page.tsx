'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api-client';

interface UptimeCheck {
  id: string;
  siteId: string;
  url: string;
  status: string;
  responseTimeMs: number | null;
  lastCheckedAt: string | null;
  enabled: boolean;
  openIncidents: number;
  latest: { up: boolean; responseTimeMs: number | null; statusCode: number | null; checkedAt: string } | null;
  site: { id: string; name: string; domain: string } | null;
}

interface AlertRule {
  id: string;
  type: string;
  serverId: string | null;
  siteId: string | null;
  threshold: number | null;
  channel: string;
  active: boolean;
  cooldownMinutes: number;
  createdAt: string;
}

export default function MonitoringPage() {
  const [checks, setChecks] = useState<UptimeCheck[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [tab, setTab] = useState<'uptime' | 'alerts' | 'channels'>('uptime');
  const [showAlertForm, setShowAlertForm] = useState(false);

  // Alert form state
  const [alertType, setAlertType] = useState('site_down');
  const [alertChannel, setAlertChannel] = useState('webhook');
  const [alertThreshold, setAlertThreshold] = useState('90');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [checksRes, alertsRes] = await Promise.all([
        api.get<{ ok: boolean; data: UptimeCheck[] }>('/monitoring/uptime'),
        api.get<{ ok: boolean; data: AlertRule[] }>('/monitoring/alerts'),
      ]);
      setChecks(checksRes.data);
      setAlerts(alertsRes.data);
    } catch {}
  }

  async function toggleCheck(checkId: string, enabled: boolean) {
    try {
      await api.put(`/monitoring/uptime/${checkId}`, { enabled: !enabled });
      loadData();
    } catch {}
  }

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const channelConfig: Record<string, string> = {};
    if (alertChannel === 'webhook') channelConfig.webhookUrl = webhookUrl;
    if (alertChannel === 'telegram') {
      channelConfig.botToken = botToken;
      channelConfig.chatId = chatId;
    }

    try {
      await api.post('/monitoring/alerts', {
        type: alertType,
        channel: alertChannel,
        threshold: alertType !== 'site_down' ? parseInt(alertThreshold) : undefined,
        channelConfig,
      });
      setShowAlertForm(false);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function deleteAlert(id: string) {
    try {
      await api.delete(`/monitoring/alerts/${id}`);
      loadData();
    } catch {}
  }

  async function toggleAlert(id: string, active: boolean) {
    try {
      await api.put(`/monitoring/alerts/${id}`, { active: !active });
      loadData();
    } catch {}
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground mt-1">Uptime checks and alerting</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['uptime', 'alerts', 'channels'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {{ uptime: 'Uptime', alerts: 'Alert Rules', channels: 'Channels' }[t]}
          </button>
        ))}
      </div>

      {tab === 'uptime' && (
        <div className="space-y-3">
          {checks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No uptime checks yet.</p>
              <p className="text-sm mt-1">Checks are created automatically when sites go live.</p>
            </div>
          ) : (
            checks.map((check) => (
              <div key={check.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${check.status === 'up' ? 'bg-green-500' : check.status === 'down' ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-medium">{check.site?.name || check.url}</p>
                      <p className="text-sm text-muted-foreground">{check.site?.domain || check.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {check.latest && (
                      <div className="text-right text-sm">
                        <p>{check.latest.responseTimeMs !== null ? `${check.latest.responseTimeMs}ms` : '—'}</p>
                        <p className="text-muted-foreground">{check.latest.statusCode || '—'}</p>
                      </div>
                    )}
                    {check.openIncidents > 0 && (
                      <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                        {check.openIncidents} incident{check.openIncidents > 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={() => toggleCheck(check.id, check.enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${check.enabled ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${check.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
                {check.lastCheckedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last checked: {new Date(check.lastCheckedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAlertForm(!showAlertForm)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showAlertForm ? 'Cancel' : 'Add Alert Rule'}
            </button>
          </div>

          {showAlertForm && (
            <form onSubmit={createAlert} className="rounded-lg border bg-card p-4 space-y-4">
              {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Alert Type</label>
                  <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="site_down">Site Down</option>
                    <option value="cpu">CPU Usage</option>
                    <option value="ram">RAM Usage</option>
                    <option value="disk">Disk Usage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Channel</label>
                  <select value={alertChannel} onChange={(e) => setAlertChannel(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="webhook">Webhook</option>
                    <option value="telegram">Telegram</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              {alertType !== 'site_down' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Threshold (%)</label>
                  <input type="number" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
              )}

              {alertChannel === 'webhook' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Webhook URL</label>
                  <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="https://hooks.slack.com/..." />
                </div>
              )}

              {alertChannel === 'telegram' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Bot Token</label>
                    <input type="text" value={botToken} onChange={(e) => setBotToken(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Chat ID</label>
                    <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Create Rule
              </button>
            </form>
          )}

          {alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No alert rules configured.</p>
            </div>
          ) : (
            alerts.map((rule) => (
              <div key={rule.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{rule.type.replace('_', ' ')} Alert</p>
                    <p className="text-sm text-muted-foreground">
                      via {rule.channel}
                      {rule.threshold ? ` • threshold: ${rule.threshold}%` : ''}
                      {` • cooldown: ${rule.cooldownMinutes}m`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlert(rule.id, rule.active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.active ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${rule.active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <button onClick={() => deleteAlert(rule.id)} className="text-sm text-muted-foreground hover:text-destructive px-2 py-1">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'channels' && <ChannelsTab />}
    </div>
  );
}

function ChannelsTab() {
  const [channels, setChannels] = useState<Array<{ id: string; type: string; active: boolean; createdAt: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [chType, setChType] = useState('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  useEffect(() => { loadChannels(); }, []);

  async function loadChannels() {
    try {
      const res = await api.get<{ ok: boolean; data: any[] }>('/notifications/channels');
      setChannels(res.data);
    } catch {}
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    const config: Record<string, string> = {};
    if (chType === 'webhook' || chType === 'slack') config.webhookUrl = webhookUrl;
    if (chType === 'telegram') { config.botToken = botToken; config.chatId = chatId; }

    try {
      await api.post('/notifications/channels', { type: chType, config });
      setShowForm(false);
      setWebhookUrl('');
      loadChannels();
    } catch {}
  }

  async function deleteChannel(id: string) {
    try { await api.delete(`/notifications/channels/${id}`); loadChannels(); } catch {}
  }

  async function testChannel(id: string) {
    try { await api.post(`/notifications/channels/${id}/test`); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          {showForm ? 'Cancel' : '+ Add Channel'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createChannel} className="rounded-lg border bg-card p-4 space-y-3">
          <select value={chType} onChange={(e) => setChType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="webhook">Webhook</option>
            <option value="slack">Slack</option>
            <option value="telegram">Telegram</option>
          </select>
          {(chType === 'webhook' || chType === 'slack') && (
            <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} required placeholder="Webhook URL" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          )}
          {chType === 'telegram' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={botToken} onChange={(e) => setBotToken(e.target.value)} required placeholder="Bot Token" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)} required placeholder="Chat ID" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Create</button>
        </form>
      )}

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notification channels configured.</p>
      ) : channels.map((ch) => (
        <div key={ch.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${ch.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{ch.active ? 'Active' : 'Inactive'}</span>
            <span className="text-sm capitalize">{ch.type}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => testChannel(ch.id)} className="text-xs text-primary hover:underline">Test</button>
            <button onClick={() => deleteChannel(ch.id)} className="text-xs text-destructive hover:underline">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
