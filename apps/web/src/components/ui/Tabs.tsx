import { cn } from '../../lib/utils';
import { useSearch, useNavigate } from '@tanstack/react-router';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  className?: string;
}

export function Tabs({ tabs, className }: TabsProps) {
  const navigate = useNavigate();
  const search = useSearch({ from: '/sites/$siteId' }) as { tab?: string };
  const activeTab = search?.tab || tabs[0]?.id;

  const handleTabChange = (tabId: string) => {
    const currentPath = window.location.pathname;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className={cn('border-b border-border-tertiary', className)}>
      <nav className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'px-4 py-2.5 text-small transition-colors relative',
              activeTab === tab.id
                ? 'text-foreground-primary font-medium'
                : 'text-foreground-secondary hover:text-foreground-primary'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}