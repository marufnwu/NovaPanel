import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CronService } from './cron.service.js';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
    update: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/executor', () => ({
  run: vi.fn().mockResolvedValue({ success: true, stdout: '' }),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn().mockReturnValue({ catch: vi.fn() }) } }));

const mockJob = {
  id: 'job-1',
  projectId: 'proj-1',
  siteId: null,
  name: 'Test Job',
  command: 'echo test',
  schedule: '0 * * * *',
  user: 'root',
  status: 'active',
  lastRunAt: null,
  lastExitCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Cron Service', () => {
  let service: CronService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CronService();
  });

  describe('listJobs', () => {
    it('should return all cron jobs', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([mockJob]),
      } as any);
      const result = await service.listJobs();
      expect(result).toHaveLength(1);
    });
  });

  describe('getJob', () => {
    it('should return job by id', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockJob]),
          }),
        }),
      } as any);
      const result = await service.getJob('job-1');
      expect(result.id).toBe('job-1');
    });

    it('should throw if job not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getJob('nonexistent')).rejects.toThrow('Cron job not found');
    });
  });

  describe('createJob', () => {
    it('should throw if cron expression invalid', async () => {
      await expect(service.createJob({ command: 'test', schedule: 'invalid' })).rejects.toThrow('Cron expression must have 5 fields');
    });

    it('should create job with valid cron expression', async () => {
      const result = await service.createJob({ command: 'echo test', schedule: '0 * * * *' });
      expect(result.command).toBe('echo test');
      expect(result.schedule).toBe('0 * * * *');
    });
  });

  describe('updateJob', () => {
    it('should throw if job not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.updateJob('nonexistent', { schedule: '1 * * * *' })).rejects.toThrow('Cron job not found');
    });
  });

  describe('deleteJob', () => {
    it('should throw if job not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.deleteJob('nonexistent')).rejects.toThrow('Cron job not found');
    });
  });

  describe('toggleJob', () => {
    it('should throw if job not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.toggleJob('nonexistent')).rejects.toThrow('Cron job not found');
    });
  });

  describe('runJob', () => {
    it('should throw if job not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.runJob('nonexistent')).rejects.toThrow('Cron job not found');
    });
  });

  describe('getJobHistory', () => {
    it('should throw if job not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      await expect(service.getJobHistory('nonexistent')).rejects.toThrow('Cron job not found');
    });
  });
});