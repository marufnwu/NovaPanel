import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from './billing.service.js';

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

describe('Billing Service', () => {
  let service: BillingService;

  const mockUsageRecord = {
    id: 'usage-1',
    orgId: 'org-1',
    resourceType: 'cpu' as const,
    quantity: 2,
    unit: 'cores',
    timestamp: new Date(),
  };

  const mockInvoice = {
    id: 'inv-1',
    orgId: 'org-1',
    status: 'draft' as const,
    amount: 99.99,
    currency: 'USD',
    lineItems: [],
    createdAt: new Date(),
  };

  const mockPlan = {
    id: 'plan-1',
    name: 'Pro Plan',
    slug: 'pro',
    price: 29.99,
    quotas: { cpu: 4, memory: 8 },
    features: ['feature1'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BillingService();
  });

  describe('listUsageRecords', () => {
    it('should return usage records ordered by timestamp', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockUsageRecord]),
          }),
        }),
      } as any);
      const result = await service.listUsageRecords('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('usage-1');
    });

    it('should return empty when no records', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      const result = await service.listUsageRecords('org-none');
      expect(result).toHaveLength(0);
    });
  });

  describe('recordUsage', () => {
    it('should record usage and return created record', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockUsageRecord, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.recordUsage('org-1', 'cpu', 2, 'cores');
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('getCurrentUsage', () => {
    it('should aggregate usage by resource type', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { resourceType: 'cpu', quantity: 2, unit: 'cores' },
            { resourceType: 'cpu', quantity: 3, unit: 'cores' },
            { resourceType: 'memory', quantity: 4, unit: 'gb' },
          ]),
        }),
      } as any);
      const result = await service.getCurrentUsage('org-1');
      expect(result.cpu.quantity).toBe(5);
      expect(result.memory.quantity).toBe(4);
    });
  });

  describe('listInvoices', () => {
    it('should return invoices ordered by createdAt desc', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockInvoice]),
          }),
        }),
      } as any);
      const result = await service.listInvoices('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inv-1');
    });
  });

  describe('createInvoice', () => {
    it('should create invoice and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockInvoice, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.createInvoice('org-1', 99.99);
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockInvoice, status: 'paid' }]),
          }),
        }),
      } as any);
      const result = await service.updateInvoiceStatus('inv-1', 'paid');
      expect(result.status).toBe('paid');
    });

    it('should throw if invoice not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateInvoiceStatus('nonexistent', 'paid')).rejects.toThrow('Invoice not found');
    });
  });

  describe('listPlans', () => {
    it('should return active plans ordered by price', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockPlan]),
          }),
        }),
      } as any);
      const result = await service.listPlans();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('pro');
    });
  });

  describe('getPlan', () => {
    it('should return plan by slug', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPlan]),
          }),
        }),
      } as any);
      const result = await service.getPlan('pro');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('pro');
    });

    it('should return null if plan not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      const result = await service.getPlan('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createPlan', () => {
    it('should create plan and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockPlan, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.createPlan({ name: 'New Plan', slug: 'new', price: 19.99, quotas: {}, features: [], isActive: true });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('updatePlan', () => {
    it('should update plan and return updated', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockPlan, name: 'Updated Plan' }]),
          }),
        }),
      } as any);
      const result = await service.updatePlan('plan-1', { name: 'Updated Plan' });
      expect(result.name).toBe('Updated Plan');
    });

    it('should throw if plan not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updatePlan('nonexistent', { name: 'x' })).rejects.toThrow('Plan not found');
    });
  });

  describe('deletePlan', () => {
    it('should soft delete plan by setting isActive false', async () => {
      const { db } = await import('../../db/index');
      await service.deletePlan('plan-1');
      expect(db.update).toHaveBeenCalled();
    });
  });
});