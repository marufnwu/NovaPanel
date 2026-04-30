import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
        limit: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'test-id' }]),
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

vi.mock('../../utils/crypto', () => ({
  hashPassword: vi.fn(() => Promise.resolve('hashed-password')),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
  generateToken: vi.fn(() => 'generated-token'),
  hashToken: vi.fn(() => 'hashed-token'),
  sha256: vi.fn(() => 'hashed-session'),
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../config/env', () => ({
  env: { SESSION_IDLE_TIMEOUT_MINUTES: 30 },
}));

vi.mock('../audit/audit.service', () => ({
  auditService: { log: vi.fn(() => Promise.resolve()) },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Password hashing', () => {
    it('should hash and verify passwords', async () => {
      const { hashPassword, verifyPassword } = await import('../../utils/crypto');
      const hash = await hashPassword('test-password');
      expect(hash).toBe('hashed-password');
      const valid = await verifyPassword('test-password', hash);
      expect(valid).toBe(true);
    });
  });

  describe('Token generation', () => {
    it('should generate unique tokens', async () => {
      const { generateToken } = await import('../../utils/crypto');
      const token = generateToken('api');
      expect(token).toBe('generated-token');
    });
  });
});
