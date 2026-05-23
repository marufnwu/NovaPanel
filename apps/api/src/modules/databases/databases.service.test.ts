import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabasesService } from './databases.service.js';

const mockDatabase = {
  id: 'db-1',
  projectId: 'proj-1',
  name: 'my-db',
  type: 'postgresql' as const,
  version: '15',
  host: 'localhost',
  port: 5432,
  databaseName: 'mydb',
  username: 'admin',
  password: null,
  backupsEnabled: true,
  backupSchedule: '0 2 * * *',
  publicAccess: false,
  status: 'running' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  id: 'user-1',
  databaseId: 'db-1',
  username: 'dbuser',
  password: 'secret',
  privileges: '[]',
  createdAt: new Date(),
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
        returning: vi.fn().mockResolvedValue([{ ...mockDatabase, id: 'test-nanoid-id' }]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDatabase]),
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

describe('Databases Service', () => {
  let service: DatabasesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DatabasesService();
  });

  describe('list', () => {
    it('should return all databases with total count', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockDatabase]),
        }),
      } as any);
      const result = await service.list();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by projectId', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockDatabase]),
        }),
      } as any);
      const result = await service.list('proj-1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should return database by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDatabase]),
          }),
        }),
      } as any);
      const result = await service.get('db-1');
      expect(result).not.toBeNull();
      expect(result.name).toBe('my-db');
    });

    it('should throw if database not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.get('nonexistent')).rejects.toThrow('Database not found');
    });
  });

  describe('create', () => {
    it('should create database and return it', async () => {
      const result = await service.create({
        projectId: 'proj-1',
        name: 'new-db',
        type: 'postgresql',
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('update', () => {
    it('should update database and return updated', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDatabase]),
          }),
        }),
      } as any);
      const result = await service.update('db-1', { name: 'Updated DB' });
      expect(result.name).toBe('my-db');
    });
  });

  describe('delete', () => {
    it('should delete database and its users', async () => {
      const { db } = await import('../../db/index');
      await service.delete('db-1');
      expect(db.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('start', () => {
    it('should throw if database not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.start('nonexistent')).rejects.toThrow('Database not found');
    });
  });

  describe('stop', () => {
    it('should throw if database not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.stop('nonexistent')).rejects.toThrow('Database not found');
    });
  });

  describe('restart', () => {
    it('should throw if database not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.restart('nonexistent')).rejects.toThrow('Database not found');
    });
  });

  describe('listUsers', () => {
    it('should return database users', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser]),
        }),
      } as any);
      const result = await service.listUsers('db-1');
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('dbuser');
    });
  });

  describe('createUser', () => {
    it('should call db.insert with user data', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockUser, username: 'newuser' }]),
        }),
      } as any);
      const result = await service.createUser({
        databaseId: 'db-1',
        username: 'newuser',
        password: 'secret',
      });
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should delete database user', async () => {
      const { db } = await import('../../db/index');
      await service.deleteUser('user-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('updateUserPrivileges', () => {
    it('should update user privileges', async () => {
      const { db } = await import('../../db/index');
      await service.updateUserPrivileges('user-1', ['SELECT', 'INSERT']);
      expect(db.update).toHaveBeenCalled();
    });
  });
});