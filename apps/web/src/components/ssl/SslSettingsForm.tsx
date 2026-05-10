import { useState, useEffect } from 'react';
import { Shield, Save, CheckCircle } from 'lucide-react';

export interface SslSettings {
  sslMode: 'off' | 'flexible' | 'full' | 'strict';
  alwaysUseHttps: boolean;
  automaticHttpsRewrites: boolean;
  http2: boolean;
  http3: boolean;
  minTlsVersion: string;
}

interface SslSettingsFormProps {
  settings: SslSettings | null;
  onUpdate: (settings: SslSettings) => void;
  onRefresh: () => void;
  isUpdating: boolean;
}

export function SslSettingsForm({ settings, onUpdate, onRefresh, isUpdating }: SslSettingsFormProps) {
  const [localSettings, setLocalSettings] = useState<SslSettings | null>(null);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  if (!localSettings) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          Refresh
        </button>
      </div>
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" /> SSL/TLS Encryption
        </h3>
        <div>
          <label className="mb-2 block text-sm font-medium">SSL Mode</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['off', 'flexible', 'full', 'strict'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLocalSettings({ ...localSettings, sslMode: mode })}
                className={`rounded-lg border p-3 text-center text-sm transition-colors ${
                  localSettings.sslMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent'
                }`}
              >
                <div className="font-medium capitalize">{mode}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {mode === 'off' && 'No encryption'}
                  {mode === 'flexible' && 'HTTP to server'}
                  {mode === 'full' && 'HTTPS, self-signed OK'}
                  {mode === 'strict' && 'HTTPS, valid cert required'}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleSetting label="Always Use HTTPS" description="Redirect HTTP to HTTPS at edge" checked={localSettings.alwaysUseHttps} onChange={(v) => setLocalSettings({ ...localSettings, alwaysUseHttps: v })} />
          <ToggleSetting label="Automatic HTTPS Rewrites" description="Rewrite HTTP links to HTTPS" checked={localSettings.automaticHttpsRewrites} onChange={(v) => setLocalSettings({ ...localSettings, automaticHttpsRewrites: v })} />
          <ToggleSetting label="HTTP/2" checked={localSettings.http2} onChange={(v) => setLocalSettings({ ...localSettings, http2: v })} />
          <ToggleSetting label="HTTP/3 (QUIC)" checked={localSettings.http3} onChange={(v) => setLocalSettings({ ...localSettings, http3: v })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Minimum TLS Version</label>
          <select
            value={localSettings.minTlsVersion}
            onChange={(e) => setLocalSettings({ ...localSettings, minTlsVersion: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {['1.0', '1.1', '1.2', '1.3'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button
          onClick={() => onUpdate(localSettings)}
          disabled={isUpdating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {isUpdating ? 'Saving...' : 'Save SSL Settings'}
        </button>
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer hover:bg-accent/50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 rounded" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </label>
  );
}