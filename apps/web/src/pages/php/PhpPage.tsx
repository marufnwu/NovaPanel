import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { usePhpVersions, usePhpDomains, useSetPhpVersion, useUpdatePoolSettings, useUpdatePhpLimits, useUpdatePhpSecurity, type PhpConfig } from '../../api/hooks/php';
import { Icon } from '../../components/icons';

export function PhpPage() {
  const queryClient = useQueryClient();
  const { data: versionsData, isLoading: versionsLoading } = usePhpVersions();
  const { data: domains } = usePhpDomains();
  const setPhpVersion = useSetPhpVersion();
  const updatePool = useUpdatePoolSettings();
  const updateLimits = useUpdatePhpLimits();
  const updateSecurity = useUpdatePhpSecurity();

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const { data: phpConfig } = usePhpConfig(selectedDomain || '');

  const [showPoolModal, setShowPoolModal] = useState(false);
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const handleSetVersion = async (version: string) => {
    if (!selectedDomain) return;
    try {
      await setPhpVersion.mutateAsync({ domainId: selectedDomain, phpVersion: version });
      queryClient.invalidateQueries({ queryKey: ['php'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (versionsLoading) {
    return <PageSkeleton />;
  }

  const versions = versionsData?.versions || [];
  const domainsList = domains || [];

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
                <Button variant="ghost" size="small" onClick={() => setShowPoolModal(true)}>
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
                <Button variant="ghost" size="small" onClick={() => setShowLimitsModal(true)}>
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
                <Button variant="ghost" size="small" onClick={() => setShowSecurityModal(true)}>
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
        <><Button variant="ghost" onClick={() => setShowPoolModal(false)}>Cancel</Button><Button variant="primary">Save</Button></>
      }>
        {phpConfig && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Max Children" type="number" defaultValue={phpConfig.poolSettings.maxChildren} />
              <Input label="Start Servers" type="number" defaultValue={phpConfig.poolSettings.startServers} />
              <Input label="Min Spare" type="number" defaultValue={phpConfig.poolSettings.minSpareServers} />
              <Input label="Max Spare" type="number" defaultValue={phpConfig.poolSettings.maxSpareServers} />
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showLimitsModal} onClose={() => setShowLimitsModal(false)} title="PHP Limits" footer={
        <><Button variant="ghost" onClick={() => setShowLimitsModal(false)}>Cancel</Button><Button variant="primary">Save</Button></>
      }>
        {phpConfig && (
          <div className="space-y-4">
            <Input label="Memory Limit" defaultValue={phpConfig.limits.memoryLimit} />
            <Input label="Max Execution Time (s)" type="number" defaultValue={phpConfig.limits.maxExecutionTime} />
            <Input label="Upload Max Filesize" defaultValue={phpConfig.limits.uploadMaxFilesize} />
            <Input label="Post Max Size" defaultValue={phpConfig.limits.postMaxSize} />
          </div>
        )}
      </Modal>

      <Modal isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} title="PHP Security" footer={
        <><Button variant="ghost" onClick={() => setShowSecurityModal(false)}>Cancel</Button><Button variant="primary">Save</Button></>
      }>
        {phpConfig && (
          <div className="space-y-4">
            <div>
              <label className="text-meta font-medium mb-1 block">Disabled Functions (comma separated)</label>
              <textarea
                className="w-full h-24 px-3 py-2 text-small rounded-md border border-border-tertiary bg-background-primary"
                defaultValue={phpConfig.security.disabledFunctions.join(', ')}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function usePhpConfig(domainName: string) {
  return useQuery({
    queryKey: ['php', 'config', domainName],
    queryFn: () => {
      if (!domainName) return null;
      return { phpVersion: 'php8.2', phpHandler: 'fpm', customIni: '', poolConfig: '', poolSettings: { pm: 'ondemand', maxChildren: 10, startServers: 2, minSpareServers: 1, maxSpareServers: 5, requestTerminateTimeout: 30 }, limits: { memoryLimit: '128M', maxExecutionTime: 30, maxInputTime: 60, uploadMaxFilesize: '8M', postMaxSize: '8M', maxFileUploads: 20 }, security: { openBasedir: false, disabledFunctions: ['exec', 'system', 'shell_exec'] } } as PhpConfig;
    },
    enabled: !!domainName,
  });
}