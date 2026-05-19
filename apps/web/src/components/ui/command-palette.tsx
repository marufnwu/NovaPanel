import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Globe, Server, Database, Shield, FileText,
  Terminal, Settings, Bell, Clock, HardDrive, Plus, Search,
  Layers, FolderTree, Key, Cloud, Mail, Lock,
} from 'lucide-react';

interface CommandAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  const navigateTo = (path: string) => run(() => navigate({ to: path }));

  const pages: CommandAction[] = [
    { label: 'Dashboard', icon: LayoutDashboard, action: () => navigateTo('/protected/dashboard'), keywords: ['home'] },
    { label: 'Sites', icon: Server, action: () => navigateTo('/protected/sites'), keywords: ['website'] },
    { label: 'Domains', icon: Globe, action: () => navigateTo('/protected/domains'), keywords: ['dns'] },
    { label: 'Databases', icon: Database, action: () => navigateTo('/protected/databases'), keywords: ['db', 'sql'] },
    { label: 'SSL Certificates', icon: Shield, action: () => navigateTo('/protected/ssl'), keywords: ['https', 'tls'] },
    { label: 'File Manager', icon: FolderTree, action: () => navigateTo('/protected/files'), keywords: ['ftp'] },
    { label: 'Terminal', icon: Terminal, action: () => navigateTo('/protected/terminal'), keywords: ['ssh', 'console'] },
    { label: 'Cron Jobs', icon: Clock, action: () => navigateTo('/protected/cron'), keywords: ['schedule'] },
    { label: 'Firewall', icon: Lock, action: () => navigateTo('/protected/firewall'), keywords: ['ufw'] },
    { label: 'Backups', icon: HardDrive, action: () => navigateTo('/protected/backups'), keywords: ['restore'] },
    { label: 'Mail', icon: Mail, action: () => navigateTo('/protected/mail'), keywords: ['email'] },
    { label: 'Cloudflare', icon: Cloud, action: () => navigateTo('/protected/cloudflare'), keywords: ['tunnel'] },
    { label: 'API Tokens', icon: Key, action: () => navigateTo('/protected/api-tokens'), keywords: ['auth'] },
    { label: 'Notifications', icon: Bell, action: () => navigateTo('/protected/notifications'), keywords: ['alerts'] },
    { label: 'Audit Log', icon: FileText, action: () => navigateTo('/protected/audit'), keywords: ['history'] },
    { label: 'Settings', icon: Settings, action: () => navigateTo('/protected/settings'), keywords: ['config'] },
  ];

  const actions: CommandAction[] = [
    { label: 'Create Site', icon: Plus, action: () => navigateTo('/protected/sites'), keywords: ['new', 'add'] },
    { label: 'Add Domain', icon: Globe, action: () => navigateTo('/protected/domains'), keywords: ['new'] },
    { label: 'Create Database', icon: Database, action: () => navigateTo('/protected/databases'), keywords: ['new', 'add'] },
    { label: 'Open Terminal', icon: Terminal, action: () => navigateTo('/protected/terminal'), keywords: ['ssh'] },
    { label: 'Browse Files', icon: FolderTree, action: () => navigateTo('/protected/files'), keywords: ['ftp'] },
    { label: 'Global Search', icon: Search, action: () => setOpen(false), keywords: ['find'] },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {pages.map((p) => (
            <CommandItem key={p.label} value={p.label} keywords={p.keywords} onSelect={() => run(p.action)}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {actions.map((a) => (
            <CommandItem key={a.label} value={a.label} keywords={a.keywords} onSelect={() => run(a.action)}>
              <a.icon className="mr-2 h-4 w-4" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
