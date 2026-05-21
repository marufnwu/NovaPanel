import { AppError } from '../../errors.js';
import { db } from '../../db/index.js';
import { apiKeys } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { hashToken } from '../../utils/crypto.js';
import { authService } from '../auth/auth.service.js';

interface ValidateTokenResult {
  valid: boolean;
  user?: { id: string };
  token?: { id: string; permissions: string };
}

export class TokensService {
  async createToken(userId: string, name: string, expiresAt?: Date, ipAddress?: string) {
    return authService.generateApiKey(userId, name, expiresAt, ipAddress);
  }

  async listTokens(userId: string) {
    return db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
    }).from(apiKeys).where(eq(apiKeys.userId, userId));
  }

  async revokeToken(tokenId: string, userId: string, ipAddress?: string) {
    return authService.revokeApiKey(tokenId, userId, ipAddress);
  }

  async validateToken(token: string): Promise<ValidateTokenResult | null> {
    const keyHash = hashToken(token);
    const keyPrefix = token.substring(0, 8);
    const [apiKey] = await db.select().from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
    return {
      valid: true,
      user: { id: apiKey.userId || '' },
      token: { id: apiKey.id, permissions: typeof apiKey.permissions === 'string' ? apiKey.permissions : JSON.stringify(apiKey.permissions || '[]') },
    };
  }
}

export const tokensService = new TokensService();