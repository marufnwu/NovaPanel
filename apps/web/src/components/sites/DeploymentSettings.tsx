import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  useSiteDeployments,
  useSiteRollback,
  useDeploymentSettings,
  useUpdateDeploymentSettings,
  useDeploymentHooks,
  useTestWebhook,
  type DeploymentSettings,
  type Deployment,
} from '../../api/hooks/sites';
import { Icon } from '../icons';
import { toast } from '../../lib/toast';

interface DeploymentSettingsEditorProps {
  siteId: string;
}

export function DeploymentSettingsEditor({ siteId }: DeploymentSettingsEditorProps) {
  const { data: deployments, refetch, isLoading: deploymentsLoading } = useSiteDeployments(siteId);
  const { data: settings, isLoading: settingsLoading } = useDeploymentSettings(siteId);
  const { data: hooks } = useDeploymentHooks(siteId);
  const updateSettings = useUpdateDeploymentSettings();
  const rollback = useSiteRollback();
  const testWebhook = useTestWebhook();

  const [showSettings, setShowSettings] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Form state for deployment settings
  const [formData, setFormData] = useState<Partial<DeploymentSettings>>({});

  const isLoading = settingsLoading || deploymentsLoading;

  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({ siteId, ...formData });
      toast.success('Deployment settings saved');
      setShowSettings(false);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  const handleRollback = async (deploymentId: string) => {
    try {
      await rollback.mutateAsync({ siteId, deploymentId });
      toast.success('Rollback started');
      setRollbackId(null);
      refetch();
    } catch (err: any) {
      toast.error(`Rollback failed: ${err.message}`);
    }
  };

  const handleTestWebhook = async (hookType: string) => {
    try {
      const result = await testWebhook.mutateAsync({ siteId, hookType });
      toast.success(result.message || 'Webhook test successful');
    } catch (err: any) {
      toast.error(`Webhook test failed: ${err.message}`);
    }
  };

  const openSettingsModal = () => {
    setFormData(settings || {});
    setShowSettings(true);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-success/10 text-foreground-success text-meta">Success</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-warning/10 text-foreground-warning text-meta">Pending</span>;
      case 'building':
      case 'deploying':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-primary/10 text-foreground-primary text-meta">In Progress</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-danger/10 text-foreground-danger text-meta">Failed</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-tertiary/10 text-foreground-tertiary text-meta">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-tertiary/10 text-foreground-tertiary text-meta">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <span className="text-small text-foreground-tertiary">Loading deployment settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deployment Configuration */}
      <Card
        title="Deployment Configuration"
        action={
          <Button size="small" variant="ghost" onClick={openSettingsModal} icon={<Icon name="icon-edit" size={15} />}>
            Configure
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Git Repository Info */}
          <div className="p-3 bg-background-secondary rounded-lg border border-border-tertiary">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="icon-folder" size={16} className="text-foreground-secondary" />
              <span className="text-small font-medium">Git Repository</span>
            </div>
            {settings?.gitRepo ? (
              <div className="space-y-1">
                <div className="font-mono text-small text-foreground-secondary">{settings.gitRepo}</div>
                <div className="text-meta text-foreground-tertiary">
                  Branch: <span className="text-foreground-secondary">{settings.gitBranch || 'main'}</span>
                  {settings.autoDeploy && (
                    <span className="ml-2 text-foreground-success">• Auto-deploy enabled</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-small text-foreground-tertiary">No repository configured</div>
            )}
          </div>

          {/* Build Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-meta text-foreground-tertiary mb-1">Build Command</div>
              <div className="font-mono text-small bg-background-secondary p-2 rounded border border-border-tertiary">
                {settings?.buildCommand || 'npm run build'}
              </div>
            </div>
            <div>
              <div className="text-meta text-foreground-tertiary mb-1">Output Directory</div>
              <div className="font-mono text-small bg-background-secondary p-2 rounded border border-border-tertiary">
                {settings?.outputDirectory || 'dist'}
              </div>
            </div>
          </div>

          {/* Deploy Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-meta text-foreground-tertiary mb-1">Deploy Path</div>
              <div className="font-mono text-small bg-background-secondary p-2 rounded border border-border-tertiary">
                {settings?.deployPath || '/var/www/html'}
              </div>
            </div>
            <div>
              <div className="text-meta text-foreground-tertiary mb-1">Health Check</div>
              <div className="font-mono text-small bg-background-secondary p-2 rounded border border-border-tertiary">
                {settings?.healthCheckPath || '/health'}
              </div>
            </div>
          </div>

          {/* Auto-deploy Toggles */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-small font-medium">Auto-deploy</div>
                <div className="text-meta text-foreground-tertiary">Automatically deploy on code push</div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${settings?.autoDeploy ? 'bg-foreground-success' : 'bg-foreground-tertiary'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings?.autoDeploy ? 'right-1' : 'left-1'}`} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-small font-medium">Auto-rollback</div>
                <div className="text-meta text-foreground-tertiary">Rollback on failed deployment</div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${settings?.autoRollback ? 'bg-foreground-success' : 'bg-foreground-tertiary'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings?.autoRollback ? 'right-1' : 'left-1'}`} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Deployment History */}
      <Card
        title="Deployment History"
        action={
          <div className="flex gap-2">
            <Button size="small" variant="ghost" onClick={() => refetch()} icon={<Icon name="icon-refresh" size={15} />}>
              Refresh
            </Button>
            <Button size="small" variant="ghost" onClick={() => setShowCredentials(true)} icon={<Icon name="icon-key" size={15} />}>
              Credentials
            </Button>
          </div>
        }
      >
        {deployments && deployments.length > 0 ? (
          <div className="space-y-3">
            {deployments.map((deployment: Deployment, index: number) => (
              <div key={deployment.id} className="border border-border-tertiary rounded-lg p-4 hover:bg-background-secondary transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background-tertiary text-small font-medium">
                      #{deployments.length - index}
                    </div>
                    <div>
                      <div className="text-small font-medium">
                        {deployment.commitMessage || deployment.gitRef || 'Manual deployment'}
                      </div>
                      <div className="text-meta text-foreground-tertiary">
                        {deployment.commitSha?.substring(0, 7) || '—'} • {new Date(deployment.createdAt).toLocaleString()} • {formatDuration(deployment.durationMs)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(deployment.status)}
                    {index > 0 && deployment.status === 'success' && (
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => setRollbackId(deployment.id)}
                        icon={<Icon name="icon-undo" size={15} />}
                      >
                        Rollback
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => setExpandedLog(expandedLog === deployment.id ? null : deployment.id)}
                      icon={<Icon name="icon-document" size={15} />}
                    >
                      {expandedLog === deployment.id ? 'Hide' : 'Logs'}
                    </Button>
                  </div>
                </div>

                {expandedLog === deployment.id && (deployment.buildLogs || deployment.deployLogs) && (
                  <div className="mt-3 p-3 bg-black rounded-md font-mono text-small text-foreground-secondary overflow-auto max-h-[200px]">
                    {deployment.buildLogs && (
                      <div className="mb-2">
                        <div className="text-meta text-foreground-tertiary mb-1">Build Logs:</div>
                        <pre className="whitespace-pre-wrap">{deployment.buildLogs}</pre>
                      </div>
                    )}
                    {deployment.deployLogs && (
                      <div>
                        <div className="text-meta text-foreground-tertiary mb-1">Deploy Logs:</div>
                        <pre className="whitespace-pre-wrap">{deployment.deployLogs}</pre>
                      </div>
                    )}
                  </div>
                )}

                {expandedLog === deployment.id && !deployment.buildLogs && !deployment.deployLogs && (
                  <div className="mt-3 p-3 bg-background-secondary rounded-md text-meta text-foreground-tertiary">
                    No logs available for this deployment
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-background-tertiary mx-auto mb-4">
              <Icon name="icon-upload" size={32} className="text-foreground-tertiary" />
            </div>
            <p className="text-small text-foreground-secondary mb-2">No deployments yet</p>
            <p className="text-meta text-foreground-tertiary">Deploy your site to see deployment history here</p>
          </div>
        )}
      </Card>

      {/* Deployment Hooks */}
      <Card title="Deployment Hooks">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg border border-border-tertiary">
            <div>
              <div className="text-small font-medium flex items-center gap-2">
                <Icon name="icon-play" size={14} className="text-foreground-secondary" />
                Pre-deploy Hook
              </div>
              <div className="text-meta text-foreground-tertiary font-mono truncate max-w-[400px]">
                {settings?.preDeployHook || 'No pre-deploy hook configured'}
              </div>
            </div>
            {settings?.preDeployHook && (
              <Button size="small" variant="ghost" onClick={() => handleTestWebhook('pre_deploy')} icon={<Icon name="icon-upload" size={15} />}>
                Test
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg border border-border-tertiary">
            <div>
              <div className="text-small font-medium flex items-center gap-2">
                <Icon name="icon-check" size={14} className="text-foreground-success" />
                Post-deploy Hook
              </div>
              <div className="text-meta text-foreground-tertiary font-mono truncate max-w-[400px]">
                {settings?.postDeployHook || 'No post-deploy hook configured'}
              </div>
            </div>
            {settings?.postDeployHook && (
              <Button size="small" variant="ghost" onClick={() => handleTestWebhook('post_deploy')} icon={<Icon name="icon-upload" size={15} />}>
                Test
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Deployment Settings"
        size="large"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveSettings} loading={updateSettings.isPending}>Save Settings</Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Git Repository */}
          <div className="space-y-4">
            <h4 className="text-small font-medium text-foreground-primary flex items-center gap-2">
              <Icon name="icon-folder" size={16} />
              Git Repository
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Repository URL"
                value={formData.gitRepo || ''}
                onChange={(e) => setFormData({ ...formData, gitRepo: e.target.value })}
                placeholder="https://github.com/user/repo.git"
              />
              <Input
                label="Branch"
                value={formData.gitBranch || 'main'}
                onChange={(e) => setFormData({ ...formData, gitBranch: e.target.value })}
                placeholder="main"
              />
            </div>
          </div>

          {/* Build Commands */}
          <div className="space-y-4">
            <h4 className="text-small font-medium text-foreground-primary flex items-center gap-2">
              <Icon name="icon-terminal" size={16} />
              Build Commands
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Install Command"
                value={formData.installCommand || ''}
                onChange={(e) => setFormData({ ...formData, installCommand: e.target.value })}
                placeholder="npm install"
              />
              <Input
                label="Build Command"
                value={formData.buildCommand || ''}
                onChange={(e) => setFormData({ ...formData, buildCommand: e.target.value })}
                placeholder="npm run build"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Output Directory"
                value={formData.outputDirectory || ''}
                onChange={(e) => setFormData({ ...formData, outputDirectory: e.target.value })}
                placeholder="dist"
              />
              <Input
                label="Deploy Path"
                value={formData.deployPath || ''}
                onChange={(e) => setFormData({ ...formData, deployPath: e.target.value })}
                placeholder="/var/www/html"
              />
            </div>
          </div>

          {/* Auto-deploy Toggles */}
          <div className="space-y-4">
            <h4 className="text-small font-medium text-foreground-primary flex items-center gap-2">
              <Icon name="icon-play" size={16} />
              Auto-deploy
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-small">Auto-deploy on push</div>
                  <div className="text-meta text-foreground-tertiary">Automatically deploy when code is pushed</div>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, autoDeploy: !formData.autoDeploy })}
                  className={`w-10 h-6 rounded-full relative transition-colors ${formData.autoDeploy ? 'bg-foreground-success' : 'bg-foreground-tertiary'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.autoDeploy ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-small">Deploy on Pull Request</div>
                  <div className="text-meta text-foreground-tertiary">Create preview deployment for PRs</div>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, deployOnPr: !formData.deployOnPr })}
                  className={`w-10 h-6 rounded-full relative transition-colors ${formData.deployOnPr ? 'bg-foreground-success' : 'bg-foreground-tertiary'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.deployOnPr ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-small">Auto-rollback</div>
                  <div className="text-meta text-foreground-tertiary">Automatically rollback on failed deployment</div>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, autoRollback: !formData.autoRollback })}
                  className={`w-10 h-6 rounded-full relative transition-colors ${formData.autoRollback ? 'bg-foreground-success' : 'bg-foreground-tertiary'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.autoRollback ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Deployment Hooks */}
          <div className="space-y-4">
            <h4 className="text-small font-medium text-foreground-primary flex items-center gap-2">
              <Icon name="icon-webhook" size={16} />
              Deployment Hooks
            </h4>
            <Input
              label="Pre-deploy Hook"
              value={formData.preDeployHook || ''}
              onChange={(e) => setFormData({ ...formData, preDeployHook: e.target.value })}
              placeholder="echo 'Before deployment...'"
            />
            <Input
              label="Post-deploy Hook"
              value={formData.postDeployHook || ''}
              onChange={(e) => setFormData({ ...formData, postDeployHook: e.target.value })}
              placeholder="echo 'After deployment...'"
            />
          </div>

          {/* Health Check */}
          <div className="space-y-4">
            <h4 className="text-small font-medium text-foreground-primary flex items-center gap-2">
              <Icon name="icon-check" size={16} />
              Health Check
            </h4>
            <Input
              label="Health Check Path"
              value={formData.healthCheckPath || ''}
              onChange={(e) => setFormData({ ...formData, healthCheckPath: e.target.value })}
              placeholder="/health"
            />
          </div>
        </div>
      </Modal>

      {/* Credentials Modal */}
      <Modal
        isOpen={showCredentials}
        onClose={() => setShowCredentials(false)}
        title="Git Credentials"
        size="medium"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCredentials(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveSettings} loading={updateSettings.isPending}>Save Credentials</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary mb-4">
            Configure credentials for accessing your Git repository.
          </p>
          <Input
            label="Username"
            value={formData.gitCredentials?.username || ''}
            onChange={(e) => setFormData({
              ...formData,
              gitCredentials: { ...formData.gitCredentials, username: e.target.value }
            })}
            placeholder="git username"
          />
          <Input
            label="Password / Token"
            type="password"
            value={formData.gitCredentials?.password || ''}
            onChange={(e) => setFormData({
              ...formData,
              gitCredentials: { ...formData.gitCredentials, password: e.target.value }
            })}
            placeholder="password or access token"
          />
          <div className="p-3 bg-background-tertiary rounded-md">
            <div className="text-meta text-foreground-tertiary">
              For private repositories, use a personal access token instead of your password.
              Credentials are stored securely and encrypted at rest.
            </div>
          </div>
        </div>
      </Modal>

      {/* Rollback Confirmation */}
      <ConfirmDialog
        isOpen={!!rollbackId}
        onClose={() => setRollbackId(null)}
        onConfirm={() => rollbackId && handleRollback(rollbackId)}
        title="Rollback Deployment"
        description="This will revert your site to the selected deployment. Current changes will be lost."
        confirmText="Rollback"
        impact="medium"
        loading={rollback.isPending}
      />
    </div>
  );
}