import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokensService } from './tokens.service.js';

const mockApiKey = {
  id: 'key-1',
  userId: 'user-1',
  name: 'My API Key',
  keyPrefix: 'np_abc123',
  keyHash: 'hash123',
  permissions: '[]',
  scopes: '[]',
  rateLimit: 1000,
  expiresAt: null,
  createdAt: new Date(),
};

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));
vi.mock('../../services/redis', () => ({
  redisClient: { getClient: () => ({ get: vi.fn(), setex: vi.fn(), del: vi.fn() }) },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../utils/crypto', () => ({
  hashToken: vi.fn(() => 'hashed-token'),
  generateToken: vi.fn(() => 'np_test123'),
}));
vi.mock('../auth/auth.service', () => ({
  authService: {
    generateApiKey: vi.fn().mockResolvedValue({ key: 'np_newkey', name: 'Test Key', expiresAt: null }),
    revokeApiKey: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Tokens Service', () => {
  let service: TokensService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokensService();
  });

  describe('createToken', () => {
    it('should delegate to authService.generateApiKey', async () => {
      const { authService } = await import('../auth/auth.service');
      const result = await service.createToken('user-1', 'Test Key');
      expect(authService.generateApiKey).toHaveBeenCalledWith('user-1', 'Test Key', undefined, undefined);
      expect(result.key).toBe('np_newkey');
    });
  });

  describe('listTokens', () => {
    it('should return tokens for user', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockApiKey]),
        }),
      } as any);
      const result = await service.listTokens('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My API Key');
    });
  });

  describe('revokeToken', () => {
    it('should delegate to authService.revokeApiKey', async () => {
      const { authService } = await import('../auth/auth.service');
      const result = await service.revokeToken('key-1', 'user-1');
      expect(authService.revokeApiKey).toHaveBeenCalledWith('key-1', 'user-1', undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('validateToken', () => {
    it('should return null if token not found', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      const result = await service.validateToken('np_invalid_token');
      expect(result).toBeNull();
    });

    it('should return valid result if token found and not expired', async () => {
      const { db } = await import('../../db/index');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockApiKey, expiresAt: null }]),
          }),
        }),
      } as any);
      const result = await service.validateToken('np_valid_token');
      expect(result).not.toBeNull();
      expect(result!.valid).toBe(true);
    });

    it('should return null if token expired', async () => {
      const { db } = await import('../../db/index');
      const expiredDate = new Date(Date.now() - 86400000);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockApiKey, expiresAt: expiredDate }]),
          }),
        }),
      } as any);
      const result = await service.validateToken('np_expired_token');
      expect(result).toBeNull();
    });
  });
});