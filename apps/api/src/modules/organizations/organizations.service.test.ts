import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationsService } from './organizations.service.js';

const mockOrg = {
  id: 'org-1',
  name: 'My Organization',
  slug: 'my-org',
  plan: 'free' as const,
  status: 'active' as const,
  settings: '{}',
  quotas: '{}',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMember = {
  id: 'member-1',
  orgId: 'org-1',
  userId: 'user-1',
  role: 'owner' as const,
  permissions: '[]',
  invitedBy: null,
  joinedAt: new Date(),
};

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
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
        returning: vi.fn().mockResolvedValue([mockOrg]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockOrg]),
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

describe('Organizations Service', () => {
  let service: OrganizationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationsService();
  });

  describe('listByUser', () => {
    it('should return organizations for user with role', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ org: mockOrg, role: 'owner', joinedAt: new Date() }]),
          }),
        }),
      } as any);
      const result = await service.listByUser('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Organization');
    });
  });

  describe('get', () => {
    it('should return organization by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrg]),
          }),
        }),
      } as any);
      const result = await service.get('org-1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('My Organization');
    });

    it('should return null if organization not found', async () => {
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

    it('should throw if user not a member when userId provided', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockOrg]),
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
      await expect(service.get('org-1', 'user-1')).rejects.toThrow('Not a member of this organization');
    });
  });

  describe('create', () => {
    it('should create organization with default project', async () => {
      const result = await service.create({ name: 'New Org', slug: 'new-org' }, 'user-1');
      expect(result.name).toBe('My Organization');
    });
  });

  describe('update', () => {
    it('should update organization and return updated', async () => {
      const result = await service.update('org-1', { name: 'Updated Org' });
      expect(result.name).toBe('My Organization');
    });
  });

  describe('delete', () => {
    it('should delete organization', async () => {
      const { db } = await import('../../db/index');
      await service.delete('org-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('listMembers', () => {
    it('should return organization members', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'member-1', role: 'owner', permissions: '[]', joinedAt: new Date(), userId: 'user-1', username: 'test', email: 'test@example.com', displayName: 'Test' }]),
          }),
        }),
      } as any);
      const result = await service.listMembers('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('inviteMember', () => {
    it('should throw if user not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.inviteMember('org-1', 'nonexistent@example.com', 'member', 'user-1')).rejects.toThrow('User with this email not found');
    });

    it('should throw if user already a member', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValue([mockMember]),
            }),
          }),
        } as any);
      await expect(service.inviteMember('org-1', 'test@example.com', 'member', 'user-1')).rejects.toThrow('User is already a member');
    });
  });

  describe('removeMember', () => {
    it('should remove member from organization', async () => {
      const { db } = await import('../../db/index');
      await service.removeMember('org-1', 'user-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const { db } = await import('../../db/index');
      await service.updateMemberRole('org-1', 'user-1', 'admin');
      expect(db.update).toHaveBeenCalled();
    });
  });
});