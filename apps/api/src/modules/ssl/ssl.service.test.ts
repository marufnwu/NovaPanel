import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SslService } from './ssl.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn(),
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
vi.mock('../../services/certbot.service', () => ({
  certbotService: {
    issue: vi.fn().mockResolvedValue({ certPath: '/path/cert.pem', keyPath: '/path/key.pem', chainPath: '/path/chain.pem' }),
    renew: vi.fn().mockResolvedValue(true),
    getCertExpiry: vi.fn().mockResolvedValue(new Date(Date.now() + 90 * 86400 * 1000)),
    deleteCertificate: vi.fn().mockResolvedValue(undefined),
    generateSelfSigned: vi.fn().mockResolvedValue({ certPath: '/path/self.pem', keyPath: '/path/self-key.pem' }),
    issueCertificate: vi.fn().mockResolvedValue({ certPath: '/path/cert.pem', keyPath: '/path/key.pem', chainPath: '/path/chain.pem' }),
    issueCertificateDns01: vi.fn().mockResolvedValue({ certPath: '/path/dns.pem', keyPath: '/path/dns-key.pem', fullChainPath: '/path/dns-chain.pem' }),
  },
}));
vi.mock('../../services/cloudflare-client', () => ({
  CloudflareClient: vi.fn().mockImplementation(() => ({
    getZoneByName: vi.fn().mockResolvedValue({ id: 'zone-1' }),
    createDnsRecord: vi.fn().mockResolvedValue({ id: 'dns-1' }),
    deleteDnsRecord: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock('../../services/nginx.service', () => ({
  nginxService: { applySecurityRules: vi.fn().mockResolvedValue(undefined), reload: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../services/sudo-fs', () => ({
  readFile: vi.fn().mockResolvedValue('pem-content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
  chown: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../config/env', () => ({ env: { PANEL_URL: 'http://localhost:8732', VHOSTS_ROOT: '/var/www', CF_API_TOKEN: 'test-token', CF_ACCOUNT_ID: 'test-account' } }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('SSL Service', () => {
  let service: SslService;

  const mockDomain = {
    id: 'domain-1',
    projectId: 'proj-1',
    name: 'example.com',
    sslStatus: 'pending' as const,
    sslCertId: null,
    hstsEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCert = {
    id: 'cert-1',
    domainId: 'domain-1',
    type: 'letsencrypt' as const,
    certPem: 'cert-content',
    keyPem: 'key-content',
    chainPem: 'chain-content',
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 86400 * 1000),
    autoRenew: true,
    status: 'active' as const,
    lastError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SslService();
  });

  describe('listAll', () => {
    it('should return empty when no certificates', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      } as any);
      const result = await service.listAll();
      expect(result).toHaveLength(0);
    });
  });

  describe('getCertificate', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getCertificate('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should return enabled false when no cert exists', async () => {
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
      const result = await service.getCertificate('domain-1');
      expect(result.enabled).toBe(false);
      expect(result.certificate).toBeNull();
    });
  });

  describe('removeCertificate', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.removeCertificate('nonexistent')).rejects.toThrow('Domain not found');
    });
  });

  describe('renewCertificate', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.renewCertificate('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should throw if no certificate found', async () => {
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
      await expect(service.renewCertificate('domain-1')).rejects.toThrow('No certificate found');
    });
  });

  describe('getCertDetails', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getCertDetails('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should throw if certificate not found', async () => {
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
      await expect(service.getCertDetails('domain-1')).rejects.toThrow('Certificate not found');
    });
  });

  describe('toggleAutoRenew', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.toggleAutoRenew('nonexistent', true)).rejects.toThrow('Domain not found');
    });
  });

  describe('downloadCert', () => {
    it('should throw if certificate not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.downloadCert('domain-1', 'cert')).rejects.toThrow('Certificate not found');
    });
  });

  describe('validateChain', () => {
    it('should throw if certificate not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.validateChain('domain-1')).rejects.toThrow('Certificate not found');
    });
  });

  describe('deleteCert', () => {
    it('should throw if certificate not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteCert('nonexistent')).rejects.toThrow('Certificate not found');
    });
  });

  describe('renewCert', () => {
    it('should throw if certificate not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.renewCert('nonexistent')).rejects.toThrow('Certificate not found');
    });

    it('should throw if not a letsencrypt cert', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([{ ...mockCert, type: 'self_signed' }]),
          }),
        }),
      } as any);
      await expect(service.renewCert('cert-1')).rejects.toThrow('Only LetsEncrypt certificates can be renewed');
    });
  });
});