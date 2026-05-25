import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityService } from './security.service.js';

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
vi.mock('../../services/nginx.service', () => ({ nginxService: { applySecurityRules: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Security Service', () => {
  let service: SecurityService;

  const mockWafRule = {
    id: 'waf-1',
    orgId: 'org-1',
    name: 'Block SQL Injection',
    type: 'sql_injection' as const,
    enabled: true,
    priority: 100,
    config: { block: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIpAllowlist = {
    id: 'allow-1',
    orgId: 'org-1',
    name: 'Office IPs',
    ips: ['192.168.1.1', '192.168.1.2'],
    type: 'allow' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SecurityService();
  });

  describe('listWafRules', () => {
    it('should return WAF rules ordered by priority', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockWafRule]),
          }),
        }),
      } as any);
      const result = await service.listWafRules('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Block SQL Injection');
    });

    it('should return empty when no rules', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      const result = await service.listWafRules('proj-none');
      expect(result).toHaveLength(0);
    });
  });

  describe('createWafRule', () => {
    it('should create WAF rule and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockWafRule, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.createWafRule('proj-1', {
        name: 'New Rule',
        type: 'custom',
        enabled: true,
        priority: 50,
        config: {},
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('updateWafRule', () => {
    it('should update WAF rule and return updated', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockWafRule, name: 'Updated Rule' }]),
          }),
        }),
      } as any);
      const result = await service.updateWafRule('waf-1', 'org-1', { name: 'Updated Rule' });
      expect(result.name).toBe('Updated Rule');
    });

    it('should throw if WAF rule not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateWafRule('nonexistent', 'org-1', { name: 'x' })).rejects.toThrow('WAF rule not found');
    });
  });

  describe('deleteWafRule', () => {
    it('should delete WAF rule and apply nginx rules', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockWafRule]),
          }),
        }),
      } as any);
      await service.deleteWafRule('waf-1', 'org-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('listIpAllowlists', () => {
    it('should return IP allowlists ordered by createdAt', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockIpAllowlist]),
          }),
        }),
      } as any);
      const result = await service.listIpAllowlists('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Office IPs');
    });
  });

  describe('createIpAllowlist', () => {
    it('should create IP allowlist and return it', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockIpAllowlist, id: 'test-nanoid-id' }]),
          }),
        }),
      } as any);
      const result = await service.createIpAllowlist('org-1', {
        name: 'New Allowlist',
        ips: ['10.0.0.1'],
        type: 'allow' as const,
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('updateIpAllowlist', () => {
    it('should update IP allowlist and return updated', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockIpAllowlist, name: 'Updated Allowlist' }]),
          }),
        }),
      } as any);
      const result = await service.updateIpAllowlist('allow-1', 'org-1', { name: 'Updated Allowlist' });
      expect(result.name).toBe('Updated Allowlist');
    });

    it('should throw if IP allowlist not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateIpAllowlist('nonexistent', 'org-1', { name: 'x' })).rejects.toThrow('IP allowlist not found');
    });
  });

  describe('deleteIpAllowlist', () => {
    it('should delete IP allowlist and apply nginx rules', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockIpAllowlist]),
          }),
        }),
      } as any);
      await service.deleteIpAllowlist('allow-1', 'org-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });
});