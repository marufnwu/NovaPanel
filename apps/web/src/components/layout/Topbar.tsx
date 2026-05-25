import { useLocation } from '@tanstack/react-router';
import { Icon } from '../icons';
import { Breadcrumb } from './Breadcrumb';
import { useThemeStore, type Theme } from '../../store/theme-store';

export function Topbar() {
  const location = useLocation();
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-border-tertiary bg-background-primary">
      <Breadcrumb />
      <div className="flex items-center gap-2">
        <button 
          onClick={toggleTheme}
          className="p-2 hover:bg-background-tertiary rounded-md" 
          aria-label="Toggle theme"
          data-testid="topbar-theme-toggle"
        >
          <Icon name={theme === 'dark' ? 'icon-sun' : 'icon-moon'} size={18} />
        </button>
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