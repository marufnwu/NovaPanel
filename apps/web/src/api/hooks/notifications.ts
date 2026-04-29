import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Notification {
  id: string;
  userId: string;
  type: 'ssl_expiry' | 'backup_complete' | 'cron_failed' | 'security_alert' | 'disk_space_low' | 'service_down' | 'info';
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  sslExpiry: boolean;
  backupComplete: boolean;
  cronFailed: boolean;
  securityAlert: boolean;
  diskSpaceLow: boolean;
  serviceDown: boolean;
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => api.get<NotificationPreferences>('/notifications/preferences'),
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      api.put('/notifications/preferences', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] }),
  });
}

export function useNotifications(limit = 50, offset = 0, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['notifications', 'list', limit, offset],
    queryFn: () => api.get<{ notifications: Notification[]; total: number }>(`/notifications?limit=${limit}&offset=${offset}`),
    refetchInterval: options?.refetchInterval,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.post(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.delete(`/notifications/${notificationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
