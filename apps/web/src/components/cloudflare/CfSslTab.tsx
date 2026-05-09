import { useState, useEffect } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from '../../lib/toast';
import type { DomainCloudflareSsl } from '../../api/hooks/domains';

export interface DomainCfSslTabProps {
  domainId: string;
  settings: DomainCloudflareSsl | undefined;
  loading: boolean;
  onRefresh: () => void;
  onUpdate: {
    mutate: (
      data: DomainCloudflareSsl,
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
    isPending: boolean;
  };
}

interface ToggleSettingProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
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

export function DomainCfSslTab({
  domainId,
  settings,
  loading,
  onRefresh,
  onUpdate,
}: DomainCfSslTabProps) {
  const [localSettings, setLocalSettings] = useState<DomainCloudflareSsl | null>(null);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  if (loading) return <LoadingSpinner />;
  if (!localSettings) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">SSL/TLS Encryption</h3>
        <div>
          <label className="mb-2 block text-sm font-medium">SSL Mode</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['off', 'flexible', 'full', 'strict'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLocalSettings({ ...localSettings, sslMode: mode })}
                className={`rounded-lg border p-3 text-center text-sm transition-colors ${
                  localSettings?.sslMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent'
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
          <ToggleSetting label="Always Use HTTPS" description="Redirect HTTP to HTTPS at edge" checked={localSettings?.alwaysUseHttps ?? false} onChange={(v) => setLocalSettings({ ...localSettings!, alwaysUseHttps: v })} />
          <ToggleSetting label="Automatic HTTPS Rewrites" description="Rewrite HTTP links to HTTPS" checked={localSettings?.automaticHttpsRewrites ?? false} onChange={(v) => setLocalSettings({ ...localSettings!, automaticHttpsRewrites: v })} />
          <ToggleSetting label="HTTP/2" checked={localSettings?.http2 ?? true} onChange={(v) => setLocalSettings({ ...localSettings!, http2: v })} />
          <ToggleSetting label="HTTP/3 (QUIC)" checked={localSettings?.http3 ?? true} onChange={(v) => setLocalSettings({ ...localSettings!, http3: v })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Minimum TLS Version</label>
          <select
            value={localSettings?.minTlsVersion || '1.2'}
            onChange={(e) => setLocalSettings({ ...localSettings!, minTlsVersion: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {['1.0', '1.1', '1.2', '1.3'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button
          onClick={() => {
            onUpdate.mutate(localSettings, {
              onSuccess: () => toast.success('SSL settings updated'),
              onError: (e: Error) => toast.error(e.message),
            });
          }}
          disabled={onUpdate.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {onUpdate.isPending ? 'Saving...' : 'Save SSL Settings'}
        </button>
      </div>
    </div>
  );
}
