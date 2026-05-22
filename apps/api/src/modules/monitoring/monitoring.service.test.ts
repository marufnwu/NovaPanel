import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringService } from './monitoring.service.js';

vi.mock('../../db/index', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/systeminformation', () => ({ default: { currentLoad: vi.fn(), mem: vi.fn(), fsSize: vi.fn(), networkStats: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Monitoring Service', () => {
  let service: MonitoringService;
  beforeEach(() => { vi.clearAllMocks(); service = new MonitoringService(); });
  it('should have a working test setup', () => { expect(true).toBe(true); });
});