import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  usePhpConfig,
  usePhpVersions,
  useSetPhpVersion,
  useUpdatePhpLimits,
  useUpdatePoolSettings,
  useRestartFpm,
  usePhpIni,
  useUpdatePhpIni,
  type PhpConfig,
} from '../../api/hooks/php';
import { Icon } from '../icons';
import { toast } from '../../lib/toast';

interface PhpConfigEditorProps {
  siteId: string;
  domainName: string;
  domainId: string;
}

// Recommended values for PHP settings
const RECOMMENDED_VALUES = {
  memoryLimit: '256M',
  maxExecutionTime: 300,
  maxInputTime: 300,
  uploadMaxFilesize: '64M',
  postMaxSize: '128M',
  maxFileUploads: 20,
};

// Common PHP directives grouped by category
const PHP_DIRECTIVE_GROUPS = [
  {
    category: 'Memory & Execution',
    directives: [
      { key: 'memoryLimit', label: 'Memory Limit', type: 'string', recommended: RECOMMENDED_VALUES.memoryLimit, placeholder: '256M' },
      { key: 'maxExecutionTime', label: 'Max Execution Time', type: 'number', recommended: RECOMMENDED_VALUES.maxExecutionTime, placeholder: '300' },
      { key: 'maxInputTime', label: 'Max Input Time', type: 'number', recommended: RECOMMENDED_VALUES.maxInputTime, placeholder: '300' },
    ],
  },
  {
    category: 'File Uploads',
    directives: [
      { key: 'uploadMaxFilesize', label: 'Upload Max Filesize', type: 'string', recommended: RECOMMENDED_VALUES.uploadMaxFilesize, placeholder: '64M' },
      { key: 'postMaxSize', label: 'Post Max Size', type: 'string', recommended: RECOMMENDED_VALUES.postMaxSize, placeholder: '128M' },
      { key: 'maxFileUploads', label: 'Max File Uploads', type: 'number', recommended: RECOMMENDED_VALUES.maxFileUploads, placeholder: '20' },
    ],
  },
];

export function PhpConfigEditor({ siteId, domainName, domainId }: PhpConfigEditorProps) {
  const { data: phpConfig, isLoading, refetch } = usePhpConfig(domainName);
  const { data: versionsData } = usePhpVersions();
  const phpIni = usePhpIni(domainId);
  
  const setPhpVersion = useSetPhpVersion();
  const updateLimits = useUpdatePhpLimits();
  const updatePoolSettings = useUpdatePoolSettings();
  const restartFpm = useRestartFpm();
  const updatePhpIni = useUpdatePhpIni();

  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showIniEditor, setShowIniEditor] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [selectedVersion, setSelectedVersion] = useState('');
  const [iniContent, setIniContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state for limits
  const [limits, setLimits] = useState<Record<string, any>>({});

  // Initialize limits when config loads
  const initLimits = () => {
    if (phpConfig?.limits) {
      setLimits({
        memoryLimit: phpConfig.limits.memoryLimit || '',
        maxExecutionTime: phpConfig.limits.maxExecutionTime || 0,
        maxInputTime: phpConfig.limits.maxInputTime || 0,
        uploadMaxFilesize: phpConfig.limits.uploadMaxFilesize || '',
        postMaxSize: phpConfig.limits.postMaxSize || '',
        maxFileUploads: phpConfig.limits.maxFileUploads || 0,
      });
    }
  };

  // Load config into form when available
  if (phpConfig && Object.keys(limits).length === 0) {
    initLimits();
  }

  const handleLimitChange = (key: string, value: any) => {
    setLimits(prev => ({ ...prev, [key]: value }));
    setPendingChanges(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveLimits = async () => {
    try {
      await updateLimits.mutateAsync({ domainId, ...pendingChanges });
      toast.success('PHP limits updated');
      setPendingChanges({});
      setHasChanges(false);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to update limits: ${err.message}`);
    }
  };

  const handleResetLimits = () => {
    if (phpConfig?.limits) {
      setLimits({ ...phpConfig.limits });
      setPendingChanges({});
      setHasChanges(false);
    }
  };

  const handleVersionChange = async () => {
    if (!selectedVersion) return;
    
    try {
      await setPhpVersion.mutateAsync({ domainId, phpVersion: selectedVersion });
      toast.success(`PHP version changed to ${selectedVersion}`);
      setShowVersionModal(false);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to change PHP version: ${err.message}`);
    }
  };

  const handleRestartFpm = async () => {
    try {
      await restartFpm.mutateAsync(domainId);
      toast.success('PHP-FPM restarted successfully');
      setShowRestartConfirm(false);
    } catch (err: any) {
      toast.error(`Failed to restart PHP-FPM: ${err.message}`);
    }
  };

  const handleOpenIniEditor = () => {
    if (phpIni.data?.content) {
      setIniContent(phpIni.data.content);
    }
    setShowIniEditor(true);
  };

  const handleSaveIni = async () => {
    try {
      await updatePhpIni.mutateAsync({ domainId, content: iniContent });
      toast.success('php.ini updated');
      setShowIniEditor(false);
      phpIni.refetch();
    } catch (err: any) {
      toast.error(`Failed to update php.ini: ${err.message}`);
    }
  };

  const getValueStatus = (key: string, currentValue: any, recommendedValue: any) => {
    const current = String(currentValue).toLowerCase();
    const recommended = String(recommendedValue).toLowerCase();
    
    if (current === recommended) return 'good';
    
    // Parse size values like 256M, 128M
    const parseSize = (val: string) => {
      const match = val.match(/^(\d+)([KMG]?)$/i);
      if (!match) return parseFloat(val);
      const num = parseFloat(match[1]);
      const unit = match[2]?.toUpperCase();
      if (unit === 'K') return num * 1024;
      if (unit === 'M') return num * 1024 * 1024;
      if (unit === 'G') return num * 1024 * 1024 * 1024;
      return num;
    };

    // For size values, check if current is >= recommended
    if (typeof recommendedValue === 'string' && recommendedValue.match(/^\d+[KMG]?$/i)) {
      const currentNum = parseSize(currentValue);
      const recommendedNum = parseSize(recommendedValue);
      if (currentNum >= recommendedNum) return 'good';
      if (currentNum < recommendedNum * 0.5) return 'bad';
      return 'warning';
    }

    // For numeric values
    if (typeof recommendedValue === 'number') {
      if (currentValue >= recommendedValue) return 'good';
      if (currentValue < recommendedValue * 0.5) return 'bad';
      return 'warning';
    }

    return 'unknown';
  };

  if (isLoading) {
    return (
      <Card title="PHP Configuration">
        <div className="flex items-center justify-center py-8">
          <span className="text-small text-foreground-tertiary">Loading PHP configuration...</span>
        </div>
      </Card>
    );
  }

  const currentVersion = phpConfig?.phpVersion || versionsData?.versions?.[0]?.version || '—';
  const availableVersions = versionsData?.versions || [];

  return (
    <div className="space-y-6">
      {/* PHP Version & Status */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="PHP Version">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[24px] font-medium">{currentVersion}</div>
                <div className="text-meta text-foreground-tertiary">
                  Handler: {phpConfig?.phpHandler || 'FPM'}
                </div>
              </div>
              <Button 
                size="small" 
                variant="ghost" 
                onClick={() => {
                  setSelectedVersion(currentVersion);
                  setShowVersionModal(true);
                }}
                icon={<Icon name="icon-edit" size={15} />}
              >
                Change
              </Button>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border-tertiary">
              <div className="text-center">
                <div className="text-small font-medium">{limits.memoryLimit || '—'}</div>
                <div className="text-meta text-foreground-tertiary">Memory</div>
              </div>
              <div className="text-center">
                <div className="text-small font-medium">{limits.maxExecutionTime || '—'}s</div>
                <div className="text-meta text-foreground-tertiary">Max Time</div>
              </div>
              <div className="text-center">
                <div className="text-small font-medium">{limits.uploadMaxFilesize || '—'}</div>
                <div className="text-meta text-foreground-tertiary">Upload</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="PHP-FPM Status">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-foreground-success" />
              <span className="text-small font-medium">Running</span>
            </div>
            <div className="space-y-2 text-small text-foreground-secondary">
              <div className="flex justify-between">
                <span>Pool</span>
                <span className="font-mono">{phpConfig?.domain || domainName}</span>
              </div>
              <div className="flex justify-between">
                <span>Process Manager</span>
                <span>{phpConfig?.poolSettings?.pm || 'dynamic'}</span>
              </div>
              <div className="flex justify-between">
                <span>Max Children</span>
                <span>{phpConfig?.poolSettings?.maxChildren || '—'}</span>
              </div>
            </div>
            <Button 
              variant="default" 
              size="small" 
              onClick={() => setShowRestartConfirm(true)}
              icon={<Icon name="icon-refresh" size={15} />}
            >
              Restart PHP-FPM
            </Button>
          </div>
        </Card>
      </div>

      {/* PHP Limits Editor */}
      <Card 
        title="PHP Limits" 
        action={
          <div className="flex gap-2">
            {hasChanges && (
              <>
                <Button 
                  size="small" 
                  variant="ghost" 
                  onClick={handleResetLimits}
                  icon={<Icon name="icon-undo" size={15} />}
                >
                  Reset
                </Button>
                <Button 
                  size="small" 
                  variant="primary" 
                  onClick={handleSaveLimits}
                  loading={updateLimits.isPending}
                  icon={<Icon name="icon-check" size={15} />}
                >
                  Save Changes
                </Button>
              </>
            )}
          </div>
        }
      >
        {/* Info Banner */}
        <div className="mb-4 p-3 bg-background-secondary rounded-lg border border-border-tertiary">
          <div className="flex items-start gap-2">
            <Icon name="icon-info" size={16} className="text-foreground-tertiary mt-0.5 flex-shrink-0" />
            <div className="text-meta text-foreground-secondary">
              <span className="font-medium text-foreground-primary">Recommended values</span> are optimized for most web applications.
              Values shown in green meet or exceed recommendations.
            </div>
          </div>
        </div>

        {PHP_DIRECTIVE_GROUPS.map((group) => (
          <div key={group.category} className="mb-6">
            <h4 className="text-small font-medium text-foreground-secondary mb-3">{group.category}</h4>
            <div className="space-y-3">
              {group.directives.map((directive) => {
                const currentValue = limits[directive.key] ?? '';
                const status = getValueStatus(directive.key, currentValue, directive.recommended);
                
                return (
                  <div 
                    key={directive.key}
                    className="grid grid-cols-12 gap-4 items-center p-3 bg-background-secondary rounded-lg border border-border-tertiary hover:border-border-secondary transition-colors"
                  >
                    <div className="col-span-4">
                      <span className="text-small font-medium">{directive.label}</span>
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={currentValue}
                        onChange={(e) => handleLimitChange(directive.key, e.target.value)}
                        placeholder={directive.placeholder}
                      />
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-meta text-foreground-tertiary">Recommended:</span>
                      <span className="text-meta font-medium ml-1">{directive.recommended}</span>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <span 
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-meta ${
                          status === 'good' 
                            ? 'bg-foreground-success/10 text-foreground-success' 
                            : status === 'warning'
                            ? 'bg-foreground-warning/10 text-foreground-warning'
                            : status === 'bad'
                            ? 'bg-foreground-danger/10 text-foreground-danger'
                            : 'bg-background-tertiary text-foreground-tertiary'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          status === 'good' ? 'bg-foreground-success' 
                            : status === 'warning' ? 'bg-foreground-warning'
                            : status === 'bad' ? 'bg-foreground-danger'
                            : 'bg-foreground-tertiary'
                        }`} />
                        {status === 'good' ? 'Optimal' : status === 'warning' ? 'Low' : status === 'bad' ? 'Too Low' : 'Unknown'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      {/* Pool Settings */}
      {phpConfig?.poolSettings && (
        <Card title="PHP-FPM Pool Settings">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-meta text-foreground-tertiary">Process Manager</div>
              <div className="text-small font-medium">{phpConfig.poolSettings.pm}</div>
            </div>
            <div className="space-y-2">
              <div className="text-meta text-foreground-tertiary">Max Children</div>
              <div className="text-small font-medium">{phpConfig.poolSettings.maxChildren}</div>
            </div>
            <div className="space-y-2">
              <div className="text-meta text-foreground-tertiary">Start Servers</div>
              <div className="text-small font-medium">{phpConfig.poolSettings.startServers}</div>
            </div>
            <div className="space-y-2">
              <div className="text-meta text-foreground-tertiary">Min Spare Servers</div>
              <div className="text-small font-medium">{phpConfig.poolSettings.minSpareServers}</div>
            </div>
            <div className="space-y-2">
              <div className="text-meta text-foreground-tertiary">Max Spare Servers</div>
              <div className="text-small font-medium">{phpConfig.poolSettings.maxSpareServers}</div>
            </div>
            <div className="space-y-2">
              <div className="text-meta text-foreground-tertiary">Request Terminate Timeout</div>
              <div className="text-small font-medium">{phpConfig.poolSettings.requestTerminateTimeout}s</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-tertiary">
            <Button variant="ghost" size="small" disabled>
              Advanced Pool Settings (Coming Soon)
            </Button>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card title="Advanced">
        <div className="flex gap-4">
          <Button 
            variant="default" 
            size="small" 
            onClick={handleOpenIniEditor}
            icon={<Icon name="icon-file-text" size={15} />}
          >
            Edit php.ini Directly
          </Button>
          <Button 
            variant="ghost" 
            size="small" 
            onClick={() => window.open(`/php/${domainId}/info`, '_blank')}
            icon={<Icon name="icon-external-link" size={15} />}
          >
            View PHP Info
          </Button>
        </div>
      </Card>

      {/* Version Change Modal */}
      <Modal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        title="Change PHP Version"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowVersionModal(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={handleVersionChange}
              loading={setPhpVersion.isPending}
              disabled={!selectedVersion || selectedVersion === currentVersion}
            >
              Change Version
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">
            Select a PHP version for <span className="font-mono">{domainName}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {availableVersions.map((version: any) => (
              <button
                key={version.version}
                onClick={() => setSelectedVersion(version.version)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  selectedVersion === version.version
                    ? 'border-foreground-primary bg-foreground-primary/5'
                    : 'border-border-tertiary hover:border-border-secondary'
                }`}
              >
                <div className="text-small font-medium">PHP {version.version}</div>
                <div className="text-meta text-foreground-tertiary">
                  {version.fpm?.active ? `FPM Port ${version.fpm.port || 'default'}` : 'FPM not available'}
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 bg-foreground-warning/10 rounded-md">
            <div className="text-meta text-foreground-warning">
              Changing PHP version will restart PHP-FPM and may temporarily affect your site.
            </div>
          </div>
        </div>
      </Modal>

      {/* php.ini Editor Modal */}
      <Modal
        isOpen={showIniEditor}
        onClose={() => setShowIniEditor(false)}
        title="Edit php.ini"
        size="large"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowIniEditor(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={handleSaveIni}
              loading={updatePhpIni.isPending}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-small text-foreground-secondary">
              Edit php.ini directly for <span className="font-mono">{domainName}</span>
            </p>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="small"
                onClick={() => setIniContent(phpIni.data?.content || '')}
              >
                Reset
              </Button>
            </div>
          </div>
          <div className="relative">
            <textarea
              value={iniContent}
              onChange={(e) => setIniContent(e.target.value)}
              className="w-full h-[400px] p-4 font-mono text-small bg-black text-foreground-secondary rounded-lg border border-border-tertiary focus:border-foreground-primary focus:outline-none resize-none"
              placeholder="; php.ini content&#10;memory_limit = 256M&#10;max_execution_time = 300&#10;..."
            />
          </div>
          <div className="p-3 bg-foreground-danger/10 rounded-md">
            <div className="flex items-start gap-2">
              <Icon name="icon-alert-circle" size={16} className="text-foreground-danger mt-0.5" />
              <div className="text-meta text-foreground-danger">
                <span className="font-medium">Warning:</span> Direct php.ini editing is for advanced users only.
                Incorrect settings may cause PHP to fail. Always test changes in a development environment first.
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Restart Confirmation */}
      <ConfirmDialog
        isOpen={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={handleRestartFpm}
        title="Restart PHP-FPM"
        description="This will restart the PHP-FPM process for this site. Active requests may fail during the restart."
        confirmText="Restart"
        impact="medium"
        loading={restartFpm.isPending}
      />
    </div>
  );
}