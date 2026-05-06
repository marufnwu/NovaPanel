import { generateApiToken, hashToken } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';
import { db } from '../../db/index.js';
import { apiTokens, users } from '../../db/schema/index.js';
import { eq, and, gt, isNull, or } from 'drizzle-orm';

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

// ─── In-Memory Usage Tracking (kept in memory — not critical for auth) ───────

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
   * List all tokens for a user (excludes the actual token hash).
   * Reads from the database so tokens survive restarts.
   */
  async listTokens(userId: string) {
    const now = new Date();
    const rows = await db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        name: apiTokens.name,
        permissions: apiTokens.permissions,
        expiresAt: apiTokens.expiresAt,
        createdAt: apiTokens.createdAt,
        lastUsedAt: apiTokens.lastUsedAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId));

    // Filter out expired tokens client-side (SQLite timestamp comparison can be tricky)
    return rows
      .filter(t => !t.expiresAt || t.expiresAt > now)
      .map(t => ({
        ...t,
        permissions: JSON.parse(t.permissions),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Generate a new API token.
   * Stores the SHA-256 hash in the database; returns the plain token only once.
   */
  async generateToken(options: CreateTokenOptions, ipAddress?: string) {
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
    const createdAt = new Date();

    await db.insert(apiTokens).values({
      id,
      userId,
      name,
      tokenHash,
      permissions: JSON.stringify(permissions),
      expiresAt,
      createdAt,
    });

    // Initialise in-memory usage tracker
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
      createdAt,
    };
  }

  /**
   * Revoke/delete a token.
   */
  async revokeToken(userId: string, tokenId: string, ipAddress?: string) {
    const [token] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, tokenId))
      .limit(1);

    if (!token) {
      throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token not found');
    }
    if (token.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not own this token');
    }

    await db.delete(apiTokens).where(eq(apiTokens.id, tokenId));
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
   * Get usage history for a token (in-memory, recent only).
   */
  async getTokenUsage(userId: string, tokenId: string) {
    const [token] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, tokenId))
      .limit(1);

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
   * Record token usage (called from auth middleware when a Bearer token is used).
   */
  recordUsage(tokenId: string, method: string, path: string, statusCode: number, ipAddress: string, userAgent: string) {
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
  }

  /**
   * Validate an API token (used by auth middleware).
   * Hashes the provided token, looks it up in the DB, updates lastUsedAt,
   * and returns the token record together with the user info.
   */
  async validateToken(rawToken: string): Promise<{
    valid: boolean;
    token?: ApiToken;
    user?: {
      id: string;
      username: string;
      email: string;
      displayName: string | null;
      role: string;
      isActive: boolean;
    };
  }> {
    const tokenHash = hashToken(rawToken);

    // Look up token by hash
    const [row] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);

    if (!row) {
      return { valid: false };
    }

    // Check expiry
    if (row.expiresAt && row.expiresAt < new Date()) {
      // Clean up expired token
      await db.delete(apiTokens).where(eq(apiTokens.id, row.id));
      return { valid: false };
    }

    // Fetch the associated user
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return { valid: false };
    }

    // Update lastUsedAt (fire-and-forget)
    db.update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, row.id))
      .catch(err => logger.error({ err }, 'Failed to update token lastUsedAt'));

    const token: ApiToken = {
      id: row.id,
      userId: row.userId,
      name: row.name,
      tokenHash: row.tokenHash,
      permissions: JSON.parse(row.permissions),
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    };

    return { valid: true, token, user };
  }
}

export const tokensService = new TokensService();
