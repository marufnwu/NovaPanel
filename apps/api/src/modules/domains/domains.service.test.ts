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
        returning: vi.fn(() => [{ id: 'test-id', name: 'example.com' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'test-id', status: 'suspended' }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => []),
    })),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-nanoid-id',
}));

describe('Domains Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a working test setup', () => {
    expect(true).toBe(true);
  });
});
