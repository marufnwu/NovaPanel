import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirewallService } from './firewall.service.js';

vi.mock('../../services/executor', () => ({
  run: vi.fn(),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn().mockReturnValue({ catch: vi.fn() }) } }));

describe('Firewall Service', () => {
  let service: FirewallService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FirewallService();
  });

  describe('getStatus', () => {
    it('should return firewall status', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: 'Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)', stderr: '', exitCode: 0 });
      const result = await service.getStatus();
      expect(result.enabled).toBe(true);
      expect(result.defaultInput).toBe('deny');
    });

    it('should return disabled when not active', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: 'Status: inactive\nDefault: allow (incoming), allow (outgoing), disabled (routed)', stderr: '', exitCode: 0 });
      const result = await service.getStatus();
      expect(result.enabled).toBe(false);
    });
  });

  describe('enable', () => {
    it('should return success when enabling', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.enable();
      expect(result.success).toBe(true);
    });
  });

  describe('disable', () => {
    it('should return success when disabling', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.disable();
      expect(result.success).toBe(true);
    });
  });

  describe('listRules', () => {
    it('should return parsed firewall rules', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '[ 1] 22/tcp                    ALLOW IN    Anywhere\n[ 2] 80/tcp                    ALLOW IN    Anywhere', stderr: '', exitCode: 0 });
      const result = await service.listRules();
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
    });

    it('should return empty array if command fails', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: false, stdout: '', stderr: '', exitCode: 1 });
      const result = await service.listRules();
      expect(result).toHaveLength(0);
    });
  });

  describe('addRule', () => {
    it('should add rule and return success', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.addRule({ action: 'allow', port: '80', protocol: 'tcp' });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteRule', () => {
    it('should delete rule and return success', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.deleteRule(1);
      expect(result.success).toBe(true);
    });
  });

  describe('listJails', () => {
    it('should return fail2ban jails', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run)
        .mockResolvedValueOnce({ success: true, stdout: 'Jail list: sshd', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ success: true, stdout: 'Banned IP list: 192.168.1.1\nCurrently banned: 1', stderr: '', exitCode: 0 });
      const result = await service.listJails();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('sshd');
      expect(result[0].bannedCount).toBe(1);
    });

    it('should return empty array if no jails', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: false, stdout: '', stderr: '', exitCode: 1 });
      const result = await service.listJails();
      expect(result).toHaveLength(0);
    });
  });

  describe('banIp', () => {
    it('should ban IP and return success', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.banIp('sshd', '192.168.1.100');
      expect(result.success).toBe(true);
    });
  });

  describe('unbanIp', () => {
    it('should unban IP and return success', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.unbanIp('sshd', '192.168.1.100');
      expect(result.success).toBe(true);
    });
  });

  describe('resetRules', () => {
    it('should reset firewall rules', async () => {
      const { run } = await import('../../services/executor');
      vi.mocked(run).mockResolvedValue({ success: true, stdout: '', stderr: '', exitCode: 0 });
      const result = await service.resetRules();
      expect(result.success).toBe(true);
    });
  });
});