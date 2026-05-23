import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Notifications Service', () => {
  let service: NotificationsService;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'info' as const,
    title: 'Test Notification',
    message: 'This is a test',
    read: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService();
  });

  describe('getPreferences', () => {
    it('should return default preferences', async () => {
      const result = await service.getPreferences('user-1');
      expect(result.emailEnabled).toBe(true);
      expect(result.pushEnabled).toBe(false);
      expect(result.sslExpiry).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('should merge new preferences with existing', async () => {
      const result = await service.updatePreferences('user-1', { emailEnabled: false });
      expect(result.emailEnabled).toBe(false);
      expect(result.pushEnabled).toBe(false);
    });
  });

  describe('listNotifications', () => {
    it('should call db.select for notifications', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([mockNotification]),
                }),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ total: 1 }]),
            }),
          }),
        } as any);
      const result = await service.listNotifications('user-1');
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should call db.select and return count', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        }),
      } as any);
      const result = await service.getUnreadCount('user-1');
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const { db } = await import('../../db/index');
      await service.markAsRead('notif-1', 'user-1');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const { db } = await import('../../db/index');
      await service.markAllAsRead('user-1');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('createNotification', () => {
    it('should create notification and return id', async () => {
      const result = await service.createNotification('user-1', 'info', 'Test', 'Message');
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const { db } = await import('../../db/index');
      await service.deleteNotification('notif-1', 'user-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });
});