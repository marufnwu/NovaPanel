import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessesService } from './processes.service.js';

vi.mock('../../services/executor.js', () => ({
  run: vi.fn(),
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Processes Service', () => {
  let service: ProcessesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProcessesService();
  });

  describe('listProcesses', () => {
    it('should return empty array when pm2 jlist fails', async () => {
      const { run } = await import('../../services/executor.js');
      vi.mocked(run).mockResolvedValue({ success: false, stdout: '', stderr: 'PM2 not found', exitCode: 1 });

      const result = await service.listProcesses();
      expect(result).toEqual([]);
    });

    it('should return empty array when pm2 jlist returns invalid json', async () => {
      const { run } = await import('../../services/executor.js');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: 'invalid json', stderr: '', exitCode: 0 });

      const result = await service.listProcesses();
      expect(result).toEqual([]);
    });

    it('should return parsed processes when pm2 jlist succeeds', async () => {
      const { run } = await import('../../services/executor.js');
      const mockProcessList = JSON.stringify([
        {
          name: 'web-app',
          pm_id: 0,
          pid: 1234,
          monit: { memory: 104857600, cpu: 5.2 },
          pm2_env: { status: 'online', restart_time: 0, uptime: 3600 },
        },
        {
          name: 'worker',
          pm_id: 1,
          pid: 5678,
          monit: { memory: 52428800, cpu: 1.5 },
          pm2_env: { status: 'stopped', restart_time: 2, uptime: 0 },
        },
      ]);
      vi.mocked(run).mockResolvedValue({ success: true, stdout: mockProcessList, stderr: '', exitCode: 0 });

      const result = await service.listProcesses();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'web-app',
        status: {
          running: true,
          pid: 1234,
          uptime: 3600,
          memoryMb: 100,
          cpuPercent: 5.2,
          restartCount: 0,
          status: 'online',
        },
      });
      expect(result[1]).toEqual({
        name: 'worker',
        status: {
          running: false,
          pid: 5678,
          uptime: 0,
          memoryMb: 50,
          cpuPercent: 1.5,
          restartCount: 2,
          status: 'stopped',
        },
      });
    });
  });

  describe('getProcess', () => {
    it('should return process info for a specific process', async () => {
      // Mock the getProcessManager to return a mock manager
      vi.mock('../../services/process-manager/index.js', async () => {
        const mockManager = {
          isAvailable: vi.fn().mockResolvedValue(true),
          getStatus: vi.fn().mockResolvedValue({
            running: true,
            pid: 1234,
            uptime: 3600,
            memoryMb: 100,
            cpuPercent: 5.2,
            restartCount: 0,
            status: 'online',
          }),
        };
        return {
          getProcessManager: vi.fn().mockResolvedValue(mockManager),
        };
      });

      const result = await service.getProcess('web-app');

      expect(result).toEqual({
        name: 'web-app',
        status: {
          running: true,
          pid: 1234,
          uptime: 3600,
          memoryMb: 100,
          cpuPercent: 5.2,
          restartCount: 0,
          status: 'online',
        },
      });
    });
  });
});