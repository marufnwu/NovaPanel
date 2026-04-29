import { generateApiToken, hashToken } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  permissions: string[];
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface TokenUsageEntry {
  id: string;
  tokenId: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

interface CreateTokenOptions {
  userId: string;
  name: string;
  expiresIn: string; // '30d', '90d', '1y', 'never'
  permissions: string[];
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const tokens = new Map<string, ApiToken>();
const tokenUsage = new Map<string, TokenUsageEntry[]>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseExpiry(expiresIn: string): Date | null {
  switch (expiresIn) {
    case '30d':
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    case 'never':
      return null;
    default:
      throw new AppError(400, 'INVALID_EXPIRY', 'Invalid expiry value. Use: 30d, 90d, 1y, never');
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TokensService {
  /**
   * List all tokens for a user (excludes the actual token hash)
   */
  listTokens(userId: string) {
    const userTokens: Omit<ApiToken, 'tokenHash'>[] = [];
    for (const token of tokens.values()) {
      if (token.userId === userId) {
        // Check if token is expired
        if (token.expiresAt && token.expiresAt < new Date()) {
          continue; // Skip expired tokens
        }
        userTokens.push({
          id: token.id,
          userId: token.userId,
          name: token.name,
          permissions: token.permissions,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
          lastUsedAt: token.lastUsedAt,
        });
      }
    }
    return userTokens.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Generate a new API token
   */
  generateToken(options: CreateTokenOptions, ipAddress?: string) {
    const { userId, name, expiresIn, permissions } = options;

    // Validate permissions
    const validPermissions = [
      'domains', 'databases', 'files', 'ssl',
      'backups', 'dns', 'mail', 'ftp', 'settings',
    ];
    const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPerms.length > 0) {
      throw new AppError(400, 'INVALID_PERMISSIONS', `Invalid permissions: ${invalidPerms.join(', ')}`);
    }

    const rawToken = generateApiToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = parseExpiry(expiresIn);
    const id = nanoid();

    const apiToken: ApiToken = {
      id,
      userId,
      name,
      tokenHash,
      permissions,
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: null,
    };

    tokens.set(id, apiToken);
    tokenUsage.set(id, []);

    logger.info({ userId, tokenId: id, tokenName: name }, 'API token generated');

    auditService.log({
      userId,
      action: 'token.create',
      resource: `token:${name}`,
      details: JSON.stringify({ tokenId: id, permissions }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return {
      id,
      token: rawToken, // Only shown once!
      name,
      permissions,
      expiresAt,
      createdAt: apiToken.createdAt,
    };
  }

  /**
   * Revoke/delete a token
   */
  revokeToken(userId: string, tokenId: string, ipAddress?: string) {
    const token = tokens.get(tokenId);
    if (!token) {
      throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token not found');
    }
    if (token.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not own this token');
    }

    tokens.delete(tokenId);
    tokenUsage.delete(tokenId);

    logger.info({ userId, tokenId }, 'API token revoked');

    auditService.log({
      userId,
      action: 'token.revoke',
      resource: `token:${tokenId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  /**
   * Get usage history for a token
   */
  getTokenUsage(userId: string, tokenId: string) {
    const token = tokens.get(tokenId);
    if (!token) {
      throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token not found');
    }
    if (token.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not own this token');
    }

    const usage = tokenUsage.get(tokenId) || [];
    return usage.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Record token usage (called from auth middleware when a Bearer token is used)
   */
  recordUsage(tokenHash: string, method: string, path: string, statusCode: number, ipAddress: string, userAgent: string) {
    for (const [tokenId, token] of tokens.entries()) {
      if (token.tokenHash === tokenHash) {
        // Update last used
        token.lastUsedAt = new Date();

        // Record usage entry
        const usage = tokenUsage.get(tokenId) || [];
        usage.push({
          id: nanoid(),
          tokenId,
          method,
          path,
          statusCode,
          ipAddress,
          userAgent,
          timestamp: new Date(),
        });

        // Keep only last 100 entries
        if (usage.length > 100) {
          usage.splice(0, usage.length - 100);
        }

        tokenUsage.set(tokenId, usage);
        break;
      }
    }
  }

  /**
   * Validate an API token (used by auth middleware)
   */
  validateToken(rawToken: string): { valid: boolean; token?: ApiToken } {
    const tokenHash = hashToken(rawToken);
    for (const token of tokens.values()) {
      if (token.tokenHash === tokenHash) {
        // Check expiry
        if (token.expiresAt && token.expiresAt < new Date()) {
          return { valid: false };
        }
        return { valid: true, token };
      }
    }
    return { valid: false };
  }
}

export const tokensService = new TokensService();
