import { useState, useEffect, useCallback } from 'react';
import { useDomains } from '../../api/hooks/domains';
import {
  useSslCertificates,
  useIssueLetsEncrypt,
  useUploadCustomCert,
  useGenerateSelfSigned,
  useDeleteCertificate,
  useRenewCertificate,
  useToggleAutoRenew,
  useDownloadCert,
  useCertDetails,
  useValidateChain,
  useCheckMixedContent,
  useUpdateHsts,
  useUpdateOcspStapling,
} from '../../api/hooks/ssl';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  ShieldCheck, Plus, Trash2, RefreshCw, Download, Lock,
  FileText, Key, Link2, ChevronLeft, X, AlertTriangle,
  CheckCircle2, XCircle, Clock, Shield, Search, Globe,
  Zap, Eye, Copy,
} from 'lucide-react';
import type { SslCertificate, ChainValidationResult, MixedContentResult } from '../../api/hooks/ssl';

/* ------------------------------------------------------------------ */
/*  Issuance Progress Steps                                            */
/* ------------------------------------------------------------------ */
const ISSUANCE_STEPS = [
  'Checking domain...',
  'Generating CSR...',
  'Contacting CA...',
  'Installing certificate...',
  'Complete!',
];

function IssuanceProgress({ currentStep, error }: { currentStep: number; error?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h4 className="mb-4 font-semibold text-sm">Issuance Progress</h4>
      <div className="space-y-3">
        {ISSUANCE_STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;
          const isLast = idx === ISSUANCE_STEPS.length - 1;
          return (
            <div key={step} className="flex items-center gap-3">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                isDone ? 'bg-green-500 text-white' :
                isActive ? 'bg-primary text-primary-foreground animate-pulse' :
                'bg-muted text-muted-foreground'
              }`}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={`text-sm ${isDone ? 'text-green-600' : isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {step}
              </span>
              {isActive && !isLast && (
                <div className="ml-auto">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Issue Certificate Modal                                           */
/* ------------------------------------------------------------------ */
type CertType = 'letsencrypt' | 'custom' | 'selfsigned';

function IssueModal({ onClose }: { onClose: () => void }) {
  const domains = useDomains();
  const issueLE = useIssueLetsEncrypt();
  const uploadCustom = useUploadCustomCert();
  const selfSign = useGenerateSelfSigned();

  const [certType, setCertType] = useState<CertType>('letsencrypt');
  const [domainId, setDomainId] = useState('');
  const [email, setEmail] = useState('');
  const [sanDomains, setSanDomains] = useState('');
  const [certificate, setCertificate] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [chain, setChain] = useState('');
  const [days, setDays] = useState(365);
  const [error, setError] = useState('');

  // Wildcard / DNS-01 options
  const [wildcard, setWildcard] = useState(false);
  const [dnsProvider, setDnsProvider] = useState('cloudflare');

  // Issuance progress
  const [showProgress, setShowProgress] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressError, setProgressError] = useState('');

  const isPending = issueLE.isPending || uploadCustom.isPending || selfSign.isPending || showProgress;

  const simulateProgress = useCallback(() => {
    return new Promise<void>((resolve) => {
      let step = 0;
      const interval = setInterval(() => {
        step++;
        setProgressStep(step);
        if (step >= ISSUANCE_STEPS.length - 1) {
          clearInterval(interval);
          resolve();
        }
      }, 1200);
    });
  }, []);

  const handleSubmit = async () => {
    setError('');
    setProgressError('');
    if (!domainId) { setError('Select a domain'); return; }

    if (certType === 'letsencrypt') {
      if (!email) { setError('Email is required'); return; }
      setShowProgress(true);
      setProgressStep(0);
      try {
        await simulateProgress();
        issueLE.mutate(
          {
            domainId,
            email,
            sanDomains: sanDomains ? sanDomains.split(',').map(s => s.trim()) : undefined,
            wildcard,
            dnsProvider: wildcard ? dnsProvider : undefined,
          },
          {
            onSuccess: () => { setProgressStep(ISSUANCE_STEPS.length - 1); setTimeout(onClose, 800); },
            onError: (err: any) => { setProgressError(err.message || 'Failed to issue certificate'); setShowProgress(false); setError(err.message || 'Failed to issue certificate'); },
          },
        );
      } catch { setShowProgress(false); }
    } else if (certType === 'custom') {
      if (!certificate || !privateKey) { setError('Certificate and private key are required'); return; }
      uploadCustom.mutate(
        { domainId, certificate, privateKey, chain: chain || undefined },
        { onSuccess: onClose, onError: (err: any) => setError(err.message || 'Failed to upload certificate') },
      );
    } else {
      selfSign.mutate(
        { domainId, days },
        { onSuccess: onClose, onError: (err: any) => setError(err.message || 'Failed to generate certificate') },
      );
    }
  };

  const selectedDomain = domains.data?.find(d => d.id === domainId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Issue SSL Certificate</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {showProgress ? (
          <IssuanceProgress currentStep={progressStep} error={progressError} />
        ) : (
          <>
            {/* Certificate type selector */}
            <div className="mb-5 grid grid-cols-3 gap-2">
              {([
                { type: 'letsencrypt' as CertType, label: "Let's Encrypt", desc: 'Free, auto-renewed' },
                { type: 'custom' as CertType, label: 'Custom Upload', desc: 'Paste PEM files' },
                { type: 'selfsigned' as CertType, label: 'Self-Signed', desc: 'For testing only' },
              ]).map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { setCertType(opt.type); setWildcard(false); }}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    certType === opt.type
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Domain selector */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Domain</label>
              <select
                value={domainId}
                onChange={e => setDomainId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select domain...</option>
                {domains.data?.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Let's Encrypt fields */}
            {certType === 'letsencrypt' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Contact Email</label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Additional SANs <span className="text-muted-foreground">(comma-separated)</span>
                  </label>
                  <input
                    placeholder="sub.example.com, mail.example.com"
                    value={sanDomains}
                    onChange={e => setSanDomains(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                {/* Wildcard / DNS-01 option */}
                <div className="rounded-lg border border-border p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wildcard}
                      onChange={e => setWildcard(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <div>
                      <p className="text-sm font-medium">Wildcard Certificate (*.domain.com)</p>
                      <p className="text-xs text-muted-foreground">
                        Uses DNS-01 challenge instead of HTTP-01. Requires DNS provider access.
                      </p>
                    </div>
                  </label>
                  {wildcard && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium">DNS Provider</label>
                        <select
                          value={dnsProvider}
                          onChange={e => setDnsProvider(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="cloudflare">Cloudflare</option>
                          <option value="route53">AWS Route 53</option>
                          <option value="digitalocean">DigitalOcean</option>
                          <option value="google">Google Cloud DNS</option>
                          <option value="manual">Manual DNS</option>
                        </select>
                      </div>
                      {dnsProvider === 'manual' ? (
                        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3">
                          <p className="text-sm font-medium text-yellow-600">Manual DNS Configuration Required</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add the following TXT record to your DNS:
                          </p>
                          <div className="mt-2 rounded bg-black/5 p-2 font-mono text-xs">
                            <div>Name: <span className="font-semibold">_acme-challenge.{selectedDomain?.name || 'example.com'}</span></div>
                            <div>Type: <span className="font-semibold">TXT</span></div>
                            <div>Value: <span className="text-muted-foreground">(will be provided during issuance)</span></div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3">
                          <p className="text-sm font-medium text-blue-600">
                            {dnsProvider === 'cloudflare' ? 'Cloudflare' :
                             dnsProvider === 'route53' ? 'AWS Route 53' :
                             dnsProvider === 'digitalocean' ? 'DigitalOcean' :
                             'Google Cloud DNS'} API Integration
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            DNS TXT records will be created automatically via API. Ensure your API credentials are configured in server settings.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom upload fields */}
            {certType === 'custom' && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Certificate PEM</label>
                  <textarea
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    value={certificate}
                    onChange={e => setCertificate(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Private Key PEM</label>
                  <textarea
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    value={privateKey}
                    onChange={e => setPrivateKey(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    CA Chain PEM <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    value={chain}
                    onChange={e => setChain(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* Self-signed fields */}
            {certType === 'selfsigned' && (
              <div>
                <label className="mb-1 block text-sm font-medium">Validity (days)</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Self-signed certificates will show browser warnings. Use only for testing.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={showProgress && progressStep < ISSUANCE_STEPS.length - 1} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">
            {showProgress ? 'Close' : 'Cancel'}
          </button>
          {!showProgress && (
            <button
              onClick={handleSubmit}
              disabled={isPending || !domainId}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><Shield className="h-4 w-4" /> Issue Certificate</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Certificate Detail View                                           */
/* ------------------------------------------------------------------ */
function CertDetail({ cert, onBack }: { cert: SslCertificate; onBack: () => void }) {
  const { data: details, isLoading: detailsLoading } = useCertDetails(cert.domainId);
  const renew = useRenewCertificate();
  const deleteCert = useDeleteCertificate();
  const toggleAutoRenew = useToggleAutoRenew();
  const downloadCert = useDownloadCert();
  const validateChain = useValidateChain();
  const checkMixedContent = useCheckMixedContent();
  const updateHsts = useUpdateHsts();
  const updateOcspStapling = useUpdateOcspStapling();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chainResult, setChainResult] = useState<ChainValidationResult | null>(null);
  const [mixedContentResult, setMixedContentResult] = useState<MixedContentResult | null>(null);

  // HSTS state
  const [hstsEnabled, setHstsEnabled] = useState(cert.hstsEnabled ?? false);
  const [hstsMaxAge, setHstsMaxAge] = useState(cert.hstsMaxAge ?? 31536000);
  const [hstsSubdomains, setHstsSubdomains] = useState(cert.hstsIncludeSubdomains ?? false);

  // OCSP state
  const [ocspEnabled, setOcspEnabled] = useState(cert.ocspStapling ?? false);

  const daysLeft = cert.daysUntilExpiry;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  const expiryColor = isExpired
    ? 'text-red-500'
    : isExpiring
      ? 'text-yellow-500'
      : 'text-green-500';

  const expiryBg = isExpired
    ? 'bg-red-500/10 border-red-500/30'
    : isExpiring
      ? 'bg-yellow-500/10 border-yellow-500/30'
      : 'bg-green-500/10 border-green-500/30';

  const handleDownload = (file: 'cert' | 'key' | 'chain') => {
    downloadCert.mutate(
      { domainId: cert.domainId, file },
      {
        onSuccess: (data: any) => {
          const content = typeof data === 'string' ? data : data?.data || '';
          const blob = new Blob([content], { type: 'application/x-pem-file' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${cert.domain}-${file}.pem`;
          a.click();
          URL.revokeObjectURL(url);
        },
      },
    );
  };

  const handleValidateChain = () => {
    setChainResult(null);
    validateChain.mutate(cert.domainId, {
      onSuccess: (data) => setChainResult(data),
    });
  };

  const handleCheckMixedContent = () => {
    setMixedContentResult(null);
    checkMixedContent.mutate(cert.domainId, {
      onSuccess: (data) => setMixedContentResult(data),
    });
  };

  const handleHstsToggle = () => {
    const newEnabled = !hstsEnabled;
    setHstsEnabled(newEnabled);
    updateHsts.mutate({
      domainId: cert.domainId,
      enabled: newEnabled,
      maxAge: hstsMaxAge,
      includeSubdomains: hstsSubdomains,
    });
  };

  const handleOcspToggle = () => {
    const newEnabled = !ocspEnabled;
    setOcspEnabled(newEnabled);
    updateOcspStapling.mutate({
      domainId: cert.domainId,
      enabled: newEnabled,
    });
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to certificates
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{cert.domain}</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${expiryBg} border`}>
              {isExpired ? <XCircle className="h-3 w-3" /> : isExpiring ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Valid'}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
              {cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'selfsigned' ? 'Self-Signed' : 'Custom'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {cert.type === 'letsencrypt' && (
            <button
              onClick={() => renew.mutate(cert.domainId)}
              disabled={renew.isPending}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${renew.isPending ? 'animate-spin' : ''}`} />
              Renew
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        </div>
      </div>

      {/* Expiry warning */}
      {(isExpired || isExpiring) && (
        <div className={`mb-5 flex items-center gap-3 rounded-lg border ${expiryBg} px-4 py-3`}>
          <AlertTriangle className={`h-5 w-5 shrink-0 ${expiryColor}`} />
          <div>
            <p className={`text-sm font-medium ${expiryColor}`}>
              {isExpired
                ? `Certificate expired ${Math.abs(daysLeft!)} days ago`
                : `Certificate expires in ${daysLeft} days`}
            </p>
            {cert.type === 'letsencrypt' && isExpiring && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Click "Renew" to renew the certificate now, or enable auto-renew.
              </p>
            )}
          </div>
        </div>
      )}

      {detailsLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Certificate info */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-4 font-semibold">Certificate Information</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Domain</dt>
                <dd className="font-medium">{cert.domain}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium capitalize">
                  {cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'selfsigned' ? 'Self-Signed' : 'Custom'}
                </dd>
              </div>
              {details?.issuer && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Issuer</dt>
                  <dd className="font-medium text-right max-w-[200px] truncate" title={details.issuer}>
                    {details.issuer}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expires</dt>
                <dd className={`font-medium ${expiryColor}`}>
                  {cert.expiresAt
                    ? `${new Date(cert.expiresAt).toLocaleDateString()} (${daysLeft} days)`
                    : '—'}
                </dd>
              </div>
              {details?.issuedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Issued</dt>
                  <dd className="font-medium">{new Date(details.issuedAt).toLocaleDateString()}</dd>
                </div>
              )}
              {details?.fingerprint && (
                <div>
                  <dt className="text-muted-foreground">SHA-256 Fingerprint</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{details.fingerprint}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Settings & SANs */}
          <div className="space-y-5">
            {/* SANs */}
            {details?.sanDomains && details.sanDomains.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="mb-3 font-semibold">Subject Alternative Names</h3>
                <div className="flex flex-wrap gap-2">
                  {details.sanDomains.map((san) => (
                    <span key={san} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                      <Link2 className="h-3 w-3" /> {san}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-renew */}
            {cert.type === 'letsencrypt' && (
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="mb-3 font-semibold">Auto-Renewal</h3>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-renew certificate</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically renew 30 days before expiry
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAutoRenew.mutate({ domainId: cert.domainId, autoRenew: !cert.autoRenew })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      cert.autoRenew ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cert.autoRenew ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </label>
              </div>
            )}

            {/* HSTS Toggle */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" /> HSTS (HTTP Strict Transport Security)
              </h3>
              <label className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Enable HSTS</p>
                  <p className="text-xs text-muted-foreground">
                    Force browsers to use HTTPS for this domain
                  </p>
                </div>
                <button
                  onClick={handleHstsToggle}
                  disabled={updateHsts.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hstsEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hstsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </label>
              {hstsEnabled && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Max-Age (seconds)</label>
                    <input
                      type="number"
                      value={hstsMaxAge}
                      onChange={e => setHstsMaxAge(Number(e.target.value))}
                      onBlur={() => updateHsts.mutate({ domainId: cert.domainId, enabled: hstsEnabled, maxAge: hstsMaxAge, includeSubdomains: hstsSubdomains })}
                      min={0}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hstsMaxAge >= 86400 ? `${Math.round(hstsMaxAge / 86400)} day(s)` : `${hstsMaxAge} seconds`}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hstsSubdomains}
                      onChange={e => {
                        setHstsSubdomains(e.target.checked);
                        updateHsts.mutate({ domainId: cert.domainId, enabled: hstsEnabled, maxAge: hstsMaxAge, includeSubdomains: e.target.checked });
                      }}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">Include Subdomains</span>
                  </label>
                </div>
              )}
            </div>

            {/* OCSP Stapling Toggle */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" /> OCSP Stapling
              </h3>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable OCSP Stapling</p>
                  <p className="text-xs text-muted-foreground">
                    Improves SSL handshake performance by stapling the OCSP response
                  </p>
                </div>
                <button
                  onClick={handleOcspToggle}
                  disabled={updateOcspStapling.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    ocspEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    ocspEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </label>
            </div>

            {/* Certificate Chain Validator */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 font-semibold flex items-center gap-2">
                <Search className="h-4 w-4" /> Certificate Chain Validation
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Verify that the certificate chain is complete and trusted.
              </p>
              <button
                onClick={handleValidateChain}
                disabled={validateChain.isPending}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {validateChain.isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Validating...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Validate Chain</>
                )}
              </button>
              {chainResult && (
                <div className={`mt-3 rounded-md border p-3 ${
                  chainResult.valid
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {chainResult.valid ? (
                      <><CheckCircle2 className="h-4 w-4 text-green-500" /> Chain is valid</>
                    ) : (
                      <><XCircle className="h-4 w-4 text-red-500" /> Chain issues detected</>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div>Chain complete: {chainResult.chainComplete ? '✓ Yes' : '✗ No'}</div>
                    <div>Intermediate certs: {chainResult.intermediateCount}</div>
                    <div>Root trusted: {chainResult.rootTrusted ? '✓ Yes' : '✗ No'}</div>
                    {chainResult.issues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {chainResult.issues.map((issue, i) => (
                          <div key={i} className="text-red-500">• {issue}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mixed Content Checker */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4" /> Mixed Content Checker
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Scan for HTTP resources loaded on HTTPS pages.
              </p>
              <button
                onClick={handleCheckMixedContent}
                disabled={checkMixedContent.isPending}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {checkMixedContent.isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Scanning...</>
                ) : (
                  <><Globe className="h-4 w-4" /> Check Mixed Content</>
                )}
              </button>
              {mixedContentResult && (
                <div className={`mt-3 rounded-md border p-3 ${
                  mixedContentResult.totalIssues === 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {mixedContentResult.totalIssues === 0 ? (
                      <><CheckCircle2 className="h-4 w-4 text-green-500" /> No mixed content found</>
                    ) : (
                      <><AlertTriangle className="h-4 w-4 text-yellow-500" /> {mixedContentResult.totalIssues} mixed content issue(s) found</>
                    )}
                  </div>
                  {mixedContentResult.issues.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {mixedContentResult.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 rounded bg-black/5 p-2 text-xs">
                          <span className="shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 font-mono text-yellow-600">
                            {issue.type}
                          </span>
                          <span className="break-all text-muted-foreground">{issue.resourceUrl}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Download */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 font-semibold">Download Certificate Files</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDownload('cert')}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <FileText className="h-4 w-4" /> cert.pem
                </button>
                <button
                  onClick={() => handleDownload('key')}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Key className="h-4 w-4" /> key.pem
                </button>
                {details?.hasChain && (
                  <button
                    onClick={() => handleDownload('chain')}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    <Download className="h-4 w-4" /> chain.pem
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Remove SSL Certificate"
        message={`This will remove the SSL certificate for '${cert.domain}'. The site will become inaccessible via HTTPS. This cannot be undone.`}
        variant="danger"
        confirmText="Remove Certificate"
        onConfirm={() => deleteCert.mutate(cert.domainId, { onSuccess: onBack })}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main SslPage                                                      */
/* ------------------------------------------------------------------ */
export function SslPage() {
  const { data: domains } = useDomains();
  const { data: certs, isLoading, isError, refetch } = useSslCertificates();
  const [showIssue, setShowIssue] = useState(false);
  const [selectedCert, setSelectedCert] = useState<SslCertificate | null>(null);
  const [search, setSearch] = useState('');

  if (isLoading) return <LoadingSpinner />;

  if (isError) return (
    <div>
      <PageHeader
        title="SSL Certificates"
        description="Manage SSL/TLS certificates for your domains"
      />
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-red-600 dark:text-red-400">Failed to load SSL certificates. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  // Certificate detail view
  if (selectedCert) {
    return <CertDetail cert={selectedCert} onBack={() => setSelectedCert(null)} />;
  }

  const filtered = (certs || []).filter((c: SslCertificate) =>
    c.domain.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="SSL Certificates"
        description="Manage SSL/TLS certificates for your domains"
        actions={
          <button
            onClick={() => setShowIssue(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Issue Certificate
          </button>
        }
      />

      {/* Search */}
      {certs && certs.length > 0 && (
        <div className="mb-4">
          <input
            placeholder="Search certificates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Empty state */}
      {!certs?.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="No certificates"
          description="Issue your first SSL certificate to secure your domains."
          action={
            <button
              onClick={() => setShowIssue(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Issue Certificate
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No certificates match your search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: SslCertificate) => {
            const daysLeft = c.daysUntilExpiry;
            const isExpired = daysLeft !== null && daysLeft <= 0;
            const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

            const statusColor = isExpired
              ? 'border-red-500/30 bg-red-500/5'
              : isExpiring
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : 'border-border bg-card';

            const badgeColor = isExpired
              ? 'bg-red-500/10 text-red-500'
              : isExpiring
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'bg-green-500/10 text-green-500';

            return (
              <button
                key={c.id}
                onClick={() => setSelectedCert(c)}
                className={`rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${statusColor}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className={`h-4 w-4 ${isExpired ? 'text-red-500' : isExpiring ? 'text-yellow-500' : 'text-green-500'}`} />
                    <span className="font-medium">{c.domain}</span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                    {isExpired ? 'Expired' : isExpiring ? `${daysLeft}d left` : 'Valid'}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 capitalize">
                    {c.type === 'letsencrypt' ? "Let's Encrypt" : c.type === 'selfsigned' ? 'Self-Signed' : 'Custom'}
                  </span>
                  {c.expiresAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  {c.autoRenew && (
                    <span className="flex items-center gap-1 text-primary">
                      <RefreshCw className="h-3 w-3" /> Auto
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Issue modal */}
      {showIssue && <IssueModal onClose={() => setShowIssue(false)} />}
    </div>
  );
}
