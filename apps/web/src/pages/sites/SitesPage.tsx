import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useSites,
  useSite,
  type Site,
} from '../../api/hooks/sites';
import {
  useDomains,
  useCreateDomain,
  useDeleteDomain,
  useSuspendDomain,
  useActivateDomain,
  useBulkSuspendDomains,
  useBulkActivateDomains,
  useBulkDeleteDomains,
  useVerifyDomainDns,
  type DomainDnsVerification,
  type CreateDomainInput,
} from '../../api/hooks/domains';
import {
  useWebsites,
  useCreateWebsite,
} from '../../api/hooks/websites';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import { useServerContext } from '../../api/hooks/settings';
import { useCloudflareConfig, useTunnelStatus } from '../../api/hooks/tunnel';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { SiteCard } from '../../components/sites/SiteCard';
import {
  Globe, Plus, Trash2, Ban, CheckCircle, X, Search,
  Server, ExternalLink, Link2, AlertTriangle, Shield,
  Activity, FileText, Mail, RefreshCw, Globe2, CheckCircle2,
  XCircle, Info, Cloud, ChevronRight, ArrowRight, Loader2,
} from 'lucide-react';
import type { ApiError } from '../../api/client';
import { toast } from '../../lib/toast';
import {
  checkAnyDomainConflict,
  checkSubdomainAvailability,
  type DomainConflictResult,
} from '../../lib/domainConflicts';

// ============================================================================
// Types
// ============================================================================

interface SiteFormData {
  // Domain creation path: 'own-domain' | 'subdomain'
  domainPath: 'own-domain' | 'subdomain';
  // Own domain fields
  ownDomain: string;
  // Subdomain fields
  subdomainPrefix: string;
  subdomainParentId: string;
  // DNS verification
  skipDnsVerification: boolean;
  // Common fields
  documentRoot: string;
  phpVersion: string;
  phpHandler: string;
  webServer: string;
  createDns: boolean;
  createMail: boolean;
  websiteMode: 'none' | 'create' | 'existing';
  websiteId: string;
  makePublic: boolean;
  tunnelId: string;
}

const PHP_HANDLERS = [
  { value: 'php-fpm', label: 'PHP-FPM' },
  { value: 'cgi', label: 'CGI' },
  { value: 'disabled', label: 'Disabled' },
];

const WEBSERVER_TYPES = [
  { value: 'nginx', label: 'Nginx Only' },
  { value: 'apache', label: 'Apache Only' },
  { value: 'nginx+apache', label: 'Nginx + Apache' },
];

// ============================================================================
// AddSiteModal - 2-step modal for creating a site
// Step 1: Domain info + DNS verification
// Step 2: Website configuration (optional)
// ============================================================================

interface AddSiteModalProps {
  onClose: () => void;
}

export function AddSiteModal({ onClose }: AddSiteModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const createDomain = useCreateDomain();
  const createWebsite = useCreateWebsite();
  const { data: phpData, isLoading: phpLoading } = usePhpVersions();
  const { data: cloudflareConfig } = useCloudflareConfig();
  const { data: tunnelStatus } = useTunnelStatus();
  const { data: serverContext } = useServerContext();
  const verifyDns = useVerifyDomainDns();
  const { data: websites } = useWebsites();
  const { data: allDomains } = useDomains();

  const phpVersions = (phpData?.versions?.length
    ? phpData.versions.map((v: any) => typeof v === 'string' ? v : v.version)
    : DEFAULT_PHP_VERSIONS);

  const cfConfig = cloudflareConfig && 'apiToken' in cloudflareConfig ? cloudflareConfig : null;
  const hasCloudflareConfig = !!(cfConfig?.apiToken);
  const hasActiveTunnel = tunnelStatus?.processRunning && tunnelStatus?.tunnels?.length > 0;
  const showMakePublic = hasCloudflareConfig && hasActiveTunnel;

  const [form, setForm] = useState<SiteFormData>({
    domainPath: 'own-domain',
    ownDomain: '',
    subdomainPrefix: '',
    subdomainParentId: '',
    skipDnsVerification: false,
    documentRoot: '',
    phpVersion: phpVersions[0] || '8.1',
    phpHandler: 'php-fpm',
    webServer: 'nginx+apache',
    createDns: true,
    createMail: true,
    websiteMode: 'create',
    websiteId: '',
    makePublic: !!showMakePublic,
    tunnelId: '',
  });

  const [dnsVerification, setDnsVerification] = useState<DomainDnsVerification | null>(null);
  const [showDnsGuidance, setShowDnsGuidance] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  
  // Domain conflict checking state
  const [domainConflict, setDomainConflict] = useState<DomainConflictResult | null>(null);
  const [subdomainConflict, setSubdomainConflict] = useState<DomainConflictResult | null>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  // Get the final domain name based on path
  const getDomainName = () => {
    if (form.domainPath === 'own-domain') {
      return form.ownDomain;
    }
    const parent = allDomains?.find(d => d.id === form.subdomainParentId);
    return parent ? `${form.subdomainPrefix}.${parent.name}` : '';
  };

  // Set default tunnel when cloudflare config loads
  useState(() => {
    if (showMakePublic && !form.tunnelId && tunnelStatus?.tunnels?.length) {
      const activeTunnel = tunnelStatus.tunnels.find(t => t.status === 'active');
      if (activeTunnel) {
        setForm(f => ({ ...f, tunnelId: activeTunnel.id }));
      }
    }
  });

  const autoDocRoot = getDomainName() ? `/var/www/vhosts/${getDomainName()}/httpdocs` : '';

  // Verify DNS when own domain loses focus
  const handleOwnDomainBlur = async () => {
    if (form.ownDomain && !form.skipDnsVerification) {
      try {
        const result = await verifyDns.mutateAsync(form.ownDomain);
        setDnsVerification(result);
      } catch (err) {
        console.error('DNS verification failed:', err);
      }
    }
    
    // Also check for domain conflicts
    if (form.ownDomain) {
      setIsCheckingConflict(true);
      try {
        const conflict = await checkAnyDomainConflict(form.ownDomain);
        setDomainConflict(conflict);
      } catch (err) {
        console.error('Domain conflict check failed:', err);
        setDomainConflict(null);
      } finally {
        setIsCheckingConflict(false);
      }
    } else {
      setDomainConflict(null);
    }
  };
  
  // Check for subdomain conflicts when subdomain prefix loses focus
  const handleSubdomainBlur = async () => {
    const parent = allDomains?.find(d => d.id === form.subdomainParentId);
    if (form.subdomainPrefix && parent) {
      setIsCheckingConflict(true);
      try {
        const conflict = await checkSubdomainAvailability(form.subdomainPrefix, parent.name);
        setSubdomainConflict(conflict);
      } catch (err) {
        console.error('Subdomain conflict check failed:', err);
        setSubdomainConflict(null);
      } finally {
        setIsCheckingConflict(false);
      }
    } else {
      setSubdomainConflict(null);
    }
  };

  // For own-domain path: DNS must be verified or skipped
  // For subdomain path: no DNS verification needed, proceed immediately
  const isDnsReady = form.domainPath === 'subdomain' 
    ? true  // Subdomain auto-configures DNS on server
    : (form.skipDnsVerification || (dnsVerification && dnsVerification.pointsToServer));

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.websiteMode === 'none' || isDnsReady) {
      setStep(2);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleSubmit = () => {
    const domainName = getDomainName();
    
    if (form.domainPath === 'subdomain') {
      // Subdomain path: create as subdomain of parent
      const parentDomain = allDomains?.find(d => d.id === form.subdomainParentId);
      if (!parentDomain) {
        toast.error('Please select a parent domain');
        return;
      }
      
      const domainPayload: CreateDomainInput = {
        name: domainName,
        documentRoot: form.documentRoot || undefined,
        phpVersion: form.websiteMode === 'create' ? form.phpVersion : undefined,
        phpHandler: form.websiteMode === 'create' ? form.phpHandler : undefined,
        webServer: form.websiteMode === 'create' ? form.webServer : undefined,
        createDns: form.createDns,
        createMail: form.createMail,
        websiteMode: form.websiteMode,
        websiteId: form.websiteMode === 'existing' ? form.websiteId : undefined,
        makePublic: showMakePublic ? form.makePublic : undefined,
        tunnelId: showMakePublic && form.makePublic && form.tunnelId ? form.tunnelId : undefined,
        type: 'subdomain',
        parentDomainId: form.subdomainParentId,
        // For subdomains, DNS is created automatically on the parent's zone
        skipDnsVerification: true,
      };

      createDomain.mutate(domainPayload, {
        onSuccess: (domain) => {
          if (form.websiteMode === 'create') {
            const websitePayload = {
              name: domainName,
              documentRoot: form.documentRoot || `/var/www/vhosts/${domainName}/httpdocs`,
              phpVersion: form.phpVersion,
              phpHandler: form.phpHandler,
              webServer: form.webServer,
            };
            createWebsite.mutate(websitePayload, {
              onSuccess: () => {
                toast.success(`Site "${domainName}" created successfully`);
                onClose();
              },
              onError: (err: Error) => {
                toast.error('Domain created but website creation failed: ' + err.message);
                onClose();
              },
            });
          } else {
            toast.success(`Site "${domainName}" created successfully`);
            onClose();
          }
        },
        onError: (err: Error) => {
          setError(err as ApiError);
          toast.error(err.message || 'Failed to create site');
        },
      });
    } else {
      // Own domain path
      const domainPayload: CreateDomainInput = {
        name: domainName,
        documentRoot: form.documentRoot || undefined,
        phpVersion: form.websiteMode === 'create' ? form.phpVersion : undefined,
        phpHandler: form.websiteMode === 'create' ? form.phpHandler : undefined,
        webServer: form.websiteMode === 'create' ? form.webServer : undefined,
        createDns: form.createDns,
        createMail: form.createMail,
        websiteMode: form.websiteMode,
        websiteId: form.websiteMode === 'existing' ? form.websiteId : undefined,
        makePublic: showMakePublic ? form.makePublic : undefined,
        tunnelId: showMakePublic && form.makePublic && form.tunnelId ? form.tunnelId : undefined,
        skipDnsVerification: form.skipDnsVerification,
      };

      createDomain.mutate(domainPayload, {
        onSuccess: (domain) => {
          if (form.websiteMode === 'create') {
            const websitePayload = {
              name: domainName,
              documentRoot: form.documentRoot || `/var/www/vhosts/${domainName}/httpdocs`,
              phpVersion: form.phpVersion,
              phpHandler: form.phpHandler,
              webServer: form.webServer,
            };
            createWebsite.mutate(websitePayload, {
              onSuccess: () => {
                toast.success(`Site "${domainName}" created successfully`);
                onClose();
              },
              onError: (err: Error) => {
                toast.error('Domain created but website creation failed: ' + err.message);
                onClose();
              },
            });
          } else {
            toast.success(`Site "${domainName}" created successfully`);
            onClose();
          }
        },
        onError: (err: Error) => {
          setError(err as ApiError);
          toast.error(err.message || 'Failed to create site');
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Add New Site</h2>
              <p className="text-sm text-muted-foreground">
                Step {step} of 2: {step === 1 ? 'Domain Information' : 'Website Configuration'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 border-b border-border px-4 py-3">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`flex items-center gap-2 text-sm ${
                s === step ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                s < step ? 'bg-primary text-primary-foreground' :
                s === step ? 'border-2 border-primary text-primary' :
                'border border-border text-muted-foreground'
              }`}>
                {s < step ? <CheckCircle className="h-3.5 w-3.5" /> : s}
              </div>
              <span>{s === 1 ? 'Domain' : 'Website'}</span>
              {s < 2 && <ChevronRight className="h-3 w-3" />}
            </div>
          ))}
        </div>

        <form onSubmit={step === 1 ? handleStep1Submit : handleStep2Submit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <strong>Error:</strong> {error.message}
            </div>
          )}

          {/* Step 1: Domain Information - Two Paths */}
          {step === 1 && (
            <>
              <div>
                <label className="mb-3 block text-sm font-medium">How do you want to identify your site?</label>
                <div className="flex flex-col gap-3">
                  
                  {/* Own Domain Option */}
                  <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                    form.domainPath === 'own-domain' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-accent/50'
                  }`}>
                    <input
                      type="radio"
                      name="domainPath"
                      value="own-domain"
                      checked={form.domainPath === 'own-domain'}
                      onChange={() => {
                        setForm({ ...form, domainPath: 'own-domain' });
                        setDnsVerification(null);
                      }}
                      className="mt-1 h-4 w-4 border-input text-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Use my own domain</span>
                      </div>
                      
                      {form.domainPath === 'own-domain' && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <input
                              placeholder="example.com"
                              value={form.ownDomain}
                              onChange={(e) => {
                                setForm({ ...form, ownDomain: e.target.value });
                                setDnsVerification(null);
                              }}
                              onBlur={handleOwnDomainBlur}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                          </div>
                          
                          {/* DNS Verification Status for Own Domain */}
                          {dnsVerification && (
                            <div className={`rounded-lg border p-3 ${
                              dnsVerification.pointsToServer
                                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                            }`}>
                              <div className="flex items-start gap-2">
                                {dnsVerification.pointsToServer ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <h5 className={`text-sm font-medium ${
                                    dnsVerification.pointsToServer ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                  }`}>
                                    {dnsVerification.pointsToServer ? 'DNS Verified' : 'Not pointing here yet'}
                                  </h5>
                                  
                                  {!dnsVerification.pointsToServer && (
                                    <div className="mt-2 space-y-2">
                                      <p className="text-xs text-muted-foreground">
                                        Your server IP: <strong className="font-mono">{dnsVerification.serverIp}</strong>
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          id="skipDnsOwn"
                                          checked={form.skipDnsVerification}
                                          onChange={(e) => setForm({ ...form, skipDnsVerification: e.target.checked })}
                                          className="h-4 w-4 rounded border-input text-primary"
                                        />
                                        <label htmlFor="skipDnsOwn" className="text-sm">I'll configure DNS later</label>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {!dnsVerification.pointsToServer && dnsVerification.resolvesTo.length > 0 && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Currently resolves to: {dnsVerification.resolvesTo.join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Domain Conflict Status */}
                          {domainConflict && !domainConflict.available && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                              <div className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                <div className="flex-1">
                                  <h5 className="text-sm font-medium text-red-700 dark:text-red-400">
                                    Domain already in use
                                  </h5>
                                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                    {domainConflict.reason}
                                    {domainConflict.siteName && (
                                      <span> — {domainConflict.siteName}</span>
                                    )}
                                  </p>
                                  {domainConflict.conflictType === 'site' && domainConflict.siteId && (
                                    <Link
                                      to="/sites/:siteId"
                                      params={{ siteId: domainConflict.siteId }}
                                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      View site <ArrowRight className="h-3 w-3" />
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {isCheckingConflict && form.ownDomain && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Checking domain availability...</span>
                            </div>
                          )}
                          
                          {/* DNS Setup Instructions Toggle */}
                          {!dnsVerification && form.ownDomain && (
                            <button
                              type="button"
                              onClick={() => setShowDnsGuidance(!showDnsGuidance)}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <Info className="h-3.5 w-3.5" />
                              {showDnsGuidance ? 'Hide' : 'Show'} DNS setup instructions
                            </button>
                          )}
                          
                          {showDnsGuidance && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20 text-xs">
                              <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Add this A record at your registrar:</p>
                              <div className="font-mono space-y-0.5 text-muted-foreground">
                                <p><strong>Type:</strong> A</p>
                                <p><strong>Name:</strong> @ (or leave blank)</p>
                                <p><strong>Value:</strong> {serverContext?.primaryIp || 'YOUR_SERVER_IP'}</p>
                                <p><strong>TTL:</strong> 3600 (or Auto)</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                  
                  {/* Subdomain Option */}
                  <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                    form.domainPath === 'subdomain' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-accent/50'
                  }`}>
                    <input
                      type="radio"
                      name="domainPath"
                      value="subdomain"
                      checked={form.domainPath === 'subdomain'}
                      onChange={() => {
                        setForm({ ...form, domainPath: 'subdomain', skipDnsVerification: true });
                        setDnsVerification(null);
                      }}
                      className="mt-1 h-4 w-4 border-input text-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Host on a subdomain</span>
                      </div>
                      
                      {form.domainPath === 'subdomain' && (
                        <div className="mt-3 space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1 flex rounded-md border border-input bg-background">
                              <input
                                placeholder="staging"
                                value={form.subdomainPrefix}
                                onChange={(e) => setForm({ ...form, subdomainPrefix: e.target.value })}
                                onBlur={handleSubdomainBlur}
                                className="flex-1 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded-l-md"
                                autoFocus
                              />
                              <span className="flex items-center px-2 text-sm text-muted-foreground border-l border-input bg-muted/50">.</span>
                              <select
                                value={form.subdomainParentId}
                                onChange={(e) => setForm({ ...form, subdomainParentId: e.target.value })}
                                className="flex-1 px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded-r-md bg-transparent"
                                required
                              >
                                <option value="">Select domain</option>
                                {allDomains?.map((d) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>DNS will be configured automatically</span>
                          </div>
                          
                          {/* Subdomain Conflict Status */}
                          {subdomainConflict && !subdomainConflict.available && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                              <div className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                <div className="flex-1">
                                  <h5 className="text-sm font-medium text-red-700 dark:text-red-400">
                                    Subdomain already in use
                                  </h5>
                                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                    {subdomainConflict.reason}
                                    {subdomainConflict.siteName && (
                                      <span> — {subdomainConflict.siteName}</span>
                                    )}
                                  </p>
                                  {subdomainConflict.conflictType === 'site' && subdomainConflict.siteId && (
                                    <Link
                                      to="/sites/:siteId"
                                      params={{ siteId: subdomainConflict.siteId }}
                                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      View site <ArrowRight className="h-3 w-3" />
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {isCheckingConflict && form.subdomainPrefix && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Checking subdomain availability...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Website Mode Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium">Website Configuration</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50">
                    <input
                      type="radio"
                      name="websiteMode"
                      value="create"
                      checked={form.websiteMode === 'create'}
                      onChange={() => setForm({ ...form, websiteMode: 'create' })}
                      className="h-4 w-4 border-input text-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">Create new website</span>
                      <p className="text-xs text-muted-foreground">Automatically create a website and link this domain to it</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50">
                    <input
                      type="radio"
                      name="websiteMode"
                      value="existing"
                      checked={form.websiteMode === 'existing'}
                      onChange={() => setForm({ ...form, websiteMode: 'existing' })}
                      className="h-4 w-4 border-input text-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">Link to existing website</span>
                      <p className="text-xs text-muted-foreground">Attach this domain to an already existing website</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50">
                    <input
                      type="radio"
                      name="websiteMode"
                      value="none"
                      checked={form.websiteMode === 'none'}
                      onChange={() => setForm({ ...form, websiteMode: 'none' })}
                      className="h-4 w-4 border-input text-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">No website (DNS only)</span>
                      <p className="text-xs text-muted-foreground">Create the domain for DNS/mail only, without a website</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Website selector when linking to existing */}
              {form.websiteMode === 'existing' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Select Website</label>
                  <select
                    value={form.websiteId}
                    onChange={(e) => setForm({ ...form, websiteId: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">— Select a website —</option>
                    {websites?.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.createDns}
                    onChange={(e) => setForm({ ...form, createDns: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Create DNS zone</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.createMail}
                    onChange={(e) => setForm({ ...form, createMail: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Enable mail domain</span>
                </label>
              </div>
            </>
          )}

          {/* Step 2: Website Configuration */}
          {step === 2 && form.websiteMode === 'create' && (
            <>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getDomainName()}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure the website that will be linked to this domain.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Document Root</label>
                <input
                  placeholder={autoDocRoot || '/var/www/vhosts/{domain}/httpdocs'}
                  value={form.documentRoot}
                  onChange={(e) => setForm({ ...form, documentRoot: e.target.value })}
                  className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">Leave empty for default: {autoDocRoot || '...'}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">PHP Version</label>
                  <select
                    value={form.phpVersion}
                    onChange={(e) => setForm({ ...form, phpVersion: e.target.value })}
                    disabled={phpLoading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    {phpLoading ? (
                      <option value="">Loading versions...</option>
                    ) : phpVersions.length === 0 ? (
                      <option value="">No PHP versions installed</option>
                    ) : (
                      phpVersions.map((v) => (
                        <option key={v} value={v}>PHP {v}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">PHP Handler</label>
                  <select
                    value={form.phpHandler}
                    onChange={(e) => setForm({ ...form, phpHandler: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {PHP_HANDLERS.map((h) => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Web Server</label>
                  <select
                    value={form.webServer}
                    onChange={(e) => setForm({ ...form, webServer: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {WEBSERVER_TYPES.map((ws) => (
                      <option key={ws.value} value={ws.value}>{ws.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cloudflare Auto-Public Section */}
              {showMakePublic && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 space-y-3 dark:border-orange-800 dark:bg-orange-900/20">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Internet Access</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.makePublic}
                      onChange={(e) => setForm({ ...form, makePublic: e.target.checked })}
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span className="text-sm">Make this site publicly accessible via Cloudflare Tunnel</span>
                  </label>
                  {form.makePublic && (
                    <div className="pl-6 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Tunnel</label>
                        <select
                          value={form.tunnelId}
                          onChange={(e) => setForm({ ...form, tunnelId: e.target.value })}
                          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="">Auto-select tunnel</option>
                          {tunnelStatus?.tunnels?.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && form.websiteMode === 'none' && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">DNS-only Mode</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                This domain will be created without a linked website. You can add a website later or link it to an existing one.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-border">
            <div>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  step === 1
                    ? (form.domainPath === 'own-domain' 
                        ? (!form.ownDomain || !isDnsReady || (form.websiteMode === 'existing' && !form.websiteId))
                        : (!form.subdomainPrefix || !form.subdomainParentId || (form.websiteMode === 'existing' && !form.websiteId)))
                    : (createDomain.isPending || createWebsite.isPending)
                }
                className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {step === 1
                  ? 'Next: Configure Website'
                  : (createDomain.isPending || createWebsite.isPending)
                    ? 'Creating...'
                    : 'Create Site'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main SitesPage Component
// ============================================================================

export function SitesPage() {
  const { data: sites, isLoading, isError, refetch } = useSites();
  const deleteDomain = useDeleteDomain();
  const suspendDomain = useSuspendDomain();
  const activateDomain = useActivateDomain();
  const bulkSuspend = useBulkSuspendDomains();
  const bulkActivate = useBulkActivateDomains();
  const bulkDelete = useBulkDeleteDomains();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Site | null>(null);
  const [activateTarget, setActivateTarget] = useState<Site | null>(null);

  // Filter sites by search
  const filtered = sites?.filter(site =>
    site.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    deleteDomain.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(`Site "${name}" deleted`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to delete site');
      },
    });
  };

  const handleSuspend = () => {
    if (!suspendTarget) return;
    const name = suspendTarget.name;
    suspendDomain.mutate(suspendTarget.id, {
      onSuccess: () => {
        setSuspendTarget(null);
        toast.success(`Site "${name}" suspended`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to suspend site');
      },
    });
  };

  const handleActivate = () => {
    if (!activateTarget) return;
    const name = activateTarget.name;
    activateDomain.mutate(activateTarget.id, {
      onSuccess: () => {
        setActivateTarget(null);
        toast.success(`Site "${name}" activated`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to activate site');
      },
    });
  };

  const handleBulkSuspend = () => {
    if (selectedIds.size === 0) return;
    bulkSuspend.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        toast.success(`${selectedIds.size} sites suspended`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to suspend sites');
      },
    });
  };

  const handleBulkActivate = () => {
    if (selectedIds.size === 0) return;
    bulkActivate.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        toast.success(`${selectedIds.size} sites activated`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to activate sites');
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        toast.success(`${selectedIds.size} sites deleted`);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to delete sites');
      },
    });
  };

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div>
        <PageHeader title="Sites" description="Manage your sites" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load sites</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching sites. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Manage your domains and websites in one place"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Site
          </button>
        }
      />

      {/* Search and Bulk Actions */}
      {sites && sites.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedIds.size} selected</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-primary hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {!sites || sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Create your first site to get started. A site combines a domain with optional website configuration."
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Site
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results"
          description={`No sites found matching "${search}"`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              selected={selectedIds.has(site.id)}
              onSelect={() => handleToggleSelect(site.id)}
              onDelete={() => setDeleteTarget(site)}
              onSuspend={() => setSuspendTarget(site)}
              onActivate={() => setActivateTarget(site)}
            />
          ))}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={handleBulkSuspend}
            disabled={bulkSuspend.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" /> Suspend
          </button>
          <button
            onClick={handleBulkActivate}
            disabled={bulkActivate.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Activate
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Add Site Modal */}
      {showAddModal && <AddSiteModal onClose={() => setShowAddModal(false)} />}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Site"
          message={`This will permanently delete "${deleteTarget.name}" and all associated configuration. This action cannot be undone.`}
          variant="danger"
          requireTyping={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Suspend Confirmation */}
      {suspendTarget && (
        <ConfirmDialog
          open={true}
          title="Suspend Site"
          message={`This will suspend "${suspendTarget.name}". All associated domains will become unavailable and visitors will see an error page.`}
          variant="warning"
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

      {/* Activate Confirmation */}
      {activateTarget && (
        <ConfirmDialog
          open={true}
          title="Activate Site"
          message={`This will activate "${activateTarget.name}" and bring it back online.`}
          variant="info"
          onConfirm={handleActivate}
          onCancel={() => setActivateTarget(null)}
        />
      )}
    </div>
  );
}
