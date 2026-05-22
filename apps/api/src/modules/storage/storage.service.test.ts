import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './storage.service.js';

vi.mock('../../db/index', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Storage Service', () => {
  let service: StorageService;
  beforeEach(() => { vi.clearAllMocks(); service = new StorageService(); });
  it('should have a working test setup', () => { expect(true).toBe(true); });
});