import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringService } from './monitoring.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'rule-1',
            orgId: 'org-1',
            name: 'Updated Alert',
            metric: 'cpu_usage_percent',
            condition: 'gt',
            threshold: 80,
            duration: 60,
            channels: [],
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }]),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/systeminformation', () => ({
  default: {
    currentLoad: vi.fn().mockResolvedValue({ currentLoad: 45 }),
    mem: vi.fn().mockResolvedValue({ used: 8e9, total: 16e9 }),
    fsSize: vi.fn().mockResolvedValue([{ mount: '/', use: 60 }]),
    networkStats: vi.fn().mockResolvedValue([{ iface: 'eth0', rx_sec: 100, tx_sec: 50 }]),
  },
}));
vi.mock('../notifications/notifications.service', () => ({ notificationsService: { createNotification: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Monitoring Service', () => {
  let service: MonitoringService;

  const mockAlertRule = {
    id: 'rule-1',
    orgId: 'org-1',
    name: 'High CPU Alert',
    metric: 'cpu_usage_percent',
    condition: 'gt',
    threshold: 80,
    duration: 60,
    channels: [{ type: 'in_app' as const, target: 'user-1' }],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MonitoringService();
  });

  describe('recordMetric', () => {
    it('should record a metric', async () => {
      const { db } = await import('../../db/index');
      await service.recordMetric('cpu_usage_percent', 85, { host: 'testhost' });
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('listAlertRules', () => {
    it('should return alert rules', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockAlertRule]),
          }),
        }),
      } as any);
      const result = await service.listAlertRules('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('High CPU Alert');
    });
  });

  describe('createAlertRule', () => {
    it('should create alert rule and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockAlertRule, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.createAlertRule({
        orgId: 'org-1',
        name: 'New Alert',
        metric: 'cpu_usage_percent',
        condition: 'gt',
        threshold: 90,
        duration: 60,
        channels: [],
        enabled: true,
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('updateAlertRule', () => {
    it('should call db.update with correct params', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAlertRule]),
          }),
        }),
      } as any);
      await service.updateAlertRule('rule-1', { name: 'Updated Alert' });
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw if alert rule not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateAlertRule('nonexistent', { name: 'x' })).rejects.toThrow('Alert rule not found');
    });
  });

  describe('deleteAlertRule', () => {
    it('should delete alert rule', async () => {
      const { db } = await import('../../db/index');
      await service.deleteAlertRule('rule-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });
});