import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsService } from './projects.service.js';

const mockProject = {
  id: 'proj-1',
  orgId: 'org-1',
  name: 'My Project',
  slug: 'my-project',
  environment: 'production' as const,
  settings: '{}',
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
        returning: vi.fn().mockResolvedValue([mockProject]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProject]),
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

describe('Projects Service', () => {
  let service: ProjectsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectsService();
  });

  describe('listByOrg', () => {
    it('should return projects for an org', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockProject]),
        }),
      } as any);
      const result = await service.listByOrg('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Project');
    });
  });

  describe('get', () => {
    it('should return project by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProject]),
          }),
        }),
      } as any);
      const result = await service.get('proj-1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('My Project');
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

  describe('create', () => {
    it('should call db.insert with project data', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockProject, name: 'New Project' }]),
        }),
      } as any);
      const result = await service.create({
        name: 'New Project',
        slug: 'new-project',
        orgId: 'org-1',
      });
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update project and return updated', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProject]),
          }),
        }),
      } as any);
      const result = await service.update('proj-1', { name: 'Updated Project' });
      expect(result.name).toBe('My Project');
    });
  });

  describe('delete', () => {
    it('should delete project', async () => {
      const { db } = await import('../../db/index');
      await service.delete('proj-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });
});