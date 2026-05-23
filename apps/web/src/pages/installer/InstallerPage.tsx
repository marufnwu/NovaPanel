import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useInstallerApps, useInstalledApps, type AppDefinition, type InstalledApp } from '../../api/hooks/installer';
import { Icon } from '../../components/icons';

const CATEGORIES = ['All', 'CMS', 'E-Commerce', 'Blog', 'Forum', 'Development', 'Other'];

export function InstallerPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { data: availableApps, isLoading: appsLoading } = useInstallerApps();
  const { data: installedApps, isLoading: installedLoading } = useInstalledApps();

  const filteredApps = selectedCategory === 'All'
    ? availableApps
    : availableApps?.filter(app => app.category === selectedCategory);

  const handleInstall = (app: AppDefinition) => {
    console.log('Install app:', app.id);
  };

  const handleOpenApp = (app: InstalledApp) => {
    if (app.adminUrl) {
      window.open(app.adminUrl, '_blank');
    }
  };

  if (appsLoading || installedLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-page-title font-medium">App Installer</h1>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-4 py-2.5 text-small transition-colors relative"
              style={{
                color: selectedCategory === cat ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: selectedCategory === cat ? 500 : 400,
              }}
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
                  <StatusBadge status={app.status === 'ready' ? 'active' : app.status === 'installing' ? 'running' : 'inactive'} />
                </div>
                <div className="text-small text-foreground-tertiary mb-3">
                  {app.installPath && <span className="font-mono">{app.installPath}</span>}
                </div>
                <div className="flex gap-2">
                  {app.adminUrl && (
                    <Button variant="primary" size="small" onClick={() => handleOpenApp(app)}>
                      Open
                    </Button>
                  )}
                  <Button variant="ghost" size="small" icon={<Icon name="icon-trash" size={15} />}>
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
                <Button variant="primary" size="small" onClick={() => handleInstall(app)}>
                  Install
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="icon-app"
            title="No apps available"
            description="No apps match the selected category"
          />
        )}
      </div>
    </div>
  );
}