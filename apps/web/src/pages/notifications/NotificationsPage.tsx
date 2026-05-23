import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNotifications, useNotificationPreferences, useUpdateNotificationPreferences, useMarkAsRead, useMarkAllAsRead, useDeleteNotification, useUnreadCount, Notification } from '../../api/hooks/notifications';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import {
  Bell, BellOff, CheckCheck, Trash2, Shield, AlertTriangle, Server, Clock,
  Database, HardDrive, Mail, Settings2, Zap, X, RefreshCw, Filter,
  ChevronLeft, ChevronRight, ExternalLink, Moon, Info, AlertCircle
} from 'lucide-react';

// ─── Toast Notification Popup ────────────────────────────────────────────────

function NotificationToast({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-blue-500';

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-lg animate-in slide-in-from-right">
      <div className={`mt-0.5 rounded-full p-2 bg-muted ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.message}</p>
      </div>
      <button onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:bg-accent">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  ssl_expiry: 'SSL Expiry',
  backup_complete: 'Backup',
  cron_failed: 'Cron',
  security_alert: 'Security',
  disk_space_low: 'Disk Space',
  service_down: 'Service',
  info: 'Info',
};

const PAGE_SIZE = 10;

type TabKey = 'history' | 'preferences' | 'alert-rules';

// ─── Helper: Section wrapper ─────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, description, children }: {
  title: string;
  icon: typeof Bell;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// ─── 1. Notification History Section ─────────────────────────────────────────

function NotificationHistorySection({ onNewNotification }: { onNewNotification?: (n: Notification) => void }) {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const prevNotificationIds = useRef<Set<string>>(new Set());

  const offset = page * PAGE_SIZE;
  const { data, isLoading, isError, refetch } = useNotifications(PAGE_SIZE, offset, { refetchInterval: 5_000 });
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  // Detect new notifications for toast
  useEffect(() => {
    const notifications = data?.notifications || [];
    if (notifications.length === 0) return;

    const currentIds = new Set(notifications.map((n) => n.id));
    if (prevNotificationIds.current.size > 0) {
      const newNotifications = notifications.filter(
        (n) => !prevNotificationIds.current.has(n.id) && !n.isRead
      );
      newNotifications.forEach((n) => onNewNotification?.(n));
    }
    prevNotificationIds.current = currentIds;
  }, [data?.notifications, onNewNotification]);

  const allNotifications = data?.notifications || [];
  const total = data?.total || 0;

  const filteredNotifications = useMemo(() => {
    if (typeFilter === 'all') return allNotifications;
    return allNotifications.filter(n => n.type === typeFilter);
  }, [allNotifications, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {total} notification{total !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors ${showFilters ? 'bg-accent' : 'hover:bg-accent'}`}
          >
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {total > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <span className="text-sm font-medium">Type:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTypeFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
            >
              All
            </button>
            {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${typeFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notification List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingPage title="Loading notifications..." />
          </div>
        ) : isError ? (
          <div className="p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-2 text-sm text-red-600">Failed to load notifications.</p>
            <button onClick={() => refetch()} className="mt-2 text-sm text-primary hover:underline">Retry</button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No notifications"
            description="You're all caught up! Notifications will appear here when something needs your attention."
          />
        ) : (
          <div className="divide-y divide-border">
            {filteredNotifications.map(n => {
              const Icon = NOTIFICATION_ICONS[n.type] || Bell;
              const colorClass = NOTIFICATION_COLORS[n.type] || 'text-blue-500';
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-4 hover:bg-accent/50 transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                >
                  <div className={`mt-0.5 rounded-full p-2 bg-muted ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm ${!n.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {n.title}
                      </h4>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground uppercase">
                        {NOTIFICATION_TYPE_LABELS[n.type] || n.type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Mark as read"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification.mutate(n.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 2. SMTP Configuration Section ──────────────────────────────────────────

function SmtpSettingsPlaceholder() {
  return (
    <SectionCard title="SMTP Configuration" icon={Mail} description="Configure email delivery for notifications">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4 rounded-full bg-muted p-3">
          <Mail className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 font-medium">SMTP Configuration</h3>
        <p className="mb-4 text-sm text-muted-foreground max-w-xs">
          SMTP settings are now configured in Server Settings. This tab will be removed in a future update.
        </p>
        <a
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Go to Server Settings <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </SectionCard>
  );
}

// ─── 3. Notification Preferences Section ─────────────────────────────────────

function PreferencesSection() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  // Quiet hours local state
  const [quietHours, setQuietHours] = useState({ enabled: false, start: '22:00', end: '08:00' });

  if (isLoading) return <LoadingPage title="Loading notifications..." />;

  const toggle = (key: string) => {
    updatePrefs.mutate({ [key]: !(prefs as any)?.[key] });
  };

  // Channel preferences
  const channelItems = [
    { key: 'emailEnabled' as const, label: 'Email Channel', description: 'Receive notifications via email', icon: Mail },
    { key: 'pushEnabled' as const, label: 'Push Channel', description: 'Receive push notifications in browser', icon: Bell },
  ];

  // Per-category preferences
  const categoryItems = [
    { key: 'sslExpiry' as const, label: 'SSL Certificate Expiry', description: 'Certificate expiration warnings', icon: Shield, color: 'text-yellow-500' },
    { key: 'backupComplete' as const, label: 'Backup Events', description: 'Backup completion and failure alerts', icon: Database, color: 'text-green-500' },
    { key: 'cronFailed' as const, label: 'Cron Job Failures', description: 'Scheduled task errors', icon: Clock, color: 'text-red-500' },
    { key: 'securityAlert' as const, label: 'Security Alerts', description: 'Failed logins, suspicious activity', icon: AlertTriangle, color: 'text-red-500' },
    { key: 'diskSpaceLow' as const, label: 'Disk Space Warnings', description: 'Storage threshold alerts', icon: HardDrive, color: 'text-orange-500' },
    { key: 'serviceDown' as const, label: 'Service Status', description: 'When services stop unexpectedly', icon: Server, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <SectionCard title="Notification Channels" icon={Bell} description="Choose how you want to receive notifications">
        <div className="divide-y divide-border">
          {channelItems.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">{item.label}</h4>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Toggle checked={!!prefs?.[item.key]} onChange={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Per-Category Preferences */}
      <SectionCard title="Category Preferences" icon={Settings2} description="Fine-tune which notification categories you receive">
        <div className="divide-y divide-border">
          {categoryItems.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className={`rounded-md bg-muted p-2 ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">{item.label}</h4>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Toggle checked={!!prefs?.[item.key]} onChange={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Quiet Hours */}
      <SectionCard title="Quiet Hours" icon={Moon} description="Suppress non-critical notifications during specified hours">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Enable Quiet Hours</h4>
              <p className="text-xs text-muted-foreground">Mute non-critical notifications during sleep hours</p>
            </div>
            <Toggle
              checked={quietHours.enabled}
              onChange={() => setQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
            />
          </div>
          {quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 pl-0">
              <div>
                <label className="mb-1 block text-sm font-medium">Start Time</label>
                <input
                  type="time"
                  value={quietHours.start}
                  onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">End Time</label>
                <input
                  type="time"
                  value={quietHours.end}
                  onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          {quietHours.enabled && (
            <p className="text-xs text-muted-foreground">
              <Info className="inline h-3 w-3 mr-1" />
              Critical alerts (security, service down) will still be delivered during quiet hours.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── 4. Alert Rules Section ──────────────────────────────────────────────────

function AlertRulesSection() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-3">
        <Zap className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mb-1 font-medium">Alert Rules</h3>
      <p className="mb-4 text-sm text-muted-foreground max-w-xs">
        Alert rules are now managed on the Monitoring page. Create and manage rules there to get notified when server metrics exceed thresholds.
      </p>
      <a
        href="/monitoring?tab=alerts"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Go to Monitoring <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: typeof Bell }[] = [
  { key: 'history', label: 'History', icon: Clock },
  { key: 'preferences', label: 'Preferences', icon: Settings2 },
  { key: 'alert-rules', label: 'Alert Rules', icon: Zap },
];

export function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('history');
  const [toasts, setToasts] = useState<Notification[]>([]);

  // Also poll unread count to keep TopBar in sync
  useUnreadCount();

  const handleNewNotification = useCallback((n: Notification) => {
    setToasts((prev) => {
      // Max 3 toasts at a time
      const next = [...prev, n];
      return next.slice(-3);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div>
      <PageHeader
        title="Notifications & Alerts"
        description="Manage notifications, email delivery, preferences, and alert rules"
        icon={Bell}
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && <NotificationHistorySection onNewNotification={handleNewNotification} />}
      {activeTab === 'preferences' && <PreferencesSection />}
      {activeTab === 'alert-rules' && <AlertRulesSection />}

      {/* Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
          {toasts.map((toast) => (
            <NotificationToast
              key={toast.id}
              notification={toast}
              onClose={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
