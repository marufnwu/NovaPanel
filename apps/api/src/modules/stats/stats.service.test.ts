import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => []),
    })),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

describe('Stats Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a working test setup', () => {
    expect(true).toBe(true);
  });
});
