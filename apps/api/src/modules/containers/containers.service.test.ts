import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainersService } from './containers.service.js';

const mockContainerData = {
  id: 'test-nanoid-id',
  orgId: 'proj-1',
  name: 'Test Container',
  type: 'image' as const,
  status: 'stopped' as const,
  containerId: null,
  composeFile: null,
  dockerfile: null,
  image: 'nginx:latest',
  env: '{}',
  secrets: '[]',
  networkMode: 'bridge',
  exposedPorts: '[]',
  cpuLimit: null,
  memoryLimit: null,
  replicas: 1,
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
        returning: vi.fn().mockResolvedValue([mockContainerData]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockContainerData, name: 'updated' }]),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../services/executor', () => ({ run: vi.fn().mockResolvedValue({ stdout: 'container-id-123', stderr: '' }) }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/sudo-fs', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Containers Service', () => {
  let service: ContainersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContainersService();
  });

  describe('list', () => {
    it('should return all containers', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockContainerData]),
        }),
      } as any);
      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-nanoid-id');
    });

    it('should filter by projectId', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockContainerData]),
        }),
      } as any);
      const result = await service.list('proj-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should return container by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContainerData]),
          }),
        }),
      } as any);
      const result = await service.get('container-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-nanoid-id');
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
    it('should create a container with image type', async () => {
      const result = await service.create({
        orgId: 'proj-1',
        name: 'new-container',
        type: 'image',
        image: 'nginx:latest',
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('update', () => {
    it('should call db.update with correct params', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContainerData]),
          }),
        }),
      } as any);
      await service.update('container-1', { name: 'updated' });
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete container', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockContainerData, containerId: null }]),
          }),
        }),
      } as any);
      const result = await service.delete('container-1');
      expect(result.success).toBe(true);
    });
  });

  describe('start', () => {
    it('should throw if container not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.start('nonexistent')).rejects.toThrow('Container not found');
    });
  });

  describe('stop', () => {
    it('should throw if container not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.stop('nonexistent')).rejects.toThrow('Container not found');
    });
  });

  describe('getLogs', () => {
    it('should throw if container not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getLogs('nonexistent')).rejects.toThrow('Container not found');
    });

    it('should return empty logs if no containerId', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockContainerData, containerId: null, status: 'stopped' }]),
          }),
        }),
      } as any);
      const result = await service.getLogs('container-1');
      expect(result.logs).toBe('');
      expect(result.running).toBe(false);
    });
  });
});