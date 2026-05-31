import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useNotifications,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  type Notification,
} from '../../api/hooks/notifications';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'history' | 'preferences'>('history');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: notificationsData, isLoading: notificationsLoading, isError: notificationsError, error: notificationsErrorObj, refetch: notificationsRefetch } = useNotifications(50);
  const { data: preferences, isLoading: preferencesLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id, {
      onSuccess: () => toast.success('Notification marked as read'),
      onError: (err) => toast.error(`Failed to mark as read: ${err.message}`),
    });
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => toast.success('All notifications marked as read'),
      onError: (err) => toast.error(`Failed to mark all as read: ${err.message}`),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteNotification.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Notification deleted');
        setDeleteId(null);
      },
      onError: (err) => toast.error(`Failed to delete notification: ${err.message}`),
    });
  };

  const handleTogglePreference = (key: string, value: boolean) => {
    updatePreferences.mutate({ [key]: value }, {
      onSuccess: () => toast.success('Preferences updated'),
      onError: (err) => toast.error(`Failed to update preferences: ${err.message}`),
    });
  };

  if (notificationsLoading || preferencesLoading) {
    return <PageSkeleton />;
  }
  if (notificationsError) return <ErrorState message={notificationsErrorObj?.message} onRetry={notificationsRefetch} />;

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const notificationTypeLabels: Record<string, string> = {
    ssl_expiry: 'SSL Expiry',
    backup_complete: 'Backup Complete',
    cron_failed: 'Cron Failed',
    security_alert: 'Security Alert',
    disk_space_low: 'Disk Space Low',
    service_down: 'Service Down',
    info: 'Info',
  };

  const tabs = [
    { id: 'history', label: 'History' },
    { id: 'preferences', label: 'Preferences' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Notifications</h1>
        {activeTab === 'history' && unreadCount > 0 && (
          <Button variant="ghost" size="small" onClick={handleMarkAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
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

      {activeTab === 'history' && (
        <>
          {notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Card key={notification.id} className={!notification.isRead ? 'border-l-2 border-l-foreground-primary' : ''}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-small text-foreground-tertiary capitalize">
                          {notificationTypeLabels[notification.type] || notification.type}
                        </span>
                        <span className="text-small text-foreground-tertiary">
                          {formatDate(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-foreground-primary" />
                        )}
                      </div>
                      <h3 className="font-medium text-small">{notification.title}</h3>
                      <p className="text-small text-foreground-secondary mt-1">{notification.message}</p>
                    </div>
                    <div className="flex gap-1">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => handleMarkAsRead(notification.id)}
                          icon={<Icon name="icon-check" size={15} />}
                        >
                          Read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => setDeleteId(notification.id)}
                        icon={<Icon name="icon-trash" size={15} />}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="icon-bell"
              title="No notifications"
              description="You're all caught up"
            />
          )}
        </>
      )}

      {activeTab === 'preferences' && preferences && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border-tertiary">
              <div>
                <h3 className="font-medium text-small">Email Notifications</h3>
                <p className="text-small text-foreground-secondary">Receive notifications via email</p>
              </div>
              <button
                className={`relative w-10 h-5 rounded-full transition-colors ${preferences.emailEnabled ? 'bg-foreground-primary' : 'bg-background-secondary'}`}
                onClick={() => handleTogglePreference('emailEnabled', !preferences.emailEnabled)}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${preferences.emailEnabled ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border-tertiary">
              <div>
                <h3 className="font-medium text-small">Push Notifications</h3>
                <p className="text-small text-foreground-secondary">Receive push notifications in browser</p>
              </div>
              <button
                className={`relative w-10 h-5 rounded-full transition-colors ${preferences.pushEnabled ? 'bg-foreground-primary' : 'bg-background-secondary'}`}
                onClick={() => handleTogglePreference('pushEnabled', !preferences.pushEnabled)}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${preferences.pushEnabled ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </div>

            {[
              { key: 'sslExpiry', label: 'SSL Expiry', desc: 'Get notified when SSL certificates are expiring' },
              { key: 'backupComplete', label: 'Backup Complete', desc: 'Get notified when backups finish' },
              { key: 'cronFailed', label: 'Cron Failed', desc: 'Get notified when cron jobs fail' },
              { key: 'securityAlert', label: 'Security Alerts', desc: 'Get notified about security issues' },
              { key: 'diskSpaceLow', label: 'Disk Space Low', desc: 'Get notified when disk space is running low' },
              { key: 'serviceDown', label: 'Service Down', desc: 'Get notified when services go down' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-border-tertiary last:border-0">
                <div>
                  <h3 className="font-medium text-small">{item.label}</h3>
                  <p className="text-small text-foreground-secondary">{item.desc}</p>
                </div>
                <button
                  className={`relative w-10 h-5 rounded-full transition-colors ${preferences[item.key as keyof typeof preferences] ? 'bg-foreground-primary' : 'bg-background-secondary'}`}
                  onClick={() => handleTogglePreference(item.key, !preferences[item.key as keyof typeof preferences])}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${preferences[item.key as keyof typeof preferences] ? 'left-5' : 'left-0.5'}`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Notification"
        description="This notification will be permanently deleted."
        confirmText="Delete"
        impact="medium"
        loading={deleteNotification.isPending}
      />
    </div>
  );
}