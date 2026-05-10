import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { Search, Folder, FileText, Zap, Clock, ArrowUp, ArrowDown, CornerDownLeft, X } from 'lucide-react';
import { useSites, type Site } from '../api/hooks/sites';

interface CommandItem {
  id: string;
  title: string;
  category: 'sites' | 'pages' | 'actions';
  icon: typeof Folder;
  action: () => void;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// Static actions available in the command palette
const STATIC_ACTIONS: CommandItem[] = [
  {
    id: 'action-create-site',
    title: 'Create new site',
    category: 'actions',
    icon: Zap,
    action: () => { /* Will navigate via router */ },
    keywords: 'new website domain',
  },
  {
    id: 'action-terminal',
    title: 'Open terminal',
    category: 'actions',
    icon: Zap,
    action: () => { /* Will navigate via router */ },
    keywords: 'ssh console bash',
  },
  {
    id: 'action-logs',
    title: 'View logs',
    category: 'actions',
    icon: FileText,
    action: () => { /* Will navigate via router */ },
    keywords: 'error log files',
  },
  {
    id: 'action-backups',
    title: 'View backups',
    category: 'actions',
    icon: Folder,
    action: () => { /* Will navigate via router */ },
    keywords: 'restore backup',
  },
  {
    id: 'action-settings',
    title: 'Server settings',
    category: 'actions',
    icon: Zap,
    action: () => { /* Will navigate via router */ },
    keywords: 'config configuration',
  },
];

// Static page routes
const PAGE_ROUTES: CommandItem[] = [
  { id: 'page-dashboard', title: 'Dashboard', category: 'pages', icon: FileText, action: () => {}, keywords: 'home overview' },
  { id: 'page-sites', title: 'Sites', category: 'pages', icon: Folder, action: () => {}, keywords: 'websites domains' },
  { id: 'page-databases', title: 'Databases', category: 'pages', icon: FileText, action: () => {}, keywords: 'mysql postgres' },
  { id: 'page-mail', title: 'Mail', category: 'pages', icon: FileText, action: () => {}, keywords: 'email mailbox' },
  { id: 'page-ftp', title: 'FTP', category: 'pages', icon: FileText, action: () => {}, keywords: 'file transfer' },
  { id: 'page-dns', title: 'DNS', category: 'pages', icon: FileText, action: () => {}, keywords: 'domains nameservers' },
  { id: 'page-ssl', title: 'SSL', category: 'pages', icon: FileText, action: () => {}, keywords: 'certificates https' },
  { id: 'page-php', title: 'PHP', category: 'pages', icon: FileText, action: () => {}, keywords: 'php-fpm version' },
  { id: 'page-cron', title: 'Cron', category: 'pages', icon: FileText, action: () => {}, keywords: 'scheduled tasks' },
  { id: 'page-firewall', title: 'Firewall', category: 'pages', icon: FileText, action: () => {}, keywords: 'iptables security' },
  { id: 'page-backups', title: 'Backups', category: 'pages', icon: Folder, action: () => {}, keywords: 'restore backup' },
  { id: 'page-logs', title: 'Logs', category: 'pages', icon: FileText, action: () => {}, keywords: 'error log files' },
  { id: 'page-monitoring', title: 'Monitoring', category: 'pages', icon: FileText, action: () => {}, keywords: 'stats cpu memory' },
  { id: 'page-cloudflare', title: 'Cloudflare', category: 'pages', icon: FileText, action: () => {}, keywords: 'cdn dns tunnel' },
  { id: 'page-settings', title: 'Settings', category: 'pages', icon: FileText, action: () => {}, keywords: 'config preferences' },
  { id: 'page-profile', title: 'Profile', category: 'pages', icon: FileText, action: () => {}, keywords: 'account user' },
  { id: 'page-api-tokens', title: 'API Tokens', category: 'pages', icon: FileText, action: () => {}, keywords: 'authentication keys' },
  { id: 'page-audit', title: 'Audit Log', category: 'pages', icon: FileText, action: () => {}, keywords: 'activity history' },
  { id: 'page-notifications', title: 'Notifications', category: 'pages', icon: FileText, action: () => {}, keywords: 'alerts messages' },
];

const RECENT_SEARCHES_KEY = 'novapanel_recent_searches';
const MAX_RECENT_SEARCHES = 5;

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Simple contains check with slight fuzzy tolerance
  if (lowerText.includes(lowerQuery)) return true;
  
  // Check if all query chars appear in order
  let queryIdx = 0;
  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      queryIdx++;
    }
  }
  return queryIdx === lowerQuery.length;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIdx = lowerText.indexOf(lowerQuery);
  
  if (startIdx === -1) return text;
  
  return (
    <>
      {text.slice(0, startIdx)}
      <span className="bg-primary/20 text-primary">{text.slice(startIdx, startIdx + query.length)}</span>
      {text.slice(startIdx + query.length)}
    </>
  );
}

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string): void {
  if (!query.trim()) return;
  const recent = getRecentSearches().filter(q => q !== query);
  recent.unshift(query);
  const trimmed = recent.slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed));
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const { data: sites = [] } = useSites();

  // Load recent searches on open
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build all command items
  const allItems = useMemo(() => {
    const siteItems: CommandItem[] = sites.map((site: Site) => ({
      id: `site-${site.id}`,
      title: site.name,
      category: 'sites' as const,
      icon: Folder,
      action: () => navigate({ to: '/sites/$siteId', params: { siteId: site.id } }),
      keywords: `${site.documentRoot} ${site.systemUser}`,
    }));

    // Update action handlers with proper navigation
    const actionItems = STATIC_ACTIONS.map(item => {
      let action: () => void;
      switch (item.id) {
        case 'action-create-site':
          action = () => navigate({ to: '/sites' });
          break;
        case 'action-terminal':
          action = () => navigate({ to: '/terminal' });
          break;
        case 'action-logs':
          action = () => navigate({ to: '/logs' });
          break;
        case 'action-backups':
          action = () => navigate({ to: '/backups' });
          break;
        case 'action-settings':
          action = () => navigate({ to: '/settings/server' });
          break;
        default:
          action = item.action;
      }
      return { ...item, action };
    });

    const pageItems = PAGE_ROUTES.map(item => {
      let action: () => void;
      switch (item.id) {
        case 'page-dashboard': action = () => navigate({ to: '/' }); break;
        case 'page-sites': action = () => navigate({ to: '/sites' }); break;
        case 'page-databases': action = () => navigate({ to: '/databases' }); break;
        case 'page-mail': action = () => navigate({ to: '/mail' }); break;
        case 'page-ftp': action = () => navigate({ to: '/ftp' }); break;
        case 'page-dns': action = () => navigate({ to: '/dns' }); break;
        case 'page-ssl': action = () => navigate({ to: '/ssl' }); break;
        case 'page-php': action = () => navigate({ to: '/php' }); break;
        case 'page-cron': action = () => navigate({ to: '/cron' }); break;
        case 'page-firewall': action = () => navigate({ to: '/firewall' }); break;
        case 'page-backups': action = () => navigate({ to: '/backups' }); break;
        case 'page-logs': action = () => navigate({ to: '/logs' }); break;
        case 'page-monitoring': action = () => navigate({ to: '/monitoring' }); break;
        case 'page-cloudflare': action = () => navigate({ to: '/cloudflare' }); break;
        case 'page-settings': action = () => navigate({ to: '/settings' }); break;
        case 'page-profile': action = () => navigate({ to: '/settings' }); break;
        case 'page-api-tokens': action = () => navigate({ to: '/settings/api-tokens' }); break;
        case 'page-audit': action = () => navigate({ to: '/audit' }); break;
        case 'page-notifications': action = () => navigate({ to: '/notifications' }); break;
        default: action = item.action;
      }
      return { ...item, action };
    });

    return [...siteItems, ...pageItems, ...actionItems];
  }, [sites, navigate]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return [];
    return allItems.filter(item => 
      fuzzyMatch(item.title, query) || 
      (item.keywords && fuzzyMatch(item.keywords, query))
    );
  }, [allItems, query]);

  // Grouped items for display
  const groupedItems = useMemo(() => {
    if (query.trim()) {
      return {
        sites: filteredItems.filter(i => i.category === 'sites'),
        pages: filteredItems.filter(i => i.category === 'pages'),
        actions: filteredItems.filter(i => i.category === 'actions'),
      };
    }
    return { sites: [], pages: [], actions: [] };
  }, [query, filteredItems]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredItems.length;
    if (totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          addRecentSearch(query);
          filteredItems[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, selectedIndex, query, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredItems.length > 0) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredItems.length]);

  // Global keyboard listener for Cmd+K
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          onClose();
        } else {
          // This is handled by the parent component
        }
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const renderItem = (item: CommandItem, index: number, globalIndex: number) => {
    const Icon = item.icon;
    const isSelected = globalIndex === selectedIndex;
    
    return (
      <button
        key={item.id}
        data-index={globalIndex}
        onClick={() => {
          addRecentSearch(query);
          item.action();
          onClose();
        }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
        }`}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
          isSelected ? 'bg-primary/20' : 'bg-muted'
        }`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{highlightMatch(item.title, query)}</p>
          <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
        </div>
        {isSelected && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownLeft className="h-3 w-3" />
          </div>
        )}
      </button>
    );
  };

  const renderGroup = (title: string, items: CommandItem[], startIndex: number) => {
    if (items.length === 0) return null;
    
    let globalIndex = startIndex;
    
    return (
      <div key={title}>
        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        </div>
        {items.map(item => renderItem(item, items.indexOf(item), globalIndex++))}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites, pages, or actions..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-border bg-muted px-2 text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Recent Searches (when no query) */}
        {!query.trim() && recentSearches.length > 0 && (
          <div className="border-b border-border">
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-3 w-3" /> Recent
              </p>
            </div>
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={() => setQuery(search)}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent/50 transition-colors"
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{search}</span>
              </button>
            ))}
          </div>
        )}

        {/* No query state with hints */}
        {!query.trim() && recentSearches.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Type to search sites, pages, and actions</p>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1">esc</kbd> close
              </span>
            </div>
          </div>
        )}

        {/* Search Results */}
        {query.trim() && filteredItems.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          </div>
        )}

        {query.trim() && filteredItems.length > 0 && (
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {renderGroup('Sites', groupedItems.sites, 0)}
            {renderGroup('Pages', groupedItems.pages, groupedItems.sites.length)}
            {renderGroup('Actions', groupedItems.actions, groupedItems.sites.length + groupedItems.pages.length)}
          </div>
        )}

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">⌘K</kbd>
            <span className="hidden sm:inline">or</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">Ctrl+K</kbd>
            <span>to toggle</span>
          </span>
          {filteredItems.length > 0 && (
            <span>{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
