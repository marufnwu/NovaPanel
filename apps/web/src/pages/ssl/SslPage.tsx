import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useDomains } from '../../api/hooks/domains';
import { useServerContext } from '../../api/hooks/settings';
import { useTunnelStatus } from '../../api/hooks/tunnel';
import {
  useSslCertificates,
  useExpiringCerts,
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
import { ActionDropdown } from '../../components/ui/ActionDropdown';
import { toast } from '../../lib/toast';
import {
  ShieldCheck, Plus, Trash2, RefreshCw, Download, Lock,
  FileText, Key, Link2, ChevronLeft, X, AlertTriangle,
  CheckCircle2, XCircle, Clock, Shield, Search, Globe,
  Zap, Eye, Copy, AlertCircle, Info, ChevronDown, ChevronUp, MoreVertical,
} from 'lucide-react';
import type { SslCertificate, ChainValidationResult, MixedContentResult } from '../../api/hooks/ssl';

/* ------------------------------------------------------------------ */
/*  Structured Error Display                                          */
/* ------------------------------------------------------------------ */
interface StructuredError {
  title?: string;
  message?: string;
  suggestion?: string;
  cause?: string;
}

function parseStructuredError(error: any): StructuredError {
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed.title || parsed.message || parsed.suggestion) {
        return parsed;
      }
    } catch {
      return { message: error };
    }
  }
  if (error && typeof error === 'object') {
    if (error.title || error.message || error.suggestion) {
      return {
        title: error.title,
        message: error.message,
        suggestion: error.suggestion,
        cause: error.cause,
      };
    }
    // Check for nested error response
    if (error.response?.data) {
      const data = error.response.data;
      if (data.title || data.message || data.suggestion) {
        return {
          title: data.title,
          message: data.message,
          suggestion: data.suggestion,
          cause: data.cause,
        };
      }
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.title || parsed.message || parsed.suggestion) {
            return parsed;
          }
        } catch {
          return { message: data };
        }
      }
    }
  }
  return { message: error?.message || 'An unknown error occurred' };
}

function StructuredErrorDisplay({ error }: { error: any }) {
  const structured = parseStructuredError(error);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-3">
      {structured.title && (
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertCircle className="h-4 w-4" />
          {structured.title}
        </div>
      )}
      {structured.message && (
        <p className="text-sm text-destructive/90">{structured.message}</p>
      )}
      {structured.suggestion && (
        <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
            <Info className="h-4 w-4 shrink-0" />
            Suggested Fix
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{structured.suggestion}</p>
        </div>
      )}
      {structured.cause && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Show technical details
          </button>
          {showDetails && (
            <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
              {structured.cause}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

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

function IssuanceProgress({ currentStep, error }: { currentStep: number; error?: string | StructuredError }) {
  const isStructuredError = error && typeof error === 'object' && ('title' in error || 'message' in error);
  
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
        <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2">
          {isStructuredError ? (
            <StructuredErrorDisplay error={error} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" /> {error as string}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Issue Certificate Modal                                           */
/* ------------------------------------------------------------------ */
type CertType = 'letsencrypt' | 'custom' | 'selfsigned';
type ChallengeType = 'http-01' | 'dns-01';

function IssueModal({ onClose }: { onClose: () => void }) {
  const domains = useDomains();
  const { data: serverContext } = useServerContext();
  const { data: tunnelStatus } = useTunnelStatus();
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

  // Challenge type and wildcard options
  const [challengeType, setChallengeType] = useState<ChallengeType>('http-01');
  const [wildcard, setWildcard] = useState(false);
  const [dnsProvider, setDnsProvider] = useState('cloudflare');

  // Pre-flight: if server cannot do HTTP-01, auto-select DNS-01
  const canIssueHttpSsl = serverContext?.canIssueHttpSsl ?? true;
  const tunnelConfigured = serverContext?.tunnelConfigured ?? false;

  // Auto-select DNS-01 when server can't do HTTP-01
  useEffect(() => {
    if (!canIssueHttpSsl && challengeType === 'http-01') {
      setChallengeType('dns-01');
    }
  }, [canIssueHttpSsl, challengeType]);

  // DNS-01 is always required for wildcard
  useEffect(() => {
    if (wildcard && challengeType !== 'dns-01') {
      setChallengeType('dns-01');
    }
  }, [wildcard, challengeType]);

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
            dnsProvider: (wildcard || challengeType === 'dns-01') ? dnsProvider : undefined,
            challengeType: wildcard ? 'dns-01' : challengeType,
          },
          {
            onSuccess: () => { setProgressStep(ISSUANCE_STEPS.length - 1); setTimeout(onClose, 800); },
            onError: (err: any) => { setProgressError(''); setShowProgress(false); setError(err); },
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
                {/* Pre-flight warning for local servers */}
                {!canIssueHttpSsl && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-600">HTTP-01 challenge unavailable</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Your server does not appear to have a public IP. HTTP-01 challenge will not work because port 80 must be publicly reachable from the internet.
                        </p>
                        <p className="mt-2 text-xs text-yellow-600 font-medium">
                          DNS-01 challenge has been selected automatically. It works from behind NAT/firewall and uses Cloudflare API to validate domain ownership.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Challenge Type Selector */}
                <div className="rounded-lg border border-border p-4">
                  <label className="text-sm font-medium mb-3 block">Challenge Method</label>
                  <div className="space-y-3">
                    {/* HTTP-01 Option */}
                    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border ${challengeType === 'http-01' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                      <input
                        type="radio"
                        name="challengeType"
                        value="http-01"
                        checked={challengeType === 'http-01'}
                        onChange={() => setChallengeType('http-01')}
                        disabled={wildcard || !canIssueHttpSsl}
                        className="mt-0.5 h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">HTTP-01</span>
                          {!wildcard && canIssueHttpSsl && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Challenge file is served on port 80. Fast and simple.
                        </p>
                        {!canIssueHttpSsl && (
                          <p className="text-xs text-yellow-600 mt-1">
                            ⚠️ Requires port 80 publicly reachable from the internet
                          </p>
                        )}
                      </div>
                    </label>

                    {/* DNS-01 Option */}
                    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border ${challengeType === 'dns-01' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                      <input
                        type="radio"
                        name="challengeType"
                        value="dns-01"
                        checked={challengeType === 'dns-01'}
                        onChange={() => setChallengeType('dns-01')}
                        className="mt-0.5 h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">DNS-01</span>
                          <span className="rounded bg-blue-500/10 text-blue-600 px-1.5 py-0.5 text-xs">Recommended for local servers</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uses Cloudflare API to create TXT record. Works behind NAT/firewall.
                        </p>
                        {!tunnelConfigured && (
                          <div className="mt-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-2">
                            <div className="flex items-center gap-2 text-xs text-yellow-600">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>⚠️ DNS-01 requires a Cloudflare Tunnel to be configured first.</span>
                            </div>
                            <Link
                              to="/cloudflare"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              Configure Tunnel →
                            </Link>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>

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
                        Wildcard certificates require DNS-01 challenge. Your Cloudflare Tunnel must be configured.
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
              <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2">
                <StructuredErrorDisplay error={error} />
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
              disabled={isPending || !domainId || (challengeType === 'dns-01' && !tunnelConfigured)}
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
        onConfirm={() => deleteCert.mutate(cert.domainId)}
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
  const { data: expiringCerts } = useExpiringCerts(30);
  const renewCertificate = useRenewCertificate();
  const [showIssue, setShowIssue] = useState(false);
  const [selectedCert, setSelectedCert] = useState<SslCertificate | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'expiring'>('all');
  const [renewTarget, setRenewTarget] = useState<SslCertificate | null>(null);

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

  const displayCerts = view === 'expiring' ? (expiringCerts || []) : (certs || []);
  const filtered = displayCerts.filter((c: SslCertificate) =>
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

      {/* Tab Bar */}
      {expiringCerts && expiringCerts.length > 0 && (
        <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          <button
            onClick={() => setView('all')}
            className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${view === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            All Certificates
          </button>
          <button
            onClick={() => setView('expiring')}
            className={`rounded px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 ${view === 'expiring' ? 'bg-red-600 text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Expiring Soon ({expiringCerts.length})
          </button>
        </div>
      )}

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
      {!displayCerts.length ? (
        <EmptyState
          icon={ShieldCheck}
          title={view === 'expiring' ? 'No expiring certificates' : 'No certificates'}
          description={view === 'expiring' ? 'All your certificates are healthy.' : 'Issue your first SSL certificate to secure your domains.'}
          action={
            view === 'all' ? (
              <button
                onClick={() => setShowIssue(true)}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Issue Certificate
              </button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 && view === 'expiring' ? (
        <div className="py-12 text-center text-muted-foreground">
          No expiring certificates in your search results.
        </div>
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
              ? 'border-red-500/50 bg-red-500/10'
              : daysLeft !== null && daysLeft <= 7
                ? 'border-red-500/50 bg-red-500/10'
                : isExpiring
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-border bg-card';

            const badgeColor = isExpired || (daysLeft !== null && daysLeft <= 7)
              ? 'bg-red-500/10 text-red-500'
              : isExpiring
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'bg-green-500/10 text-green-500';

            return (
              <div
                key={c.id}
                className={`rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${statusColor}`}
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => setSelectedCert(c)}
                    className="flex items-center gap-2 flex-1"
                  >
                    <Lock className={`h-4 w-4 ${isExpired ? 'text-red-500' : isExpiring ? 'text-yellow-500' : 'text-green-500'}`} />
                    <span className="font-medium">{c.domain}</span>
                  </button>
                  <ActionDropdown
                    items={[
                      { label: 'View Details', icon: <Eye className="h-3.5 w-3.5" />, onClick: () => setSelectedCert(c) },
                      { label: 'Renew', icon: <RefreshCw className="h-3.5 w-3.5" />, onClick: () => setRenewTarget(c) },
                    ]}
                    className="mt-0"
                  />
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
                {view === 'expiring' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenewTarget(c); }}
                      className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      <RefreshCw className="h-3 w-3" /> Renew Now
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Issue modal */}
      {showIssue && <IssueModal onClose={() => setShowIssue(false)} />}

      {/* Renew confirm dialog */}
      <ConfirmDialog
        open={!!renewTarget}
        onConfirm={() => {
          if (renewTarget) {
            renewCertificate.mutate(renewTarget.domainId, {
              onSuccess: () => toast.success(`Renewal started for ${renewTarget.domain}`),
              onError: (e: Error) => toast.error(e.message || 'Failed to start renewal'),
            });
          }
          setRenewTarget(null);
        }}
        onCancel={() => setRenewTarget(null)}
        title="Renew SSL Certificate"
        message={`Start the SSL renewal process for "${renewTarget?.domain}"? This will run in the background.`}
        confirmText="Renew"
        variant="warning"
      />
    </div>
  );
}
