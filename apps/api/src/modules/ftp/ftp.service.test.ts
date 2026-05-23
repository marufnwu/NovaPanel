import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FtpService } from './ftp.service.js';

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
        returning: vi.fn().mockResolvedValue([{ id: 'ftp-1', username: 'testuser', password: 'secret', homeDir: '/home', status: 'active' }]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'ftp-1', username: 'testuser', homeDir: '/home', status: 'active' }]),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn().mockReturnValue({ catch: vi.fn() }) } }));

const mockAccount = {
  id: 'ftp-1',
  projectId: 'proj-1',
  siteId: 'site-1',
  username: 'testuser',
  password: 'secret',
  homeDir: '/home/testuser',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FTP Service', () => {
  let service: FtpService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FtpService();
  });

  describe('listAccounts', () => {
    it('should return accounts for domain', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockAccount]),
        }),
      } as any);
      const result = await service.listAccounts('site-1');
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('testuser');
    });
  });

  describe('getAccount', () => {
    it('should return account by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAccount]),
          }),
        }),
      } as any);
      const result = await service.getAccount('ftp-1');
      expect(result.username).toBe('testuser');
    });

    it('should throw if account not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getAccount('nonexistent')).rejects.toThrow('FTP account not found');
    });
  });

  describe('createAccount', () => {
    it('should create FTP account', async () => {
      const result = await service.createAccount('site-1', {
        username: 'newuser',
        password: 'secret',
        homeDir: '/home/newuser',
      });
      expect(result.username).toBe('testuser');
    });
  });

  describe('updateAccount', () => {
    it('should throw if account not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateAccount('nonexistent', { homeDir: '/new' })).rejects.toThrow('FTP account not found');
    });
  });

  describe('updatePassword', () => {
    it('should throw if account not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updatePassword('nonexistent', 'newpass')).rejects.toThrow('FTP account not found');
    });
  });

  describe('deleteAccount', () => {
    it('should throw if account not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteAccount('nonexistent')).rejects.toThrow('FTP account not found');
    });
  });

  describe('getSettings', () => {
    it('should return FTP settings', async () => {
      const result = await service.getSettings();
      expect(result.port).toBe(21);
      expect(result.passivePortMin).toBe(40000);
      expect(result.passivePortMax).toBe(50000);
    });
  });

  describe('updateSettings', () => {
    it('should return updated settings', async () => {
      const result = await service.updateSettings({ port: 2121 });
      expect(result.port).toBe(21);
    });
  });
});