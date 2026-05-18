import { useState, useRef, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuthStore } from '../../store/auth.store';
import { useLogout } from '../../api/hooks/auth';
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllAsRead, type Notification } from '../../api/hooks/notifications';
import { useJobNotifications } from '../jobs/JobNotificationProvider';
import { LogOut, Settings, ShieldCheck, Bell, CheckCheck, X, Shield, AlertTriangle, Server, Clock, Database, HardDrive, Activity } from 'lucide-react';
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
  const { runningCount } = useJobNotifications();

  const unreadCount = unreadData?.count || 0;
  const recentNotifications = notifData?.notifications || [];

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
        <ThemeToggle />

        {/* Active Jobs Badge */}
        {runningCount > 0 && (
          <div
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            title={`${runningCount} active background job(s)`}
          >
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            <span>{runningCount} job{runningCount !== 1 ? 's' : ''}</span>
          </div>
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

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-border bg-card shadow-lg z-50">
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