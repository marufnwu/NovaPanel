import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
        orderBy: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'test-id', name: 'test-webhook' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => []),
    })),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-nanoid-id',
}));

describe('Webhooks Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a working test setup', () => {
    expect(true).toBe(true);
  });
});