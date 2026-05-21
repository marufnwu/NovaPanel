import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginsService } from './plugins.service.js';
import { AppError } from '../../utils/errors.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([{
          id: 'test-plugin-id',
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'A test plugin',
          author: 'Test Author',
          manifest: { onInstall: { code: 'return "installed"', language: 'javascript' } },
          enabled: false,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }]),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'test-plugin-id',
            name: 'Test Plugin',
            version: '1.0.0',
            description: 'A test plugin',
            author: 'Test Author',
            manifest: { onInstall: { code: 'return "installed"', language: 'javascript' } },
            enabled: false,
            config: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          }]),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{
          id: 'test-nanoid-id',
          name: 'New Plugin',
          version: '2.0.0',
          description: 'New description',
          author: 'Author',
          manifest: {},
          enabled: false,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{
          id: 'test-plugin-id',
          name: 'Updated Plugin',
          version: '1.0.0',
          description: 'Updated',
          author: 'Author',
          manifest: {},
          enabled: true,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }])),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    })),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-nanoid-id',
}));

vi.mock('vm2', () => ({
  VM: vi.fn(() => ({
    run: vi.fn(() => 'sandbox-result'),
  })),
}));

describe('Plugins Service', () => {
  let service: PluginsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PluginsService();
  });

  describe('list', () => {
    it('should return all plugins ordered by createdAt desc', async () => {
      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-plugin-id');
    });
  });

  describe('get', () => {
    it('should return a plugin by id', async () => {
      const result = await service.get('test-plugin-id');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-plugin-id');
    });

    it('should return null if plugin not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      const result = await service.get('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a plugin with generated id', async () => {
      const data = {
        name: 'New Plugin',
        version: '2.0.0',
        description: 'New description',
        author: 'Author',
      };
      const result = await service.create(data);
      expect(result.name).toBeTruthy();
    });
  });

  describe('update', () => {
    it('should update plugin and return updated version', async () => {
      const result = await service.update('test-plugin-id', { name: 'Updated Name' });
      expect(result.id).toBe('test-plugin-id');
    });

    it('should throw if plugin not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow('Plugin not found');
    });
  });

  describe('delete', () => {
    it('should delete a plugin', async () => {
      await service.delete('test-plugin-id');
      const { db } = await import('../../db/index');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('should toggle plugin enabled state', async () => {
      const result = await service.toggle('test-plugin-id');
      expect(result.id).toBe('test-plugin-id');
    });

    it('should throw if plugin not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.toggle('nonexistent')).rejects.toThrow('Plugin not found');
    });
  });

  describe('updateConfig', () => {
    it('should update plugin config', async () => {
      const result = await service.updateConfig('test-plugin-id', { key: 'value' });
      expect(result.id).toBe('test-plugin-id');
    });
  });

  describe('executeHook', () => {
    it('should throw if plugin not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.executeHook('nonexistent', 'onInstall')).rejects.toThrow('Plugin not found');
    });

    it('should throw if plugin is disabled', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([{
              id: 'test-plugin-id',
              name: 'Test Plugin',
              version: '1.0.0',
              description: 'A test plugin',
              author: 'Test Author',
              manifest: { onInstall: { code: 'return "installed"', language: 'javascript' } },
              enabled: false,
              config: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }]),
          }),
        }),
      } as any);
      await expect(service.executeHook('test-plugin-id', 'onInstall')).rejects.toThrow('Plugin is disabled');
    });

    it('should return undefined if hook not defined in manifest', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([{
              id: 'test-plugin-id',
              name: 'Test Plugin',
              version: '1.0.0',
              description: 'A test plugin',
              author: 'Test Author',
              manifest: {},
              enabled: true,
              config: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }]),
          }),
        }),
      } as any);
      const result = await service.executeHook('test-plugin-id', 'onInstall');
      expect(result).toBeUndefined();
    });

    it('should throw if hook language is unsupported', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([{
              id: 'test-plugin-id',
              name: 'Test Plugin',
              version: '1.0.0',
              description: 'A test plugin',
              author: 'Test Author',
              manifest: { onInstall: { code: 'print("hello")', language: 'python' } },
              enabled: true,
              config: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }]),
          }),
        }),
      } as any);
      await expect(service.executeHook('test-plugin-id', 'onInstall')).rejects.toThrow('Unsupported hook language: python');
    });

    it('should execute hook and return result', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([{
              id: 'test-plugin-id',
              name: 'Test Plugin',
              version: '1.0.0',
              description: 'A test plugin',
              author: 'Test Author',
              manifest: { onInstall: { code: 'return "installed"', language: 'javascript' } },
              enabled: true,
              config: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }]),
          }),
        }),
      } as any);
      const result = await service.executeHook('test-plugin-id', 'onInstall', { foo: 'bar' });
      expect(result).toBe('sandbox-result');
    });
  });
});
