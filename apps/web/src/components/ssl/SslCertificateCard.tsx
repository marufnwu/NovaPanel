import { Shield, CheckCircle, XCircle } from 'lucide-react';

interface SslCertificateCardProps {
  domain: string;
  enabled: boolean;
  issuer?: string;
  expiresAt?: string;
  onManage?: () => void;
}

export function SslCertificateCard({ domain, enabled, issuer, expiresAt, onManage }: SslCertificateCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded p-2 ${enabled ? 'bg-green-500/10' : 'bg-muted'}`}>
            <Shield className={`h-5 w-5 ${enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-medium">{domain}</h3>
            <p className="text-sm text-muted-foreground">
              {enabled ? 'SSL Enabled' : 'SSL Disabled'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
              <CheckCircle className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <XCircle className="h-3 w-3" /> Inactive
            </span>
          )}
          {onManage && (
            <button
              onClick={onManage}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Manage
            </button>
          )}
        </div>
      </div>
      {enabled && (issuer || expiresAt) && (
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          {issuer && <span>Issuer: {issuer}</span>}
          {expiresAt && <span>Expires: {new Date(expiresAt).toLocaleDateString()}</span>}
        </div>
      )}
    </div>
  );
}