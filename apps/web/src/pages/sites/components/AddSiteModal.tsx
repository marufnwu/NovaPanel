/**
 * AddSiteModal - 2-step site creation flow
 *
 * Step 1: Domain name + DNS verification
 * Step 2: Intent selection (Host a website / Redirect) + configuration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Modal } from '../../../components/ui/Modal';
import { useDnsVerification } from '../../../hooks/useDnsVerification';
import { useCreateSite } from '../../../api/hooks/sites';
import { useTunnelStatus } from '../../../api/hooks/tunnel';
import {
  Globe,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Server,
  Globe2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AddSiteModalProps {
  open: boolean;
  onClose: () => void;
}

type Intent = 'website' | 'redirect';

interface Step1State {
  domainName: string;
  skipDns: boolean;
}

interface Step2State {
  intent: Intent;
  documentRoot: string;
  phpVersion: string;
  phpHandler: string;
  webServer: string;
  redirectToUrl: string;
  redirectType: '301' | '302';
  createDnsZone: boolean;
  enableMail: boolean;
  makePublic: boolean;
  tunnelId: string;
}

export function AddSiteModal({ open, onClose }: AddSiteModalProps) {
  const navigate = useNavigate();
  const createSite = useCreateSite();

  const [step, setStep] = useState<1 | 2>(1);
  const [dnsVerified, setDnsVerified] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [dnsChecking, setDnsChecking] = useState(false);

  const [step1, setStep1] = useState<Step1State>({
    domainName: '',
    skipDns: false,
  });

  const [step2, setStep2] = useState<Step2State>({
    intent: 'website',
    documentRoot: '',
    phpVersion: '',
    phpHandler: 'php-fpm',
    webServer: 'nginx',
    redirectToUrl: '',
    redirectType: '301',
    createDnsZone: false,
    enableMail: false,
    makePublic: false,
    tunnelId: '',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const dnsVerification = useDnsVerification({
    onSuccess: (data) => {
      setDnsChecking(false);
      if (data.pointsToServer) {
        setDnsVerified(true);
        setDnsError(null);
      } else {
        setDnsVerified(false);
        setDnsError(
          data.error || `DNS does not point to server IP. Current: ${data.resolvesTo?.join(', ') || 'unknown'}`
        );
      }
    },
    onError: (err) => {
      setDnsChecking(false);
      setDnsVerified(false);
      setDnsError(err.message || 'Failed to verify DNS');
    },
  });

  // Fetch tunnels for the tunnel selector
  const { data: tunnelStatus } = useTunnelStatus();
  const tunnels = tunnelStatus?.tunnels || [];

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setDnsVerified(false);
      setDnsError(null);
      setStep1({ domainName: '', skipDns: false });
      setStep2({
        intent: 'website',
        documentRoot: '',
        phpVersion: '',
        phpHandler: 'php-fpm',
        webServer: 'nginx',
        redirectToUrl: '',
        redirectType: '301',
        createDnsZone: false,
        enableMail: false,
        makePublic: false,
        tunnelId: '',
      });
    }
  }, [open]);

  // Update document root when domain name changes
  useEffect(() => {
    if (step1.domainName && step2.documentRoot === '') {
      setStep2((s) => ({
        ...s,
        documentRoot: `/var/www/${step1.domainName}`,
      }));
    }
  }, [step1.domainName]);

  const handleDomainBlur = () => {
    if (step1.domainName && !step1.skipDns) {
      setDnsChecking(true);
      dnsVerification.mutate(step1.domainName);
    }
  };

  const handleStep1Continue = () => {
    if (!step1.domainName) return;
    setStep(2);
  };

  const handleStep2Back = () => {
    setStep(1);
  };

  const handleCreate = async () => {
    if (!step1.domainName) return;

    const baseInput = {
      name: step1.domainName,
      skipDnsVerification: step1.skipDns,
      createDnsZone: step2.createDnsZone,
      enableMail: step2.enableMail,
      makePublic: step2.makePublic,
      tunnelId: step2.tunnelId || undefined,
    };

    let siteId: string;

    if (step2.intent === 'website') {
      siteId = await createSite.mutateAsync({
        ...baseInput,
        createWebsite: true,
        documentRoot: step2.documentRoot || undefined,
        phpVersion: step2.phpVersion || undefined,
        phpHandler: step2.phpHandler || undefined,
        webServer: step2.webServer || undefined,
      });
    } else {
      // For redirect sites, pass redirect target
      siteId = await createSite.mutateAsync({
        ...baseInput,
        createWebsite: false,
        redirectUrl: step2.redirectToUrl,
        redirectType: step2.redirectType as '301' | '302',
      });
    }

    onClose();
    navigate({ to: '/sites/$siteId', params: { siteId } });
  };

  const canContinueStep1 =
    step1.domainName && (step1.skipDns || dnsVerified);
  const canCreate = step1.domainName && (step2.intent === 'redirect' || step2.intent === 'website');

  return (
    <Modal open={open} onClose={onClose} title="Add Site" size="lg">
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              step >= 1
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Globe className="h-4 w-4" />
            1. Domain
          </div>
          <div className="h-px flex-1 bg-border" />
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              step >= 2
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Server className="h-4 w-4" />
            2. Configuration
          </div>
        </div>

        {/* Step 1: Domain name */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Domain name</label>
              <div className="relative">
                <input
                  type="text"
                  value={step1.domainName}
                  onChange={(e) => {
                    setStep1((s) => ({ ...s, domainName: e.target.value }))
                    setDnsVerified(false)
                    setDnsError(null)
                  }}
                  onBlur={handleDomainBlur}
                  placeholder="example.com"
                  className="w-full rounded-md border border-input bg-background px-4 py-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {dnsChecking ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : dnsVerified ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : step1.domainName && !step1.skipDns ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : null}
                </div>
              </div>
              {dnsError && (
                <p className="mt-2 flex items-center gap-1 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {dnsError}
                </p>
              )}
              {dnsVerified && (
                <p className="mt-2 flex items-center gap-1 text-sm text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  DNS verified — domain points to server
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={step1.skipDns}
                onChange={(e) =>
                  setStep1((s) => ({ ...s, skipDns: e.target.checked }))
                }
                className="rounded border-input"
              />
              <span className="text-muted-foreground">I'll set up DNS later</span>
            </label>
          </div>
        )}

        {/* Step 2: Intent + configuration */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Intent cards */}
            <div>
              <label className="mb-3 block text-sm font-medium">What does this site do?</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setStep2((s) => ({ ...s, intent: 'website' }))}
                  className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors ${
                    step2.intent === 'website'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Server className="h-8 w-8 text-primary" />
                  <span className="font-medium">Host a website</span>
                  <span className="text-xs text-muted-foreground">
                    PHP, static files, web server
                  </span>
                </button>
                <button
                  onClick={() => setStep2((s) => ({ ...s, intent: 'redirect' }))}
                  className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors ${
                    step2.intent === 'redirect'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Globe2 className="h-8 w-8 text-primary" />
                  <span className="font-medium">Redirect</span>
                  <span className="text-xs text-muted-foreground">
                    Forward traffic to another URL
                  </span>
                </button>
              </div>
            </div>

            {/* Website configuration */}
            {step2.intent === 'website' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Document root</label>
                  <input
                    type="text"
                    value={step2.documentRoot}
                    onChange={(e) =>
                      setStep2((s) => ({ ...s, documentRoot: e.target.value }))
                    }
                    placeholder={`/var/www/${step1.domainName}`}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">PHP version</label>
                    <select
                      value={step2.phpVersion}
                      onChange={(e) =>
                        setStep2((s) => ({ ...s, phpVersion: e.target.value }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Server default</option>
                      <option value="8.1">PHP 8.1</option>
                      <option value="8.2">PHP 8.2</option>
                      <option value="8.3">PHP 8.3</option>
                      <option value="8.4">PHP 8.4</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">PHP handler</label>
                    <select
                      value={step2.phpHandler}
                      onChange={(e) =>
                        setStep2((s) => ({ ...s, phpHandler: e.target.value }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="php-fpm">PHP-FPM</option>
                      <option value="cgi">CGI</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Web server</label>
                    <select
                      value={step2.webServer}
                      onChange={(e) =>
                        setStep2((s) => ({ ...s, webServer: e.target.value }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="nginx">Nginx</option>
                      <option value="apache">Apache</option>
                      <option value="nginx+apache">Nginx + Apache</option>
                    </select>
                  </div>
                </div>

                {/* Advanced options */}
                <div className="border-t border-border pt-4">
                  <button
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Advanced options
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step2.createDnsZone}
                          onChange={(e) =>
                            setStep2((s) => ({ ...s, createDnsZone: e.target.checked }))
                          }
                          className="rounded border-input"
                        />
                        Create DNS zone automatically
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step2.enableMail}
                          onChange={(e) =>
                            setStep2((s) => ({ ...s, enableMail: e.target.checked }))
                          }
                          className="rounded border-input"
                        />
                        Enable mail for this domain
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step2.makePublic}
                          onChange={(e) =>
                            setStep2((s) => ({ ...s, makePublic: e.target.checked }))
                          }
                          className="rounded border-input"
                        />
                        Make publicly accessible via Cloudflare Tunnel
                      </label>
                      {step2.makePublic && (
                        <div className="pl-6">
                          <label className="mb-1 block text-sm font-medium">Tunnel</label>
                          <select
                            value={step2.tunnelId}
                            onChange={(e) =>
                              setStep2((s) => ({ ...s, tunnelId: e.target.value }))
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Select a tunnel...</option>
                            {tunnels.map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Redirect configuration */}
            {step2.intent === 'redirect' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Redirect to URL</label>
                  <input
                    type="url"
                    value={step2.redirectToUrl}
                    onChange={(e) =>
                      setStep2((s) => ({ ...s, redirectToUrl: e.target.value }))
                    }
                    placeholder="https://example.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Redirect type</label>
                  <select
                    value={step2.redirectType}
                    onChange={(e) =>
                      setStep2((s) => ({ ...s, redirectType: e.target.value as '301' | '302' }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="301">301 Permanent</option>
                    <option value="302">302 Temporary</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between border-t border-border pt-4">
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleStep1Continue}
                disabled={!canContinueStep1}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleStep2Back}
                className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreate || createSite.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createSite.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>Create →</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}