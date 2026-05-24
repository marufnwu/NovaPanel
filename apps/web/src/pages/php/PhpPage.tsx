import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ErrorState } from '../../components/ui/ErrorState';
import { usePhpVersions, usePhpDomains, usePhpConfig, useSetPhpVersion, useUpdatePoolSettings, useUpdatePhpLimits, useUpdatePhpSecurity, type PhpConfig } from '../../api/hooks/php';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function PhpPage() {
  const queryClient = useQueryClient();
  const { data: versionsData, isLoading: versionsLoading } = usePhpVersions();
  const { data: domains } = usePhpDomains();
  const setPhpVersion = useSetPhpVersion();
  const updatePool = useUpdatePoolSettings();
  const updateLimits = useUpdatePhpLimits();
  const updateSecurity = useUpdatePhpSecurity();

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const { data: phpConfig, isLoading: configLoading, isError: configError, error: configErr, refetch: refetchConfig } = usePhpConfig(selectedDomain || '');

  const [showPoolModal, setShowPoolModal] = useState(false);
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Pool settings form state
  const [poolMaxChildren, setPoolMaxChildren] = useState(0);
  const [poolStartServers, setPoolStartServers] = useState(0);
  const [poolMinSpare, setPoolMinSpare] = useState(0);
  const [poolMaxSpare, setPoolMaxSpare] = useState(0);

  // Limits form state
  const [limitsMemory, setLimitsMemory] = useState('');
  const [limitsMaxExec, setLimitsMaxExec] = useState(0);
  const [limitsUploadMax, setLimitsUploadMax] = useState('');
  const [limitsPostMax, setLimitsPostMax] = useState('');

  // Security form state
  const [securityDisabled, setSecurityDisabled] = useState('');

  const handleSetVersion = async (version: string) => {
    if (!selectedDomain) return;
    try {
      await setPhpVersion.mutateAsync({ domainId: selectedDomain, phpVersion: version });
      queryClient.invalidateQueries({ queryKey: ['php'] });
      toast.success(`PHP version updated to ${version}`);
    } catch (err: any) {
      toast.error(`Failed to set PHP version: ${err.message}`);
    }
  };

  const handleSavePool = () => {
    if (!selectedDomain) return;
    updatePool.mutate(
      { domainId: selectedDomain, maxChildren: poolMaxChildren, startServers: poolStartServers, minSpareServers: poolMinSpare, maxSpareServers: poolMaxSpare },
      {
        onSuccess: () => { toast.success('Pool settings saved'); setShowPoolModal(false); },
        onError: (err: any) => toast.error(`Failed to save pool settings: ${err.message}`),
      }
    );
  };

  const handleSaveLimits = () => {
    if (!selectedDomain) return;
    updateLimits.mutate(
      { domainId: selectedDomain, memoryLimit: limitsMemory, maxExecutionTime: limitsMaxExec, uploadMaxFilesize: limitsUploadMax, postMaxSize: limitsPostMax },
      {
        onSuccess: () => { toast.success('PHP limits saved'); setShowLimitsModal(false); },
        onError: (err: any) => toast.error(`Failed to save limits: ${err.message}`),
      }
    );
  };

  const handleSaveSecurity = () => {
    if (!selectedDomain) return;
    updateSecurity.mutate(
      { domainId: selectedDomain, disabledFunctions: securityDisabled.split(',').map(f => f.trim()).filter(Boolean) },
      {
        onSuccess: () => { toast.success('Security settings saved'); setShowSecurityModal(false); },
        onError: (err: any) => toast.error(`Failed to save security settings: ${err.message}`),
      }
    );
  };

  const openPoolModal = () => {
    if (!phpConfig) return;
    setPoolMaxChildren(phpConfig.poolSettings.maxChildren);
    setPoolStartServers(phpConfig.poolSettings.startServers);
    setPoolMinSpare(phpConfig.poolSettings.minSpareServers);
    setPoolMaxSpare(phpConfig.poolSettings.maxSpareServers);
    setShowPoolModal(true);
  };

  const openLimitsModal = () => {
    if (!phpConfig) return;
    setLimitsMemory(phpConfig.limits.memoryLimit);
    setLimitsMaxExec(phpConfig.limits.maxExecutionTime);
    setLimitsUploadMax(phpConfig.limits.uploadMaxFilesize);
    setLimitsPostMax(phpConfig.limits.postMaxSize);
    setShowLimitsModal(true);
  };

  const openSecurityModal = () => {
    if (!phpConfig) return;
    setSecurityDisabled(phpConfig.security.disabledFunctions.join(', '));
    setShowSecurityModal(true);
  };

  useEffect(() => {
    if (!selectedDomain && domains && domains.length > 0) {
      setSelectedDomain(domains[0].id);
    }
  }, [domains, selectedDomain]);

  if (versionsLoading) {
    return <PageSkeleton />;
  }

  const versions = versionsData?.versions || [];
  const domainsList = domains || [];
  if (selectedDomain && configError) return <ErrorState message={configErr?.message} onRetry={refetchConfig} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">PHP</h1>
      </div>

      <Card title="Installed Versions">
        <div className="flex flex-wrap gap-2">
          {versions.map((v) => (
            <div key={v.version} className="flex items-center gap-2 px-4 py-2 bg-background-secondary rounded-lg">
              <span className="font-mono text-small">PHP {v.version}</span>
              <StatusBadge status={v.fpm.active ? 'running' : 'stopped'} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Domain PHP Settings" action={
        <select
          className="h-8 px-3 text-small rounded-md border border-border-tertiary bg-background-primary"
          value={selectedDomain || ''}
          onChange={(e) => setSelectedDomain(e.target.value)}
        >
          <option value="">Select domain...</option>
          {domainsList.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      }>
        {selectedDomain && phpConfig ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-small text-foreground-secondary">Current Version</span>
                <p className="font-mono">{phpConfig.phpVersion}</p>
              </div>
              <div className="flex gap-2">
                {['8.1', '8.2', '8.3', '8.4'].map((v) => (
                  <Button
                    key={v}
                    variant={phpConfig.phpVersion === `php${v}` ? 'primary' : 'default'}
                    size="small"
                    onClick={() => handleSetVersion(`php${v}`)}
                  >
                    PHP {v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-border-tertiary pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-small font-medium">Pool Settings</span>
                <Button variant="ghost" size="small" onClick={openPoolModal}>
                  Edit
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-small">
                <div>
                  <span className="text-foreground-tertiary">Process Manager</span>
                  <p className="font-mono">{phpConfig.poolSettings.pm}</p>
                </div>
                <div>
                  <span className="text-foreground-tertiary">Max Children</span>
                  <p className="font-mono">{phpConfig.poolSettings.maxChildren}</p>
                </div>
                <div>
                  <span className="text-foreground-tertiary">Start Servers</span>
                  <p className="font-mono">{phpConfig.poolSettings.startServers}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border-tertiary pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-small font-medium">PHP Limits</span>
                <Button variant="ghost" size="small" onClick={openLimitsModal}>
                  Edit
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-small">
                <div>
                  <span className="text-foreground-tertiary">Memory Limit</span>
                  <p className="font-mono">{phpConfig.limits.memoryLimit}</p>
                </div>
                <div>
                  <span className="text-foreground-tertiary">Max Execution Time</span>
                  <p className="font-mono">{phpConfig.limits.maxExecutionTime}s</p>
                </div>
                <div>
                  <span className="text-foreground-tertiary">Upload Max</span>
                  <p className="font-mono">{phpConfig.limits.uploadMaxFilesize}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border-tertiary pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-small font-medium">Security</span>
                <Button variant="ghost" size="small" onClick={openSecurityModal}>
                  Edit
                </Button>
              </div>
              <div className="text-small">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-foreground-tertiary">Open Basedir:</span>
                  <StatusBadge status={phpConfig.security.openBasedir ? 'active' : 'inactive'} />
                </div>
                <div>
                  <span className="text-foreground-tertiary">Disabled Functions:</span>
                  <span className="font-mono ml-2">{phpConfig.security.disabledFunctions.length} functions</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-small text-foreground-tertiary text-center py-8">
            {selectedDomain ? 'Loading PHP configuration...' : 'Select a domain to configure PHP settings'}
          </p>
        )}
      </Card>

      <Modal isOpen={showPoolModal} onClose={() => setShowPoolModal(false)} title="Pool Settings" footer={
        <><Button variant="ghost" onClick={() => setShowPoolModal(false)}>Cancel</Button><Button variant="primary" onClick={handleSavePool} loading={updatePool.isPending}>Save</Button></>
      }>
        {phpConfig && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Max Children" type="number" value={poolMaxChildren} onChange={(e) => setPoolMaxChildren(Number(e.target.value))} />
              <Input label="Start Servers" type="number" value={poolStartServers} onChange={(e) => setPoolStartServers(Number(e.target.value))} />
              <Input label="Min Spare" type="number" value={poolMinSpare} onChange={(e) => setPoolMinSpare(Number(e.target.value))} />
              <Input label="Max Spare" type="number" value={poolMaxSpare} onChange={(e) => setPoolMaxSpare(Number(e.target.value))} />
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showLimitsModal} onClose={() => setShowLimitsModal(false)} title="PHP Limits" footer={
        <><Button variant="ghost" onClick={() => setShowLimitsModal(false)}>Cancel</Button><Button variant="primary" onClick={handleSaveLimits} loading={updateLimits.isPending}>Save</Button></>
      }>
        {phpConfig && (
          <div className="space-y-4">
            <Input label="Memory Limit" value={limitsMemory} onChange={(e) => setLimitsMemory(e.target.value)} placeholder="128M" />
            <Input label="Max Execution Time (s)" type="number" value={limitsMaxExec} onChange={(e) => setLimitsMaxExec(Number(e.target.value))} />
            <Input label="Upload Max Filesize" value={limitsUploadMax} onChange={(e) => setLimitsUploadMax(e.target.value)} placeholder="8M" />
            <Input label="Post Max Size" value={limitsPostMax} onChange={(e) => setLimitsPostMax(e.target.value)} placeholder="8M" />
          </div>
        )}
      </Modal>

      <Modal isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} title="PHP Security" footer={
        <><Button variant="ghost" onClick={() => setShowSecurityModal(false)}>Cancel</Button><Button variant="primary" onClick={handleSaveSecurity} loading={updateSecurity.isPending}>Save</Button></>
      }>
        {phpConfig && (
          <div className="space-y-4">
            <div>
              <label className="text-meta font-medium mb-1 block">Disabled Functions (comma separated)</label>
              <textarea
                className="w-full h-24 px-3 py-2 text-small rounded-md border border-border-tertiary bg-background-primary"
                value={securityDisabled}
                onChange={(e) => setSecurityDisabled(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}