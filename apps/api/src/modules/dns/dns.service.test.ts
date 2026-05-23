import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DnsService } from './dns.service.js';

const mockDomain = {
  id: 'domain-1',
  projectId: 'proj-1',
  name: 'example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockZone = {
  id: 'zone-1',
  projectId: 'proj-1',
  domainId: 'domain-1',
  name: 'example.com',
  dnssecEnabled: false,
  soa: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecord = {
  id: 'record-1',
  zoneId: 'zone-1',
  name: 'www',
  type: 'A' as const,
  value: '192.168.1.1',
  ttl: 3600,
  priority: null,
  proxied: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockRecord]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRecord]),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../services/cloudflare-client', () => ({
  CloudflareClient: vi.fn().mockImplementation(() => ({
    getZoneByName: vi.fn().mockResolvedValue({ id: 'cf-zone-1' }),
    createDnsRecord: vi.fn().mockResolvedValue({ id: 'cf-record-1' }),
    updateDnsRecord: vi.fn().mockResolvedValue(undefined),
    deleteDnsRecord: vi.fn().mockResolvedValue(undefined),
    listDnsRecords: vi.fn().mockResolvedValue({ records: [] }),
  })),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../config/env', () => ({ env: { CF_API_TOKEN: 'test-token', CF_ACCOUNT_ID: 'test-account' } }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('DNS Service', () => {
  let service: DnsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DnsService();
  });

  describe('getZone', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getZone('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should throw if zone not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockDomain]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any);
      await expect(service.getZone('domain-1')).rejects.toThrow('DNS zone not found');
    });
  });

  describe('ensureZone', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.ensureZone('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should return existing zone if already exists', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockDomain]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockZone]),
            }),
          }),
        } as any);
      const result = await service.ensureZone('domain-1');
      expect(result.id).toBe('zone-1');
    });
  });

  describe('createRecord', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.createRecord('nonexistent', { type: 'A', name: 'www', value: '1.2.3.4' })).rejects.toThrow('Domain not found');
    });
  });

  describe('updateRecord', () => {
    it('should throw if record not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateRecord('nonexistent', { value: '1.2.3.4' })).rejects.toThrow('DNS record not found');
    });
  });

  describe('deleteRecord', () => {
    it('should throw if record not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteRecord('nonexistent')).rejects.toThrow('DNS record not found');
    });
  });

  describe('exportZone', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.exportZone('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should throw if zone not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockDomain]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any);
      await expect(service.exportZone('domain-1')).rejects.toThrow('DNS zone not found');
    });
  });

  describe('resetToDefaults', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.resetToDefaults('nonexistent')).rejects.toThrow('Domain not found');
    });
  });

  describe('getCloudflareConfig', () => {
    it('should return cloudflare config', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDomain]),
          }),
        }),
      } as any);
      const result = await service.getCloudflareConfig('domain-1');
      expect(result.enabled).toBe(true);
    });
  });
});