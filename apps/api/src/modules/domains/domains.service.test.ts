import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainsService } from './domains.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'domain-id',
            orgId: 'proj-1',
            siteId: 'site-1',
            name: 'example.com',
            type: 'apex',
            dnsZoneId: null,
            nameservers: null,
            dnssecEnabled: false,
            sslStatus: 'pending',
            sslCertId: null,
            sslAutoRenew: true,
            forceHttps: true,
            hstsEnabled: false,
            proxyEnabled: true,
            customNginxConfig: null,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          }]),
        }),
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([{
            id: 'domain-id',
            orgId: 'proj-1',
            siteId: 'site-1',
            name: 'example.com',
            type: 'apex',
            sslStatus: 'pending',
            sslAutoRenew: true,
            status: 'active',
            createdAt: new Date(),
          }]),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'new-domain-id', name: 'new.com' }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve({})),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({})),
    })),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../config/env', () => ({
  env: {
    ADMIN_EMAIL: 'admin@example.com',
    SESSION_SECRET: 'test-secret-at-least-32-chars-long',
    DATABASE_URL: 'file:/tmp/test.db',
    REDIS_URL: 'redis://localhost:6379',
    PORT: 8732,
  },
}));

vi.mock('../../audit/audit.service', () => ({
  auditService: { log: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../dns/dns.service', () => ({
  dnsService: {
    getZone: vi.fn().mockResolvedValue({ zone: { id: 'zone-1', name: 'example.com', dnssecEnabled: false, soa: {} }, records: [] }),
    checkPropagation: vi.fn().mockResolvedValue({ propagated: true }),
    createRecord: vi.fn().mockResolvedValue({ id: 'rec-1' }),
    updateRecord: vi.fn().mockResolvedValue({ id: 'rec-1' }),
    deleteRecord: vi.fn().mockResolvedValue({ success: true }),
    importZone: vi.fn().mockResolvedValue({ imported: 5 }),
    exportZone: vi.fn().mockResolvedValue('zone data'),
    resetToDefaults: vi.fn().mockResolvedValue({ success: true }),
    updateSoa: vi.fn().mockResolvedValue({ success: true }),
    syncCloudflareRecords: vi.fn().mockResolvedValue({ synced: 3 }),
    ensureZone: vi.fn().mockResolvedValue({ zone: { id: 'zone-1' } }),
    deleteZone: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../ssl/ssl.service', () => ({
  sslService: {
    getCertificate: vi.fn().mockResolvedValue({ id: 'cert-1', status: 'active' }),
    issueLetsEncrypt: vi.fn().mockResolvedValue({ success: true, certPath: '/etc/letsencrypt/live/example.com/fullchain.pem' }),
    renewCertificate: vi.fn().mockResolvedValue({ success: true }),
    removeCertificate: vi.fn().mockResolvedValue({ success: true }),
    downloadCert: vi.fn().mockResolvedValue('-----BEGIN CERTIFICATE-----'),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-nanoid-id',
}));

describe('Domains Service', () => {
  let service: DomainsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DomainsService();
  });

  describe('get', () => {
    it('should return a domain by id', async () => {
      const result = await service.get('domain-id');
      expect(result.id).toBe('domain-id');
      expect(result.name).toBe('example.com');
    });

    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.get('nonexistent')).rejects.toThrow('Domain not found');
    });
  });

  describe('create', () => {
    it('should create a domain and return it', async () => {
      const result = await service.create({ name: 'new.com', orgId: 'proj-1', siteId: 'site-1' });
      expect(result).toBeTruthy();
    });
  });

  describe('update', () => {
    it('should update domain fields', async () => {
      const result = await service.update('domain-id', { sslAutoRenew: false });
      expect(result).toBeTruthy();
    });

    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.update('nonexistent', { sslAutoRenew: false })).rejects.toThrow('Domain not found');
    });
  });

  describe('delete', () => {
    it('should delete a domain', async () => {
      await expect(service.delete('domain-id')).resolves.toBeUndefined();
    });

    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.delete('nonexistent')).rejects.toThrow('Domain not found');
    });
  });

  describe('suspend/unsuspend', () => {
    it('should suspend a domain', async () => {
      const result = await service.suspend('domain-id');
      expect(result).toBeTruthy();
    });

    it('should unsuspend a domain', async () => {
      const result = await service.unsuspend('domain-id');
      expect(result).toBeTruthy();
    });
  });

  describe('enableAutoSsl/disableAutoSsl', () => {
    it('should enable auto SSL', async () => {
      const result = await service.enableAutoSsl('domain-id');
      expect(result.success).toBe(true);
    });

    it('should disable auto SSL', async () => {
      const result = await service.disableAutoSsl('domain-id');
      expect(result.success).toBe(true);
    });

    it('should throw when enabling auto SSL for nonexistent domain', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.enableAutoSsl('nonexistent')).rejects.toThrow('Domain not found');
    });
  });

  describe('verifyDomain', () => {
    it('should return verified true when zone exists', async () => {
      const result = await service.verifyDomain('domain-id');
      expect(result.verified).toBe(true);
    });
  });

  describe('makePrimary', () => {
    it('should return success', async () => {
      const result = await service.makePrimary('domain-id');
      expect(result.success).toBe(true);
    });
  });
});
