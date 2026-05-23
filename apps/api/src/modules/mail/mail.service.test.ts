import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailService } from './mail.service.js';

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
        returning: vi.fn().mockResolvedValue([{ id: 'mb-1', username: 'test', enabled: true }]),
      }),
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
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn().mockReturnValue({ catch: vi.fn() }) } }));

const mockDomain = {
  id: 'domain-1',
  projectId: 'proj-1',
  name: 'example.com',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMailbox = {
  id: 'mb-1',
  projectId: 'proj-1',
  domainId: 'domain-1',
  username: 'test',
  password: 'secret',
  enabled: true,
  aliases: '[]',
  forwards: '[]',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Mail Service', () => {
  let service: MailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MailService();
  });

  describe('enableMail', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.enableMail('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should enable mail for domain', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDomain]),
          }),
        }),
      } as any);
      const result = await service.enableMail('domain-1');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
    });
  });

  describe('disableMail', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.disableMail('nonexistent')).rejects.toThrow('Domain not found');
    });
  });

  describe('getMailDomains', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getMailDomains('nonexistent')).rejects.toThrow('Domain not found');
    });

    it('should return domain info', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDomain]),
          }),
        }),
      } as any);
      const result = await service.getMailDomains('domain-1');
      expect(result[0].name).toBe('example.com');
    });
  });

  describe('createMailbox', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.createMailbox('nonexistent', { username: 'test', password: 'secret' })).rejects.toThrow('Domain not found');
    });

    it('should create mailbox', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDomain]),
          }),
        }),
      } as any);
      const result = await service.createMailbox('domain-1', { username: 'test', password: 'secret' });
      expect(result.username).toBe('test');
    });
  });

  describe('listMailboxes', () => {
    it('should return mailboxes for domain', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockMailbox]),
        }),
      } as any);
      const result = await service.listMailboxes('domain-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteMailbox', () => {
    it('should throw if mailbox not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteMailbox('nonexistent')).rejects.toThrow('Mailbox not found');
    });
  });

  describe('createAlias', () => {
    it('should throw if domain not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.createAlias('nonexistent', { source: 'alias', destination: 'dest' })).rejects.toThrow('Domain not found');
    });

    it('should throw if no mailbox exists', async () => {
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
      await expect(service.createAlias('domain-1', { source: 'alias', destination: 'dest' })).rejects.toThrow('Create a mailbox first');
    });
  });

  describe('deleteAlias', () => {
    it('should throw if mailbox not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteAlias('domain-1', '0')).rejects.toThrow('Mailbox not found');
    });
  });

  describe('getStats', () => {
    it('should return mail statistics', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockMailbox, aliases: '[]', forwards: '[]' }]),
        }),
      } as any);
      const result = await service.getStats('domain-1');
      expect(result.mailboxCount).toBe(1);
      expect(result.aliasCount).toBe(0);
      expect(result.forwardCount).toBe(0);
    });
  });
});