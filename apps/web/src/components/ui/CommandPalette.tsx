import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Icon } from '../icons';
import type { IconName } from '../icons';

interface Command {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: 'icon-chart',
      action: () => {
        navigate({ to: '/dashboard' });
        onClose();
      },
    },
    {
      id: 'nav-sites',
      label: 'Go to Sites',
      icon: 'icon-world',
      action: () => {
        navigate({ to: '/sites' });
        onClose();
      },
    },
    {
      id: 'nav-containers',
      label: 'Go to Containers',
      icon: 'icon-box',
      action: () => {
        navigate({ to: '/containers' });
        onClose();
      },
    },
    {
      id: 'nav-databases',
      label: 'Go to Databases',
      icon: 'icon-database',
      action: () => {
        navigate({ to: '/databases' });
        onClose();
      },
    },
    {
      id: 'nav-files',
      label: 'Go to Files',
      icon: 'icon-folder',
      action: () => {
        navigate({ to: '/files' });
        onClose();
      },
    },
    {
      id: 'nav-processes',
      label: 'Go to Processes',
      icon: 'icon-terminal',
      action: () => {
        navigate({ to: '/processes' });
        onClose();
      },
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: 'icon-settings',
      action: () => {
        navigate({ to: '/settings' });
        onClose();
      },
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Dark/Light Mode',
      icon: 'icon-sun',
      action: () => {
        // Theme toggle is handled in Topbar, this is just for quick access
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div 
        className="bg-background-primary border border-border-secondary rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-border-tertiary">
          <Icon name="icon-search" size={18} className="text-foreground-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="flex-1 px-3 py-3 bg-transparent border-none outline-none text-foreground-primary placeholder:text-foreground-tertiary"
          />
          <kbd className="px-2 py-1 text-xs bg-background-tertiary text-foreground-secondary rounded border border-border-tertiary">
            ESC
          </kbd>
        </div>
        
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-foreground-secondary">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => cmd.action()}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-background-secondary ${
                  index === selectedIndex ? 'bg-background-secondary' : ''
                }`}
              >
                <Icon name={cmd.icon} size={18} className="text-foreground-secondary" />
                <span className="flex-1 text-foreground-primary">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="px-2 py-0.5 text-xs bg-background-tertiary text-foreground-tertiary rounded border border-border-tertiary">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="px-4 py-2 border-t border-border-tertiary bg-background-secondary">
          <div className="flex items-center gap-4 text-xs text-foreground-tertiary">
            <span><kbd className="px-1.5 py-0.5 bg-background-tertiary rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-background-tertiary rounded">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-background-tertiary rounded">ESC</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}