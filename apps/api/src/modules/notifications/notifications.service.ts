import { db } from '../../db/index.js';
import { notifications } from '../../db/schema/notifications.js';
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
  async getPreferences(_userId: string) {
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

  async updatePreferences(userId: string, data: Partial<NotificationPreferences>) {
    return { ...await this.getPreferences(userId), ...data };
  }

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

    const mapped = results.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      read: row.read,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }));

    return { notifications: mapped, total };
  }

  async getUnreadCount(userId: string) {
    const result = await db.select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
    return result[0]?.count ?? 0;
  }

  async markAsRead(notificationId: string, userId: string) {
    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllAsRead(userId: string) {
    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
  }

  async createNotification(userId: string, type: NotificationType, title: string, message: string) {
    const id = nanoid();
    await db.insert(notifications).values({
      id,
      userId,
      type,
      title,
      message,
      read: false,
    });
    return { id };
  }

  async deleteNotification(notificationId: string, userId: string) {
    await db.delete(notifications).where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
  }
}

export const notificationsService = new NotificationsService();