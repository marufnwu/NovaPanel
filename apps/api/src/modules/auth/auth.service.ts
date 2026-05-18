import { db } from '../../db/index.js';
import { users, sessions, tempTokens, twoFactorBackupCodes } from '../../db/schema/index.js';
import { eq, and, gt, isNull, lt } from 'drizzle-orm';
import { verifyPassword, generateToken, hashToken, encrypt, decrypt, hashPassword, sha256 } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { TOTP, Secret } from 'otpauth';
import { logger } from '../../config/logger.js';
import { randomBytes, createHash } from 'node:crypto';
import { auditService } from '../audit/audit.service.js';
import { env } from '../../config/env.js';
import { redisClient } from '../../services/redis.js';

const SESSION_DURATION_HOURS = 2;
const REMEMBER_ME_DAYS = 30;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const TEMP_TOKEN_DURATION_MINUTES = 5;
const PASSWORD_RESET_DURATION_HOURS = 1;
const BACKUP_CODE_COUNT = 10;
const RESET_RATE_LIMIT_HOURS = 1;
const MAX_RESET_REQUESTS_PER_EMAIL = 3;

export class AuthService {
  // --- Login ---
  async login(username: string, password: string, rememberMe?: boolean, ipAddress?: string) {
    // 1. Find user
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }

    // 2. Check active
    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
    }

    // 3. Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new AppError(423, 'ACCOUNT_LOCKED',
        `Account locked due to too many failed attempts. Try again in ${remainingMin} minutes.`);
    }

    // 4. Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: Record<string, any> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }

      await db.update(users).set(updateData).where(eq(users.id, user.id));

      // Audit log: login failure
      auditService.log({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.username}`,
        details: JSON.stringify({ username, attempts: newAttempts }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));

      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - newAttempts);
      throw new AppError(401, 'INVALID_CREDENTIALS',
        `Invalid username or password. ${remaining} attempt(s) remaining.`);
    }

    // 5. Reset failed attempts on successful password
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));

    // 6. If 2FA is enabled, issue a tempToken instead of a session
    if (user.twoFactorEnabled) {
      const tempToken = await this.issueTempToken(user.id, ipAddress);
      logger.info({ userId: user.id, username: user.username }, 'Login pending 2FA verification');
      return { requiresTwoFactor: true, tempToken };
    }

    // 7. No 2FA — create session directly
    return this.createSession(user, rememberMe || false, ipAddress);
  }

  // --- Issue Temp Token for 2FA flow ---
  private async issueTempToken(userId: string, ipAddress?: string): Promise<string> {
    const rawToken = generateToken('sft_');
    const tokenHash = hashToken(rawToken);
    const id = nanoid(21);
    const expiresAt = new Date(Date.now() + TEMP_TOKEN_DURATION_MINUTES * 60 * 1000);

    await db.insert(tempTokens).values({
      id,
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
    });

    return rawToken;
  }

  // --- Verify 2FA with tempToken ---
  async verify2FA(tempToken: string, code: string, rememberMe?: boolean, ipAddress?: string) {
    // 1. Validate tempToken
    const tokenHash = hashToken(tempToken);
    const [tokenRecord] = await db
      .select()
      .from(tempTokens)
      .where(and(
        eq(tempTokens.tokenHash, tokenHash),
        gt(tempTokens.expiresAt, new Date()),
        isNull(tempTokens.usedAt),
      ))
      .limit(1);

    if (!tokenRecord) {
      throw new AppError(401, 'INVALID_TEMP_TOKEN', 'Invalid or expired verification token');
    }

    // 2. Mark tempToken as used (single-use)
    await db
      .update(tempTokens)
      .set({ usedAt: new Date() })
      .where(eq(tempTokens.id, tokenRecord.id));

    // 3. Get user
    const [user] = await db.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1);
    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_TEMP_TOKEN', 'User not found or disabled');
    }

    // 4. Verify 2FA code (TOTP or backup code)
    if (code.length !== 6) {
      // Try backup code verification
      const backupValid = await this.verifyBackupCode(user.id, code);
      if (!backupValid) {
        throw new AppError(401, 'INVALID_2FA_CODE', 'Invalid 2FA code or backup code');
      }
    } else {
      // Verify TOTP code
      if (!user.twoFactorSecret) {
        throw new AppError(400, '2FA_NOT_CONFIGURED', '2FA is not properly configured');
      }
      const secret = decrypt(user.twoFactorSecret);
      const totp = new TOTP({ secret: Secret.fromBase32(secret) });
      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) {
        throw new AppError(401, 'INVALID_2FA_CODE', 'Invalid 2FA code');
      }
    }

    // 5. Create real session
    const result = await this.createSession(user, rememberMe || false, ipAddress);

    // Audit log: 2FA verification success
    auditService.log({
      userId: user.id,
      action: 'auth.2fa.verify',
      resource: `user:${user.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return result;
  }

  // --- Create Session (shared helper) ---
  private async createSession(user: any, rememberMe: boolean, ipAddress?: string) {
    // Use crypto.randomBytes(32) for 256-bit session ID entropy
    const sessionId = randomBytes(32).toString('hex');
    const sessionHash = sha256(sessionId);
    const expiresAt = rememberMe
      ? new Date(Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      sessionHash,
      expiresAt,
      lastActivityAt: new Date(),
      rememberMe,
    });

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    logger.info({ userId: user.id, username: user.username }, 'User logged in');

    // Audit log: login success
    auditService.log({
      userId: user.id,
      action: 'auth.login.success',
      resource: `user:${user.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return {
      sessionId,
      sessionHash,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  // --- Logout ---
  async logout(sessionId: string, userId?: string, ipAddress?: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    if (userId) {
      auditService.log({
        userId,
        action: 'auth.logout',
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));
    }
  }

  // --- Validate Session ---
  async validateSession(sessionId: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!session) return null;

    // Check idle timeout
    const idleTimeoutMs = env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
    const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt) : session.createdAt;
    const idleMs = Date.now() - lastActivity.getTime();
    if (idleMs > idleTimeoutMs) {
      // Session has been idle too long — invalidate it
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      logger.info({ sessionId }, 'Session invalidated due to idle timeout');
      return null;
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user || !user.isActive) return null;

    return { session, user };
  }

  // --- Validate Session by Hash (for WS auth) ---
  async validateSessionByHash(sessionHash: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.sessionHash, sessionHash), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!session) return null;

    // Check idle timeout
    const idleTimeoutMs = env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
    const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt) : session.createdAt;
    const idleMs = Date.now() - lastActivity.getTime();
    if (idleMs > idleTimeoutMs) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
      logger.info({ sessionId: session.id }, 'Session invalidated due to idle timeout (WS)');
      return null;
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user || !user.isActive) return null;

    return { session, user };
  }

  // --- Update Session Activity ---
  async updateSessionActivity(sessionId: string) {
    await db
      .update(sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  // --- Cleanup Expired Sessions ---
  async cleanupExpiredSessions() {
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()));
    return result;
  }

  // --- Enable 2FA (Step 1: Generate secret + QR) ---
  async enable2FA(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    // Generate TOTP secret
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: 'ServerForge',
      label: user.username,
      secret,
    });

    // Store encrypted secret (not enabled yet — must verify first)
    const encryptedSecret = encrypt(secret.base32);

    return {
      secret: encryptedSecret,
      qrCodeUri: totp.toString(),
      manualEntryKey: secret.base32,
    };
  }

  // --- Verify and Activate 2FA (Step 2) ---
  async verifyAndEnable2FA(userId: string, encryptedSecret: string, code: string, ipAddress?: string) {
    const secret = decrypt(encryptedSecret);
    const totp = new TOTP({ secret: Secret.fromBase32(secret) });
    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      throw new AppError(400, 'INVALID_2FA_CODE', 'Invalid 2FA code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Hash and store backup codes
    await this.storeBackupCodes(userId, backupCodes);

    // Enable 2FA
    await db
      .update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: true,
      })
      .where(eq(users.id, userId));

    logger.info({ userId }, '2FA enabled with backup codes generated');

    auditService.log({
      userId,
      action: 'auth.2fa.enable',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { enabled: true, backupCodes };
  }

  // --- Disable 2FA ---
  async disable2FA(userId: string, password: string, ipAddress?: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect');

    await db.update(users).set({
      twoFactorSecret: null,
      twoFactorEnabled: false,
    }).where(eq(users.id, userId));

    // Delete all backup codes
    await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, userId));

    logger.info({ userId }, '2FA disabled');

    auditService.log({
      userId,
      action: 'auth.2fa.disable',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { enabled: false };
  }

  // =====================
  // PASSWORD RESET FLOW
  // =====================

  /**
   * Check rate limit for password reset requests per email.
   * Returns { allowed: true } or { allowed: false, retryAfterSeconds: number }.
   */
  private async checkResetRateLimit(email: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const redis = redisClient.getClient();
    const key = `pwreset:ratelimit:${email}`;
    const ttlSeconds = RESET_RATE_LIMIT_HOURS * 3600;

    try {
      const current = await redis.get(key);
      if (current !== null && parseInt(current, 10) >= MAX_RESET_REQUESTS_PER_EMAIL) {
        const ttl = await redis.ttl(key);
        return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : RESET_RATE_LIMIT_HOURS * 3600 };
      }
      return { allowed: true };
    } catch (err) {
      logger.warn({ err, email }, 'Redis rate limit check failed — allowing request');
      return { allowed: true };
    }
  }

  /**
   * Increment the rate limit counter for a password reset request.
   */
  private async incrementResetRateLimit(email: string): Promise<void> {
    const redis = redisClient.getClient();
    const key = `pwreset:ratelimit:${email}`;
    const ttlSeconds = RESET_RATE_LIMIT_HOURS * 3600;

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);
      await pipeline.exec();
    } catch (err) {
      logger.warn({ err, email }, 'Redis rate limit increment failed');
    }
  }

  /**
   * Generate a password reset token for a user.
   * Stores raw token in Redis (15-min TTL) and hashed token in DB.
   * Returns the raw token so it can be displayed (no email configured yet).
   */
  async forgotPassword(email: string, ipAddress?: string): Promise<{ success: boolean; message: string; resetToken?: string; retryAfterSeconds?: number }> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      // Don't reveal whether email exists — still return success
      logger.info({ email }, 'Password reset requested for unknown email');
      return { success: true, message: 'If the email exists, a reset link has been sent' };
    }

    // Check rate limit
    const rateCheck = await this.checkResetRateLimit(email);
    if (!rateCheck.allowed) {
      throw new AppError(
        429,
        'RESET_RATE_LIMITED',
        `Too many password reset requests. Please try again in ${Math.ceil((rateCheck.retryAfterSeconds ?? 3600) / 60)} minutes.`,
      );
    }

    // Generate reset token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_DURATION_HOURS * 60 * 60 * 1000);

    // Store hashed token and expiry on user record
    await db.update(users).set({
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: expiresAt,
    }).where(eq(users.id, user.id));

    // Store raw token in Redis with 15-minute TTL for single-use verification
    const redisKey = `pwreset:${user.id}`;
    const redisTtl = 15 * 60; // 15 minutes
    try {
      const redis = redisClient.getClient();
      await redis.setex(redisKey, redisTtl, rawToken);
    } catch (err) {
      logger.warn({ err, userId: user.id }, 'Failed to store reset token in Redis — DB token will still work');
    }

    // Increment rate limit counter
    await this.incrementResetRateLimit(email);

    logger.info({ userId: user.id }, 'Password reset token generated and stored in Redis');

    auditService.log({
      userId: user.id,
      action: 'auth.password.reset_request',
      resource: `user:${user.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    // Return the raw token for development (no email configured)
    return {
      success: true,
      message: 'If the email exists, a reset link has been sent. For development, your reset token is shown below.',
      resetToken: rawToken,
    };
  }

  /**
   * Verify that a password reset token is valid (checks Redis primary + DB fallback).
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    // Try Redis first (primary, single-use)
    const redis = redisClient.getClient();
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    let userId: string | null = null;
    let userEmail: string | null = null;

    for (const user of allUsers) {
      const redisKey = `pwreset:${user.id}`;
      try {
        const stored = await redis.get(redisKey);
        if (stored === token) {
          userId = user.id;
          userEmail = user.email;
          break;
        }
      } catch {
        // Redis unavailable — fall through to DB check
      }
    }

    if (userId && userEmail) {
      return { valid: true, email: userEmail };
    }

    // Fallback: verify against DB hash (multi-use until consumed)
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.passwordResetToken, tokenHash),
        gt(users.passwordResetExpiresAt, new Date()),
      ))
      .limit(1);

    if (!user) {
      return { valid: false };
    }

    return { valid: true, email: user.email };
  }

  /**
   * Reset a user'\''s password using a valid reset token.
   * Consumes the Redis key on success (single-use). Falls back to DB token if Redis unavailable.
   */
  async resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<{ success: boolean }> {
    // Find user by scanning Redis keys
    let userId: string | null = null;
    const redis = redisClient.getClient();
    const allUsers = await db.select({ id: users.id, username: users.username }).from(users);

    for (const user of allUsers) {
      const redisKey = `pwreset:${user.id}`;
      try {
        const stored = await redis.get(redisKey);
        if (stored === token) {
          userId = user.id;
          break;
        }
      } catch {
        // Redis unavailable
      }
    }

    // Fallback: find by DB hash
    if (!userId) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.passwordResetToken, tokenHash),
          gt(users.passwordResetExpiresAt, new Date()),
        ))
        .limit(1);

      if (!user) {
        throw new AppError(400, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token');
      }
      userId = user.id;
    }

    // Get full user record
    const [user] = await db.select().from(users).where(eq(users.id, userId!)).limit(1);
    if (!user) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token');
    }

    if (newPassword.length < 8) {
      throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
    }

    // Delete Redis key (consume token)
    const redisKey = `pwreset:${user.id}`;
    try {
      await redis.del(redisKey);
    } catch (err) {
      logger.warn({ err, userId: user.id }, 'Failed to delete Redis reset token');
    }

    // Hash new password and clear DB reset token fields
    const newHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    }).where(eq(users.id, user.id));

    // Invalidate all existing sessions for security
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    logger.info({ userId: user.id }, 'Password reset completed, Redis token consumed');

    auditService.log({
      userId: user.id,
      action: 'auth.password.reset',
      resource: `user:${user.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  // =====================
  // 2FA BACKUP CODES
  // =====================

  /**
   * Generate a set of random backup codes (10 codes, 10 hex chars each).
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = randomBytes(5).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash and store backup codes for a user.
   * Deletes any existing unused codes first.
   */
  private async storeBackupCodes(userId: string, codes: string[]): Promise<void> {
    // Delete existing unused backup codes
    await db
      .delete(twoFactorBackupCodes)
      .where(and(
        eq(twoFactorBackupCodes.userId, userId),
        isNull(twoFactorBackupCodes.usedAt),
      ));

    // Hash and insert new codes
    const hashedCodes = await Promise.all(codes.map(code => hashPassword(code)));

    for (const codeHash of hashedCodes) {
      await db.insert(twoFactorBackupCodes).values({
        id: nanoid(21),
        userId,
        codeHash,
      });
    }
  }

  /**
   * Verify a backup code for a user. Marks the code as used on success.
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    // Get all unused backup codes for this user
    const codes = await db
      .select()
      .from(twoFactorBackupCodes)
      .where(and(
        eq(twoFactorBackupCodes.userId, userId),
        isNull(twoFactorBackupCodes.usedAt),
      ));

    // Check each hashed code
    for (const record of codes) {
      const valid = await verifyPassword(code, record.codeHash);
      if (valid) {
        // Mark as used
        await db
          .update(twoFactorBackupCodes)
          .set({ usedAt: new Date() })
          .where(eq(twoFactorBackupCodes.id, record.id));

        logger.info({ userId, codeId: record.id }, 'Backup code used');

        auditService.log({
          userId,
          action: 'auth.2fa.backup_code_used',
        }).catch(err => logger.error({ err }, 'Audit log failed'));

        return true;
      }
    }

    return false;
  }

  /**
   * Regenerate backup codes for a user. Requires password verification.
   * Returns the new plain-text codes (only shown once).
   */
  async regenerateBackupCodes(userId: string, password: string, ipAddress?: string): Promise<string[]> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    if (!user.twoFactorEnabled) {
      throw new AppError(400, '2FA_NOT_ENABLED', '2FA must be enabled to regenerate backup codes');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect');

    const newCodes = this.generateBackupCodes();
    await this.storeBackupCodes(userId, newCodes);

    logger.info({ userId }, 'Backup codes regenerated');

    auditService.log({
      userId,
      action: 'auth.2fa.backup_codes_regenerate',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return newCodes;
  }

  /**
   * Get remaining backup codes for a user, masked for display.
   * Returns codes like "A1B2C*****" — only first 3 chars visible.
   */
  async getBackupCodes(userId: string): Promise<Array<{ id: string; masked: string; usedAt: Date | null }>> {
    const codes = await db
      .select()
      .from(twoFactorBackupCodes)
      .where(eq(twoFactorBackupCodes.userId, userId));

    return codes.map(c => ({
      id: c.id,
      masked: '*****',
      usedAt: c.usedAt,
    }));
  }

  // --- Generate API Token ---
  async generateApiToken(userId: string, name: string, expiresAt?: Date, ipAddress?: string) {
    const rawToken = generateToken('sf_');
    const tokenHash = hashToken(rawToken);

    // Store hash in user record (for v1, one token per user)
    await db
      .update(users)
      .set({ apiTokenHash: tokenHash })
      .where(eq(users.id, userId));

    logger.info({ userId, tokenName: name }, 'API token generated');

    auditService.log({
      userId,
      action: 'auth.token.create',
      resource: `token:${name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return {
      token: rawToken, // Only shown once!
      name,
      expiresAt,
    };
  }

  // --- Validate API Token ---
  async validateApiToken(token: string) {
    const tokenHash = hashToken(token);
    // Look up user by token hash
    const [user] = await db.select().from(users).where(eq(users.apiTokenHash, tokenHash)).limit(1);
    if (!user || !user.isActive) return null;
    return user;
  }

  // --- Get Current User ---
  async getMe(userId: string) {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      twoFactorEnabled: users.twoFactorEnabled,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return user;
  }

  // --- Change Password ---
  async changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress?: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect');

    if (newPassword.length < 8) {
      throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    }).where(eq(users.id, userId));

    logger.info({ userId }, 'Password changed');

    auditService.log({
      userId,
      action: 'auth.password.change',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  // --- Change Email ---
  async changeEmail(userId: string, newEmail: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect');

    await db.update(users).set({ email: newEmail }).where(eq(users.id, userId));

    logger.info({ userId, newEmail }, 'Email changed');
    return { success: true };
  }

  // --- Update Profile ---
  async updateProfile(userId: string, data: { displayName?: string }) {
    const updateData: Record<string, any> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;

    await db.update(users).set(updateData).where(eq(users.id, userId));

    return this.getMe(userId);
  }

  // --- List Active Sessions ---
  async listSessions(userId: string) {
    const activeSessions = await db.select().from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())));

    return activeSessions.map(s => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      rememberMe: s.rememberMe,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      // Parse user agent for display
      browser: this.parseBrowser(s.userAgent),
      os: this.parseOS(s.userAgent),
    }));
  }

  // --- Revoke Session ---
  async revokeSession(userId: string, sessionId: string, ipAddress?: string) {
    const [session] = await db.select().from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);

    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');

    await db.delete(sessions).where(eq(sessions.id, sessionId));
    logger.info({ userId, sessionId }, 'Session revoked');

    auditService.log({
      userId,
      action: 'auth.session.revoke',
      resource: `session:${sessionId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  // --- Revoke All Other Sessions ---
  async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    const allSessions = await db.select().from(sessions).where(eq(sessions.userId, userId));
    let revoked = 0;

    for (const session of allSessions) {
      if (session.id !== currentSessionId) {
        await db.delete(sessions).where(eq(sessions.id, session.id));
        revoked++;
      }
    }

    logger.info({ userId, revoked }, 'All other sessions revoked');
    return { revoked };
  }

  // --- Helper: Parse Browser from User Agent ---
  private parseBrowser(ua?: string | null): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome/')) return 'Chrome';
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('PostmanRuntime')) return 'Postman';
    return 'Unknown';
  }

  // --- Helper: Parse OS from User Agent ---
  private parseOS(ua?: string | null): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  }
}

export const authService = new AuthService();