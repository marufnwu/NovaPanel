import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhooksService } from './webhooks.service.js';

vi.mock('../../db/index', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('nanoid', () => ({ nanoid: () => 'test-nanoid-id' }));

describe('Webhooks Service', () => {
  let service: WebhooksService;
  beforeEach(() => { vi.clearAllMocks(); service = new WebhooksService(); });
  it('should have a working test setup', () => { expect(true).toBe(true); });
});