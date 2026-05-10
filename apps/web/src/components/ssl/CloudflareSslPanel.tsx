import { useState } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { useDomainCloudflareSsl, useUpdateDomainCloudflareSsl } from '../../api/hooks/domains';
import type { DomainCloudflareSsl } from '../../api/hooks/domains';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SslSettingsForm } from './SslSettingsForm';
import type { SslSettings } from './SslSettingsForm';

interface CloudflareSslPanelProps {
  domainId: string;
}

export function CloudflareSslPanel({ domainId }: CloudflareSslPanelProps) {
  const { data: ssl, isLoading, refetch } = useDomainCloudflareSsl(domainId);
  const updateSsl = useUpdateDomainCloudflareSsl(domainId);

  if (isLoading) return <LoadingSpinner />;

  // Cast ssl to SslSettings type (Cloudflare API may return different shape)
  const settings: SslSettings | null = ssl ? {
    sslMode: (ssl.sslMode as 'off' | 'flexible' | 'full' | 'strict') || 'flexible',
    alwaysUseHttps: ssl.alwaysUseHttps ?? false,
    automaticHttpsRewrites: ssl.automaticHttpsRewrites ?? false,
    http2: ssl.http2 ?? true,
    http3: ssl.http3 ?? true,
    minTlsVersion: ssl.minTlsVersion || '1.2',
  } : null;

  return (
    <div className="space-y-4">
      <SslSettingsForm
        settings={settings}
        onUpdate={(s) => updateSsl.mutate(s as any)}
        onRefresh={refetch}
        isUpdating={updateSsl.isPending}
      />
    </div>
  );
}