import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhooksService } from './webhooks.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
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

describe('Webhooks Service', () => {
  let service: WebhooksService;

  const mockWebhook = {
    id: 'webhook-1',
    orgId: 'org-1',
    name: 'My Webhook',
    url: 'https://example.com/webhook',
    secret: 'secret123',
    events: ['deploy'],
    enabled: true,
    headers: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDelivery = {
    id: 'delivery-1',
    webhookId: 'webhook-1',
    event: 'deploy',
    payload: { deployId: '123' },
    responseStatus: 200,
    responseBody: 'OK',
    success: true,
    deliveredAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhooksService();
  });

  describe('list', () => {
    it('should return webhooks ordered by createdAt desc', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockWebhook]),
          }),
        }),
      } as any);
      const result = await service.list('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Webhook');
    });
  });

  describe('create', () => {
    it('should create webhook and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockWebhook, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.create('org-1', {
        name: 'New Webhook',
        url: 'https://example.com/hook',
        events: ['deploy'],
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('get', () => {
    it('should return webhook by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockWebhook]),
          }),
        }),
      } as any);
      const result = await service.get('webhook-1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('My Webhook');
    });

    it('should return null if not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update webhook and return updated', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockWebhook, name: 'Updated Webhook' }]),
          }),
        }),
      } as any);
      const result = await service.update('webhook-1', { name: 'Updated Webhook' });
      expect(result.name).toBe('Updated Webhook');
    });

    it('should throw if webhook not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow('Webhook not found');
    });
  });

  describe('delete', () => {
    it('should delete webhook', async () => {
      const { db } = await import('../../db/index');
      await service.delete('webhook-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('regenerateSecret', () => {
    it('should update secret and return new secret', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      const result = await service.regenerateSecret('webhook-1');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('listDeliveries', () => {
    it('should return deliveries ordered by createdAt desc', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockDelivery]),
            }),
          }),
        }),
      } as any);
      const result = await service.listDeliveries('webhook-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('delivery-1');
    });
  });

  describe('recordDelivery', () => {
    it('should record delivery and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockDelivery, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.recordDelivery({
        webhookId: 'webhook-1',
        event: 'deploy',
        payload: {},
        success: true,
        responseStatus: 200,
        responseBody: 'OK',
        deliveredAt: new Date(),
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });
});