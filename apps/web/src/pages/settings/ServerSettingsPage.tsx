import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import {
  useServerIdentity,
  useUpdateServerIdentity,
  usePhpVersion,
  useUpdatePhpVersion,
  useNameserverSettings,
  useUpdateNameserverSettings,
  useVerifyNameserver,
  useTimezone,
  useUpdateTimezone,
  useAvailableTimezones,
  useSessionSettings,
  useUpdateSessionSettings,
  usePasswordPolicy,
  useUpdatePasswordPolicy,
  useBackupSettings,
  useUpdateBackupSettings,
  useSshSettings,
  useUpdateSshSettings,
  usePanelPort,
  useUpdatePanelPort,
  useDefaultWebServer,
  useUpdateDefaultWebServer,
  useSslEmail,
  useUpdateSslEmail,
  useMaintenanceMode,
  useUpdateMaintenanceMode,
  useDataRetention,
  useUpdateDataRetention,
  useSystemInfo,
  useRebootServer,
  useShutdownServer,
  useExportConfig,
  useImportConfig,
} from '../../api/hooks/settings';
import { toast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/icons';

export function ServerSettingsPage() {
  const [openSection, setOpenSection] = useState<string>('identity');
  const [rebootConfirmOpen, setRebootConfirmOpen] = useState(false);
  const [shutdownConfirmOpen, setShutdownConfirmOpen] = useState(false);

  const reboot = useRebootServer();
  const shutdown = useShutdownServer();

  const toggle = (key: string) => setOpenSection((prev) => (prev === key ? '' : key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-medium">Server Settings</h1>
        <p className="text-small text-foreground-secondary mt-0.5">
          Configure your server preferences
        </p>
      </div>

      <SettingsSection
        id="identity"
        title="Server Identity"
        icon="icon-server"
        isOpen={openSection === 'identity'}
        onToggle={() => toggle('identity')}
      >
        <IdentitySettings />
      </SettingsSection>

      <SettingsSection
        id="php"
        title="PHP Versions"
        icon="icon-server"
        isOpen={openSection === 'php'}
        onToggle={() => toggle('php')}
      >
        <PhpSettings />
      </SettingsSection>

      <SettingsSection
        id="nameservers"
        title="Nameservers"
        icon="icon-world"
        isOpen={openSection === 'nameservers'}
        onToggle={() => toggle('nameservers')}
      >
        <NameserverSettings />
      </SettingsSection>

      <SettingsSection
        id="timezone"
        title="Timezone"
        icon="icon-clock"
        isOpen={openSection === 'timezone'}
        onToggle={() => toggle('timezone')}
      >
        <TimezoneSettings />
      </SettingsSection>

      <SettingsSection
        id="session"
        title="Session Settings"
        icon="icon-clock"
        isOpen={openSection === 'session'}
        onToggle={() => toggle('session')}
      >
        <SessionSettings />
      </SettingsSection>

      <SettingsSection
        id="password"
        title="Password Policy"
        icon="icon-lock"
        isOpen={openSection === 'password'}
        onToggle={() => toggle('password')}
      >
        <PasswordPolicySettings />
      </SettingsSection>

      <SettingsSection
        id="backup"
        title="Backup Settings"
        icon="icon-backup"
        isOpen={openSection === 'backup'}
        onToggle={() => toggle('backup')}
      >
        <BackupSettings />
      </SettingsSection>

      <SettingsSection
        id="ssh"
        title="SSH Settings"
        icon="icon-terminal"
        isOpen={openSection === 'ssh'}
        onToggle={() => toggle('ssh')}
      >
        <SshSettings />
      </SettingsSection>

      <SettingsSection
        id="panel-port"
        title="Panel Port"
        icon="icon-settings"
        isOpen={openSection === 'panel-port'}
        onToggle={() => toggle('panel-port')}
      >
        <PanelPortSettings />
      </SettingsSection>

      <SettingsSection
        id="webserver"
        title="Default Webserver"
        icon="icon-server"
        isOpen={openSection === 'webserver'}
        onToggle={() => toggle('webserver')}
      >
        <WebserverSettings />
      </SettingsSection>

      <SettingsSection
        id="ssl-email"
        title="SSL Email"
        icon="icon-lock"
        isOpen={openSection === 'ssl-email'}
        onToggle={() => toggle('ssl-email')}
      >
        <SslEmailSettings />
      </SettingsSection>

      <SettingsSection
        id="maintenance"
        title="Maintenance Mode"
        icon="icon-alert-circle"
        isOpen={openSection === 'maintenance'}
        onToggle={() => toggle('maintenance')}
      >
        <MaintenanceSettings />
      </SettingsSection>

      <SettingsSection
        id="retention"
        title="Data Retention"
        icon="icon-clipboard"
        isOpen={openSection === 'retention'}
        onToggle={() => toggle('retention')}
      >
        <DataRetentionSettings />
      </SettingsSection>

      <SettingsSection
        id="system-info"
        title="System Info"
        icon="icon-info"
        isOpen={openSection === 'system-info'}
        onToggle={() => toggle('system-info')}
      >
        <SystemInfoSettings />
      </SettingsSection>

      <SettingsSection
        id="power"
        title="Server Power"
        icon="icon-power"
        isOpen={openSection === 'power'}
        onToggle={() => toggle('power')}
      >
        <PowerControls
          onReboot={() => setRebootConfirmOpen(true)}
          onShutdown={() => setShutdownConfirmOpen(true)}
        />
      </SettingsSection>

      <ConfirmDialog
        isOpen={rebootConfirmOpen}
        onClose={() => setRebootConfirmOpen(false)}
        onConfirm={() => {
          reboot.mutate(undefined, {
            onSuccess: () => {
              toast.success('Server is rebooting — you will be disconnected');
              setRebootConfirmOpen(false);
            },
            onError: (err) => toast.error(`Failed to reboot: ${err.message}`),
          });
        }}
        title="Reboot Server"
        description="This will restart your server. Active connections will be interrupted."
        confirmText="Reboot"
        impact="high"
      />

      <ConfirmDialog
        isOpen={shutdownConfirmOpen}
        onClose={() => setShutdownConfirmOpen(false)}
        onConfirm={() => {
          shutdown.mutate(undefined, {
            onSuccess: () => {
              toast.success('Server is shutting down — you will be disconnected');
              setShutdownConfirmOpen(false);
            },
            onError: (err) => toast.error(`Failed to shutdown: ${err.message}`),
          });
        }}
        title="Shutdown Server"
        description="This will power off your server. You will need to manually restart it."
        confirmText="Shutdown"
        impact="high"
      />
    </div>
  );
}

function SettingsSection({
  id,
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon name={icon as any} size={18} className="text-foreground-secondary" />
          <span className="text-card-title font-medium">{title}</span>
        </div>
        <Icon
          name="icon-chevron-down"
          size={16}
          className={`text-foreground-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-border-tertiary pt-4">{children}</div>}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-meta font-medium">{label}</span>
      {children}
    </div>
  );
}

function IdentitySettings() {
  const { data, isLoading } = useServerIdentity();
  const mutation = useUpdateServerIdentity();
  const [hostname, setHostname] = useState('');

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const values = data || { hostname: '', domain: '' };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Hostname">
        <Input value={hostname || values.hostname} onChange={(e) => setHostname(e.target.value)} />
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { hostname },
            {
              onSuccess: () => toast.success('Server identity updated'),
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function PhpSettings() {
  const { data, isLoading } = usePhpVersion();
  const mutation = useUpdatePhpVersion();
  const [version, setVersion] = useState('');

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const current = version || data?.version || '';

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Default PHP Version">
        <select
          value={current}
          onChange={(e) => setVersion(e.target.value)}
          className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
        >
          {['8.1', '8.2', '8.3', '8.4'].map((v) => (
            <option key={v} value={v}>
              PHP {v}
            </option>
          ))}
        </select>
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(version, {
            onSuccess: () => toast.success('Default PHP version updated'),
            onError: (err) => toast.error(`Failed to update: ${err.message}`),
          });
        }}
      >
        Save
      </Button>
    </div>
  );
}

function NameserverSettings() {
  const { data, isLoading } = useNameserverSettings();
  const mutation = useUpdateNameserverSettings();
  const verifyMutation = useVerifyNameserver();
  const [ns1, setNs1] = useState('');
  const [ns2, setNs2] = useState('');
  const [ns1Result, setNs1Result] = useState<any>(null);
  const [ns2Result, setNs2Result] = useState<any>(null);
  const [verifyingNs1, setVerifyingNs1] = useState(false);
  const [verifyingNs2, setVerifyingNs2] = useState(false);

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const vals = data || { ns1: '', ns2: '' };

  const handleVerifyNs1 = async () => {
    const hostname = ns1.trim() || vals.ns1;
    if (!hostname) return;
    setVerifyingNs1(true);
    setNs1Result(null);
    try {
      const result = await verifyMutation.mutateAsync(hostname);
      setNs1Result(result);
    } catch (err: any) {
      setNs1Result({ isResolvable: false, error: err.message || 'Verification failed', hostname });
    }
    setVerifyingNs1(false);
  };

  const handleVerifyNs2 = async () => {
    const hostname = ns2.trim() || vals.ns2;
    if (!hostname) return;
    setVerifyingNs2(true);
    setNs2Result(null);
    try {
      const result = await verifyMutation.mutateAsync(hostname);
      setNs2Result(result);
    } catch (err: any) {
      setNs2Result({ isResolvable: false, error: err.message || 'Verification failed', hostname });
    }
    setVerifyingNs2(false);
  };

  const effectiveNs1 = ns1.trim() || vals.ns1;
  const effectiveNs2 = ns2.trim() || vals.ns2;

  const canSave = (ns1.trim() ? ns1Result?.isResolvable !== false : true) &&
                  (ns2.trim() ? ns2Result?.isResolvable !== false : true) &&
                  (ns1.trim() || ns2.trim());

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <p className="text-small text-foreground-secondary">
        These are the <strong>glue records</strong> — nameserver hostnames that must have A records at your domain registrar.
        When users set your domain's NS to<span className="font-mono">{vals.ns1 || 'ns1.example.com'}</span>, the registrar needs an A record for that hostname to make it resolvable.
      </p>
      <Field label="Nameserver 1">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input value={ns1 || vals.ns1} onChange={(e) => { setNs1(e.target.value); setNs1Result(null); }} placeholder="ns1.example.com" />
          </div>
          <Button variant="default" size="small" loading={verifyingNs1} onClick={handleVerifyNs1} disabled={!effectiveNs1}>
            Verify
          </Button>
        </div>
        {ns1Result && (
          <div className={`mt-2 p-3 rounded text-small ${ns1Result.isResolvable ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {ns1Result.isResolvable ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{ns1Result.hostname} → {ns1Result.resolvesTo.join(', ')}</span>
                </div>
                <p className="text-xs mt-1 opacity-80">Glue record is valid.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-medium">Nameserver verification failed</span>
                </div>
                <p className="text-xs">{ns1Result.error}</p>
                {ns1Result.parentDomainNs && ns1Result.parentDomainNs.length > 0 && (
                  <div className="text-xs p-2 bg-black/10 rounded">
                    <p className="font-medium">Current domain NS records:</p>
                    <p className="font-mono">{ns1Result.parentDomainNs.join(', ')}</p>
                  </div>
                )}
                {ns1Result.isListedInParentNs === false && ns1Result.parentDomainNs && ns1Result.parentDomainNs.length > 0 && (
                  <div className="text-xs p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                    <p className="font-medium text-yellow-600">Step 1:</p>
                    <p>Add {ns1Result.hostname} to your domain's NS records at your registrar.</p>
                    <p className="font-medium text-yellow-600 mt-1">Step 2:</p>
                    <p>Add an A record for {ns1Result.hostname} pointing to your server IP.</p>
                  </div>
                )}
                {ns1Result.parentDomainNs && ns1Result.parentDomainNs.length === 0 && ns1Result.parentDomainHasA && (
                  <div className="text-xs p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                    <p className="font-medium text-yellow-600">Step 1:</p>
                    <p>Set NS records at your registrar to your nameservers (e.g., {ns1Result.hostname}).</p>
                    <p className="font-medium text-yellow-600 mt-1">Step 2:</p>
                    <p>Add A records for each nameserver hostname pointing to your server IP.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Field>
      <Field label="Nameserver 2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input value={ns2 || vals.ns2} onChange={(e) => { setNs2(e.target.value); setNs2Result(null); }} placeholder="ns2.example.com" />
          </div>
          <Button variant="default" size="small" loading={verifyingNs2} onClick={handleVerifyNs2} disabled={!effectiveNs2}>
            Verify
          </Button>
        </div>
        {ns2Result && (
          <div className={`mt-2 p-3 rounded text-small ${ns2Result.isResolvable ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {ns2Result.isResolvable ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{ns2Result.hostname} → {ns2Result.resolvesTo.join(', ')}</span>
                </div>
                <p className="text-xs mt-1 opacity-80">Glue record is valid.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-medium">Nameserver verification failed</span>
                </div>
                <p className="text-xs">{ns2Result.error}</p>
                {ns2Result.parentDomainNs && ns2Result.parentDomainNs.length > 0 && (
                  <div className="text-xs p-2 bg-black/10 rounded">
                    <p className="font-medium">Current domain NS records:</p>
                    <p className="font-mono">{ns2Result.parentDomainNs.join(', ')}</p>
                  </div>
                )}
                {ns2Result.isListedInParentNs === false && ns2Result.parentDomainNs && ns2Result.parentDomainNs.length > 0 && (
                  <div className="text-xs p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                    <p className="font-medium text-yellow-600">Step 1:</p>
                    <p>Add {ns2Result.hostname} to your domain's NS records at your registrar.</p>
                    <p className="font-medium text-yellow-600 mt-1">Step 2:</p>
                    <p>Add an A record for {ns2Result.hostname} pointing to your server IP.</p>
                  </div>
                )}
                {ns2Result.parentDomainNs && ns2Result.parentDomainNs.length === 0 && ns2Result.parentDomainHasA && (
                  <div className="text-xs p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                    <p className="font-medium text-yellow-600">Step 1:</p>
                    <p>Set NS records at your registrar to your nameservers (e.g., {ns2Result.hostname}).</p>
                    <p className="font-medium text-yellow-600 mt-1">Step 2:</p>
                    <p>Add A records for each nameserver hostname pointing to your server IP.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        disabled={!canSave}
        onClick={() => {
          const payload: any = {};
          if (ns1.trim()) payload.ns1 = ns1.trim();
          if (ns2.trim()) payload.ns2 = ns2.trim();
          mutation.mutate(
            payload,
            {
              onSuccess: () => {
                toast.success('Nameservers updated');
                setNs1Result(null);
                setNs2Result(null);
              },
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function TimezoneSettings() {
  const { data: tz, isLoading } = useTimezone();
  const { data: timezones } = useAvailableTimezones();
  const mutation = useUpdateTimezone();
  const [value, setValue] = useState('');

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const current = value || tz?.timezone || '';

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Timezone">
        <select
          value={current}
          onChange={(e) => setValue(e.target.value)}
          className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
        >
          {(timezones || []).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(value, {
            onSuccess: () => toast.success('Timezone updated'),
            onError: (err) => toast.error(`Failed to update: ${err.message}`),
          });
        }}
      >
        Save
      </Button>
    </div>
  );
}

function SessionSettings() {
  const { data, isLoading } = useSessionSettings();
  const mutation = useUpdateSessionSettings();
  const [timeout, setTimeout] = useState(0);

  if (isLoading) return <div className="skeleton h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Session Timeout (minutes)">
        <Input
          type="number"
          value={timeout || data?.timeout || 0}
          onChange={(e) => setTimeout(Number(e.target.value))}
        />
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { timeout },
            {
              onSuccess: () => toast.success('Session settings updated'),
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function PasswordPolicySettings() {
  const { data, isLoading } = usePasswordPolicy();
  const mutation = useUpdatePasswordPolicy();
  const [minLength, setMinLength] = useState(0);
  const [requireUppercase, setRequireUppercase] = useState(false);
  const [requireNumbers, setRequireNumbers] = useState(false);
  const [requireSpecial, setRequireSpecial] = useState(false);

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const vals = data || { minLength: 8, requireUppercase: false, requireNumbers: false, requireSpecialChars: false };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Minimum Length">
        <Input type="number" value={minLength || vals.minLength} onChange={(e) => setMinLength(Number(e.target.value))} />
      </Field>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={requireUppercase || vals.requireUppercase}
          onChange={(e) => setRequireUppercase(e.target.checked)}
          className="accent-foreground-info"
        />
        <label className="text-small">Require uppercase letters</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={requireNumbers || vals.requireNumbers}
          onChange={(e) => setRequireNumbers(e.target.checked)}
          className="accent-foreground-info"
        />
        <label className="text-small">Require numbers</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={requireSpecial || vals.requireSpecialChars}
          onChange={(e) => setRequireSpecial(e.target.checked)}
          className="accent-foreground-info"
        />
        <label className="text-small">Require special characters</label>
      </div>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { minLength, requireUppercase, requireNumbers, requireSpecialChars: requireSpecial },
            {
              onSuccess: () => toast.success('Password policy updated'),
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function BackupSettings() {
  const { data, isLoading } = useBackupSettings();
  const mutation = useUpdateBackupSettings();
  const [retention, setRetention] = useState(0);

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const vals = data || { retentionDays: 7, schedule: '', enabled: false, backupPath: '' };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Retention (days)">
        <Input
          type="number"
          value={retention || vals.retentionDays}
          onChange={(e) => setRetention(Number(e.target.value))}
        />
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { retentionDays: retention },
            {
              onSuccess: () => toast.success('Backup settings updated'),
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function SshSettings() {
  const { data, isLoading } = useSshSettings();
  const mutation = useUpdateSshSettings();
  const [port, setPort] = useState(0);
  const [pubkeyAuth, setPubkeyAuth] = useState(false);
  const [permitRoot, setPermitRoot] = useState(false);

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const vals = data || { port: 22, pubkeyAuth: true, permitRootLogin: false, passwordAuth: true };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="SSH Port">
        <Input type="number" value={port || vals.port} onChange={(e) => setPort(Number(e.target.value))} />
      </Field>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={pubkeyAuth || vals.pubkeyAuth}
          onChange={(e) => setPubkeyAuth(e.target.checked)}
          className="accent-foreground-info"
        />
        <label className="text-small">Public key authentication</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={permitRoot || vals.permitRootLogin}
          onChange={(e) => setPermitRoot(e.target.checked)}
          className="accent-foreground-info"
        />
        <label className="text-small">Permit root login</label>
      </div>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { port, pubkeyAuth, permitRootLogin: permitRoot },
            {
              onSuccess: () => toast.success('SSH settings updated'),
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function PanelPortSettings() {
  const { data, isLoading } = usePanelPort();
  const mutation = useUpdatePanelPort();
  const [port, setPort] = useState(0);

  if (isLoading) return <div className="skeleton h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Panel Port">
        <Input type="number" value={port || data?.port || 0} onChange={(e) => setPort(Number(e.target.value))} />
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(port, {
            onSuccess: () => toast.success('Panel port updated — restart required'),
            onError: (err) => toast.error(`Failed to update: ${err.message}`),
          });
        }}
      >
        Save
      </Button>
    </div>
  );
}

function WebserverSettings() {
  const { data, isLoading } = useDefaultWebServer();
  const mutation = useUpdateDefaultWebServer();
  const [mode, setMode] = useState('');

  if (isLoading) return <div className="skeleton h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Default Webserver">
        <select
          value={mode || data?.mode || ''}
          onChange={(e) => setMode(e.target.value)}
          className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
        >
          <option value="nginx">Nginx</option>
          <option value="apache">Apache</option>
        </select>
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(mode, {
            onSuccess: () => toast.success('Default webserver updated'),
            onError: (err) => toast.error(`Failed to update: ${err.message}`),
          });
        }}
      >
        Save
      </Button>
    </div>
  );
}

function SslEmailSettings() {
  const { data, isLoading } = useSslEmail();
  const mutation = useUpdateSslEmail();
  const [email, setEmail] = useState('');

  if (isLoading) return <div className="skeleton h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="SSL Notification Email">
        <Input
          type="email"
          value={email || data?.email || ''}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
        />
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(email, {
            onSuccess: () => toast.success('SSL email updated'),
            onError: (err) => toast.error(`Failed to update: ${err.message}`),
          });
        }}
      >
        Save
      </Button>
    </div>
  );
}

function MaintenanceSettings() {
  const { data, isLoading } = useMaintenanceMode();
  const mutation = useUpdateMaintenanceMode();

  if (isLoading) return <div className="skeleton h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-small font-medium">
          Maintenance mode is {data?.enabled ? 'enabled' : 'disabled'}
        </span>
      </div>
      <Button
        variant={data?.enabled ? 'default' : 'primary'}
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(!data?.enabled, {
            onSuccess: () =>
              toast.success(data?.enabled ? 'Maintenance mode disabled' : 'Maintenance mode enabled'),
            onError: (err) => toast.error(`Failed to update: ${err.message}`),
          });
        }}
      >
        {data?.enabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
      </Button>
    </div>
  );
}

function DataRetentionSettings() {
  const { data, isLoading } = useDataRetention();
  const mutation = useUpdateDataRetention();
  const [auditDays, setAuditDays] = useState(0);
  const [logDays, setLogDays] = useState(0);

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  const vals = data || { auditLogRetentionDays: 90, logRetentionDays: 30, backupRetentionCount: 7 };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Field label="Audit Log Retention (days)">
        <Input
          type="number"
          value={auditDays || vals.auditLogRetentionDays}
          onChange={(e) => setAuditDays(Number(e.target.value))}
        />
      </Field>
      <Field label="Log Retention (days)">
        <Input
          type="number"
          value={logDays || vals.logRetentionDays}
          onChange={(e) => setLogDays(Number(e.target.value))}
        />
      </Field>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { auditLogRetentionDays: auditDays, logRetentionDays: logDays },
            {
              onSuccess: () => toast.success('Data retention updated'),
              onError: (err) => toast.error(`Failed to update: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function SystemInfoSettings() {
  const { data, isLoading } = useSystemInfo();

  if (isLoading) return <div className="skeleton h-48 w-full" />;
  if (!data) return <p className="text-small text-foreground-secondary">No data available</p>;

  return (
    <div className="grid grid-cols-2 gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">Operating System</span>
        <span className="text-small text-foreground-secondary">{data.os}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">Kernel</span>
        <span className="text-small text-foreground-secondary">{data.kernel}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">Architecture</span>
        <span className="text-small text-foreground-secondary">{data.arch}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">Hostname</span>
        <span className="text-small text-foreground-secondary">{data.hostname}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">CPU</span>
        <span className="text-small text-foreground-secondary">{data.cpu?.model} ({data.cpu?.cores} cores)</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">RAM</span>
        <span className="text-small text-foreground-secondary">
          {Math.round(data.ram?.used / 1024 / 1024 / 1024)} GB / {Math.round(data.ram?.total / 1024 / 1024 / 1024)} GB
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">Uptime</span>
        <span className="text-small text-foreground-secondary">
          {Math.floor(data.uptime / 86400)}d {Math.floor((data.uptime % 86400) / 3600)}h
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta font-medium">Software Versions</span>
        <span className="text-small text-foreground-secondary font-mono">
          nginx {data.softwareVersions?.nginx} / php {data.softwareVersions?.php}
        </span>
      </div>
    </div>
  );
}

function PowerControls({
  onReboot,
  onShutdown,
}: {
  onReboot: () => void;
  onShutdown: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Button
        variant="default"
        icon={<Icon name="icon-refresh-cw" size={15} />}
        onClick={onReboot}
      >
        Reboot Server
      </Button>
      <Button
        variant="danger"
        icon={<Icon name="icon-power" size={15} />}
        onClick={onShutdown}
      >
        Shutdown Server
      </Button>
    </div>
  );
}