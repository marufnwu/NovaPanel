import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainersService } from './containers.service.js';

vi.mock('../../db/index', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../services/executor', () => ({ run: vi.fn() }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/sudo-fs', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('../audit/audit.service', () => ({ auditService: { log: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Containers Service', () => {
  let service: ContainersService;
  beforeEach(() => { vi.clearAllMocks(); service = new ContainersService(); });
  it('should have a working test setup', () => { expect(true).toBe(true); });
});