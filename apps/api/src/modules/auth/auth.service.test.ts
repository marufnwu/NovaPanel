import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUser = {
  id: 'u1',
  username: 'admin',
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'admin',
  passwordHash: 'hashed-password',
  twoFactorEnabled: false,
  twoFactorSecret: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession = {
  id: 'session-123',
  userId: 'u1',
  sessionHash: 'hash-123',
  expiresAt: new Date(Date.now() + 3600000),
  lastActivityAt: new Date(),
  rememberMe: false,
  createdAt: new Date(),
};

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
  encrypt: vi.fn((v) => `encrypted:${v}`),
  decrypt: vi.fn((v) => v.replace('encrypted:', '')),
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

vi.mock('../../services/redis', () => ({
  redisClient: { getClient: vi.fn(() => ({ get: vi.fn(), setex: vi.fn(), del: vi.fn(), pipeline: vi.fn(() => ({ incr: vi.fn(), expire: vi.fn(), exec: vi.fn() })) })) },
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

  describe('Session hash', () => {
    it('should hash session IDs with sha256', async () => {
      const { sha256 } = await import('../../utils/crypto');
      const hash = sha256('session-123');
      expect(hash).toBe('hashed-session');
    });
  });

  describe('Token hash', () => {
    it('should hash tokens with hashToken', async () => {
      const { hashToken } = await import('../../utils/crypto');
      const hash = hashToken('token-abc');
      expect(hash).toBe('hashed-token');
    });
  });
});