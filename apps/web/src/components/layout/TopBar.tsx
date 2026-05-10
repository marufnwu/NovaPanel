import { useState, useRef, useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useAuthStore } from '../../store/auth.store';
import { useLogout } from '../../api/hooks/auth';
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllAsRead, type Notification } from '../../api/hooks/notifications';
import { useServerStats, useServiceStatuses } from '../../api/hooks/stats';
import { LogOut, Settings, ShieldCheck, Bell, CheckCheck, X, Shield, AlertTriangle, Server, Clock, Database, HardDrive, Activity, Cpu, HardDrive as DiskIcon, MemoryStick, ChevronDown, ExternalLink } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  ssl_expiry: Shield,
  backup_complete: Database,
  cron_failed: Clock,
  security_alert: AlertTriangle,
  disk_space_low: HardDrive,
  service_down: Server,
  info: Bell,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  ssl_expiry: 'text-yellow-500',
  backup_complete: 'text-green-500',
  cron_failed: 'text-red-500',
  security_alert: 'text-red-500',
  disk_space_low: 'text-orange-500',
  service_down: 'text-red-500',
  info: 'text-blue-500',
};

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

type HealthStatus = 'green' | 'yellow' | 'red';

function getHealthStatus(
  stats: { cpu?: { usage: number }; memory?: { usagePercent: number }; disk?: { usagePercent: number } } | undefined,
  services: { name: string; status: string }[] | undefined
): HealthStatus {
  if (!stats || !services) return 'green';

  // Check for critical issues
  const criticalCpu = (stats.cpu?.usage ?? 0) > 90;
  const criticalMemory = (stats.memory?.usagePercent ?? 0) > 90;
  const criticalDisk = (stats.disk?.usagePercent ?? 0) > 90;
  if (criticalCpu || criticalMemory || criticalDisk) return 'red';

  const stoppedServices = services.filter(s => s.status === 'stopped' || s.status === 'error');
  if (stoppedServices.length > 0) return 'red';

  // Check for warnings
  const warnCpu = (stats.cpu?.usage ?? 0) > 70;
  const warnMemory = (stats.memory?.usagePercent ?? 0) > 70;
  const warnDisk = (stats.disk?.usagePercent ?? 0) > 70;
  if (warnCpu || warnMemory || warnDisk) return 'yellow';

  const errorServices = services.filter(s => s.status === 'error');
  if (errorServices.length > 0) return 'yellow';

  return 'green';
}

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

function StatusPill({ stats, services }: {
  stats: { cpu?: { usage: number }; memory?: { usagePercent: number }; disk?: { usagePercent: number } } | undefined;
  services: { name: string; status: string }[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const status = getHealthStatus(stats, services);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const runningCount = services?.filter(s => s.status === 'running').length ?? 0;
  const stoppedCount = services?.filter(s => s.status === 'stopped').length ?? 0;
  const errorCount = services?.filter(s => s.status === 'error').length ?? 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
        title="Server Status"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_COLORS[status]}`} />
        <span className="hidden sm:inline text-muted-foreground">Status</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-border bg-card shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Server Status</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status Overview */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-3 w-3 rounded-full ${HEALTH_COLORS[status]}`} />
              <span className="text-sm font-medium capitalize">{status === 'green' ? 'All Systems Healthy' : status === 'yellow' ? 'Attention Needed' : 'Critical Issues'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-muted/50 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Running</p>
                <p className="text-lg font-semibold text-green-600">{runningCount}</p>
              </div>
              <div className="rounded bg-muted/50 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Stopped</p>
                <p className="text-lg font-semibold text-yellow-600">{stoppedCount}</p>
              </div>
              <div className="rounded bg-muted/50 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Error</p>
                <p className="text-lg font-semibold text-red-600">{errorCount}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Stats</p>
              <div className="space-y-2">
                {stats.cpu && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">CPU</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${(stats.cpu.usage ?? 0) > 70 ? (stats.cpu.usage > 90 ? 'bg-red-500' : 'bg-yellow-500') : 'bg-green-500'}`}
                          style={{ width: `${stats.cpu.usage ?? 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{Math.round(stats.cpu.usage ?? 0)}%</span>
                    </div>
                  </div>
                )}
                {stats.memory && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">RAM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${(stats.memory.usagePercent ?? 0) > 70 ? (stats.memory.usagePercent > 90 ? 'bg-red-500' : 'bg-yellow-500') : 'bg-green-500'}`}
                          style={{ width: `${stats.memory.usagePercent ?? 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{Math.round(stats.memory.usagePercent ?? 0)}%</span>
                    </div>
                  </div>
                )}
                {stats.disk && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DiskIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Disk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${(stats.disk.usagePercent ?? 0) > 70 ? (stats.disk.usagePercent > 90 ? 'bg-red-500' : 'bg-yellow-500') : 'bg-green-500'}`}
                          style={{ width: `${stats.disk.usagePercent ?? 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{Math.round(stats.disk.usagePercent ?? 0)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2">
            <Link
              to="/monitoring"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between text-xs font-medium text-primary hover:underline"
            >
              View detailed monitoring
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownNotificationItem({ notification, onMarkRead }: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-blue-500';

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors ${!notification.isRead ? 'bg-primary/5' : ''}`}>
      <div className={`mt-0.5 rounded-full p-1.5 bg-muted ${colorClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.message}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(notification.createdAt)}</p>
      </div>
      {!notification.isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
          className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Mark as read"
        >
          <CheckCheck className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function TopBar() {
  const { user } = useAuthStore();
  const logout = useLogout();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications(5, 0, { refetchInterval: 30_000 });
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const { data: serverStats } = useServerStats();
  const { data: serviceStatuses } = useServiceStatuses();
  
  const routerState = useRouterState();
  const isDashboard = routerState.location.pathname === '/';

  const unreadCount = unreadData?.count || 0;
  const recentNotifications = notifData?.notifications || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div />
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Status Pill - hidden on dashboard */}
        {!isDashboard && (
          <StatusPill stats={serverStats} services={serviceStatuses} />
        )}

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-border bg-card shadow-lg z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <DropdownNotificationItem
                      key={n.id}
                      notification={n}
                      onMarkRead={(id) => markRead.mutate(id)}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              {recentNotifications.length > 0 && (
                <div className="border-t border-border px-4 py-2">
                  <Link
                    to="/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="block text-center text-xs font-medium text-primary hover:underline"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {user?.twoFactorEnabled && (
          <span title="2FA Enabled">
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </span>
        )}
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <span className="text-sm font-semibold text-primary">
              {(user?.displayName || user?.username || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="font-medium">{user?.displayName || user?.username}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </Link>
        <Link
          to="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
