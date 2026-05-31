import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import {
  useInstallerApps,
  useInstalledApps,
  useInstallApp,
  useUninstallApp,
  useCheckPath,
  type AppDefinition,
  type InstalledApp,
} from '../../api/hooks/installer';
import { useDomains } from '../../api/hooks/domains';
import { useDatabases } from '../../api/hooks/databases';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

const CATEGORIES = ['All', 'CMS', 'E-Commerce', 'Blog', 'Forum', 'Development', 'Other'];

export function InstallerPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [installTarget, setInstallTarget] = useState<AppDefinition | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<InstalledApp | null>(null);

  const { data: availableApps, isLoading: appsLoading, isError: appsError, error: appsErr, refetch: refetchApps } = useInstallerApps();
  const { data: installedApps, isLoading: installedLoading } = useInstalledApps();
  const installMutation = useInstallApp();
  const uninstallMutation = useUninstallApp();

  const filteredApps = selectedCategory === 'All'
    ? availableApps
    : availableApps?.filter((app) => app.category === selectedCategory);

  const handleOpenApp = (app: InstalledApp) => {
    if (app.adminUrl) {
      window.open(app.adminUrl, '_blank');
    }
  };

  if (appsLoading || installedLoading) return <PageSkeleton />;
  if (appsError) return <ErrorState message={appsErr?.message} onRetry={refetchApps} />;

  return (
    <div className="space-y-6">
      <h1 className="text-page-title font-medium">App Installer</h1>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-4 py-2.5 text-small transition-colors relative',
                selectedCategory === cat
                  ? 'text-foreground-primary font-medium'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              )}
            >
              {cat}
              {selectedCategory === cat && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {installedApps && installedApps.length > 0 && (
        <div>
          <h2 className="text-title font-medium mb-4">Installed Apps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installedApps.map((app) => (
              <Card key={app.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{app.appName}</h3>
                    <p className="text-small text-foreground-secondary">{app.domain || 'No domain'}</p>
                  </div>
                  <StatusBadge
                    status={
                      app.status === 'ready' ? 'active' : app.status === 'installing' ? 'running' : 'inactive'
                    }
                  />
                </div>
                {app.installPath && (
                  <div className="text-small text-foreground-tertiary mb-3">
                    <span className="font-mono">{app.installPath}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {app.adminUrl && (
                    <Button variant="primary" size="small" onClick={() => handleOpenApp(app)}>
                      Open
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="small"
                    icon={<Icon name="icon-trash" size={15} />}
                    onClick={() => setUninstallTarget(app)}
                  >
                    Uninstall
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-title font-medium mb-4">Available Apps</h2>
        {filteredApps && filteredApps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => (
              <Card key={app.id}>
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
                      {app.category}
                    </span>
                    {app.phpVersion && (
                      <span className="text-small text-foreground-tertiary">PHP {app.phpVersion}</span>
                    )}
                  </div>
                  <h3 className="font-medium">{app.name}</h3>
                  <p className="text-small text-foreground-secondary mt-1">{app.description}</p>
                </div>
                {app.requirements.length > 0 && (
                  <div className="text-small text-foreground-tertiary mb-3">
                    Requirements: {app.requirements.join(', ')}
                  </div>
                )}
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => setInstallTarget(app)}
                >
                  Install
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="icon-box"
            title="No apps available"
            description="No apps match the selected category"
          />
        )}
      </div>

      {/* Install Modal */}
      {installTarget && (
        <InstallAppModal
          isOpen={!!installTarget}
          onClose={() => setInstallTarget(null)}
          app={installTarget}
          mutation={installMutation}
        />
      )}

      {/* Uninstall Confirm */}
      <ConfirmDialog
        isOpen={!!uninstallTarget}
        onClose={() => setUninstallTarget(null)}
        onConfirm={() => {
          if (!uninstallTarget) return;
          uninstallMutation.mutate(
            { appId: uninstallTarget.appId },
            {
              onSuccess: () => {
                toast.success(`${uninstallTarget.appName} uninstalled`);
                setUninstallTarget(null);
              },
              onError: (err) => toast.error(`Failed to uninstall: ${err.message}`),
            }
          );
        }}
        title="Uninstall App"
        description={`Uninstall "${uninstallTarget?.appName}"? This cannot be undone.`}
        confirmText="Uninstall"
        impact="high"
      />
    </div>
  );
}

function InstallAppModal({
  isOpen,
  onClose,
  app,
  mutation,
}: {
  isOpen: boolean;
  onClose: () => void;
  app: AppDefinition;
  mutation: ReturnType<typeof useInstallApp>;
}) {
  const { data: domains } = useDomains();
  const { data: databases } = useDatabases();
  const checkPath = useCheckPath();

  const [domain, setDomain] = useState('');
  const [path, setPath] = useState(app.installPath || '');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [databaseOption, setDatabaseOption] = useState<'auto' | 'existing'>('auto');
  const [databaseId, setDatabaseId] = useState('');
  const [pathError, setPathError] = useState('');

  const handlePathChange = (val: string) => {
    setPath(val);
    if (val) {
      checkPath.mutate(
        { path: val },
        {
          onSuccess: (result) => {
            if (!result.isEmpty && result.files.length > 0) {
              setPathError('Directory is not empty — choose an empty path');
            } else {
              setPathError('');
            }
          },
        }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || !path || !adminEmail || !adminPassword) return;
    if (pathError) return;
    mutation.mutate(
      {
        appId: app.id,
        domain,
        path,
        adminEmail,
        adminPassword,
        databaseOption,
        databaseId: databaseOption === 'existing' ? databaseId : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${app.name} installed successfully`);
          onClose();
        },
        onError: (err) => toast.error(`Installation failed: ${err.message}`),
      }
    );
  };

  const domainOptions = domains?.map((d) => ({ value: d.id, label: d.name })) || [];
  const dbOptions = databases?.map((d) => ({ value: d.id, label: d.name })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Install ${app.name}`}
      size="medium"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
            disabled={!domain || !path || !adminEmail || !adminPassword || !!pathError}
          >
            Install
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-meta font-medium">Domain</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
          >
            <option value="">Select domain</option>
            {domainOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Install Path"
          value={path}
          onChange={(e) => handlePathChange(e.target.value)}
          error={pathError}
          placeholder={app.installPath}
        />
        <Input label="Admin Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        <Input label="Admin Password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
        {app.needsDatabase && (
          <div className="flex flex-col gap-1">
            <label className="text-meta font-medium">Database</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={databaseOption === 'auto' ? 'primary' : 'default'}
                size="small"
                onClick={() => setDatabaseOption('auto')}
              >
                Auto
              </Button>
              <Button
                type="button"
                variant={databaseOption === 'existing' ? 'primary' : 'default'}
                size="small"
                onClick={() => setDatabaseOption('existing')}
              >
                Existing
              </Button>
            </div>
            {databaseOption === 'existing' && (
              <select
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
              >
                <option value="">Select database</option>
                {dbOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}