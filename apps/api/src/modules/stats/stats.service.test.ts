import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsService } from './stats.service.js';
import { run } from '../../services/executor.js';

vi.mock('systeminformation', () => ({
  default: {
    currentLoad: vi.fn().mockResolvedValue({ currentLoad: 35.5, cpus: [{ core: 0 }, { core: 1 }] }),
    mem: vi.fn().mockResolvedValue({ total: 16e9, available: 8e9, used: 8e9, cached: 2e9, buffcache: 1e9 }),
    fsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 500e9, used: 250e9, available: 250e9, use: 50, type: 'ext4' }]),
    time: vi.fn().mockResolvedValue({ uptime: 86400 }),
    osInfo: vi.fn().mockResolvedValue({ distro: 'Ubuntu', release: '22.04', hostname: 'server1', arch: 'x64', kernel: '5.15.0' }),
    networkInterfaces: vi.fn().mockResolvedValue([
      { iface: 'lo', internal: true, ip4: '127.0.0.1', ip6: '::1', mac: '00:00:00:00:00:00', type: 'loopback', speed: 0, carrier: 0 },
      { iface: 'eth0', internal: false, ip4: '192.168.0.211', ip6: 'fe80::1', mac: 'aa:bb:cc:dd:ee:ff', type: 'wired', speed: 1000, carrier: 1 },
    ]),
    services: vi.fn().mockResolvedValue([{ name: 'nginx', running: true, pids: [1234] }]),
    networkStats: vi.fn().mockResolvedValue([{ iface: 'eth0', rx_sec: 1000, tx_sec: 2000 }]),
    processList: vi.fn().mockResolvedValue([{ pid: 1, name: 'systemd', cpu: 0.1, mem: 0.2 }]),
    diskIO: vi.fn().mockResolvedValue({ rIO_sec: 1024, wIO_sec: 512 }),
    networkConnections: vi.fn().mockResolvedValue({ connections: 150 }),
  },
}));

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/executor', () => ({
  run: vi.fn(),
}));

describe('Stats Service', () => {
  let service: StatsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StatsService();
  });

  describe('getServerStats', () => {
    it('should return server stats with system information', async () => {
      const result = await service.getServerStats();
      expect(result).toBeTruthy();
      expect(result.cpu.usage).toBe(36);
      expect(result.memory.total).toBe(16e9);
    });
  });

  describe('getServiceStatuses', () => {
    it('should return service statuses', async () => {
      vi.mocked(run).mockResolvedValue({ stdout: 'active', stderr: '' } as any);
      const result = await service.getServiceStatuses();
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('restartService', () => {
    it('should throw for unknown services', async () => {
      await expect(service.restartService('unknown-service')).rejects.toThrow();
    });
  });
});