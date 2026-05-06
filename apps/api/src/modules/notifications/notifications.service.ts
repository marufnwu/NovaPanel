import { db } from '../../db/index.js';
import { notifications, notificationPreferences } from '../../db/schema/notifications.js';
import { eq, desc, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type NotificationType = 'ssl_expiry' | 'backup_complete' | 'cron_failed' | 'security_alert' | 'disk_space_low' | 'service_down' | 'info';

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

export class NotificationsService {
  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string) {
    const [prefs] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    
    if (!prefs) {
      // Create default preferences
      const id = nanoid();
      await db.insert(notificationPreferences).values({
        id,
        userId,
        emailEnabled: true,
        pushEnabled: false,
        sslExpiry: true,
        backupComplete: true,
        cronFailed: true,
        securityAlert: true,
        diskSpaceLow: true,
        serviceDown: true,
      });
      return {
        emailEnabled: true,
        pushEnabled: false,
        sslExpiry: true,
        backupComplete: true,
        cronFailed: true,
        securityAlert: true,
        diskSpaceLow: true,
        serviceDown: true,
      };
    }

    return {
      emailEnabled: prefs.emailEnabled,
      pushEnabled: prefs.pushEnabled,
      sslExpiry: prefs.sslExpiry,
      backupComplete: prefs.backupComplete,
      cronFailed: prefs.cronFailed,
      securityAlert: prefs.securityAlert,
      diskSpaceLow: prefs.diskSpaceLow,
      serviceDown: prefs.serviceDown,
    };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, data: Partial<NotificationPreferences>) {
    const [existing] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db.update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({
        id: nanoid(),
        userId,
        emailEnabled: data.emailEnabled ?? true,
        pushEnabled: data.pushEnabled ?? false,
        sslExpiry: data.sslExpiry ?? true,
        backupComplete: data.backupComplete ?? true,
        cronFailed: data.cronFailed ?? true,
        securityAlert: data.securityAlert ?? true,
        diskSpaceLow: data.diskSpaceLow ?? true,
        serviceDown: data.serviceDown ?? true,
      });
    }

    return this.getPreferences(userId);
  }

  /**
   * List notifications for a user.
   * Maps DB rows to a consistent shape with serialisable date strings.
   */
  async listNotifications(userId: string, limit: number = 50, offset: number = 0) {
    const results = await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const result = await db.select({ total: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    const total = result[0]?.total ?? 0;

    // Map to plain objects with consistent field names and serialised dates
    const mapped = results.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      isRead: row.isRead,
      readAt: row.readAt instanceof Date ? row.readAt.toISOString() : row.readAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }));

    return { notifications: mapped, total };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string) {
    const result = await db.select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result[0]?.count ?? 0;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  /**
   * Create a notification
   */
  async createNotification(userId: string, type: NotificationType, title: string, message: string) {
    const id = nanoid();
    await db.insert(notifications).values({
      id,
      userId,
      type,
      title,
      message,
      isRead: false,
    });
    return { id };
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    await db.delete(notifications).where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
  }
}

export const notificationsService = new NotificationsService();
