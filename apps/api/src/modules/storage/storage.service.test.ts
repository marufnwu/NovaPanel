import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './storage.service.js';

const mockBucket = {
  id: 'bucket-1',
  projectId: 'proj-1',
  name: 'my-bucket',
  region: 'default',
  publicAccess: false,
  versioning: false,
  corsRules: null,
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
        returning: vi.fn().mockResolvedValue([{ ...mockBucket, id: 'test-nanoid-id' }]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockBucket, name: 'Updated Bucket' }]),
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

describe('Storage Service', () => {
  let service: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorageService();
  });

  describe('listBuckets', () => {
    it('should return all buckets', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBucket]),
        }),
      } as any);
      const result = await service.listBuckets();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('my-bucket');
    });

    it('should filter by projectId', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBucket]),
        }),
      } as any);
      const result = await service.listBuckets('proj-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getBucket', () => {
    it('should return bucket by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockBucket]),
          }),
        }),
      } as any);
      const result = await service.getBucket('bucket-1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('my-bucket');
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
      const result = await service.getBucket('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createBucket', () => {
    it('should create bucket and return it', async () => {
      const result = await service.createBucket({
        projectId: 'proj-1',
        name: 'new-bucket',
        region: 'us-east-1',
        publicAccess: true,
      });
      expect(result.id).toBe('test-nanoid-id');
    });
  });

  describe('updateBucket', () => {
    it('should update bucket and return updated', async () => {
      const result = await service.updateBucket('bucket-1', { name: 'Updated Bucket' });
      expect(result.name).toBe('Updated Bucket');
    });
  });

  describe('deleteBucket', () => {
    it('should delete bucket and its access keys', async () => {
      const { db } = await import('../../db/index');
      await service.deleteBucket('bucket-1');
      expect(db.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('listAccessKeys', () => {
    it('should return access keys without secretKeyHash', async () => {
      const { db } = await import('../../db/index');
      const mockKey = { id: 'key-1', projectId: 'proj-1', name: 'my-key', accessKeyId: 'np_abc', secretKeyHash: 'hash123', permissions: '[]' };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockKey]),
        }),
      } as any);
      const result = await service.listAccessKeys('proj-1');
      expect(result).toHaveLength(1);
      expect((result[0] as any).secretKeyHash).toBeUndefined();
    });
  });

  describe('createAccessKey', () => {
    it('should call db.insert with access key data', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'key-1', projectId: 'proj-1', name: 'new-key', accessKeyId: 'np_test123', secretKeyHash: 'hash', permissions: '[]' }]),
        }),
      } as any);
      const result = await service.createAccessKey({
        projectId: 'proj-1',
        name: 'new-key',
        permissions: ['read'],
      });
      expect(db.insert).toHaveBeenCalled();
      expect(result.accessKeyId).toBeTruthy();
    });
  });

  describe('deleteAccessKey', () => {
    it('should delete access key', async () => {
      const { db } = await import('../../db/index');
      await service.deleteAccessKey('key-1');
      expect(db.delete).toHaveBeenCalled();
    });
  });
});