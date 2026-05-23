import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { SectionHeader } from '@/components/design-system/SectionHeader';
import { useServerContext } from '../../api/hooks/settings';
import {
  useServerIdentity,
  useUpdateServerIdentity,
  useTimezone,
  useAvailableTimezones,
  useUpdateTimezone,
  useBackupSettings,
  useUpdateBackupSettings,
  useSecuritySettings,
  useUpdateSshPort,
  useSystemUpdates,
  useCheckForUpdates,
  usePanelSettings,
  useUpdatePanelSettings,
  useNameserverSettings,
  useUpdateNameserverSettings,
  useVerifyNameserverDomain,
  useSessionSettings,
  useUpdateSessionSettings,
  usePasswordPolicy,
  useUpdatePasswordPolicy,
  useSystemInfo,
  usePanelPort,
  useUpdatePanelPort,
  useDefaultWebServer,
  useUpdateDefaultWebServer,
  useSslEmail,
  useUpdateSslEmail,
  usePhpVersion,
  useUpdatePhpVersion,
  useRebootServer,
  useShutdownServer,
  useMaintenanceMode,
  useUpdateMaintenanceMode,
  useExportConfig,
  useImportConfig,
  useDataRetention,
  useUpdateDataRetention,
  useSmtpSettings,
  useUpdateSmtpSettings,
  useSendTestEmail,
} from '../../api/hooks/settings';
import { usePhpVersions, DEFAULT_PHP_VERSIONS } from '../../api/hooks/php';
import {
  Server,
  Clock,
  Shield,
  Download,
  RefreshCw,
  Save,
  Globe,
  Mail,
  Code2,
  Network,
  Lock,
  Info,
  CheckCircle2,
  XCircle,
  Power,
  AlertTriangle,
  X,
  Upload,
  FileDown,
  Wrench,
  Database,
  HardDrive,
} from 'lucide-react';

// ─── Reusable primitives ──────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Server;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SaveButton({
  onClick,
  disabled,
  isPending,
}: {
  onClick: () => void;
  disabled?: boolean;
  isPending?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      <Save className="h-4 w-4" />
      {isPending ? 'Saving...' : 'Save'}
    </button>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        enabled ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onClose,
  isPending,
  requireTyping,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
  requireTyping?: string;
}) {
  const [typedValue, setTypedValue] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {requireTyping && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">
              Type <span className="font-mono font-semibold">{requireTyping}</span> to confirm
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={requireTyping}
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || !!(requireTyping && typedValue !== requireTyping)}
            className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 ${
              confirmClass || 'bg-red-600 hover:bg-red-600/90'
            }`}
          >
            {isPending ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel & General Settings ────────────────────────────────────────────────

function PanelSettingsSection() {
  const { data: identityData, isLoading: identityLoading, isError: identityError, refetch: refetchIdentity } = useServerIdentity();
  const updateIdentity = useUpdateServerIdentity();
  const { data: panelData, isLoading: panelLoading, isError: panelError, refetch: refetchPanel } = usePanelSettings();
  const updatePanel = useUpdatePanelSettings();
  const { data: serverContext } = useServerContext();

  const [hostname, setHostname] = useState('');
  const [panelUrl, setPanelUrl] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const panelUrlIsPrivate = serverContext?.panelUrlIsPrivate ?? false;

  useEffect(() => {
    if (identityData?.hostname) setHostname(identityData.hostname);
  }, [identityData]);

  useEffect(() => {
    if (panelData) {
      if (panelData.panelUrl) setPanelUrl(panelData.panelUrl);
      if (panelData.adminEmail) setAdminEmail(panelData.adminEmail);
    }
  }, [panelData]);

  if (identityLoading || panelLoading) return <LoadingSpinner />;

  const handleSaveIdentity = () => {
    updateIdentity.mutate({ hostname });
  };

  const handleSavePanel = () => {
    updatePanel.mutate({ panelUrl, adminEmail });
  };

  return (
    <>
      <SettingsSection
        title="Server Identity"
        description="Configure the server hostname"
        icon={Server}
      >
        {identityError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-500" />
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">Failed to load server identity settings.</p>
            <button onClick={() => refetchIdentity()} className="mt-2 text-sm text-primary hover:underline">Retry</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Hostname</label>
              <input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="server.example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The server hostname used for identification and mail sending
              </p>
            </div>
            {updateIdentity.isError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Failed to save hostname. Please try again.
              </div>
            )}
            <SaveButton
              onClick={handleSaveIdentity}
              isPending={updateIdentity.isPending}
              disabled={!hostname}
            />
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Panel URL & Admin Email"
        description="Configure the panel access URL and administrator contact"
        icon={Globe}
      >
        {panelError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-500" />
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">Failed to load panel settings.</p>
            <button onClick={() => refetchPanel()} className="mt-2 text-sm text-primary hover:underline">Retry</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Panel URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={panelUrl}
                  onChange={(e) => setPanelUrl(e.target.value)}
                  placeholder="https://panel.example.com:8080"
                  className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The URL used to access this control panel. Used for generating links in notifications and emails.
              </p>
              {panelUrlIsPrivate && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <p className="text-xs text-yellow-600">
                    Panel URL is set to a local address ({panelUrl}). If you've set up a Cloudflare Tunnel, update this to your tunnel URL (e.g., https://panel.yourdomain.com) for correct link generation in emails and notifications.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Administrator email for receiving system alerts, reports, and notifications
              </p>
            </div>
            {updatePanel.isError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Failed to save panel settings. Please try again.
              </div>
            )}
            <SaveButton
              onClick={handleSavePanel}
              isPending={updatePanel.isPending}
              disabled={!panelUrl && !adminEmail}
            />
          </div>
        )}
      </SettingsSection>
    </>
  );
}

// ─── PHP Version Settings ────────────────────────────────────────────────────

function PhpSettingsSection() {
  const { data: phpData, isLoading } = usePhpVersions();
  const { data: phpVersionData } = usePhpVersion();
  const updatePhpVersion = useUpdatePhpVersion();
  const [selectedVersion, setSelectedVersion] = useState('');

  const versions: string[] = phpData?.versions?.length
    ? phpData.versions.map((v: any) => typeof v === 'string' ? v : v.version)
    : DEFAULT_PHP_VERSIONS;

  useEffect(() => {
    if (phpVersionData?.version) {
      setSelectedVersion(phpVersionData.version);
    }
  }, [phpVersionData]);

  useEffect(() => {
    if (versions.length > 0 && !selectedVersion) {
      setSelectedVersion(versions[0]);
    }
  }, [versions]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="PHP Version (Global Default)"
      description="Set the default PHP version for new sites"
      icon={Code2}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Default PHP Version</label>
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {versions.length === 0 ? (
              <option value="">No PHP versions installed</option>
            ) : (
              versions.map((v) => (
                <option key={v} value={v}>
                  PHP {v}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            This PHP version will be used as the default for all newly created websites. Individual sites can
            override this setting.
          </p>
        </div>

        {versions.length > 0 && (
          <div className="rounded-md border border-border p-3">
            <h4 className="mb-2 text-sm font-medium">Installed Versions</h4>
            <div className="space-y-1">
              {versions.map((v) => (
                <div key={v} className="flex items-center justify-between text-sm">
                  <span>PHP {v}</span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600">
                    Installed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SaveButton
          onClick={() => {
            if (!selectedVersion) return;
            updatePhpVersion.mutate(selectedVersion, {
              onSuccess: () => toast.success('Default PHP version updated'),
              onError: (err: any) => toast.error(err?.message || 'Failed to update PHP version'),
            });
          }}
          isPending={updatePhpVersion.isPending}
          disabled={!selectedVersion}
        />
      </div>
    </SettingsSection>
  );
}

// ─── Nameserver Settings ─────────────────────────────────────────────────────

function NameserverSettingsSection() {
  const { data, isLoading, isError, refetch } = useNameserverSettings();
  const update = useUpdateNameserverSettings();
  const verifyDomain = useVerifyNameserverDomain();
  const { data: serverContext } = useServerContext();
  const [form, setForm] = useState({ ns1: '', ns2: '' });
  const [verificationStatus, setVerificationStatus] = useState<{
    domain: string;
    status: 'idle' | 'verifying' | 'success' | 'error';
    message?: string;
    resolvesTo?: string[];
    skipWarningShown?: boolean;
  }>({ domain: '', status: 'idle' });

  useEffect(() => {
    if (data) {
      setForm({ ns1: data.ns1 || '', ns2: data.ns2 || '' });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  // Extract base domain from nameserver hostname (e.g., "example.com" from "ns1.example.com")
  const extractBaseDomain = (nameserver: string): string | null => {
    if (!nameserver || nameserver === 'ns1.example.com') return null;
    const parts = nameserver.split('.');
    // Need at least 2 parts for a valid domain (e.g., example.com)
    if (parts.length >= 2) {
      // Return the last two parts (domain.com from ns1.ns2.domain.com)
      return parts.slice(-2).join('.');
    }
    return null;
  };

  const handleVerifyDomain = async (domain: string) => {
    setVerificationStatus({ domain, status: 'verifying' });
    try {
      const result = await verifyDomain.mutateAsync(domain);
      if (result.pointsToServer) {
        setVerificationStatus({
          domain,
          status: 'success',
          message: `Domain ${domain} correctly points to this server (${result.serverIp})`,
          resolvesTo: result.resolvesTo,
        });
      } else {
        setVerificationStatus({
          domain,
          status: 'error',
          message: `Domain ${domain} does not point to this server. Currently points to: ${result.resolvesTo.join(', ') || 'nothing'}`,
          resolvesTo: result.resolvesTo,
        });
      }
    } catch (error: any) {
      setVerificationStatus({
        domain,
        status: 'error',
        message: error?.message || 'Failed to verify domain',
      });
    }
  };

  const handleSave = async () => {
    const baseDomain = extractBaseDomain(form.ns1) || extractBaseDomain(form.ns2);
    const hasCustomNs = !!(form.ns1 && form.ns1 !== 'ns1.example.com');

    // If no custom nameservers, just save directly
    if (!hasCustomNs) {
      update.mutate(form);
      return;
    }

    // If already verified for this domain, skip verification
    if (verificationStatus.domain === baseDomain && verificationStatus.status === 'success') {
      update.mutate(form);
      return;
    }

    // Verify the domain first
    if (baseDomain && (!verificationStatus.skipWarningShown || verificationStatus.domain !== baseDomain)) {
      await handleVerifyDomain(baseDomain);
      // After verification, the user can click save again or we'll auto-proceed based on status
    }
  };

  const handleSaveAfterVerification = () => {
    update.mutate(form);
  };

  const handleSkipVerification = () => {
    setVerificationStatus(prev => ({ ...prev, status: 'success', skipWarningShown: true }));
    update.mutate(form);
  };

  const hasPublicIp = serverContext?.hasPublicIp ?? false;
  const serverIp = serverContext?.publicIp ?? serverContext?.primaryIp ?? 'your server IP';
  const hasCustomNs = !!(form.ns1 && form.ns1 !== 'ns1.example.com');
  const baseDomain = extractBaseDomain(form.ns1) || extractBaseDomain(form.ns2);

  // Determine guidance based on state
  const showDirectIpGuidance = !hasCustomNs;
  const showGlueRecordGuidance = hasCustomNs && hasPublicIp;
  const showVerificationSection = hasCustomNs && baseDomain;

  return (
    <SettingsSection
      title="Nameservers"
      description="Configure primary and secondary DNS nameservers"
      icon={Network}
    >
      {isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-500" />
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">Failed to load nameserver settings.</p>
          <button onClick={() => refetch()} className="mt-2 text-sm text-primary hover:underline">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* No domain scenario - Show direct IP assignment guidance */}
          {showDirectIpGuidance && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="text-sm">
                  <p className="font-medium text-blue-600 dark:text-blue-400">No custom nameservers configured</p>
                  <p className="mt-1 text-muted-foreground">
                    To use this server with a domain, point your domain's A record directly to your server's IP address.
                    {hasPublicIp ? (
                      <> Set <span className="font-mono font-semibold">{serverIp}</span> as the A record for your domain.</>
                    ) : (
                      <> Your server's public IP will be shown here once detected.</>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Custom nameservers (like ns1.yourdomain.com) require you to first own a domain, then create "glue records" 
                    at your domain registrar that link ns1.yourdomain.com to this server's IP.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Custom nameserver inputs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Primary Nameserver (NS1)</label>
              <input
                value={form.ns1}
                onChange={(e) => {
                  setForm({ ...form, ns1: e.target.value });
                  // Reset verification when nameserver changes
                  setVerificationStatus({ domain: '', status: 'idle' });
                }}
                placeholder="ns1.example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Secondary Nameserver (NS2)</label>
              <input
                value={form.ns2}
                onChange={(e) => {
                  setForm({ ...form, ns2: e.target.value });
                  // Reset verification when nameserver changes
                  setVerificationStatus({ domain: '', status: 'idle' });
                }}
                placeholder="ns2.example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Domain Verification Section */}
          {showVerificationSection && (
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Network className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Domain Verification</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                The base domain <span className="font-mono font-semibold">{baseDomain}</span> will be verified to ensure it points to this server before saving.
              </p>
              
              {/* Verification Status */}
              {verificationStatus.status === 'verifying' && (
                <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Verifying domain {baseDomain}...
                </div>
              )}
              
              {verificationStatus.status === 'success' && verificationStatus.domain === baseDomain && (
                <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/5 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <div className="text-sm">
                    <p className="font-medium text-green-600 dark:text-green-400">Domain verified</p>
                    <p className="text-muted-foreground">{verificationStatus.message}</p>
                  </div>
                </div>
              )}
              
              {verificationStatus.status === 'error' && verificationStatus.domain === baseDomain && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div className="text-sm">
                      <p className="font-medium text-red-600 dark:text-red-400">Verification failed</p>
                      <p className="text-muted-foreground">{verificationStatus.message}</p>
                      {verificationStatus.resolvesTo && verificationStatus.resolvesTo.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          DNS A records found: {verificationStatus.resolvesTo.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">DNS not pointing to this server</p>
                      <p className="text-muted-foreground">
                        For custom nameservers to work, the base domain must point to this server. 
                        Update your DNS A record at your domain registrar to point {baseDomain} to <span className="font-mono font-semibold">{serverIp}</span>.
                      </p>
                      <p className="mt-2 text-xs text-yellow-600">
                        If you're sure you want to proceed without verification, click "Save Anyway" below.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Glue record guidance when custom nameservers are configured */}
          {showGlueRecordGuidance && (
            <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <div className="text-sm">
                  <p className="font-medium text-green-600 dark:text-green-400">Custom nameservers configured</p>
                  <p className="mt-1 text-muted-foreground">
                    To use these nameservers, you need to create glue records at your domain registrar:
                  </p>
                  <div className="mt-2 space-y-1 rounded bg-background/50 p-2 font-mono text-xs">
                    <p><span className="font-semibold">ns1</span> → <span className="text-primary">{serverIp}</span></p>
                    <p><span className="font-semibold">ns2</span> → <span className="text-primary">{serverIp}</span></p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    After creating glue records, set your domain's nameservers to: <span className="font-semibold">{form.ns1}</span> and <span className="font-semibold">{form.ns2}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            These nameservers will be used as defaults when creating new DNS zones. Changes will not affect
            existing domains.
          </p>
          {update.isError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to save nameserver settings. Please try again.
            </div>
          )}
          
          {/* Save Button Logic */}
          {hasCustomNs && verificationStatus.status === 'error' && verificationStatus.domain === baseDomain ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={update.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${update.isPending ? 'animate-spin' : ''}`} />
                {update.isPending ? 'Verifying...' : 'Verify Again'}
              </button>
              <button
                onClick={handleSkipVerification}
                disabled={update.isPending}
                className="flex items-center gap-2 rounded-md border border-yellow-500 px-4 py-2 text-sm font-medium text-yellow-600 transition-colors hover:bg-yellow-500/10 disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4" />
                Save Anyway (Advanced)
              </button>
            </div>
          ) : hasCustomNs && verificationStatus.status !== 'success' ? (
            <button
              onClick={handleSave}
              disabled={update.isPending || verifyDomain.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {verifyDomain.isPending ? 'Verifying...' : 'Save & Verify'}
            </button>
          ) : (
            <button
              onClick={handleSaveAfterVerification}
              disabled={update.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {update.isPending ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      )}
    </SettingsSection>
  );
}

// ─── Timezone Settings ───────────────────────────────────────────────────────

function TimezoneSettingsSection() {
  const { data, isLoading, isError, refetch } = useTimezone();
  const { data: timezones } = useAvailableTimezones();
  const update = useUpdateTimezone();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (data?.timezone) setSelected(data.timezone);
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="Timezone"
      description="Set the server timezone for scheduling and logging"
      icon={Clock}
    >
      {isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-500" />
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">Failed to load timezone settings.</p>
          <button onClick={() => refetch()} className="mt-2 text-sm text-primary hover:underline">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Current Timezone: <span className="font-semibold text-primary">{data?.timezone}</span>
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {timezones?.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          {update.isError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to save timezone. Please try again.
            </div>
          )}
          <SaveButton
            onClick={() => update.mutate(selected)}
            isPending={update.isPending}
            disabled={!selected}
          />
        </div>
      )}
    </SettingsSection>
  );
}

// ─── Session & Password Policy Settings ──────────────────────────────────────

function SessionPasswordSettingsSection() {
  const { data: sessionData, isLoading: sessionLoading } = useSessionSettings();
  const updateSession = useUpdateSessionSettings();
  const { data: policyData, isLoading: policyLoading } = usePasswordPolicy();
  const updatePolicy = useUpdatePasswordPolicy();

  const [sessionTimeout, setSessionTimeout] = useState(0);
  const [policy, setPolicy] = useState({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  });

  useEffect(() => {
    if (sessionData?.timeout) setSessionTimeout(sessionData.timeout);
  }, [sessionData]);

  useEffect(() => {
    if (policyData) {
      setPolicy({
        minLength: policyData.minLength ?? 8,
        requireUppercase: policyData.requireUppercase ?? true,
        requireLowercase: policyData.requireLowercase ?? true,
        requireNumbers: policyData.requireNumbers ?? true,
        requireSpecialChars: policyData.requireSpecialChars ?? false,
      });
    }
  }, [policyData]);

  if (sessionLoading || policyLoading) return <LoadingSpinner />;

  const handleSaveSession = () => {
    updateSession.mutate({ timeout: sessionTimeout });
  };

  const handleSavePolicy = () => {
    updatePolicy.mutate(policy);
  };

  return (
    <>
      <SettingsSection
        title="Session Settings"
        description="Configure session timeout and management"
        icon={Clock}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Session Timeout (minutes)</label>
            <input
              type="number"
              min={5}
              max={1440}
              value={sessionTimeout || 30}
              onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 0)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Duration of inactivity before a user session expires (5–1440 minutes). Default: 30 minutes.
            </p>
          </div>
          <SaveButton
            onClick={handleSaveSession}
            isPending={updateSession.isPending}
            disabled={!sessionTimeout}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Password Policy"
        description="Configure password requirements for all users"
        icon={Lock}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Minimum Password Length</label>
            <input
              type="number"
              min={6}
              max={128}
              value={policy.minLength}
              onChange={(e) => setPolicy({ ...policy, minLength: parseInt(e.target.value) || 8 })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Require Uppercase Letters</span>
                <p className="text-xs text-muted-foreground">At least one uppercase character (A–Z)</p>
              </div>
              <ToggleSwitch
                enabled={policy.requireUppercase}
                onChange={() =>
                  setPolicy({
                    ...policy,
                    requireUppercase: !policy.requireUppercase,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Require Lowercase Letters</span>
                <p className="text-xs text-muted-foreground">At least one lowercase character (a–z)</p>
              </div>
              <ToggleSwitch
                enabled={policy.requireLowercase}
                onChange={() =>
                  setPolicy({
                    ...policy,
                    requireLowercase: !policy.requireLowercase,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Require Numbers</span>
                <p className="text-xs text-muted-foreground">At least one numeric digit (0–9)</p>
              </div>
              <ToggleSwitch
                enabled={policy.requireNumbers}
                onChange={() =>
                  setPolicy({
                    ...policy,
                    requireNumbers: !policy.requireNumbers,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Require Special Characters</span>
                <p className="text-xs text-muted-foreground">At least one special character (!@#$%^&*)</p>
              </div>
              <ToggleSwitch
                enabled={policy.requireSpecialChars}
                onChange={() =>
                  setPolicy({
                    ...policy,
                    requireSpecialChars: !policy.requireSpecialChars,
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <h4 className="mb-2 text-sm font-medium">Policy Summary</h4>
            <p className="text-xs text-muted-foreground">
              Passwords must be at least{' '}
              <span className="font-semibold text-foreground">
                {policy.minLength}
              </span>{' '}
              characters long and include
              {policy.requireUppercase ? ' uppercase' : ''}
              {policy.requireLowercase ? ' lowercase' : ''}
              {policy.requireNumbers ? ' numbers' : ''}
              {policy.requireSpecialChars
                ? ' special characters'
                : ''}
              .
            </p>
          </div>

          <SaveButton onClick={handleSavePolicy} isPending={updatePolicy.isPending} />
        </div>
      </SettingsSection>
    </>
  );
}

// ─── Backup Settings ─────────────────────────────────────────────────────────

function BackupSettingsSection() {
  const { data, isLoading } = useBackupSettings();
  const update = useUpdateBackupSettings();
  const [form, setForm] = useState({
    backupPath: '',
    retentionDays: 7,
    schedule: '',
    enabled: true,
  });

  useEffect(() => {
    if (data) {
      setForm({
        backupPath: data.backupPath || '',
        retentionDays: data.retentionDays ?? 7,
        schedule: data.schedule || '',
        enabled: data.enabled ?? true,
      });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  const handleSave = () => {
    update.mutate(form);
  };

  return (
    <SettingsSection
      title="Backup Settings"
      description="Configure automatic backup behavior"
      icon={Download}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Enable Automatic Backups</span>
            <p className="text-xs text-muted-foreground">Run backups automatically on schedule</p>
          </div>
          <ToggleSwitch
            enabled={form.enabled}
            onChange={() => setForm({ ...form, enabled: !form.enabled })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Backup Path</label>
          <input
            value={form.backupPath}
            onChange={(e) => setForm({ ...form, backupPath: e.target.value })}
            placeholder="/var/backups/serverforge"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Retention (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.retentionDays}
            onChange={(e) => setForm({ ...form, retentionDays: parseInt(e.target.value) || 7 })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Schedule (cron expression)</label>
          <input
            value={form.schedule}
            onChange={(e) => setForm({ ...form, schedule: e.target.value })}
            placeholder="0 2 * * *"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cron expression for backup schedule (default: daily at 2 AM)
          </p>
        </div>
        <SaveButton onClick={handleSave} isPending={update.isPending} />
      </div>
    </SettingsSection>
  );
}

// ─── Security Settings ───────────────────────────────────────────────────────

function SecuritySettingsSection() {
  const { data, isLoading } = useSecuritySettings();
  const updateSshPort = useUpdateSshPort();
  const [sshPort, setSshPort] = useState(22);

  useEffect(() => {
    if (data?.sshPort) setSshPort(data.sshPort);
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="Security Settings"
      description="SSH and firewall configuration"
      icon={Shield}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">SSH Port</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={65535}
              value={sshPort}
              onChange={(e) => setSshPort(parseInt(e.target.value) || 22)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <SaveButton
              onClick={() => updateSshPort.mutate(sshPort)}
              isPending={updateSshPort.isPending}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Password Authentication</span>
              <p className="text-xs text-muted-foreground">Allow SSH login with password</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data?.sshPasswordAuth
                  ? 'bg-yellow-500/10 text-yellow-600'
                  : 'bg-green-500/10 text-green-600'
              }`}
            >
              {data?.sshPasswordAuth ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {data?.sshPasswordAuth ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Root Login</span>
              <p className="text-xs text-muted-foreground">Allow SSH login as root</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data?.sshPermitRootLogin
                  ? 'bg-red-500/10 text-red-600'
                  : 'bg-green-500/10 text-green-600'
              }`}
            >
              {data?.sshPermitRootLogin ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {data?.sshPermitRootLogin ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Fail2Ban</span>
              <p className="text-xs text-muted-foreground">Intrusion prevention framework</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data?.fail2banEnabled
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              {data?.fail2banEnabled ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {data?.fail2banEnabled ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">UFW Firewall</span>
              <p className="text-xs text-muted-foreground">Uncomplicated Firewall</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data?.ufwEnabled
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              {data?.ufwEnabled ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {data?.ufwEnabled ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

// ─── System Updates ──────────────────────────────────────────────────────────

function UpdateSettingsSection() {
  const { data, isLoading } = useSystemUpdates();
  const check = useCheckForUpdates();

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="System Updates"
      description="Check and manage system package updates"
      icon={RefreshCw}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Updates Available</span>
            <p className="text-xs text-muted-foreground">Packages that can be updated</p>
          </div>
          <span className="text-2xl font-bold">{data?.updatesAvailable || 0}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Last checked: {data?.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'Never'}
        </div>
        <button
          onClick={() => check.mutate()}
          disabled={check.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${check.isPending ? 'animate-spin' : ''}`} />
          Check for Updates
        </button>
      </div>
    </SettingsSection>
  );
}

// ─── System Information ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(', ') || 'Just started';
}

function SystemInfoSection() {
  const { data, isLoading } = useSystemInfo();

  if (isLoading) return <LoadingSpinner />;

  const infoItems = data
    ? [
        { label: 'Operating System', value: data.os || 'Linux' },
        { label: 'Kernel', value: data.kernel || 'Unknown' },
        { label: 'Architecture', value: data.arch || 'x86_64' },
        { label: 'Hostname', value: data.hostname || 'serverforge' },
        {
          label: 'CPU',
          value: data.cpu?.model
            ? `${data.cpu.model} (${data.cpu.cores} cores)`
            : 'N/A',
        },
        {
          label: 'RAM',
          value: data.ram
            ? `${formatBytes(data.ram.used)} / ${formatBytes(data.ram.total)} (${Math.round(
                (data.ram.used / data.ram.total) * 100
              )}% used)`
            : 'N/A',
        },
        {
          label: 'Disk',
          value: data.disk
            ? `${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)} (${Math.round(
                (data.disk.used / data.disk.total) * 100
              )}% used)`
            : 'N/A',
        },
        {
          label: 'Uptime',
          value: formatUptime(data.uptime || 0),
        },
      ]
    : [
        { label: 'Operating System', value: 'Ubuntu 22.04 LTS' },
        { label: 'Kernel', value: '5.15.0-generic' },
        { label: 'Architecture', value: 'x86_64' },
        { label: 'Hostname', value: 'serverforge' },
        { label: 'CPU', value: 'N/A' },
        { label: 'RAM', value: 'N/A' },
        { label: 'Disk', value: 'N/A' },
        { label: 'Uptime', value: 'N/A' },
      ];

  const softwareVersions = data?.softwareVersions || {
    nginx: '1.24.0',
    php: '8.3.6',
    mysql: '10.11.6-MariaDB',
    node: '20.12.0',
    redis: '7.2.4',
  };

  return (
    <SettingsSection
      title="System Information"
      description="Overview of server hardware and software"
      icon={Info}
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <tbody>
              {infoItems.map((item) => (
                <tr key={item.label} className="border-b border-border last:border-b-0">
                  <td className="w-1/3 bg-muted/30 px-3 py-2 font-medium text-muted-foreground">
                    {item.label}
                  </td>
                  <td className="px-3 py-2">{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium">Software Versions</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(softwareVersions).map(([name, version]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm font-medium capitalize">{name}</span>
                <span className="font-mono text-xs text-muted-foreground">{version}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

// ─── Panel Port Setting ──────────────────────────────────────────────────────

function PanelPortSection() {
  const { data, isLoading } = usePanelPort();
  const update = useUpdatePanelPort();
  const [port, setPort] = useState(3000);

  useEffect(() => {
    if (data) setPort(data.port ?? 3000);
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="Panel Port"
      description="Configure the port the control panel listens on"
      icon={Globe}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Port Number</label>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 3000)}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
            <p className="text-xs text-muted-foreground">
              Changing the panel port requires a server restart. Make sure the new port is open in your
              firewall before saving. Default: 3000.
            </p>
          </div>
        </div>
        <SaveButton
          onClick={() => update.mutate(port)}
          isPending={update.isPending}
          disabled={port === (data?.port ?? 3000)}
        />
      </div>
    </SettingsSection>
  );
}

// ─── Default Web Server Mode ─────────────────────────────────────────────────

function DefaultWebServerSection() {
  const { data, isLoading } = useDefaultWebServer();
  const update = useUpdateDefaultWebServer();
  const [mode, setMode] = useState('');

  useEffect(() => {
    if (data) setMode(data.mode ?? 'nginx');
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="Default Web Server"
      description="Set the default web server for new domains"
      icon={Server}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Web Server Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="nginx">Nginx</option>
            <option value="apache">Apache</option>
            <option value="nginx+apache">Nginx + Apache (Reverse Proxy)</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            This web server will be used as the default when creating new domains. Individual domains can
            override this setting.
          </p>
        </div>
        <SaveButton
          onClick={() => update.mutate(mode)}
          isPending={update.isPending}
          disabled={!mode || mode === (data?.mode ?? 'nginx')}
        />
      </div>
    </SettingsSection>
  );
}

// ─── Default SSL Contact Email ───────────────────────────────────────────────

function SslEmailSection() {
  const { data, isLoading } = useSslEmail();
  const update = useUpdateSslEmail();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (data) setEmail(data.email ?? '');
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="Default SSL Contact Email"
      description="Email used for Let's Encrypt certificate notifications"
      icon={Mail}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">SSL Contact Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This email will be used as the default contact for Let's Encrypt certificate issuance and
            expiration reminders.
          </p>
        </div>
        <SaveButton
          onClick={() => update.mutate(email)}
          isPending={update.isPending}
          disabled={!email}
        />
      </div>
    </SettingsSection>
  );
}

// ─── SMTP Settings ─────────────────────────────────────────────────────────────

function SmtpSettingsSection() {
  const { data, isLoading } = useSmtpSettings();
  const update = useUpdateSmtpSettings();
  const sendTest = useSendTestEmail();
  const [form, setForm] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromAddress: '',
    encryption: 'tls' as 'none' | 'tls' | 'ssl',
  });
  const [testStatus, setTestStatus] = useState<{ sending: boolean; result: 'idle' | 'success' | 'error'; message: string }>({
    sending: false,
    result: 'idle',
    message: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        host: data.host ?? '',
        port: data.port ?? 587,
        username: data.username ?? '',
        password: '',
        fromAddress: data.fromAddress ?? '',
        encryption: data.encryption ?? 'tls',
      });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  const handleSave = () => {
    update.mutate(form, {
      onSuccess: () => toast.success('SMTP settings saved'),
      onError: (err: any) => toast.error(err?.message || 'Failed to save SMTP settings'),
    });
  };

  const handleSendTest = async () => {
    setTestStatus({ sending: true, result: 'idle', message: '' });
    try {
      const res = await sendTest.mutateAsync();
      setTestStatus({ sending: false, result: 'success', message: res.message });
    } catch (err: any) {
      setTestStatus({ sending: false, result: 'error', message: err?.message || 'Failed to send test email' });
    }
  };

  return (
    <SettingsSection
      title="SMTP Settings"
      description="Configure email sending for notifications and alerts"
      icon={Mail}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">SMTP Host</label>
          <input
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            placeholder="smtp.example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Port</label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 587 })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Encryption</label>
            <select
              value={form.encryption}
              onChange={(e) => setForm({ ...form, encryption: e.target.value as 'none' | 'tls' | 'ssl' })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Username</label>
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="smtpuser"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={data?.username ? '(unchanged)' : ''}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Leave blank to keep current password
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">From Address</label>
          <input
            type="email"
            value={form.fromAddress}
            onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
            placeholder="noreply@example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {update.error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to save SMTP settings. Please try again.
          </div>
        )}
        <div className="flex items-center gap-2">
          <SaveButton
            onClick={handleSave}
            isPending={update.isPending}
            disabled={!form.host || !form.username}
          />
          <button
            onClick={handleSendTest}
            disabled={sendTest.isPending || !form.host || !form.username}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {testStatus.sending ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
        {testStatus.result === 'success' && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {testStatus.message}
          </div>
        )}
        {testStatus.result === 'error' && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            {testStatus.message}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

// ─── Server Power Controls ───────────────────────────────────────────────────

function ServerPowerSection() {
  const reboot = useRebootServer();
  const shutdown = useShutdownServer();
  const [showReboot, setShowReboot] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);

  return (
    <>
      <SettingsSection
        title="Server Power Controls"
        description="Reboot or shut down the server"
        icon={Power}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Reboot Server</span>
              <p className="text-xs text-muted-foreground">
                Perform a graceful server restart. All services will be temporarily unavailable.
              </p>
            </div>
            <button
              onClick={() => setShowReboot(true)}
              className="flex items-center gap-2 rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
            >
              <RefreshCw className="h-4 w-4" /> Reboot
            </button>
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Shutdown Server</span>
              <p className="text-xs text-muted-foreground">
                Power off the server completely. Manual intervention required to restart.
              </p>
            </div>
            <button
              onClick={() => setShowShutdown(true)}
              className="flex items-center gap-2 rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
            >
              <Power className="h-4 w-4" /> Shutdown
            </button>
          </div>
        </div>
      </SettingsSection>

      {showReboot && (
        <ConfirmModal
          title="Reboot Server"
          message="Are you sure you want to reboot the server? All services will be temporarily unavailable. This action cannot be undone."
          confirmLabel="Reboot Now"
          requireTyping="REBOOT"
          onConfirm={() => reboot.mutate(undefined, { onSettled: () => setShowReboot(false) })}
          onClose={() => setShowReboot(false)}
          isPending={reboot.isPending}
        />
      )}

      {showShutdown && (
        <ConfirmModal
          title="Shutdown Server"
          message="Are you sure you want to shut down the server? You will need physical or cloud console access to power it back on."
          confirmLabel="Shutdown Now"
          requireTyping="SHUTDOWN"
          onConfirm={() => shutdown.mutate(undefined, { onSettled: () => setShowShutdown(false) })}
          onClose={() => setShowShutdown(false)}
          isPending={shutdown.isPending}
        />
      )}
    </>
  );
}

// ─── Maintenance Mode ─────────────────────────────────────────────────────────

function MaintenanceModeSection() {
  const { data, isLoading } = useMaintenanceMode();
  const update = useUpdateMaintenanceMode();

  if (isLoading) return <LoadingSpinner />;

  const enabled = data?.enabled ?? false;

  return (
    <SettingsSection
      title="Maintenance Mode"
      description="Show a maintenance page to visitors"
      icon={Wrench}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Enable Maintenance Mode</span>
            <p className="text-xs text-muted-foreground">
              When enabled, visitors will see a maintenance page instead of your websites. Admin panel
              remains accessible.
            </p>
          </div>
          <ToggleSwitch
            enabled={enabled}
            onChange={() => update.mutate(!enabled)}
          />
        </div>
        {enabled && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
            <p className="text-xs text-muted-foreground">
              Maintenance mode is currently active. All public-facing websites are showing a maintenance page.
            </p>
          </div>
        )}
        {update.error && <p className="text-sm text-destructive">{String(update.error)}</p>}
      </div>
    </SettingsSection>
  );
}

// ─── Panel Config Backup / Restore ───────────────────────────────────────────

function PanelBackupRestoreSection() {
  const exportConfig = useExportConfig();
  const importConfig = useImportConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirm, setImportConfirm] = useState<unknown>(null);

  const handleExport = () => {
    exportConfig.mutate(undefined, {
      onSuccess: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `novapanel-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string);
        setImportConfirm(config);
      } catch {
        toast.error('Invalid JSON file. Please select a valid panel configuration file.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
    <ConfirmDialog
      open={!!importConfirm}
      title="Import Panel Configuration"
      message="This will overwrite your current panel configuration with the uploaded file. This cannot be undone."
      variant="warning"
      confirmText="Import Config"
      onConfirm={() => { importConfig.mutate(importConfirm as any); setImportConfirm(null); }}
      onCancel={() => setImportConfirm(null)}
    />
    <SettingsSection
      title="Panel Configuration Backup"
      description="Export or import panel configuration as JSON"
      icon={Database}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Export Panel Config</span>
            <p className="text-xs text-muted-foreground">
              Download the current panel configuration as a JSON file
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportConfig.isPending}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            {exportConfig.isPending ? 'Exporting...' : 'Export Config'}
          </button>
        </div>
        <div className="border-t border-border" />
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Import Panel Config</span>
            <p className="text-xs text-muted-foreground">
              Upload a previously exported JSON configuration file
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importConfig.isPending}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importConfig.isPending ? 'Importing...' : 'Import Config'}
            </button>
          </div>
        </div>
        {(exportConfig.error || importConfig.error) && (
          <p className="text-sm text-destructive">
            {String(exportConfig.error || importConfig.error)}
          </p>
        )}
      </div>
    </SettingsSection>
    </>
  );
}

// ─── Data Retention Settings ─────────────────────────────────────────────────

function DataRetentionSection() {
  const { data, isLoading } = useDataRetention();
  const update = useUpdateDataRetention();
  const [form, setForm] = useState({
    auditLogRetentionDays: 90,
    logRetentionDays: 30,
    backupRetentionCount: 7,
  });

  useEffect(() => {
    if (data) {
      setForm({
        auditLogRetentionDays: data.auditLogRetentionDays ?? 90,
        logRetentionDays: data.logRetentionDays ?? 30,
        backupRetentionCount: data.backupRetentionCount ?? 7,
      });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SettingsSection
      title="Data Retention"
      description="Configure how long data is kept before automatic cleanup"
      icon={HardDrive}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Audit Log Retention (days)</label>
          <input
            type="number"
            min={1}
            max={3650}
            value={form.auditLogRetentionDays}
            onChange={(e) =>
              setForm({ ...form, auditLogRetentionDays: parseInt(e.target.value) || 90 })
            }
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Audit log entries older than this will be automatically deleted. Default: 90 days.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Log Retention (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.logRetentionDays}
            onChange={(e) =>
              setForm({ ...form, logRetentionDays: parseInt(e.target.value) || 30 })
            }
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            System and application logs older than this will be rotated and cleaned. Default: 30 days.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Backup Retention Count</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.backupRetentionCount}
            onChange={(e) =>
              setForm({ ...form, backupRetentionCount: parseInt(e.target.value) || 7 })
            }
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Maximum number of backups to keep. Oldest backups are removed when limit is reached. Default: 7.
          </p>
        </div>
        <SaveButton
          onClick={() => update.mutate(form)}
          isPending={update.isPending}
        />
      </div>
    </SettingsSection>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ServerSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Server Settings"
        description="Configure server-wide settings and preferences"
        icon={Wrench}
      />

      <div className="space-y-6">
        {/* General Settings */}
        <PanelSettingsSection />

        {/* Panel Port */}
        <PanelPortSection />

        {/* Default Web Server */}
        <DefaultWebServerSection />

        {/* Default SSL Email */}
        <SslEmailSection />

        {/* SMTP */}
        <SmtpSettingsSection />

        {/* PHP Version */}
        <PhpSettingsSection />

        {/* DNS / Nameservers */}
        <NameserverSettingsSection />

        {/* Timezone */}
        <TimezoneSettingsSection />

        {/* Session & Password Policy */}
        <SessionPasswordSettingsSection />

        {/* Backup */}
        <BackupSettingsSection />

        {/* Data Retention */}
        <DataRetentionSection />

        {/* Security */}
        <SecuritySettingsSection />

        {/* Maintenance Mode */}
        <MaintenanceModeSection />

        {/* Panel Config Backup/Restore */}
        <PanelBackupRestoreSection />

        {/* System Information */}
        <SystemInfoSection />

        {/* System Updates */}
        <UpdateSettingsSection />

        {/* Server Power Controls */}
        <ServerPowerSection />
      </div>
    </div>
  );
}
