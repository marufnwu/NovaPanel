import { useLocation } from '@tanstack/react-router';
import { Icon } from '../icons';
import { Breadcrumb } from './Breadcrumb';

export function Topbar() {
  const location = useLocation();

  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-border-tertiary bg-background-primary">
      <Breadcrumb />
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-background-tertiary rounded-md" aria-label="Search" data-testid="topbar-search">
          <Icon name="icon-search" size={18} />
        </button>
        <button className="p-2 hover:bg-background-tertiary rounded-md" aria-label="Notifications" data-testid="topbar-notifications">
          <Icon name="icon-bell" size={18} />
        </button>
        <button className="p-2 hover:bg-background-tertiary rounded-md" aria-label="User menu" data-testid="topbar-user-menu">
          <Icon name="icon-user" size={18} />
        </button>
      </div>
    </header>
  );
}