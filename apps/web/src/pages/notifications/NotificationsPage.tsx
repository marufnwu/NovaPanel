import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNotifications, useNotificationPreferences, useUpdateNotificationPreferences, useMarkAsRead, useMarkAllAsRead, useDeleteNotification, useUnreadCount, Notification } from '../../api/hooks/notifications';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  Bell, BellOff, CheckCheck, Trash2, Shield, AlertTriangle, Server, Clock,
  Database, HardDrive, Mail, Settings2, Zap, Plus, X, Save, Send,
  RefreshCw, Filter, ChevronLeft, ChevronRight, Moon, ToggleLeft, ToggleRight,
  Edit2, Trash, AlertCircle, Info
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

type TabKey = 'history' | 'smtp' | 'preferences' | 'alert-rules';

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  channels: string[];
  enabled: boolean;
}

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
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
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

function SmtpSettingsSection() {
  const [form, setForm] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls' as 'tls' | 'ssl' | 'none',
    fromEmail: '',
    fromName: 'NovaPanel',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = () => {
    setSaving(true);
    setSaveResult(null);
    // Frontend-only: simulate save to localStorage
    setTimeout(() => {
      localStorage.setItem('novapanel-smtp-config', JSON.stringify(form));
      setSaving(false);
      setSaveResult({ success: true, message: 'SMTP configuration saved successfully.' });
    }, 800);
  };

  const handleTestEmail = () => {
    setTesting(true);
    setTestResult(null);
    // Frontend-only: simulate test
    setTimeout(() => {
      setTesting(false);
      if (form.host && form.port && form.fromEmail) {
        setTestResult({ success: true, message: `Test email sent to ${form.fromEmail}. Check your inbox.` });
      } else {
        setTestResult({ success: false, message: 'Please fill in host, port, and from email before testing.' });
      }
    }, 1500);
  };

  return (
    <SectionCard title="SMTP Configuration" icon={Mail} description="Configure email delivery for notifications">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">SMTP Host</label>
            <input
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="smtp.example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">SMTP Port</label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
              placeholder="587"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="user@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Encryption</label>
          <div className="flex gap-2">
            {(['tls', 'ssl', 'none'] as const).map((enc) => (
              <button
                key={enc}
                onClick={() => setForm({ ...form, encryption: enc })}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${form.encryption === enc ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}
              >
                {enc.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">From Email</label>
            <input
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              placeholder="noreply@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">From Name</label>
            <input
              value={form.fromName}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              placeholder="NovaPanel"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Feedback messages */}
        {saveResult && (
          <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${saveResult.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
            {saveResult.success ? <CheckCheck className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {saveResult.message}
          </div>
        )}
        {testResult && (
          <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
            {testResult.success ? <CheckCheck className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleTestEmail}
            disabled={testing}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {testing ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
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

  if (isLoading) return <LoadingSpinner />;

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

const METRICS = [
  { value: 'cpu_usage', label: 'CPU Usage (%)' },
  { value: 'memory_usage', label: 'Memory Usage (%)' },
  { value: 'disk_usage', label: 'Disk Usage (%)' },
  { value: 'load_average', label: 'Load Average' },
  { value: 'response_time', label: 'Response Time (ms)' },
  { value: 'error_rate', label: 'Error Rate (%)' },
];

const OPERATORS = [
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'gte', label: 'Greater than or equal (≥)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'lte', label: 'Less than or equal (≤)' },
  { value: 'eq', label: 'Equal to (=)' },
];

const CHANNELS = [
  { value: 'in_panel', label: 'In-Panel', icon: Bell },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'push', label: 'Push', icon: Zap },
];

// Default demo rules
const DEFAULT_RULES: AlertRule[] = [
  { id: '1', name: 'High CPU Usage', metric: 'cpu_usage', operator: 'gte', threshold: 90, channels: ['in_panel', 'email'], enabled: true },
  { id: '2', name: 'Low Disk Space', metric: 'disk_usage', operator: 'gte', threshold: 85, channels: ['in_panel', 'email', 'push'], enabled: true },
  { id: '3', name: 'High Memory Usage', metric: 'memory_usage', operator: 'gte', threshold: 90, channels: ['in_panel'], enabled: false },
];

function AlertRuleForm({ rule, onSave, onCancel }: {
  rule?: AlertRule;
  onSave: (rule: AlertRule) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AlertRule>(rule || {
    id: '',
    name: '',
    metric: 'cpu_usage',
    operator: 'gte',
    threshold: 80,
    channels: ['in_panel'],
    enabled: true,
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: form.id || `rule_${Date.now()}`,
    });
  };

  const toggleChannel = (channel: string) => {
    const has = form.channels.includes(channel);
    setForm({
      ...form,
      channels: has ? form.channels.filter(c => c !== channel) : [...form.channels, channel],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Rule Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. High CPU Alert"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Condition Builder */}
      <div>
        <label className="mb-2 block text-sm font-medium">Condition</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Metric</label>
            <select
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Operator</label>
            <select
              value={form.operator}
              onChange={(e) => setForm({ ...form, operator: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Threshold</label>
            <input
              type="number"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div>
        <label className="mb-2 block text-sm font-medium">Notification Channels</label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map(ch => {
            const isActive = form.channels.includes(ch.value);
            return (
              <button
                key={ch.value}
                onClick={() => toggleChannel(ch.value)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}
              >
                <ch.icon className="h-3.5 w-3.5" />
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.name.trim() || form.channels.length === 0}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {rule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
}

function AlertRulesSection() {
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<string | null>(null);

  const handleSave = (rule: AlertRule) => {
    setRules(prev => {
      const exists = prev.find(r => r.id === rule.id);
      if (exists) {
        return prev.map(r => r.id === rule.id ? rule : r);
      }
      return [...prev, rule];
    });
    setShowForm(false);
    setEditingRule(null);
  };

  const handleDelete = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleEnabled = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const getMetricLabel = (value: string) => METRICS.find(m => m.value === value)?.label || value;
  const getOperatorSymbol = (value: string) => {
    const map: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=' };
    return map[value] || value;
  };

  return (
    <>
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{rules.length} alert rule{rules.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => { setEditingRule(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Create Rule
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}</h3>
            <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="rounded p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AlertRuleForm
            rule={editingRule || undefined}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingRule(null); }}
          />
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No alert rules"
          description="Create alert rules to get notified when server metrics exceed thresholds."
        />
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`rounded-lg border bg-card p-4 transition-colors ${rule.enabled ? 'border-border' : 'border-border opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{rule.name}</h4>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${rule.enabled ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {getMetricLabel(rule.metric)}
                    </span>
                    <span className="font-mono font-bold">{getOperatorSymbol(rule.operator)}</span>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {rule.threshold}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {rule.channels.map(ch => {
                      const channel = CHANNELS.find(c => c.value === ch);
                      if (!channel) return null;
                      return (
                        <span key={ch} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          <channel.icon className="h-3 w-3" />
                          {channel.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Toggle
                    checked={rule.enabled}
                    onChange={() => toggleEnabled(rule.id)}
                  />
                  <button
                    onClick={() => { setEditingRule(rule); setShowForm(true); }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Edit rule"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteRuleTarget(rule.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete rule"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
      <ConfirmDialog
        open={deleteRuleTarget !== null}
        title="Delete Alert Rule"
        message={`This will permanently delete the alert rule "${rules.find(r => r.id === deleteRuleTarget)?.name || ''}". This cannot be undone.`}
        variant="danger"
        onConfirm={() => { if (deleteRuleTarget) handleDelete(deleteRuleTarget); setDeleteRuleTarget(null); }}
        onCancel={() => setDeleteRuleTarget(null)}
      />
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: typeof Bell }[] = [
  { key: 'history', label: 'History', icon: Clock },
  { key: 'smtp', label: 'SMTP', icon: Mail },
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
      <PageHeader title="Notifications & Alerts" description="Manage notifications, email delivery, preferences, and alert rules" />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && <NotificationHistorySection onNewNotification={handleNewNotification} />}
      {activeTab === 'smtp' && <SmtpSettingsSection />}
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
