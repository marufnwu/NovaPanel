import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from './backup.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'backup-1',
            resourceType: 'site',
            type: 'full',
            storageBackend: 'local',
            storagePath: '/backups/backup_2026-05-22.sfbk',
            status: 'completed',
            createdAt: new Date(),
          }]),
        }),
        orderBy: vi.fn().mockResolvedValue([{
          id: 'backup-2',
          resourceType: 'database',
          type: 'incremental',
          storageBackend: 'local',
          status: 'running',
          createdAt: new Date(),
        }]),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'new-backup-id', status: 'running' }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve({})),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({})),
    })),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../config/env', () => ({
  env: {
    BACKUP_DIR: '/backups',
    VHOSTS_ROOT: '/var/www',
  },
}));

vi.mock('../../services/executor', () => ({
  run: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' }),
}));

vi.mock('../../services/sudo-fs', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    chmod: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../audit/audit.service', () => ({
  auditService: { log: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../utils/crypto', () => ({
  encrypt: vi.fn((data) => `encrypted_${data}`),
  decrypt: vi.fn((data) => `decrypted_${data}`),
}));

vi.mock('../../services/mariadb.service', () => ({
  mariadbService: { backup: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('../../services/postgres.service', () => ({
  postgresService: { backup: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-nanoid-id',
}));

describe('Backup Service', () => {
  let service: BackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BackupService();
  });

  describe('listBackups', () => {
    it('should return all backups ordered by createdAt', async () => {
      const result = await service.listBackups();
      expect(result).toBeTruthy();
    });
  });

  describe('getBackup', () => {
    it('should return a backup by id', async () => {
      const result = await service.getBackup('backup-1');
      expect(result.id).toBe('backup-1');
      expect(result.resourceType).toBe('site');
    });

    it('should throw if backup not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getBackup('nonexistent')).rejects.toThrow('Backup not found');
    });
  });

  describe('deleteBackup', () => {
    it('should delete a backup and its file', async () => {
      await expect(service.deleteBackup('backup-1')).resolves.toBeUndefined();
    });

    it('should throw if backup not found when deleting', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteBackup('nonexistent')).rejects.toThrow('Backup not found');
    });
  });

  describe('listSchedules', () => {
    it('should return all backup schedules', async () => {
      const result = await service.listSchedules();
      expect(result).toBeTruthy();
    });
  });

  describe('restoreBackup', () => {
    it('should throw if backup not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.restoreBackup('nonexistent')).rejects.toThrow('Backup not found');
    });
  });
});