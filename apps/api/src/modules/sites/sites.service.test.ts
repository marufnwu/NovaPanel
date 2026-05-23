import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SitesService } from './sites.service.js';

const mockSite = {
  id: 'site-1',
  projectId: 'proj-1',
  name: 'My Site',
  slug: 'my-site',
  runtime: 'node' as const,
  sourceType: 'git' as const,
  gitRepo: 'https://github.com/example/repo',
  gitBranch: 'main',
  buildCommand: 'npm run build',
  startCommand: 'npm start',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDomain = {
  id: 'domain-1',
  projectId: 'proj-1',
  siteId: 'site-1',
  name: 'example.com',
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
        returning: vi.fn().mockResolvedValue([{ ...mockSite, id: 'test-nanoid-id' }]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSite]),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Sites Service', () => {
  let service: SitesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SitesService();
  });

  describe('list', () => {
    it('should return all sites', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([mockSite]),
      } as any);
      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Site');
    });
  });

  describe('get', () => {
    it('should call db.select for site lookup', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSite]),
          }),
        }),
      } as any);
      const result = await service.get('site-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('site-1');
    });

    it('should return null if site not found', async () => {
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

  describe('create', () => {
    it('should create site and return it', async () => {
      const { db } = await import('../../db/index');
      const result = await service.create({
        projectId: 'proj-1',
        name: 'New Site',
        runtime: { schemaVersion: 1, runtime: 'node' },
        sourceType: 'empty',
      });
      expect(db.insert).toHaveBeenCalled();
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('update', () => {
    it('should update site and return updated', async () => {
      const result = await service.update('site-1', { name: 'Updated Site' });
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete site', async () => {
      const { db } = await import('../../db/index');
      await service.delete('site-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('suspend', () => {
    it('should suspend site and return success', async () => {
      const result = await service.suspend('site-1');
      expect(result).toBeDefined();
    });
  });

  describe('activate', () => {
    it('should activate site and return success', async () => {
      const result = await service.activate('site-1');
      expect(result).toBeDefined();
    });
  });

  describe('attachDomain', () => {
    it('should attach domain to site', async () => {
      const { db } = await import('../../db/index');
      const result = await service.attachDomain('site-1', 'domain-1');
      expect(result.success).toBe(true);
    });
  });

  describe('detachDomain', () => {
    it('should detach domain from site', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDomain]),
          }),
        }),
      } as any);
      const result = await service.detachDomain('site-1', 'domain-1');
      expect(result.success).toBe(true);
    });

    it('should return failure if domain not attached to site', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockDomain, siteId: 'other-site' }]),
          }),
        }),
      } as any);
      const result = await service.detachDomain('site-1', 'domain-1');
      expect(result.success).toBe(false);
    });
  });
});